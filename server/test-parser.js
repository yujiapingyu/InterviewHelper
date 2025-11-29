import { safeParseGeminiJSON } from './utils.js';

// Test cases
const testCases = [
  {
    name: 'Pure JSON object',
    input: '{"skills": ["Python", "React"], "experience": "5 years"}',
    expected: { skills: ['Python', 'React'], experience: '5 years' }
  },
  {
    name: 'JSON with markdown',
    input: '```json\n{"skills": ["Python"], "experience": "test"}\n```',
    expected: { skills: ['Python'], experience: 'test' }
  },
  {
    name: 'JSON array with markdown',
    input: '```json\n[{"question_ja": "test"}]\n```',
    expected: [{ question_ja: 'test' }]
  },
  {
    name: 'JSON with extra text before',
    input: 'Here is the JSON:\n{"skills": ["Go"]}',
    expected: { skills: ['Go'] }
  },
  {
    name: 'JSON with extra text after',
    input: '{"skills": ["JS"]}\nThis is extra text',
    expected: { skills: ['JS'] }
  },
  {
    name: 'Nested JSON object',
    input: '{"data": {"nested": "value", "array": [1, 2, 3]}}',
    expected: { data: { nested: 'value', array: [1, 2, 3] } }
  },
  {
    name: 'JSON with escaped quotes',
    input: '{"text": "He said \\"hello\\""}',
    expected: { text: 'He said "hello"' }
  },
  {
    name: 'Truncated JSON (should fail gracefully)',
    input: '{"skills": ["Python", "React"',
    expected: null
  }
];

console.log('Running JSON parser tests...\n');

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  const result = safeParseGeminiJSON(test.input, null);
  const success = JSON.stringify(result) === JSON.stringify(test.expected);
  
  if (success) {
    console.log(`✅ Test ${index + 1}: ${test.name}`);
    passed++;
  } else {
    console.log(`❌ Test ${index + 1}: ${test.name}`);
    console.log(`   Expected:`, JSON.stringify(test.expected));
    console.log(`   Got:`, JSON.stringify(result));
    failed++;
  }
});

console.log(`\n${passed}/${testCases.length} tests passed`);

if (failed === 0) {
  console.log('\n✅ All tests passed! Parser is working correctly.');
  process.exit(0);
} else {
  console.log(`\n❌ ${failed} tests failed.`);
  process.exit(1);
}
