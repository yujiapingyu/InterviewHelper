import 'dotenv/config';
import { safeParseGeminiJSON } from './utils.js';

const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash-lite';

if (!GEMINI_API_KEY) {
  console.error('警告: VITE_GEMINI_API_KEY が設定されていません');
}

/**
 * Parse resume content using Gemini AI - preserve ALL information
 */
export async function parseResume(content) {
  // Limit content length to avoid token limits
  const limitedContent = content.substring(0, 3000);
  
  const prompt = `Extract ALL information from this resume. Return JSON only (no markdown, no code blocks):

${limitedContent}

Extract:
- skills: array of technical skills
- workExperience: detailed work history as a single string (company, title, duration, key achievements)
- education: detailed education history as a single string (school, major, degree, duration)
- projects: any project descriptions
- languages: language proficiencies

Format: {"skills":["skill1","skill2"],"workExperience":"2020-2023: Company Name as Title - Achievement1, Achievement2","education":"2018-2021: University as Major (Degree)","projects":"project details","languages":"language proficiency"}`;

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
            maxOutputTokens: 2048,
            topP: 0.95,
            topK: 40
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      console.error('Gemini API returned no text');
      console.error('Full response:', JSON.stringify(data, null, 2));
      throw new Error('Gemini API returned empty response');
    }

    console.log('Resume parsing response length:', text.length);
    console.log('Resume parsed data:', text.substring(0, 500));
    
    const parsed = safeParseGeminiJSON(text, { skills: [], workExperience: '', education: '', projects: '', languages: '' });
    
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Failed to parse resume data from response');
    }
    
    // Normalize field names for compatibility
    return {
      skills: parsed.skills || [],
      experience: parsed.workExperience || parsed.experience || '',
      education: parsed.education || '',
      projects: parsed.projects || '',
      languages: parsed.languages || ''
    };
    
  } catch (error) {
    console.error('Resume parsing error:', error);
    throw error;
  }
}

/**
 * Generate interview questions using Gemini AI
 */
export async function generateQuestions(resumeInfo, existingSummaries = [], category = 'HR', count = 3, isNonNative = true) {
  // Build detailed resume context
  let resumeContext = 'General candidate';
  
  if (resumeInfo && (resumeInfo.skills?.length > 0 || resumeInfo.experience)) {
    const skillsList = resumeInfo.skills?.slice(0, 8).join(', ') || '';
    const experienceText = resumeInfo.experience?.substring(0, 300) || '';
    const educationText = resumeInfo.education?.substring(0, 100) || '';
    
    resumeContext = `候補者プロフィール:
- スキル: ${skillsList}
- 職務経験: ${experienceText}
- 学歴: ${educationText}`;
  }

  const categoryGuide = category === 'HR'
    ? `HR questions focusing on:
- Motivation and values (志望動機、価値観)
- Self-introduction and background (NOT technical details, focus on personality and work style)
- Career goals and long-term plans
- Strengths and weaknesses (personal traits, not technical skills)
- Teamwork, communication, and cultural fit
- Work-life balance, company culture preferences
- Handling stress and conflicts
- Why Japan/this company specifically

IMPORTANT: HR questions should focus on SOFT SKILLS and PERSONAL QUALITIES.
Do NOT ask about specific technologies or technical implementations.
Reference work experience ONLY in terms of achievements, team dynamics, or challenges overcome (not technical details).`
    : `Tech questions focusing on:
- Specific projects using: ${resumeInfo?.skills?.slice(0, 3).join(', ') || 'their tech stack'}
- Technical problem-solving with their technologies
- System design and architecture decisions
- Coding practices and methodologies
- Technical challenges they might have faced
Ask questions that directly relate to the TECHNOLOGIES and EXPERIENCE in their resume.`;

  const nativeLevel = isNonNative 
    ? `CRITICAL: This is for a NON-NATIVE Japanese speaker in a REAL interview (NOT a textbook).
For model_answer_ja, make it sound like an ACTUAL foreigner speaking:
- Use simple, SHORT sentences (non-natives don't speak in long complex sentences)
- Use VERY casual business Japanese that foreigners actually use
- Include small grammar imperfections or simpler structures that are still acceptable
- Use ～と思います、～んです、～ています (basic forms non-natives actually master)
- Avoid complex grammar like ～において、～に際して、～を踏まえ、～に鑑み
- Sound like someone THINKING and SPEAKING, not reciting memorized text
- Use repetition and clarification phrases like "つまり", "要するに", "例えば"
- Keep it at upper-intermediate level, NOT native perfection`
    : `This is for a NATIVE Japanese speaker. Use natural native-level expressions.`;

  const prompt = `Generate ${count} Japanese interview ${category} questions SPECIFICALLY tailored to this candidate's background. 

${resumeContext}

Requirements:
${categoryGuide}

IMPORTANT: Questions MUST reference the candidate's actual skills/experience from their resume. Generic questions will be rejected.

${nativeLevel}

For model_answer_ja, you MUST strictly follow PREP structure:

**MANDATORY PREP FORMAT:**
You MUST use exactly this structure with clear markers:

【Point】
[1-2 sentences stating your main conclusion/position]

【Reason】  
[2-3 sentences explaining WHY, using ～ので、～から、～ため]

【Example】
[2-3 sentences giving concrete example, starting with 例えば]

【Point】
[1-2 sentences restating conclusion]

**CRITICAL RULES:**
1. MUST include all 4 sections with 【】markers
2. Each section MUST be on new line after marker
3. Use COMPLETE sentences (not choppy fragments)
4. AVOID "あの" (max 1-2 in entire answer)
5. Use connectors: ～んです、～ので、～から
6. Sound like N2-N1 speaker (fluent, professional)
7. Can start with "そうですね" ONCE before 【Point】

**CORRECT Example:**
"【Point】
私はチームで協力して成果を上げることを大切にしています。

【Reason】
なぜなら、一人では限界があるので、チームメンバーと協力することで、お互いの強みを活かせるからです。また、多様な視点を取り入れることで、より良い解決策を見つけることができます。

【Example】
例えば、前職では新機能の開発プロジェクトで、フロントエンドとバックエンドのエンジニアが密接に協力しました。週次ミーティングで進捗を共有し、課題を一緒に解決した結果、予定より2週間早くリリースできました。

【Point】
このように、チームワークを大切にする文化で働きたいと思っています。"

**WRONG (missing markers or structure):**
"私はチームで協力して...なぜなら...例えば..."

Return ONLY a JSON array (no markdown, no code blocks):
[{"question_ja":"Japanese question","question_zh":"Chinese translation","model_answer_ja":"【Point】\n...\n\n【Reason】\n...\n\n【Example】\n...\n\n【Point】\n...","tips_ja":["tip1","tip2","tip3"],"summary":"brief summary"}]`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 8192
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      console.error('Gemini API returned no text for question generation');
      console.error('Full response:', JSON.stringify(data, null, 2));
      throw new Error('Gemini API returned empty response');
    }

    console.log(`Generated ${category} questions response length:`, text.length);
    console.log('First 1000 chars:', text.substring(0, 1000));
    
    const parsed = safeParseGeminiJSON(text, []);
    
    if (!Array.isArray(parsed)) {
      console.error('Parsed result is not an array:', typeof parsed);
      throw new Error('Response is not a valid questions array');
    }
    
    if (parsed.length === 0) {
      console.error('Parsed array is empty');
      throw new Error('No questions generated');
    }
    
    console.log(`Successfully parsed ${parsed.length} questions`);
    return parsed;
    
  } catch (error) {
    console.error('Question generation error:', error);
    throw error;
  }
}

/**
 * Evaluate initial answer to a question
 */
export async function evaluateAnswer(userAnswer, question, isNonNative = true) {
  const nativeContext = isNonNative
    ? `CRITICAL: This candidate is a NON-NATIVE Japanese speaker at N2-N1 level.
- Judge based on COMMUNICATION SUCCESS and CONTENT QUALITY, not native perfection
- Minor grammar mistakes are FINE if the message is clear and professional
- In correctedVersion, improve clarity while keeping it natural for N2-N1 level
- Use COMPLETE, WELL-FORMED sentences (not choppy fragments)
- Sound CONVERSATIONAL but FLUENT (like a competent speaker, not beginner)
- Follow PREP structure: Point → Reason → Example → Point
- AVOID excessive "あの" (max 1-2 times)
- Use natural connectors: ～んです、～ので、～から`
    : `This candidate is a NATIVE Japanese speaker. Evaluate at native professional level.`;

  const prompt = `You are a professional Japanese interviewer. Evaluate this candidate's answer.

${nativeContext}

Question: ${question}

Candidate's Answer: ${userAnswer}

Provide detailed feedback in JSON format (no markdown, no code blocks):
{
  "score": 0-100,
  "feedback": "Overall assessment in Japanese (150 chars max, encouraging and constructive)",
  "strengths": ["specific strength 1", "specific strength 2", "specific strength 3"],
  "improvements": ["specific improvement 1", "specific improvement 2"],
  "correctedVersion": "${isNonNative ? 'MUST use PREP structure with 【Point】【Reason】【Example】【Point】 markers on separate lines. Each section 2-3 COMPLETE sentences. Use ～んです、～ので、～から. NO choppy fragments. NO excessive あの. Sound like fluent N2-N1 speaker. Format: 【Point】\n[conclusion sentences]\n\n【Reason】\n[reason sentences with なぜなら/ので]\n\n【Example】\n[example with 例えば]\n\n【Point】\n[summary]' : 'Professional version with PREP structure and native expressions'}"
}`;

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
            maxOutputTokens: 1024,
            topP: 0.95,
            topK: 40
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      throw new Error('Gemini API returned empty response');
    }

    const parsed = safeParseGeminiJSON(text, {
      score: 50,
      feedback: 'フィードバックの生成に失敗しました',
      strengths: [],
      improvements: [],
      correctedVersion: ''
    });

    return parsed;
  } catch (error) {
    console.error('Answer evaluation error:', error);
    throw error;
  }
}

/**
 * Generate follow-up question based on user's answer
 */
export async function generateFollowUpQuestion(originalQuestion, userAnswer, conversationHistory = []) {
  const historyContext = conversationHistory.length > 0
    ? `\n\nPrevious follow-ups:\n${conversationHistory.map((turn, idx) => 
        `${idx + 1}. Q: ${turn.followUpQuestion}\n   A: ${turn.userAnswer}`
      ).join('\n')}`
    : '';

  const prompt = `You are a professional Japanese interviewer. Based on the candidate's answer, generate ONE insightful follow-up question in Japanese to dig deeper.

Original Question: ${originalQuestion}
Candidate's Answer: ${userAnswer}${historyContext}

Generate a follow-up question that:
1. Digs deeper into their answer (ask for specific examples, metrics, challenges faced)
2. Tests their actual understanding and experience
3. Is natural and conversational
4. Is in polite Japanese (です・ます form)

Return ONLY a JSON object (no markdown, no code blocks):
{"followUpQuestion":"Japanese follow-up question","reasoning":"Why this follow-up is important","expectedDepth":"What aspect we're testing"}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      throw new Error('Gemini API returned empty response');
    }

    console.log('Follow-up generation response:', text.substring(0, 300));
    
    const parsed = safeParseGeminiJSON(text, { followUpQuestion: '', reasoning: '', expectedDepth: '' });
    return parsed;
    
  } catch (error) {
    console.error('Follow-up question generation error:', error);
    throw error;
  }
}

/**
 * Evaluate follow-up answer and decide if more follow-ups needed
 */
export async function evaluateFollowUpAnswer(originalQuestion, followUpQuestion, userAnswer, conversationHistory = [], isNonNative = true) {
  const nativeContext = isNonNative
    ? `CRITICAL: This candidate is a NON-NATIVE Japanese speaker.
- Judge based on communication success, not perfection
- In correctedVersion, make it sound like a REAL foreigner speaking
- Use SHORT simple sentences, basic grammar, natural fillers`
    : `This candidate is a NATIVE Japanese speaker.`;

  const prompt = `You are evaluating a candidate's answer to a follow-up question in a Japanese interview.

${nativeContext}

Original Question: ${originalQuestion}
Follow-up Question: ${followUpQuestion}
Candidate's Answer: ${userAnswer}

Evaluate the answer and return JSON (no markdown):
{
  "score": 0-100,
  "feedback": "Japanese feedback on their answer (very encouraging for non-natives)",
  "strengths": ["strength1", "strength2"],
  "improvements": ["improvement1", "improvement2"],
  "needsMoreFollowUp": true/false,
  "correctedVersion": "${isNonNative ? 'MUST follow PREP format: 【Point】\n[conclusion]\n\n【Reason】\n[why, using ～ので/～から]\n\n【Example】\n[concrete example with 例えば]\n\n【Point】\n[summary]. Use COMPLETE sentences, natural connectors (～んです、～ので). Sound like competent N2-N1 speaker, NOT beginner. Minimal あの (max 1-2).' : 'Professional version with PREP structure'}"
}`;

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
            maxOutputTokens: 2048
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      throw new Error('Gemini API returned empty response');
    }

    console.log('Evaluation response:', text.substring(0, 300));
    
    const parsed = safeParseGeminiJSON(text, {
      score: 0,
      feedback: '',
      strengths: [],
      improvements: [],
      needsMoreFollowUp: false,
      correctedVersion: ''
    });
    
    return parsed;
    
  } catch (error) {
    console.error('Follow-up evaluation error:', error);
    throw error;
  }
}

/**
 * Analyze vocabulary word/phrase with translation and examples
 */
export async function analyzeVocabulary(word) {
  const prompt = `Analyze this Japanese word or phrase and provide detailed information.

Word/Phrase: ${word}

Provide analysis in JSON format (no markdown, no code blocks):
{
  "translation": "Chinese translation",
  "explanation": "Detailed explanation in Chinese (usage, nuance, grammar points)",
  "exampleSentences": [
    {"japanese": "example sentence 1", "chinese": "Chinese translation"},
    {"japanese": "example sentence 2", "chinese": "Chinese translation"},
    {"japanese": "example sentence 3", "chinese": "Chinese translation"}
  ],
  "tags": ["category1", "category2"]
}`;

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
            maxOutputTokens: 2048
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      throw new Error('Gemini API returned empty response');
    }

    const parsed = safeParseGeminiJSON(text, {
      translation: '',
      explanation: '',
      exampleSentences: [],
      tags: []
    });
    
    return parsed;
  } catch (error) {
    console.error('Vocabulary analysis error:', error);
    throw error;
  }
}

/**
 * Extract interview questions from document text
 * Supports both Japanese and Chinese questions
 */
export async function extractQuestionsFromDocument(documentText, category = 'HR') {
  const prompt = `Extract ALL interview questions from this document text. The questions may be in Japanese or Chinese.

Document Text:
${documentText.substring(0, 4000)}

Requirements:
1. Extract every question found in the document
2. If a question is in Chinese, translate it to Japanese
3. If a question is in Japanese, leave it as is
4. Return ONLY the questions, NO answers or other fields yet
5. Categorize each question as either "HR" or "Tech" based on content

Categorization Guide:
- **HR** (Human Resources / Soft Skills):
  * 志望動機、価値観 (motivation, values)
  * 自己紹介、経歴 (self-intro, background - focus on personality/achievements, NOT technical details)
  * キャリアプラン、目標 (career plans, goals)
  * 長所、短所 (strengths, weaknesses - personality traits)
  * チームワーク、コミュニケーション (teamwork, communication)
  * ストレス対処、困難の克服 (stress handling, overcoming challenges)
  * 会社・日本を選んだ理由 (why this company/Japan)
  * 文化適応、働き方 (cultural fit, work style)
  * Example keywords: なぜ、どうして、経験、感じる、考える、性格、人間関係

- **Tech** (Technical / Professional Skills):
  * 具体的な技術スタック (Java, Python, React, SQL, AWS, etc.)
  * システム設計、アーキテクチャ (system design, architecture)
  * データベース、分散システム (database, distributed systems)
  * コーディング、アルゴリズム (coding, algorithms)
  * プロジェクト経験（技術的詳細） (project experience with technical details)
  * パフォーマンス最適化、障害対応 (performance optimization, troubleshooting)
  * 開発手法、ツール (development methodologies, tools)
  * Example keywords: 技術、実装、設計、開発、コード、API、データベース、アルゴリズム

Return ONLY a JSON array (no markdown, no code blocks):
[{"question_ja":"Japanese question","question_zh":"Chinese original or translation","category":"HR or Tech"}]

If no questions are found, return an empty array: []`;

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
            maxOutputTokens: 8192
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      throw new Error('Gemini API returned empty response');
    }

    const parsed = safeParseGeminiJSON(text, []);
    
    if (!Array.isArray(parsed)) {
      return [];
    }
    
    return parsed;
  } catch (error) {
    console.error('Question extraction error:', error);
    throw error;
  }
}

/**
 * Generate complete question data for a question
 * This fills in model_answer_ja, tips_ja, and summary fields
 */
export async function generateQuestionAnalysis(questionText, category = 'HR', additionalPrompt = '', isNonNative = true) {
  const nativeLevel = isNonNative 
    ? `CRITICAL: This is for a NON-NATIVE Japanese speaker in a REAL interview.
- model_answer_ja should sound like an ACTUAL foreigner speaking (NOT a textbook)
- Use SHORT, SIMPLE sentences (foreigners don't speak in complex paragraphs)
- Use basic grammar and common vocabulary only
- Include natural spoken fillers and hesitations
- Make mistakes acceptable if the meaning is clear
- Sound like someone THINKING while speaking, not reciting`
    : `This is for a NATIVE Japanese speaker. Use natural native-level expressions.`;

  const prompt = `Generate a complete analysis for this interview question.

Question: ${questionText}
Category: ${category}
${additionalPrompt ? `Additional Requirements: ${additionalPrompt}` : ''}

${nativeLevel}

For model_answer_ja, you MUST strictly follow PREP structure:

**MANDATORY PREP FORMAT:**
You MUST use exactly this structure with clear markers:

【Point】
[1-2 sentences stating your main conclusion/position]

【Reason】
[2-3 sentences explaining WHY, using ～ので、～から、～ため]

【Example】
[2-3 sentences giving concrete example, starting with 例えば]

【Point】
[1-2 sentences restating conclusion]

**CRITICAL RULES:**
1. MUST include all 4 sections with 【】markers
2. Each section MUST be on new line after marker
3. Use COMPLETE sentences (not choppy fragments)
4. AVOID "あの" (max 1-2 in entire answer)
5. Use connectors: ～んです、～ので、～から
6. Sound like N2-N1 speaker (fluent, professional)
7. Can start with "そうですね" ONCE before 【Point】

**CORRECT Example:**
"【Point】
私はチームで協力して成果を上げることを大切にしています。

【Reason】
なぜなら、一人では限界があるので、チームメンバーと協力することで、お互いの強みを活かせるからです。また、多様な視点を取り入れることで、より良い解決策を見つけることができます。

【Example】
例えば、前職では新機能の開発プロジェクトで、フロントエンドとバックエンドのエンジニアが密接に協力しました。週次ミーティングで進捗を共有し、課題を一緒に解決した結果、予定より2週間早くリリースできました。

【Point】
このように、チームワークを大切にする文化で働きたいと思っています。"

**WRONG (missing markers or structure):**
"私はチームで協力して...なぜなら...例えば..."

Return ONLY a JSON object (no markdown, no code blocks):
{
  "model_answer_ja": "【Point】\n...\n\n【Reason】\n...\n\n【Example】\n...\n\n【Point】\n...",
  "tips_ja": ["tip1", "tip2", "tip3"],
  "summary": "brief English summary"
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      throw new Error('Gemini API returned empty response');
    }

    const parsed = safeParseGeminiJSON(text, {
      model_answer_ja: '',
      tips_ja: [],
      summary: ''
    });
    
    return parsed;
  } catch (error) {
    console.error('Question analysis error:', error);
    throw error;
  }
}

export default {
  parseResume,
  generateQuestions,
  evaluateAnswer,
  generateFollowUpQuestion,
  evaluateFollowUpAnswer,
  analyzeVocabulary,
  extractQuestionsFromDocument,
  generateQuestionAnalysis
};

