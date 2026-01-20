import React, { useState, useRef, useCallback } from 'react';
import { 
  Upload, 
  FileText, 
  Image, 
  Video, 
  Music, 
  Archive, 
  Presentation,
  Table,
  File,
  Download,
  Trash2,
  X,
  HardDrive,
  AlertCircle
} from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { useFileStorage } from '../hooks/useFileStorage';
import { 
  formatFileSize, 
  getFileTypeInfo, 
  STORAGE_LIMITS,
  StoredFile 
} from '../types/file-storage';
import { toast } from 'sonner';

// Get icon component based on file type
const getFileIcon = (mimeType: string | null) => {
  if (!mimeType) return File;
  
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('video/')) return Video;
  if (mimeType.startsWith('audio/')) return Music;
  if (mimeType.includes('pdf')) return FileText;
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return Presentation;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return Table;
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return Archive;
  if (mimeType.includes('word') || mimeType.includes('document')) return FileText;
  
  return File;
};

// Get color for file type
const getFileColor = (mimeType: string | null): string => {
  if (!mimeType) return '#64748b';
  
  if (mimeType.startsWith('image/')) return '#10b981';
  if (mimeType.startsWith('video/')) return '#8b5cf6';
  if (mimeType.startsWith('audio/')) return '#f59e0b';
  if (mimeType.includes('pdf')) return '#ef4444';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '#f97316';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '#22c55e';
  if (mimeType.includes('word') || mimeType.includes('document')) return '#3b82f6';
  
  return '#64748b';
};

interface FileUploadSectionProps {
  className?: string;
}

export function FileUploadSection({ className = '' }: FileUploadSectionProps) {
  const { 
    files, 
    usage, 
    loading, 
    uploading, 
    uploadFile, 
    deleteFile, 
    downloadFile 
  } = useFileStorage();
  
  const [isDragOver, setIsDragOver] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<StoredFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = useCallback(async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const result = await uploadFile(file);
      
      if (result.success) {
        toast.success(`Soubor "${file.name}" byl nahrán`);
      } else {
        toast.error(result.error || 'Chyba při nahrávání');
      }
    }
  }, [uploadFile]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  // Delete confirmation
  const handleDeleteClick = useCallback((file: StoredFile) => {
    setFileToDelete(file);
    setDeleteConfirmOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!fileToDelete) return;
    
    const success = await deleteFile(fileToDelete.id);
    if (success) {
      toast.success(`Soubor "${fileToDelete.fileName}" byl smazán`);
    } else {
      toast.error('Chyba při mazání souboru');
    }
    
    setDeleteConfirmOpen(false);
    setFileToDelete(null);
  }, [fileToDelete, deleteFile]);

  // Usage bar color
  const getUsageColor = () => {
    if (usage.percentage >= 90) return '#ef4444';
    if (usage.percentage >= 70) return '#f59e0b';
    return '#3b82f6';
  };

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[#4E5871] flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Úložiště souborů
        </h2>
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || usage.percentage >= 100}
          className="gap-2 bg-[#4E5871] hover:bg-[#3d455a]"
        >
          <Upload className="h-4 w-4" />
          {uploading ? 'Nahrávám...' : 'Nahrát soubor'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
      </div>

      {/* Usage Bar */}
      <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-600">
            Využito: {formatFileSize(usage.used)} / {formatFileSize(usage.total)}
          </span>
          <span className="text-sm font-medium" style={{ color: getUsageColor() }}>
            {usage.percentage}%
          </span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className="h-full rounded-full transition-all duration-300"
            style={{ 
              width: `${Math.min(usage.percentage, 100)}%`,
              backgroundColor: getUsageColor()
            }}
          />
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Limit: {formatFileSize(STORAGE_LIMITS.MAX_FILE_BYTES)} na soubor
        </p>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          mb-6 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all
          ${isDragOver 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
          }
        `}
      >
        <div className="flex flex-col items-center text-center">
          <Upload className={`h-10 w-10 mb-3 ${isDragOver ? 'text-blue-500' : 'text-slate-400'}`} />
          <p className="text-sm font-medium text-slate-600 mb-1">
            {isDragOver ? 'Pusťte soubory zde' : 'Přetáhněte soubory sem'}
          </p>
          <p className="text-xs text-slate-400">
            nebo klikněte pro výběr • PDF, Word, Excel, PowerPoint, obrázky, videa
          </p>
        </div>
      </div>

      {/* Files Grid */}
      {loading ? (
        <div className="text-center py-8 text-slate-400">
          Načítám soubory...
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-xl bg-slate-50">
          <File className="h-12 w-12 mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500 font-medium">Zatím nemáte žádné soubory</p>
          <p className="text-sm text-slate-400 mt-1">
            Nahrajte svůj první soubor
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {files.map((file) => {
            const FileIcon = getFileIcon(file.mimeType);
            const fileColor = getFileColor(file.mimeType);
            const typeInfo = getFileTypeInfo(file.mimeType || '');
            
            return (
              <div
                key={file.id}
                className="group relative flex flex-col items-center p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all"
              >
                {/* File Icon */}
                <div 
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-3"
                  style={{ backgroundColor: `${fileColor}15` }}
                >
                  <FileIcon className="h-7 w-7" style={{ color: fileColor }} />
                </div>
                
                {/* File Name */}
                <p className="text-sm font-medium text-slate-700 text-center truncate w-full" title={file.fileName}>
                  {file.fileName}
                </p>
                
                {/* File Info */}
                <p className="text-xs text-slate-400 mt-1">
                  {formatFileSize(file.fileSize)}
                </p>
                
                {/* Actions Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/90 border border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100">
                      <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="6" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="12" cy="18" r="2" />
                      </svg>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => downloadFile(file)}>
                      <Download className="h-4 w-4 mr-2" />
                      Stáhnout
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDeleteClick(file)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Smazat
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                {/* Type Badge */}
                <span 
                  className="absolute top-2 left-2 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                  style={{ 
                    backgroundColor: `${fileColor}20`,
                    color: fileColor
                  }}
                >
                  {typeInfo.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Smazat soubor
            </DialogTitle>
            <DialogDescription>
              Opravdu chcete smazat soubor "{fileToDelete?.fileName}"? Tuto akci nelze vrátit zpět.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
            >
              Zrušit
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              Smazat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}








