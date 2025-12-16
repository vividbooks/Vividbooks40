import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase/client';
import { storage } from '../utils/profile-storage';
import { 
  StoredFile, 
  StorageUsage, 
  UploadResult, 
  STORAGE_LIMITS,
  isAllowedFileType 
} from '../types/file-storage';
import { extractTextFromPDF, supportsTextExtraction } from '../utils/pdf-text-extractor';
import { extractTextFromPPTX, isPPTX, isLegacyPPT, extractAllFromPPTX } from '../utils/pptx-text-extractor';

/**
 * Standalone function to get download URL for a file
 * Can be used outside of React components
 */
export async function getDownloadUrl(filePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_LIMITS.STORAGE_BUCKET)
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (error) {
      console.error('Error getting download URL:', error);
      return null;
    }

    return data.signedUrl;
  } catch (err) {
    console.error('Error getting download URL:', err);
    return null;
  }
}

/**
 * Hook for managing teacher file storage
 */
export function useFileStorage() {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [usage, setUsage] = useState<StorageUsage>({
    used: 0,
    total: STORAGE_LIMITS.MAX_TOTAL_BYTES,
    percentage: 0,
    fileCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Get current user ID
  const getUserId = useCallback(() => {
    const profile = storage.getCurrentUserProfile();
    return profile?.userId || profile?.id || 'anonymous';
  }, []);

  // Load files from Supabase
  const loadFiles = useCallback(async () => {
    const userId = getUserId();
    
    try {
      const { data, error } = await supabase
        .from('user_files')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading files:', error);
        // Fallback to localStorage
        const localFiles = localStorage.getItem(`vivid-user-files-${userId}`);
        if (localFiles) {
          const parsed = JSON.parse(localFiles) as StoredFile[];
          setFiles(parsed);
          updateUsage(parsed);
        }
        return;
      }

      const storedFiles: StoredFile[] = (data || []).map(row => ({
        id: row.id,
        userId: row.user_id,
        fileName: row.file_name,
        filePath: row.file_path,
        fileSize: row.file_size,
        mimeType: row.mime_type,
        createdAt: row.created_at,
        folderId: row.folder_id || null,
        extractedText: row.extracted_text || null,
      }));

      setFiles(storedFiles);
      updateUsage(storedFiles);
      
      // Also save to localStorage as backup
      localStorage.setItem(`vivid-user-files-${userId}`, JSON.stringify(storedFiles));
    } catch (err) {
      console.error('Error loading files:', err);
    } finally {
      setLoading(false);
    }
  }, [getUserId]);

  // Update usage statistics
  const updateUsage = useCallback((fileList: StoredFile[]) => {
    const used = fileList.reduce((sum, f) => sum + f.fileSize, 0);
    setUsage({
      used,
      total: STORAGE_LIMITS.MAX_TOTAL_BYTES,
      percentage: Math.round((used / STORAGE_LIMITS.MAX_TOTAL_BYTES) * 100),
      fileCount: fileList.length,
    });
  }, []);

  // Upload a file
  const uploadFile = useCallback(async (file: File): Promise<UploadResult> => {
    const userId = getUserId();
    
    // Validate file type
    if (!isAllowedFileType(file.type)) {
      return { success: false, error: 'Nepodporovaný typ souboru' };
    }

    // Validate file size
    if (file.size > STORAGE_LIMITS.MAX_FILE_BYTES) {
      return { success: false, error: `Soubor je příliš velký. Maximum je 30 MB.` };
    }

    // Check remaining space
    const remainingSpace = STORAGE_LIMITS.MAX_TOTAL_BYTES - usage.used;
    if (file.size > remainingSpace) {
      return { success: false, error: 'Nedostatek místa v úložišti' };
    }

    setUploading(true);

    try {
      // Generate unique file path
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${userId}/${timestamp}_${safeName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_LIMITS.STORAGE_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        // Return error instead of silent fallback
        return { success: false, error: `Chyba při nahrávání: ${uploadError.message}` };
      }

      // Insert metadata into database
      const { data: insertData, error: insertError } = await supabase
        .from('user_files')
        .insert({
          user_id: userId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Database insert error:', insertError);
        // File uploaded but metadata failed - still count as success
      }

      const storedFile: StoredFile = {
        id: insertData?.id || `local-${timestamp}`,
        userId,
        fileName: file.name,
        filePath: filePath,
        fileSize: file.size,
        mimeType: file.type,
        createdAt: insertData?.created_at || new Date().toISOString(),
        extractedText: null,
      };

      const updatedFiles = [storedFile, ...files];
      setFiles(updatedFiles);
      updateUsage(updatedFiles);
      localStorage.setItem(`vivid-user-files-${userId}`, JSON.stringify(updatedFiles));

      // Background text extraction for supported file types
      if (supportsTextExtraction(file.type) && insertData?.id) {
        console.log('[FileStorage] Starting background text extraction for:', file.name);
        
        // Run extraction in background (don't await)
        (async () => {
          try {
            let extractedText = '';
            
            // Pro PPTX soubory - extrahujeme text a thumbnail přímo z archivu
            if (isPPTX(file.type)) {
              console.log('[FileStorage] Using PPTX extractor for:', file.name);
              const pptxResult = await extractAllFromPPTX(file);
              extractedText = pptxResult.text;
              
              // Update database with extracted text AND thumbnail
              if (extractedText || pptxResult.thumbnail) {
                await supabase
                  .from('user_files')
                  .update({ 
                    extracted_text: extractedText,
                    thumbnail_url: pptxResult.thumbnail,
                    slide_count: pptxResult.slideCount
                  })
                  .eq('id', insertData.id);
                
                console.log('[FileStorage] PPTX extraction complete:', {
                  textLength: extractedText?.length || 0,
                  hasThumbnail: !!pptxResult.thumbnail,
                  slideCount: pptxResult.slideCount
                });
                
                // Update local state
                setFiles(prev => prev.map(f => 
                  f.id === insertData.id ? { 
                    ...f, 
                    extractedText,
                    thumbnailUrl: pptxResult.thumbnail,
                    slideCount: pptxResult.slideCount
                  } : f
                ));
              }
            } 
            // Pro starší PPT formát - není podporován (binární formát)
            else if (isLegacyPPT(file.type)) {
              console.warn('[FileStorage] Legacy PPT format not supported for text extraction:', file.name);
              extractedText = '[Starší formát PPT - pro extrakci textu použijte PPTX]';
              
              await supabase
                .from('user_files')
                .update({ extracted_text: extractedText })
                .eq('id', insertData.id);
            }
            // Pro PDF a ostatní - použijeme Gemini API
            else {
              // Get signed URL for the uploaded file
              const { data: urlData } = await supabase.storage
                .from(STORAGE_LIMITS.STORAGE_BUCKET)
                .createSignedUrl(filePath, 3600);
              
              if (urlData?.signedUrl) {
                extractedText = await extractTextFromPDF(urlData.signedUrl, file.name, file.type);
              }
              
              if (extractedText) {
                // Update database with extracted text
                await supabase
                  .from('user_files')
                  .update({ extracted_text: extractedText })
                  .eq('id', insertData.id);
                
                console.log('[FileStorage] Text extraction complete, saved to DB');
                
                // Update local state
                setFiles(prev => prev.map(f => 
                  f.id === insertData.id ? { ...f, extractedText } : f
                ));
              }
            }
          } catch (err) {
            console.error('[FileStorage] Background extraction failed:', err);
          }
        })();
      }

      return { success: true, file: storedFile };
    } catch (err) {
      console.error('Upload error:', err);
      return { success: false, error: 'Chyba při nahrávání souboru' };
    } finally {
      setUploading(false);
    }
  }, [getUserId, files, usage.used, updateUsage]);

  // Delete a file
  const deleteFile = useCallback(async (fileId: string): Promise<boolean> => {
    const userId = getUserId();
    const fileToDelete = files.find(f => f.id === fileId);
    
    if (!fileToDelete) return false;

    try {
      // Delete from Supabase Storage
      const { error: storageError } = await supabase.storage
        .from(STORAGE_LIMITS.STORAGE_BUCKET)
        .remove([fileToDelete.filePath]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('user_files')
        .delete()
        .eq('id', fileId);

      if (dbError) {
        console.error('Database delete error:', dbError);
      }

      // Update local state
      const updatedFiles = files.filter(f => f.id !== fileId);
      setFiles(updatedFiles);
      updateUsage(updatedFiles);
      localStorage.setItem(`vivid-user-files-${userId}`, JSON.stringify(updatedFiles));

      return true;
    } catch (err) {
      console.error('Delete error:', err);
      return false;
    }
  }, [getUserId, files, updateUsage]);

  // Get download URL for a file
  const getDownloadUrl = useCallback(async (filePath: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from(STORAGE_LIMITS.STORAGE_BUCKET)
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) {
        console.error('Error getting download URL:', error);
        return null;
      }

      return data.signedUrl;
    } catch (err) {
      console.error('Error getting download URL:', err);
      return null;
    }
  }, []);

  // Download a file
  const downloadFile = useCallback(async (file: StoredFile) => {
    const url = await getDownloadUrl(file.filePath);
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = file.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, [getDownloadUrl]);

  // Move file to folder
  const moveFileToFolder = useCallback(async (fileId: string, folderId: string | null): Promise<boolean> => {
    const userId = getUserId();
    const fileToMove = files.find(f => f.id === fileId);
    
    if (!fileToMove) return false;

    try {
      // Update in database
      const { error: dbError } = await supabase
        .from('user_files')
        .update({ folder_id: folderId })
        .eq('id', fileId);

      if (dbError) {
        console.error('Database update error:', dbError);
      }

      // Update local state
      const updatedFiles = files.map(f => 
        f.id === fileId ? { ...f, folderId } : f
      );
      setFiles(updatedFiles);
      localStorage.setItem(`vivid-user-files-${userId}`, JSON.stringify(updatedFiles));

      return true;
    } catch (err) {
      console.error('Move error:', err);
      return false;
    }
  }, [getUserId, files]);

  // Get files in root (not in any folder)
  const getRootFiles = useCallback(() => {
    return files.filter(f => !f.folderId);
  }, [files]);

  // Get files in a specific folder
  const getFilesInFolder = useCallback((folderId: string) => {
    return files.filter(f => f.folderId === folderId);
  }, [files]);

  // Load files on mount
  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  return {
    files,
    usage,
    loading,
    uploading,
    uploadFile,
    deleteFile,
    downloadFile,
    getDownloadUrl,
    moveFileToFolder,
    getRootFiles,
    getFilesInFolder,
    refresh: loadFiles,
  };
}

