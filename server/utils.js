/**
 * Safely extract and parse JSON from Gemini API response
 * Handles markdown code blocks, extra whitespace, and malformed JSON
 */
export function safeParseGeminiJSON(text, defaultValue = null) {
  if (!text || typeof text !== 'string') {
    console.warn('Invalid text provided to safeParseGeminiJSON:', text);
    return defaultValue;
  }

  try {
    let cleaned = text.trim();
    
    // Step 1: Remove markdown code blocks (```json or ```)
    // Handle both single and multi-line markdown
    cleaned = cleaned.replace(/^```json?\s*\n?/im, '');
    cleaned = cleaned.replace(/\n?\s*```\s*$/m, '');
    cleaned = cleaned.trim();

    // Step 2: Try direct parse first (fastest path)
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      // Continue to more aggressive cleaning
    }

    // Step 3: Find JSON boundaries
    let startIdx = -1;
    let endIdx = -1;
    
    // Find first { or [
    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i] === '{' || cleaned[i] === '[') {
        startIdx = i;
        break;
      }
    }
    
    if (startIdx === -1) {
      console.error('No JSON start found in text:', cleaned.substring(0, 200));
      return defaultValue;
    }
    
    // Find matching closing bracket
    const openChar = cleaned[startIdx];
    const closeChar = openChar === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escapeNext = false;
    
    for (let i = startIdx; i < cleaned.length; i++) {
      const char = cleaned[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if (char === openChar) {
          depth++;
        } else if (char === closeChar) {
          depth--;
          if (depth === 0) {
            endIdx = i;
            break;
          }
        }
      }
    }
    
    if (endIdx === -1) {
      console.error('No matching JSON end found');
      console.error('Full text:', cleaned);
      return defaultValue;
    }
    
    const jsonStr = cleaned.substring(startIdx, endIdx + 1);
    
    // Step 4: Parse the extracted JSON
    const parsed = JSON.parse(jsonStr);
    return parsed;

  } catch (error) {
    console.error('JSON parsing error:', error.message);
    console.error('Full problematic text:', text);
    return defaultValue;
  }
}

/**
 * Generate a safe JSON response prompt for Gemini
 */
export function createJSONPrompt(instruction, schema, examples = null) {
  let prompt = `${instruction}\n\n`;
  
  prompt += `**重要：必ず以下のJSON形式のみで回答してください。**\n`;
  prompt += `- Markdownコードブロック（\`\`\`）は使用しない\n`;
  prompt += `- 追加の説明やテキストは含めない\n`;
  prompt += `- 純粋なJSONのみを返す\n\n`;
  
  prompt += `回答形式：\n${schema}\n`;
  
  if (examples) {
    prompt += `\n例：\n${examples}\n`;
  }
  
  return prompt;
}

export default {
  safeParseGeminiJSON,
  createJSONPrompt
};
