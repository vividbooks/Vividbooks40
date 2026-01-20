/**
 * Extrakce textu z dokumentů (PDF, PowerPoint, Word) pomocí Gemini AI
 * Spouští se na pozadí po uploadu souboru
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyDcPJrEcxThsVskj2LvYf6VB3mGTM45Ih0';

/**
 * Nahraje soubor do Gemini Files API a vrátí file URI
 */
async function uploadToGemini(fileBlob: Blob, fileName: string, mimeType: string): Promise<string> {
  const fileBytes = await fileBlob.arrayBuffer();
  const fileSize = fileBytes.byteLength;
  
  console.log('[PDF Extractor] Uploading to Gemini, size:', fileSize);
  
  // 1. Inicializovat resumable upload
  const initResponse = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': fileSize.toString(),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      file: { displayName: fileName }
    })
  });

  if (!initResponse.ok) {
    throw new Error('Failed to init Gemini upload');
  }

  const uploadUrl = initResponse.headers.get('X-Goog-Upload-URL');
  if (!uploadUrl) throw new Error('No upload URL');

  // 2. Upload obsahu
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'upload, finalize',
      'X-Goog-Upload-Offset': '0',
      'Content-Type': mimeType,
    },
    body: fileBytes
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload to Gemini');
  }

  const fileData = await uploadResponse.json();
  const fileUri = fileData.file.uri;
  const geminiFileName = fileData.file.name;

  // 3. Počkat na zpracování
  let state = fileData.file.state;
  let attempts = 0;
  while (state === 'PROCESSING' && attempts < 30) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
    
    const checkResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${geminiFileName}?key=${GEMINI_API_KEY}`);
    const checkData = await checkResponse.json();
    state = checkData.state;
    
    if (state === 'FAILED') throw new Error('File processing failed');
  }

  console.log('[PDF Extractor] File ready:', fileUri);
  return fileUri;
}

/**
 * Extrahuje text z PDF pomocí Gemini
 */
export async function extractTextFromPDF(fileUrl: string, fileName: string, mimeType: string): Promise<string> {
  console.log('[PDF Extractor] Starting extraction for:', fileName);
  
  try {
    // 1. Stáhnout soubor
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error('Failed to fetch file');
    
    const blob = await response.blob();
    
    // 2. Nahrát do Gemini
    const fileUri = await uploadToGemini(blob, fileName, mimeType);
    
    // 3. Zavolat Gemini pro extrakci textu
    console.log('[PDF Extractor] Calling Gemini for text extraction...');
    
    const extractResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            {
              file_data: {
                mime_type: mimeType,
                file_uri: fileUri
              }
            },
            {
              text: `Extrahuj veškerý text z tohoto dokumentu. Zachovej strukturu (nadpisy, odstavce, seznamy). 
Vrať POUZE extrahovaný text bez jakéhokoliv komentáře nebo formátování.
Pokud dokument obsahuje otázky s možnostmi odpovědí, zachovej je ve formátu:
- Otázka
  A) možnost
  B) možnost
  atd.`
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
        }
      }),
    });

    if (!extractResponse.ok) {
      const errorText = await extractResponse.text();
      console.error('[PDF Extractor] Gemini error:', errorText);
      throw new Error('Gemini extraction failed');
    }

    const data = await extractResponse.json();
    const extractedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    console.log('[PDF Extractor] Extracted', extractedText.length, 'characters');
    
    return extractedText;
    
  } catch (error) {
    console.error('[PDF Extractor] Error:', error);
    throw error;
  }
}

/**
 * Kontrola zda typ souboru podporuje extrakci textu
 */
export function supportsTextExtraction(mimeType: string | null): boolean {
  if (!mimeType) return false;
  
  return (
    mimeType === 'application/pdf' ||
    mimeType.includes('word') ||
    mimeType.includes('document') ||
    mimeType.includes('presentation') ||
    mimeType.includes('powerpoint')
  );
}

