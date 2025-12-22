/**
 * Student Content Sync
 * 
 * Manages syncing student content (documents, presentations) to teacher's folder view.
 * When a student creates content, it appears in teacher's class folder structure.
 */

import { supabase } from './supabase/client';
import { storage } from './profile-storage';

// Types for student content
export interface StudentContentItem {
  id: string;
  student_id: string;
  name: string;
  type: 'document' | 'board' | 'folder';
  content_id?: string; // ID of the worksheet or quiz
  folder_id?: string; // Parent folder (null = root)
  created_at: string;
  updated_at: string;
}

// Types for class folder structure (teacher view)
export interface ClassFolderStructure {
  class_id: string;
  class_name: string;
  folder_id: string; // The folder ID in teacher's "Můj obsah"
  students: {
    student_id: string;
    student_name: string;
    folder_id: string; // Student subfolder ID
  }[];
  created_at: string;
  updated_at: string;
}

const STORAGE_KEY_CLASS_FOLDERS = 'vivid-class-folders';
const STORAGE_KEY_STUDENT_CONTENT = 'vivid-student-content';

// ============================================
// Teacher-side functions
// ============================================

/**
 * Get all class folder structures for the current teacher
 */
export function getTeacherClassFolders(): ClassFolderStructure[] {
  const profile = storage.getCurrentUserProfile();
  if (!profile) return [];
  
  const key = `${STORAGE_KEY_CLASS_FOLDERS}-${profile.userId || profile.id}`;
  const saved = localStorage.getItem(key);
  if (!saved) return [];
  
  try {
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

/**
 * Save class folder structures
 */
export function saveTeacherClassFolders(folders: ClassFolderStructure[]): void {
  const profile = storage.getCurrentUserProfile();
  if (!profile) return;
  
  const key = `${STORAGE_KEY_CLASS_FOLDERS}-${profile.userId || profile.id}`;
  localStorage.setItem(key, JSON.stringify(folders));
}

/**
 * Create a class folder structure when a class is created
 * Returns the folder ID for the class
 */
export function createClassFolderStructure(
  classId: string,
  className: string,
  students: { id: string; name: string }[]
): string {
  const folders = getTeacherClassFolders();
  
  // Check if already exists
  const existing = folders.find(f => f.class_id === classId);
  if (existing) {
    return existing.folder_id;
  }
  
  const classFolderId = `class-folder-${classId}`;
  const now = new Date().toISOString();
  
  const newStructure: ClassFolderStructure = {
    class_id: classId,
    class_name: className,
    folder_id: classFolderId,
    students: students.map(s => ({
      student_id: s.id,
      student_name: s.name,
      folder_id: `student-folder-${classId}-${s.id}`,
    })),
    created_at: now,
    updated_at: now,
  };
  
  folders.push(newStructure);
  saveTeacherClassFolders(folders);
  
  return classFolderId;
}

/**
 * Add a student folder to an existing class structure
 */
export function addStudentToClassFolder(
  classId: string,
  studentId: string,
  studentName: string
): void {
  const folders = getTeacherClassFolders();
  const classFolder = folders.find(f => f.class_id === classId);
  
  if (!classFolder) return;
  
  // Check if student already exists
  if (classFolder.students.some(s => s.student_id === studentId)) return;
  
  classFolder.students.push({
    student_id: studentId,
    student_name: studentName,
    folder_id: `student-folder-${classId}-${studentId}`,
  });
  
  classFolder.updated_at = new Date().toISOString();
  saveTeacherClassFolders(folders);
}

/**
 * Get class folder structure by class ID
 */
export function getClassFolderStructure(classId: string): ClassFolderStructure | null {
  const folders = getTeacherClassFolders();
  return folders.find(f => f.class_id === classId) || null;
}

// ============================================
// Student-side functions
// ============================================

/**
 * Get student's own content items
 */
export function getStudentContent(studentId: string): StudentContentItem[] {
  const key = `${STORAGE_KEY_STUDENT_CONTENT}-${studentId}`;
  const saved = localStorage.getItem(key);
  if (!saved) return [];
  
  try {
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

/**
 * Save student's content items
 */
export function saveStudentContent(studentId: string, items: StudentContentItem[]): void {
  const key = `${STORAGE_KEY_STUDENT_CONTENT}-${studentId}`;
  localStorage.setItem(key, JSON.stringify(items));
}

/**
 * Add a new content item for student
 */
export function addStudentContentItem(
  studentId: string,
  item: Omit<StudentContentItem, 'id' | 'student_id' | 'created_at' | 'updated_at'>
): StudentContentItem {
  const items = getStudentContent(studentId);
  const now = new Date().toISOString();
  
  const newItem: StudentContentItem = {
    ...item,
    id: `student-content-${Date.now()}`,
    student_id: studentId,
    created_at: now,
    updated_at: now,
  };
  
  items.push(newItem);
  saveStudentContent(studentId, items);
  
  return newItem;
}

/**
 * Update a student content item
 */
export function updateStudentContentItem(
  studentId: string,
  itemId: string,
  updates: Partial<Pick<StudentContentItem, 'name' | 'folder_id'>>
): void {
  const items = getStudentContent(studentId);
  const index = items.findIndex(i => i.id === itemId);
  
  if (index === -1) return;
  
  items[index] = {
    ...items[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  
  saveStudentContent(studentId, items);
}

/**
 * Delete a student content item
 */
export function deleteStudentContentItem(studentId: string, itemId: string): void {
  const items = getStudentContent(studentId);
  const filtered = items.filter(i => i.id !== itemId);
  saveStudentContent(studentId, filtered);
}

/**
 * Create a folder for student's own content
 */
export function createStudentFolder(
  studentId: string,
  name: string,
  parentFolderId?: string
): StudentContentItem {
  return addStudentContentItem(studentId, {
    name,
    type: 'folder',
    folder_id: parentFolderId,
  });
}

// ============================================
// Sync functions (Supabase-based for production)
// ============================================

/**
 * Sync student content to Supabase for teacher view
 * This should be called whenever student creates/updates content
 */
export async function syncStudentContentToCloud(studentId: string): Promise<void> {
  const items = getStudentContent(studentId);
  
  try {
    // Upsert to Supabase
    for (const item of items) {
      await supabase
        .from('student_content')
        .upsert({
          id: item.id,
          student_id: studentId,
          name: item.name,
          type: item.type,
          content_id: item.content_id,
          folder_id: item.folder_id,
          created_at: item.created_at,
          updated_at: item.updated_at,
        }, { onConflict: 'id' });
    }
  } catch (error) {
    console.error('Error syncing student content:', error);
  }
}

/**
 * Fetch student content from Supabase (for teacher view)
 */
export async function fetchStudentContentFromCloud(studentId: string): Promise<StudentContentItem[]> {
  try {
    const { data, error } = await supabase
      .from('student_content')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching student content:', error);
      return [];
    }
    
    return (data || []).map(row => ({
      id: row.id,
      student_id: row.student_id,
      name: row.name,
      type: row.type,
      content_id: row.content_id,
      folder_id: row.folder_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  } catch (error) {
    console.error('Error fetching student content:', error);
    return [];
  }
}

/**
 * Get all student content for a class (teacher view)
 */
export async function fetchClassStudentContent(classId: string): Promise<{
  studentId: string;
  studentName: string;
  items: StudentContentItem[];
}[]> {
  // First get class structure to get student IDs
  const classFolder = getClassFolderStructure(classId);
  if (!classFolder) return [];
  
  const results = await Promise.all(
    classFolder.students.map(async (student) => ({
      studentId: student.student_id,
      studentName: student.student_name,
      items: await fetchStudentContentFromCloud(student.student_id),
    }))
  );
  
  return results;
}


