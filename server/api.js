import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import db, { initDatabase } from './db.js';
import { parseResume, generateQuestions, evaluateAnswer, generateFollowUpQuestion, evaluateFollowUpAnswer, analyzeVocabulary } from './gemini.js';
import { extractTextFromFile } from './fileParser.js';
import { isNotionEnabled, syncVocabularyToNotion, deleteVocabularyFromNotion } from './notion.js';

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

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize database
initDatabase();

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
function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const session = db.prepare("SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')").get(token);
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.userId = session.user_id;
  next();
}

// ===== AUTH ROUTES =====

app.post('/api/auth/register', (req, res) => {
  const { email, password, username } = req.body;

  try {
    const passwordHash = hashPassword(password);
    const result = db.prepare(`
      INSERT INTO users (email, password_hash, username)
      VALUES (?, ?, ?)
    `).run(email, passwordHash, username || email.split('@')[0]);

    const user = db.prepare('SELECT id, email, username, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    
    // Create session
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
    db.prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, token, expiresAt);

    res.json({ user, token });
  } catch (error) {
    res.status(400).json({ error: error.message.includes('UNIQUE') ? 'Email already exists' : error.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, token, expiresAt);

  const { password_hash, ...userWithoutPassword } = user;
  res.json({ user: userWithoutPassword, token });
});

app.post('/api/auth/logout', authenticate, (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.json({ success: true });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT id, email, username, avatar_url, target_language, created_at FROM users WHERE id = ?').get(req.userId);
  res.json(user);
});

// ===== QUESTIONS ROUTES =====

app.get('/api/questions', authenticate, (req, res) => {
  const { category } = req.query;
  
  let query = 'SELECT * FROM questions WHERE user_id IS NULL OR user_id = ?';
  const params = [req.userId];
  
  if (category && category !== 'all') {
    query += ' AND category = ?';
    params.push(category);
  }
  
  query += ' ORDER BY created_at DESC';
  
  const questions = db.prepare(query).all(...params);
  
  // Parse JSON fields
  questions.forEach(q => {
    if (q.tips_ja) q.tips_ja = JSON.parse(q.tips_ja);
  });
  
  res.json(questions);
});

app.get('/api/questions/random', authenticate, (req, res) => {
  const { category } = req.query;
  
  let query = 'SELECT * FROM questions WHERE (user_id IS NULL OR user_id = ?)';
  const params = [req.userId];
  
  if (category && category !== 'all') {
    query += ' AND category = ?';
    params.push(category);
  }
  
  query += ' ORDER BY RANDOM() LIMIT 1';
  
  const question = db.prepare(query).get(...params);
  
  if (question && question.tips_ja) {
    question.tips_ja = JSON.parse(question.tips_ja);
  }
  
  res.json(question);
});

app.get('/api/questions/:id', authenticate, (req, res) => {
  const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
  if (question && question.tips_ja) {
    question.tips_ja = JSON.parse(question.tips_ja);
  }
  res.json(question);
});

app.post('/api/questions', authenticate, (req, res) => {
  const { category, question_ja, question_zh, model_answer_ja, tips_ja, summary, is_ai_generated } = req.body;
  
  const result = db.prepare(`
    INSERT INTO questions (user_id, category, question_ja, question_zh, model_answer_ja, tips_ja, summary, is_ai_generated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.userId,
    category,
    question_ja,
    question_zh || null,
    model_answer_ja || null,
    JSON.stringify(tips_ja || []),
    summary || null,
    is_ai_generated ? 1 : 0
  );
  
  const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(result.lastInsertRowid);
  if (question.tips_ja) question.tips_ja = JSON.parse(question.tips_ja);
  
  res.json(question);
});

app.put('/api/questions/:id', authenticate, (req, res) => {
  const { category, question_ja, question_zh, model_answer_ja, tips_ja, summary } = req.body;
  
  db.prepare(`
    UPDATE questions 
    SET category = ?, question_ja = ?, question_zh = ?, model_answer_ja = ?, tips_ja = ?, summary = ?, updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).run(
    category,
    question_ja,
    question_zh || null,
    model_answer_ja || null,
    JSON.stringify(tips_ja || []),
    summary || null,
    req.params.id,
    req.userId
  );
  
  const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
  if (question && question.tips_ja) question.tips_ja = JSON.parse(question.tips_ja);
  
  res.json(question);
});

app.delete('/api/questions/:id', authenticate, (req, res) => {
  // Allow deleting both user-created and AI-generated questions
  const result = db.prepare('DELETE FROM questions WHERE id = ? AND (user_id = ? OR user_id IS NULL)').run(req.params.id, req.userId);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Question not found or no permission' });
  }
  res.json({ success: true });
});

// Generate questions with AI
app.post('/api/questions/generate', authenticate, async (req, res) => {
  const { category = 'HR', count = 3, resumeInfo = null } = req.body;
  
  try {
    // Get existing summaries to avoid duplicates
    const existingQuestions = db.prepare('SELECT summary FROM questions WHERE user_id = ? AND summary IS NOT NULL').all(req.userId);
    const existingSummaries = existingQuestions.map(q => q.summary);
    
    // Generate questions using AI
    const newQuestions = await generateQuestions(resumeInfo, existingSummaries, category, count);
    
    // Insert questions into database
    const insertStmt = db.prepare(`
      INSERT INTO questions (user_id, category, question_ja, question_zh, model_answer_ja, tips_ja, summary, is_ai_generated)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);
    
    const insertedQuestions = [];
    for (const q of newQuestions) {
      const result = insertStmt.run(
        req.userId,
        category,
        q.question_ja,
        q.question_zh || null,
        q.model_answer_ja || null,
        JSON.stringify(q.tips_ja || []),
        q.summary || null
      );
      
      const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(result.lastInsertRowid);
      if (question.tips_ja) question.tips_ja = JSON.parse(question.tips_ja);
      insertedQuestions.push(question);
    }
    
    res.json(insertedQuestions);
  } catch (error) {
    console.error('Question generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== PRACTICE RECORDS ROUTES =====

app.post('/api/practice', authenticate, (req, res) => {
  const { question_id, user_answer, answer_type, ai_feedback } = req.body;
  
  const result = db.prepare(`
    INSERT INTO practice_records (user_id, question_id, user_answer, answer_type, ai_feedback)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.userId, question_id, user_answer, answer_type, JSON.stringify(ai_feedback));
  
  const record = db.prepare('SELECT * FROM practice_records WHERE id = ?').get(result.lastInsertRowid);
  if (record.ai_feedback) record.ai_feedback = JSON.parse(record.ai_feedback);
  
  res.json(record);
});

app.get('/api/practice/question/:questionId', authenticate, (req, res) => {
  const records = db.prepare('SELECT * FROM practice_records WHERE user_id = ? AND question_id = ? ORDER BY created_at DESC').all(req.userId, req.params.questionId);
  records.forEach(r => {
    if (r.ai_feedback) r.ai_feedback = JSON.parse(r.ai_feedback);
  });
  res.json(records);
});

// ===== FAVORITES ROUTES =====

app.get('/api/favorites', authenticate, (req, res) => {
  const favorites = db.prepare(`
    SELECT 
      f.id, f.user_id, f.question_id, f.practice_record_id, f.notes,
      f.question_snapshot, f.user_answer, f.ai_feedback, f.ai_corrected_version,
      f.conversation_history, f.created_at, f.updated_at,
      q.category, q.question_ja, q.question_zh, q.model_answer_ja, 
      q.tips_ja, q.summary, q.is_ai_generated
    FROM favorites f 
    JOIN questions q ON f.question_id = q.id 
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `).all(req.userId);
  
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
});

app.post('/api/favorites', authenticate, (req, res) => {
  const { question_id, practice_record_id, notes, user_answer, ai_feedback, ai_corrected_version } = req.body;
  
  console.log('📌 Adding to favorites:', { question_id, user_id: req.userId });
  
  try {
    // Get question snapshot
    const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(question_id);
    if (!question) {
      console.error('❌ Question not found for id:', question_id);
      return res.status(404).json({ error: 'Question not found' });
    }

    console.log('✅ Found question:', question.question_ja?.substring(0, 50));

    const result = db.prepare(`
      INSERT INTO favorites (
        user_id, question_id, practice_record_id, notes,
        question_snapshot, user_answer, ai_feedback, ai_corrected_version
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.userId,
      question_id,
      practice_record_id || null,
      notes || null,
      JSON.stringify(question),
      user_answer || null,
      ai_feedback || null,
      ai_corrected_version || null
    );
    
    const favorite = db.prepare('SELECT * FROM favorites WHERE id = ?').get(result.lastInsertRowid);
    if (favorite.question_snapshot) {
      favorite.question_snapshot = JSON.parse(favorite.question_snapshot);
    }
    res.json(favorite);
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
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
      const conversation = db.prepare('SELECT conversation_turns FROM practice_conversations WHERE id = ? AND user_id = ?')
        .get(conversation_id, req.userId);
      if (conversation) {
        conversationHistory = conversation.conversation_turns;
        console.log('✅ Found conversation with', JSON.parse(conversationHistory).length, 'turns');
      } else {
        console.log('❌ Conversation not found');
      }
    }

    console.log('💾 Updating favorite with conversation_history:', conversationHistory ? 'YES' : 'NO');

    db.prepare(`
      UPDATE favorites 
      SET user_answer = ?, 
          ai_feedback = ?, 
          ai_corrected_version = ?,
          conversation_history = ?,
          updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).run(
      user_answer,
      ai_feedback,
      ai_corrected_version,
      conversationHistory,
      req.params.favoriteId,
      req.userId
    );

    console.log('✅ Favorite updated successfully');
    res.json({ success: true });
  } catch (error) {
    console.error('Update favorite error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/favorites/:questionId', authenticate, (req, res) => {
  db.prepare('DELETE FROM favorites WHERE user_id = ? AND question_id = ?').run(req.userId, req.params.questionId);
  res.json({ success: true });
});

app.get('/api/favorites/check/:questionId', authenticate, (req, res) => {
  const favorite = db.prepare('SELECT id FROM favorites WHERE user_id = ? AND question_id = ?').get(req.userId, req.params.questionId);
  res.json({ isFavorite: !!favorite });
});

// ===== RESUME ROUTES =====

app.get('/api/resumes', authenticate, (req, res) => {
  const resumes = db.prepare('SELECT * FROM resume_info WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
  resumes.forEach(r => {
    if (r.skills) r.skills = JSON.parse(r.skills);
  });
  res.json(resumes);
});

app.post('/api/resumes', authenticate, async (req, res) => {
  const { filename, content } = req.body;
  
  try {
    // Parse resume with AI
    const parsed = await parseResume(content);
    
    console.log('📋 Parsed resume data:', {
      skills: parsed.skills?.slice(0, 3),
      experienceLength: parsed.experience?.length,
      educationLength: parsed.education?.length
    });
    
    const result = db.prepare(`
      INSERT INTO resume_info (user_id, filename, parsed_content, skills, experience, education)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.userId,
      filename,
      parsed.summary || null,
      JSON.stringify(parsed.skills || []),
      parsed.experience || '',
      parsed.education || ''
    );
    
    const resume = db.prepare('SELECT * FROM resume_info WHERE id = ?').get(result.lastInsertRowid);
    if (resume.skills) resume.skills = JSON.parse(resume.skills);
    
    res.json(resume);
  } catch (error) {
    console.error('Resume upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// New route: Upload resume file (with server-side parsing)
app.post('/api/resumes/upload', authenticate, upload.single('file'), async (req, res) => {
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
    
    console.log('📋 Parsed resume data:', {
      skills: parsed.skills?.slice(0, 3),
      experienceLength: parsed.experience?.length,
      educationLength: parsed.education?.length
    });
    
    const result = db.prepare(`
      INSERT INTO resume_info (user_id, filename, parsed_content, skills, experience, education)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.userId,
      filename,
      parsed.summary || null,
      JSON.stringify(parsed.skills || []),
      parsed.experience || '',
      parsed.education || ''
    );
    
    const resume = db.prepare('SELECT * FROM resume_info WHERE id = ?').get(result.lastInsertRowid);
    if (resume.skills) resume.skills = JSON.parse(resume.skills);
    
    res.json(resume);
  } catch (error) {
    console.error('Resume file upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/resumes/:id', authenticate, (req, res) => {
  db.prepare('DELETE FROM resume_info WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ success: true });
});

// ===== CONVERSATION ROUTES (Follow-up Q&A) =====

// Start or get active conversation for a question
app.get('/api/conversations/:questionId', authenticate, (req, res) => {
  try {
    const conversation = db.prepare(`
      SELECT * FROM practice_conversations 
      WHERE user_id = ? AND question_id = ? AND status = 'active'
      ORDER BY updated_at DESC LIMIT 1
    `).get(req.userId, req.params.questionId);
    
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
app.post('/api/conversations', authenticate, async (req, res) => {
  const { question_id, initial_answer } = req.body;
  
  try {
    const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(question_id);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Get initial AI feedback
    const feedback = await evaluateAnswer(initial_answer, question.question_ja);
    
    const conversationTurns = [{
      type: 'initial',
      userAnswer: initial_answer,
      aiFeedback: feedback,
      timestamp: new Date().toISOString()
    }];
    
    const result = db.prepare(`
      INSERT INTO practice_conversations (user_id, question_id, conversation_turns, status)
      VALUES (?, ?, ?, 'active')
    `).run(req.userId, question_id, JSON.stringify(conversationTurns));
    
    const conversation = db.prepare('SELECT * FROM practice_conversations WHERE id = ?').get(result.lastInsertRowid);
    conversation.conversation_turns = JSON.parse(conversation.conversation_turns);
    
    res.json(conversation);
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate follow-up question
app.post('/api/conversations/:conversationId/follow-up', authenticate, async (req, res) => {
  try {
    const conversation = db.prepare(`
      SELECT c.*, q.question_ja 
      FROM practice_conversations c
      JOIN questions q ON c.question_id = q.id
      WHERE c.id = ? AND c.user_id = ?
    `).get(req.params.conversationId, req.userId);
    
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
    
    // Add follow-up to conversation
    turns.push({
      type: 'followup',
      followUpQuestion: followUp.followUpQuestion,
      reasoning: followUp.reasoning,
      expectedDepth: followUp.expectedDepth,
      userAnswer: null,
      aiFeedback: null,
      timestamp: new Date().toISOString()
    });
    
    db.prepare(`
      UPDATE practice_conversations 
      SET conversation_turns = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(turns), req.params.conversationId);
    
    res.json(followUp);
  } catch (error) {
    console.error('Generate follow-up error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Answer follow-up question
app.post('/api/conversations/:conversationId/answer', authenticate, async (req, res) => {
  const { answer } = req.body;
  
  try {
    const conversation = db.prepare(`
      SELECT c.*, q.question_ja 
      FROM practice_conversations c
      JOIN questions q ON c.question_id = q.id
      WHERE c.id = ? AND c.user_id = ?
    `).get(req.params.conversationId, req.userId);
    
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
    
    // Update last turn with answer and feedback
    lastTurn.userAnswer = answer;
    lastTurn.aiFeedback = evaluation;
    
    db.prepare(`
      UPDATE practice_conversations 
      SET conversation_turns = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(turns), req.params.conversationId);
    
    res.json(evaluation);
  } catch (error) {
    console.error('Answer follow-up error:', error);
    res.status(500).json({ error: error.message });
  }
});

// End conversation
app.post('/api/conversations/:conversationId/complete', authenticate, (req, res) => {
  try {
    db.prepare(`
      UPDATE practice_conversations 
      SET status = 'completed', updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).run(req.params.conversationId, req.userId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Complete conversation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update favorites to include conversation
app.post('/api/favorites', authenticate, (req, res) => {
  const { question_id, practice_record_id, notes, user_answer, ai_feedback, ai_corrected_version, conversation_id } = req.body;
  
  console.log('📌 Adding to favorites:', { question_id, user_id: req.userId, has_conversation: !!conversation_id });
  
  try {
    // Get question snapshot
    const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(question_id);
    if (!question) {
      console.error('❌ Question not found for id:', question_id);
      return res.status(404).json({ error: 'Question not found' });
    }

    console.log('✅ Found question:', question.question_ja?.substring(0, 50));

    // Get conversation history if conversation_id provided
    let conversationHistory = null;
    if (conversation_id) {
      console.log('📥 Fetching conversation for id:', conversation_id);
      const conversation = db.prepare('SELECT * FROM practice_conversations WHERE id = ? AND user_id = ?')
        .get(conversation_id, req.userId);
      if (conversation) {
        conversationHistory = conversation.conversation_turns;
        console.log('✅ Found conversation with', JSON.parse(conversationHistory).length, 'turns');
      } else {
        console.log('❌ Conversation not found');
      }
    }

    console.log('💾 Saving to favorites with conversation_history:', conversationHistory ? 'YES' : 'NO');

    const result = db.prepare(`
      INSERT INTO favorites (
        user_id, question_id, practice_record_id, notes,
        question_snapshot, user_answer, ai_feedback, ai_corrected_version, conversation_history
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.userId,
      question_id,
      practice_record_id || null,
      notes || null,
      JSON.stringify(question),
      user_answer || null,
      ai_feedback || null,
      ai_corrected_version || null,
      conversationHistory
    );
    
    const favorite = db.prepare('SELECT * FROM favorites WHERE id = ?').get(result.lastInsertRowid);
    if (favorite.question_snapshot) {
      favorite.question_snapshot = JSON.parse(favorite.question_snapshot);
    }
    if (favorite.conversation_history) {
      favorite.conversation_history = JSON.parse(favorite.conversation_history);
    }
    res.json(favorite);
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      res.status(400).json({ error: 'Already favorited' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// ===== VOCABULARY ROUTES =====

// Analyze word/phrase with AI
app.post('/api/vocabulary/analyze', authenticate, async (req, res) => {
  const { word } = req.body;
  
  if (!word || !word.trim()) {
    return res.status(400).json({ error: 'Word is required' });
  }

  try {
    const analysis = await analyzeVocabulary(word.trim());
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
    const result = db.prepare(`
      INSERT INTO vocabulary_notes (user_id, word, translation, explanation, example_sentences, tags)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.userId,
      word,
      translation || null,
      explanation || null,
      example_sentences ? JSON.stringify(example_sentences) : null,
      tags ? JSON.stringify(tags) : null
    );
    
    const note = db.prepare('SELECT * FROM vocabulary_notes WHERE id = ?').get(result.lastInsertRowid);
    if (note.example_sentences) note.example_sentences = JSON.parse(note.example_sentences);
    if (note.tags) note.tags = JSON.parse(note.tags);
    
    // Sync to Notion if enabled
    if (isNotionEnabled()) {
      try {
        const notionResponse = await syncVocabularyToNotion({
          word,
          translation,
          explanation,
          example_sentences,
          tags
        });
        
        if (notionResponse) {
          // Update local database with Notion page ID
          db.prepare('UPDATE vocabulary_notes SET notion_page_id = ? WHERE id = ?')
            .run(notionResponse.id, note.id);
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
app.get('/api/vocabulary', authenticate, (req, res) => {
  const notes = db.prepare('SELECT * FROM vocabulary_notes WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.userId);
  
  notes.forEach(note => {
    if (note.example_sentences) note.example_sentences = JSON.parse(note.example_sentences);
    if (note.tags) note.tags = JSON.parse(note.tags);
  });
  
  res.json(notes);
});

// Delete vocabulary note
app.delete('/api/vocabulary/:id', authenticate, async (req, res) => {
  try {
    // Get the note to check for Notion page ID
    const note = db.prepare('SELECT * FROM vocabulary_notes WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.userId);
    
    if (!note) {
      return res.status(404).json({ error: 'Vocabulary note not found' });
    }
    
    // Delete from Notion if synced
    if (note.notion_page_id && isNotionEnabled()) {
      try {
        await deleteVocabularyFromNotion(note.notion_page_id);
      } catch (notionError) {
        console.error('Failed to delete from Notion:', notionError);
        // Continue with local deletion even if Notion fails
      }
    }
    
    // Delete from local database
    db.prepare('DELETE FROM vocabulary_notes WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.userId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete vocabulary error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check Notion integration status
app.get('/api/notion/status', authenticate, (req, res) => {
  const enabled = isNotionEnabled();
  const hasApiKey = !!process.env.NOTION_API_KEY;
  const hasDatabaseId = !!process.env.NOTION_DATABASE_ID;
  
  res.json({ 
    enabled,
    hasApiKey,
    hasDatabaseId,
    apiKeyPrefix: process.env.NOTION_API_KEY?.substring(0, 10) + '...',
    databaseIdPrefix: process.env.NOTION_DATABASE_ID?.substring(0, 10) + '...',
    message: enabled
      ? 'Notion integration is configured and active' 
      : `Notion integration is not configured. Missing: ${!hasApiKey ? 'NOTION_API_KEY ' : ''}${!hasDatabaseId ? 'NOTION_DATABASE_ID' : ''}`
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ API Server running on http://localhost:${PORT}`);
  console.log(`📍 Database: ${db.name}`);
  console.log(`📝 Notion Integration: ${isNotionEnabled() ? '✅ Enabled' : '❌ Disabled'}`);
  if (isNotionEnabled()) {
    console.log(`   API Key: ${process.env.NOTION_API_KEY?.substring(0, 15)}...`);
    console.log(`   Database: ${process.env.NOTION_DATABASE_ID?.substring(0, 15)}...`);
  }
});
