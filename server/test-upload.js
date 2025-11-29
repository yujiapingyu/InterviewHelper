#!/usr/bin/env node
import FormData from 'form-data';
import fs from 'fs';

// Create a test resume file
const testResume = `
張三 (Zhang San)
Email: zhangsan@example.com
電話: 090-1234-5678

職務経歴:
2020-2023: ABC株式会社でソフトウェアエンジニアとして勤務
- React, Node.js, PostgreSQLを使用したWebアプリケーション開発
- チームリーダーとして5名のメンバーを管理

スキル:
- JavaScript, TypeScript, Python, Java
- React, Vue.js, Node.js, Express
- PostgreSQL, MongoDB
- AWS, Docker, Kubernetes

学歴:
2016-2020: 東京大学 コンピュータサイエンス学部卒業
`;

fs.writeFileSync('/tmp/test-resume.txt', testResume);

const form = new FormData();
form.append('file', fs.createReadStream('/tmp/test-resume.txt'));

console.log('📤 Uploading test resume to http://localhost:3001/api/users/1/resume\n');

try {
  const response = await fetch('http://localhost:3001/api/users/1/resume', {
    method: 'POST',
    body: form,
    headers: form.getHeaders()
  });
  
  const result = await response.json();
  
  console.log('Response status:', response.status);
  console.log('Response body:', JSON.stringify(result, null, 2));
  
  if (response.ok) {
    console.log('\n✅ Upload successful!');
  } else {
    console.log('\n❌ Upload failed!');
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
}
