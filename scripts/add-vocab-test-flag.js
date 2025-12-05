import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function addVocabTestFlag() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'interview_helper'
  });

  try {
    console.log('Adding has_taken_vocab_test column to users table...');
    
    await connection.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS has_taken_vocab_test BOOLEAN DEFAULT FALSE
    `);
    
    console.log('✅ Successfully added has_taken_vocab_test column');
    
    // Check the column was added
    const [rows] = await connection.query(`
      DESCRIBE users
    `);
    console.log('\nUsers table structure:');
    console.table(rows);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

addVocabTestFlag();
