/**
 * Supabase Classes & Results Management
 * 
 * Tables needed in Supabase:
 * - classes: id, name, teacher_id, created_at
 * - students: id, name, class_id, email, created_at
 * - assignments: id, title, type (test/practice/individual), class_id, board_id, due_date, created_at
 * - results: id, student_id, assignment_id, score, max_score, completed_at, time_spent_ms
 */

import { supabase } from './client';

// =============================================
// TYPES
// =============================================

export interface ClassGroup {
  id: string;
  name: string;
  teacher_id: string;
  students_count?: number;
  created_at: string;
}

export interface Student {
  id: string;
  name: string;
  class_id: string;
  email?: string;
  initials: string;
  color: string;
  created_at: string;
}

export interface Assignment {
  id: string;
  title: string;
  type: 'test' | 'practice' | 'individual';
  class_id: string;
  board_id?: string;
  due_date: string;
  created_at: string;
}

export interface StudentResult {
  id: string;
  student_id: string;
  assignment_id: string;
  score: number | null; // null = not done, -1 = pending
  max_score: number;
  completed_at?: string;
  time_spent_ms?: number;
}

export interface ClassWithStudentsAndResults {
  classGroup: ClassGroup;
  students: Student[];
  assignments: Assignment[];
  results: { [studentId: string]: { [assignmentId: string]: StudentResult } };
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

// Generate assignments for each class
function generateAssignmentsForClass(classId: string): Assignment[] {
  return [
    { id: `a_${classId}_1`, title: 'Hmota a její vlastnosti', type: 'test', class_id: classId, due_date: '2024-09-15', created_at: '2024-09-01' },
    { id: `a_${classId}_2`, title: 'Síla a pohyb', type: 'practice', class_id: classId, due_date: '2024-10-02', created_at: '2024-09-25' },
    { id: `a_${classId}_3`, title: 'Newtonovy zákony', type: 'test', class_id: classId, due_date: '2024-10-18', created_at: '2024-10-10' },
    { id: `a_${classId}_4`, title: 'Práce a energie', type: 'test', class_id: classId, due_date: '2024-11-05', created_at: '2024-10-28' },
    { id: `a_${classId}_5`, title: 'Procvičování - Energie', type: 'practice', class_id: classId, due_date: '2024-11-15', created_at: '2024-11-08' },
    { id: `a_${classId}_6`, title: 'Teplo a teplota', type: 'test', class_id: classId, due_date: '2024-12-01', created_at: '2024-11-24' },
    { id: `i_${classId}_1`, title: 'Hmota - ind.', type: 'individual', class_id: classId, due_date: '2024-09-20', created_at: '2024-09-15' },
    { id: `i_${classId}_2`, title: 'Energie - ind.', type: 'individual', class_id: classId, due_date: '2024-11-10', created_at: '2024-11-05' },
  ];
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

let useSupabaseData = false;

export function setDataSource(useSupabase: boolean): void {
  useSupabaseData = useSupabase;
}

export function isUsingSupabase(): boolean {
  return useSupabaseData;
}

// =============================================
// CLASS FUNCTIONS
// =============================================

export async function getClasses(teacherId: string): Promise<ClassGroup[]> {
  if (!useSupabaseData) {
    return DEMO_CLASSES;
  }
  
  try {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('teacher_id', teacherId)
      .order('name');
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching classes:', error);
    return DEMO_CLASSES; // Fallback to demo
  }
}

export async function createClass(name: string, teacherId: string): Promise<ClassGroup | null> {
  if (!useSupabaseData) {
    const newClass: ClassGroup = {
      id: `c_${Date.now()}`,
      name,
      teacher_id: teacherId,
      students_count: 0,
      created_at: new Date().toISOString(),
    };
    DEMO_CLASSES.push(newClass);
    return newClass;
  }
  
  try {
    const { data, error } = await supabase
      .from('classes')
      .insert({ name, teacher_id: teacherId })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating class:', error);
    return null;
  }
}

export async function deleteClass(classId: string): Promise<boolean> {
  if (!useSupabaseData) {
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

// =============================================
// STUDENT FUNCTIONS
// =============================================

export async function getStudents(classId: string): Promise<Student[]> {
  if (!useSupabaseData) {
    return DEMO_STUDENTS.filter(s => s.class_id === classId);
  }
  
  try {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', classId)
      .order('name');
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching students:', error);
    return DEMO_STUDENTS.filter(s => s.class_id === classId);
  }
}

export async function addStudent(student: Omit<Student, 'id' | 'created_at'>): Promise<Student | null> {
  if (!useSupabaseData) {
    const newStudent: Student = {
      ...student,
      id: `s_${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    DEMO_STUDENTS.push(newStudent);
    return newStudent;
  }
  
  try {
    const { data, error } = await supabase
      .from('students')
      .insert(student)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error adding student:', error);
    return null;
  }
}

// =============================================
// ASSIGNMENT FUNCTIONS
// =============================================

export async function getAssignments(classId: string, includeIndividual: boolean = true): Promise<Assignment[]> {
  if (!useSupabaseData) {
    let assignments = DEMO_ASSIGNMENTS.filter(a => a.class_id === classId);
    if (!includeIndividual) {
      assignments = assignments.filter(a => a.type !== 'individual');
    }
    return assignments;
  }
  
  try {
    let query = supabase
      .from('assignments')
      .select('*')
      .eq('class_id', classId)
      .order('due_date');
    
    if (!includeIndividual) {
      query = query.neq('type', 'individual');
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return DEMO_ASSIGNMENTS.filter(a => a.class_id === classId);
  }
}

export async function createAssignment(assignment: Omit<Assignment, 'id' | 'created_at'>): Promise<Assignment | null> {
  if (!useSupabaseData) {
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
  if (!useSupabaseData) {
    // Filter results for students in this class
    const allResults = getDemoResults();
    const classStudents = DEMO_STUDENTS.filter(s => s.class_id === classId);
    const filteredResults: { [studentId: string]: { [assignmentId: string]: StudentResult } } = {};
    
    classStudents.forEach(student => {
      if (allResults[student.id]) {
        filteredResults[student.id] = allResults[student.id];
      }
    });
    
    return filteredResults;
  }
  
  try {
    // First get all students and assignments for this class
    const students = await getStudents(classId);
    const assignments = await getAssignments(classId);
    
    const studentIds = students.map(s => s.id);
    const assignmentIds = assignments.map(a => a.id);
    
    const { data, error } = await supabase
      .from('results')
      .select('*')
      .in('student_id', studentIds)
      .in('assignment_id', assignmentIds);
    
    if (error) throw error;
    
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
    
    return results;
  } catch (error) {
    console.error('Error fetching results:', error);
    return generateDemoResults();
  }
}

export async function saveResult(result: Omit<StudentResult, 'id'>): Promise<StudentResult | null> {
  if (!useSupabaseData) {
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
  const classes = await getClasses('demo');
  const classGroup = classes.find(c => c.id === classId);
  
  if (!classGroup) return null;
  
  const students = await getStudents(classId);
  const assignments = await getAssignments(classId, includeIndividual);
  const results = await getResults(classId);
  
  return {
    classGroup,
    students,
    assignments,
    results,
  };
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
  // Create or find assignment for this individual work
  const assignmentTitle = `${boardTitle} - ind.`;
  
  // In demo mode, just add to the arrays
  if (!useSupabaseData) {
    const existingAssignment = DEMO_ASSIGNMENTS.find(
      a => a.type === 'individual' && a.title === assignmentTitle && a.class_id === classId
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
    return;
  }
  
  // Supabase mode - create assignment and results
  try {
    // Check if assignment exists
    const { data: existingAssignments } = await supabase
      .from('assignments')
      .select('id')
      .eq('class_id', classId)
      .eq('board_id', boardId)
      .eq('type', 'individual');
    
    let assignmentId: string;
    
    if (existingAssignments && existingAssignments.length > 0) {
      assignmentId = existingAssignments[0].id;
    } else {
      const { data: newAssignment } = await supabase
        .from('assignments')
        .insert({
          title: assignmentTitle,
          type: 'individual',
          class_id: classId,
          board_id: boardId,
          due_date: new Date().toISOString().split('T')[0],
        })
        .select()
        .single();
      
      if (!newAssignment) return;
      assignmentId = newAssignment.id;
    }
    
    // Save results for each student
    for (const result of studentResults) {
      // Find student by name
      const { data: students } = await supabase
        .from('students')
        .select('id')
        .eq('class_id', classId)
        .ilike('name', result.studentName);
      
      if (students && students.length > 0) {
        await supabase.from('results').upsert({
          student_id: students[0].id,
          assignment_id: assignmentId,
          score: result.score,
          max_score: result.maxScore,
          completed_at: result.completedAt,
          time_spent_ms: result.timeSpentMs,
        }, { onConflict: 'student_id,assignment_id' });
      }
    }
  } catch (error) {
    console.error('Error syncing individual work:', error);
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
  if (!useSupabaseData) {
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
