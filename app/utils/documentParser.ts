/**
 * Document parser utility for extracting text from PDF and TXT files
 */

const MAX_DOCUMENT_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_CONTENT_LENGTH = 50000; // 50K characters to avoid token limits

/**
 * Parse a document file (PDF or TXT) and extract its text content
 * @param file - The file to parse
 * @returns The extracted text content
 * @throws Error if file is unsupported or too large
 */
export async function parseDocumentToText(file: File): Promise<string> {
  // Check file size
  if (file.size > MAX_DOCUMENT_SIZE) {
    throw new Error(`File too large. Maximum size is 5MB. Your file: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
  }

  const fileName = file.name.toLowerCase();

  // Handle TXT files
  if (fileName.endsWith('.txt')) {
    let content = await file.text();

    // Truncate if too long
    if (content.length > MAX_CONTENT_LENGTH) {
      content = content.substring(0, MAX_CONTENT_LENGTH) + '\n\n[Document truncated due to length...]';
    }

    return content;
  }

  // Handle PDF files using pdfjs-dist
  if (fileName.endsWith('.pdf')) {
    try {
      // Dynamically import pdfjs-dist (will be installed separately)
      const pdfjsLib = await import('pdfjs-dist');

      // Set worker path for PDF.js
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Load PDF document
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let fullText = '';

      // Extract text from each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Combine text items
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += `\n${pageText}\n`;
      }

      // Clean up extra whitespace
      fullText = fullText.trim();

      // Truncate if too long
      if (fullText.length > MAX_CONTENT_LENGTH) {
        fullText = fullText.substring(0, MAX_CONTENT_LENGTH) + '\n\n[Document truncated due to length...]';
      }

      return fullText;
    } catch (error) {
      console.error('PDF parsing error:', error);
      throw new Error('Failed to parse PDF. The file may be corrupted or password-protected.');
    }
  }

  throw new Error('Unsupported file type. Please upload a PDF or TXT file.');
}
