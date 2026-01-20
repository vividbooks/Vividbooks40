/**
 * Student Password Setup Page
 * 
 * Accessible at /student/setup/:token
 * Students use this page to set their initial password after being invited by a teacher.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  GraduationCap, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertCircle,
  Loader2,
  CheckCircle,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { useStudentAuth } from '../../contexts/StudentAuthContext';
import { supabase } from '../../utils/supabase/client';

interface StudentInfo {
  id: string;
  name: string;
  email: string;
  class_name?: string;
  teacher_name?: string;
}

export function StudentSetupPassword() {
  console.log('StudentSetupPassword component mounted');
  const { token } = useParams<{ token: string }>();
  console.log('Token from URL:', token);
  const navigate = useNavigate();
  const { setupPassword } = useStudentAuth();
  
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const hasRedirected = useRef(false);

  // Load student info from token
  useEffect(() => {
    async function loadStudentFromToken() {
      if (!token) {
        setError('Chybí token pro nastavení hesla.');
        setLoading(false);
        return;
      }
      
      try {
        console.log('Loading student with token:', token);
        const { data, error } = await supabase
          .from('students')
          .select(`
            id,
            name,
            email,
            classes:class_id (
              name,
              teachers:teacher_id (name)
            )
          `)
          .eq('password_setup_token', token)
          .gt('password_setup_expires', new Date().toISOString())
          .single();
        
        console.log('Query result:', { data, error });
        
        if (error || !data) {
          setError('Neplatný nebo expirovaný odkaz. Požádejte učitele o nový.');
          setLoading(false);
          return;
        }
        
        setStudentInfo({
          id: data.id,
          name: data.name,
          email: data.email || '',
          class_name: (data.classes as any)?.name,
          teacher_name: (data.classes as any)?.teachers?.name,
        });
        setLoading(false);
      } catch (err) {
        console.error('Catch error:', err);
        setError('Chyba při načítání údajů.');
        setLoading(false);
      }
    }
    
    loadStudentFromToken().finally(() => {
      console.log('loadStudentFromToken finished');
    });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate password
    if (password.length < 6) {
      setError('Heslo musí mít alespoň 6 znaků.');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Hesla se neshodují.');
      return;
    }
    
    if (!token) {
      setError('Chybí token.');
      return;
    }
    
    setSubmitting(true);
    
    const result = await setupPassword(token, password);
    
    if (result.error) {
      setError(result.error);
      setSubmitting(false);
    } else if (result.success) {
      setSuccess(true);
      setSubmitting(false);
    }
  };

  // Password strength indicator
  const getPasswordStrength = () => {
    if (password.length === 0) return { level: 0, text: '', color: '' };
    if (password.length < 6) return { level: 1, text: 'Slabé', color: 'bg-red-500' };
    if (password.length < 8) return { level: 2, text: 'Střední', color: 'bg-yellow-500' };
    if (password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)) {
      return { level: 4, text: 'Silné', color: 'bg-green-500' };
    }
    return { level: 3, text: 'Dobré', color: 'bg-blue-500' };
  };

  const strength = getPasswordStrength();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, #059669, #0d9488, #06b6d4)' }}>
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(to bottom right, #059669, #0d9488, #06b6d4)' }}>
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Heslo nastaveno!</h1>
          <p className="text-slate-600 mb-6">
            Tvůj účet je připraven. Nyní se můžeš přihlásit.
          </p>
          <Link
            to="/student/login"
            className="inline-flex items-center justify-center gap-2 w-full py-4 text-white font-semibold rounded-xl transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(to right, #059669, #0d9488)', boxShadow: '0 10px 15px -3px rgba(5, 150, 105, 0.3)' }}
          >
            Přihlásit se
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(to bottom right, #059669, #0d9488, #06b6d4)' }}>
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl" />
      </div>
      
      <div className="relative w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-2xl mb-4">
            <ShieldCheck className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
            Nastavení hesla
          </h1>
          <p className="text-white/80">Vytvoř si heslo pro přihlášení</p>
        </div>
        
        {/* Error state */}
        {error && !studentInfo && (
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Chyba</h2>
            <p className="text-slate-600 mb-6">{error}</p>
            <Link
              to="/student/login"
              className="text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Zpět na přihlášení
            </Link>
          </div>
        )}
        
        {/* Setup form */}
        {studentInfo && (
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            {/* Welcome message */}
            <div className="text-center mb-6">
              <p className="text-slate-600 mb-4">
                {studentInfo.teacher_name ? (
                  <>Učitel/ka <span className="font-semibold text-slate-800">{studentInfo.teacher_name}</span> tě zve do třídy </>
                ) : (
                  <>Byl/a jsi pozván/a do třídy </>
                )}
                <span className="font-semibold text-emerald-600">{studentInfo.class_name || 'Vividbooks'}</span>
              </p>
            </div>
            
            {/* Student info */}
            <div className="rounded-2xl p-4 mb-6" style={{ background: 'linear-gradient(to bottom right, #ecfdf5, #f0fdfa)', border: '1px solid #a7f3d0' }}>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-lg shrink-0" style={{ background: 'linear-gradient(to bottom right, #10b981, #14b8a6)' }}>
                  {studentInfo.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-lg">{studentInfo.name}</p>
                  <p className="text-sm text-slate-500">{studentInfo.email}</p>
                </div>
              </div>
            </div>
            
            <p className="text-center text-slate-500 text-sm mb-6">
              Nastav si heslo pro přístup ke svým materiálům a testům
            </p>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Error message */}
              {error && (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}
              
              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nové heslo
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimálně 6 znaků"
                    className="w-full pl-4 pr-12 py-3.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-slate-800"
                    autoComplete="new-password"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                
                {/* Password strength */}
                {password.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            level <= strength.level ? strength.color : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{strength.text}</p>
                  </div>
                )}
              </div>
              
              {/* Confirm password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Potvrzení hesla
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Zopakuj heslo"
                    className="w-full pl-4 pr-12 py-3.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-slate-800"
                    autoComplete="new-password"
                  />
                  {confirmPassword.length > 0 && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      {password === confirmPassword ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Submit button */}
              <button
                type="submit"
                disabled={submitting || password.length < 6 || password !== confirmPassword}
                className="w-full py-4 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ 
                  background: (submitting || password.length < 6 || password !== confirmPassword) 
                    ? '#9ca3af' 
                    : 'linear-gradient(to right, #059669, #0d9488)',
                  boxShadow: '0 10px 15px -3px rgba(5, 150, 105, 0.3)'
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Nastavuji heslo...
                  </>
                ) : (
                  <>
                    Nastavit heslo
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}



