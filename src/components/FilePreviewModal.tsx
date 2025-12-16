/**
 * FilePreviewModal - Modal for file preview with actions
 */

import { useState } from 'react';
import { X, Download, FileEdit, Play, Sparkles, FileText, Image, Video, Music, Archive, Table, Presentation, File } from 'lucide-react';
import { Button } from './ui/button';
import { StoredFile, getFileTypeInfo } from '../types/file-storage';

interface FilePreviewModalProps {
  file: StoredFile;
  fileUrl: string | null;
  onClose: () => void;
  onDownload: () => void;
  onCreateWorksheet: (file: StoredFile) => void;
  onCreateQuiz: (file: StoredFile) => void;
}

/**
 * Check if a file can be previewed in the modal
 */
export function canPreviewFile(mimeType: string | null): boolean {
  if (!mimeType) return false;
  
  // Images
  if (mimeType.startsWith('image/')) return true;
  
  // PDFs
  if (mimeType === 'application/pdf') return true;
  
  // Videos
  if (mimeType.startsWith('video/')) return true;
  
  // Audio
  if (mimeType.startsWith('audio/')) return true;
  
  return false;
}

/**
 * Get file icon based on mime type
 */
function getFileIcon(mimeType: string | null) {
  if (!mimeType) return File;
  
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('video/')) return Video;
  if (mimeType.startsWith('audio/')) return Music;
  if (mimeType === 'application/pdf') return FileText;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return Table;
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return Presentation;
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return Archive;
  
  return FileText;
}

/**
 * Get file color based on mime type
 */
function getFileColor(mimeType: string | null): { bg: string; text: string } {
  if (!mimeType) return { bg: 'bg-slate-100', text: 'text-slate-500' };
  
  if (mimeType.startsWith('image/')) return { bg: 'bg-purple-100', text: 'text-purple-600' };
  if (mimeType.startsWith('video/')) return { bg: 'bg-pink-100', text: 'text-pink-600' };
  if (mimeType.startsWith('audio/')) return { bg: 'bg-orange-100', text: 'text-orange-600' };
  if (mimeType === 'application/pdf') return { bg: 'bg-red-100', text: 'text-red-600' };
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return { bg: 'bg-green-100', text: 'text-green-600' };
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return { bg: 'bg-amber-100', text: 'text-amber-600' };
  if (mimeType.includes('word')) return { bg: 'bg-blue-100', text: 'text-blue-600' };
  
  return { bg: 'bg-slate-100', text: 'text-slate-500' };
}

export function FilePreviewModal({ 
  file, 
  fileUrl, 
  onClose, 
  onDownload, 
  onCreateWorksheet, 
  onCreateQuiz 
}: FilePreviewModalProps) {
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  
  const FileIcon = getFileIcon(file.mimeType);
  const fileColor = getFileColor(file.mimeType);
  const typeInfo = getFileTypeInfo(file.mimeType || '');
  
  const isImage = file.mimeType?.startsWith('image/');
  const isPdf = file.mimeType === 'application/pdf';
  const isVideo = file.mimeType?.startsWith('video/');
  const isAudio = file.mimeType?.startsWith('audio/');
  const canPreview = canPreviewFile(file.mimeType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal - fixed size 1000x700 */}
      <div className="relative bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ width: '1000px', height: '700px' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-lg ${fileColor.bg}`}>
              <FileIcon className={`h-5 w-5 ${fileColor.text}`} />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-slate-800 truncate">{file.fileName}</h2>
              <p className="text-sm text-slate-500 truncate">{typeInfo.label}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Actions Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsActionsOpen(!isActionsOpen)}
                style={{ 
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                }}
                className="px-4 py-2 rounded-lg text-white font-medium text-sm flex items-center gap-2 hover:opacity-90 transition-opacity shadow-md"
              >
                <Sparkles className="h-4 w-4" />
                Akce – vytvořit
              </button>

              {isActionsOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                  <button
                    onClick={() => {
                      setIsActionsOpen(false);
                      onCreateWorksheet(file);
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center gap-3"
                  >
                    <FileEdit className="h-4 w-4 text-amber-500" />
                    <div>
                      <p className="font-medium text-slate-700">Pracovní list</p>
                      <p className="text-xs text-slate-500">Vytvořit cvičení z obsahu</p>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setIsActionsOpen(false);
                      onCreateQuiz(file);
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center gap-3"
                  >
                    <Play className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="font-medium text-slate-700">Kvíz</p>
                      <p className="text-xs text-slate-500">Interaktivní test pro žáky</p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Download */}
            <Button
              variant="outline"
              size="sm"
              onClick={onDownload}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Stáhnout
            </Button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-slate-100 relative min-h-0 flex items-center justify-center p-4 overflow-auto">
          {/* Image Preview */}
          {isImage && fileUrl && (
            <img
              src={fileUrl}
              alt={file.fileName}
              className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
            />
          )}

          {/* PDF Preview */}
          {isPdf && fileUrl && (
            <iframe
              src={fileUrl}
              className="w-full h-full rounded-lg shadow-lg bg-white"
              title={file.fileName}
            />
          )}

          {/* Video Preview */}
          {isVideo && fileUrl && (
            <video
              src={fileUrl}
              controls
              className="max-w-full max-h-full rounded-lg shadow-lg"
            >
              Your browser does not support the video tag.
            </video>
          )}

          {/* Audio Preview */}
          {isAudio && fileUrl && (
            <div className="flex flex-col items-center gap-6">
              <div className={`p-12 rounded-2xl ${fileColor.bg}`}>
                <Music className={`h-24 w-24 ${fileColor.text}`} />
              </div>
              <h3 className="text-xl font-semibold text-slate-700">{file.fileName}</h3>
              <audio
                src={fileUrl}
                controls
                className="w-96"
              >
                Your browser does not support the audio tag.
              </audio>
            </div>
          )}

          {/* Fallback for non-previewable files */}
          {!canPreview && (
            <div className="text-center">
              <div className={`p-8 rounded-2xl ${fileColor.bg} mb-6 inline-block`}>
                <FileIcon className={`h-16 w-16 ${fileColor.text}`} />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">{file.fileName}</h3>
              <p className="text-slate-500 mb-4">{typeInfo.label}</p>
              <Button onClick={onDownload} className="gap-2">
                <Download className="h-4 w-4" />
                Stáhnout soubor
              </Button>
            </div>
          )}

          {/* No URL available */}
          {canPreview && !fileUrl && (
            <div className="text-center">
              <div className={`p-8 rounded-2xl bg-slate-200 mb-6 inline-block`}>
                <FileIcon className="h-16 w-16 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">Náhled není dostupný</h3>
              <p className="text-slate-500 mb-4">Soubor nelze zobrazit, ale můžete jej stáhnout.</p>
              <Button onClick={onDownload} className="gap-2">
                <Download className="h-4 w-4" />
                Stáhnout soubor
              </Button>
            </div>
          )}
        </div>

        {/* Footer with extracted text info */}
        {file.extractedText && (
          <div className="border-t border-slate-200 bg-white shrink-0 px-4 py-3">
            <div className="flex items-center gap-2 text-green-600">
              <Sparkles className="h-4 w-4" />
              <span className="font-medium text-sm">Text extrahován a připraven pro AI</span>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                ✓ Uloženo
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
