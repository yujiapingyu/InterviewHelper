import { parseResume } from './gemini.js';

const sampleResume = `
俞加平
求职意向：后端开发
电话：17855825347
邮箱：yujiaping827@gmail.com

工作经历：
1. 车主邦（北京）科技有限公司 | 浙江湖州 | Java高级开发工程师 | 2023年9月-2024年6月
   - 开发AMP（API管理平台），提供开放的API接口
   - 开发并上线全国首家充电服务开放平台

2. 上海市哔哩哔哩科技有限公司 | 上海 | C++高级开发工程师 | 2021年6月-2023年9月
   - 人工智能技术部数据传输服务（Data服务）负责人
   - 人工智能技术部分布式KV服务负责人
   - 分布式训练平台开发者

教育背景：
1. 宁波大学 | 计算机应用技术 | 硕士 | 2018年9月-2021年6月
2. 宁波大学 | 计算机科学与技术 | 本科 | 2014年9月-2018年6月

技能：Java, C++, Python, 分布式系统, API开发
`;

console.log('📄 Testing new resume parsing...\n');

try {
  const result = await parseResume(sampleResume);
  
  console.log('✅ Parse successful!');
  console.log('\n📊 Parsed data:');
  console.log('Skills:', result.skills);
  console.log('\nExperience (first 200 chars):', result.experience?.substring(0, 200));
  console.log('\nEducation (first 200 chars):', result.education?.substring(0, 200));
  console.log('\nProjects:', result.projects || 'None');
  console.log('\nLanguages:', result.languages || 'None');
  
  console.log('\n✨ Data structure:');
  console.log('- skills is array:', Array.isArray(result.skills));
  console.log('- experience is string:', typeof result.experience === 'string');
  console.log('- education is string:', typeof result.education === 'string');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
}
