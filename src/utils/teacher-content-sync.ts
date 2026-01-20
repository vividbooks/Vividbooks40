/**
 * Teacher Content Sync
 * 
 * Synchronizes teacher's worksheets, quizzes, and folders to Supabase
 * so students can access shared folder contents in real-time.
 */

const PROJECT_ID = 'njbtqmsxbyvpwigfceke';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';

export interface TeacherContentItem {
  id: string;
  teacher_id: string;
  name: string;
  type: 'document' | 'board' | 'folder';
  folder_id?: string;
  content_data?: any;
  color?: string;
  created_at: string;
  updated_at: string;
}

export interface SharedFolder {
  id: string;
  class_id: string;
  teacher_id: string;
  folder_id: string;
  folder_name: string;
  created_at: string;
}

// ============================================
// Sync teacher content to cloud
// ============================================

/**
 * Sync a single worksheet to cloud
 */
export async function syncWorksheetToCloud(teacherId: string, worksheet: {
  id: string;
  title: string;
  folderId?: string;
  blocks?: any[];
  content?: string;
  createdAt?: string;
  updatedAt?: string;
}): Promise<void> {
  console.log('[TeacherSync] Syncing worksheet:', worksheet.id, worksheet.title);
  
  const item: TeacherContentItem = {
    id: worksheet.id,
    teacher_id: teacherId,
    name: worksheet.title,
    type: 'document',
    folder_id: worksheet.folderId || undefined,
    content_data: { 
      blocks: worksheet.blocks || [],
      content: worksheet.content || '',
    },
    created_at: worksheet.createdAt || new Date().toISOString(),
    updated_at: worksheet.updatedAt || new Date().toISOString(),
  };
  
  await upsertTeacherContent(item);
}

/**
 * Sync a single quiz/board to cloud
 */
export async function syncQuizToCloud(teacherId: string, quiz: {
  id: string;
  title: string;
  folderId?: string;
  slides?: any[];
  createdAt?: string;
  updatedAt?: string;
}): Promise<void> {
  console.log('[TeacherSync] Syncing quiz:', quiz.id, quiz.title);
  
  const item: TeacherContentItem = {
    id: quiz.id,
    teacher_id: teacherId,
    name: quiz.title,
    type: 'board',
    folder_id: quiz.folderId || undefined,
    content_data: { slides: quiz.slides || [] },
    created_at: quiz.createdAt || new Date().toISOString(),
    updated_at: quiz.updatedAt || new Date().toISOString(),
  };
  
  await upsertTeacherContent(item);
}

/**
 * Sync a folder to cloud
 */
export async function syncFolderToCloud(teacherId: string, folder: {
  id: string;
  name: string;
  color?: string;
  createdAt?: string;
}): Promise<void> {
  console.log('[TeacherSync] Syncing folder:', folder.id, folder.name);
  
  const item: TeacherContentItem = {
    id: folder.id,
    teacher_id: teacherId,
    name: folder.name,
    type: 'folder',
    color: folder.color,
    created_at: folder.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  await upsertTeacherContent(item);
}

/**
 * Delete content from cloud
 */
export async function deleteContentFromCloud(contentId: string): Promise<void> {
  console.log('[TeacherSync] Deleting content:', contentId);
  
  try {
    await fetch(`https://${PROJECT_ID}.supabase.co/rest/v1/teacher_content?id=eq.${contentId}`, {
      method: 'DELETE',
      headers: {
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`,
      }
    });
  } catch (error) {
    console.error('[TeacherSync] Delete error:', error);
  }
}

/**
 * Upsert teacher content to Supabase
 */
async function upsertTeacherContent(item: TeacherContentItem): Promise<void> {
  try {
    const response = await fetch(`https://${PROJECT_ID}.supabase.co/rest/v1/teacher_content`, {
      method: 'POST',
      headers: {
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: item.id,
        teacher_id: item.teacher_id,
        name: item.name,
        type: item.type,
        folder_id: item.folder_id || null,
        content_data: item.content_data || null,
        color: item.color || null,
        created_at: item.created_at,
        updated_at: item.updated_at,
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('[TeacherSync] Upsert error:', error);
    }
  } catch (error) {
    console.error('[TeacherSync] Upsert error:', error);
  }
}

// ============================================
// Shared folder management
// ============================================

/**
 * Share a folder with a class
 */
export async function shareFolderWithClass(
  teacherId: string,
  classId: string,
  folderId: string,
  folderName: string
): Promise<void> {
  console.log('[TeacherSync] Sharing folder with class:', folderId, classId);
  
  const id = `share-${folderId}-${classId}`;
  
  try {
    const response = await fetch(`https://${PROJECT_ID}.supabase.co/rest/v1/class_shared_content`, {
      method: 'POST',
      headers: {
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id,
        class_id: classId,
        teacher_id: teacherId,
        folder_id: folderId,
        folder_name: folderName,
        created_at: new Date().toISOString(),
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('[TeacherSync] Share error:', error);
    }
  } catch (error) {
    console.error('[TeacherSync] Share error:', error);
  }
}

/**
 * Unshare a folder from a class
 */
export async function unshareFolderFromClass(folderId: string, classId: string): Promise<void> {
  console.log('[TeacherSync] Unsharing folder from class:', folderId, classId);
  
  const id = `share-${folderId}-${classId}`;
  
  try {
    await fetch(`https://${PROJECT_ID}.supabase.co/rest/v1/class_shared_content?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`,
      }
    });
  } catch (error) {
    console.error('[TeacherSync] Unshare error:', error);
  }
}

/**
 * Get shared folders for a class
 */
export async function getSharedFoldersForClass(classId: string): Promise<SharedFolder[]> {
  console.log('[TeacherSync] Getting shared folders for class:', classId);
  
  try {
    const response = await fetch(
      `https://${PROJECT_ID}.supabase.co/rest/v1/class_shared_content?class_id=eq.${classId}&select=*`,
      {
        headers: {
          'apikey': API_KEY,
          'Authorization': `Bearer ${API_KEY}`,
        }
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      console.log('[TeacherSync] Shared folders:', data);
      return data;
    }
  } catch (error) {
    console.error('[TeacherSync] Get shared folders error:', error);
  }
  
  return [];
}

/**
 * Get folder contents from cloud (for students)
 */
export async function getFolderContentsFromCloud(folderId: string): Promise<TeacherContentItem[]> {
  console.log('[TeacherSync] Getting folder contents:', folderId);
  
  try {
    const response = await fetch(
      `https://${PROJECT_ID}.supabase.co/rest/v1/teacher_content?folder_id=eq.${folderId}&select=*`,
      {
        headers: {
          'apikey': API_KEY,
          'Authorization': `Bearer ${API_KEY}`,
        }
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      console.log('[TeacherSync] Folder contents:', data);
      return data;
    }
  } catch (error) {
    console.error('[TeacherSync] Get folder contents error:', error);
  }
  
  return [];
}

/**
 * Get folder info from cloud
 */
export async function getFolderFromCloud(folderId: string): Promise<TeacherContentItem | null> {
  try {
    const response = await fetch(
      `https://${PROJECT_ID}.supabase.co/rest/v1/teacher_content?id=eq.${folderId}&select=*`,
      {
        headers: {
          'apikey': API_KEY,
          'Authorization': `Bearer ${API_KEY}`,
        }
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      return data[0] || null;
    }
  } catch (error) {
    console.error('[TeacherSync] Get folder error:', error);
  }
  
  return null;
}

/**
 * Check if folder is shared with a class
 */
export async function isFolderSharedWithClass(folderId: string, classId: string): Promise<boolean> {
  const id = `share-${folderId}-${classId}`;
  
  try {
    const response = await fetch(
      `https://${PROJECT_ID}.supabase.co/rest/v1/class_shared_content?id=eq.${id}&select=id`,
      {
        headers: {
          'apikey': API_KEY,
          'Authorization': `Bearer ${API_KEY}`,
        }
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      return data.length > 0;
    }
  } catch (error) {
    console.error('[TeacherSync] Check shared error:', error);
  }
  
  return false;
}

/**
 * Sync ALL teacher content to cloud (initial sync)
 */
export async function syncAllTeacherContent(teacherId: string): Promise<void> {
  console.log('[TeacherSync] Starting full sync for teacher:', teacherId);
  
  // Get all content types from localStorage
  
  // 1. Folders (with children inside)
  const foldersRaw = localStorage.getItem('vivid-my-folders');
  const folders = foldersRaw ? JSON.parse(foldersRaw) : [];
  
  // 2. Root-level documents
  const documentsRaw = localStorage.getItem('vivid-my-documents');
  const documents = documentsRaw ? JSON.parse(documentsRaw) : [];
  
  // 3. Worksheets (pracovní listy)
  const worksheetsRaw = localStorage.getItem('vividbooks_worksheets');
  const worksheets = worksheetsRaw ? JSON.parse(worksheetsRaw) : [];
  
  // 4. Quizzes/Boards
  const quizzesRaw = localStorage.getItem('vividbooks_quizzes');
  const quizzes = quizzesRaw ? JSON.parse(quizzesRaw) : [];
  
  // 5. Links (odkazy)
  const linksRaw = localStorage.getItem('vivid-my-links');
  const links = linksRaw ? JSON.parse(linksRaw) : [];
  
  // 6. Files (uploaded files) - need to get userId first
  // Files are stored per-user, we'll sync them if available
  
  console.log('[TeacherSync] Items to sync:', {
    folders: folders.length,
    documents: documents.length,
    worksheets: worksheets.length,
    quizzes: quizzes.length,
    links: links.length,
  });
  
  // Sync folders AND their children (documents inside folders)
  for (const folder of folders) {
    await syncFolderToCloud(teacherId, folder);
    
    // Sync ALL items inside folders (folder.children contains documents)
    if (folder.children && Array.isArray(folder.children)) {
      console.log('[TeacherSync] Folder', folder.name, 'has', folder.children.length, 'children');
      for (const child of folder.children) {
        const childType = child.type || 'document';
        console.log('[TeacherSync] Child in folder:', child.id, child.name, 'type:', childType, 'folderId:', folder.id);
        
        if (childType === 'board') {
          // Load FULL board data from localStorage
          const fullQuiz = localStorage.getItem(`vividbooks_quiz_${child.id}`);
          const quizData = fullQuiz ? JSON.parse(fullQuiz) : {};
          const quizTitle = quizData.title || child.name;
          console.log('[TeacherSync] Board from folder.children:', child.id, 'title:', quizTitle, 'slides:', (quizData.slides || []).length);
          
          await upsertTeacherContent({
            id: child.id,
            teacher_id: teacherId,
            name: quizTitle,
            type: 'board',
            folder_id: folder.id,
            content_data: quizData,
            created_at: quizData.createdAt || child.createdAt || new Date().toISOString(),
            updated_at: quizData.updatedAt || child.updatedAt || new Date().toISOString(),
          });
        } else if (childType === 'link') {
          // Sync link as document with url in content_data
          const fullLink = localStorage.getItem(`vivid-link-${child.id}`);
          const linkData = fullLink ? JSON.parse(fullLink) : {};
          console.log('[TeacherSync] Link from folder.children:', child.id, child.name);
          
          await upsertTeacherContent({
            id: child.id,
            teacher_id: teacherId,
            name: child.name || linkData.url,
            type: 'document', // Links stored as documents
            folder_id: folder.id,
            content_data: { url: linkData.url || child.url, linkType: linkData.linkType, isLink: true },
            created_at: child.createdAt || new Date().toISOString(),
            updated_at: child.updatedAt || new Date().toISOString(),
          });
        } else {
          // Document - Load FULL document data from localStorage
          const fullDoc = localStorage.getItem(`vivid-doc-${child.id}`);
          const docData = fullDoc ? JSON.parse(fullDoc) : {};
          const docTitle = docData.title || child.name;
          console.log('[TeacherSync] Document from folder.children:', child.id, 'title:', docTitle, 'content length:', (docData.content || '').length);
          
          await upsertTeacherContent({
            id: child.id,
            teacher_id: teacherId,
            name: docTitle,
            type: 'document',
            folder_id: folder.id,
            content_data: docData,
            created_at: docData.createdAt || child.createdAt || new Date().toISOString(),
            updated_at: docData.updatedAt || child.updatedAt || new Date().toISOString(),
          });
        }
      }
    }
  }
  
  // Sync root-level documents
  for (const doc of documents) {
    // Load full document data from localStorage
    const fullDoc = localStorage.getItem(`vivid-doc-${doc.id}`);
    const docData = fullDoc ? JSON.parse(fullDoc) : {};
    console.log('[TeacherSync] Root document:', doc.id, doc.name, 'has content:', !!docData.content);
    await syncWorksheetToCloud(teacherId, {
      id: doc.id,
      title: doc.name,
      folderId: undefined,
      blocks: docData.blocks || [],
      content: docData.content || '',
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  }
  
  // Sync worksheets (pracovní listy)
  for (const worksheet of worksheets) {
    const fullWorksheet = localStorage.getItem(`vividbooks_worksheet_${worksheet.id}`);
    const fullWorksheetData = fullWorksheet ? JSON.parse(fullWorksheet) : {};
    const worksheetData = { ...fullWorksheetData, ...worksheet, folderId: worksheet.folderId };
    console.log('[TeacherSync] Worksheet:', worksheet.id, 'folderId:', worksheetData.folderId);
    await syncWorksheetToCloud(teacherId, worksheetData);
  }
  
  // Sync quizzes/boards
  for (const quiz of quizzes) {
    const fullQuiz = localStorage.getItem(`vividbooks_quiz_${quiz.id}`);
    const fullQuizData = fullQuiz ? JSON.parse(fullQuiz) : {};
    const quizData = { ...fullQuizData, ...quiz, folderId: quiz.folderId };
    console.log('[TeacherSync] Quiz:', quiz.id, 'folderId:', quizData.folderId);
    await syncQuizToCloud(teacherId, quizData);
  }
  
  // Sync links (jako dokumenty s type 'link')
  for (const link of links) {
    console.log('[TeacherSync] Link:', link.id, link.title || link.name, 'folderId:', link.folderId);
    await upsertTeacherContent({
      id: link.id,
      teacher_id: teacherId,
      name: link.title || link.name || link.url,
      type: 'document', // Links stored as documents for now
      folder_id: link.folderId || undefined,
      content_data: { url: link.url, linkType: link.linkType },
      created_at: link.createdAt || new Date().toISOString(),
      updated_at: link.updatedAt || new Date().toISOString(),
    });
  }
  
  console.log('[TeacherSync] Full sync complete');
}

