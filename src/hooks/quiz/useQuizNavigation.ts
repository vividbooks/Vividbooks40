import { useState, useCallback } from 'react';
import type { SlideResponse } from '../../types/quiz';

export interface UseQuizNavigationProps {
  slideCount: number;
  initialSlideIndex?: number;
  allowBack?: boolean;
  responses: SlideResponse[];
  onComplete?: (responses: SlideResponse[]) => void;
}

export interface UseQuizNavigationReturn {
  currentSlideIndex: number;
  setCurrentSlideIndex: React.Dispatch<React.SetStateAction<number>>;
  prevSlideIndex: number;
  setPrevSlideIndex: React.Dispatch<React.SetStateAction<number>>;
  isAnimating: boolean;
  setIsAnimating: React.Dispatch<React.SetStateAction<boolean>>;
  isCompleted: boolean;
  setIsCompleted: React.Dispatch<React.SetStateAction<boolean>>;
  goToNextSlide: () => void;
  goToPrevSlide: () => void;
}

export function useQuizNavigation({
  slideCount,
  initialSlideIndex = 0,
  allowBack = true,
  responses,
  onComplete,
}: UseQuizNavigationProps): UseQuizNavigationReturn {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(initialSlideIndex);
  const [prevSlideIndex, setPrevSlideIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const goToNextSlide = useCallback(() => {
    if (currentSlideIndex < slideCount - 1 && !isAnimating) {
      setIsAnimating(true);
      setPrevSlideIndex(currentSlideIndex);
      setCurrentSlideIndex(prev => prev + 1);
      setTimeout(() => setIsAnimating(false), 500);
    } else if (currentSlideIndex === slideCount - 1) {
      setIsCompleted(true);
      onComplete?.(responses);
    }
  }, [slideCount, currentSlideIndex, isAnimating, responses, onComplete]);

  const goToPrevSlide = useCallback(() => {
    if (currentSlideIndex > 0 && !isAnimating && allowBack) {
      setIsAnimating(true);
      setPrevSlideIndex(currentSlideIndex);
      setCurrentSlideIndex(prev => prev - 1);
      setTimeout(() => setIsAnimating(false), 500);
    }
  }, [currentSlideIndex, isAnimating, allowBack]);

  return {
    currentSlideIndex, setCurrentSlideIndex,
    prevSlideIndex, setPrevSlideIndex,
    isAnimating, setIsAnimating,
    isCompleted, setIsCompleted,
    goToNextSlide,
    goToPrevSlide,
  };
}
