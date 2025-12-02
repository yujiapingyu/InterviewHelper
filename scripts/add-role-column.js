import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function addRoleColumn() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('🔧 Adding role column to users table...');
    
    // Check if column exists
    const [columns] = await connection.query(
      `SHOW COLUMNS FROM users LIKE 'role'`
    );
    
    if (columns.length > 0) {
      console.log('✅ Role column already exists');
      return;
    }
    
    // Add role column
    await connection.query(`
      ALTER TABLE users 
      ADD COLUMN role ENUM('user', 'admin') DEFAULT 'user' 
      AFTER notion_database_id
    `);
    
    console.log('✅ Role column added successfully');
    
  } catch (error) {
    console.error('❌ Error adding role column:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

addRoleColumn()
  .then(() => {
    console.log('✅ Migration completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
