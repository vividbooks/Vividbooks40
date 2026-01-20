/**
 * AI Formative Assessment Generator
 * 
 * Generates personalized formative assessments for students based on:
 * - Quiz results and answers
 * - Student's performance patterns
 * - Teacher's optional notes
 * 
 * Uses GPT-4.1-mini for fast, cost-effective generation.
 */

import { chatWithAIProxy } from './ai-chat-proxy';

interface QuizQuestion {
  question: string;
  studentAnswer: string;
  correctAnswer?: string;
  isCorrect: boolean;
  type: string;
}

interface StudentPerformance {
  studentName: string;
  totalCorrect: number;
  totalQuestions: number;
  successRate: number;
  totalTimeSeconds: number;
  questions: QuizQuestion[];
}

interface FormativeAssessmentRequest {
  quizTitle: string;
  subjectName: string;
  studentPerformance: StudentPerformance;
  teacherNotes?: string;
}

interface FormativeAssessmentResult {
  success: boolean;
  assessment?: string;
  error?: string;
}

/**
 * Generate a formative assessment using AI
 */
export async function generateFormativeAssessment(
  request: FormativeAssessmentRequest
): Promise<FormativeAssessmentResult> {
  const { quizTitle, subjectName, studentPerformance, teacherNotes } = request;
  
  // Build the prompt for formative assessment
  const systemPrompt = `Jsi zkušený učitel, který píše formativní hodnocení pro žáky základní školy.

PRINCIPY FORMATIVNÍHO HODNOCENÍ:
- Zaměř se na PROCES učení, ne jen na výsledek
- Poskytni konkrétní a konstruktivní zpětnou vazbu
- Vyzdvihni silné stránky studenta
- Identifikuj oblasti pro zlepšení s konkrétními radami
- Formuluj cíle pro další učení
- Používej povzbudivý, ale upřímný tón
- Piš přímo studentovi (oslovuj ho/ji)

STRUKTURA HODNOCENÍ:
1. Co se povedlo (konkrétní pochvala za správné odpovědi nebo přístup)
2. Co můžeš zlepšit (konstruktivní zpětná vazba k chybám)
3. Tip pro další učení (jeden konkrétní krok)

Piš stručně a jasně, max 3-4 věty pro každou sekci. Celkem max 150 slov.`;

  // Prepare questions summary
  const questionsSummary = studentPerformance.questions.map((q, i) => {
    const status = q.isCorrect ? '✓ Správně' : '✗ Špatně';
    return `${i + 1}. ${q.question}
   Odpověď: ${q.studentAnswer} ${status}${!q.isCorrect && q.correctAnswer ? ` (správně: ${q.correctAnswer})` : ''}`;
  }).join('\n');

  const userPrompt = `Napiš formativní hodnocení pro studenta.

KVÍZ: ${quizTitle}
PŘEDMĚT: ${subjectName}
STUDENT: ${studentPerformance.studentName}
VÝSLEDEK: ${studentPerformance.totalCorrect}/${studentPerformance.totalQuestions} (${studentPerformance.successRate}%)
ČAS: ${Math.round(studentPerformance.totalTimeSeconds / 60)} minut

ODPOVĚDI:
${questionsSummary}

${teacherNotes ? `POZNÁMKA UČITELE (vezmi v potaz):
${teacherNotes}` : ''}

Napiš hodnocení přímo pro studenta ${studentPerformance.studentName}.`;

  try {
    const response = await chatWithAIProxy(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      'gpt-4o-mini',
      {
        temperature: 0.7,
        max_tokens: 500,
      }
    );

    return {
      success: true,
      assessment: response.trim(),
    };
  } catch (error: any) {
    console.error('Failed to generate formative assessment:', error);
    return {
      success: false,
      error: error.message || 'Nepodařilo se vygenerovat hodnocení',
    };
  }
}

/**
 * Save evaluation to storage (localStorage for now, can be migrated to Supabase)
 */
export interface SavedEvaluation {
  id: string;
  quizId: string;
  quizTitle: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  subjectName: string;
  assessment: string;
  teacherNotes?: string;
  sharedWithStudent: boolean;
  createdAt: string;
  sharedAt?: string;
}

const EVALUATIONS_KEY = 'vivid-quiz-evaluations';

export function saveEvaluation(evaluation: Omit<SavedEvaluation, 'id' | 'createdAt'>): SavedEvaluation {
  const evaluations = getEvaluations();
  
  const newEvaluation: SavedEvaluation = {
    ...evaluation,
    id: `eval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  };
  
  evaluations.push(newEvaluation);
  localStorage.setItem(EVALUATIONS_KEY, JSON.stringify(evaluations));
  
  return newEvaluation;
}

export function getEvaluations(): SavedEvaluation[] {
  try {
    const data = localStorage.getItem(EVALUATIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function getEvaluationsForStudent(studentId: string, studentName?: string): SavedEvaluation[] {
  const all = getEvaluations();
  
  // Match by studentId OR by studentName (fallback for ID mismatch between Firebase and Supabase)
  const matching = all.filter(e => {
    if (!e.sharedWithStudent) return false;
    if (e.studentId === studentId) return true;
    if (studentName && e.studentName?.toLowerCase() === studentName.toLowerCase()) return true;
    return false;
  });
  
  return matching;
}

export function getEvaluationsForQuiz(quizId: string, sessionId: string): SavedEvaluation[] {
  return getEvaluations().filter(e => e.quizId === quizId && e.sessionId === sessionId);
}

export function updateEvaluation(id: string, updates: Partial<SavedEvaluation>): SavedEvaluation | null {
  const evaluations = getEvaluations();
  const index = evaluations.findIndex(e => e.id === id);
  
  if (index === -1) return null;
  
  evaluations[index] = { ...evaluations[index], ...updates };
  localStorage.setItem(EVALUATIONS_KEY, JSON.stringify(evaluations));
  
  return evaluations[index];
}

export function shareEvaluationWithStudent(id: string): SavedEvaluation | null {
  return updateEvaluation(id, {
    sharedWithStudent: true,
    sharedAt: new Date().toISOString(),
  });
}


