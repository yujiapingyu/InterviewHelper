#!/usr/bin/env node
import 'dotenv/config';
import { parseResume } from './gemini.js';

console.log('🧪 Testing Resume Parsing with gemini-1.5-flash...\n');
console.log('Model:', process.env.VITE_GEMINI_MODEL);
console.log('API Key:', process.env.VITE_GEMINI_API_KEY ? '✅ Set' : '❌ Missing');
console.log('---\n');

const testResume = `
David Fish
Email: david@example.com
Phone: 090-1234-5678

経歴:
- 2020-2023: ABC株式会社でフルスタック開発者として勤務
- React, Node.js, PostgreSQLを使用したWebアプリケーション開発
- チームリーダーとして5名のメンバーを管理

スキル:
- JavaScript, TypeScript, Python
- React, Vue.js, Node.js
- AWS, Docker, Kubernetes

学歴:
- 2016-2020: 東京大学 コンピュータサイエンス学部卒業
`;

try {
  console.log('📝 Test resume content:', testResume.substring(0, 100) + '...\n');
  
  const result = await parseResume(testResume);
  
  console.log('✅ SUCCESS! No thoughtsTokenCount detected!\n');
  console.log('📊 Parsed Result:');
  console.log(JSON.stringify(result, null, 2));
  
  // Verify structure
  if (result.skills && Array.isArray(result.skills)) {
    console.log('\n✅ Skills array:', result.skills.length, 'items');
  }
  if (result.experience) {
    console.log('✅ Experience:', result.experience.substring(0, 50) + '...');
  }
  if (result.education) {
    console.log('✅ Education:', result.education.substring(0, 50) + '...');
  }
  
} catch (error) {
  console.error('❌ FAILED:', error.message);
  console.error('\nFull error:', error);
  process.exit(1);
}
