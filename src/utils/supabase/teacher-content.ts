/**
 * Teacher Content Storage - Supabase
 * 
 * Handles all teacher-generated content:
 * - Folders
 * - Documents
 * - Boards (Quizzes)
 * - Worksheets
 * - Files
 * - Links
 */

import { supabase } from './client';
import { Quiz } from '../../types/quiz';

// =============================================
// TYPES
// =============================================

export interface TeacherFolder {
  id: string;
  teacher_id: string;
  name: string;
  color?: string;
  parent_id?: string | null;
  copied_from?: string;
  original_id?: string;
  position?: number;
  created_at?: string;
  updated_at?: string;
  // Virtual field for nested children
  children?: (TeacherFolder | TeacherDocument | TeacherBoard)[];
}

export interface TeacherDocument {
  id: string;
  teacher_id: string;
  folder_id?: string | null;
  title: string;
  content?: string;
  description?: string;
  document_type?: string;
  copied_from?: string;
  original_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TeacherBoard {
  id: string;
  teacher_id: string;
  folder_id?: string | null;
  title: string;
  subject?: string;
  grade?: number;
  slides?: any[];
  settings?: any;
  copied_from?: string;
  original_id?: string;
  slides_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface TeacherWorksheet {
  id: string;
  teacher_id: string;
  folder_id?: string | null;
  name: string;
  source_page_id?: string;
  source_page_title?: string;
  source_page_slug?: string;
  worksheet_type?: string;
  content?: any;
  pdf_settings?: any;
  copied_from?: string;
  original_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TeacherFile {
  id: string;
  teacher_id: string;
  folder_id?: string | null;
  file_name: string;
  file_url: string;
  file_type?: string;
  file_size?: number;
  created_at?: string;
}

export interface TeacherLink {
  id: string;
  teacher_id: string;
  folder_id?: string | null;
  title: string;
  url: string;
  description?: string;
  created_at?: string;
}

// =============================================
// HELPER: Get current user ID
// =============================================

async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

// =============================================
// FOLDERS
// =============================================

export async function getFolders(): Promise<TeacherFolder[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('teacher_folders')
    .select('*')
    .eq('teacher_id', userId)
    .order('position', { ascending: true });

  if (error) {
    console.error('[TeacherContent] Error loading folders:', error);
    return [];
  }

  return data || [];
}

export async function saveFolder(folder: Partial<TeacherFolder>): Promise<TeacherFolder | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('teacher_folders')
    .upsert({
      ...folder,
      teacher_id: userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('[TeacherContent] Error saving folder:', error);
    return null;
  }

  return data;
}

export async function deleteFolder(folderId: string): Promise<boolean> {
  const { error } = await supabase
    .from('teacher_folders')
    .delete()
    .eq('id', folderId);

  if (error) {
    console.error('[TeacherContent] Error deleting folder:', error);
    return false;
  }

  return true;
}

// =============================================
// DOCUMENTS
// =============================================

export async function getDocuments(): Promise<TeacherDocument[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('teacher_documents')
    .select('*')
    .eq('teacher_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[TeacherContent] Error loading documents:', error);
    return [];
  }

  return data || [];
}

export async function getDocument(id: string): Promise<TeacherDocument | null> {
  const { data, error } = await supabase
    .from('teacher_documents')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('[TeacherContent] Error loading document:', error);
    return null;
  }

  return data;
}

export async function saveDocument(doc: Partial<TeacherDocument>): Promise<TeacherDocument | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('teacher_documents')
    .upsert({
      ...doc,
      teacher_id: userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('[TeacherContent] Error saving document:', error);
    return null;
  }

  return data;
}

export async function deleteDocument(docId: string): Promise<boolean> {
  const { error } = await supabase
    .from('teacher_documents')
    .delete()
    .eq('id', docId);

  if (error) {
    console.error('[TeacherContent] Error deleting document:', error);
    return false;
  }

  return true;
}

// =============================================
// BOARDS (Quizzes)
// =============================================

export async function getBoards(): Promise<TeacherBoard[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('teacher_boards')
    .select('*')
    .eq('teacher_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[TeacherContent] Error loading boards:', error);
    return [];
  }

  return data || [];
}

export async function getBoard(id: string): Promise<TeacherBoard | null> {
  const { data, error } = await supabase
    .from('teacher_boards')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found - try localStorage fallback
      return null;
    }
    console.error('[TeacherContent] Error loading board:', error);
    return null;
  }

  return data;
}

export async function saveBoard(board: Partial<TeacherBoard>): Promise<TeacherBoard | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const slidesCount = Array.isArray(board.slides) ? board.slides.length : 0;

  const { data, error } = await supabase
    .from('teacher_boards')
    .upsert({
      ...board,
      teacher_id: userId,
      slides_count: slidesCount,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('[TeacherContent] Error saving board:', error);
    return null;
  }

  return data;
}

export async function deleteBoard(boardId: string): Promise<boolean> {
  const { error } = await supabase
    .from('teacher_boards')
    .delete()
    .eq('id', boardId);

  if (error) {
    console.error('[TeacherContent] Error deleting board:', error);
    return false;
  }

  return true;
}

export async function moveBoardToFolder(boardId: string, folderId: string | null): Promise<boolean> {
  const { error } = await supabase
    .from('teacher_boards')
    .update({ folder_id: folderId })
    .eq('id', boardId);

  if (error) {
    console.error('[TeacherContent] Error moving board:', error);
    return false;
  }

  return true;
}

// =============================================
// WORKSHEETS
// =============================================

export async function getWorksheets(): Promise<TeacherWorksheet[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('teacher_worksheets')
    .select('*')
    .eq('teacher_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[TeacherContent] Error loading worksheets:', error);
    return [];
  }

  return data || [];
}

export async function getWorksheet(id: string): Promise<TeacherWorksheet | null> {
  const { data, error } = await supabase
    .from('teacher_worksheets')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('[TeacherContent] Error loading worksheet:', error);
    return null;
  }

  return data;
}

export async function saveWorksheet(worksheet: Partial<TeacherWorksheet>): Promise<TeacherWorksheet | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('teacher_worksheets')
    .upsert({
      ...worksheet,
      teacher_id: userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('[TeacherContent] Error saving worksheet:', error);
    return null;
  }

  return data;
}

export async function deleteWorksheet(worksheetId: string): Promise<boolean> {
  const { error } = await supabase
    .from('teacher_worksheets')
    .delete()
    .eq('id', worksheetId);

  if (error) {
    console.error('[TeacherContent] Error deleting worksheet:', error);
    return false;
  }

  return true;
}

// =============================================
// FILES
// =============================================

export async function getFiles(): Promise<TeacherFile[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('teacher_files')
    .select('*')
    .eq('teacher_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[TeacherContent] Error loading files:', error);
    return [];
  }

  return data || [];
}

export async function saveFile(file: Partial<TeacherFile>): Promise<TeacherFile | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('teacher_files')
    .upsert({
      ...file,
      teacher_id: userId,
    }, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('[TeacherContent] Error saving file:', error);
    return null;
  }

  return data;
}

export async function deleteFile(fileId: string): Promise<boolean> {
  const { error } = await supabase
    .from('teacher_files')
    .delete()
    .eq('id', fileId);

  if (error) {
    console.error('[TeacherContent] Error deleting file:', error);
    return false;
  }

  return true;
}

// =============================================
// LINKS
// =============================================

export async function getLinks(): Promise<TeacherLink[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('teacher_links')
    .select('*')
    .eq('teacher_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[TeacherContent] Error loading links:', error);
    return [];
  }

  return data || [];
}

export async function saveLink(link: Partial<TeacherLink>): Promise<TeacherLink | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('teacher_links')
    .upsert({
      ...link,
      teacher_id: userId,
    }, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('[TeacherContent] Error saving link:', error);
    return null;
  }

  return data;
}

export async function deleteLink(linkId: string): Promise<boolean> {
  const { error } = await supabase
    .from('teacher_links')
    .delete()
    .eq('id', linkId);

  if (error) {
    console.error('[TeacherContent] Error deleting link:', error);
    return false;
  }

  return true;
}

// =============================================
// FULL CONTENT TREE
// =============================================

export interface ContentTree {
  folders: TeacherFolder[];
  documents: TeacherDocument[];
  boards: TeacherBoard[];
  worksheets: TeacherWorksheet[];
  files: TeacherFile[];
  links: TeacherLink[];
}

export async function getFullContentTree(): Promise<ContentTree> {
  const [folders, documents, boards, worksheets, files, links] = await Promise.all([
    getFolders(),
    getDocuments(),
    getBoards(),
    getWorksheets(),
    getFiles(),
    getLinks(),
  ]);

  return { folders, documents, boards, worksheets, files, links };
}

// =============================================
// MIGRATION FROM LOCALSTORAGE
// =============================================

export async function migrateFromLocalStorage(): Promise<{ success: boolean; migrated: number; errors: string[] }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { success: false, migrated: 0, errors: ['User not authenticated'] };
  }

  const errors: string[] = [];
  let migrated = 0;

  try {
    // Migrate folders
    const foldersJson = localStorage.getItem('vivid-my-folders');
    if (foldersJson) {
      const folders = JSON.parse(foldersJson);
      for (const folder of folders) {
        const saved = await migrateFolder(folder, null, userId);
        if (saved) migrated++;
      }
    }

    // Migrate documents
    const docsJson = localStorage.getItem('vivid-my-documents');
    if (docsJson) {
      const docs = JSON.parse(docsJson);
      for (const doc of docs) {
        const docData = localStorage.getItem(`vivid-doc-${doc.id}`);
        if (docData) {
          const parsedDoc = JSON.parse(docData);
          const saved = await saveDocument({
            id: doc.id,
            title: parsedDoc.title || doc.name || 'Dokument',
            content: parsedDoc.content,
            description: parsedDoc.description,
            document_type: parsedDoc.documentType,
            folder_id: null,
          });
          if (saved) migrated++;
        }
      }
    }

    // Migrate quizzes/boards
    const quizzesJson = localStorage.getItem('vividbooks_quizzes');
    if (quizzesJson) {
      const quizzes = JSON.parse(quizzesJson);
      for (const quizMeta of quizzes) {
        const quizData = localStorage.getItem(`vividbooks_quiz_${quizMeta.id}`);
        if (quizData) {
          const quiz = JSON.parse(quizData);
          const saved = await saveBoard({
            id: quiz.id,
            title: quiz.title || 'Board',
            subject: quiz.subject,
            grade: quiz.grade,
            slides: quiz.slides,
            settings: quiz.settings,
            folder_id: quizMeta.folderId || null,
          });
          if (saved) migrated++;
        }
      }
    }

    // Migrate worksheets
    const worksheetsJson = localStorage.getItem('vivid-worksheets');
    if (worksheetsJson) {
      const worksheets = JSON.parse(worksheetsJson);
      for (const ws of worksheets) {
        const wsData = localStorage.getItem(`vivid-worksheet-${ws.id}`);
        if (wsData) {
          const worksheet = JSON.parse(wsData);
          const saved = await saveWorksheet({
            id: worksheet.id,
            name: worksheet.name || ws.name,
            source_page_id: worksheet.sourcePageId,
            source_page_title: worksheet.sourcePageTitle,
            source_page_slug: worksheet.sourcePageSlug,
            worksheet_type: worksheet.worksheetType,
            content: worksheet.content,
            pdf_settings: worksheet.pdfSettings,
            folder_id: ws.folderId || null,
          });
          if (saved) migrated++;
        }
      }
    }

    // Migrate files
    const filesJson = localStorage.getItem('vivid-my-files');
    if (filesJson) {
      const files = JSON.parse(filesJson);
      for (const file of files) {
        const saved = await saveFile({
          id: file.id,
          file_name: file.fileName,
          file_url: file.fileUrl,
          file_type: file.fileType,
          file_size: file.fileSize,
          folder_id: file.folderId || null,
        });
        if (saved) migrated++;
      }
    }

    // Migrate links
    const linksJson = localStorage.getItem('vivid-my-links');
    if (linksJson) {
      const links = JSON.parse(linksJson);
      for (const link of links) {
        const saved = await saveLink({
          id: link.id,
          title: link.title,
          url: link.url,
          description: link.description,
          folder_id: link.folderId || null,
        });
        if (saved) migrated++;
      }
    }

    return { success: true, migrated, errors };
  } catch (error) {
    console.error('[TeacherContent] Migration error:', error);
    errors.push(String(error));
    return { success: false, migrated, errors };
  }
}

// Helper to recursively migrate folders with children
async function migrateFolder(folder: any, parentId: string | null, userId: string): Promise<boolean> {
  try {
    const saved = await saveFolder({
      id: folder.id,
      name: folder.name,
      color: folder.color,
      parent_id: parentId,
      copied_from: folder.copiedFrom,
      original_id: folder.originalId,
    });

    if (!saved) return false;

    // Migrate children
    if (folder.children && Array.isArray(folder.children)) {
      for (const child of folder.children) {
        if (child.type === 'folder') {
          await migrateFolder(child, saved.id, userId);
        } else if (child.type === 'document') {
          const docData = localStorage.getItem(`vivid-doc-${child.id}`);
          const parsedDoc = docData ? JSON.parse(docData) : {};
          await saveDocument({
            id: child.id,
            title: parsedDoc.title || child.name || 'Dokument',
            content: parsedDoc.content,
            folder_id: saved.id,
            copied_from: child.copiedFrom,
            original_id: child.originalId,
          });
        } else if (child.type === 'board') {
          const boardData = localStorage.getItem(`vividbooks_quiz_${child.id}`);
          const parsedBoard = boardData ? JSON.parse(boardData) : {};
          await saveBoard({
            id: child.id,
            title: parsedBoard.title || child.name || 'Board',
            slides: parsedBoard.slides,
            folder_id: saved.id,
            copied_from: child.copiedFrom,
            original_id: child.originalId,
          });
        }
      }
    }

    return true;
  } catch (error) {
    console.error('[TeacherContent] Error migrating folder:', error);
    return false;
  }
}

// =============================================
// QUIZ STORAGE COMPATIBILITY LAYER
// Provides same interface as old quiz-storage.ts
// =============================================

export interface QuizListItem {
  id: string;
  title: string;
  subject?: string;
  grade?: number;
  createdAt: string;
  updatedAt: string;
  slidesCount: number;
  folderId?: string | null;
}

// Convert TeacherBoard to QuizListItem for compatibility
function boardToQuizListItem(board: TeacherBoard): QuizListItem {
  return {
    id: board.id,
    title: board.title,
    subject: board.subject,
    grade: board.grade,
    createdAt: board.created_at || new Date().toISOString(),
    updatedAt: board.updated_at || new Date().toISOString(),
    slidesCount: board.slides_count || 0,
    folderId: board.folder_id,
  };
}

// Convert Quiz to TeacherBoard for saving
function quizToBoard(quiz: Quiz): Partial<TeacherBoard> {
  return {
    id: quiz.id,
    title: quiz.title || 'Bez názvu',
    subject: quiz.subject,
    grade: quiz.grade,
    slides: quiz.slides,
    settings: quiz.settings,
    slides_count: quiz.slides?.length || 0,
  };
}

// Convert TeacherBoard to Quiz for loading
function boardToQuiz(board: TeacherBoard): Quiz {
  return {
    id: board.id,
    title: board.title,
    subject: board.subject,
    grade: board.grade,
    slides: board.slides || [],
    settings: board.settings,
    createdAt: board.created_at || new Date().toISOString(),
    updatedAt: board.updated_at || new Date().toISOString(),
    createdBy: board.teacher_id,
  } as Quiz;
}

// Async versions of quiz storage functions
export async function getQuizListAsync(): Promise<QuizListItem[]> {
  const boards = await getBoards();
  return boards.map(boardToQuizListItem);
}

export async function getQuizAsync(id: string): Promise<Quiz | null> {
  const board = await getBoard(id);
  if (!board) return null;
  return boardToQuiz(board);
}

export async function saveQuizAsync(quiz: Quiz): Promise<boolean> {
  const result = await saveBoard(quizToBoard(quiz));
  return result !== null;
}

export async function deleteQuizAsync(id: string): Promise<boolean> {
  return deleteBoard(id);
}

export async function moveQuizToFolderAsync(quizId: string, folderId: string | null): Promise<boolean> {
  return moveBoardToFolder(quizId, folderId);
}











