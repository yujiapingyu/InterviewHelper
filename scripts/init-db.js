import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'interview-coach.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
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

  -- User sessions table
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Resume/CV parsed information (not storing actual files)
  CREATE TABLE IF NOT EXISTS resume_info (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    parsed_content TEXT, -- JSON string with extracted key information
    skills TEXT, -- JSON array of skills
    experience TEXT, -- JSON array of experiences
    education TEXT, -- JSON array of education
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Questions table
  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER, -- NULL for default questions, user_id for user-generated
    category TEXT NOT NULL CHECK(category IN ('HR', 'Tech')),
    question_ja TEXT NOT NULL,
    question_zh TEXT,
    model_answer_ja TEXT, -- PREP format model answer
    tips_ja TEXT, -- JSON array of tips
    summary TEXT, -- Short summary to prevent duplicates during AI generation
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
    ai_feedback TEXT, -- JSON string with score, feedback, advice, correctedVersion
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
  );

  -- Favorites/Review system (错题本)
  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    practice_record_id INTEGER, -- Link to specific practice record
    notes TEXT, -- User's own notes
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    FOREIGN KEY (practice_record_id) REFERENCES practice_records(id) ON DELETE SET NULL,
    UNIQUE(user_id, question_id)
  );

  -- Indexes for better performance
  CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);
  CREATE INDEX IF NOT EXISTS idx_questions_user_id ON questions(user_id);
  CREATE INDEX IF NOT EXISTS idx_practice_records_user_id ON practice_records(user_id);
  CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
`);

// Insert default questions
const insertDefaultQuestion = db.prepare(`
  INSERT INTO questions (category, question_ja, question_zh, model_answer_ja, tips_ja, summary)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const defaultQuestions = [

];

const insertMany = db.transaction((questions) => {
  for (const q of questions) {
    try {
      insertDefaultQuestion.run(
        q.category,
        q.question_ja,
        q.question_zh,
        q.model_answer_ja,
        q.tips_ja,
        q.summary
      );
    } catch (err) {
      // Ignore duplicates
      if (!err.message.includes('UNIQUE constraint failed')) {
        console.error('Error inserting question:', err);
      }
    }
  }
});

insertMany(defaultQuestions);

console.log('✅ Database initialized successfully!');
console.log('📍 Database location:', dbPath);

db.close();
