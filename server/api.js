import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import pool, { initDatabase } from './db.js';
import { parseResume, generateQuestions, evaluateAnswer, generateFollowUpQuestion, evaluateFollowUpAnswer, analyzeVocabulary } from './gemini.js';
import { extractTextFromFile } from './fileParser.js';
import { isNotionEnabled, syncVocabularyToNotion, deleteVocabularyFromNotion } from './notion.js';
import { requireCredits, chargeCredits, AI_COSTS, AI_COST_DESCRIPTIONS, checkCredits, getCreditsHistory, addCredits } from './credits.js';
import { generateCards, validateCardCodeFormat } from './cardGenerator.js';
import { generateVerificationCode, sendVerificationEmail, sendWelcomeEmail } from './email.js';

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
      `SELECT s.user_id, u.ai_credits, u.notion_api_key, u.notion_database_id, u.role, u.target_language 
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
    req.userRole = session.role;
    req.user = {
      target_language: session.target_language
    };
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

// Admin middleware
function requireAdmin(req, res, next) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ===== AUTH ROUTES =====

// Send verification code
app.post('/api/auth/send-code', async (req, res) => {
  const { email } = req.body;

  try {
    // 检查邮箱是否已注册
    const [existingUsers] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'このメールアドレスは既に登録されています' });
    }

    // 生成验证码
    const code = generateVerificationCode();

    // 删除该邮箱的旧验证码
    await pool.query('DELETE FROM email_verification_codes WHERE email = ?', [email]);

    // 保存新验证码（使用数据库时间计算过期时间，避免时区问题）
    await pool.query(
      'INSERT INTO email_verification_codes (email, code, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))',
      [email, code]
    );

    // 发送邮件
    await sendVerificationEmail(email, code);

    res.json({ success: true, message: '認証コードを送信しました' });
  } catch (error) {
    console.error('Send verification code error:', error);
    res.status(500).json({ error: 'コード送信に失敗しました: ' + error.message });
  }
});

// Verify code and register
app.post('/api/auth/register', async (req, res) => {
  const { email, password, username, code } = req.body;

  try {
    // 验证验证码
    const [codeRows] = await pool.query(
      'SELECT *, NOW() as server_time FROM email_verification_codes WHERE email = ? AND code = ? AND used = 0 ORDER BY created_at DESC LIMIT 1',
      [email, code]
    );

    if (codeRows.length === 0) {
      return res.status(400).json({ error: '認証コードが無効または期限切れです' });
    }

    const codeRecord = codeRows[0];
    
    // 检查是否过期（添加调试日志）
    console.log('🔍 验证码检查:', {
      email,
      code,
      expires_at: codeRecord.expires_at,
      server_time: codeRecord.server_time,
      expired: new Date(codeRecord.expires_at) <= new Date(codeRecord.server_time)
    });

    if (new Date(codeRecord.expires_at) <= new Date(codeRecord.server_time)) {
      return res.status(400).json({ error: '認証コードが期限切れです' });
    }

    // 再次检查邮箱是否已注册（防止并发注册）
    const [existingUsers] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'このメールアドレスは既に登録されています' });
    }

    // 标记验证码为已使用
    await pool.query(
      'UPDATE email_verification_codes SET used = 1 WHERE id = ?',
      [codeRecord.id]
    );

    // 创建用户
    const passwordHash = hashPassword(password);
    const [result] = await pool.query(
      `INSERT INTO users (email, password_hash, username) VALUES (?, ?, ?)`,
      [email, passwordHash, username || email.split('@')[0]]
    );

    const [userRows] = await pool.query(
      'SELECT id, email, username, role, ai_credits, created_at FROM users WHERE id = ?',
      [result.insertId]
    );
    const user = userRows[0];
    
    // 创建会话
    const token = generateToken();
    const expiresAt = toMySQLDatetime(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)); // 30 days
    await pool.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, token, expiresAt]
    );

    // 发送欢迎邮件（异步，不影响注册流程）
    sendWelcomeEmail(email, username).catch(err => 
      console.error('Failed to send welcome email:', err)
    );

    res.json({ user, token });
  } catch (error) {
    console.error('Register error:', error);
    res.status(400).json({ error: error.code === 'ER_DUP_ENTRY' ? 'このメールアドレスは既に登録されています' : error.message });
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
      'SELECT id, email, username, avatar_url, target_language, ai_credits, notion_api_key, notion_database_id, role, created_at FROM users WHERE id = ?',
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

// ===== CARD RECHARGE ROUTES =====

// Admin: Generate recharge cards
app.post('/api/admin/cards/generate', authenticate, requireAdmin, async (req, res) => {
  const { count, credits, expiry_days } = req.body;
  
  try {
    if (!count || !credits) {
      return res.status(400).json({ error: 'Count and credits are required' });
    }
    
    if (count < 1 || count > 1000) {
      return res.status(400).json({ error: 'Count must be between 1 and 1000' });
    }
    
    if (![100, 300, 500, 1000].includes(credits)) {
      return res.status(400).json({ error: 'Invalid credits value' });
    }
    
    // Generate cards
    const cards = generateCards(count, credits, expiry_days);
    
    // Insert into database
    const values = cards.map(card => [
      card.card_code,
      card.credits,
      card.expires_at
    ]);
    
    await pool.query(
      `INSERT INTO recharge_cards (card_code, credits, expires_at) VALUES ?`,
      [values]
    );
    
    res.json({
      success: true,
      count: cards.length,
      cards: cards
    });
  } catch (error) {
    console.error('Generate cards error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Get card list
app.get('/api/admin/cards', authenticate, requireAdmin, async (req, res) => {
  const { status, limit = 100 } = req.query;
  
  try {
    let query = 'SELECT * FROM recharge_cards';
    const params = [];
    
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const [cards] = await pool.query(query, params);
    res.json({ cards });
  } catch (error) {
    console.error('Get cards error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Get card statistics
app.get('/api/admin/cards/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const [stats] = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(credits) as total_credits
      FROM recharge_cards
      GROUP BY status
    `);
    
    res.json({ stats });
  } catch (error) {
    console.error('Get card stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// User: Redeem card
app.post('/api/cards/redeem', authenticate, async (req, res) => {
  const { card_code } = req.body;
  
  try {
    // Validate format
    if (!validateCardCodeFormat(card_code)) {
      return res.status(400).json({ error: '点卡格式不正确' });
    }
    
    // Get client IP
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    // Check rate limit: max 10 redemptions per hour per IP
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [recentRedemptions] = await pool.query(
      'SELECT COUNT(*) as count FROM recharge_cards WHERE used_ip = ? AND used_at > ?',
      [clientIp, oneHourAgo]
    );
    
    if (recentRedemptions[0].count >= 10) {
      return res.status(429).json({ error: '兑换过于频繁，请稍后再试' });
    }
    
    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // Lock and get card
      const [cards] = await connection.query(
        'SELECT * FROM recharge_cards WHERE card_code = ? FOR UPDATE',
        [card_code]
      );
      
      if (cards.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ error: '点卡不存在' });
      }
      
      const card = cards[0];
      
      // Check status
      if (card.status !== 'unused') {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: '点卡已被使用' });
      }
      
      // Check expiry
      if (card.expires_at && new Date(card.expires_at) < new Date()) {
        await connection.query(
          'UPDATE recharge_cards SET status = ? WHERE id = ?',
          ['expired', card.id]
        );
        await connection.commit();
        connection.release();
        return res.status(400).json({ error: '点卡已过期' });
      }
      
      // Update card status
      await connection.query(
        `UPDATE recharge_cards 
         SET status = 'used', used_by = ?, used_at = NOW(), used_ip = ?
         WHERE id = ?`,
        [req.userId, clientIp, card.id]
      );
      
      // Add credits to user
      await addCredits(req.userId, card.credits, `点卡充值 - ${card_code}`, connection);
      
      await connection.commit();
      connection.release();
      
      res.json({
        success: true,
        credits: card.credits,
        message: '兑换成功'
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Redeem card error:', error);
    res.status(500).json({ error: error.message });
  }
});

// User: Get redemption history
app.get('/api/cards/history', authenticate, async (req, res) => {
  try {
    const [cards] = await pool.query(
      `SELECT card_code, credits, used_at
       FROM recharge_cards
       WHERE used_by = ?
       ORDER BY used_at DESC
       LIMIT 50`,
      [req.userId]
    );
    
    res.json({ cards });
  } catch (error) {
    console.error('Get redemption history error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== ADMIN USER MANAGEMENT ROUTES =====

// Get all users
app.get('/api/admin/users', authenticate, requireAdmin, async (req, res) => {
  const { page = 1, limit = 50, search = '' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  try {
    let query = 'SELECT id, email, username, role, ai_credits, created_at FROM users';
    let countQuery = 'SELECT COUNT(*) as total FROM users';
    const params = [];
    
    if (search) {
      query += ' WHERE email LIKE ? OR username LIKE ?';
      countQuery += ' WHERE email LIKE ? OR username LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    const [users] = await pool.query(query, params);
    
    const countParams = search ? [`%${search}%`, `%${search}%`] : [];
    const [countResult] = await pool.query(countQuery, countParams);
    
    res.json({
      users,
      total: countResult[0].total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user credits
app.post('/api/admin/users/:userId/credits', authenticate, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { amount, reason } = req.body;
  
  try {
    if (!amount || !reason) {
      return res.status(400).json({ error: 'Amount and reason are required' });
    }
    
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      await addCredits(parseInt(userId), parseInt(amount), `管理员操作 - ${reason}`, connection);
      await connection.commit();
      connection.release();
      
      res.json({ success: true });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Update user credits error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user role
app.post('/api/admin/users/:userId/role', authenticate, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;
  
  try {
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    await pool.query(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user activity
app.get('/api/admin/users/:userId/activity', authenticate, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { limit = 100 } = req.query;
  
  try {
    const [history] = await pool.query(
      `SELECT id, operation_type as change_type, -credits_cost as credits_change, description, created_at 
       FROM ai_credits_log 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [userId, parseInt(limit)]
    );
    
    res.json({ history });
  } catch (error) {
    console.error('Get user activity error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== QUESTIONS ROUTES =====

app.get('/api/questions', authenticate, async (req, res) => {
  const { category, page = 1, limit = 50, search = '' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  try {
    // Only show user's own questions (not default questions with user_id IS NULL)
    let query = 'SELECT * FROM questions WHERE user_id = ?';
    let countQuery = 'SELECT COUNT(*) as total FROM questions WHERE user_id = ?';
    const params = [req.userId];
    const countParams = [req.userId];
    
    if (category && category !== 'all') {
      query += ' AND category = ?';
      countQuery += ' AND category = ?';
      params.push(category);
      countParams.push(category);
    }
    
    if (search && search.trim()) {
      query += ' AND (question_ja LIKE ? OR question_zh LIKE ? OR model_answer_ja LIKE ? OR summary LIKE ?)';
      countQuery += ' AND (question_ja LIKE ? OR question_zh LIKE ? OR model_answer_ja LIKE ? OR summary LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    const [questions] = await pool.query(query, params);
    const [countResult] = await pool.query(countQuery, countParams);
    
    // Parse JSON fields
    questions.forEach(q => {
      if (q.tips_ja) q.tips_ja = JSON.parse(q.tips_ja);
    });
    
    res.json({
      questions,
      total: countResult[0].total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/questions/random', authenticate, async (req, res) => {
  const { category } = req.query;
  
  try {
    // Only get user's own questions (not default questions with user_id IS NULL)
    let query = 'SELECT * FROM questions WHERE user_id = ?';
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
    // Check user's question count limit (max 300)
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as count FROM questions WHERE user_id = ?',
      [req.userId]
    );
    
    if (countResult[0].count >= 300) {
      return res.status(400).json({ error: '質問数が上限（300件）に達しました。古い質問を削除してください。' });
    }
    
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
    // Check if user has uploaded a resume
    const [resumes] = await pool.query(
      'SELECT id FROM resume_info WHERE user_id = ? LIMIT 1',
      [req.userId]
    );
    
    if (resumes.length === 0) {
      return res.status(400).json({ 
        error: 'Resume required',
        message: '質問を生成する前に履歴書をアップロードしてください。',
        message_zh: '请先上传简历再生成问题。'
      });
    }
    
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
  const { page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
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
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?`,
      [req.userId, parseInt(limit), offset]
    );
    
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM favorites WHERE user_id = ?',
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
    
    res.json({
      favorites,
      total: countResult[0].total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
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
    // Check user's resume count limit (max 5)
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as count FROM resume_info WHERE user_id = ?',
      [req.userId]
    );
    
    if (countResult[0].count >= 5) {
      return res.status(400).json({ error: '履歴書の上限（5件）に達しました。古い履歴書を削除してください。' });
    }
    
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
    // Check vocabulary count limit (1000 per user)
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as count FROM vocabulary_notes WHERE user_id = ?',
      [req.userId]
    );
    
    if (countResult[0].count >= 1000) {
      return res.status(400).json({ 
        error: '単語帳の上限（1000個）に達しました。不要な単語を削除してから追加してください。',
        error_zh: '单词本已达上限（1000个）。请先删除不需要的单词再添加。',
        limit_reached: true
      });
    }
    
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
  const { page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  try {
    const [notes] = await pool.query(
      'SELECT * FROM vocabulary_notes WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [req.userId, parseInt(limit), offset]
    );
    
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM vocabulary_notes WHERE user_id = ?',
      [req.userId]
    );
    
    notes.forEach(note => {
      if (note.example_sentences) note.example_sentences = JSON.parse(note.example_sentences);
      if (note.tags) note.tags = JSON.parse(note.tags);
    });
    
    res.json({
      notes,
      total: countResult[0].total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
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

// Update vocabulary note
app.put('/api/vocabulary/:id', authenticate, async (req, res) => {
  const { word, translation, explanation, example_sentences, tags } = req.body;
  
  try {
    await pool.query(
      `UPDATE vocabulary_notes 
       SET word = ?, translation = ?, explanation = ?, example_sentences = ?, tags = ?
       WHERE id = ? AND user_id = ?`,
      [
        word,
        translation || null,
        explanation || null,
        example_sentences ? JSON.stringify(example_sentences) : null,
        tags ? JSON.stringify(tags) : null,
        req.params.id,
        req.userId
      ]
    );
    
    const [noteRows] = await pool.query('SELECT * FROM vocabulary_notes WHERE id = ?', [req.params.id]);
    const note = noteRows[0];
    if (note.example_sentences) note.example_sentences = JSON.parse(note.example_sentences);
    if (note.tags) note.tags = JSON.parse(note.tags);
    
    res.json(note);
  } catch (error) {
    console.error('Update vocabulary error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check if user has taken vocab test before
app.get('/api/vocabulary/check-test-status', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT COUNT(*) as count FROM vocabulary_notes WHERE user_id = ?',
      [req.userId]
    );
    
    // If user has any vocabulary notes, consider test as taken
    const hasTakenTest = rows[0].count > 0;
    res.json({ hasTakenTest });
  } catch (error) {
    console.error('Check vocab test status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate professional vocabulary test based on resume
app.post('/api/vocabulary/generate-test', authenticate, async (req, res) => {
  const { skills, experience } = req.body;
  
  try {
    console.log('🎯 Generating vocab test for skills:', skills);
    
    const prompt = `あなたは日本語教育の専門家です。以下のスキルと経験に基づいて、面接で使われる可能性の高い専門用語を3-5個生成してください。

スキル: ${skills.join(', ')}
経験: ${experience || '未記入'}

各用語について以下の形式でJSON配列を返してください：
[
  {
    "word": "日本語の専門用語",
    "translation": "中国語訳",
    "explanation": "簡潔な解説（Markdown形式可）"
  }
]

注意事項：
- 実務でよく使われる専門用語を選ぶ
- 難易度は中級～上級レベル
- 説明は30文字以内で簡潔に`;

    console.log('📡 Calling Gemini API...');
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.VITE_GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          }
        })
      }
    );
    
    console.log('📊 Gemini response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Gemini API error:', errorText);
      throw new Error('Gemini API request failed: ' + errorText);
    }
    
    const data = await response.json();
    console.log('✅ Gemini response received');
    const text = data.candidates[0].content.parts[0].text;
    
    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Failed to parse vocabulary data');
    }
    
    const words = JSON.parse(jsonMatch[0]);
    
    // Charge credits for vocabulary generation
    await chargeCredits(req.userId, 'ANALYZE_WORD', `Generated ${words.length} professional vocabulary words`);
    
    res.json({ words });
  } catch (error) {
    console.error('Generate vocabulary test error:', error);
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

// PREP Practice endpoints
app.post('/api/prep-practice/question', authenticate, async (req, res) => {
  console.log('PREP question request received');
  console.log('User:', req.user);
  console.log('UserId:', req.userId);
  
  try {
    const questions = [
      { ja: 'チームで働く時と一人で働く時、どちらが好きですか？', zh: '你更喜欢团队合作还是独立工作？' },
      { ja: '仕事で最も重要なものは何だと思いますか？', zh: '你认为工作中最重要的是什么？' },
      { ja: '失敗から学んだ経験について教えてください。', zh: '请分享一个从失败中学习的经历。' },
      { ja: '新しい技術を学ぶ時、どのようにアプローチしますか？', zh: '学习新技术时，你会如何着手？' },
      { ja: 'ストレスが多い状況をどのように対処しますか？', zh: '你如何应对压力大的情况？' },
      { ja: '5年後、自分はどうなっていたいと思いますか？', zh: '5年后，你希望自己成为什么样的人？' },
      { ja: 'リモートワークとオフィスワーク、どちらが好きですか？', zh: '你更喜欢远程工作还是办公室工作？' },
      { ja: '自分の強みは何だと思いますか？', zh: '你认为自己的优势是什么？' }
    ];
    
    const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
    const user = req.user;
    const lang = user?.target_language || 'zh';
    
    console.log('Sending question:', randomQuestion);
    console.log('Language:', lang);
    
    res.json({ 
      question: lang === 'ja' ? randomQuestion.ja : randomQuestion.zh
    });
  } catch (error) {
    console.error('Error generating PREP question:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/prep-practice/analyze', authenticate, requireCredits('PREP_ANALYSIS'), async (req, res) => {
  const { question, answer } = req.body;
  const userId = req.userId;
  
  try {
    const prompt = `あなたはPREP法の専門家です。以下の質問と回答を分析してください。

質問: ${question}

回答: ${answer}

以下の観点で分析してください：
1. PREP法の4つの要素（Point, Reason, Example, Point）が含まれているか
2. 各要素の質と適切さ
3. 改善点とアドバイス
4. 総合評価（5段階）

そして、この質問に対するPREP法を使った模範回答を提供してください。

回答は以下の形式でMarkdownで出力してください：
## 分析結果
（分析内容）

## 評価
⭐️ X/5

## 模範回答
（PREP法を使った模範回答）`;

    const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || '';
    const GEMINI_MODEL = process.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash-lite';
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error('Gemini API error');
    }

    const data = await response.json();
    const analysis = data.candidates[0]?.content?.parts[0]?.text || '';
    
    // Extract model answer from the analysis
    const parts = analysis.split('## 模範回答');
    const modelAnswer = parts.length > 1 ? '## 模範回答' + parts[1] : '';
    
    // Charge credits after successful generation
    await chargeCredits(userId, 'PREP_ANALYSIS', 'PREP法練習分析');
    
    res.json({ 
      analysis: analysis,
      modelAnswer: modelAnswer
    });
  } catch (error) {
    console.error('Error analyzing PREP answer:', error);
    res.status(500).json({ error: error.message });
  }
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
