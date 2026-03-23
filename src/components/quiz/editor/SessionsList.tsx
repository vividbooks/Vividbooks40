import React from 'react';
import { BarChart2, Radio, Link2, ChevronRight } from 'lucide-react';
import type { SessionData } from '../../../hooks/quiz/useSessionsData';

interface SessionsListProps {
  sessions: SessionData[];
  loadingSessions: boolean;
  onOpenSession: (session: SessionData) => void;
}

export function SessionsList({ sessions, loadingSessions, onOpenSession }: SessionsListProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-slate-200 bg-white">
        <h2 className="text-xl font-bold text-slate-800">Výsledky</h2>
        <p className="text-sm text-slate-500 mt-1">Přehled všech sessions pro tento board</p>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loadingSessions ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <BarChart2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Žádné aktivní sessions</p>
            <p className="text-sm mt-1">Spusťte kvíz nebo sdílejte ho se studenty</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const studentCount = Object.keys(session.students || {}).length;
              return (
                <button
                  key={session.id}
                  onClick={() => onOpenSession(session)}
                  className="w-full bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        session.type === 'live' ? 'bg-amber-100' : 'bg-blue-100'
                      }`}>
                        {session.type === 'live' ? (
                          <Radio className="w-6 h-6 text-amber-600" />
                        ) : (
                          <Link2 className="w-6 h-6 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{session.sessionName}</p>
                        <p className="text-sm text-slate-500">
                          {session.type === 'live' ? 'Živé promítání' : 'Sdílený úkol'}{' '}
                          •{' '}
                          {new Date(session.createdAt).toLocaleDateString('cs-CZ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-indigo-600">{studentCount}</p>
                        <p className="text-xs text-slate-400">účastníků</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
