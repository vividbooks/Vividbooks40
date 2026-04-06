/**
 * student_content — připraveno pro přesun logiky z student-content-sync.
 */

import { supabase } from '../../../utils/supabase/client';

export type StudentContentRow = {
  id: string;
  student_id: string;
  name: string;
  type: 'document' | 'board' | 'folder';
  content_id: string | null;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
};

export async function listStudentContentForStudent(studentId: string): Promise<StudentContentRow[]> {
  const { data, error } = await supabase
    .from('student_content')
    .select('*')
    .eq('student_id', studentId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.warn('[moje-trida] listStudentContentForStudent', error.message);
    return [];
  }
  return (data ?? []) as StudentContentRow[];
}
