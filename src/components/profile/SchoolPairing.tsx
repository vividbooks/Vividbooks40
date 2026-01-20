import { useState } from 'react';
import { School as SchoolIcon, ArrowLeft, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { School } from '../../types/profile';
import * as storage from '../../utils/profile-storage';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const SUPABASE_URL = `https://${projectId}.supabase.co`;
const SUPABASE_ANON_KEY = publicAnonKey;

interface SchoolPairingProps {
  onPaired: (school: School) => void;
  onClose: () => void;
}

export function SchoolPairing({ onPaired, onClose }: SchoolPairingProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [foundSchool, setFoundSchool] = useState<School | null>(null);

  const handleCodeChange = (value: string) => {
    // Only allow alphanumeric, max 6 chars
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setCode(cleaned);
    setError('');
    setFoundSchool(null);
  };

  const handleSearch = async () => {
    console.log('[SchoolPairing] handleSearch called with code:', code);
    
    if (code.length !== 6) {
      setError('Kód musí mít 6 znaků');
      return;
    }

    setLoading(true);
    setError('');

    // Try localStorage first for instant response
    const localSchool = storage.getSchoolByCode(code);
    if (localSchool) {
      console.log('[SchoolPairing] ✅ School found in localStorage:', localSchool.name);
      setFoundSchool(localSchool);
      setLoading(false);
      return;
    }

    // Then try Supabase with timeout using direct fetch
    try {
      console.log('[SchoolPairing] Fetching from Supabase...');
      console.log('[SchoolPairing] URL:', `${SUPABASE_URL}/rest/v1/schools?code=eq.${code.toUpperCase()}&select=*`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('[SchoolPairing] Request timeout after 8s');
        controller.abort();
      }, 8000);

      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/schools?code=eq.${code.toUpperCase()}&select=*`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      console.log('[SchoolPairing] Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[SchoolPairing] Schools found:', data?.length);
        
        if (data && data.length > 0) {
          const supabaseSchool = data[0];
          const school: School = {
            id: supabaseSchool.id,
            code: supabaseSchool.code,
            name: supabaseSchool.name,
            address: supabaseSchool.address || '',
            city: supabaseSchool.city || '',
            createdAt: supabaseSchool.created_at,
          };
          console.log('[SchoolPairing] ✅ School found in Supabase:', school.name);
          setFoundSchool(school);
          setLoading(false);
          return;
        }
      }
      
      // School not found
      console.log('[SchoolPairing] School not found');
      setError('Škola s tímto kódem nebyla nalezena');
    } catch (err: any) {
      console.error('[SchoolPairing] Error:', err?.name, err?.message);
      
      if (err?.name === 'AbortError') {
        setError('Připojení trvá příliš dlouho. Zkuste to znovu.');
      } else {
        setError('Nepodařilo se vyhledat školu');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (foundSchool) {
      onPaired(foundSchool);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        
        {/* Header */}
        <div className="p-6 pb-0">
          <div className="flex items-center gap-3 pr-10">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center">
              <SchoolIcon className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Propojení se školou</h1>
              <p className="text-slate-500 text-sm">Zadejte 6místný kód vaší školy</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {!foundSchool ? (
            <>
              {/* Code input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Kód školy
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    placeholder="ABC123"
                    className="flex-1 px-4 py-3 text-2xl font-mono font-bold tracking-[0.3em] text-center border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all uppercase"
                    maxLength={6}
                    autoFocus
                  />
                </div>
                <p className="text-sm text-slate-500 mt-2">
                  Kód získáte od vedení školy nebo administrátora Vividbooks
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={handleSearch}
                disabled={code.length !== 6 || loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Hledám...</span>
                  </>
                ) : (
                  <span>Vyhledat školu</span>
                )}
              </button>
            </>
          ) : (
            <>
              {/* Found school confirmation */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-1">Škola nalezena!</h3>
                <p className="text-slate-500 text-sm">Potvrďte propojení s touto školou</p>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <SchoolIcon className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800">{foundSchool.name}</h4>
                    {foundSchool.city && (
                      <p className="text-sm text-slate-500">{foundSchool.city}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleConfirm}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors"
                >
                  Potvrdit propojení
                </button>
                <button
                  onClick={() => {
                    setFoundSchool(null);
                    setCode('');
                  }}
                  className="w-full py-3 border-2 border-slate-200 hover:border-slate-300 text-slate-600 font-medium rounded-xl transition-colors"
                >
                  Zadat jiný kód
                </button>
              </div>
            </>
          )}
        </div>

        {/* Help section */}
        <div className="border-t border-slate-100 p-4 bg-slate-50">
          <p className="text-sm text-slate-500 text-center">
            Potřebujete pomoct? Kontaktujte nás na{' '}
            <a href="mailto:podpora@vividbooks.cz" className="text-indigo-600 hover:underline">
              podpora@vividbooks.cz
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

