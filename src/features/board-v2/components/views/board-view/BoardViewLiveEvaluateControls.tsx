import { CheckCircle } from 'lucide-react';
import type { Quiz, SlideResponse } from '../../../../../types/quiz';

const TEACHER_EVALUATABLE_ACTIVITY_TYPES = new Set([
  'abc',
  'example',
  'true-false',
  'trueFalse',
  'connect-pairs',
  'fill-blanks',
  'image-hotspots',
  'video-quiz',
]);

interface LiveStudentForEvaluation {
  responses: SlideResponse[];
}

interface BoardViewLiveEvaluateControlsProps {
  sessionLocked: boolean;
  quiz: Quiz;
  currentSlideIndex: number;
  students: Array<[string, LiveStudentForEvaluation]>;
  onEvaluate: () => void | Promise<void>;
}

export function BoardViewLiveEvaluateControls({
  sessionLocked,
  quiz,
  currentSlideIndex,
  students,
  onEvaluate,
}: BoardViewLiveEvaluateControlsProps) {
  if (!sessionLocked || quiz.slides[currentSlideIndex]?.type !== 'activity') {
    return null;
  }

  const currentSlideData = quiz.slides[currentSlideIndex];
  if (!TEACHER_EVALUATABLE_ACTIVITY_TYPES.has(currentSlideData.activityType)) {
    return null;
  }

  const studentsWithAnswer = students.filter(([_, student]) => {
    const responses = student.responses || [];
    return responses.some((response) => response.slideId === currentSlideData.id);
  });

  if (studentsWithAnswer.length === 0) {
    return null;
  }

  const hasUnevaluatedAnswers = studentsWithAnswer.some(([_, student]) => {
    const responses = student.responses || [];
    const response = responses.find((item) => item.slideId === currentSlideData.id);
    return response && (response.isCorrect === undefined || response.isCorrect === null);
  });

  if (!hasUnevaluatedAnswers) {
    return null;
  }

  return (
    <button
      onClick={onEvaluate}
      className="w-full py-3 rounded-lg text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
      style={{ backgroundColor: '#f59e0b' }}
    >
      <CheckCircle className="w-4 h-4" />
      {`Vyhodnotit (${studentsWithAnswer.length})`}
    </button>
  );
}
