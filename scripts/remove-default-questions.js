import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function removeDefaultQuestions() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'interview_helper'
  });

  try {
    console.log('Removing default questions...');
    
    // Delete the two default questions
    const [result] = await connection.query(`
      DELETE FROM questions 
      WHERE question_ja IN ('自己紹介をお願いします。', 'なぜ日本で働きたいと思いますか？')
    `);
    
    console.log(`✅ Deleted ${result.affectedRows} default questions`);
    
    // Show remaining questions
    const [rows] = await connection.query(`
      SELECT id, question_ja, category FROM questions LIMIT 10
    `);
    console.log('\nRemaining questions:');
    console.table(rows);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

removeDefaultQuestions();
