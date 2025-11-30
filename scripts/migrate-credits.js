import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    console.log('🔄 Starting database migration...');

    // Helper function to check if column exists
    const columnExists = async (table, column) => {
      const [rows] = await connection.query(`
        SELECT COUNT(*) as count 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
      `, [process.env.DB_NAME, table, column]);
      return rows[0].count > 0;
    };

    // Add new columns to users table
    console.log('➕ Adding ai_credits column...');
    if (!(await columnExists('users', 'ai_credits'))) {
      await connection.query(`
        ALTER TABLE users 
        ADD COLUMN ai_credits INT DEFAULT 100
      `);
      console.log('   ✅ ai_credits column added');
    } else {
      console.log('   ℹ️  ai_credits column already exists');
    }

    console.log('➕ Adding notion_api_key column...');
    if (!(await columnExists('users', 'notion_api_key'))) {
      await connection.query(`
        ALTER TABLE users 
        ADD COLUMN notion_api_key VARCHAR(500)
      `);
      console.log('   ✅ notion_api_key column added');
    } else {
      console.log('   ℹ️  notion_api_key column already exists');
    }

    console.log('➕ Adding notion_database_id column...');
    if (!(await columnExists('users', 'notion_database_id'))) {
      await connection.query(`
        ALTER TABLE users 
        ADD COLUMN notion_database_id VARCHAR(100)
      `);
      console.log('   ✅ notion_database_id column added');
    } else {
      console.log('   ℹ️  notion_database_id column already exists');
    }

    // Update existing users to have 100 credits if they have 0 or NULL
    console.log('🔄 Updating existing users with initial credits...');
    const [result] = await connection.query(`
      UPDATE users 
      SET ai_credits = 100 
      WHERE ai_credits IS NULL OR ai_credits = 0
    `);
    console.log(`   ✅ Updated ${result.affectedRows} users`);

    // Create ai_credits_log table
    console.log('📊 Creating ai_credits_log table...');
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
    console.log('   ✅ ai_credits_log table created');

    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('📝 Summary:');
    console.log('   - Added ai_credits column to users (default: 100)');
    console.log('   - Added notion_api_key column to users');
    console.log('   - Added notion_database_id column to users');
    console.log('   - Created ai_credits_log table');
    console.log('   - Updated existing users with 100 initial credits');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

migrate().catch(console.error);
