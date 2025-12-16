import { useState, useEffect, useCallback } from 'react';
import { Monitor, X, ExternalLink } from 'lucide-react';
import { useViewMode } from '../../contexts/ViewModeContext';

// Simple storage key
const STORAGE_KEY = 'vivid-classroom-share';

interface ActiveSession {
  id: string;
  className: string;
  teacherName: string;
  documentPath: string;
  documentTitle: string;
  isActive: boolean;
}

export function StudentShareNotification() {
  const { viewMode } = useViewMode();
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [dismissed, setDismissed] = useState(false);
  
  // Only show for teachers (students use StudentControlledView)
  const isTeacher = viewMode === 'teacher';

  // Check for active sessions (simple polling, no state manipulation)
  useEffect(() => {
    const checkSession = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          setSession(null);
          return;
        }
        
        const sessions = JSON.parse(stored);
        const active = sessions.find((s: any) => s.isActive);
        
        if (active) {
          // Check heartbeat - if no heartbeat for 5 seconds, consider inactive
          if (active.lastHeartbeat && Date.now() - active.lastHeartbeat > 5000) {
            setSession(null);
            return;
          }
          
          setSession({
            id: active.id,
            className: active.className,
            teacherName: active.teacherName || 'Učitel',
            documentPath: active.documentPath,
            documentTitle: active.documentTitle,
            isActive: true
          });
        } else {
          setSession(null);
        }
      } catch (e) {
        setSession(null);
      }
    };

    checkSession();
    const interval = setInterval(checkSession, 2000);
    return () => clearInterval(interval);
  }, []);

  // Reset dismissed when session changes
  useEffect(() => {
    if (session?.id) {
      setDismissed(false);
    }
  }, [session?.id]);

  const handleOpenContent = useCallback(() => {
    if (session?.documentPath) {
      // Open in current tab with reader mode
      window.location.href = `${session.documentPath}?reader=true`;
    }
  }, [session?.documentPath]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  // Don't show at all - students use StudentControlledView instead
  // This component is kept for potential future use as a manual join option
  if (true || isTeacher || !session || dismissed) {
    return null;
  }

  // Check if already viewing the shared content
  const isOnSharedContent = window.location.pathname === session.documentPath;
  if (isOnSharedContent) {
    return null;
  }

  return (
    <div 
      className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-4 duration-300"
      style={{ pointerEvents: 'auto' }}
    >
      <div className="bg-white rounded-xl shadow-2xl border border-emerald-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <div className="relative">
              <Monitor className="w-4 h-4" />
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-400 rounded-full animate-pulse" />
            </div>
            <span className="font-medium text-sm">Živé sdílení</span>
          </div>
          <button 
            onClick={handleDismiss}
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4">
          <p className="text-slate-700 text-sm mb-1">
            <span className="font-semibold">{session.teacherName}</span> sdílí obsah s třídou {session.className}
          </p>
          <p className="text-slate-500 text-xs mb-3 truncate">
            {session.documentTitle}
          </p>
          
          <button
            onClick={handleOpenContent}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium text-sm transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Zobrazit sdílený obsah
          </button>
        </div>
      </div>
    </div>
  );
}

