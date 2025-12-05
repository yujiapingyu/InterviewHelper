import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function addCategoryColumn() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'interview_helper'
  });

  try {
    console.log('Adding category column to vocabulary_notes table...');
    
    // Check if column exists
    const [columns] = await connection.query(`
      SHOW COLUMNS FROM vocabulary_notes LIKE 'category'
    `);
    
    if (columns.length > 0) {
      console.log('✅ Category column already exists');
    } else {
      await connection.query(`
        ALTER TABLE vocabulary_notes 
        ADD COLUMN category VARCHAR(50) DEFAULT NULL AFTER tags
      `);
      console.log('✅ Successfully added category column');
    }
    
    // Show table structure
    const [rows] = await connection.query(`DESCRIBE vocabulary_notes`);
    console.log('\nVocabulary_notes table structure:');
    console.table(rows);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

addCategoryColumn();
