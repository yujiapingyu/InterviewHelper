import { safeParseGeminiJSON } from './jsonParser';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash-lite';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

// Text generation for feedback
export async function getAIFeedback(userAnswer, question) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured. Please add VITE_GEMINI_API_KEY to your .env file.');
  }

  const prompt = `日本語面接の回答を評価してください。すべての内容を日本語のみで返してください。英語は使用しないでください。JSONのみ返却：

質問: ${question.question_ja}
回答: ${userAnswer}

評価基準: 日本語の流暢さ、PREP構造（結論→理由→具体例→結論）、具体性、改善点

JSON形式（すべて日本語で、英語を含めない）: {"score":85,"feedback":"総合評価を日本語で2-3文","advice":["アドバイス1を日本語で","アドバイス2を日本語で","アドバイス3を日本語で"],"correctedVersion":"ビジネス日本語とPREP構造で改善した回答（日本語のみ）"}`;

  try {
    const response = await fetch(
      `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
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

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('No response from Gemini API');
    }

    console.log('AI Feedback response length:', text.length);

    const feedback = safeParseGeminiJSON(text, {
      score: 50,
      feedback: 'フィードバックの解析に失敗しました',
      advice: ['もう一度お試しください'],
      correctedVersion: userAnswer
    });
    
    return feedback;

  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw error;
  }
}

// Speech to text using Web Speech API (more accurate than Gemini for Japanese)
export async function transcribeAudio(audioBase64) {
  // Web Speech API is better for real-time transcription
  // This function is kept for compatibility but recommends using SpeechRecognition directly
  throw new Error('Please use the built-in speech recognition button instead');
}

// Web Speech API for real-time Japanese transcription
export function startSpeechRecognition(onResult, onError) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    onError(new Error('このブラウザは音声認識に対応していません。Chrome または Edge をお使いください。'));
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'ja-JP';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finalTranscript = '';

  recognition.onresult = (event) => {
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        // Add space between sentences for better readability
        finalTranscript += (finalTranscript ? ' ' : '') + transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    onResult(finalTranscript.trim(), interimTranscript);
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    onError(new Error(`音声認識エラー: ${event.error}`));
  };

  recognition.onend = () => {
    console.log('Speech recognition ended');
  };

  try {
    recognition.start();
    return recognition;
  } catch (error) {
    onError(error);
    return null;
  }
}

// Generate new questions based on resume and existing questions
export async function generateQuestions(resumeInfo, existingQuestionSummaries, category, count = 3) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured');
  }

  const prompt = `あなたは日本企業の人事担当者です。以下の情報を基に、外国人プログラマー向けの面接質問を生成してください。

カテゴリ：${category === 'HR' ? 'HR/一般（ソフトスキル、志望動機など）' : 'Tech/技術（プロジェクト経験、技術スタック）'}

応募者の情報：
${resumeInfo ? `
スキル: ${resumeInfo.skills?.join(', ') || 'なし'}
経験: ${resumeInfo.experience || 'なし'}
学歴: ${resumeInfo.education || 'なし'}
` : '一般的なプログラマー'}

既存の質問（重複を避けるため）：
${existingQuestionSummaries.join('\n')}

以下の要件で${count}個の質問を生成してください：
1. 既存の質問と重複しない
2. 日本のIT業界の面接で実際に聞かれる質問
3. 応募者の背景に関連する質問
4. PREP法で答えやすい質問

**重要：必ず以下のJSON形式のみで回答してください。**

{
  "questions": [
    {
      "question_ja": "<日本語の質問>",
      "question_zh": "<中国語訳>",
      "model_answer_ja": "<PREP法に基づく模範回答。【Point】【Reason】【Example】【Point】の形式で>",
      "tips_ja": ["<回答のコツ1>", "<回答のコツ2>", "<回答のコツ3>"],
      "summary": "<この質問の簡潔な要約（英語、重複チェック用）>"
    }
  ]
}`;

  try {
    const response = await fetch(
      `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.9,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 4096,
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('No response from Gemini API');
    }

    let cleanedText = text.trim();
    cleanedText = cleanedText.replace(/^```json\n?/i, '').replace(/\n?```$/i, '');
    cleanedText = cleanedText.trim();

    const result = JSON.parse(cleanedText);
    return result.questions || [];

  } catch (error) {
    console.error('Error generating questions:', error);
    throw error;
  }
}

// Parse resume using Gemini
export async function parseResume(fileContent, filename) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured');
  }

  const prompt = `以下は応募者の履歴書/職務経歴書です。重要な情報を抽出してください。

ファイル名: ${filename}
内容:
${fileContent}

**重要：必ず以下のJSON形式のみで回答してください。**

{
  "skills": ["<スキル1>", "<スキル2>", ...],
  "experience": "<職務経験の要約>",
  "education": "<学歴の要約>",
  "summary": "<全体的な要約>"
}`;

  try {
    const response = await fetch(
      `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 32,
            topP: 1,
            maxOutputTokens: 2048,
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('No response from Gemini API');
    }

    let cleanedText = text.trim();
    cleanedText = cleanedText.replace(/^```json\n?/i, '').replace(/\n?```$/i, '');
    cleanedText = cleanedText.trim();

    const parsed = JSON.parse(cleanedText);
    return parsed;

  } catch (error) {
    console.error('Error parsing resume:', error);
    throw error;
  }
}
