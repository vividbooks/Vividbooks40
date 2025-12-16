/**
 * Extrakce textu z PowerPoint souborů (PPTX)
 * PPTX je ZIP archiv obsahující XML soubory s textem
 */

/**
 * Extrahuje text z PPTX souboru
 * PPTX struktura: ppt/slides/slide1.xml, slide2.xml, atd.
 */
export async function extractTextFromPPTX(fileBlob: Blob): Promise<string> {
  console.log('[PPTX Extractor] Starting extraction, size:', fileBlob.size);
  
  try {
    // Dynamicky importujeme JSZip (lazy load)
    const JSZip = (await import('jszip')).default;
    
    const zip = await JSZip.loadAsync(fileBlob);
    const texts: string[] = [];
    
    // Najít všechny slide soubory
    const slideFiles = Object.keys(zip.files)
      .filter(name => name.match(/ppt\/slides\/slide\d+\.xml$/))
      .sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)\.xml$/)?.[1] || '0');
        const numB = parseInt(b.match(/slide(\d+)\.xml$/)?.[1] || '0');
        return numA - numB;
      });
    
    console.log('[PPTX Extractor] Found slides:', slideFiles.length);
    
    for (const slideFile of slideFiles) {
      const slideXml = await zip.file(slideFile)?.async('string');
      if (slideXml) {
        const slideText = extractTextFromSlideXml(slideXml);
        if (slideText.trim()) {
          const slideNum = slideFile.match(/slide(\d+)\.xml$/)?.[1] || '?';
          texts.push(`--- Snímek ${slideNum} ---\n${slideText}`);
        }
      }
    }
    
    // Také extrahovat z notes (poznámky prezentujícího)
    const notesFiles = Object.keys(zip.files)
      .filter(name => name.match(/ppt\/notesSlides\/notesSlide\d+\.xml$/));
    
    if (notesFiles.length > 0) {
      texts.push('\n--- Poznámky prezentujícího ---');
      for (const notesFile of notesFiles) {
        const notesXml = await zip.file(notesFile)?.async('string');
        if (notesXml) {
          const notesText = extractTextFromSlideXml(notesXml);
          if (notesText.trim()) {
            texts.push(notesText);
          }
        }
      }
    }
    
    const result = texts.join('\n\n');
    console.log('[PPTX Extractor] Extracted', result.length, 'characters from', slideFiles.length, 'slides');
    
    return result;
    
  } catch (error) {
    console.error('[PPTX Extractor] Error:', error);
    throw new Error(`Nepodařilo se extrahovat text z prezentace: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extrahuje text z XML obsahu slajdu
 * Hledá <a:t> tagy které obsahují textový obsah
 */
function extractTextFromSlideXml(xml: string): string {
  const texts: string[] = [];
  
  // Regex pro <a:t>text</a:t> tagy (text content v PowerPoint XML)
  const textMatches = xml.matchAll(/<a:t>([^<]*)<\/a:t>/g);
  
  let currentParagraph: string[] = [];
  let lastIndex = 0;
  
  for (const match of textMatches) {
    const text = match[1];
    const index = match.index || 0;
    
    // Detekce nového odstavce (velká mezera v indexu nebo </a:p> tag)
    const between = xml.substring(lastIndex, index);
    if (between.includes('</a:p>') && currentParagraph.length > 0) {
      texts.push(currentParagraph.join(''));
      currentParagraph = [];
    }
    
    if (text.trim()) {
      currentParagraph.push(text);
    }
    
    lastIndex = index + match[0].length;
  }
  
  // Přidat poslední odstavec
  if (currentParagraph.length > 0) {
    texts.push(currentParagraph.join(''));
  }
  
  return texts.join('\n');
}

/**
 * Kontrola zda je soubor PPTX
 */
export function isPPTX(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
}

/**
 * Kontrola zda je soubor starší PPT formát
 */
export function isLegacyPPT(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return mimeType === 'application/vnd.ms-powerpoint';
}

/**
 * Kontrola zda je soubor PowerPoint (jakýkoliv formát)
 */
export function isPowerPoint(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return (
    mimeType.includes('presentation') ||
    mimeType.includes('powerpoint')
  );
}

/**
 * Extrahuje thumbnail (náhled) z PPTX souboru
 * PPTX obsahuje thumbnail v docProps/thumbnail.jpeg
 * Pokud není, použije první obrázek z prezentace jako fallback
 * Vrací base64 data URL nebo null
 */
export async function extractThumbnailFromPPTX(fileBlob: Blob): Promise<string | null> {
  console.log('[PPTX Thumbnail] Extracting thumbnail...');
  
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(fileBlob);
    
    // 1. Hledat embedded thumbnail - preferovaná možnost
    const thumbnailPaths = [
      'docProps/thumbnail.jpeg',
      'docProps/thumbnail.jpg', 
      'docProps/thumbnail.png',
      '_rels/thumbnail.jpeg',
      'docProps/thumbnail.emf', // Windows metafile - skip this
    ];
    
    for (const path of thumbnailPaths) {
      // Skip EMF files (can't display in browser)
      if (path.endsWith('.emf')) continue;
      
      const file = zip.file(path);
      if (file) {
        const data = await file.async('base64');
        const mimeType = path.endsWith('.png') ? 'image/png' : 'image/jpeg';
        console.log('[PPTX Thumbnail] Found embedded thumbnail at:', path);
        return `data:${mimeType};base64,${data}`;
      }
    }
    
    // 2. Fallback - použít první obrázek z prezentace
    console.log('[PPTX Thumbnail] No embedded thumbnail, looking for media images...');
    
    const mediaFiles = Object.keys(zip.files)
      .filter(name => name.startsWith('ppt/media/') && /\.(png|jpg|jpeg)$/i.test(name))
      .sort();
    
    if (mediaFiles.length > 0) {
      // Preferovat obrázky s "image" v názvu (často hlavní obrázky)
      const preferredImage = mediaFiles.find(f => f.toLowerCase().includes('image1')) || mediaFiles[0];
      const file = zip.file(preferredImage);
      
      if (file) {
        const data = await file.async('base64');
        const ext = preferredImage.split('.').pop()?.toLowerCase();
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        console.log('[PPTX Thumbnail] Using media image as thumbnail:', preferredImage);
        return `data:${mimeType};base64,${data}`;
      }
    }
    
    // 3. Poslední fallback - zkusit vygenerovat náhled z textu prvního snímku
    // (toto by vyžadovalo Canvas API a je komplexní, pro teď přeskočíme)
    
    console.log('[PPTX Thumbnail] No thumbnail or images found');
    return null;
    
  } catch (error) {
    console.error('[PPTX Thumbnail] Error:', error);
    return null;
  }
}

/**
 * Extrahuje náhledy všech snímků z PPTX
 * Vrací pole base64 obrázků
 */
export async function extractSlideImagesFromPPTX(fileBlob: Blob): Promise<string[]> {
  console.log('[PPTX Slides] Extracting slide images...');
  
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(fileBlob);
    
    const images: string[] = [];
    
    // Najít všechny obrázky ve složce ppt/media/
    const mediaFiles = Object.keys(zip.files)
      .filter(name => name.startsWith('ppt/media/') && /\.(png|jpg|jpeg|gif)$/i.test(name))
      .sort();
    
    console.log('[PPTX Slides] Found media files:', mediaFiles.length);
    
    // Extrahovat první 3 obrázky jako náhledy
    for (const mediaFile of mediaFiles.slice(0, 3)) {
      const file = zip.file(mediaFile);
      if (file) {
        const data = await file.async('base64');
        const ext = mediaFile.split('.').pop()?.toLowerCase();
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        images.push(`data:${mimeType};base64,${data}`);
      }
    }
    
    return images;
    
  } catch (error) {
    console.error('[PPTX Slides] Error:', error);
    return [];
  }
}

export interface PPTXExtractResult {
  text: string;
  thumbnail: string | null;
  slideCount: number;
  slideImages: string[];
}

/**
 * Kompletní extrakce z PPTX - text, thumbnail, počet snímků
 */
export async function extractAllFromPPTX(fileBlob: Blob): Promise<PPTXExtractResult> {
  console.log('[PPTX Extract] Starting full extraction...');
  
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(fileBlob);
    
    // Počet snímků
    const slideFiles = Object.keys(zip.files)
      .filter(name => name.match(/ppt\/slides\/slide\d+\.xml$/));
    
    // Extrahovat text
    const text = await extractTextFromPPTX(fileBlob);
    
    // Extrahovat thumbnail
    const thumbnail = await extractThumbnailFromPPTX(fileBlob);
    
    // Extrahovat obrázky ze snímků
    const slideImages = await extractSlideImagesFromPPTX(fileBlob);
    
    console.log('[PPTX Extract] Complete:', {
      textLength: text.length,
      hasThumbnail: !!thumbnail,
      slideCount: slideFiles.length,
      imageCount: slideImages.length
    });
    
    return {
      text,
      thumbnail,
      slideCount: slideFiles.length,
      slideImages
    };
    
  } catch (error) {
    console.error('[PPTX Extract] Error:', error);
    return {
      text: '',
      thumbnail: null,
      slideCount: 0,
      slideImages: []
    };
  }
}

