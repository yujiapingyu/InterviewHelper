import pdfParse from 'pdf-parse';

/**
 * Extract text from PDF file
 */
export async function extractTextFromPDF(arrayBuffer) {
  try {
    const buffer = Buffer.from(arrayBuffer);
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to parse PDF file');
  }
}

/**
 * Extract text from Word document (.docx)
 * Simple implementation - extracts XML content
 */
export async function extractTextFromWord(arrayBuffer) {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(arrayBuffer);
    const doc = await zip.file('word/document.xml').async('string');
    
    // Simple XML text extraction
    const text = doc
      .replace(/<[^>]*>/g, ' ')  // Remove XML tags
      .replace(/\s+/g, ' ')       // Normalize whitespace
      .trim();
    
    return text;
  } catch (error) {
    console.error('Error parsing Word document:', error);
    // Fallback: try to extract as plain text
    try {
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(arrayBuffer);
    } catch (e) {
      throw new Error('Failed to parse Word document');
    }
  }
}

/**
 * Extract text from plain text file
 */
export async function extractTextFromPlainText(arrayBuffer) {
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(arrayBuffer);
}

/**
 * Main function to extract text from any supported file type
 */
export async function extractTextFromFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.pdf')) {
    return await extractTextFromPDF(arrayBuffer);
  } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
    return await extractTextFromWord(arrayBuffer);
  } else if (fileName.endsWith('.txt')) {
    return await extractTextFromPlainText(arrayBuffer);
  } else {
    // Try as plain text
    return await extractTextFromPlainText(arrayBuffer);
  }
}
