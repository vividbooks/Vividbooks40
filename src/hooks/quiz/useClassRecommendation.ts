import { useState } from 'react';
import { Quiz, LiveQuizSession } from '../../types/quiz';

interface QuestionStat {
  slideId: string;
  question: string;
  activityType?: string;
  answerCounts: Record<string, number>;
  correctAnswer?: string;
  totalResponses: number;
}

interface StudentResult {
  id: string;
  name: string;
  correctCount: number;
  totalAnswered: number;
  successRate: number;
  totalTime: number;
  responses: Array<{ slideId: string; answer: any; isCorrect?: boolean }>;
}

interface OverallStats {
  avgSuccessRate: number;
}

interface UseClassRecommendationProps {
  quiz: Quiz | null;
  session: LiveQuizSession | null;
  sessionId: string | undefined;
  studentResults: StudentResult[];
  questionStats: QuestionStat[];
  overallStats: OverallStats;
}

export interface UseClassRecommendationReturn {
  classRecommendation: string;
  setClassRecommendation: (rec: string) => void;
  isGeneratingRecommendation: boolean;
  recommendationSaved: boolean;
  setRecommendationSaved: (saved: boolean) => void;
  handleGenerateClassRecommendation: () => Promise<void>;
  handleSaveRecommendation: () => Promise<void>;
}

const SUPABASE_PROJECT_ID = 'njbtqmsxbyvpwigfceke';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';

function supabaseRestHeaders() {
  return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
}

export function useClassRecommendation({
  quiz,
  session,
  sessionId,
  studentResults,
  questionStats,
  overallStats,
}: UseClassRecommendationProps): UseClassRecommendationReturn {
  const [classRecommendation, setClassRecommendation] = useState('');
  const [isGeneratingRecommendation, setIsGeneratingRecommendation] = useState(false);
  const [recommendationSaved, setRecommendationSaved] = useState(false);

  const handleGenerateClassRecommendation = async () => {
    if (!quiz || !session?.students || studentResults.length === 0) return;

    setIsGeneratingRecommendation(true);

    try {
      const answerPatterns: Record<string, string[]> = {};
      studentResults.forEach((student) => {
        const pattern = student.responses.map((r) => String(r.answer)).join('|');
        if (!answerPatterns[pattern]) answerPatterns[pattern] = [];
        answerPatterns[pattern].push(student.name);
      });

      const suspiciousPairs = Object.entries(answerPatterns)
        .filter(([_, names]) => names.length > 1)
        .map(([_, names]) => names);

      const prompt = `Jsi učitel analyzující výsledky testu "${quiz.title}".

SHRNUTÍ TESTU:
- Počet studentů: ${studentResults.length}
- Průměrná úspěšnost: ${Math.round(overallStats.avgSuccessRate)}%

OTÁZKY A ÚSPĚŠNOST:
${questionStats
  .map((stat, i) => {
    const correctCount = stat.correctAnswer ? (stat.answerCounts[stat.correctAnswer] || 0) : 0;
    const successRate =
      stat.totalResponses > 0 ? Math.round((correctCount / stat.totalResponses) * 100) : 0;
    return `${i + 1}. "${stat.question}" - úspěšnost: ${successRate}% (${stat.totalResponses} odpovědí)`;
  })
  .join('\n')}

VÝSLEDKY STUDENTŮ:
${studentResults.map((s) => `- ${s.name}: ${s.successRate}% (${s.correctCount}/${s.totalAnswered})`).join('\n')}

${
  suspiciousPairs.length > 0
    ? `UPOZORNĚNÍ - Studenti se stejnými odpověďmi:\n${suspiciousPairs.map((pair) => `- ${pair.join(', ')}`).join('\n')}`
    : ''
}

Na základě těchto dat prosím poskytni učiteli:
1. Hlavní závěry z testu (co třída zvládla, co ne)
2. Konkrétní doporučení na co se zaměřit
3. Upozornění na jednotlivé studenty, kteří potřebují pozornost
4. Případná podezření nebo zajímavé vzorce v datech

Piš stručně, prakticky a v češtině. Formátuj přehledně s odrážkami.`;

      const { chatWithAIProxy } = await import('../../utils/ai-chat-proxy');
      const recommendation = await chatWithAIProxy(
        [
          {
            role: 'system',
            content: 'Jsi zkušený učitel, který analyzuje výsledky testů a dává praktická doporučení.',
          },
          { role: 'user', content: prompt },
        ],
        'gpt-4o-mini',
        { max_tokens: 1000, temperature: 0.7 }
      );

      setClassRecommendation(recommendation);
      setRecommendationSaved(false);
    } catch (error) {
      console.error('[Recommendation] Error:', error);
      alert('Nepodařilo se vygenerovat doporučení');
    } finally {
      setIsGeneratingRecommendation(false);
    }
  };

  const handleSaveRecommendation = async () => {
    if (!classRecommendation || !sessionId) return;

    try {
      const assignmentRes = await fetch(
        `https://${SUPABASE_PROJECT_ID}.supabase.co/rest/v1/assignments?session_id=eq.${sessionId}&select=id`,
        { headers: supabaseRestHeaders() }
      );

      if (assignmentRes.ok) {
        const assignments = await assignmentRes.json();
        if (assignments.length > 0) {
          const updateRes = await fetch(
            `https://${SUPABASE_PROJECT_ID}.supabase.co/rest/v1/assignments?id=eq.${assignments[0].id}`,
            {
              method: 'PATCH',
              headers: {
                ...supabaseRestHeaders(),
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
              },
              body: JSON.stringify({ class_recommendation: classRecommendation }),
            }
          );
          if (updateRes.ok) {
            setRecommendationSaved(true);
            console.log('[Recommendation] Saved successfully');
          }
        }
      }
    } catch (error) {
      console.error('[Recommendation] Save error:', error);
    }
  };

  return {
    classRecommendation,
    setClassRecommendation,
    isGeneratingRecommendation,
    recommendationSaved,
    setRecommendationSaved,
    handleGenerateClassRecommendation,
    handleSaveRecommendation,
  };
}
