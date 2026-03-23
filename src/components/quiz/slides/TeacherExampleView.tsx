import React, { useState, useCallback } from 'react';
import { ExampleActivityView } from '../ExampleActivityView';
import { ExampleActivitySlide, SlideResponse, CustomKeyboardKey } from '../../../types/quiz';

interface TeacherExampleViewProps {
  slide: ExampleActivitySlide;
  customKeys?: [CustomKeyboardKey | null, CustomKeyboardKey | null, CustomKeyboardKey | null];
  extraKeys?: [CustomKeyboardKey | null, CustomKeyboardKey | null, CustomKeyboardKey | null];
}

/** Teacher-facing wrapper for ExampleActivityView with local answer state */
export function TeacherExampleView({ slide, customKeys, extraKeys }: TeacherExampleViewProps) {
  const [textAnswer, setTextAnswer] = useState('');
  const [hasAnswered, setHasAnswered] = useState(false);
  const [response, setResponse] = useState<SlideResponse | null>(null);

  const handleSubmit = useCallback(() => {
    const studentAns = textAnswer.trim().toLowerCase();
    const allCorrect = [
      ...(slide.finalAnswer ? [slide.finalAnswer] : []),
      ...((slide as any).alternativeAnswers || []).filter(Boolean),
    ];
    const isCorrect = allCorrect.length > 0
      ? allCorrect.some((a: string) => a.trim().toLowerCase() === studentAns)
      : false;
    setResponse({
      visitorId: 'teacher',
      visitorName: 'Učitel',
      slideId: slide.id,
      answer: textAnswer,
      isCorrect,
      timestamp: Date.now(),
    });
    setHasAnswered(true);
  }, [textAnswer, slide]);

  return (
    <ExampleActivityView
      slide={slide}
      textAnswer={textAnswer}
      setTextAnswer={setTextAnswer}
      hasAnswered={hasAnswered}
      response={response}
      showResults={hasAnswered}
      showExplanation={true}
      onSubmit={handleSubmit}
      customKeys={customKeys}
      extraKeys={extraKeys}
    />
  );
}
