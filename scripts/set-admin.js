import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function setAdmin() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('\n🔐 设置管理员账号\n');
    
    const email = await question('请输入要设为管理员的用户邮箱: ');
    
    if (!email) {
      console.log('❌ 邮箱不能为空');
      return;
    }
    
    // Check if user exists
    const [users] = await connection.query(
      'SELECT id, email, username, role FROM users WHERE email = ?',
      [email]
    );
    
    if (users.length === 0) {
      console.log(`❌ 用户不存在: ${email}`);
      return;
    }
    
    const user = users[0];
    console.log(`\n找到用户:`);
    console.log(`  ID: ${user.id}`);
    console.log(`  邮箱: ${user.email}`);
    console.log(`  用户名: ${user.username || '未设置'}`);
    console.log(`  当前角色: ${user.role}`);
    
    if (user.role === 'admin') {
      console.log('\n✅ 该用户已经是管理员');
      return;
    }
    
    const confirm = await question('\n确认将此用户设为管理员？(yes/no): ');
    
    if (confirm.toLowerCase() !== 'yes') {
      console.log('❌ 已取消');
      return;
    }
    
    // Update role
    await connection.query(
      'UPDATE users SET role = ? WHERE id = ?',
      ['admin', user.id]
    );
    
    console.log('\n✅ 成功将用户设为管理员！');
    console.log('该用户现在可以使用管理员控制台了。\n');
    
  } catch (error) {
    console.error('❌ 错误:', error);
    throw error;
  } finally {
    await connection.end();
    rl.close();
  }
}

setAdmin()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ 失败:', err);
    process.exit(1);
  });
