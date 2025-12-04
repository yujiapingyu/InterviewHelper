import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Create connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Test connection
pool.getConnection()
  .then(connection => {
    console.log('✅ MySQL connected successfully');
    connection.release();
  })
  .catch(err => {
    console.error('❌ MySQL connection failed:', err.message);
  });

// Initialize database schema
export async function initDatabase() {
  const connection = await pool.getConnection();
  
  try {
    // Email verification codes table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS email_verification_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code VARCHAR(6) NOT NULL,
        expires_at DATETIME NOT NULL,
        used TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Users table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        username VARCHAR(100),
        avatar_url VARCHAR(500),
        target_language VARCHAR(10) DEFAULT 'ja',
        ai_credits INT DEFAULT 100,
        notion_api_key VARCHAR(500),
        notion_database_id VARCHAR(100),
        role ENUM('user', 'admin') DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Resume/CV parsed information
    await connection.query(`
      CREATE TABLE IF NOT EXISTS resume_info (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        filename VARCHAR(255) NOT NULL,
        parsed_content TEXT,
        skills TEXT,
        experience TEXT,
        education TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Questions table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        category VARCHAR(10) NOT NULL,
        question_ja TEXT NOT NULL,
        question_zh TEXT,
        model_answer_ja TEXT,
        tips_ja TEXT,
        summary TEXT,
        is_ai_generated TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_category (category),
        INDEX idx_user_id (user_id),
        CHECK (category IN ('HR', 'Tech'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // User practice records
    await connection.query(`
      CREATE TABLE IF NOT EXISTS practice_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        question_id INT NOT NULL,
        user_answer TEXT NOT NULL,
        answer_type VARCHAR(10),
        ai_feedback TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        CHECK (answer_type IN ('text', 'voice'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Favorites/Review system
    await connection.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        question_id INT NOT NULL,
        practice_record_id INT,
        notes TEXT,
        question_snapshot TEXT,
        user_answer TEXT,
        ai_feedback TEXT,
        ai_corrected_version TEXT,
        conversation_history TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
        FOREIGN KEY (practice_record_id) REFERENCES practice_records(id) ON DELETE SET NULL,
        UNIQUE KEY unique_user_question (user_id, question_id),
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Practice conversations (follow-up questions and answers)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS practice_conversations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        question_id INT NOT NULL,
        practice_record_id INT,
        conversation_turns TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
        FOREIGN KEY (practice_record_id) REFERENCES practice_records(id) ON DELETE SET NULL,
        INDEX idx_user_question (user_id, question_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Vocabulary notes (word/phrase collection)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS vocabulary_notes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        word VARCHAR(255) NOT NULL,
        translation TEXT,
        explanation TEXT,
        example_sentences TEXT,
        tags VARCHAR(500),
        notion_page_id VARCHAR(100),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_word (word)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Sessions table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_token (token)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // AI Credits Usage Log
    await connection.query(`
      CREATE TABLE IF NOT EXISTS ai_credits_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        operation_type VARCHAR(50) NOT NULL,
        credits_cost INT NOT NULL,
        credits_before INT NOT NULL,
        credits_after INT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Recharge cards
    await connection.query(`
      CREATE TABLE IF NOT EXISTS recharge_cards (
        id INT AUTO_INCREMENT PRIMARY KEY,
        card_code VARCHAR(32) UNIQUE NOT NULL,
        credits INT NOT NULL,
        status ENUM('unused', 'used', 'expired') DEFAULT 'unused',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        used_by INT,
        used_at DATETIME,
        used_ip VARCHAR(45),
        FOREIGN KEY (used_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_card_code (card_code),
        INDEX idx_status (status),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Insert default questions
    const [rows] = await connection.query(
      'SELECT COUNT(*) as count FROM questions WHERE user_id IS NULL'
    );
    
    if (rows[0].count === 0) {
      const defaultQuestions = [
        {
          category: 'HR',
          question_ja: '自己紹介をお願いします。',
          question_zh: '请做个自我介绍。',
          model_answer_ja: '【Point】はい、私は〇〇大学を卒業後、5年間ソフトウェア開発の仕事に携わってきました。\n\n【Reason】そうですね、私は人とコミュニケーションを取りながら問題を解決していくことに、やりがいを感じているんです。前職では、チームメンバーと協力しながらプロジェクトを成功させることができました。\n\n【Example】特に印象に残っているのは、納期が厳しいプロジェクトがあったんですけど、チームリーダーと密に連携して優先順位を明確にすることで、期限内に高品質な成果物を納品できたことですね。\n\n【Point】貴社でも、チームの一員として貢献しながら、成長していきたいと考えております。',
          tips_ja: JSON.stringify(['30秒～1分程度で簡潔にまとめる', 'PREP法を使って論理的に構成する', '人柄や協調性をアピールする', '志望動機につなげる']),
          summary: 'Basic self-introduction question'
        },
        {
          category: 'HR',
          question_ja: 'なぜ日本で働きたいと思いますか？',
          question_zh: '为什么想在日本工作？',
          model_answer_ja: '【Point】日本の仕事に対する真摯な姿勢と、チームワークを大切にする文化に魅力を感じているんです。\n\n【Reason】実は、私は協調性を重視していまして、日本の「報連相」の文化や、細部まで丁寧に仕事を進めるスタイルが、自分の価値観とすごく合っていると感じています。\n\n【Example】以前、日本人の同僚と一緒に仕事をしたことがあるんですが、彼らの計画性と責任感の強さに本当に感銘を受けました。その経験から、日本で長期的にキャリアを築きたいと思うようになったんです。\n\n【Point】貴社で日本のビジネス文化を学びながら、自分も成長していきたいと考えています。',
          tips_ja: JSON.stringify(['日本の文化や働き方への理解を示す', '協調性や誠実さをアピール', '長期的なキャリアビジョンを示す', '具体的なエピソードを入れる']),
          summary: 'Motivation for working in Japan'
        },
        {
          category: 'HR',
          question_ja: 'あなたの長所と短所を教えてください。',
          question_zh: '请说说你的优点和缺点。',
          model_answer_ja: '【Point】そうですね、私の長所は責任感が強くて、最後までやり遂げる力があることだと思います。\n\n【Reason】一度引き受けた仕事は、困難があっても諦めずに解決策を探して、必ず完成させるよう心がけているんです。\n\n【Example】前職では、予期せぬ問題が発生したプロジェクトがあったんですが、残業や休日出勤も厭わず対応して、最終的にお客様から高い評価をいただくことができました。\n\n【Point】一方で、短所は完璧主義なところがありまして、時に時間をかけすぎてしまうことがあるんです。ただ、現在は優先順位をつけて効率的に仕事を進めるよう意識して、改善に取り組んでいます。',
          tips_ja: JSON.stringify(['長所は具体例とセットで説明', '短所は改善努力も含めて述べる', '仕事に関連する長所を選ぶ', '正直さと前向きさを示す']),
          summary: 'Strengths and weaknesses'
        },
        {
          category: 'HR',
          question_ja: '5年後、10年後のキャリアプランを教えてください。',
          question_zh: '请说说你5年后、10年后的职业规划。',
          model_answer_ja: '【Point】5年後には、チームリーダーとして後輩を指導できる立場になりたいと考えています。\n\n【Reason】技術力を高めるだけじゃなくて、マネジメントスキルやコミュニケーション能力も磨いて、チーム全体の生産性を高められる人材になりたいと思っているんです。\n\n【Example】そのために、今はプロジェクト管理の勉強を始めていまして、小規模なプロジェクトでリーダー経験を積んでいるところです。\n\n【Point】10年後には、部門を統括するマネージャーとして、会社の成長に貢献できる存在になりたいですね。貴社で長期的にキャリアを積んで、共に成長していきたいと考えております。',
          tips_ja: JSON.stringify(['現実的で具体的な目標を述べる', '会社への貢献を含める', '成長意欲を示す', '長期勤務の意思を伝える']),
          summary: 'Career plan and future goals'
        }
      ];

      for (const q of defaultQuestions) {
        await connection.query(
          `INSERT INTO questions (category, question_ja, question_zh, model_answer_ja, tips_ja, summary)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [q.category, q.question_ja, q.question_zh, q.model_answer_ja, q.tips_ja, q.summary]
        );
      }
      
      console.log('✅ Default questions inserted');
    }
    
    console.log('✅ All database tables initialized');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Export pool instance
export default pool;
