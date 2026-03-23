import { useState, useCallback, useEffect } from 'react';
import { Quiz } from '../types/quiz';

const MAX_UNDO_STEPS = 50;

interface UseUndoRedoReturn {
  updateQuizWithUndo: (newQuiz: Quiz) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useUndoRedo(
  quiz: Quiz | null,
  setQuiz: (quiz: Quiz) => void,
  setIsDirty: (dirty: boolean) => void
): UseUndoRedoReturn {
  const [undoStack, setUndoStack] = useState<Quiz[]>([]);
  const [redoStack, setRedoStack] = useState<Quiz[]>([]);

  const updateQuizWithUndo = useCallback(
    (newQuiz: Quiz) => {
      if (quiz) {
        setUndoStack((prev) => [...prev, quiz].slice(-MAX_UNDO_STEPS));
        setRedoStack([]);
      }
      setQuiz(newQuiz);
      setIsDirty(true);
    },
    [quiz, setQuiz, setIsDirty]
  );

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previousState = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    if (quiz) setRedoStack((prev) => [...prev, quiz]);
    setQuiz(previousState);
    setIsDirty(true);
  }, [undoStack, quiz, setQuiz, setIsDirty]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    if (quiz) setUndoStack((prev) => [...prev, quiz]);
    setQuiz(nextState);
    setIsDirty(true);
  }, [redoStack, quiz, setQuiz, setIsDirty]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return {
    updateQuizWithUndo,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}
