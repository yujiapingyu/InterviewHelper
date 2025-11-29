/**
 * Safely extract and parse JSON from Gemini API response (Frontend version)
 */
export function safeParseGeminiJSON(text, defaultValue = null) {
  if (!text || typeof text !== 'string') {
    console.warn('Invalid text provided to safeParseGeminiJSON:', text);
    return defaultValue;
  }

  try {
    let cleaned = text.trim();
    
    // Step 1: Remove markdown code blocks
    cleaned = cleaned.replace(/^```json?\s*\n?/im, '');
    cleaned = cleaned.replace(/\n?\s*```\s*$/m, '');
    cleaned = cleaned.trim();

    // Step 2: Try direct parse first
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      // Continue to extraction
    }

    // Step 3: Find JSON boundaries with proper bracket matching
    let startIdx = -1;
    let endIdx = -1;
    
    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i] === '{' || cleaned[i] === '[') {
        startIdx = i;
        break;
      }
    }
    
    if (startIdx === -1) {
      console.error('No JSON start found');
      return defaultValue;
    }
    
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
      return defaultValue;
    }
    
    const jsonStr = cleaned.substring(startIdx, endIdx + 1);
    return JSON.parse(jsonStr);

  } catch (error) {
    console.error('JSON parsing error:', error.message);
    console.error('Text length:', text.length);
    return defaultValue;
  }
}
