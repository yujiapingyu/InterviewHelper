import 'dotenv/config';

const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = process.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash-lite';

const prompt = `日本語面接の回答を評価してください。すべて日本語で返してください。JSONのみ返却：

質問: あなたの強みは何ですか？
回答: I am good at programming and teamwork.

評価基準: 日本語の流暢さ、PREP構造、具体性、改善点

JSON形式（すべて日本語）: {"score":85,"feedback":"総合評価（日本語2-3文）","advice":["アドバイス1","アドバイス2","アドバイス3"],"correctedVersion":"ビジネス日本語とPREP構造で改善した回答"}`;

console.log('🧪 Testing AI Feedback in Japanese...\n');

try {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
          topP: 0.95,
          topK: 40
        }
      })
    }
  );

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  console.log('Raw response:', text);
  console.log('\n---\n');
  
  // Parse JSON
  const cleaned = text.replace(/```json?\s*\n?/gi, '').replace(/\n?\s*```\s*$/m, '').trim();
  const result = JSON.parse(cleaned);
  
  console.log('✅ Parsed Result:');
  console.log(JSON.stringify(result, null, 2));
  
  // Check if all fields are in Japanese
  const hasEnglish = /[a-zA-Z]{5,}/.test(result.feedback + result.advice.join('') + result.correctedVersion);
  
  if (hasEnglish) {
    console.log('\n❌ WARNING: Response contains English words');
  } else {
    console.log('\n✅ All responses are in Japanese!');
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
}
