import React, { useState } from 'react';
import { Upload, CheckCircle, XCircle, Loader2, FileText, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { findAllPDFs, bulkUploadPDFsToRAG, PDFDocument, UploadProgress } from '../../utils/rag-bulk-upload';
import { toast } from 'sonner';

export function RAGBulkUpload() {
  const [pdfs, setPdfs] = useState<PDFDocument[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  const handleScan = async () => {
    setIsScanning(true);
    try {
      console.log('[RAG UI] Starting scan...');
      const foundPDFs = await findAllPDFs();
      setPdfs(foundPDFs);
      toast.success(`Nalezeno ${foundPDFs.length} PDF souborů`);
    } catch (error) {
      console.error('[RAG UI] Scan error:', error);
      toast.error('Nepodařilo se načíst PDF soubory');
    } finally {
      setIsScanning(false);
    }
  };

  const handleUpload = async () => {
    if (pdfs.length === 0) {
      toast.error('Nejdřív naskenujte PDF soubory');
      return;
    }

    setIsUploading(true);
    try {
      console.log('[RAG UI] Starting upload...');
      const finalProgress = await bulkUploadPDFsToRAG(pdfs, (p) => {
        setProgress(p);
      });
      
      if (finalProgress.failed === 0) {
        toast.success(`Všech ${finalProgress.succeeded} souborů nahráno!`);
      } else {
        toast.warning(`Nahráno ${finalProgress.succeeded}, selhalo ${finalProgress.failed}`);
      }
    } catch (error) {
      console.error('[RAG UI] Upload error:', error);
      toast.error('Chyba při nahrávání');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-2">
          <Upload className="w-8 h-8" />
          <h1 className="text-2xl font-bold">RAG - Hromadné nahrání PDF</h1>
        </div>
        <p className="text-indigo-100">
          Nahraje všechny PDF materiály do AI systému pro lepší odpovědi
        </p>
      </div>

      {/* Actions */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex gap-4">
          <Button
            onClick={handleScan}
            disabled={isScanning || isUploading}
            className="flex-1 h-14 text-lg"
            variant="outline"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Skenování...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5 mr-2" />
                1. Najít všechny PDF
              </>
            )}
          </Button>

          <Button
            onClick={handleUpload}
            disabled={pdfs.length === 0 || isUploading}
            className="flex-1 h-14 text-lg bg-indigo-600 hover:bg-indigo-700"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Nahrávání...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 mr-2" />
                2. Nahrát do AI ({pdfs.length})
              </>
            )}
          </Button>
        </div>

        {pdfs.length > 0 && !isUploading && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900 dark:text-blue-100">
                <p className="font-semibold mb-1">Nalezeno {pdfs.length} PDF souborů</p>
                <p className="text-blue-700 dark:text-blue-300">
                  Nahrání může trvat několik minut. Gemini AI zpracuje každý soubor a extrahuje text pro vyhledávání.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Progress */}
      {progress && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Průběh nahrávání</h3>
            <span className="text-sm text-muted-foreground">
              {progress.processed} / {progress.total}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
              style={{
                width: `${(progress.processed / progress.total) * 100}%`
              }}
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              <div>
                <div className="text-xs text-muted-foreground">Úspěšné</div>
                <div className="text-xl font-bold text-green-700 dark:text-green-300">
                  {progress.succeeded}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <div>
                <div className="text-xs text-muted-foreground">Selhalo</div>
                <div className="text-xl font-bold text-red-700 dark:text-red-300">
                  {progress.failed}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
              <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
              <div>
                <div className="text-xs text-muted-foreground">Zpracovává se</div>
                <div className="text-sm font-medium text-blue-700 dark:text-blue-300 truncate">
                  {progress.current || '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Errors */}
          {progress.errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h4 className="font-semibold text-red-900 dark:text-red-100 mb-2">
                Chyby ({progress.errors.length})
              </h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {progress.errors.map((err, i) => (
                  <div key={i} className="text-sm text-red-700 dark:text-red-300">
                    • {err.title}: {err.error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Complete message */}
          {progress.isComplete && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                <div>
                  <p className="font-semibold text-green-900 dark:text-green-100">
                    Hotovo!
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    AI asistent nyní může odpovídat na otázky o nahraných materiálech.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PDF List */}
      {pdfs.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-lg mb-4">Nalezené PDF soubory</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {pdfs.map((pdf, i) => (
              <div
                key={pdf.id}
                className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
              >
                <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{pdf.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {pdf.path}
                  </div>
                </div>
                <div className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded">
                  {pdf.category}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}





