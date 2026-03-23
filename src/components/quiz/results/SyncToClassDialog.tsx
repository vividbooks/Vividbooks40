import React from 'react';
import { Users, CheckCircle, RefreshCw } from 'lucide-react';
import { ClassGroup } from '../../../utils/supabase/classes';

interface SyncToClassDialogProps {
  studentCount: number;
  availableClasses: ClassGroup[];
  selectedClassId: string;
  setSelectedClassId: (id: string) => void;
  selectedSubject: string;
  setSelectedSubject: (subject: string) => void;
  syncSuccess: boolean;
  isSyncing: boolean;
  onSync: () => void;
  onClose: () => void;
}

const SUBJECTS = ['Matematika', 'Fyzika', 'Chemie', 'Přírodopis', 'Jiný'];

export function SyncToClassDialog({
  studentCount,
  availableClasses,
  selectedClassId,
  setSelectedClassId,
  selectedSubject,
  setSelectedSubject,
  syncSuccess,
  isSyncing,
  onSync,
  onClose,
}: SyncToClassDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Synchronizace se třídou</h3>
            <p className="text-slate-500 text-sm">{studentCount} studentů bude synchronizováno</p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          {/* Class selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Třída</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
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
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subject selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Předmět</label>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map((subject) => (
                <button
                  key={subject}
                  onClick={() => setSelectedSubject(subject)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: 500,
                    border: selectedSubject === subject ? '2px solid #10b981' : '2px solid #e2e8f0',
                    backgroundColor: selectedSubject === subject ? '#ecfdf5' : '#ffffff',
                    color: selectedSubject === subject ? '#059669' : '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  {subject}
                </button>
              ))}
            </div>
          </div>
        </div>

        {syncSuccess && (
          <div className="bg-emerald-100 text-emerald-700 p-4 rounded-xl text-center mb-4">
            ✓ Výsledky byly úspěšně synchronizovány!
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onSync}
            disabled={!selectedClassId || isSyncing}
            className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Ukládám...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Synchronizovat
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium"
          >
            Zrušit
          </button>
        </div>
      </div>
    </div>
  );
}
