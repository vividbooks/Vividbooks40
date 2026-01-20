import { User, Clock, TrendingUp, Activity } from 'lucide-react';
import { Colleague } from '../../types/profile';

interface ColleaguesListProps {
  colleagues: Colleague[];
}

export function ColleaguesList({ colleagues }: ColleaguesListProps) {
  const formatLastActive = (dateStr?: string) => {
    if (!dateStr) return 'Nikdy';
    
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 5) return 'Právě teď';
    if (diffMins < 60) return `Před ${diffMins} min`;
    if (diffHours < 24) return `Před ${diffHours} h`;
    if (diffDays === 1) return 'Včera';
    if (diffDays < 7) return `Před ${diffDays} dny`;
    
    return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
  };

  const getActivityLevel = (sessions?: number): { label: string; color: string } => {
    if (!sessions) return { label: 'Neaktivní', color: 'slate' };
    if (sessions >= 10) return { label: 'Velmi aktivní', color: 'emerald' };
    if (sessions >= 5) return { label: 'Aktivní', color: 'blue' };
    if (sessions >= 1) return { label: 'Občasné použití', color: 'amber' };
    return { label: 'Neaktivní', color: 'slate' };
  };

  const isOnline = (dateStr?: string) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return diffMs < 5 * 60 * 1000; // 5 minutes
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 divide-y divide-slate-100">
      {colleagues.map((colleague) => {
        const activity = getActivityLevel(colleague.usageStats?.lastWeekSessions);
        const online = isOnline(colleague.lastActiveAt);

        return (
          <div key={colleague.id} className="p-4 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center text-lg font-semibold text-indigo-600">
                  {colleague.avatarUrl ? (
                    <img 
                      src={colleague.avatarUrl} 
                      alt={colleague.name} 
                      className="w-full h-full rounded-xl object-cover"
                    />
                  ) : (
                    colleague.name.charAt(0).toUpperCase()
                  )}
                </div>
                {/* Online indicator */}
                {online && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-slate-800 truncate">{colleague.name}</h4>
                  {online && (
                    <span className="text-xs text-emerald-600 font-medium">Online</span>
                  )}
                </div>
                <p className="text-sm text-slate-500 truncate">{colleague.email}</p>
              </div>

              {/* Stats */}
              <div className="hidden sm:flex flex-col items-end gap-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatLastActive(colleague.lastActiveAt)}</span>
                </div>
                {colleague.usageStats && (
                  <div className={`flex items-center gap-1.5 text-xs ${
                    activity.color === 'emerald' ? 'text-emerald-600' :
                    activity.color === 'blue' ? 'text-blue-600' :
                    activity.color === 'amber' ? 'text-amber-600' :
                    'text-slate-400'
                  }`}>
                    <Activity className="w-3.5 h-3.5" />
                    <span>{colleague.usageStats.lastWeekSessions} tento týden</span>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile stats */}
            <div className="sm:hidden flex items-center gap-4 mt-2 ml-15">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatLastActive(colleague.lastActiveAt)}</span>
              </div>
              {colleague.usageStats && (
                <div className={`flex items-center gap-1.5 text-xs ${
                  activity.color === 'emerald' ? 'text-emerald-600' :
                  activity.color === 'blue' ? 'text-blue-600' :
                  activity.color === 'amber' ? 'text-amber-600' :
                  'text-slate-400'
                }`}>
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>{activity.label}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {colleagues.length === 0 && (
        <div className="p-6 text-center">
          <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Zatím žádní kolegové z Vividbooks</p>
          <p className="text-sm text-slate-400 mt-1">
            Sdílejte kód školy s kolegy pro připojení
          </p>
        </div>
      )}
    </div>
  );
}













