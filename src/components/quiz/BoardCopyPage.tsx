/**
 * Board Copy Page
 * 
 * Landing page for "login link" sharing mode.
 * - If user is logged in: copies the board to their account and redirects to editor
 * - If user is not logged in: redirects to login, then copies after login
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Copy,
  Loader2,
  AlertCircle,
  LogIn,
  CheckCircle,
  Home,
} from 'lucide-react';
import { Quiz } from '../../types/quiz';
import { getQuizAsync, saveQuiz } from '../../utils/quiz-storage';
import { supabase } from '../../utils/supabase/client';

export function BoardCopyPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [copying, setCopying] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check authentication status
  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setIsLoggedIn(!!session?.user);
      } catch (e) {
        console.error('Error checking auth:', e);
      } finally {
        setCheckingAuth(false);
      }
    }

    checkAuth();
  }, []);

  // Load quiz data
  useEffect(() => {
    async function loadQuiz() {
      if (!boardId) {
        setError('Neplatný odkaz');
        setLoading(false);
        return;
      }

      try {
        const loadedQuiz = await getQuizAsync(boardId);
        if (loadedQuiz) {
          setQuiz(loadedQuiz);
        } else {
          setError('Board nebyl nalezen');
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

  // Copy board to user's account
  const copyBoard = async () => {
    if (!quiz) return;

    setCopying(true);
    
    try {
      // Generate new ID for the copy
      const newId = `quiz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create copy with new ID and updated metadata
      const copiedQuiz: Quiz = {
        ...quiz,
        id: newId,
        title: `${quiz.title} (kopie)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Clear any session-specific data
        slides: quiz.slides.map(slide => ({
          ...slide,
          id: `slide_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        })),
      };

      // Save to user's storage
      saveQuiz(copiedQuiz);

      // Redirect to editor
      navigate(`/quiz/editor/${newId}`);
    } catch (e) {
      console.error('Error copying board:', e);
      setError('Nepodařilo se zkopírovat board');
      setCopying(false);
    }
  };

  // Redirect to login
  const goToLogin = () => {
    // Store the return URL for after login
    localStorage.setItem('post-login-redirect', `/quiz/copy/${boardId}`);
    navigate('/login');
  };

  // ============================================
  // RENDER: LOADING
  // ============================================
  
  if (loading || checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-white mx-auto mb-4" />
          <p className="text-white/80">Načítám board...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: ERROR
  // ============================================
  
  if (error || !quiz) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
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

  // ============================================
  // RENDER: COPY PAGE
  // ============================================
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Copy className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">
            Zkopírovat board
          </h1>
          <p className="text-slate-500">
            Chcete si tento board zkopírovat k sobě a upravit?
          </p>
        </div>

        {/* Board info */}
        <div className="bg-slate-50 rounded-xl p-4 mb-6">
          <h2 className="font-semibold text-slate-800 mb-1">
            {quiz.title || 'Bez názvu'}
          </h2>
          <p className="text-sm text-slate-500">
            {quiz.slides.length} {quiz.slides.length === 1 ? 'slide' : 'slidů'}
          </p>
        </div>

        {/* Actions */}
        {isLoggedIn ? (
          <button
            onClick={copyBoard}
            disabled={copying}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {copying ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Kopíruji...
              </>
            ) : (
              <>
                <Copy className="w-5 h-5" />
                Zkopírovat do mého obsahu
              </>
            )}
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-sm text-slate-500">
              Pro zkopírování boardu se musíte přihlásit
            </p>
            <button
              onClick={goToLogin}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" />
              Přihlásit se a zkopírovat
            </button>
          </div>
        )}

        {/* Back link */}
        <button
          onClick={() => navigate('/')}
          className="w-full mt-4 py-2 text-slate-500 hover:text-slate-700 text-sm"
        >
          Zpět na úvod
        </button>
      </div>
    </div>
  );
}

export default BoardCopyPage;
