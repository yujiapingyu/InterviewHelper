import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

/**
 * Extract text from PDF file (Node.js only)
 */
export async function extractTextFromPDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to parse PDF file');
  }
}

/**
 * Extract text from Word document (.docx)
 */
export async function extractTextFromWord(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('Error parsing Word document:', error);
    throw new Error('Failed to parse Word document');
  }
}

/**
 * Extract text from plain text file
 */
export async function extractTextFromPlainText(buffer) {
  return buffer.toString('utf-8');
}

/**
 * Extract text from Markdown file
 */
export async function extractTextFromMarkdown(buffer) {
  // For now, just extract as plain text
  // You can use a markdown parser if needed
  return buffer.toString('utf-8');
}

/**
 * Main function to extract text from any supported file type
 */
export async function extractTextFromFile(buffer, fileName) {
  const lowerName = fileName.toLowerCase();
  
  if (lowerName.endsWith('.pdf')) {
    return await extractTextFromPDF(buffer);
  } else if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) {
    return await extractTextFromWord(buffer);
  } else if (lowerName.endsWith('.txt')) {
    return await extractTextFromPlainText(buffer);
  } else if (lowerName.endsWith('.md')) {
    return await extractTextFromMarkdown(buffer);
  } else {
    // Try as plain text
    return await extractTextFromPlainText(buffer);
  }
}
