/**
 * Class Evaluations - Periodic student evaluations
 * 
 * Handles creating, updating, and sending class evaluations (semester, final, etc.)
 * All data is stored in Supabase for persistence.
 */

const PROJECT_ID = 'njbtqmsxbyvpwigfceke';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';

export interface ClassEvaluation {
  id: string;
  class_id: string;
  title: string;
  period_type: 'semester' | 'final' | 'quarterly' | 'custom';
  subject?: string;
  date_from?: string;
  date_to?: string;
  status: 'draft' | 'sent';
  created_by?: string;
  created_at: string;
  sent_at?: string;
  updated_at: string;
}

export interface StudentEvaluation {
  id: string;
  evaluation_id: string;
  student_id: string;
  student_name?: string; // joined from students table
  student_initials?: string;
  student_color?: string;
  average_score?: number;
  results_count?: number;
  teacher_input?: string;
  ai_generated_text?: string;
  final_text?: string;
  is_edited?: boolean;
  sent_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateEvaluationInput {
  classId: string;
  title: string;
  periodType: 'semester' | 'final' | 'quarterly' | 'custom';
  subject?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Create a new class evaluation period
 */
export async function createClassEvaluation(input: CreateEvaluationInput): Promise<ClassEvaluation | null> {
  try {
    const response = await fetch(`https://${PROJECT_ID}.supabase.co/rest/v1/class_evaluations`, {
      method: 'POST',
      headers: {
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        class_id: input.classId,
        title: input.title,
        period_type: input.periodType,
        subject: input.subject || null,
        date_from: input.dateFrom || null,
        date_to: input.dateTo || null,
        status: 'draft',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[ClassEvaluations] Failed to create evaluation:', error);
      return null;
    }

    const [evaluation] = await response.json();
    console.log('[ClassEvaluations] Created evaluation:', evaluation.id);
    return evaluation;
  } catch (error) {
    console.error('[ClassEvaluations] Error creating evaluation:', error);
    return null;
  }
}

/**
 * Get all evaluations for a class
 */
export async function getClassEvaluations(classId: string): Promise<ClassEvaluation[]> {
  try {
    const response = await fetch(
      `https://${PROJECT_ID}.supabase.co/rest/v1/class_evaluations?class_id=eq.${classId}&order=created_at.desc`,
      {
        headers: {
          'apikey': API_KEY,
          'Authorization': `Bearer ${API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      console.error('[ClassEvaluations] Failed to fetch evaluations');
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error('[ClassEvaluations] Error fetching evaluations:', error);
    return [];
  }
}

/**
 * Get a single evaluation with student evaluations
 */
export async function getEvaluationWithStudents(evaluationId: string): Promise<{
  evaluation: ClassEvaluation | null;
  studentEvaluations: StudentEvaluation[];
}> {
  try {
    // Get evaluation
    const evalResponse = await fetch(
      `https://${PROJECT_ID}.supabase.co/rest/v1/class_evaluations?id=eq.${evaluationId}`,
      {
        headers: {
          'apikey': API_KEY,
          'Authorization': `Bearer ${API_KEY}`,
        },
      }
    );

    if (!evalResponse.ok) {
      return { evaluation: null, studentEvaluations: [] };
    }

    const [evaluation] = await evalResponse.json();
    if (!evaluation) {
      return { evaluation: null, studentEvaluations: [] };
    }

    // Get student evaluations
    const studentsResponse = await fetch(
      `https://${PROJECT_ID}.supabase.co/rest/v1/student_evaluations?evaluation_id=eq.${evaluationId}&select=*,students(name,initials,color)`,
      {
        headers: {
          'apikey': API_KEY,
          'Authorization': `Bearer ${API_KEY}`,
        },
      }
    );

    let studentEvaluations: StudentEvaluation[] = [];
    if (studentsResponse.ok) {
      const data = await studentsResponse.json();
      studentEvaluations = data.map((item: any) => ({
        ...item,
        student_name: item.students?.name,
        student_initials: item.students?.initials,
        student_color: item.students?.color,
      }));
    }

    return { evaluation, studentEvaluations };
  } catch (error) {
    console.error('[ClassEvaluations] Error fetching evaluation:', error);
    return { evaluation: null, studentEvaluations: [] };
  }
}

/**
 * Initialize student evaluations for an evaluation period
 * Creates a record for each student in the class with their average score
 */
export async function initializeStudentEvaluations(
  evaluationId: string,
  classId: string,
  students: Array<{ id: string; name: string; averageScore: number; resultsCount: number }>
): Promise<boolean> {
  try {
    const records = students.map(student => ({
      evaluation_id: evaluationId,
      student_id: student.id,
      average_score: student.averageScore,
      results_count: student.resultsCount,
    }));

    const response = await fetch(`https://${PROJECT_ID}.supabase.co/rest/v1/student_evaluations`, {
      method: 'POST',
      headers: {
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(records),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[ClassEvaluations] Failed to initialize student evaluations:', error);
      return false;
    }

    console.log('[ClassEvaluations] Initialized', records.length, 'student evaluations');
    return true;
  } catch (error) {
    console.error('[ClassEvaluations] Error initializing student evaluations:', error);
    return false;
  }
}

/**
 * Update teacher input for a student evaluation
 */
export async function updateTeacherInput(
  studentEvaluationId: string,
  teacherInput: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://${PROJECT_ID}.supabase.co/rest/v1/student_evaluations?id=eq.${studentEvaluationId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': API_KEY,
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ teacher_input: teacherInput }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error('[ClassEvaluations] Error updating teacher input:', error);
    return false;
  }
}

/**
 * Save AI-generated evaluation for a student
 */
export async function saveGeneratedEvaluation(
  studentEvaluationId: string,
  aiGeneratedText: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://${PROJECT_ID}.supabase.co/rest/v1/student_evaluations?id=eq.${studentEvaluationId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': API_KEY,
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ai_generated_text: aiGeneratedText,
          final_text: aiGeneratedText, // Initially same as AI text
          is_edited: false,
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error('[ClassEvaluations] Error saving generated evaluation:', error);
    return false;
  }
}

/**
 * Update final text (teacher edits)
 */
export async function updateFinalText(
  studentEvaluationId: string,
  finalText: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://${PROJECT_ID}.supabase.co/rest/v1/student_evaluations?id=eq.${studentEvaluationId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': API_KEY,
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          final_text: finalText,
          is_edited: true,
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error('[ClassEvaluations] Error updating final text:', error);
    return false;
  }
}

/**
 * Send evaluation to students
 * Marks the evaluation as sent and updates sent_at timestamps
 */
export async function sendEvaluation(evaluationId: string): Promise<boolean> {
  console.log('[ClassEvaluations] sendEvaluation called for:', evaluationId);
  try {
    const now = new Date().toISOString();

    // Update class evaluation status
    console.log('[ClassEvaluations] Updating class_evaluations status...');
    const evalResponse = await fetch(
      `https://${PROJECT_ID}.supabase.co/rest/v1/class_evaluations?id=eq.${evaluationId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': API_KEY,
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'sent',
          sent_at: now,
        }),
      }
    );

    console.log('[ClassEvaluations] class_evaluations response:', evalResponse.status);
    if (!evalResponse.ok) {
      const errorText = await evalResponse.text();
      console.error('[ClassEvaluations] Failed to update evaluation status:', errorText);
      return false;
    }

    // Update all student evaluations sent_at
    console.log('[ClassEvaluations] Updating student_evaluations sent_at...');
    const studentsResponse = await fetch(
      `https://${PROJECT_ID}.supabase.co/rest/v1/student_evaluations?evaluation_id=eq.${evaluationId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': API_KEY,
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sent_at: now }),
      }
    );

    console.log('[ClassEvaluations] student_evaluations response:', studentsResponse.status);
    if (!studentsResponse.ok) {
      const errorText = await studentsResponse.text();
      console.error('[ClassEvaluations] Failed to update student evaluations:', errorText);
      return false;
    }

    console.log('[ClassEvaluations] Evaluation sent successfully:', evaluationId);
    return true;
  } catch (error) {
    console.error('[ClassEvaluations] Error sending evaluation:', error);
    return false;
  }
}

/**
 * Get evaluations sent to a specific student
 */
export async function getStudentReceivedEvaluations(studentId: string): Promise<Array<{
  evaluation: ClassEvaluation;
  studentEvaluation: StudentEvaluation;
}>> {
  console.log('[ClassEvaluations] getStudentReceivedEvaluations called for:', studentId);
  try {
    // Use explicit foreign key reference for JOIN
    const url = `https://${PROJECT_ID}.supabase.co/rest/v1/student_evaluations?student_id=eq.${studentId}&sent_at=not.is.null&select=*,class_evaluations:evaluation_id(*)`;
    console.log('[ClassEvaluations] Fetching:', url);
    
    const response = await fetch(url, {
      headers: {
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`,
      },
    });

    console.log('[ClassEvaluations] Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ClassEvaluations] Response error:', errorText);
      return [];
    }

    const data = await response.json();
    console.log('[ClassEvaluations] Raw data:', data);
    
    const result = data.map((item: any) => {
      // Handle both possible key names from Supabase JOIN
      const evalData = item.class_evaluations || item.evaluation_id;
      return {
        evaluation: evalData,
        studentEvaluation: {
          ...item,
          // Remove nested object to clean up
          class_evaluations: undefined,
        },
      };
    });
    
    console.log('[ClassEvaluations] Mapped result:', result);
    return result;
  } catch (error) {
    console.error('[ClassEvaluations] Error fetching student evaluations:', error);
    return [];
  }
}

/**
 * Delete an evaluation (only if draft)
 */
export async function deleteEvaluation(evaluationId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://${PROJECT_ID}.supabase.co/rest/v1/class_evaluations?id=eq.${evaluationId}&status=eq.draft`,
      {
        method: 'DELETE',
        headers: {
          'apikey': API_KEY,
          'Authorization': `Bearer ${API_KEY}`,
        },
      }
    );

    return response.ok;
  } catch (error) {
    console.error('[ClassEvaluations] Error deleting evaluation:', error);
    return false;
  }
}

