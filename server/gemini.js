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
export async function generateQuestions(resumeInfo, existingSummaries = [], category = 'HR', count = 3) {
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

  const prompt = `Generate ${count} Japanese interview ${category} questions SPECIFICALLY tailored to this candidate's background. 

${resumeContext}

Requirements:
${categoryGuide}

IMPORTANT: Questions MUST reference the candidate's actual skills/experience from their resume. Generic questions will be rejected.

Return ONLY a JSON array (no markdown, no code blocks):
[{"question_ja":"Japanese question referencing their skills","question_zh":"Chinese translation","model_answer_ja":"【Point】conclusion\\n【Reason】reason\\n【Example】example\\n【Point】conclusion","tips_ja":["tip1","tip2","tip3"],"summary":"brief English summary"}]`;

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
export async function evaluateAnswer(userAnswer, question) {
  const prompt = `You are a professional Japanese interviewer. Evaluate this candidate's answer.

Question: ${question}

Candidate's Answer: ${userAnswer}

Provide detailed feedback in JSON format (no markdown, no code blocks):
{
  "score": 0-100,
  "feedback": "Overall assessment in Japanese (100 chars max)",
  "strengths": ["strength1", "strength2"],
  "improvements": ["improvement1", "improvement2"],
  "correctedVersion": "Improved version of the answer in Japanese"
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
export async function evaluateFollowUpAnswer(originalQuestion, followUpQuestion, userAnswer, conversationHistory = []) {
  const prompt = `You are evaluating a candidate's answer to a follow-up question in a Japanese interview.

Original Question: ${originalQuestion}
Follow-up Question: ${followUpQuestion}
Candidate's Answer: ${userAnswer}

Evaluate the answer and return JSON (no markdown):
{
  "score": 0-100,
  "feedback": "Japanese feedback on their answer",
  "strengths": ["strength1", "strength2"],
  "improvements": ["improvement1", "improvement2"],
  "needsMoreFollowUp": true/false,
  "correctedVersion": "Improved version of their answer in Japanese"
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

export default {
  parseResume,
  generateQuestions,
  evaluateAnswer,
  generateFollowUpQuestion,
  evaluateFollowUpAnswer,
  analyzeVocabulary
};
