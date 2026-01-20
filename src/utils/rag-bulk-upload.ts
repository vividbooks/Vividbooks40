/**
 * Hromadné nahrávání PDF materiálů do RAG
 */

import { uploadPDFToRAG } from './gemini-rag';
import { publicAnonKey } from './supabase/info';

export interface PDFDocument {
  id: string;
  title: string;
  url: string;
  subject: string;
  category: string;
  path: string; // Cesta v menu stromu
}

export interface UploadProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  current: string | null;
  isComplete: boolean;
  errors: Array<{ title: string; error: string }>;
}

/**
 * Projít menu a najít všechny PDF soubory
 */
export async function findAllPDFs(categories: string[] = [
  'knihovna-vividbooks', // Hlavní knihovna
  'matematika', 
  'fyzika', 
  'prvouky', 
  'prirodopis', 
  'chemie'
]): Promise<PDFDocument[]> {
  console.log('[RAG Bulk] === FINDING ALL PDFs ===');
  const allPDFs: PDFDocument[] = [];

  for (const category of categories) {
    try {
      console.log(`[RAG Bulk] Loading menu for: ${category}`);
      const response = await fetch(
        `https://njbtqmsxbyvpwigfceke.supabase.co/functions/v1/make-server-46c8107b/menu?category=${category}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (!response.ok) {
        console.error(`[RAG Bulk] ✗ Failed to load ${category}:`, response.status);
        continue;
      }

      const data = await response.json();
      const menu = data.menu || [];
      
      console.log(`[RAG Bulk] ✓ Loaded ${category}:`, menu.length, 'items');
      
      // Debug: Ukázat první 3 položky pro analýzu
      if (menu.length > 0) {
        console.log(`[RAG Bulk]   First item example:`, {
          label: menu[0].label,
          type: menu[0].type,
          hasUrl: !!menu[0].url,
          hasExternalUrl: !!menu[0].externalUrl,
          hasPdfUrl: !!menu[0].pdfUrl,
          hasExtended: !!menu[0].extendedWorksheet,
          hasChildren: !!menu[0].children
        });
      }

      // Rekurzivně projít menu a najít PDFs
      const findPDFsRecursive = (items: any[], path: string[] = []): void => {
        for (const item of items) {
          const currentPath = [...path, item.label];
          
          // Funkce pro kontrolu, jestli URL obsahuje PDF
          const isPdfUrl = (url: string | undefined): boolean => {
            if (!url) return false;
            return url.includes('.pdf') || url.includes('supabase.co/storage');
          };
          
          // Zkontrolovat VŠECHNA možná pole, kde může být PDF
          const possibleUrls: Array<{ url: string; source: string }> = [];
          
          // Různá pole, kde může být uloženo PDF:
          if (item.url) possibleUrls.push({ url: item.url, source: 'url' });
          if (item.externalUrl) possibleUrls.push({ url: item.externalUrl, source: 'externalUrl' });
          if (item.pdfUrl) possibleUrls.push({ url: item.pdfUrl, source: 'pdfUrl' });
          
          // Pokud má item extendedWorksheet, zkontrolovat i tam
          if (item.extendedWorksheet) {
            const ext = item.extendedWorksheet;
            if (ext.interactiveUrl) possibleUrls.push({ url: ext.interactiveUrl, source: 'extendedWorksheet.interactiveUrl' });
            if (ext.exercises) {
              ext.exercises.forEach((ex: any, i: number) => {
                if (ex.url) possibleUrls.push({ url: ex.url, source: `exercises[${i}]` });
              });
            }
            if (ext.tests) {
              ext.tests.forEach((test: any, i: number) => {
                if (test.url) possibleUrls.push({ url: test.url, source: `tests[${i}]` });
              });
            }
            if (ext.exams) {
              ext.exams.forEach((exam: any, i: number) => {
                if (exam.url) possibleUrls.push({ url: exam.url, source: `exams[${i}]` });
              });
            }
            if (ext.interactiveWorksheets) {
              ext.interactiveWorksheets.forEach((iw: any, i: number) => {
                if (iw.url) possibleUrls.push({ url: iw.url, source: `interactiveWorksheets[${i}]` });
              });
            }
          }
          
          // Najít všechny PDF URL
          for (const { url, source } of possibleUrls) {
            if (isPdfUrl(url)) {
              allPDFs.push({
                id: `${item.id}-${source}`,
                title: `${item.label} (${source})`,
                url: url,
                subject: category,
                category,
                path: currentPath.join(' > ')
              });
              console.log(`[RAG Bulk]   ✓ Found PDF: ${item.label} [${source}]`);
            }
          }

          // Rekurzivně projít děti
          if (item.children && item.children.length > 0) {
            findPDFsRecursive(item.children, currentPath);
          }
        }
      };

      findPDFsRecursive(menu);
    } catch (err) {
      console.error(`[RAG Bulk] Error loading ${category}:`, err);
    }
  }

  console.log(`[RAG Bulk] ✓ Total PDFs found: ${allPDFs.length}`);
  return allPDFs;
}

/**
 * Nahrát všechny PDF do RAG s progress tracking
 */
export async function bulkUploadPDFsToRAG(
  pdfs: PDFDocument[],
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadProgress> {
  console.log('[RAG Bulk] === STARTING BULK UPLOAD ===');
  console.log('[RAG Bulk] Total files to upload:', pdfs.length);

  const progress: UploadProgress = {
    total: pdfs.length,
    processed: 0,
    succeeded: 0,
    failed: 0,
    current: null,
    isComplete: false,
    errors: []
  };

  // Notify initial state
  onProgress?.(progress);

  for (const pdf of pdfs) {
    progress.current = pdf.title;
    onProgress?.(progress);

    console.log(`[RAG Bulk] [${progress.processed + 1}/${progress.total}] Uploading: ${pdf.title}`);

    try {
      const result = await uploadPDFToRAG({
        pdfUrl: pdf.url,
        title: pdf.title,
        subject: pdf.subject,
        documentId: pdf.id
      });

      if (result.success) {
        progress.succeeded++;
        console.log(`[RAG Bulk] ✓ Success: ${pdf.title}`);
      } else {
        progress.failed++;
        progress.errors.push({
          title: pdf.title,
          error: result.error || 'Unknown error'
        });
        console.error(`[RAG Bulk] ✗ Failed: ${pdf.title}`, result.error);
      }
    } catch (error) {
      progress.failed++;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      progress.errors.push({
        title: pdf.title,
        error: errorMsg
      });
      console.error(`[RAG Bulk] ✗ Exception: ${pdf.title}`, error);
    }

    progress.processed++;
    onProgress?.(progress);

    // Malá pauza mezi uploady, aby nedošlo k rate limitingu
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  progress.current = null;
  progress.isComplete = true;
  onProgress?.(progress);

  console.log('[RAG Bulk] === UPLOAD COMPLETE ===');
  console.log('[RAG Bulk] Succeeded:', progress.succeeded);
  console.log('[RAG Bulk] Failed:', progress.failed);

  return progress;
}

