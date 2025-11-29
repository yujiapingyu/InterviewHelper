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
    // Users table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        username VARCHAR(100),
        avatar_url VARCHAR(500),
        target_language VARCHAR(10) DEFAULT 'ja',
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
          model_answer_ja: '【Point】私は5年間のソフトウェア開発経験を持つフルスタックエンジニアです。\n\n【Reason】特にWebアプリケーション開発に強みがあり、ReactとNode.jsを用いたプロジェクトを多数手がけてきました。\n\n【Example】前職では、ECサイトのフロントエンド開発をリードし、ユーザー体験の向上により売上を20%増加させました。\n\n【Point】貴社の革新的な技術環境で、さらにスキルを伸ばしたいと考えています。',
          tips_ja: JSON.stringify(['30秒～1分程度で簡潔にまとめる', 'PREP法を使って論理的に構成する', '具体的な数字や成果を入れる', '志望動機につなげる']),
          summary: 'Basic self-introduction question'
        },
        {
          category: 'HR',
          question_ja: 'なぜ日本で働きたいと思いますか？',
          question_zh: '为什么想在日本工作？',
          model_answer_ja: '【Point】日本の技術力の高さと、ものづくりへの真摯な姿勢に魅力を感じています。\n\n【Reason】特に品質管理と細部へのこだわりは、グローバルでも高く評価されており、そこから多くを学びたいです。\n\n【Example】以前、日本製のライブラリを使用した際、ドキュメントの充実さとコードの美しさに感動しました。\n\n【Point】このような環境で自分のスキルを磨き、長期的にキャリアを築きたいと考えています。',
          tips_ja: JSON.stringify(['日本や日本企業への敬意を示す', '技術的な理由と文化的な理由をバランスよく', '長期的なキャリアビジョンを示す']),
          summary: 'Motivation for working in Japan'
        },
        {
          category: 'Tech',
          question_ja: 'これまでで最も困難だった技術的な課題について教えてください。',
          question_zh: '请说说到目前为止最困难的技术挑战。',
          model_answer_ja: '【Point】最も困難だったのは、レガシーシステムのマイクロサービス化です。\n\n【Reason】10年以上運用されているモノリシックなシステムで、技術的負債が多く、テストカバレッジも低い状態でした。\n\n【Example】段階的なリファクタリング計画を立て、まず重要度の低い機能から分離しました。CI/CDパイプラインを整備し、テストを追加しながら、6ヶ月かけて主要機能を3つのマイクロサービスに分割しました。\n\n【Point】この経験から、大規模なシステム移行における計画性とチームコミュニケーションの重要性を学びました。',
          tips_ja: JSON.stringify(['具体的な技術スタックを明示', '問題解決のプロセスを詳しく説明', '結果と学びを明確に述べる', 'チームワークの要素も含める']),
          summary: 'Most difficult technical challenge'
        },
        {
          category: 'Tech',
          question_ja: 'あなたの得意な技術スタックについて教えてください。',
          question_zh: '请介绍你擅长的技术栈。',
          model_answer_ja: '【Point】私はReact、TypeScript、Node.jsを中心としたモダンWeb開発が得意です。\n\n【Reason】過去3年間、これらの技術を使用して複数のプロダクション環境のアプリケーションを開発してきました。\n\n【Example】最近では、Next.jsとPrismaを使用したSaaSプラットフォームを開発し、1000人以上のユーザーに利用されています。パフォーマンス最適化にも注力し、Lighthouseスコアで95点以上を達成しました。\n\n【Point】今後はAWS環境でのインフラ構築スキルも強化していきたいと考えています。',
          tips_ja: JSON.stringify(['主要な技術を3-5つに絞る', '経験年数と実績を具体的に', '今後の学習意欲も示す', 'トレンド技術への関心を示す']),
          summary: 'Strongest technology stack'
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
