/**
 * Supabase Classes & Results Management
 * 
 * Tables in Supabase (see docs/DATABASE_STRUCTURE.md):
 * - schools: id, name, address, city
 * - teachers: id, email, name, school_id, avatar_url
 * - classes: id, name, teacher_id, school_id, grade, students_count
 * - class_subjects: id, class_id, subject_name, teacher_id, is_owner
 * - class_collaborators: id, class_id, teacher_id, subject_name, status, invited_by
 * - students: id, name, class_id, email, initials, color
 * - assignments: id, title, type, class_id, board_id, subject, due_date, session_id, session_type
 * - results: id, student_id, assignment_id, score, max_score, percentage, correct_count, total_questions, time_spent_ms, teacher_comment
 */

import { supabase } from './client';
import { fetchWithRetry } from './fetch-helper';
import { projectId, publicAnonKey } from './info';

function readAuthTokenFromStorage(): { token: string; expiresAt?: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`sb-${projectId}-auth-token`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.access_token) {
      return { token: parsed.access_token, expiresAt: parsed.expires_at };
    }
  } catch {
    // ignore
  }
  return null;
}

async function getAuthToken(): Promise<string | null> {
  try {
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
    const result = await Promise.race([sessionPromise, timeoutPromise]);
    if (result && 'data' in result && result.data.session?.access_token) {
      return result.data.session.access_token;
    }
  } catch {
    // ignore
  }
  const stored = readAuthTokenFromStorage();
  return stored?.token || null;
}

// =============================================
// TYPES
// =============================================

export interface School {
  id: string;
  name: string;
  address?: string;
  city?: string;
  created_at: string;
}

export interface Teacher {
  id: string;
  email: string;
  name: string;
  school_id?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ClassGroup {
  id: string;
  name: string;
  teacher_id: string;
  school_id?: string;
  grade?: number;
  students_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface ClassSubject {
  id: string;
  class_id: string;
  subject_name: string;
  teacher_id: string;
  is_owner: boolean;
  created_at: string;
}

export interface ClassCollaborator {
  id: string;
  class_id: string;
  teacher_id: string;
  subject_name: string;
  status: 'pending' | 'accepted' | 'rejected';
  invited_at: string;
  accepted_at?: string;
  invited_by: string;
  // Joined fields
  teacher_name?: string;
  teacher_email?: string;
}

export interface Student {
  id: string;
  name: string;
  class_id: string;
  email?: string;
  initials: string;
  color: string;
  created_at: string;
  updated_at?: string;
}

export interface Assignment {
  id: string;
  title: string;
  type: 'test' | 'practice' | 'individual' | 'live' | 'paper_test';
  class_id: string;
  board_id?: string;
  worksheet_id?: string; // For paper tests - reference to the worksheet
  worksheet_content?: any; // Cached worksheet content for AI analysis
  subject: string;
  due_date?: string;
  session_id?: string;
  session_type?: 'live' | 'shared' | 'individual';
  created_at: string;
  created_by?: string;
}

export interface StudentResult {
  id: string;
  student_id: string;
  assignment_id: string;
  score: number | null; // null = not done, -1 = pending
  max_score: number;
  percentage?: number;
  correct_count?: number;
  total_questions?: number;
  completed_at?: string;
  time_spent_ms?: number;
  teacher_comment?: string;
  created_at?: string;
  // Formative assessment fields
  formative_assessment?: string;
  teacher_notes?: string;
  shared_with_student?: boolean;
  shared_at?: string;
}

export interface ClassWithStudentsAndResults {
  classGroup: ClassGroup;
  students: Student[];
  assignments: Assignment[];
  results: { [studentId: string]: { [assignmentId: string]: StudentResult } };
  subjects?: string[];
  collaborators?: ClassCollaborator[];
}

// =============================================
// DEMO DATA
// =============================================

// Generate students for each class
function generateStudentsForClass(classId: string, count: number): Student[] {
  const firstNames = ['Anna', 'Jakub', 'Tereza', 'Martin', 'Karolína', 'David', 'Eliška', 'Tomáš', 'Natálie', 'Filip', 
                      'Adéla', 'Ondřej', 'Viktorie', 'Lukáš', 'Barbora', 'Vojtěch', 'Kristýna', 'Matyáš', 'Sofie', 'Adam',
                      'Michaela', 'Štěpán', 'Klára', 'Dominik', 'Nela', 'Matěj', 'Julie', 'Daniel', 'Emma', 'Jan'];
  const lastNames = ['Nováková', 'Svoboda', 'Dvořáková', 'Černý', 'Procházková', 'Kučera', 'Veselá', 'Horák', 'Marková', 'Poláček',
                     'Králová', 'Němec', 'Růžičková', 'Fiala', 'Šimková', 'Kolář', 'Benešová', 'Holub', 'Urbanová', 'Kopecký',
                     'Vlčková', 'Marek', 'Pavlíková', 'Novotný', 'Jelínková', 'Urban', 'Krejčí', 'Dostál', 'Hrubá', 'Pospíšil'];
  const colors = ['#EC4899', '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#84CC16'];
  
  const students: Student[] = [];
  for (let i = 0; i < count; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[i % lastNames.length];
    const name = `${firstName} ${lastName}`;
    const initials = `${firstName[0]}${lastName[0]}`;
    
    students.push({
      id: `s_${classId}_${i + 1}`,
      name,
      class_id: classId,
      initials,
      color: colors[i % colors.length],
      created_at: '2024-09-01',
    });
  }
  return students;
}

// Generate assignments for each class - with individual work randomly interspersed
// These represent actual boards that were shared with the class
function generateAssignmentsForClass(classId: string): Assignment[] {
  // Only generate full data for class 1 (6.A), simpler for others
  if (classId !== '1') {
    return [
      { id: `a_${classId}_1`, title: 'Úvodní test', type: 'test', class_id: classId, board_id: 'board_intro', due_date: '2024-09-15', created_at: '2024-09-01', subject: 'Fyzika' },
      { id: `a_${classId}_2`, title: 'Procvičování', type: 'practice', class_id: classId, board_id: 'board_practice1', due_date: '2024-10-01', created_at: '2024-09-20', subject: 'Fyzika' },
      { id: `a_${classId}_3`, title: 'Pololetní test', type: 'test', class_id: classId, board_id: 'board_mid', due_date: '2024-12-15', created_at: '2024-12-01', subject: 'Fyzika' },
    ];
  }
  
  // Full demo data for class 6.A - FYZIKA
  const fyzikaAssignments: Assignment[] = [
    // Board 1: Hmota - živá relace (test)
    { id: `a_1_1`, title: 'Hmota a její vlastnosti', type: 'test', class_id: '1', board_id: 'board_hmota', due_date: '2024-09-08', created_at: '2024-09-01', subject: 'Fyzika' },
    // Individual work on Hmota board
    { id: `i_1_1`, title: 'Hmota', type: 'individual', class_id: '1', board_id: 'board_hmota', due_date: '2024-09-10', created_at: '2024-09-09', subject: 'Fyzika' },
    { id: `i_1_2`, title: 'Hmota', type: 'individual', class_id: '1', board_id: 'board_hmota', due_date: '2024-09-12', created_at: '2024-09-11', subject: 'Fyzika' },
    
    // Board 2: Síla a pohyb - procvičování
    { id: `a_1_2`, title: 'Síla a pohyb', type: 'practice', class_id: '1', board_id: 'board_sila', due_date: '2024-09-21', created_at: '2024-09-15', subject: 'Fyzika' },
    // Individual work
    { id: `i_1_3`, title: 'Síla', type: 'individual', class_id: '1', board_id: 'board_sila', due_date: '2024-09-23', created_at: '2024-09-22', subject: 'Fyzika' },
    { id: `i_1_4`, title: 'Pohyb', type: 'individual', class_id: '1', board_id: 'board_pohyb', due_date: '2024-09-25', created_at: '2024-09-24', subject: 'Fyzika' },
    { id: `i_1_5`, title: 'Síla', type: 'individual', class_id: '1', board_id: 'board_sila', due_date: '2024-09-27', created_at: '2024-09-26', subject: 'Fyzika' },
    
    // Board 3: Newtonovy zákony - test
    { id: `a_1_3`, title: 'Newtonovy zákony', type: 'test', class_id: '1', board_id: 'board_newton', due_date: '2024-10-05', created_at: '2024-09-28', subject: 'Fyzika' },
    // Individual work
    { id: `i_1_6`, title: 'Newton', type: 'individual', class_id: '1', board_id: 'board_newton', due_date: '2024-10-08', created_at: '2024-10-06', subject: 'Fyzika' },
    { id: `i_1_7`, title: 'Newton', type: 'individual', class_id: '1', board_id: 'board_newton', due_date: '2024-10-10', created_at: '2024-10-09', subject: 'Fyzika' },
    
    // Board 4: Práce a energie - test
    { id: `a_1_4`, title: 'Práce a energie', type: 'test', class_id: '1', board_id: 'board_prace', due_date: '2024-10-20', created_at: '2024-10-12', subject: 'Fyzika' },
    // Individual work
    { id: `i_1_8`, title: 'Práce', type: 'individual', class_id: '1', board_id: 'board_prace', due_date: '2024-10-22', created_at: '2024-10-21', subject: 'Fyzika' },
    
    // Board 5: Energie - procvičování
    { id: `a_1_5`, title: 'Procvičování Energie', type: 'practice', class_id: '1', board_id: 'board_energie', due_date: '2024-11-02', created_at: '2024-10-26', subject: 'Fyzika' },
    // Individual work
    { id: `i_1_9`, title: 'Energie', type: 'individual', class_id: '1', board_id: 'board_energie', due_date: '2024-11-05', created_at: '2024-11-03', subject: 'Fyzika' },
    { id: `i_1_10`, title: 'Energie', type: 'individual', class_id: '1', board_id: 'board_energie', due_date: '2024-11-07', created_at: '2024-11-06', subject: 'Fyzika' },
    { id: `i_1_11`, title: 'Opak.', type: 'individual', class_id: '1', board_id: 'board_energie', due_date: '2024-11-09', created_at: '2024-11-08', subject: 'Fyzika' },
    
    // Board 6: Teplo a teplota - test
    { id: `a_1_6`, title: 'Teplo a teplota', type: 'test', class_id: '1', board_id: 'board_teplo', due_date: '2024-11-18', created_at: '2024-11-10', subject: 'Fyzika' },
    // Individual work
    { id: `i_1_12`, title: 'Teplo', type: 'individual', class_id: '1', board_id: 'board_teplo', due_date: '2024-11-20', created_at: '2024-11-19', subject: 'Fyzika' },
    { id: `i_1_13`, title: 'Teplo', type: 'individual', class_id: '1', board_id: 'board_teplo', due_date: '2024-11-22', created_at: '2024-11-21', subject: 'Fyzika' },
    
    // Board 7: Teplo - procvičování
    { id: `a_1_7`, title: 'Procvič. Teplo', type: 'practice', class_id: '1', board_id: 'board_teplo2', due_date: '2024-11-28', created_at: '2024-11-22', subject: 'Fyzika' },
    // Individual work
    { id: `i_1_14`, title: 'Test', type: 'individual', class_id: '1', board_id: 'board_teplo2', due_date: '2024-12-01', created_at: '2024-11-29', subject: 'Fyzika' },
    
    // Board 8: Závěrečný test
    { id: `a_1_8`, title: 'Závěrečný test', type: 'test', class_id: '1', board_id: 'board_final', due_date: '2024-12-10', created_at: '2024-12-02', subject: 'Fyzika' },
  ];
  
  // MATEMATIKA assignments for class 6.A
  const matematikaAssignments: Assignment[] = [
    // Board 1: Zlomky
    { id: `m_1_1`, title: 'Zlomky - úvod', type: 'test', class_id: '1', board_id: 'board_zlomky', due_date: '2024-09-12', created_at: '2024-09-05', subject: 'Matematika' },
    { id: `mi_1_1`, title: 'Zlomky', type: 'individual', class_id: '1', board_id: 'board_zlomky', due_date: '2024-09-15', created_at: '2024-09-13', subject: 'Matematika' },
    { id: `mi_1_2`, title: 'Zlomky', type: 'individual', class_id: '1', board_id: 'board_zlomky', due_date: '2024-09-18', created_at: '2024-09-16', subject: 'Matematika' },
    
    // Board 2: Desetinná čísla
    { id: `m_1_2`, title: 'Desetinná čísla', type: 'practice', class_id: '1', board_id: 'board_desetinna', due_date: '2024-09-28', created_at: '2024-09-20', subject: 'Matematika' },
    { id: `mi_1_3`, title: 'Desítky', type: 'individual', class_id: '1', board_id: 'board_desetinna', due_date: '2024-10-01', created_at: '2024-09-29', subject: 'Matematika' },
    
    // Board 3: Procenta
    { id: `m_1_3`, title: 'Procenta', type: 'test', class_id: '1', board_id: 'board_procenta', due_date: '2024-10-15', created_at: '2024-10-08', subject: 'Matematika' },
    { id: `mi_1_4`, title: '%', type: 'individual', class_id: '1', board_id: 'board_procenta', due_date: '2024-10-18', created_at: '2024-10-16', subject: 'Matematika' },
    { id: `mi_1_5`, title: '%', type: 'individual', class_id: '1', board_id: 'board_procenta', due_date: '2024-10-20', created_at: '2024-10-19', subject: 'Matematika' },
    
    // Board 4: Rovnice
    { id: `m_1_4`, title: 'Rovnice', type: 'practice', class_id: '1', board_id: 'board_rovnice', due_date: '2024-11-05', created_at: '2024-10-28', subject: 'Matematika' },
    { id: `mi_1_6`, title: 'Rovn.', type: 'individual', class_id: '1', board_id: 'board_rovnice', due_date: '2024-11-08', created_at: '2024-11-06', subject: 'Matematika' },
    
    // Board 5: Geometrie
    { id: `m_1_5`, title: 'Geometrie - úhly', type: 'test', class_id: '1', board_id: 'board_geometrie', due_date: '2024-11-22', created_at: '2024-11-15', subject: 'Matematika' },
    { id: `mi_1_7`, title: 'Úhly', type: 'individual', class_id: '1', board_id: 'board_geometrie', due_date: '2024-11-25', created_at: '2024-11-23', subject: 'Matematika' },
    { id: `mi_1_8`, title: 'Geom.', type: 'individual', class_id: '1', board_id: 'board_geometrie', due_date: '2024-11-28', created_at: '2024-11-26', subject: 'Matematika' },
    
    // Board 6: Pololetní test
    { id: `m_1_6`, title: 'Pololetní test Mat', type: 'test', class_id: '1', board_id: 'board_mat_final', due_date: '2024-12-12', created_at: '2024-12-05', subject: 'Matematika' },
  ];
  
  return [...fyzikaAssignments, ...matematikaAssignments];
}

const DEMO_CLASSES: ClassGroup[] = [
  { id: '1', name: '6.A', teacher_id: 'demo', students_count: 28, created_at: '2024-09-01' },
  { id: '2', name: '6.B', teacher_id: 'demo', students_count: 26, created_at: '2024-09-01' },
  { id: '3', name: '7.A', teacher_id: 'demo', students_count: 24, created_at: '2024-09-01' },
  { id: '4', name: '7.B', teacher_id: 'demo', students_count: 25, created_at: '2024-09-01' },
  { id: '5', name: '8.A', teacher_id: 'demo', students_count: 22, created_at: '2024-09-01' },
  { id: '6', name: '8.B', teacher_id: 'demo', students_count: 23, created_at: '2024-09-01' },
  { id: '7', name: '9.A', teacher_id: 'demo', students_count: 21, created_at: '2024-09-01' },
  { id: '8', name: '9.B', teacher_id: 'demo', students_count: 20, created_at: '2024-09-01' },
];

// Generate all demo data
const DEMO_STUDENTS: Student[] = DEMO_CLASSES.flatMap(c => generateStudentsForClass(c.id, c.students_count || 20));
const DEMO_ASSIGNMENTS: Assignment[] = DEMO_CLASSES.flatMap(c => generateAssignmentsForClass(c.id));

// Generate random results for a specific class
function generateDemoResults(): { [studentId: string]: { [assignmentId: string]: StudentResult } } {
  const results: { [studentId: string]: { [assignmentId: string]: StudentResult } } = {};
  
  DEMO_STUDENTS.forEach(student => {
    results[student.id] = {};
    // Only use assignments for this student's class
    const classAssignments = DEMO_ASSIGNMENTS.filter(a => a.class_id === student.class_id);
    
    classAssignments.forEach(assignment => {
      // Random: 75% has result, 15% not done, 10% pending
      const rand = Math.random();
      let score: number | null = null;
      
      if (rand < 0.75) {
        // Has result - score between 4 and 10
        score = Math.floor(Math.random() * 7) + 4;
      } else if (rand < 0.9) {
        // Not done
        score = null;
      } else {
        // Pending (use -1 as marker)
        score = -1;
      }
      
      results[student.id][assignment.id] = {
        id: `r_${student.id}_${assignment.id}`,
        student_id: student.id,
        assignment_id: assignment.id,
        score,
        max_score: 10,
        completed_at: score !== null && score !== -1 ? new Date().toISOString() : undefined,
        time_spent_ms: score !== null && score !== -1 ? Math.floor(Math.random() * 600000) + 60000 : undefined,
      };
    });
  });
  
  return results;
}

// Cache demo results to avoid regenerating on each call
let cachedDemoResults: { [studentId: string]: { [assignmentId: string]: StudentResult } } | null = null;

function getDemoResults(): { [studentId: string]: { [assignmentId: string]: StudentResult } } {
  if (!cachedDemoResults) {
    cachedDemoResults = generateDemoResults();
  }
  return cachedDemoResults;
}

// =============================================
// DATA SOURCE TOGGLE
// =============================================

// Always read from localStorage to avoid HMR issues
function getUseSupabaseData(): boolean {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('use_supabase_data');
    const result = saved === 'true';
    
    return result;
  }
  
  return false;
}

export function setDataSource(useSupabase: boolean): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('use_supabase_data', useSupabase ? 'true' : 'false');
  }
}

export function isUsingSupabase(): boolean {
  return getUseSupabaseData();
}

// =============================================
// CLASS FUNCTIONS
// =============================================

export async function getClasses(teacherId?: string): Promise<ClassGroup[]> {
  const startTime = Date.now();
  console.log('[getClasses] Starting...');
  
  if (!getUseSupabaseData()) {
    console.log('[getClasses] Using demo data');
    return DEMO_CLASSES;
  }
  
  try {
    let url = `https://${projectId}.supabase.co/rest/v1/classes?select=*&order=name`;
    
    // Only filter by teacher_id if it's a valid UUID
    if (teacherId && teacherId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      url += `&teacher_id=eq.${teacherId}`;
    }
    
    // Fast fetch with short timeout
    const response = await fetchWithRetry(url, {
      timeout: 5000,
      retries: 1
    });
    
    if (!response.ok) {
      console.error(`[getClasses] HTTP error ${response.status}`);
      return [];
    }
    
    const classes = await response.json();
    
    if (!classes || classes.length === 0) {
      console.log('[getClasses] No classes found');
      return [];
    }
    
    // Fetch student counts in parallel (wait for it)
    try {
      const classIds = classes.map((c: ClassGroup) => c.id);
      const studentsUrl = `https://${projectId}.supabase.co/rest/v1/students?select=id,class_id&class_id=in.(${classIds.join(',')})`;
      
      const studentsResponse = await fetchWithRetry(studentsUrl, {
        timeout: 3000,
        retries: 0
      });
      
      if (studentsResponse.ok) {
        const students = await studentsResponse.json();
        
        // Count students per class
        const countPerClass: Record<string, number> = {};
        (students || []).forEach((s: { class_id: string }) => {
          countPerClass[s.class_id] = (countPerClass[s.class_id] || 0) + 1;
        });
        
        // Update classes with actual counts
        classes.forEach((c: ClassGroup) => {
          c.students_count = countPerClass[c.id] || 0;
        });
      }
    } catch (err) {
      console.warn('[getClasses] Failed to fetch student counts:', err);
    }
    
    const duration = Date.now() - startTime;
    console.log(`[getClasses] Completed in ${duration}ms, found ${classes.length} classes`);
    
    return classes;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[getClasses] Error after ${duration}ms:`, error);
    return [];
  }
}

export async function createClass(name: string, teacherId?: string): Promise<ClassGroup | null> {
  if (!getUseSupabaseData()) {
    const newClass: ClassGroup = {
      id: `c_${Date.now()}`,
      name,
      teacher_id: teacherId || 'demo',
      students_count: 0,
      created_at: new Date().toISOString(),
    };
    DEMO_CLASSES.push(newClass);
    return newClass;
  }
  
  try {
    // Ensure we have a teacher - create default one if needed
    let actualTeacherId = teacherId;
    
    if (!actualTeacherId) {
      // Check if default teacher exists
      const { data: existingTeacher } = await supabase
        .from('teachers')
        .select('id')
        .limit(1)
        .single();
      
      if (existingTeacher) {
        actualTeacherId = existingTeacher.id;
      } else {
        // Create default teacher
        const { data: newTeacher, error: teacherError } = await supabase
          .from('teachers')
          .insert({
            email: 'demo@vividbooks.cz',
            name: 'Demo Učitel',
          })
          .select()
          .single();
        
        if (teacherError) {
          console.error('Error creating teacher:', teacherError);
          return null;
        }
        actualTeacherId = newTeacher.id;
      }
    }
    
    // Create the class
    const { data, error } = await supabase
      .from('classes')
      .insert({ name, teacher_id: actualTeacherId })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating class:', error);
      throw error;
    }
    
    console.log('Class created successfully:', data);
    return data;
  } catch (error) {
    console.error('Error creating class:', error);
    return null;
  }
}

export async function deleteClass(classId: string): Promise<boolean> {
  if (!getUseSupabaseData()) {
    const index = DEMO_CLASSES.findIndex(c => c.id === classId);
    if (index !== -1) {
      DEMO_CLASSES.splice(index, 1);
      return true;
    }
    return false;
  }
  
  try {
    const { error } = await supabase
      .from('classes')
      .delete()
      .eq('id', classId);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting class:', error);
    return false;
  }
}

export async function updateClass(classId: string, updates: { name?: string; color?: string }): Promise<ClassGroup | null> {
  if (!getUseSupabaseData()) {
    const classToUpdate = DEMO_CLASSES.find(c => c.id === classId);
    if (classToUpdate) {
      if (updates.name) classToUpdate.name = updates.name;
      // Demo doesn't have color field, but we can add it
      return classToUpdate;
    }
    return null;
  }
  
  try {
    const { data, error } = await supabase
      .from('classes')
      .update(updates)
      .eq('id', classId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating class:', error);
    return null;
  }
}

// =============================================
// STUDENT FUNCTIONS
// =============================================

export async function getStudents(classId: string): Promise<Student[]> {
  const startTime = Date.now();
  console.log('[getStudents] Starting for class:', classId);
  
  if (!getUseSupabaseData()) {
    return DEMO_STUDENTS.filter(s => s.class_id === classId);
  }
  
  try {
    const url = `https://${projectId}.supabase.co/rest/v1/students?select=*&class_id=eq.${classId}&order=name`;
    
    // Use robust fetch with retry
    const response = await fetchWithRetry(url, {
      timeout: 10000,
      retries: 2
    });
    
    const duration = Date.now() - startTime;
    
    if (!response.ok) {
      console.error(`[getStudents] HTTP error ${response.status} after ${duration}ms`);
      return [];
    }
    
    const data = await response.json();
    console.log(`[getStudents] Completed in ${duration}ms, found ${data?.length || 0} students`);
    
    return data || [];
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[getStudents] Error after ${duration}ms:`, error);
    return [];
  }
}

export async function addStudent(student: Omit<Student, 'id' | 'created_at'>): Promise<Student | null> {
  const isSupabase = getUseSupabaseData();
  console.log('addStudent called with:', student, 'useSupabaseData:', isSupabase);
  
  if (!isSupabase) {
    console.log('Adding student to DEMO_STUDENTS (demo mode)');
    const newStudent: Student = {
      ...student,
      id: `s_${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    DEMO_STUDENTS.push(newStudent);
    return newStudent;
  }
  
  console.log('Adding student to Supabase...');
  try {
    const { data, error } = await supabase
      .from('students')
      .insert(student)
      .select()
      .single();
    
    if (error) {
      console.error('Supabase error adding student:', error);
      throw error;
    }
    console.log('Student added successfully:', data);
    return data;
  } catch (error) {
    console.error('Error adding student:', error);
    return null;
  }
}

export async function updateStudent(studentId: string, updates: Partial<Pick<Student, 'name' | 'email' | 'initials' | 'color'>>): Promise<Student | null> {
  if (!getUseSupabaseData()) {
    const index = DEMO_STUDENTS.findIndex(s => s.id === studentId);
    if (index !== -1) {
      DEMO_STUDENTS[index] = { ...DEMO_STUDENTS[index], ...updates, updated_at: new Date().toISOString() };
      return DEMO_STUDENTS[index];
    }
    return null;
  }
  
  try {
    const { data, error } = await supabase
      .from('students')
      .update(updates)
      .eq('id', studentId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating student:', error);
    return null;
  }
}

export async function deleteStudent(studentId: string): Promise<boolean> {
  if (!getUseSupabaseData()) {
    const index = DEMO_STUDENTS.findIndex(s => s.id === studentId);
    if (index !== -1) {
      DEMO_STUDENTS.splice(index, 1);
      return true;
    }
    return false;
  }
  
  try {
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', studentId);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting student:', error);
    return false;
  }
}

/**
 * Generate a password setup token for a student
 * Returns the setup URL that can be shared with the student
 */
export async function generatePasswordSetupToken(studentId: string): Promise<{ token?: string; url?: string; error?: string }> {
  if (!getUseSupabaseData()) {
    // Demo mode - generate a fake token
    const token = `demo_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/student/setup/${token}`;
    return { token, url };
  }
  
  try {
    // Generate a secure random token
    const token = crypto.randomUUID() + '-' + Date.now().toString(36);
    
    // Set expiration to 7 days from now
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    
    // Update student with token
    const { data, error } = await supabase
      .from('students')
      .update({
        password_setup_token: token,
        password_setup_expires: expires.toISOString(),
      })
      .eq('id', studentId)
      .select()
      .single();
    
    if (error) {
      console.error('Error generating token:', error);
      return { error: 'Nepodařilo se vygenerovat odkaz.' };
    }
    
    if (!data.email) {
      return { error: 'Student nemá nastavený email.' };
    }
    
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/student/setup/${token}`;
    
    return { token, url };
  } catch (error: any) {
    console.error('Error generating password setup token:', error);
    return { error: error.message || 'Chyba při generování odkazu.' };
  }
}

/**
 * Get student's password setup status
 */
export async function getStudentAuthStatus(studentId: string): Promise<{ 
  hasAuth: boolean; 
  hasToken: boolean; 
  tokenExpired: boolean;
  setupUrl?: string;
}> {
  if (!getUseSupabaseData()) {
    return { hasAuth: false, hasToken: false, tokenExpired: false };
  }
  
  try {
    const { data, error } = await supabase
      .from('students')
      .select('auth_id, password_setup_token, password_setup_expires')
      .eq('id', studentId)
      .single();
    
    if (error || !data) {
      return { hasAuth: false, hasToken: false, tokenExpired: false };
    }
    
    const hasAuth = !!data.auth_id;
    const hasToken = !!data.password_setup_token;
    const tokenExpired = data.password_setup_expires ? new Date(data.password_setup_expires) < new Date() : false;
    
    let setupUrl: string | undefined;
    if (hasToken && !tokenExpired) {
      const baseUrl = window.location.origin;
      setupUrl = `${baseUrl}/student/setup/${data.password_setup_token}`;
    }
    
    return { hasAuth, hasToken, tokenExpired, setupUrl };
  } catch (error) {
    console.error('Error getting student auth status:', error);
    return { hasAuth: false, hasToken: false, tokenExpired: false };
  }
}

// =============================================
// ASSIGNMENT FUNCTIONS
// =============================================

export async function getAssignments(classId: string, includeIndividual: boolean = true): Promise<Assignment[]> {
  const startTime = Date.now();
  console.log('[getAssignments] Starting for class:', classId);
  
  if (!getUseSupabaseData()) {
    let assignments = DEMO_ASSIGNMENTS.filter(a => a.class_id === classId);
    if (!includeIndividual) {
      assignments = assignments.filter(a => a.type !== 'individual');
    }
    console.log(`[getAssignments] Completed (demo) in ${Date.now() - startTime}ms`);
    return assignments;
  }
  
  try {
    let url = `https://${projectId}.supabase.co/rest/v1/assignments?select=*&class_id=eq.${classId}&order=due_date`;
    if (!includeIndividual) {
      url += '&type=neq.individual';
    }
    
    // Use robust fetch with retry
    const response = await fetchWithRetry(url, {
      timeout: 10000,
      retries: 2
    });
    
    if (!response.ok) {
      console.error('[getAssignments] HTTP error', response.status);
      return [];
    }
    
    const data = await response.json();
    console.log(`[getAssignments] Completed in ${Date.now() - startTime}ms, found ${data?.length || 0} assignments`);
    return data || [];
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[getAssignments] Error after ${duration}ms:`, error);
    return [];
  }
}

export async function createAssignment(assignment: Omit<Assignment, 'id' | 'created_at'>): Promise<Assignment | null> {
  if (!getUseSupabaseData()) {
    const newAssignment: Assignment = {
      ...assignment,
      id: `a_${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    DEMO_ASSIGNMENTS.push(newAssignment);
    return newAssignment;
  }
  
  try {
    const { data, error } = await supabase
      .from('assignments')
      .insert(assignment)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating assignment:', error);
    return null;
  }
}

// =============================================
// RESULTS FUNCTIONS
// =============================================

export async function getResults(classId: string): Promise<{ [studentId: string]: { [assignmentId: string]: StudentResult } }> {
  const startTime = Date.now();
  console.log('[getResults] Starting for class:', classId);
  
  if (!getUseSupabaseData()) {
    // Filter results for students in this class
    const allResults = getDemoResults();
    const classStudents = DEMO_STUDENTS.filter(s => s.class_id === classId);
    const filteredResults: { [studentId: string]: { [assignmentId: string]: StudentResult } } = {};
    
    classStudents.forEach(student => {
      if (allResults[student.id]) {
        filteredResults[student.id] = allResults[student.id];
      }
    });
    
    console.log(`[getResults] Completed (demo) in ${Date.now() - startTime}ms`);
    return filteredResults;
  }
  
  try {
    // Get students and assignments in parallel for better performance
    const [students, assignments] = await Promise.all([
      getStudents(classId),
      getAssignments(classId),
    ]);
    
    const studentIds = students.map(s => s.id);
    const assignmentIds = assignments.map(a => a.id);
    
    // Build URL with IN filters
    const studentIdsParam = studentIds.length > 0 ? `student_id=in.(${studentIds.join(',')})` : '';
    const assignmentIdsParam = assignmentIds.length > 0 ? `assignment_id=in.(${assignmentIds.join(',')})` : '';
    
    let url = `https://${projectId}.supabase.co/rest/v1/results?select=*`;
    if (studentIdsParam) url += `&${studentIdsParam}`;
    if (assignmentIdsParam) url += `&${assignmentIdsParam}`;
    
    // Use robust fetch with retry
    const response = await fetchWithRetry(url, {
      timeout: 10000,
      retries: 2
    });
    
    let data: StudentResult[] = [];
    if (response.ok) {
      data = await response.json();
    }
    
    // Transform to nested object
    const results: { [studentId: string]: { [assignmentId: string]: StudentResult } } = {};
    
    students.forEach(student => {
      results[student.id] = {};
    });
    
    (data || []).forEach((result: StudentResult) => {
      if (!results[result.student_id]) {
        results[result.student_id] = {};
      }
      results[result.student_id][result.assignment_id] = result;
    });
    
    console.log(`[getResults] Completed in ${Date.now() - startTime}ms, found ${data.length} results`);
    return results;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[getResults] Error after ${duration}ms:`, error);
    return {};
  }
}

export async function saveResult(result: Omit<StudentResult, 'id'>): Promise<StudentResult | null> {
  if (!getUseSupabaseData()) {
    // Update demo data
    return { ...result, id: `r_${Date.now()}` };
  }
  
  try {
    const { data, error } = await supabase
      .from('results')
      .upsert(result, { onConflict: 'student_id,assignment_id' })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving result:', error);
    return null;
  }
}

// =============================================
// FULL CLASS DATA
// =============================================

export async function getClassWithData(classId: string, includeIndividual: boolean = true): Promise<ClassWithStudentsAndResults | null> {
  const startTime = Date.now();
  console.log('[getClassWithData] Starting for class:', classId);
  
  try {
    const classes = await getClasses();
    const classGroup = classes.find(c => c.id === classId);
    
    if (!classGroup) {
      console.log('[getClassWithData] Class not found');
      return null;
    }
    
    // Load data in parallel for better performance
    const [students, assignments, results] = await Promise.all([
      getStudents(classId).catch(e => { console.error('[getClassWithData] getStudents error:', e); return []; }),
      getAssignments(classId, includeIndividual).catch(e => { console.error('[getClassWithData] getAssignments error:', e); return []; }),
      getResults(classId).catch(e => { console.error('[getClassWithData] getResults error:', e); return {}; }),
    ]);
    
    const duration = Date.now() - startTime;
    console.log(`[getClassWithData] Completed in ${duration}ms`);
    
    return {
      classGroup,
      students,
      assignments,
      results,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[getClassWithData] Error after ${duration}ms:`, error);
    return null;
  }
}

// =============================================
// SYNC INDIVIDUAL WORK FROM FIREBASE
// =============================================

export async function syncIndividualWorkToClass(
  classId: string,
  boardId: string,
  boardTitle: string,
  studentResults: Array<{ studentName: string; score: number; maxScore: number; timeSpentMs: number; completedAt: string }>
): Promise<void> {
  console.log('[syncIndividualWork] Starting sync:', { classId, boardId, boardTitle, results: studentResults.length });
  
  const assignmentTitle = `${boardTitle} - ind.`;
  
  // Demo mode
  if (!getUseSupabaseData()) {
    const existingAssignment = DEMO_ASSIGNMENTS.find(
      a => a.type === 'individual' && a.board_id === boardId && a.class_id === classId
    );
    
    if (!existingAssignment) {
      DEMO_ASSIGNMENTS.push({
        id: `i_${Date.now()}`,
        title: assignmentTitle,
        type: 'individual',
        class_id: classId,
        board_id: boardId,
        due_date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
      });
    }
    console.log('[syncIndividualWork] Demo mode - saved to DEMO_ASSIGNMENTS');
    return;
  }
  
  // Supabase mode
  const authToken = await getAuthToken();
  if (!authToken) {
    console.warn('[syncIndividualWork] No auth token available, aborting');
    return;
  }
  
  try {
    // 1. Find or create assignment (using title to identify, since board_id column doesn't exist)
    let assignmentId: string;
    
    // Check if assignment exists by title and class
    const checkUrl = `https://${projectId}.supabase.co/rest/v1/assignments?select=id&class_id=eq.${classId}&title=eq.${encodeURIComponent(assignmentTitle)}&type=eq.individual`;
    const checkResponse = await fetch(checkUrl, {
      headers: {
        'apikey': publicAnonKey,
        'Authorization': `Bearer ${authToken}`,
      }
    });
    
    const existingAssignments = await checkResponse.json();
    console.log('[syncIndividualWork] Existing assignments:', existingAssignments);
    
    if (Array.isArray(existingAssignments) && existingAssignments.length > 0) {
      assignmentId = existingAssignments[0].id;
      console.log('[syncIndividualWork] Found existing assignment:', assignmentId);
    } else {
      // Create new assignment (without board_id since column doesn't exist)
      const createUrl = `https://${projectId}.supabase.co/rest/v1/assignments`;
      const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'apikey': publicAnonKey,
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          title: assignmentTitle,
          type: 'individual',
          class_id: classId,
          subject: 'Individuální práce',
          due_date: new Date().toISOString().split('T')[0],
        }),
      });
      
      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        console.error('[syncIndividualWork] Failed to create assignment:', errorData);
        return;
      }
      
      const newAssignments = await createResponse.json();
      console.log('[syncIndividualWork] Created assignment:', newAssignments);
      
      if (!Array.isArray(newAssignments) || newAssignments.length === 0) {
        console.error('[syncIndividualWork] No assignment returned');
        return;
      }
      assignmentId = newAssignments[0].id;
    }
    
    // 2. Save results for each student
    for (const result of studentResults) {
      // Find student by name
      const students = await getStudents(classId);
      const student = students.find(s => s.name === result.studentName);
      
      if (!student) {
        console.log('[syncIndividualWork] Student not found:', result.studentName);
        continue;
      }
      
      console.log('[syncIndividualWork] Found student:', student.name, student.id);
      
      // Upsert result
      const resultUrl = `https://${projectId}.supabase.co/rest/v1/results`;
      const percentage = result.maxScore > 0 ? Math.round((result.score / result.maxScore) * 100) : 0;
      const resultResponse = await fetch(resultUrl, {
        method: 'POST',
        headers: {
          'apikey': publicAnonKey,
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          student_id: student.id,
          assignment_id: assignmentId,
          score: result.score,
          max_score: result.maxScore,
          percentage: percentage,
          correct_count: result.score,
          total_questions: result.maxScore,
          completed_at: result.completedAt,
          time_spent_ms: result.timeSpentMs,
        }),
      });
      
      if (resultResponse.ok) {
        console.log('[syncIndividualWork] Saved result for:', student.name, result.score, '/', result.maxScore);
      } else {
        const errorText = await resultResponse.text();
        console.error('[syncIndividualWork] Failed to save result:', errorText);
      }
    }
    
    console.log('[syncIndividualWork] Sync complete');
  } catch (error) {
    console.error('[syncIndividualWork] Error:', error);
  }
}

// =============================================
// SYNC LIVE SESSION RESULTS TO SUPABASE
// =============================================

export interface LiveSessionResult {
  studentName: string;
  responses: Array<{
    slideId: string;
    score: number;
    maxScore: number;
    isCorrect: boolean;
  }>;
  totalScore: number;
  maxPossibleScore: number;
  timeSpentMs?: number;
  completedAt: string;
}

/**
 * Sync results from a live quiz session to Supabase
 * Called when teacher ends the session
 */
export async function syncResultsToSupabase(
  sessionId: string,
  quizId: string,
  quizTitle: string,
  classId: string | undefined,
  results: LiveSessionResult[]
): Promise<void> {
  if (!getUseSupabaseData()) {
    console.log('Supabase sync skipped - using demo data');
    return;
  }
  
  if (!classId) {
    console.log('Supabase sync skipped - no class ID');
    return;
  }
  
  try {
    // Create or find assignment for this session
    const assignmentTitle = `${quizTitle} - ${new Date().toLocaleDateString('cs-CZ')}`;
    
    // Check if assignment exists for this session
    const { data: existingAssignments } = await supabase
      .from('assignments')
      .select('id')
      .eq('class_id', classId)
      .eq('title', assignmentTitle)
      .eq('type', 'test');
    
    let assignmentId: string;
    
    if (existingAssignments && existingAssignments.length > 0) {
      assignmentId = existingAssignments[0].id;
    } else {
      const { data: newAssignment, error: assignmentError } = await supabase
        .from('assignments')
        .insert({
          title: assignmentTitle,
          type: 'test',
          class_id: classId,
          board_id: quizId,
          due_date: new Date().toISOString().split('T')[0],
        })
        .select()
        .single();
      
      if (assignmentError || !newAssignment) {
        console.error('Error creating assignment:', assignmentError);
        return;
      }
      assignmentId = newAssignment.id;
    }
    
    // Save results for each student
    for (const result of results) {
      // Find or create student
      const { data: students } = await supabase
        .from('students')
        .select('id')
        .eq('class_id', classId)
        .ilike('name', result.studentName);
      
      let studentId: string;
      
      if (students && students.length > 0) {
        studentId = students[0].id;
      } else {
        // Create new student
        const initials = result.studentName
          .split(' ')
          .map(n => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);
        
        const colors = ['#EC4899', '#F59E0B', '#10B981', '#6366F1', '#EF4444', '#8B5CF6'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
        const { data: newStudent, error: studentError } = await supabase
          .from('students')
          .insert({
            name: result.studentName,
            class_id: classId,
            initials,
            color: randomColor,
          })
          .select()
          .single();
        
        if (studentError || !newStudent) {
          console.error('Error creating student:', studentError);
          continue;
        }
        studentId = newStudent.id;
      }
      
      // Save result
      await supabase.from('results').upsert({
        student_id: studentId,
        assignment_id: assignmentId,
        score: result.totalScore,
        max_score: result.maxPossibleScore,
        completed_at: result.completedAt,
        time_spent_ms: result.timeSpentMs,
      }, { onConflict: 'student_id,assignment_id' });
    }
    
    console.log(`Synced ${results.length} results to Supabase for session ${sessionId}`);
  } catch (error) {
    console.error('Error syncing results to Supabase:', error);
  }
}

// =============================================
// SUBJECT MANAGEMENT
// =============================================

/**
 * Get subjects for a class
 */
export async function getClassSubjects(classId: string): Promise<ClassSubject[]> {
  // Helper to get subjects from localStorage
  const getFromLocalStorage = (): ClassSubject[] => {
    const saved = localStorage.getItem(`class_${classId}_subjects`);
    if (saved) {
      const subjectNames = JSON.parse(saved) as string[];
      return subjectNames.map((name, i) => ({
        id: `subj_local_${i}`,
        class_id: classId,
        subject_name: name,
        teacher_id: 'local',
        is_owner: i === 0,
        created_at: new Date().toISOString(),
      }));
    }
    // Default subject
    return [
      { id: 'subj_default', class_id: classId, subject_name: 'Fyzika', teacher_id: 'local', is_owner: true, created_at: new Date().toISOString() },
    ];
  };
  
  if (!getUseSupabaseData()) {
    return getFromLocalStorage();
  }
  
  try {
    const { data, error } = await supabase
      .from('class_subjects')
      .select('*')
      .eq('class_id', classId)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching class subjects:', error);
      return getFromLocalStorage();
    }
    
    // If Supabase has subjects, return them; otherwise fallback to localStorage
    if (data && data.length > 0) {
      return data;
    }
    
    return getFromLocalStorage();
  } catch (error) {
    console.error('Error fetching class subjects:', error);
    return getFromLocalStorage();
  }
}

/**
 * Add a subject to a class
 */
export async function addClassSubject(classId: string, subjectName: string, teacherId: string): Promise<ClassSubject | null> {
  if (!getUseSupabaseData()) {
    // Save to localStorage for demo
    const saved = localStorage.getItem(`class_${classId}_subjects`);
    const subjects = saved ? JSON.parse(saved) as string[] : ['Fyzika'];
    if (!subjects.includes(subjectName)) {
      subjects.push(subjectName);
      localStorage.setItem(`class_${classId}_subjects`, JSON.stringify(subjects));
    }
    return {
      id: `subj_${Date.now()}`,
      class_id: classId,
      subject_name: subjectName,
      teacher_id: teacherId,
      is_owner: false,
      created_at: new Date().toISOString(),
    };
  }
  
  const { data, error } = await supabase
    .from('class_subjects')
    .insert({
      class_id: classId,
      subject_name: subjectName,
      teacher_id: teacherId,
      is_owner: false,
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error adding class subject:', error);
    return null;
  }
  
  return data;
}

/**
 * Remove a subject from a class
 */
export async function removeClassSubject(classId: string, subjectName: string): Promise<boolean> {
  if (!getUseSupabaseData()) {
    const saved = localStorage.getItem(`class_${classId}_subjects`);
    if (saved) {
      const subjects = JSON.parse(saved) as string[];
      const filtered = subjects.filter(s => s !== subjectName);
      localStorage.setItem(`class_${classId}_subjects`, JSON.stringify(filtered));
    }
    return true;
  }
  
  const { error } = await supabase
    .from('class_subjects')
    .delete()
    .eq('class_id', classId)
    .eq('subject_name', subjectName);
  
  if (error) {
    console.error('Error removing class subject:', error);
    return false;
  }
  
  return true;
}

// =============================================
// COLLABORATOR MANAGEMENT
// =============================================

/**
 * Get collaborators for a class
 */
export async function getClassCollaborators(classId: string): Promise<ClassCollaborator[]> {
  if (!getUseSupabaseData()) {
    // Return from localStorage for demo
    const saved = localStorage.getItem(`class_${classId}_colleagues`);
    if (saved) {
      const colleagues = JSON.parse(saved) as Array<{ id: string; name: string; email: string; subject: string }>;
      return colleagues.map(c => ({
        id: c.id,
        class_id: classId,
        teacher_id: c.id,
        subject_name: c.subject,
        status: 'accepted' as const,
        invited_at: new Date().toISOString(),
        invited_by: 'demo',
        teacher_name: c.name,
        teacher_email: c.email,
      }));
    }
    return [];
  }
  
  const { data, error } = await supabase
    .from('class_collaborators')
    .select(`
      *,
      teachers:teacher_id (name, email)
    `)
    .eq('class_id', classId);
  
  if (error) {
    console.error('Error fetching collaborators:', error);
    return [];
  }
  
  return (data || []).map(d => ({
    ...d,
    teacher_name: (d.teachers as any)?.name,
    teacher_email: (d.teachers as any)?.email,
  }));
}

/**
 * Invite a collaborator to a class
 */
export async function inviteCollaborator(
  classId: string, 
  email: string, 
  subjectName: string, 
  invitedBy: string
): Promise<ClassCollaborator | null> {
  if (!getUseSupabaseData()) {
    // Save to localStorage for demo
    const saved = localStorage.getItem(`class_${classId}_colleagues`);
    const colleagues = saved ? JSON.parse(saved) as Array<{ id: string; name: string; email: string; subject: string }> : [];
    const newColleague = {
      id: `c_${Date.now()}`,
      name: email.split('@')[0],
      email: email,
      subject: subjectName || 'Čeká na potvrzení',
    };
    colleagues.push(newColleague);
    localStorage.setItem(`class_${classId}_colleagues`, JSON.stringify(colleagues));
    
    return {
      id: newColleague.id,
      class_id: classId,
      teacher_id: newColleague.id,
      subject_name: newColleague.subject,
      status: 'pending',
      invited_at: new Date().toISOString(),
      invited_by: invitedBy,
      teacher_name: newColleague.name,
      teacher_email: newColleague.email,
    };
  }
  
  // Find teacher by email
  const { data: teacher } = await supabase
    .from('teachers')
    .select('id')
    .eq('email', email)
    .single();
  
  if (!teacher) {
    // Create invitation for non-existing teacher (they'll see it when they sign up)
    console.log('Teacher not found, creating pending invitation');
  }
  
  const { data, error } = await supabase
    .from('class_collaborators')
    .insert({
      class_id: classId,
      teacher_id: teacher?.id || email, // Use email as placeholder if teacher doesn't exist
      subject_name: subjectName,
      status: 'pending',
      invited_by: invitedBy,
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error inviting collaborator:', error);
    return null;
  }
  
  return data;
}

/**
 * Remove a collaborator from a class
 */
export async function removeCollaborator(classId: string, collaboratorId: string): Promise<boolean> {
  if (!getUseSupabaseData()) {
    const saved = localStorage.getItem(`class_${classId}_colleagues`);
    if (saved) {
      const colleagues = JSON.parse(saved) as Array<{ id: string; name: string; email: string; subject: string }>;
      const filtered = colleagues.filter(c => c.id !== collaboratorId);
      localStorage.setItem(`class_${classId}_colleagues`, JSON.stringify(filtered));
    }
    return true;
  }
  
  const { error } = await supabase
    .from('class_collaborators')
    .delete()
    .eq('id', collaboratorId);
  
  if (error) {
    console.error('Error removing collaborator:', error);
    return false;
  }
  
  return true;
}

/**
 * Accept/reject a collaboration invitation
 */
export async function respondToInvitation(
  collaboratorId: string, 
  accept: boolean
): Promise<boolean> {
  if (!getUseSupabaseData()) {
    return true; // Demo mode - always succeed
  }
  
  const { error } = await supabase
    .from('class_collaborators')
    .update({
      status: accept ? 'accepted' : 'rejected',
      accepted_at: accept ? new Date().toISOString() : null,
    })
    .eq('id', collaboratorId);
  
  if (error) {
    console.error('Error responding to invitation:', error);
    return false;
  }
  
  return true;
}

// ============================================
// Live Session Notifications for Students
// ============================================

/**
 * Notify all online students in a class about a live session
 * Uses Firebase Realtime Database for reliable notifications
 */
export async function notifyClassOfLiveSession(
  classId: string,
  sessionId: string,
  documentPath: string,
  documentTitle: string
): Promise<void> {
  console.log('[NotifyClass] Sending notification to class via Firebase:', classId);
  
  // Import Firebase dynamically
  const { database } = await import('../firebase-config');
  const { ref, set } = await import('firebase/database');
  
  try {
    // Write notification to Firebase
    const notificationRef = ref(database, `class-notifications/${classId}`);
    await set(notificationRef, {
      sessionId,
      documentPath,
      documentTitle,
      timestamp: new Date().toISOString(),
      active: true,
    });
    
    console.log('[NotifyClass] Notification sent via Firebase successfully');
    
    // Also update class record in Supabase
    await supabase
      .from('classes')
      .update({
        active_session_id: sessionId,
        active_session_path: documentPath,
        active_session_title: documentTitle,
      })
      .eq('id', classId);
      
  } catch (error) {
    console.error('[NotifyClass] Error sending notification:', error);
    throw error;
  }
}

/**
 * End the live session notification for a class
 */
export async function endClassLiveSession(classId: string): Promise<void> {
  console.log('[EndSession] Ending session for class:', classId);
  
  // Import Firebase dynamically
  const { database } = await import('../firebase-config');
  const { ref, set } = await import('firebase/database');
  
  try {
    // Clear notification in Firebase
    const notificationRef = ref(database, `class-notifications/${classId}`);
    await set(notificationRef, {
      active: false,
      timestamp: new Date().toISOString(),
    });
    
    console.log('[EndSession] Session ended via Firebase');
  } catch (error) {
    console.error('[EndSession] Error ending session:', error);
  }
  
  // Clear the active session from the class record
  await supabase
    .from('classes')
    .update({
      active_session_id: null,
      active_session_path: null,
      active_session_title: null,
    })
    .eq('id', classId);
}

/**
 * Get count of online students in a class
 */
export async function getOnlineStudentsCount(classId: string): Promise<number> {
  if (!getUseSupabaseData()) {
    return 0; // Demo mode - no real online tracking
  }
  
  try {
    const { count, error } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('class_id', classId)
      .eq('is_online', true);
    
    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error getting online students count:', error);
    return 0;
  }
}

// =============================================
// SYNC QUIZ RESULTS TO CLASS
// =============================================

export interface QuizSessionResult {
  studentName: string;
  studentId?: string; // If student is logged in
  responses: Array<{
    slideId: string;
    answer: string | string[];
    isCorrect?: boolean;
    timeSpentMs?: number;
  }>;
  totalCorrect: number;
  totalQuestions: number;
  timeSpentMs: number;
}

/**
 * Sync quiz session results to a class
 * Creates an assignment and saves results for each student
 */
export async function syncQuizResultsToClass(
  classId: string,
  quizId: string,
  quizTitle: string,
  sessionId: string,
  studentResults: QuizSessionResult[],
  subject?: string
): Promise<{ success: boolean; assignmentId?: string; error?: string }> {
  console.log('[syncQuizResults] Starting sync to class:', classId, 'subject:', subject);
  console.log('[syncQuizResults] Students:', studentResults.length);
  
  if (!getUseSupabaseData()) {
    console.log('[syncQuizResults] Demo mode - skipping');
    return { success: true };
  }
  
  const authToken = await getAuthToken();
  if (!authToken) {
    console.warn('[syncQuizResults] No auth token available, aborting');
    return { success: false, error: 'No auth token' };
  }
  
  try {
    // 1. Get students from the class to match by name
    const classStudents = await getStudents(classId);
    console.log('[syncQuizResults] Class students:', classStudents.length);
    
    // 2. Create assignment for this quiz session
    // Note: board_id expects UUID, so we only set it if quizId is a valid UUID
    const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(quizId);
    
    const assignmentData: Record<string, any> = {
      title: quizTitle,
      type: 'live',
      class_id: classId,
      subject: subject || 'Kvíz', // Use provided subject or default
      session_id: sessionId,
      session_type: 'live',
      due_date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    };
    
    // Only add board_id if it's a valid UUID
    if (isValidUuid) {
      assignmentData.board_id = quizId;
    }
    
    const assignmentResponse = await fetch(`https://${projectId}.supabase.co/rest/v1/assignments`, {
      method: 'POST',
      headers: {
        'apikey': publicAnonKey,
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(assignmentData)
    });
    
    if (!assignmentResponse.ok) {
      const errorText = await assignmentResponse.text();
      console.error('[syncQuizResults] Failed to create assignment:', errorText);
      return { success: false, error: 'Failed to create assignment' };
    }
    
    const [assignment] = await assignmentResponse.json();
    console.log('[syncQuizResults] Created assignment:', assignment.id);
    
    // 3. Match students by ID first, then by name
    const resultsToSave: any[] = [];
    
    for (const result of studentResults) {
      let matchedStudentId: string | null = null;
      
      // First try to match by database ID (if student was logged in)
      if (result.studentId) {
        const studentExists = classStudents.find(s => s.id === result.studentId);
        if (studentExists) {
          matchedStudentId = result.studentId;
          console.log(`[syncQuizResults] Matched by ID: ${result.studentName} -> ${studentExists.name}`);
        }
      }
      
      // Fallback: match by name (case insensitive)
      if (!matchedStudentId) {
        const matchedStudent = classStudents.find(
          s => s.name.toLowerCase().trim() === result.studentName.toLowerCase().trim()
        );
        if (matchedStudent) {
          matchedStudentId = matchedStudent.id;
          console.log(`[syncQuizResults] Matched by name: ${result.studentName} -> ${matchedStudent.name}`);
        }
      }
      
      if (matchedStudentId) {
        const percentage = result.totalQuestions > 0 
          ? Math.round((result.totalCorrect / result.totalQuestions) * 100) 
          : 0;
        
        resultsToSave.push({
          student_id: matchedStudentId,
          assignment_id: assignment.id,
          score: result.totalCorrect,
          max_score: result.totalQuestions,
          percentage,
          correct_count: result.totalCorrect,
          total_questions: result.totalQuestions,
          time_spent_ms: result.timeSpentMs,
          completed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
        
        console.log(`[syncQuizResults] Saving result for ${result.studentName}: ${percentage}%`);
      } else {
        console.log(`[syncQuizResults] No match for: ${result.studentName}`);
      }
    }
    
    // 4. Save results
    if (resultsToSave.length > 0) {
      const resultsResponse = await fetch(`https://${projectId}.supabase.co/rest/v1/results`, {
        method: 'POST',
        headers: {
          'apikey': publicAnonKey,
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resultsToSave)
      });
      
      if (!resultsResponse.ok) {
        const errorText = await resultsResponse.text();
        console.error('[syncQuizResults] Failed to save results:', errorText);
        return { success: false, error: 'Failed to save results', assignmentId: assignment.id };
      }
      
      console.log(`[syncQuizResults] Saved ${resultsToSave.length} results`);
    }
    
    return { success: true, assignmentId: assignment.id };
  } catch (error) {
    console.error('[syncQuizResults] Error:', error);
    return { success: false, error: String(error) };
  }
}

// =============================================
// FORMATIVE ASSESSMENT FUNCTIONS
// =============================================

/**
 * Save or update formative assessment on a result
 */
export async function saveFormativeAssessment(
  resultId: string,
  assessment: string,
  teacherNotes?: string
): Promise<{ success: boolean; error?: string }> {
  const authToken = await getAuthToken();
  if (!authToken) {
    return { success: false, error: 'No auth token' };
  }
  
  try {
    const response = await fetch(`https://${projectId}.supabase.co/rest/v1/results?id=eq.${resultId}`, {
      method: 'PATCH',
      headers: {
        'apikey': publicAnonKey,
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        formative_assessment: assessment,
        teacher_notes: teacherNotes || null,
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[saveFormativeAssessment] Failed:', errorText);
      return { success: false, error: errorText };
    }
    
    console.log('[saveFormativeAssessment] Saved assessment for result:', resultId);
    return { success: true };
  } catch (error) {
    console.error('[saveFormativeAssessment] Error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Share formative assessment with student
 */
export async function shareFormativeAssessment(
  resultId: string
): Promise<{ success: boolean; error?: string }> {
  const authToken = await getAuthToken();
  if (!authToken) {
    return { success: false, error: 'No auth token' };
  }
  
  try {
    const response = await fetch(`https://${projectId}.supabase.co/rest/v1/results?id=eq.${resultId}`, {
      method: 'PATCH',
      headers: {
        'apikey': publicAnonKey,
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shared_with_student: true,
        shared_at: new Date().toISOString(),
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[shareFormativeAssessment] Failed:', errorText);
      return { success: false, error: errorText };
    }
    
    console.log('[shareFormativeAssessment] Shared assessment for result:', resultId);
    return { success: true };
  } catch (error) {
    console.error('[shareFormativeAssessment] Error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get result by student ID/name and session ID (for matching with quiz session)
 * Falls back to matching by student name if ID doesn't work
 */
export async function getResultByStudentAndSession(
  studentId: string | null,
  sessionId: string,
  studentName?: string
): Promise<StudentResult | null> {
  const authToken = await getAuthToken();
  if (!authToken) {
    console.warn('[getResultByStudentAndSession] No auth token available');
    return null;
  }
  
  console.log('[getResultByStudentAndSession] Looking for studentId:', studentId, 'studentName:', studentName, 'sessionId:', sessionId);
  
  try {
    // First get assignment by session_id
    const assignmentRes = await fetch(`https://${projectId}.supabase.co/rest/v1/assignments?session_id=eq.${sessionId}&select=id,class_id`, {
      headers: { 'apikey': publicAnonKey, 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!assignmentRes.ok) {
      console.log('[getResultByStudentAndSession] Assignment fetch failed');
      return null;
    }
    
    const assignments = await assignmentRes.json();
    console.log('[getResultByStudentAndSession] Found assignments:', assignments.length);
    
    if (assignments.length === 0) {
      console.log('[getResultByStudentAndSession] No assignment found with session_id:', sessionId);
      return null;
    }
    
    const assignmentId = assignments[0].id;
    const classId = assignments[0].class_id;
    console.log('[getResultByStudentAndSession] Using assignmentId:', assignmentId, 'classId:', classId);
    
    // Try to find result by student ID first
    if (studentId) {
      const resultRes = await fetch(`https://${projectId}.supabase.co/rest/v1/results?student_id=eq.${studentId}&assignment_id=eq.${assignmentId}&select=*`, {
        headers: { 'apikey': publicAnonKey, 'Authorization': `Bearer ${authToken}` }
      });
      
      if (resultRes.ok) {
        const results = await resultRes.json();
        console.log('[getResultByStudentAndSession] Found results by ID:', results.length);
        if (results.length > 0) return results[0];
      }
    }
    
    // Fallback: find by student name in the class
    if (studentName && classId) {
      console.log('[getResultByStudentAndSession] Trying fallback by student name:', studentName);
      
      // Get student by name in this class
      const studentRes = await fetch(`https://${projectId}.supabase.co/rest/v1/students?class_id=eq.${classId}&name=ilike.${encodeURIComponent(studentName)}&select=id`, {
        headers: { 'apikey': publicAnonKey, 'Authorization': `Bearer ${authToken}` }
      });
      
      if (studentRes.ok) {
        const students = await studentRes.json();
        console.log('[getResultByStudentAndSession] Found students by name:', students.length);
        
        if (students.length > 0) {
          const matchedStudentId = students[0].id;
          
          // Now get result for this student
          const resultRes = await fetch(`https://${projectId}.supabase.co/rest/v1/results?student_id=eq.${matchedStudentId}&assignment_id=eq.${assignmentId}&select=*`, {
            headers: { 'apikey': publicAnonKey, 'Authorization': `Bearer ${authToken}` }
          });
          
          if (resultRes.ok) {
            const results = await resultRes.json();
            console.log('[getResultByStudentAndSession] Found results by name fallback:', results.length);
            if (results.length > 0) return results[0];
          }
        }
      }
    }
    
    console.log('[getResultByStudentAndSession] No result found');
    return null;
  } catch (error) {
    console.error('[getResultByStudentAndSession] Error:', error);
    return null;
  }
}
