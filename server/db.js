import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'interview-coach.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
export function initDatabase() {
  db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      username TEXT,
      avatar_url TEXT,
      target_language TEXT DEFAULT 'ja',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Resume/CV parsed information
    CREATE TABLE IF NOT EXISTS resume_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      parsed_content TEXT,
      skills TEXT,
      experience TEXT,
      education TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Questions table
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      category TEXT NOT NULL CHECK(category IN ('HR', 'Tech')),
      question_ja TEXT NOT NULL,
      question_zh TEXT,
      model_answer_ja TEXT,
      tips_ja TEXT,
      summary TEXT,
      is_ai_generated BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- User practice records
    CREATE TABLE IF NOT EXISTS practice_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      user_answer TEXT NOT NULL,
      answer_type TEXT CHECK(answer_type IN ('text', 'voice')),
      ai_feedback TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    );

    -- Favorites/Review system
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      practice_record_id INTEGER,
      notes TEXT,
      -- Snapshot of question at time of favoriting
      question_snapshot TEXT,
      -- User's answer when favorited
      user_answer TEXT,
      -- AI feedback when favorited
      ai_feedback TEXT,
      -- AI corrected version when favorited
      ai_corrected_version TEXT,
      -- Conversation history (JSON array of follow-up Q&A)
      conversation_history TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
      FOREIGN KEY (practice_record_id) REFERENCES practice_records(id) ON DELETE SET NULL,
      UNIQUE(user_id, question_id)
    );

    -- Practice conversations (follow-up questions and answers)
    CREATE TABLE IF NOT EXISTS practice_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      practice_record_id INTEGER,
      -- Conversation turns (JSON array)
      conversation_turns TEXT NOT NULL,
      -- Current state: 'active', 'completed'
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
      FOREIGN KEY (practice_record_id) REFERENCES practice_records(id) ON DELETE SET NULL
    );

    -- Vocabulary notes (word/phrase collection)
    CREATE TABLE IF NOT EXISTS vocabulary_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      word TEXT NOT NULL,
      translation TEXT,
      explanation TEXT,
      example_sentences TEXT,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Sessions table
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);
    CREATE INDEX IF NOT EXISTS idx_questions_user_id ON questions(user_id);
    CREATE INDEX IF NOT EXISTS idx_practice_records_user_id ON practice_records(user_id);
    CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_practice_conversations_user_question ON practice_conversations(user_id, question_id);
    CREATE INDEX IF NOT EXISTS idx_vocabulary_notes_user_id ON vocabulary_notes(user_id);
  `);

  // Insert default questions
  const count = db.prepare('SELECT COUNT(*) as count FROM questions WHERE user_id IS NULL').get();
  
  if (count.count === 0) {
    const insert = db.prepare(`
      INSERT INTO questions (category, question_ja, question_zh, model_answer_ja, tips_ja, summary)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

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

    const insertMany = db.transaction((questions) => {
      for (const q of questions) {
        insert.run(q.category, q.question_ja, q.question_zh, q.model_answer_ja, q.tips_ja, q.summary);
      }
    });

    insertMany(defaultQuestions);
  }

  // Migration: Add missing columns to favorites table
  try {
    const columns = db.prepare("PRAGMA table_info(favorites)").all();
    const columnNames = columns.map(col => col.name);
    
    if (!columnNames.includes('conversation_history')) {
      console.log('🔧 Adding conversation_history column to favorites table...');
      db.exec(`ALTER TABLE favorites ADD COLUMN conversation_history TEXT;`);
      console.log('✅ Migration: conversation_history column added');
    }
    
    if (!columnNames.includes('updated_at')) {
      console.log('🔧 Adding updated_at column to favorites table...');
      // SQLite doesn't support CURRENT_TIMESTAMP as default in ALTER TABLE
      db.exec(`ALTER TABLE favorites ADD COLUMN updated_at DATETIME;`);
      // Update existing rows with current timestamp
      db.exec(`UPDATE favorites SET updated_at = datetime('now') WHERE updated_at IS NULL;`);
      console.log('✅ Migration: updated_at column added');
    }
    
    // Add notion_page_id to vocabulary_notes
    const vocabColumns = db.prepare("PRAGMA table_info(vocabulary_notes)").all();
    const vocabColumnNames = vocabColumns.map(col => col.name);
    
    if (!vocabColumnNames.includes('notion_page_id')) {
      console.log('🔧 Adding notion_page_id column to vocabulary_notes table...');
      db.exec(`ALTER TABLE vocabulary_notes ADD COLUMN notion_page_id TEXT;`);
      console.log('✅ Migration: notion_page_id column added');
    }
    
    console.log('✅ All migrations completed');
  } catch (error) {
    console.error('Migration error:', error);
  }
}

// Export database instance
export default db;
