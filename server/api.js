import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import pool, { initDatabase } from './db.js';
import { parseResume, generateQuestions, evaluateAnswer, generateFollowUpQuestion, evaluateFollowUpAnswer, analyzeVocabulary } from './gemini.js';
import { extractTextFromFile } from './fileParser.js';
import { isNotionEnabled, syncVocabularyToNotion, deleteVocabularyFromNotion } from './notion.js';
import { requireCredits, chargeCredits, AI_COSTS, AI_COST_DESCRIPTIONS, checkCredits, getCreditsHistory, addCredits } from './credits.js';

const app = express();
const PORT = 3002;

// Multer setup for file uploads (memory storage)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Preserve original filename encoding
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, true);
  }
});

// CORS configuration
app.use(cors({
  origin: true, // Allow all origins (or specify your frontend URL)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

// Helper function to convert Date to MySQL datetime format
function toMySQLDatetime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

// Helper function to hash password (simple base64 for demo)
function hashPassword(password) {
  return Buffer.from(password).toString('base64');
}

function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

// Generate session token
function generateToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Auth middleware
async function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT s.user_id, u.ai_credits, u.notion_api_key, u.notion_database_id 
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = ? AND s.expires_at > NOW()`,
      [token]
    );
    const session = rows[0];
    
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.userId = session.user_id;
    req.userCredits = session.ai_credits;
    req.userNotionConfig = {
      notion_api_key: session.notion_api_key,
      notion_database_id: session.notion_database_id
    };
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

// ===== AUTH ROUTES =====

app.post('/api/auth/register', async (req, res) => {
  const { email, password, username } = req.body;

  try {
    const passwordHash = hashPassword(password);
    const [result] = await pool.query(
      `INSERT INTO users (email, password_hash, username) VALUES (?, ?, ?)`,
      [email, passwordHash, username || email.split('@')[0]]
    );

    const [userRows] = await pool.query(
      'SELECT id, email, username, created_at FROM users WHERE id = ?',
      [result.insertId]
    );
    const user = userRows[0];
    
    // Create session
    const token = generateToken();
    const expiresAt = toMySQLDatetime(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)); // 30 days
    await pool.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, token, expiresAt]
    );

    res.json({ user, token });
  } catch (error) {
    res.status(400).json({ error: error.code === 'ER_DUP_ENTRY' ? 'Email already exists' : error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const [userRows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = userRows[0];
    
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken();
    const expiresAt = toMySQLDatetime(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    await pool.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, token, expiresAt]
    );

    const { password_hash, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/logout', authenticate, async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    await pool.query('DELETE FROM sessions WHERE token = ?', [token]);
    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, email, username, avatar_url, target_language, ai_credits, notion_api_key, notion_database_id, created_at FROM users WHERE id = ?',
      [req.userId]
    );
    const user = rows[0];
    
    // 返回Notion配置状态（不返回完整密钥）
    const response = {
      ...user,
      notion_configured: !!(user.notion_api_key && user.notion_database_id),
      notion_api_key: user.notion_api_key ? user.notion_api_key.substring(0, 10) + '...' : null,
      notion_database_id: user.notion_database_id ? user.notion_database_id.substring(0, 8) + '...' : null
    };
    
    res.json(response);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user settings (including Notion configuration)
app.put('/api/auth/settings', authenticate, async (req, res) => {
  const { notion_api_key, notion_database_id, username, target_language } = req.body;
  
  try {
    const updates = [];
    const values = [];
    
    if (notion_api_key !== undefined) {
      updates.push('notion_api_key = ?');
      values.push(notion_api_key || null);
    }
    
    if (notion_database_id !== undefined) {
      updates.push('notion_database_id = ?');
      values.push(notion_database_id || null);
    }
    
    if (username !== undefined) {
      updates.push('username = ?');
      values.push(username);
    }
    
    if (target_language !== undefined) {
      updates.push('target_language = ?');
      values.push(target_language);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(req.userId);
    
    await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    // 返回更新后的用户信息
    const [rows] = await pool.query(
      'SELECT id, email, username, avatar_url, target_language, ai_credits, notion_api_key, notion_database_id, created_at FROM users WHERE id = ?',
      [req.userId]
    );
    const user = rows[0];
    
    const response = {
      ...user,
      notion_configured: !!(user.notion_api_key && user.notion_database_id),
      notion_api_key: user.notion_api_key ? user.notion_api_key.substring(0, 10) + '...' : null,
      notion_database_id: user.notion_database_id ? user.notion_database_id.substring(0, 8) + '...' : null
    };
    
    res.json(response);
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== AI CREDITS ROUTES =====

// Get AI costs information
app.get('/api/credits/costs', (req, res) => {
  const costs = Object.keys(AI_COSTS).map(key => ({
    operation: key,
    cost: AI_COSTS[key],
    description: AI_COST_DESCRIPTIONS[key]
  }));
  res.json(costs);
});

// Get credits history
app.get('/api/credits/history', authenticate, async (req, res) => {
  try {
    const history = await getCreditsHistory(req.userId);
    res.json(history);
  } catch (error) {
    console.error('Get credits history error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Add credits (充值 - 后续可扩展为支付集成)
app.post('/api/credits/recharge', authenticate, async (req, res) => {
  const { amount, payment_method = 'manual' } = req.body;
  
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }
  
  try {
    // TODO: 这里可以集成支付系统验证
    // 目前作为手动充值接口
    
    const result = await addCredits(req.userId, amount, `Recharge via ${payment_method}`);
    
    res.json({
      success: true,
      credits_added: amount,
      credits_after: result.creditsAfter,
      message: `${amount}ポイントをチャージしました`
    });
  } catch (error) {
    console.error('Recharge credits error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== QUESTIONS ROUTES =====

app.get('/api/questions', authenticate, async (req, res) => {
  const { category } = req.query;
  
  try {
    let query = 'SELECT * FROM questions WHERE user_id IS NULL OR user_id = ?';
    const params = [req.userId];
    
    if (category && category !== 'all') {
      query += ' AND category = ?';
      params.push(category);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const [questions] = await pool.query(query, params);
    
    // Parse JSON fields
    questions.forEach(q => {
      if (q.tips_ja) q.tips_ja = JSON.parse(q.tips_ja);
    });
    
    res.json(questions);
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/questions/random', authenticate, async (req, res) => {
  const { category } = req.query;
  
  try {
    let query = 'SELECT * FROM questions WHERE (user_id IS NULL OR user_id = ?)';
    const params = [req.userId];
    
    if (category && category !== 'all') {
      query += ' AND category = ?';
      params.push(category);
    }
    
    query += ' ORDER BY RAND() LIMIT 1';
    
    const [rows] = await pool.query(query, params);
    const question = rows[0];
    
    if (question && question.tips_ja) {
      question.tips_ja = JSON.parse(question.tips_ja);
    }
    
    res.json(question);
  } catch (error) {
    console.error('Get random question error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/questions/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM questions WHERE id = ?', [req.params.id]);
    const question = rows[0];
    
    if (question && question.tips_ja) {
      question.tips_ja = JSON.parse(question.tips_ja);
    }
    res.json(question);
  } catch (error) {
    console.error('Get question error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/questions', authenticate, async (req, res) => {
  const { category, question_ja, question_zh, model_answer_ja, tips_ja, summary, is_ai_generated } = req.body;
  
  try {
    const [result] = await pool.query(
      `INSERT INTO questions (user_id, category, question_ja, question_zh, model_answer_ja, tips_ja, summary, is_ai_generated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.userId,
        category,
        question_ja,
        question_zh || null,
        model_answer_ja || null,
        JSON.stringify(tips_ja || []),
        summary || null,
        is_ai_generated ? 1 : 0
      ]
    );
    
    const [questionRows] = await pool.query('SELECT * FROM questions WHERE id = ?', [result.insertId]);
    const question = questionRows[0];
    if (question.tips_ja) question.tips_ja = JSON.parse(question.tips_ja);
    
    res.json(question);
  } catch (error) {
    console.error('Create question error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/questions/:id', authenticate, async (req, res) => {
  const { category, question_ja, question_zh, model_answer_ja, tips_ja, summary } = req.body;
  
  try {
    await pool.query(
      `UPDATE questions 
       SET category = ?, question_ja = ?, question_zh = ?, model_answer_ja = ?, tips_ja = ?, summary = ?, updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [
        category,
        question_ja,
        question_zh || null,
        model_answer_ja || null,
        JSON.stringify(tips_ja || []),
        summary || null,
        req.params.id,
        req.userId
      ]
    );
    
    const [questionRows] = await pool.query('SELECT * FROM questions WHERE id = ?', [req.params.id]);
    const question = questionRows[0];
    if (question && question.tips_ja) question.tips_ja = JSON.parse(question.tips_ja);
    
    res.json(question);
  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/questions/:id', authenticate, async (req, res) => {
  try {
    // Allow deleting both user-created and AI-generated questions
    const [result] = await pool.query(
      'DELETE FROM questions WHERE id = ? AND (user_id = ? OR user_id IS NULL)',
      [req.params.id, req.userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Question not found or no permission' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate questions with AI
app.post('/api/questions/generate', authenticate, requireCredits('GENERATE_QUESTIONS'), async (req, res) => {
  const { category = 'HR', count = 3, resumeInfo = null } = req.body;
  
  try {
    // Get existing summaries to avoid duplicates
    const [existingQuestions] = await pool.query(
      'SELECT summary FROM questions WHERE user_id = ? AND summary IS NOT NULL',
      [req.userId]
    );
    const existingSummaries = existingQuestions.map(q => q.summary);
    
    // Generate questions using AI
    const newQuestions = await generateQuestions(resumeInfo, existingSummaries, category, count);
    
    // Charge credits after successful generation
    await chargeCredits(req.userId, 'GENERATE_QUESTIONS', `Generated ${count} ${category} questions`);
    
    // Insert questions into database
    const insertedQuestions = [];
    for (const q of newQuestions) {
      const [result] = await pool.query(
        `INSERT INTO questions (user_id, category, question_ja, question_zh, model_answer_ja, tips_ja, summary, is_ai_generated)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          req.userId,
          category,
          q.question_ja,
          q.question_zh || null,
          q.model_answer_ja || null,
          JSON.stringify(q.tips_ja || []),
          q.summary || null
        ]
      );
      
      const [questionRows] = await pool.query('SELECT * FROM questions WHERE id = ?', [result.insertId]);
      const question = questionRows[0];
      if (question.tips_ja) question.tips_ja = JSON.parse(question.tips_ja);
      insertedQuestions.push(question);
    }
    
    res.json(insertedQuestions);
  } catch (error) {
    console.error('Question generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Import questions from document
app.post('/api/questions/import', authenticate, requireCredits('IMPORT_DOCUMENT'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { extractTextFromFile } = await import('./fileParser.js');
    const { extractQuestionsFromDocument } = await import('./gemini.js');

    // Extract text from document
    const documentText = await extractTextFromFile(req.file.buffer, req.file.originalname);

    // Extract questions using AI
    const extractedQuestions = await extractQuestionsFromDocument(documentText);

    if (extractedQuestions.length === 0) {
      return res.status(400).json({ error: 'No questions found in the document' });
    }

    // Charge credits after successful extraction
    await chargeCredits(req.userId, 'IMPORT_DOCUMENT', `Imported ${extractedQuestions.length} questions from ${req.file.originalname}`);

    // Insert questions into database (without answers/tips initially)
    const insertedQuestions = [];
    for (const q of extractedQuestions) {
      const [result] = await pool.query(
        `INSERT INTO questions (user_id, category, question_ja, question_zh, is_ai_generated)
         VALUES (?, ?, ?, ?, 0)`,
        [
          req.userId,
          q.category || 'HR',
          q.question_ja,
          q.question_zh || null
        ]
      );
      
      const [questionRows] = await pool.query('SELECT * FROM questions WHERE id = ?', [result.insertId]);
      const question = questionRows[0];
      insertedQuestions.push(question);
    }

    res.json({
      message: `Successfully imported ${insertedQuestions.length} questions`,
      questions: insertedQuestions
    });
  } catch (error) {
    console.error('Question import error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate complete analysis for a question
app.post('/api/questions/:id/analyze', authenticate, requireCredits('ANALYZE_QUESTION'), async (req, res) => {
  const { additionalPrompt = '', generateAnswer = true } = req.body;
  
  try {
    const [rows] = await pool.query('SELECT * FROM questions WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    const question = rows[0];

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const { generateQuestionAnalysis } = await import('./gemini.js');

    // Generate analysis using AI (defaults to non-native level)
    const analysis = await generateQuestionAnalysis(
      question.question_ja,
      question.category,
      additionalPrompt,
      true // isNonNative
    );

    // Charge credits after successful generation
    await chargeCredits(req.userId, 'ANALYZE_QUESTION', `Analyzed question: ${question.question_ja.substring(0, 30)}...`);

    // Update question with analysis
    const updateFields = {
      summary: analysis.summary,
      tips_ja: JSON.stringify(analysis.tips_ja || [])
    };

    if (generateAnswer) {
      updateFields.model_answer_ja = analysis.model_answer_ja;
    }

    const setClause = Object.keys(updateFields).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updateFields);

    await pool.query(
      `UPDATE questions SET ${setClause}, updated_at = NOW() WHERE id = ?`,
      [...values, req.params.id]
    );

    const [updatedRows] = await pool.query('SELECT * FROM questions WHERE id = ?', [req.params.id]);
    const updatedQuestion = updatedRows[0];
    if (updatedQuestion.tips_ja) updatedQuestion.tips_ja = JSON.parse(updatedQuestion.tips_ja);

    res.json(updatedQuestion);
  } catch (error) {
    console.error('Question analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});


// ===== PRACTICE RECORDS ROUTES =====

app.post('/api/practice', authenticate, async (req, res) => {
  const { question_id, user_answer, answer_type, ai_feedback } = req.body;
  
  try {
    const [result] = await pool.query(
      `INSERT INTO practice_records (user_id, question_id, user_answer, answer_type, ai_feedback)
       VALUES (?, ?, ?, ?, ?)`,
      [req.userId, question_id, user_answer, answer_type, JSON.stringify(ai_feedback)]
    );
    
    const [recordRows] = await pool.query('SELECT * FROM practice_records WHERE id = ?', [result.insertId]);
    const record = recordRows[0];
    if (record.ai_feedback) record.ai_feedback = JSON.parse(record.ai_feedback);
    
    res.json(record);
  } catch (error) {
    console.error('Create practice record error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/practice/question/:questionId', authenticate, async (req, res) => {
  try {
    const [records] = await pool.query(
      'SELECT * FROM practice_records WHERE user_id = ? AND question_id = ? ORDER BY created_at DESC',
      [req.userId, req.params.questionId]
    );
    
    records.forEach(r => {
      if (r.ai_feedback) r.ai_feedback = JSON.parse(r.ai_feedback);
    });
    res.json(records);
  } catch (error) {
    console.error('Get practice records error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== FAVORITES ROUTES =====

app.get('/api/favorites', authenticate, async (req, res) => {
  try {
    const [favorites] = await pool.query(
      `SELECT 
        f.id, f.user_id, f.question_id, f.practice_record_id, f.notes,
        f.question_snapshot, f.user_answer, f.ai_feedback, f.ai_corrected_version,
        f.conversation_history, f.created_at, f.updated_at,
        q.category, q.question_ja, q.question_zh, q.model_answer_ja, 
        q.tips_ja, q.summary, q.is_ai_generated
      FROM favorites f 
      JOIN questions q ON f.question_id = q.id 
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC`,
      [req.userId]
    );
    
    favorites.forEach(f => {
      if (f.tips_ja) f.tips_ja = JSON.parse(f.tips_ja);
      // Parse question_snapshot if exists
      if (f.question_snapshot) {
        try {
          f.question_snapshot = JSON.parse(f.question_snapshot);
        } catch (e) {
          f.question_snapshot = null;
        }
      }
    });
    
    res.json(favorites);
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/favorites', authenticate, async (req, res) => {
  const { question_id, practice_record_id, notes, user_answer, ai_feedback, ai_corrected_version } = req.body;
  
  console.log('📌 Adding to favorites:', { question_id, user_id: req.userId });
  
  try {
    // Get question snapshot
    const [questionRows] = await pool.query('SELECT * FROM questions WHERE id = ?', [question_id]);
    const question = questionRows[0];
    
    if (!question) {
      console.error('❌ Question not found for id:', question_id);
      return res.status(404).json({ error: 'Question not found' });
    }

    console.log('✅ Found question:', question.question_ja?.substring(0, 50));

    const [result] = await pool.query(
      `INSERT INTO favorites (
        user_id, question_id, practice_record_id, notes,
        question_snapshot, user_answer, ai_feedback, ai_corrected_version
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.userId,
        question_id,
        practice_record_id || null,
        notes || null,
        JSON.stringify(question),
        user_answer || null,
        ai_feedback || null,
        ai_corrected_version || null
      ]
    );
    
    const [favoriteRows] = await pool.query('SELECT * FROM favorites WHERE id = ?', [result.insertId]);
    const favorite = favoriteRows[0];
    if (favorite.question_snapshot) {
      favorite.question_snapshot = JSON.parse(favorite.question_snapshot);
    }
    res.json(favorite);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Already favorited' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

app.put('/api/favorites/:favoriteId', authenticate, async (req, res) => {
  const { user_answer, ai_feedback, ai_corrected_version, conversation_id } = req.body;
  
  console.log('🔄 Updating favorite:', req.params.favoriteId, 'with conversation_id:', conversation_id);
  
  try {
    // Get conversation history if conversation_id provided
    let conversationHistory = null;
    if (conversation_id) {
      console.log('📥 Fetching conversation for id:', conversation_id);
      const [conversationRows] = await pool.query(
        'SELECT conversation_turns FROM practice_conversations WHERE id = ? AND user_id = ?',
        [conversation_id, req.userId]
      );
      const conversation = conversationRows[0];
      
      if (conversation) {
        conversationHistory = conversation.conversation_turns;
        console.log('✅ Found conversation with', JSON.parse(conversationHistory).length, 'turns');
      } else {
        console.log('❌ Conversation not found');
      }
    }

    console.log('💾 Updating favorite with conversation_history:', conversationHistory ? 'YES' : 'NO');

    await pool.query(
      `UPDATE favorites 
       SET user_answer = ?, 
           ai_feedback = ?, 
           ai_corrected_version = ?,
           conversation_history = ?,
           updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [
        user_answer,
        ai_feedback,
        ai_corrected_version,
        conversationHistory,
        req.params.favoriteId,
        req.userId
      ]
    );

    console.log('✅ Favorite updated successfully');
    res.json({ success: true });
  } catch (error) {
    console.error('Update favorite error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/favorites/:questionId', authenticate, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM favorites WHERE user_id = ? AND question_id = ?',
      [req.userId, req.params.questionId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Delete favorite error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/favorites/check/:questionId', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id FROM favorites WHERE user_id = ? AND question_id = ?',
      [req.userId, req.params.questionId]
    );
    res.json({ isFavorite: !!rows[0] });
  } catch (error) {
    console.error('Check favorite error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== RESUME ROUTES =====

app.get('/api/resumes', authenticate, async (req, res) => {
  try {
    const [resumes] = await pool.query(
      'SELECT * FROM resume_info WHERE user_id = ? ORDER BY created_at DESC',
      [req.userId]
    );
    
    resumes.forEach(r => {
      if (r.skills) r.skills = JSON.parse(r.skills);
    });
    res.json(resumes);
  } catch (error) {
    console.error('Get resumes error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/resumes', authenticate, requireCredits('PARSE_RESUME'), async (req, res) => {
  const { filename, content } = req.body;
  
  try {
    // Parse resume with AI
    const parsed = await parseResume(content);
    
    // Charge credits after successful parsing
    await chargeCredits(req.userId, 'PARSE_RESUME', `Parsed resume: ${filename}`);
    
    console.log('📋 Parsed resume data:', {
      skills: parsed.skills?.slice(0, 3),
      experienceLength: parsed.experience?.length,
      educationLength: parsed.education?.length
    });
    
    const [result] = await pool.query(
      `INSERT INTO resume_info (user_id, filename, parsed_content, skills, experience, education)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.userId,
        filename,
        parsed.summary || null,
        JSON.stringify(parsed.skills || []),
        parsed.experience || '',
        parsed.education || ''
      ]
    );
    
    const [resumeRows] = await pool.query('SELECT * FROM resume_info WHERE id = ?', [result.insertId]);
    const resume = resumeRows[0];
    if (resume.skills) resume.skills = JSON.parse(resume.skills);
    
    res.json(resume);
  } catch (error) {
    console.error('Resume upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// New route: Upload resume file (with server-side parsing)
app.post('/api/resumes/upload', authenticate, requireCredits('PARSE_RESUME'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filename = req.file.originalname;
    const buffer = req.file.buffer;

    // Extract text from file on server side
    const content = await extractTextFromFile(buffer, filename);
    
    if (!content || content.trim().length < 10) {
      return res.status(400).json({ error: 'ファイルから十分なテキストを抽出できませんでした' });
    }

    console.log('📄 Extracted text length:', content.length);

    // Parse resume with AI
    const parsed = await parseResume(content);
    
    // Charge credits after successful parsing
    await chargeCredits(req.userId, 'PARSE_RESUME', `Parsed resume file: ${filename}`);
    
    console.log('📋 Parsed resume data:', {
      skills: parsed.skills?.slice(0, 3),
      experienceLength: parsed.experience?.length,
      educationLength: parsed.education?.length
    });
    
    const [result] = await pool.query(
      `INSERT INTO resume_info (user_id, filename, parsed_content, skills, experience, education)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.userId,
        filename,
        parsed.summary || null,
        JSON.stringify(parsed.skills || []),
        parsed.experience || '',
        parsed.education || ''
      ]
    );
    
    const [resumeRows] = await pool.query('SELECT * FROM resume_info WHERE id = ?', [result.insertId]);
    const resume = resumeRows[0];
    if (resume.skills) resume.skills = JSON.parse(resume.skills);
    
    res.json(resume);
  } catch (error) {
    console.error('Resume file upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/resumes/:id', authenticate, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM resume_info WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Delete resume error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== CONVERSATION ROUTES (Follow-up Q&A) =====

// Start or get active conversation for a question
app.get('/api/conversations/:questionId', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM practice_conversations 
       WHERE user_id = ? AND question_id = ? AND status = 'active'
       ORDER BY updated_at DESC LIMIT 1`,
      [req.userId, req.params.questionId]
    );
    const conversation = rows[0];
    
    if (conversation && conversation.conversation_turns) {
      conversation.conversation_turns = JSON.parse(conversation.conversation_turns);
    }
    
    res.json(conversation || null);
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new conversation
app.post('/api/conversations', authenticate, requireCredits('EVALUATE_ANSWER'), async (req, res) => {
  const { question_id, initial_answer } = req.body;
  
  try {
    const [questionRows] = await pool.query('SELECT * FROM questions WHERE id = ?', [question_id]);
    const question = questionRows[0];
    
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Get initial AI feedback
    const feedback = await evaluateAnswer(initial_answer, question.question_ja);
    
    // Charge credits after successful evaluation
    await chargeCredits(req.userId, 'EVALUATE_ANSWER', `Evaluated answer for question: ${question.question_ja.substring(0, 30)}...`);
    
    const conversationTurns = [{
      type: 'initial',
      userAnswer: initial_answer,
      aiFeedback: feedback,
      timestamp: toMySQLDatetime(new Date())
    }];
    
    const [result] = await pool.query(
      `INSERT INTO practice_conversations (user_id, question_id, conversation_turns, status)
       VALUES (?, ?, ?, 'active')`,
      [req.userId, question_id, JSON.stringify(conversationTurns)]
    );
    
    const [conversationRows] = await pool.query(
      'SELECT * FROM practice_conversations WHERE id = ?',
      [result.insertId]
    );
    const conversation = conversationRows[0];
    conversation.conversation_turns = JSON.parse(conversation.conversation_turns);
    
    res.json(conversation);
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate follow-up question
app.post('/api/conversations/:conversationId/follow-up', authenticate, requireCredits('FOLLOW_UP_QUESTION'), async (req, res) => {
  try {
    const [conversationRows] = await pool.query(
      `SELECT c.*, q.question_ja 
       FROM practice_conversations c
       JOIN questions q ON c.question_id = q.id
       WHERE c.id = ? AND c.user_id = ?`,
      [req.params.conversationId, req.userId]
    );
    const conversation = conversationRows[0];
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    const turns = JSON.parse(conversation.conversation_turns);
    const conversationHistory = turns
      .filter(t => t.type === 'followup')
      .map(t => ({
        followUpQuestion: t.followUpQuestion,
        userAnswer: t.userAnswer
      }));
    
    const lastUserAnswer = turns[turns.length - 1]?.userAnswer || '';
    
    const followUp = await generateFollowUpQuestion(
      conversation.question_ja,
      lastUserAnswer,
      conversationHistory
    );
    
    // Charge credits after successful generation
    await chargeCredits(req.userId, 'FOLLOW_UP_QUESTION', 'Generated follow-up question');
    
    // Add follow-up to conversation
    turns.push({
      type: 'followup',
      followUpQuestion: followUp.followUpQuestion,
      reasoning: followUp.reasoning,
      expectedDepth: followUp.expectedDepth,
      userAnswer: null,
      aiFeedback: null,
      timestamp: toMySQLDatetime(new Date())
    });
    
    await pool.query(
      `UPDATE practice_conversations 
       SET conversation_turns = ?, updated_at = NOW()
       WHERE id = ?`,
      [JSON.stringify(turns), req.params.conversationId]
    );
    
    res.json(followUp);
  } catch (error) {
    console.error('Generate follow-up error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Answer follow-up question
app.post('/api/conversations/:conversationId/answer', authenticate, requireCredits('FOLLOW_UP_EVALUATION'), async (req, res) => {
  const { answer } = req.body;
  
  try {
    const [conversationRows] = await pool.query(
      `SELECT c.*, q.question_ja 
       FROM practice_conversations c
       JOIN questions q ON c.question_id = q.id
       WHERE c.id = ? AND c.user_id = ?`,
      [req.params.conversationId, req.userId]
    );
    const conversation = conversationRows[0];
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    const turns = JSON.parse(conversation.conversation_turns);
    const lastTurn = turns[turns.length - 1];
    
    if (!lastTurn || lastTurn.type !== 'followup' || lastTurn.userAnswer !== null) {
      return res.status(400).json({ error: 'No pending follow-up question' });
    }
    
    // Evaluate the answer
    const evaluation = await evaluateFollowUpAnswer(
      conversation.question_ja,
      lastTurn.followUpQuestion,
      answer
    );
    
    // Charge credits after successful evaluation
    await chargeCredits(req.userId, 'FOLLOW_UP_EVALUATION', 'Evaluated follow-up answer');
    
    // Update last turn with answer and feedback
    lastTurn.userAnswer = answer;
    lastTurn.aiFeedback = evaluation;
    
    await pool.query(
      `UPDATE practice_conversations 
       SET conversation_turns = ?, updated_at = NOW()
       WHERE id = ?`,
      [JSON.stringify(turns), req.params.conversationId]
    );
    
    res.json(evaluation);
  } catch (error) {
    console.error('Answer follow-up error:', error);
    res.status(500).json({ error: error.message });
  }
});

// End conversation
app.post('/api/conversations/:conversationId/complete', authenticate, async (req, res) => {
  try {
    await pool.query(
      `UPDATE practice_conversations 
       SET status = 'completed', updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [req.params.conversationId, req.userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Complete conversation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update favorites to include conversation
app.post('/api/favorites', authenticate, async (req, res) => {
  const { question_id, practice_record_id, notes, user_answer, ai_feedback, ai_corrected_version, conversation_id } = req.body;
  
  console.log('📌 Adding to favorites:', { question_id, user_id: req.userId, has_conversation: !!conversation_id });
  
  try {
    // Get question snapshot
    const [questionRows] = await pool.query('SELECT * FROM questions WHERE id = ?', [question_id]);
    const question = questionRows[0];
    
    if (!question) {
      console.error('❌ Question not found for id:', question_id);
      return res.status(404).json({ error: 'Question not found' });
    }

    console.log('✅ Found question:', question.question_ja?.substring(0, 50));

    // Get conversation history if conversation_id provided
    let conversationHistory = null;
    if (conversation_id) {
      console.log('📥 Fetching conversation for id:', conversation_id);
      const [conversationRows] = await pool.query(
        'SELECT * FROM practice_conversations WHERE id = ? AND user_id = ?',
        [conversation_id, req.userId]
      );
      const conversation = conversationRows[0];
      
      if (conversation) {
        conversationHistory = conversation.conversation_turns;
        console.log('✅ Found conversation with', JSON.parse(conversationHistory).length, 'turns');
      } else {
        console.log('❌ Conversation not found');
      }
    }

    console.log('💾 Saving to favorites with conversation_history:', conversationHistory ? 'YES' : 'NO');

    const [result] = await pool.query(
      `INSERT INTO favorites (
        user_id, question_id, practice_record_id, notes,
        question_snapshot, user_answer, ai_feedback, ai_corrected_version, conversation_history
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.userId,
        question_id,
        practice_record_id || null,
        notes || null,
        JSON.stringify(question),
        user_answer || null,
        ai_feedback || null,
        ai_corrected_version || null,
        conversationHistory
      ]
    );
    
    const [favoriteRows] = await pool.query('SELECT * FROM favorites WHERE id = ?', [result.insertId]);
    const favorite = favoriteRows[0];
    
    if (favorite.question_snapshot) {
      favorite.question_snapshot = JSON.parse(favorite.question_snapshot);
    }
    if (favorite.conversation_history) {
      favorite.conversation_history = JSON.parse(favorite.conversation_history);
    }
    res.json(favorite);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Already favorited' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// ===== VOCABULARY ROUTES =====

// Analyze word/phrase with AI
app.post('/api/vocabulary/analyze', authenticate, requireCredits('ANALYZE_VOCABULARY'), async (req, res) => {
  const { word } = req.body;
  
  if (!word || !word.trim()) {
    return res.status(400).json({ error: 'Word is required' });
  }

  try {
    const analysis = await analyzeVocabulary(word.trim());
    
    // Charge credits after successful analysis
    await chargeCredits(req.userId, 'ANALYZE_VOCABULARY', `Analyzed vocabulary: ${word.trim()}`);
    
    res.json(analysis);
  } catch (error) {
    console.error('Vocabulary analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save vocabulary note
app.post('/api/vocabulary', authenticate, async (req, res) => {
  const { word, translation, explanation, example_sentences, tags } = req.body;
  
  try {
    // Save to local database
    const [result] = await pool.query(
      `INSERT INTO vocabulary_notes (user_id, word, translation, explanation, example_sentences, tags)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.userId,
        word,
        translation || null,
        explanation || null,
        example_sentences ? JSON.stringify(example_sentences) : null,
        tags ? JSON.stringify(tags) : null
      ]
    );
    
    const [noteRows] = await pool.query('SELECT * FROM vocabulary_notes WHERE id = ?', [result.insertId]);
    const note = noteRows[0];
    if (note.example_sentences) note.example_sentences = JSON.parse(note.example_sentences);
    if (note.tags) note.tags = JSON.parse(note.tags);
    
    // Sync to Notion if enabled (using user's config)
    if (isNotionEnabled(req.userNotionConfig)) {
      try {
        const notionResponse = await syncVocabularyToNotion({
          word,
          translation,
          explanation,
          example_sentences,
          tags
        }, req.userNotionConfig);
        
        if (notionResponse) {
          // Update local database with Notion page ID
          await pool.query(
            'UPDATE vocabulary_notes SET notion_page_id = ? WHERE id = ?',
            [notionResponse.id, note.id]
          );
          note.notion_page_id = notionResponse.id;
          note.synced_to_notion = true;
        }
      } catch (notionError) {
        console.error('Notion sync failed:', notionError);
        note.synced_to_notion = false;
        // Continue even if Notion sync fails
      }
    }
    
    res.json(note);
  } catch (error) {
    console.error('Save vocabulary error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all vocabulary notes
app.get('/api/vocabulary', authenticate, async (req, res) => {
  try {
    const [notes] = await pool.query(
      'SELECT * FROM vocabulary_notes WHERE user_id = ? ORDER BY created_at DESC',
      [req.userId]
    );
    
    notes.forEach(note => {
      if (note.example_sentences) note.example_sentences = JSON.parse(note.example_sentences);
      if (note.tags) note.tags = JSON.parse(note.tags);
    });
    
    res.json(notes);
  } catch (error) {
    console.error('Get vocabulary error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete vocabulary note
app.delete('/api/vocabulary/:id', authenticate, async (req, res) => {
  try {
    // Get the note to check for Notion page ID
    const [noteRows] = await pool.query(
      'SELECT * FROM vocabulary_notes WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    const note = noteRows[0];
    
    if (!note) {
      return res.status(404).json({ error: 'Vocabulary note not found' });
    }
    
    // Delete from Notion if synced (using user's config)
    if (note.notion_page_id && isNotionEnabled(req.userNotionConfig)) {
      try {
        await deleteVocabularyFromNotion(note.notion_page_id, req.userNotionConfig);
      } catch (notionError) {
        console.error('Failed to delete from Notion:', notionError);
        // Continue with local deletion even if Notion fails
      }
    }
    
    // Delete from local database
    await pool.query(
      'DELETE FROM vocabulary_notes WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete vocabulary error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check Notion integration status
app.get('/api/notion/status', authenticate, (req, res) => {
  const enabled = isNotionEnabled(req.userNotionConfig);
  const hasApiKey = !!req.userNotionConfig?.notion_api_key;
  const hasDatabaseId = !!req.userNotionConfig?.notion_database_id;
  
  res.json({ 
    enabled,
    hasApiKey,
    hasDatabaseId,
    apiKeyPrefix: hasApiKey ? req.userNotionConfig.notion_api_key.substring(0, 10) + '...' : null,
    databaseIdPrefix: hasDatabaseId ? req.userNotionConfig.notion_database_id.substring(0, 10) + '...' : null,
    message: enabled
      ? 'Notion integration is configured and active' 
      : `Notion integration is not configured. Missing: ${!hasApiKey ? 'NOTION_API_KEY ' : ''}${!hasDatabaseId ? 'NOTION_DATABASE_ID' : ''}`
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`✅ API Server running on http://localhost:${PORT}`);
  console.log(`📍 Database: MySQL (pool connection)`);
  console.log(`💎 AI Credits System: ✅ Enabled`);
  console.log(`📝 Notion Integration: Per-user configuration`);
  
  // Initialize database tables
  try {
    await initDatabase();
    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
  }
});
