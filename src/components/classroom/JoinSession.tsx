import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle, Monitor } from 'lucide-react';
import { useViewMode } from '../../contexts/ViewModeContext';

export function JoinSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { setViewMode } = useViewMode();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Připojuji se...');

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setMessage('Neplatný odkaz');
      return;
    }

    // Switch to student mode
    setViewMode('student');
    
    // Store the session ID to join
    localStorage.setItem('vivid-join-session', sessionId);
    
    // Brief delay to show the loading state
    const timer = setTimeout(() => {
      setStatus('success');
      setMessage('Připojeno! Přesměrovávám...');
      
      // Navigate to the docs after a brief moment
      setTimeout(() => {
        navigate('/docs/fyzika?reader=true');
      }, 1000);
    }, 1500);

    return () => clearTimeout(timer);
  }, [sessionId, navigate, setViewMode]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
        {/* Logo */}
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center">
            <Monitor className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Status */}
        <div className="mb-6">
          {status === 'loading' && (
            <Loader2 className="w-12 h-12 mx-auto text-emerald-500 animate-spin" />
          )}
          {status === 'success' && (
            <CheckCircle className="w-12 h-12 mx-auto text-emerald-500" />
          )}
          {status === 'error' && (
            <XCircle className="w-12 h-12 mx-auto text-red-500" />
          )}
        </div>

        {/* Message */}
        <h1 className="text-2xl font-bold text-slate-800 mb-2">
          {status === 'loading' && 'Připojování k hodině'}
          {status === 'success' && 'Úspěšně připojeno!'}
          {status === 'error' && 'Chyba připojení'}
        </h1>
        <p className="text-slate-600">{message}</p>

        {/* Session ID */}
        {sessionId && status !== 'error' && (
          <div className="mt-6 p-3 bg-slate-100 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">Session ID</p>
            <p className="text-sm font-mono text-slate-700 truncate">{sessionId}</p>
          </div>
        )}

        {/* Error retry */}
        {status === 'error' && (
          <button
            onClick={() => navigate('/')}
            className="mt-6 px-6 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors"
          >
            Zpět na hlavní stránku
          </button>
        )}
      </div>
    </div>
  );
}












