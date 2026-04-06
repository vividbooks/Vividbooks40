import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../utils/supabase/client';
import { useViewMode } from '../../contexts/ViewModeContext';
import { setAuthReturnTo, authReturnToFromSearchParams } from '../../utils/auth-return-to';
import { getAuthCallbackRedirectUrl } from '../../utils/router-basename';
import { LaioutBrandLogo } from './LaioutBrandLogo';
import { LaioutLoginPaperCanvas } from './LaioutLoginPaperCanvas';

const BG = '#06051A';
const LAIOUT_LOGO_PX = 112;

function GoogleMark() {
  return (
    <svg width={20} height={20} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.86 11.86 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

/**
 * Minimální vstup do Laiout — jen logo a Google SSO (bez školního kódu).
 * Používá stejný OAuth callback jako učitelský login; návrat přes sessionStorage `auth-return-to`.
 */
export function LaioutLoginPage() {
  const location = useLocation();
  const { setViewMode } = useViewMode();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const rememberReturnTarget = () => {
    const fromQuery = authReturnToFromSearchParams(window.location.search);
    if (fromQuery) {
      setAuthReturnTo(fromQuery);
      return;
    }
    const path = `${location.pathname}${location.search}`;
    if (path.startsWith('/') && !path.startsWith('//')) {
      setAuthReturnTo(path);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      setViewMode('teacher');
      rememberReturnTarget();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getAuthCallbackRedirectUrl(),
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setLoading(false);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Nepodařilo se spustit přihlášení');
      setLoading(false);
    }
  };

  return (
    <div
      className="relative isolate min-h-screen overflow-hidden px-6"
      style={{ backgroundColor: BG }}
    >
      <LaioutLoginPaperCanvas />

      <div className="relative z-10 flex min-h-screen flex-col items-center">
        <div className="flex w-full flex-1 flex-col items-center justify-center">
          <div className="flex w-full max-w-sm -translate-y-7 flex-col items-center gap-0 text-center">
            <div className="flex flex-col items-center gap-5">
              <LaioutBrandLogo size={LAIOUT_LOGO_PX} />
              <h1
                className="whitespace-nowrap font-semibold text-white"
                style={{
                  fontFamily: "'Fenomen Sans', sans-serif",
                  fontSize: '2.625rem',
                  letterSpacing: '-0.04em',
                  lineHeight: 1.1,
                }}
              >
                laiout
              </h1>
            </div>

            <div className="w-full shrink-0" style={{ height: 70 }} aria-hidden />

            <div className="flex w-full flex-col items-center gap-4">
              <button
                type="button"
                onClick={() => void handleGoogle()}
                disabled={loading}
                className="inline-flex w-full max-w-xs items-center justify-center gap-3 rounded-xl bg-white px-5 py-3.5 text-sm font-medium text-gray-800 shadow-md transition hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
                ) : (
                  <GoogleMark />
                )}
                {loading ? 'Přesměrování…' : 'Přihlásit se přes Google'}
              </button>

              {error ? (
                <p className="text-sm text-red-400" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <p
          className="max-w-sm shrink-0 px-2 text-center font-mono text-[11px] uppercase tracking-[0.28em] text-white"
          style={{ paddingBottom: '2.5rem' }}
        >
          Design as code. Publishing, reinvented.
        </p>
      </div>
    </div>
  );
}
