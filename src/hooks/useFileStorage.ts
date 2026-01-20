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

  // Load files from Supabase
  const loadFiles = useCallback(async () => {
    console.log('[useFileStorage] loadFiles called');
    
    // Get user ID directly to avoid dependency issues
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;
    
    console.log('[useFileStorage] User ID for loading:', userId);
    
    if (!userId) {
      console.warn('[useFileStorage] No user logged in, cannot load files');
      setLoading(false);
      return;
    }
    
    try {
      console.log('[useFileStorage] Querying teacher_files for user:', userId);
      const { data, error } = await supabase
        .from('teacher_files')
        .select('*')
        .eq('teacher_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[useFileStorage] Error loading files from DB:', error);
        // Fallback to localStorage
        const localFiles = localStorage.getItem(`vivid-user-files-${userId}`);
        if (localFiles) {
          console.log('[useFileStorage] Loading from localStorage fallback');
          const parsed = JSON.parse(localFiles) as StoredFile[];
          setFiles(parsed);
          updateUsage(parsed);
        } else {
          console.log('[useFileStorage] No localStorage fallback available');
        }
        setLoading(false);
        return;
      }

      console.log('[useFileStorage] Query successful, got', data?.length || 0, 'files');

      const storedFiles: StoredFile[] = (data || []).map(row => ({
        id: row.id,
        userId: row.teacher_id,
        fileName: row.file_name,
        filePath: row.file_url, // file_url in DB, but we call it filePath in interface
        fileSize: row.file_size,
        mimeType: row.file_type, // file_type in DB, but we call it mimeType in interface
        createdAt: row.created_at,
        folderId: row.folder_id || null,
        extractedText: row.extracted_text || null,
        thumbnailUrl: row.thumbnail_url || null,
        slideCount: row.slide_count || null,
      }));

      console.log('[useFileStorage] Mapped files:', storedFiles);
      setFiles(storedFiles);
      updateUsage(storedFiles);
      
      // Also save to localStorage as backup
      try {
        localStorage.setItem(`vivid-user-files-${userId}`, JSON.stringify(storedFiles));
      } catch (e) {
        console.warn('[useFileStorage] Failed to save to localStorage (quota exceeded)', e);
      }
      console.log('[useFileStorage] Files loaded successfully');
    } catch (err) {
      console.error('[useFileStorage] Exception loading files:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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
  // Optional folderId parameter - if not provided, files from boards use media folder automatically
  const uploadFile = useCallback(async (file: File, options?: { folderId?: string | null }): Promise<UploadResult> => {
    console.log('[useFileStorage] uploadFile called for:', file.name, 'options:', options);
    
    // Get user ID directly
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;
    
    console.log('[useFileStorage] Got user ID:', userId);
    
    if (!userId) {
      console.error('[useFileStorage] No user ID, aborting upload');
      return { success: false, error: 'Musíte být přihlášeni' };
    }
    
    // Validate file type
    if (!isAllowedFileType(file.type)) {
      console.error('[useFileStorage] Invalid file type:', file.type);
      return { success: false, error: 'Nepodporovaný typ souboru' };
    }

    console.log('[useFileStorage] File type OK:', file.type);

    // Validate file size
    if (file.size > STORAGE_LIMITS.MAX_FILE_BYTES) {
      console.error('[useFileStorage] File too large:', file.size);
      return { success: false, error: `Soubor je příliš velký. Maximum je 30 MB.` };
    }

    console.log('[useFileStorage] File size OK:', file.size);

    // Check remaining space
    const remainingSpace = STORAGE_LIMITS.MAX_TOTAL_BYTES - usage.used;
    if (file.size > remainingSpace) {
      console.error('[useFileStorage] Not enough space:', { used: usage.used, needed: file.size, available: remainingSpace });
      return { success: false, error: 'Nedostatek místa v úložišti' };
    }

    console.log('[useFileStorage] Space check OK');

    setUploading(true);

    try {
      // Generate unique file path
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${userId}/${timestamp}_${safeName}`;

      console.log('[useFileStorage] Uploading to storage:', filePath);

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_LIMITS.STORAGE_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('[useFileStorage] Storage upload error:', uploadError);
        return { success: false, error: `Chyba při nahrávání: ${uploadError.message}` };
      }

      console.log('[useFileStorage] Storage upload successful');

      // Get public URL for the file
      const { data: publicUrlData } = supabase.storage
        .from(STORAGE_LIMITS.STORAGE_BUCKET)
        .getPublicUrl(filePath);
      
      const fileUrl = publicUrlData.publicUrl;
      console.log('[useFileStorage] Got public URL:', fileUrl);

      // Generate unique ID
      const fileId = `file-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
      console.log('[useFileStorage] Generated file ID:', fileId);

      // Determine folder ID - use provided or null (root)
      const folderId = options?.folderId ?? null;

      // Insert metadata into database
      console.log('[useFileStorage] Inserting into teacher_files with folderId:', folderId);
      const { data: insertData, error: insertError } = await supabase
        .from('teacher_files')
        .insert({
          id: fileId,
          teacher_id: userId,
          file_name: file.name,
          file_url: fileUrl,
          file_size: file.size,
          file_type: file.type,
          folder_id: folderId,
        })
        .select()
        .single();

      if (insertError) {
        console.error('[useFileStorage] Database insert error:', insertError);
        // File uploaded but metadata failed - still count as success
      } else {
        console.log('[useFileStorage] Database insert successful:', insertData);
      }

      const storedFile: StoredFile = {
        id: insertData?.id || fileId,
        userId,
        fileName: file.name,
        filePath: fileUrl,
        fileSize: file.size,
        mimeType: file.type,
        createdAt: insertData?.created_at || new Date().toISOString(),
        folderId: folderId,
        extractedText: null,
      };

      console.log('[useFileStorage] Created stored file object:', storedFile);

      const updatedFiles = [storedFile, ...files];
      setFiles(updatedFiles);
      updateUsage(updatedFiles);
      
      try {
        localStorage.setItem(`vivid-user-files-${userId}`, JSON.stringify(updatedFiles));
      } catch (e) {
        console.warn('[useFileStorage] Failed to update localStorage (quota exceeded)', e);
      }
      
      console.log('[useFileStorage] Updated local state');

      // Background text extraction for supported file types
      const recordId = insertData?.id || fileId;
      if (supportsTextExtraction(file.type)) {
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
                  .from('teacher_files')
                  .update({ 
                    extracted_text: extractedText,
                    thumbnail_url: pptxResult.thumbnail,
                    slide_count: pptxResult.slideCount
                  })
                  .eq('id', recordId);
                
                console.log('[FileStorage] PPTX extraction complete:', {
                  textLength: extractedText?.length || 0,
                  hasThumbnail: !!pptxResult.thumbnail,
                  slideCount: pptxResult.slideCount
                });
                
                // Update local state
                setFiles(prev => prev.map(f => 
                  f.id === recordId ? { 
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
                .from('teacher_files')
                .update({ extracted_text: extractedText })
                .eq('id', recordId);
            }
            // Pro PDF a ostatní - použijeme Gemini API
            else {
              // Get signed URL for the uploaded file (use filePath from storage)
              const { data: urlData } = await supabase.storage
                .from(STORAGE_LIMITS.STORAGE_BUCKET)
                .createSignedUrl(filePath, 3600);
              
              if (urlData?.signedUrl) {
                extractedText = await extractTextFromPDF(urlData.signedUrl, file.name, file.type);
              }
              
              if (extractedText) {
                // Update database with extracted text
                await supabase
                  .from('teacher_files')
                  .update({ extracted_text: extractedText })
                  .eq('id', recordId);
                
                console.log('[FileStorage] Text extraction complete, saved to DB');
                
                // Update local state
                setFiles(prev => prev.map(f => 
                  f.id === recordId ? { ...f, extractedText } : f
                ));
              }
            }
          } catch (err) {
            console.error('[FileStorage] Background extraction failed:', err);
          }
        })();
      }

      console.log('[useFileStorage] Upload complete, returning success');
      return { success: true, file: storedFile };
    } catch (err) {
      console.error('[useFileStorage] Upload exception:', err);
      return { success: false, error: 'Chyba při nahrávání souboru' };
    } finally {
      console.log('[useFileStorage] Setting uploading to false');
      setUploading(false);
    }
  }, [files, usage.used, updateUsage]);

  // Delete a file
  const deleteFile = useCallback(async (fileId: string): Promise<boolean> => {
    // Get user ID directly
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;
    
    if (!userId) return false;
    
    const fileToDelete = files.find(f => f.id === fileId);
    
    if (!fileToDelete) return false;

    try {
      // Extract storage path from file URL
      // URL format: https://.../storage/v1/object/public/teacher-files/{path}
      const urlParts = fileToDelete.filePath.split('/teacher-files/');
      const storagePath = urlParts[1];

      if (storagePath) {
        // Delete from Supabase Storage
        const { error: storageError } = await supabase.storage
          .from(STORAGE_LIMITS.STORAGE_BUCKET)
          .remove([storagePath]);

        if (storageError) {
          console.error('Storage delete error:', storageError);
        }
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('teacher_files')
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
  }, [files, updateUsage]);

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
    // Get user ID directly
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;
    
    if (!userId) return false;
    
    const fileToMove = files.find(f => f.id === fileId);
    
    if (!fileToMove) return false;

    try {
      // Update in database
      const { error: dbError } = await supabase
        .from('teacher_files')
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
  }, [files]);

  // Get files in root (not in any folder)
  const getRootFiles = useCallback(() => {
    return files.filter(f => !f.folderId);
  }, [files]);

  // Get files in a specific folder
  const getFilesInFolder = useCallback((folderId: string) => {
    const folderFiles = files.filter(f => f.folderId === folderId);
    console.log(`[useFileStorage] getFilesInFolder(${folderId}):`, folderFiles.length, 'files');
    return folderFiles;
  }, [files]);

  // Load files on mount
  useEffect(() => {
    loadFiles();
  }, [loadFiles]);
  
  // Listen for content-updated events
  useEffect(() => {
    const handleContentUpdated = () => {
      console.log('[useFileStorage] Content updated event received');
      loadFiles();
    };
    
    window.addEventListener('files-updated', handleContentUpdated);
    window.addEventListener('content-updated', handleContentUpdated);
    
    return () => {
      window.removeEventListener('files-updated', handleContentUpdated);
      window.removeEventListener('content-updated', handleContentUpdated);
    };
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

