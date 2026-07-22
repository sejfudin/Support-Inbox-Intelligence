const { PDFParse } = require('pdf-parse');

// Extract the plain-text content of a PDF from an in-memory buffer (multer memory
// storage). Returns '' on any failure — callers treat text extraction as best-effort
// (e.g. CV technology auto-detection) and must never let a bad/corrupt PDF break the
// surrounding request.
const extractPdfText = async (buffer) => {
  if (!buffer || !buffer.length) return '';

  let parser = null;
  try {
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return typeof result?.text === 'string' ? result.text : '';
  } catch {
    return '';
  } finally {
    if (parser?.destroy) {
      try {
        await parser.destroy();
      } catch {
        // ignore cleanup failures
      }
    }
  }
};

module.exports = { extractPdfText };
