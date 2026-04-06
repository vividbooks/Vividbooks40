/**
 * Student Assignments Utility
 * 
 * Manages student assignments and submissions.
 * Uses localStorage for now, with Supabase integration for syncing.
 */

import { supabase } from './supabase/client';
import { stripBase64FromObject } from './supabase/upload-image';
import { normalizeSubmissionPreviewPlainText } from './migration/normalize-submission-preview-text';
import {
  StudentAssignment,
  StudentSubmission,
  StudentAssignmentType,
  SubmissionStatus,
  AIDetectionFlag,
  StudentAssignmentWithClass,
} from '../types/student-assignment';

// =============================================
// STORAGE KEYS
// =============================================

const ASSIGNMENTS_KEY = 'vivid-student-assignments';
const SUBMISSIONS_KEY = 'vivid-student-submissions';

// =============================================
// ASSIGNMENT CRUD (Teacher side)
// =============================================

/**
 * Create a new assignment
 */
export async function createAssignment(
  classId: string,
  title: string,
  description: string,
  type: StudentAssignmentType,
  allowAi: boolean,
  dueDate?: string,
  createdBy?: string,
  subject?: string
): Promise<StudentAssignment> {
  const assignment: StudentAssignment = {
    id: `assign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    class_id: classId,
    title,
    description,
    type,
    allow_ai: allowAi,
    due_date: dueDate,
    created_by: createdBy || 'unknown',
    created_at: new Date().toISOString(),
    subject,
  };

  // Save to localStorage
  const assignments = getAssignmentsFromStorage();
  assignments.push(assignment);
  localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments));

  // Try to save to Supabase
  try {
    const { error } = await supabase.from('student_assignments').insert({
      id: assignment.id,
      class_id: classId,
      title,
      description,
      type,
      allow_ai: allowAi,
      due_date: dueDate,
      created_by: createdBy,
      subject,
    });
    if (error) {
      console.log('[Assignments] Supabase save skipped (table may not exist):', error.message);
    }
  } catch (e) {
    console.log('[Assignments] Using localStorage only');
  }

  return assignment;
}

/**
 * Get all assignments from storage
 */
function getAssignmentsFromStorage(): StudentAssignment[] {
  try {
    const data = localStorage.getItem(ASSIGNMENTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Get assignments for a specific class
 */
export async function getAssignmentsForClass(classId: string): Promise<StudentAssignment[]> {
  const startTime = Date.now();
  console.log('[getAssignmentsForClass] Starting for class:', classId);
  
  // Use direct fetch with timeout (Supabase client abortSignal doesn't work reliably)
  try {
    const projectId = 'njbtqmsxbyvpwigfceke';
    const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';
    
    const url = `https://${projectId}.supabase.co/rest/v1/student_assignments?select=*&class_id=eq.${classId}&order=created_at.desc`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    const duration = Date.now() - startTime;
    
    if (!response.ok) {
      console.log(`[getAssignmentsForClass] HTTP error ${response.status} after ${duration}ms, using localStorage`);
      const assignments = getAssignmentsFromStorage();
      return assignments.filter(a => a.class_id === classId);
    }
    
    const data = await response.json();
    console.log(`[getAssignmentsForClass] Completed in ${duration}ms, found ${data?.length || 0} assignments`);
    
    if (data && data.length > 0) {
      return data.map(mapSupabaseAssignment);
    }
  } catch (e: any) {
    const duration = Date.now() - startTime;
    if (e.name === 'AbortError') {
      console.log(`[getAssignmentsForClass] Timeout after ${duration}ms, using localStorage`);
    } else {
      console.log(`[getAssignmentsForClass] Error after ${duration}ms, using localStorage:`, e.message);
    }
  }

  // Fallback to localStorage
  const assignments = getAssignmentsFromStorage();
  console.log(`[getAssignmentsForClass] Using localStorage, found ${assignments.filter(a => a.class_id === classId).length} assignments`);
  return assignments.filter(a => a.class_id === classId);
}

/**
 * Get assignments for a student (by class ID)
 */
export async function getAssignmentsForStudent(classId: string): Promise<StudentAssignmentWithClass[]> {
  const assignments = await getAssignmentsForClass(classId);
  const submissions = getSubmissionsFromStorage();

  return assignments.map(assignment => {
    const submission = submissions.find(s => s.assignment_id === assignment.id);
    return {
      ...assignment,
      submission,
    };
  });
}

/**
 * Get a single assignment by ID
 */
export async function getAssignment(assignmentId: string): Promise<StudentAssignment | null> {
  // Try Supabase first
  try {
    const { data, error } = await supabase
      .from('student_assignments')
      .select('*')
      .eq('id', assignmentId)
      .maybeSingle();

    if (!error && data) {
      return mapSupabaseAssignment(data);
    }
  } catch (e) {
    console.log('[Assignments] Supabase not available');
  }

  // Fallback to localStorage
  const assignments = getAssignmentsFromStorage();
  return assignments.find(a => a.id === assignmentId) || null;
}

/**
 * Delete an assignment
 */
export async function deleteAssignment(assignmentId: string): Promise<void> {
  // Remove from localStorage
  const assignments = getAssignmentsFromStorage();
  const filtered = assignments.filter(a => a.id !== assignmentId);
  localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(filtered));

  // Try Supabase
  try {
    await supabase.from('student_assignments').delete().eq('id', assignmentId);
  } catch (e) {
    console.log('[Assignments] Supabase delete skipped');
  }
}

// =============================================
// SUBMISSION CRUD (Student side)
// =============================================

/**
 * Get all submissions from storage
 */
function getSubmissionsFromStorage(): StudentSubmission[] {
  try {
    const data = localStorage.getItem(SUBMISSIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Save submissions to storage
 */
function saveSubmissionsToStorage(submissions: StudentSubmission[]): void {
  localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(submissions));
}

/**
 * Start working on an assignment (create draft submission)
 */
export async function startAssignment(
  studentId: string,
  assignmentId: string,
  contentType: 'document' | 'board' | 'worksheet',
  contentId: string
): Promise<StudentSubmission> {
  const submission: StudentSubmission = {
    id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    student_id: studentId,
    assignment_id: assignmentId,
    content_type: contentType,
    content_id: contentId,
    status: 'draft',
    started_at: new Date().toISOString(),
    ai_flags: [],
    ai_warning_shown: false,
  };

  const submissions = getSubmissionsFromStorage();
  submissions.push(submission);
  saveSubmissionsToStorage(submissions);

  // Try Supabase
  try {
    await supabase.from('student_submissions').insert({
      id: submission.id,
      student_id: studentId,
      assignment_id: assignmentId,
      content_type: contentType,
      content_id: contentId,
      status: 'draft',
      started_at: submission.started_at,
      ai_flags: [],
    });
  } catch (e) {
    console.log('[Submissions] Using localStorage only');
  }

  return submission;
}

/**
 * Get submission for a specific assignment and student
 */
export async function getSubmission(
  studentId: string,
  assignmentId: string
): Promise<StudentSubmission | null> {
  // Try Supabase first
  try {
    const { data, error } = await supabase
      .from('student_submissions')
      .select('*')
      .eq('student_id', studentId)
      .eq('assignment_id', assignmentId)
      .maybeSingle();

    if (!error && data) {
      return mapSupabaseSubmission(data);
    }
  } catch (e) {
    console.log('[Submissions] Supabase not available');
  }

  // Fallback to localStorage
  const submissions = getSubmissionsFromStorage();
  return submissions.find(
    s => s.student_id === studentId && s.assignment_id === assignmentId
  ) || null;
}

/**
 * Get all submissions for a student
 */
export async function getStudentSubmissions(studentId: string): Promise<StudentSubmission[]> {
  // Try Supabase first
  try {
    const { data, error } = await supabase
      .from('student_submissions')
      .select('*')
      .eq('student_id', studentId)
      .order('started_at', { ascending: false });

    if (!error && data) {
      return data.map(mapSupabaseSubmission);
    }
  } catch (e) {
    console.log('[Submissions] Supabase not available');
  }

  // Fallback to localStorage
  const submissions = getSubmissionsFromStorage();
  return submissions.filter(s => s.student_id === studentId);
}

/** Teacher review: submission + student display fields (from `students` or fallback). */
export type SubmissionWithStudentInfo = StudentSubmission & {
  studentName: string;
  studentInitials: string;
  studentColor: string;
};

function initialsFromDisplayName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * All submissions for one assignment, joined with student names (Supabase + fallback localStorage).
 */
export async function getSubmissionsForAssignmentWithStudents(
  classId: string,
  assignmentId: string
): Promise<SubmissionWithStudentInfo[]> {
  let subs: StudentSubmission[] = [];

  try {
    const { data, error } = await supabase
      .from('student_submissions')
      .select('*')
      .eq('assignment_id', assignmentId);

    if (!error && data && data.length > 0) {
      subs = data.map(mapSupabaseSubmission);
    }
  } catch (e) {
    console.log('[getSubmissionsForAssignmentWithStudents] Supabase submissions failed');
  }

  if (subs.length === 0) {
    subs = getSubmissionsFromStorage().filter(s => s.assignment_id === assignmentId);
  }

  if (subs.length === 0) return [];

  const studentIds = [...new Set(subs.map(s => s.student_id))];
  const studentMap = new Map<
    string,
    { name: string; initials?: string | null; color?: string | null }
  >();

  try {
    const { data: studs, error } = await supabase
      .from('students')
      .select('id, name, initials, color')
      .eq('class_id', classId)
      .in('id', studentIds);

    if (!error && studs) {
      for (const st of studs) {
        studentMap.set(st.id, {
          name: st.name,
          initials: st.initials,
          color: st.color,
        });
      }
    }
  } catch (e) {
    console.log('[getSubmissionsForAssignmentWithStudents] students lookup failed');
  }

  const fallbackColors = ['#EC4899', '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B'];

  return subs.map((s, i) => {
    const st = studentMap.get(s.student_id);
    if (st) {
      const name = st.name;
      const initials = (st.initials && st.initials.trim()) || initialsFromDisplayName(name);
      const color = (st.color && st.color.trim()) || fallbackColors[i % fallbackColors.length];
      return { ...s, studentName: name, studentInitials: initials, studentColor: color };
    }
    return {
      ...s,
      studentName: 'Neznámý žák',
      studentInitials: initialsFromDisplayName('Neznámý'),
      studentColor: fallbackColors[i % fallbackColors.length],
    };
  });
}

/**
 * Všechna odevzdání úkolů pro třídu (matice úkol × žák), Supabase + doplnění z localStorage.
 */
export async function getTaskSubmissionsGroupedForClass(
  classId: string
): Promise<{ [assignmentId: string]: { [studentId: string]: StudentSubmission } }> {
  const assignments = await getAssignmentsForClass(classId);
  const assignmentIds = new Set(assignments.map((a) => a.id));
  if (assignmentIds.size === 0) return {};

  const byTask: { [assignmentId: string]: { [studentId: string]: StudentSubmission } } = {};

  try {
    const { data, error } = await supabase
      .from('student_submissions')
      .select('*')
      .in('assignment_id', [...assignmentIds]);

    if (!error && data && data.length > 0) {
      for (const row of data) {
        const s = mapSupabaseSubmission(row);
        if (!assignmentIds.has(s.assignment_id)) continue;
        if (!byTask[s.assignment_id]) byTask[s.assignment_id] = {};
        byTask[s.assignment_id][s.student_id] = s;
      }
    }
  } catch (e) {
    console.log('[getTaskSubmissionsGroupedForClass] Supabase failed');
  }

  for (const sub of getSubmissionsFromStorage()) {
    if (!assignmentIds.has(sub.assignment_id)) continue;
    if (!byTask[sub.assignment_id]) byTask[sub.assignment_id] = {};
    if (!byTask[sub.assignment_id][sub.student_id]) {
      byTask[sub.assignment_id][sub.student_id] = sub;
    }
  }

  return byTask;
}

/**
 * Update submission status
 */
export async function updateSubmissionStatus(
  submissionId: string,
  status: SubmissionStatus
): Promise<void> {
  const submissions = getSubmissionsFromStorage();
  const index = submissions.findIndex(s => s.id === submissionId);
  
  if (index !== -1) {
    submissions[index].status = status;
    if (status === 'submitted') {
      submissions[index].submitted_at = new Date().toISOString();
    }
    saveSubmissionsToStorage(submissions);
  }

  // Try Supabase
  try {
    const updateData: any = { status };
    if (status === 'submitted') {
      updateData.submitted_at = new Date().toISOString();
    }
    await supabase.from('student_submissions').update(updateData).eq('id', submissionId);
  } catch (e) {
    console.log('[Submissions] Supabase update skipped');
  }
}

/**
 * Submit an assignment
 */
export async function submitAssignment(submissionId: string): Promise<void> {
  await updateSubmissionStatus(submissionId, 'submitted');
}

// =============================================
// AI DETECTION
// =============================================

/**
 * Add an AI detection flag to a submission
 */
export async function addAIFlag(
  submissionId: string,
  flag: Omit<AIDetectionFlag, 'id' | 'timestamp'>
): Promise<void> {
  const submissions = getSubmissionsFromStorage();
  const index = submissions.findIndex(s => s.id === submissionId);
  
  if (index !== -1) {
    const newFlag: AIDetectionFlag = {
      ...flag,
      id: `flag_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    submissions[index].ai_flags.push(newFlag);
    submissions[index].ai_warning_shown = true;
    saveSubmissionsToStorage(submissions);

    // Try Supabase
    try {
      await supabase
        .from('student_submissions')
        .update({ 
          ai_flags: submissions[index].ai_flags,
          ai_warning_shown: true,
        })
        .eq('id', submissionId);
    } catch (e) {
      console.log('[AI Flags] Supabase update skipped');
    }
  }
}

/**
 * Get submissions with AI flags for a class (teacher view)
 */
export async function getSubmissionsWithAIFlags(classId: string): Promise<{
  submission: StudentSubmission;
  assignment: StudentAssignment;
  studentName: string;
}[]> {
  const assignments = await getAssignmentsForClass(classId);
  const assignmentIds = assignments.map(a => a.id);
  if (assignmentIds.length === 0) return [];

  let relevantSubmissions: StudentSubmission[] = [];

  try {
    const { data, error } = await supabase
      .from('student_submissions')
      .select('*')
      .in('assignment_id', assignmentIds);

    if (!error && data) {
      relevantSubmissions = data
        .map(mapSupabaseSubmission)
        .filter(s => (s.ai_flags?.length ?? 0) > 0);
    }
  } catch (e) {
    console.log('[getSubmissionsWithAIFlags] Supabase failed');
  }

  if (relevantSubmissions.length === 0) {
    const allSubmissions = getSubmissionsFromStorage();
    relevantSubmissions = allSubmissions.filter(
      s => assignmentIds.includes(s.assignment_id) && s.ai_flags.length > 0
    );
  }

  const studentIds = [...new Set(relevantSubmissions.map(s => s.student_id))];
  const nameByStudent = new Map<string, string>();

  try {
    const { data: studs } = await supabase
      .from('students')
      .select('id, name')
      .eq('class_id', classId)
      .in('id', studentIds);

    if (studs) {
      for (const st of studs) {
        nameByStudent.set(st.id, st.name);
      }
    }
  } catch (e) {
    // ignore
  }

  return relevantSubmissions.map(submission => {
    const assignment = assignments.find(a => a.id === submission.assignment_id)!;
    return {
      submission,
      assignment,
      studentName: nameByStudent.get(submission.student_id) || 'Student',
    };
  });
}

// =============================================
// HELPER FUNCTIONS
// =============================================

function mapSupabaseAssignment(data: any): StudentAssignment {
  return {
    id: data.id,
    class_id: data.class_id,
    title: data.title,
    description: data.description,
    type: data.type,
    allow_ai: data.allow_ai,
    due_date: data.due_date,
    created_by: data.created_by,
    created_at: data.created_at,
    updated_at: data.updated_at,
    max_points: data.max_points,
    subject: data.subject,
  };
}

function mapSupabaseSubmission(data: any): StudentSubmission {
  return {
    id: data.id,
    student_id: data.student_id,
    assignment_id: data.assignment_id,
    content_type: data.content_type,
    content_id: data.content_id,
    status: data.status,
    started_at: data.started_at,
    submitted_at: data.submitted_at,
    ai_flags: Array.isArray(data.ai_flags) ? data.ai_flags : [],
    ai_warning_shown: data.ai_warning_shown || false,
    score: data.score,
    max_score: data.max_score,
    teacher_comment: data.teacher_comment,
    graded_at: data.graded_at,
    graded_by: data.graded_by,
    text_preview: typeof data.text_preview === 'string' ? data.text_preview : undefined,
  };
}

/**
 * Uloží textový náhled odevzdání do Supabase + lokální cache (pro učitele na jiném zařízení).
 */
export async function syncSubmissionTextPreview(
  submissionId: string,
  rawText: string
): Promise<void> {
  const normalized = normalizeSubmissionPreviewPlainText(raw);
  const safe = stripBase64FromObject(normalized, 'text_preview') as string;

  const submissions = getSubmissionsFromStorage();
  const index = submissions.findIndex((s) => s.id === submissionId);
  if (index >= 0) {
    submissions[index] = { ...submissions[index], text_preview: safe };
    saveSubmissionsToStorage(submissions);
  }

  try {
    await supabase.from('student_submissions').update({ text_preview: safe }).eq('id', submissionId);
  } catch (e) {
    console.log('[Submissions] text_preview cloud update skipped');
  }
}

// =============================================
// AI TEXT ANALYSIS
// =============================================

/**
 * Analyze text for potential AI generation
 * Returns a confidence score 0-1
 */
export function analyzeTextForAI(text: string): { 
  isLikelyAI: boolean; 
  confidence: number; 
  reasons: string[];
} {
  const reasons: string[] = [];
  let score = 0;

  // Skip very short text
  if (text.length < 100) {
    return { isLikelyAI: false, confidence: 0, reasons: [] };
  }

  // Check for common AI patterns
  const aiPhrases = [
    'jako umělá inteligence',
    'jako AI',
    'jako jazykový model',
    'nemohu poskytnout',
    'je důležité poznamenat',
    'v neposlední řadě',
    'celkově lze říci',
    'v dnešní době',
    'je třeba zdůraznit',
    'obecně lze konstatovat',
  ];

  for (const phrase of aiPhrases) {
    if (text.toLowerCase().includes(phrase)) {
      score += 0.3;
      reasons.push(`Obsahuje typickou AI frázi: "${phrase}"`);
    }
  }

  // Check for overly structured format
  const bulletPoints = (text.match(/^[\s]*[-•*]\s/gm) || []).length;
  const numberedPoints = (text.match(/^[\s]*\d+\.\s/gm) || []).length;
  
  if (bulletPoints > 5 || numberedPoints > 5) {
    score += 0.2;
    reasons.push('Text je příliš strukturovaný (mnoho odrážek)');
  }

  // Check for unusual sentence uniformity
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length >= 5) {
    const lengths = sentences.map(s => s.trim().length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;
    const stdDev = Math.sqrt(variance);
    
    // Very uniform sentence lengths are suspicious
    if (stdDev < avgLength * 0.2) {
      score += 0.15;
      reasons.push('Věty mají podezřele stejnou délku');
    }
  }

  // Check for lack of personal pronouns (AI often writes impersonally)
  const personalPronouns = (text.match(/\b(já|my|můj|moje|mé|naše|nás)\b/gi) || []).length;
  const wordCount = text.split(/\s+/).length;
  
  if (wordCount > 100 && personalPronouns < 2) {
    score += 0.1;
    reasons.push('Chybí osobní zájmena (text je neosobní)');
  }

  // Check for text being too long for a paste (suspicious)
  if (text.length > 2000) {
    score += 0.1;
    reasons.push('Velmi dlouhý vložený text');
  }

  // Normalize score to 0-1
  const confidence = Math.min(score, 1);
  const isLikelyAI = confidence >= 0.3;

  return { isLikelyAI, confidence, reasons };
}

