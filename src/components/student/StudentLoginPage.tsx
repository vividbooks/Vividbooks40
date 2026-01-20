/**
 * Student Login Page
 * 
 * Accessible at /student/login
 * Students can log in with:
 * 1. Email and password (full account)
 * 2. School student code (anonymous library access)
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  GraduationCap, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertCircle,
  Loader2,
  ArrowRight,
  BookOpen,
  Key,
  Library,
  User
} from 'lucide-react';
import { useStudentAuth } from '../../contexts/StudentAuthContext';
import { verifyStudentCode, StudentAccessData } from '../../utils/legacy-api';
import { supabase } from '../../utils/supabase/client';
import VividLogo from '../../imports/Group70';
import { RandomLottieBackground } from '../auth/RandomLottieBackground';

// Storage key for anonymous student access
const ANONYMOUS_STUDENT_KEY = 'vividbooks_anonymous_student';

type LoginMode = 'account' | 'code';

export function StudentLoginPage() {
  const navigate = useNavigate();
  const { login, student, loading: authLoading } = useStudentAuth();
  
  // Login mode toggle
  const [mode, setMode] = useState<LoginMode>('code'); // Default to code login
  
  // Account login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Code login state
  const [studentCode, setStudentCode] = useState('');
  
  // Shared state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Check for existing anonymous access on mount
  useEffect(() => {
    const savedAccess = localStorage.getItem(ANONYMOUS_STUDENT_KEY);
    if (savedAccess) {
      try {
        const accessData = JSON.parse(savedAccess) as StudentAccessData & { timestamp: number };
        // Check if access is still valid (24 hours)
        if (Date.now() - accessData.timestamp < 24 * 60 * 60 * 1000) {
          // Redirect to library
          navigate('/fyzika');
          return;
        } else {
          // Expired, clear it
          localStorage.removeItem(ANONYMOUS_STUDENT_KEY);
        }
      } catch {
        localStorage.removeItem(ANONYMOUS_STUDENT_KEY);
      }
    }
  }, [navigate]);

  // Redirect if logged in with full account
  useEffect(() => {
    if (!authLoading && student) {
      navigate('/library/student-wall');
    }
  }, [student, authLoading, navigate]);

  // Handle account login
  const handleAccountLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email.trim() || !password.trim()) {
      setError('Vyplňte email a heslo.');
      return;
    }
    
    setLoading(true);
    
    try {
      const result = await login(email, password);
      
      if (result.error) {
        setError(result.error);
      } else {
        navigate('/library/student-wall');
      }
    } catch (err: any) {
      setError(err.message || 'Přihlášení se nezdařilo.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Google Sign In
  const handleGoogleSignIn = async () => {
    console.log('[StudentLogin] Google Sign In clicked');
    setLoading(true);
    setError('');
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      if (error) {
        console.error('[StudentLogin] Google Sign In error:', error);
        setError('Nepodařilo se přihlásit přes Google: ' + error.message);
        setLoading(false);
      }
    } catch (err: any) {
      console.error('[StudentLogin] Google Sign In exception:', err);
      setError('Nastala chyba při přihlášení');
      setLoading(false);
    }
  };

  // Handle code login (anonymous library access)
  const handleCodeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!studentCode.trim()) {
      setError('Zadejte kód školy.');
      return;
    }
    
    setLoading(true);
    
    try {
      const accessData = await verifyStudentCode(studentCode.trim().toUpperCase());
      
      if (!accessData) {
        setError('Neplatný kód. Zkontrolujte, zda jste zadali správný žákovský kód.');
        setLoading(false);
        return;
      }
      
      // Save anonymous access to localStorage
      const dataToSave = {
        ...accessData,
        timestamp: Date.now(),
        isAnonymous: true,
      };
      localStorage.setItem(ANONYMOUS_STUDENT_KEY, JSON.stringify(dataToSave));
      
      // Also save a minimal profile for license hooks
      const anonymousProfile = {
        id: `anonymous-${Date.now()}`,
        userId: `anonymous-${Date.now()}`,
        name: 'Žák',
        email: '',
        role: 'student' as const,
        schoolId: accessData.schoolId,
        isAnonymous: true,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      };
      localStorage.setItem('vividbooks_current_user_profile', JSON.stringify(anonymousProfile));
      
      console.log('[StudentLogin] Anonymous access granted for school:', accessData.schoolName);
      
      // Redirect to library (first available subject or default)
      navigate('/fyzika');
    } catch (err: any) {
      console.error('[StudentLogin] Code login error:', err);
      setError('Nepodařilo se ověřit kód. Zkuste to znovu.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#3d4a5c' }}>
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - decorative with Lottie */}
      <div className="flex w-1/2 relative overflow-hidden" style={{ background: 'white' }}>
        <RandomLottieBackground />
      </div>
      
      {/* Right side - login form */}
      <div className="flex-1 flex items-center justify-center p-8" style={{ background: '#3d4a5c' }}>
        <div className="w-full max-w-sm">
          {/* Logo above form */}
          <div className="text-center mb-8">
            <div className="w-40 h-20 mx-auto mb-4" style={{ color: 'white' }}>
              <VividLogo />
            </div>
            <p className="text-white/80">
              Aplikace ve které najdete naše online předměty a pracovní sešity.
            </p>
          </div>
          
          {/* Mode Toggle */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex bg-white/10 rounded-lg p-1">
              <button
                type="button"
                onClick={() => { setMode('code'); setError(''); }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition-all ${
                  mode === 'code' 
                    ? 'bg-white text-gray-800 shadow-sm' 
                    : 'text-white/70 hover:text-white'
                }`}
              >
                <Key className="w-4 h-4" />
                Kód školy
              </button>
              <button
                type="button"
                onClick={() => { setMode('account'); setError(''); }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition-all ${
                  mode === 'account' 
                    ? 'bg-white text-gray-800 shadow-sm' 
                    : 'text-white/70 hover:text-white'
                }`}
              >
                <User className="w-4 h-4" />
                Můj účet
              </button>
            </div>
          </div>
          
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 mb-5">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}
          
          {/* Code Login Form */}
          {mode === 'code' && (
            <form onSubmit={handleCodeLogin} className="space-y-5">
              <div>
                <input
                  type="text"
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
                  placeholder="Zadejte KÓD ŠKOLY"
                  className="w-full px-6 py-4 border border-gray-300 text-center text-lg bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  style={{ borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}
                  autoComplete="off"
                  autoFocus
                />
                <p className="mt-2 text-xs text-white/70 text-center">
                  Kód získáš od svého učitele
                </p>
              </div>
              
              <button
                type="submit"
                disabled={loading || !studentCode.trim()}
                className="w-full py-4 text-white font-medium transition-all disabled:opacity-50 hover:bg-orange-600"
                style={{ 
                  borderRadius: '16px',
                  background: '#f97316',
                  boxShadow: '0 4px 15px rgba(249, 115, 22, 0.4)',
                }}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Library className="w-5 h-5" />
                    Vstoupit do knihovny
                  </span>
                )}
              </button>
            </form>
          )}
          
          {/* Account Login Form */}
          {mode === 'account' && (
            <div>
              <form onSubmit={handleAccountLogin} className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="E-mail"
                  className="w-full px-6 py-4 border border-gray-300 text-center text-lg bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  style={{ borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}
                  autoComplete="email"
                  autoFocus
                />
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Heslo"
                    className="w-full px-6 py-4 border border-gray-300 text-center text-lg bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent pr-12"
                    style={{ borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                
                <button
                  type="submit"
                  disabled={loading || !email.trim() || !password.trim()}
                  className="w-full py-4 text-white font-medium transition-all disabled:opacity-50 hover:bg-orange-600"
                  style={{ 
                    borderRadius: '16px',
                    background: '#f97316',
                    boxShadow: '0 4px 15px rgba(249, 115, 22, 0.4)',
                  }}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    'Přihlásit se'
                  )}
                </button>
              </form>
              
              {/* Google Sign In */}
              <div className="mt-4">
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/20"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-[#3d4a5c] text-white/70">nebo</span>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-white/50 transition-colors disabled:opacity-50 mx-auto"
                  style={{ background: 'white' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span className="text-gray-600">Přihlásit přes Google</span>
                </button>
              </div>
              
              <p className="text-sm text-white/70 text-center mt-4">
                Nemáš účet? Požádej svého učitele o vytvoření přístupu.
              </p>
            </div>
          )}
          
          {/* Teacher link */}
          <div className="mt-8 text-center">
            <Link 
              to="/teacher/login" 
              className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm"
            >
              <BookOpen className="w-4 h-4" />
              Přihlásit se jako učitel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Check if current user has anonymous student access
 */
export function hasAnonymousStudentAccess(): boolean {
  const saved = localStorage.getItem(ANONYMOUS_STUDENT_KEY);
  if (!saved) return false;
  
  try {
    const data = JSON.parse(saved);
    // Check if not expired (24 hours)
    return Date.now() - data.timestamp < 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * Get anonymous student access data
 */
export function getAnonymousStudentAccess(): StudentAccessData | null {
  const saved = localStorage.getItem(ANONYMOUS_STUDENT_KEY);
  if (!saved) return null;
  
  try {
    const data = JSON.parse(saved);
    if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clear anonymous student access
 */
export function clearAnonymousStudentAccess(): void {
  localStorage.removeItem(ANONYMOUS_STUDENT_KEY);
  localStorage.removeItem('vividbooks_current_user_profile');
}



