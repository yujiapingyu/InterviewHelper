#!/usr/bin/env node
import 'dotenv/config';

const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = process.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash-lite';

console.log('🔍 Testing for thoughtsTokenCount issue...\n');
console.log('Model:', GEMINI_MODEL);
console.log('---\n');

const testContent = "David Fish, JavaScript developer, 3 years experience at ABC Corp";

const prompt = `Extract resume info and return ONLY valid JSON:

${testContent}

JSON format: {"skills":["skill1","skill2"],"experience":"summary","education":"summary"}`;

try {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 500,
          topP: 0.8,
          topK: 40
        }
      })
    }
  );

  const data = await response.json();
  
  console.log('📊 Full API Response:');
  console.log(JSON.stringify(data, null, 2));
  console.log('\n---\n');
  
  // Check for thoughtsTokenCount
  const thoughtsTokens = data.usageMetadata?.thoughtsTokenCount;
  const finishReason = data.candidates?.[0]?.finishReason;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (thoughtsTokens) {
    console.log('❌ PROBLEM FOUND!');
    console.log(`   thoughtsTokenCount: ${thoughtsTokens}`);
    console.log(`   This means the model is still in thinking mode!`);
  } else {
    console.log('✅ No thoughtsTokenCount - Good!');
  }
  
  console.log(`   finishReason: ${finishReason}`);
  console.log(`   Has text output: ${!!text}`);
  
  if (text) {
    console.log(`   Text length: ${text.length} chars`);
    console.log('\n📝 Output text:');
    console.log(text);
  } else {
    console.log('\n❌ No text output!');
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
