import { parseResume, generateQuestions } from './gemini.js';

const sampleResume = `
俞加平
求职意向：后端开发

工作经历：
1. 车主邦（北京）科技有限公司 | Java高级开发工程师 | 2023年9月-2024年6月
   - 开发AMP（API管理平台），提供开放的API接口
   - 开发并上线全国首家充电服务开放平台

2. 上海市哔哩哔哩科技有限公司 | C++高级开发工程师 | 2021年6月-2023年9月
   - 人工智能技术部数据传输服务（Data服务）负责人
   - 分布式KV服务负责人，设计开发3.0KV架构

教育背景：
宁波大学 | 计算机应用技术 | 硕士 | 2018-2021

技能：Java, C++, Python, 分布式系统, KV存储, API开发, Tensorflow
`;

console.log('📄 Testing resume-based question generation...\n');

try {
  const resumeInfo = await parseResume(sampleResume);
  
  console.log('✅ Resume parsed successfully');
  console.log('Skills:', resumeInfo.skills?.slice(0, 5));
  console.log('Experience preview:', resumeInfo.experience?.substring(0, 100) + '...');
  console.log('\n🔄 Generating Tech questions based on resume...\n');
  
  const questions = await generateQuestions(resumeInfo, [], 'Tech', 2);
  
  console.log(`✅ Generated ${questions.length} questions\n`);
  
  questions.forEach((q, idx) => {
    console.log(`\n--- Question ${idx + 1} ---`);
    console.log('Japanese:', q.question_ja);
    console.log('Chinese:', q.question_zh);
    console.log('Summary:', q.summary);
  });
  
  // Check if questions reference resume content
  const allQuestions = questions.map(q => q.question_ja + ' ' + q.question_zh).join(' ');
  const hasCompanyReference = allQuestions.includes('车主邦') || allQuestions.includes('哔哩哔哩') || allQuestions.includes('Bilibili');
  const hasTechReference = allQuestions.includes('Java') || allQuestions.includes('C++') || allQuestions.includes('KV') || allQuestions.includes('分布式');
  
  console.log('\n\n📊 Question Quality Check:');
  console.log('- References company:', hasCompanyReference ? '✅' : '❌');
  console.log('- References technical skills:', hasTechReference ? '✅' : '❌');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error(error.stack);
}
