/**
 * Public Board Viewer
 * 
 * Wrapper component that loads a quiz and displays it using QuizPreview
 * in public mode with commenting functionality.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Loader2,
  AlertCircle,
  Home,
} from 'lucide-react';
import { Quiz } from '../../types/quiz';
import { getPublicQuizAsync } from '../../utils/quiz-storage';
import { QuizPreview } from './QuizPreview';

export function PublicBoardViewer() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load quiz
  useEffect(() => {
    async function loadQuiz() {
      if (!boardId) {
        setError('Neplatný odkaz');
        setLoading(false);
        return;
      }

      try {
        const loadedQuiz = await getPublicQuizAsync(boardId);
        if (loadedQuiz) {
          setQuiz(loadedQuiz);
        } else {
          setError('Board nebyl nalezen nebo není veřejně sdílený');
        }
      } catch (e) {
        console.error('Error loading quiz:', e);
        setError('Nepodařilo se načíst board');
      } finally {
        setLoading(false);
      }
    }

    loadQuiz();
  }, [boardId]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600">Načítám board...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !quiz) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">
            {error || 'Board nebyl nalezen'}
          </h2>
          <p className="text-slate-500 mb-6">
            Zkontrolujte, zda je odkaz správný, nebo kontaktujte autora boardu.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 mx-auto"
          >
            <Home className="w-4 h-4" />
            Zpět na úvod
          </button>
        </div>
      </div>
    );
  }

  // Render QuizPreview in public mode
  return (
    <QuizPreview 
      quiz={quiz} 
      isPublicMode={true}
      boardId={boardId}
    />
  );
}

export default PublicBoardViewer;
