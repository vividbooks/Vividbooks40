import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle, Monitor } from 'lucide-react';
import { useViewMode } from '../../contexts/ViewModeContext';
import { StudentAccessShell } from '../shared/StudentAccessShell';

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
    <StudentAccessShell
      icon={<Monitor className="w-8 h-8" />}
      title={
        status === 'loading'
          ? 'Připojování k hodině'
          : status === 'success'
            ? 'Úspěšně připojeno!'
            : 'Chyba připojení'
      }
      subtitle={message}
      maxWidthClassName="max-w-lg"
    >
      <div className="text-center">
        <div className="mb-8">
          {status === 'loading' && (
            <Loader2 className="w-12 h-12 mx-auto text-indigo-500 animate-spin" />
          )}
          {status === 'success' && (
            <CheckCircle className="w-12 h-12 mx-auto text-emerald-500" />
          )}
          {status === 'error' && (
            <XCircle className="w-12 h-12 mx-auto text-red-500" />
          )}
        </div>

        {sessionId && status !== 'error' && (
          <div className="mt-6 rounded-[22px] border border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 mb-2">
              Session ID
            </p>
            <p className="text-sm font-mono text-slate-700 break-all">{sessionId}</p>
          </div>
        )}

        {status === 'error' && (
          <button
            onClick={() => navigate('/')}
            className="mt-8 inline-flex items-center justify-center rounded-[20px] bg-slate-900 px-6 py-3 font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Zpět na hlavní stránku
          </button>
        )}
      </div>
    </StudentAccessShell>
  );
}












