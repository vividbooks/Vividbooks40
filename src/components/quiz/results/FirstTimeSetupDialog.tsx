import React from 'react';
import { Users, CheckCircle, RefreshCw } from 'lucide-react';
import { ClassGroup } from '../../../utils/supabase/classes';

interface FirstTimeSetupDialogProps {
  studentCount: number;
  availableClasses: ClassGroup[];
  setupClassId: string;
  setSetupClassId: (id: string) => void;
  suggestedClassName: string;
  setupSubject: string;
  setSetupSubject: (subject: string) => void;
  isSyncing: boolean;
  sessionId: string | undefined;
  onConfirm: () => void;
  onDismiss: () => void;
}

const SUBJECTS = ['Matematika', 'Fyzika', 'Chemie', 'Přírodopis', 'Jiný'];

export function FirstTimeSetupDialog({
  studentCount,
  availableClasses,
  setupClassId,
  setSetupClassId,
  suggestedClassName,
  setupSubject,
  setSetupSubject,
  isSyncing,
  sessionId,
  onConfirm,
  onDismiss,
}: FirstTimeSetupDialogProps) {
  const handleDismiss = () => {
    if (sessionId) {
      localStorage.setItem(`quiz_setup_dismissed_${sessionId}`, 'true');
    }
    onDismiss();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Kam uložit výsledky?</h3>
            <p className="text-slate-500 text-sm">{studentCount} studentů dokončilo kvíz</p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          {/* Class selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Třída</label>
            <select
              value={setupClassId}
              onChange={(e) => setSetupClassId(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: '2px solid #e2e8f0',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                color: '#1f2937',
              }}
            >
              <option value="">-- Vyberte třídu --</option>
              {availableClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.id === setupClassId && suggestedClassName ? '(doporučeno)' : ''}
                </option>
              ))}
            </select>
            {suggestedClassName && setupClassId && (
              <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Detekováno podle připojených studentů
              </p>
            )}
          </div>

          {/* Subject selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Předmět</label>
            <div className="flex gap-2 flex-wrap">
              {SUBJECTS.map((subject) => (
                <button
                  key={subject}
                  onClick={() => setSetupSubject(subject)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: 500,
                    border: setupSubject === subject ? '2px solid #6366f1' : '2px solid #e2e8f0',
                    backgroundColor: setupSubject === subject ? '#eef2ff' : '#ffffff',
                    color: setupSubject === subject ? '#4f46e5' : '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  {subject}
                </button>
              ))}
            </div>
            {setupSubject && (
              <p className="text-xs text-slate-500 mt-2">
                Předmět "{setupSubject}" bude přiřazen k výsledkům
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
          <button
            onClick={onConfirm}
            disabled={!setupClassId || isSyncing}
            style={{
              width: '100%',
              padding: '14px 20px',
              borderRadius: '12px',
              background: !setupClassId || isSyncing ? '#94a3b8' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white',
              fontWeight: 600,
              fontSize: '15px',
              border: 'none',
              cursor: !setupClassId || isSyncing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {isSyncing ? (
              <>
                <RefreshCw style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                Ukládám...
              </>
            ) : (
              <>
                <CheckCircle style={{ width: '18px', height: '18px' }} />
                Uložit do třídy
              </>
            )}
          </button>
          <button
            onClick={handleDismiss}
            style={{
              width: '100%',
              padding: '10px',
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Přeskočit
          </button>
        </div>
      </div>
    </div>
  );
}
