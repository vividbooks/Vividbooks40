/**
 * PDF Export pomocí html2pdf.js
 * 
 * Převádí HTML element přímo na PDF s plnou podporou českých znaků
 */

import html2pdf from 'html2pdf.js';

interface ExportOptions {
  filename?: string;
  format?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
  margin?: number;
  timeout?: number;
}

/**
 * Helper pro timeout promise
 */
function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(errorMsg)), ms)
    )
  ]);
}

/**
 * Exportuje HTML element do PDF a stáhne soubor
 */
export async function exportToPDF(
  element: HTMLElement,
  options: ExportOptions = {}
): Promise<void> {
  const {
    filename = 'pracovni-list.pdf',
    format = 'a4',
    orientation = 'portrait',
    margin = 10,
    timeout = 30000 // 30 sekund timeout
  } = options;

  const opt = {
    margin,
    filename,
    image: { type: 'jpeg', quality: 0.92 },
    html2canvas: { 
      scale: 1.5, // Sníženo z 2 pro rychlejší export
      useCORS: true,
      letterRendering: true,
      scrollY: 0,
      logging: false,
      allowTaint: true,
      removeContainer: true,
    },
    jsPDF: { 
      unit: 'mm', 
      format, 
      orientation 
    },
    pagebreak: { 
      mode: ['avoid-all', 'css', 'legacy'],
      before: '.page-break-before',
      after: '.page-break-after',
      avoid: '.no-break'
    }
  };

  const exportPromise = html2pdf().set(opt).from(element).save();
  
  await withTimeout(
    exportPromise, 
    timeout, 
    'Export PDF trval příliš dlouho. Zkuste zmenšit obsah nebo použijte tisk prohlížeče (Ctrl+P).'
  );
}

/**
 * Exportuje HTML element do PDF blobu
 */
export async function exportToPDFBlob(
  element: HTMLElement,
  options: ExportOptions = {}
): Promise<Blob> {
  const {
    format = 'a4',
    orientation = 'portrait',
    margin = 10,
    timeout = 30000
  } = options;

  const opt = {
    margin,
    image: { type: 'jpeg', quality: 0.92 },
    html2canvas: { 
      scale: 1.5,
      useCORS: true,
      letterRendering: true,
      logging: false,
      allowTaint: true,
      removeContainer: true,
    },
    jsPDF: { 
      unit: 'mm', 
      format, 
      orientation 
    },
    pagebreak: { 
      mode: ['avoid-all', 'css', 'legacy'],
      avoid: '.no-break'
    }
  };

  const exportPromise = html2pdf().set(opt).from(element).outputPdf('blob');
  
  return await withTimeout(
    exportPromise,
    timeout,
    'Export PDF trval příliš dlouho.'
  );
}

/**
 * Exportuje worksheet jako JSON soubor
 */
export function exportToJSON(worksheet: any): void {
  const json = JSON.stringify(worksheet, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const fileName = (worksheet.title || 'pracovni-list')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Otevře tiskový dialog prohlížeče
 */
export function printWorksheet(): void {
  window.print();
}


