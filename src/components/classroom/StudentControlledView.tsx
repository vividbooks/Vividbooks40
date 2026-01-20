import { useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { useViewMode } from '../../contexts/ViewModeContext';

const STORAGE_KEY = 'vivid-classroom-share';
const STUDENT_ID_KEY = 'vivid-student-id';

// Get or create student ID
function getStudentId(): string {
  let id = localStorage.getItem(STUDENT_ID_KEY);
  if (!id) {
    id = `student-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(STUDENT_ID_KEY, id);
  }
  return id;
}

// Get student name from profile
function getStudentName(): string {
  try {
    const profile = localStorage.getItem('vividbooks-user-profile');
    if (profile) {
      const parsed = JSON.parse(profile);
      if (parsed.name) return parsed.name;
    }
  } catch (e) {}
  
  const names = ['Jan Novák', 'Eva Svobodová', 'Petr Hloubavý', 'Marie Veselá'];
  return names[Math.floor(Math.random() * names.length)];
}

interface SessionData {
  id: string;
  isActive: boolean;
  documentPath: string;
  documentTitle: string;
  scrollPosition: number;
  lastHeartbeat?: number;
  className: string;
  teacherName: string;
  connectedStudents: Array<{
    id: string;
    name: string;
    isActive: boolean;
    lastSeen: number;
    joinedAt: number;
  }>;
}

export function StudentControlledView() {
  const { viewMode } = useViewMode();
  
  // Only activate for students
  const isStudent = viewMode === 'student';
  
  // All state in refs to avoid re-renders
  const sessionRef = useRef<SessionData | null>(null);
  const lastPathRef = useRef<string>('');
  const lastScrollRef = useRef<number>(0);
  const isActiveRef = useRef<boolean>(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const studentIdRef = useRef<string>(getStudentId());
  const studentNameRef = useRef<string>(getStudentName());
  const isMountedRef = useRef<boolean>(true);

  // Register student in session
  const registerStudent = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      
      const sessions: SessionData[] = JSON.parse(stored);
      const sessionIndex = sessions.findIndex(s => s.id === sessionRef.current?.id);
      
      if (sessionIndex >= 0) {
        const session = sessions[sessionIndex];
        const existingIndex = session.connectedStudents.findIndex(
          s => s.id === studentIdRef.current
        );
        
        if (existingIndex >= 0) {
          session.connectedStudents[existingIndex].isActive = true;
          session.connectedStudents[existingIndex].lastSeen = Date.now();
        } else {
          session.connectedStudents.push({
            id: studentIdRef.current,
            name: studentNameRef.current,
            isActive: true,
            lastSeen: Date.now(),
            joinedAt: Date.now()
          });
        }
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
      }
    } catch (e) {
      console.error('Failed to register student:', e);
    }
  }, []);

  // Update student activity
  const updateActivity = useCallback((active: boolean) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      
      const sessions: SessionData[] = JSON.parse(stored);
      const sessionIndex = sessions.findIndex(s => s.id === sessionRef.current?.id);
      
      if (sessionIndex >= 0) {
        const studentIndex = sessions[sessionIndex].connectedStudents.findIndex(
          s => s.id === studentIdRef.current
        );
        
        if (studentIndex >= 0) {
          sessions[sessionIndex].connectedStudents[studentIndex].isActive = active;
          sessions[sessionIndex].connectedStudents[studentIndex].lastSeen = Date.now();
          localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
        }
      }
    } catch (e) {}
  }, []);

  // Force exit
  const forceExit = useCallback(() => {
    updateActivity(false);
    sessionRef.current = null;
    isActiveRef.current = false;
    // Remove overlay
    if (overlayRef.current) {
      overlayRef.current.style.display = 'none';
    }
    // Navigate to home
    window.location.href = '/docs/fyzika';
  }, [updateActivity]);

  // Main sync loop - runs independently of React
  useEffect(() => {
    // Only run for students
    if (!isStudent) return;
    
    isMountedRef.current = true;
    
    const syncLoop = () => {
      if (!isMountedRef.current) return;
      
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          if (isActiveRef.current) {
            isActiveRef.current = false;
            if (overlayRef.current) {
              overlayRef.current.style.display = 'none';
            }
          }
          return;
        }
        
        const sessions: SessionData[] = JSON.parse(stored);
        const activeSession = sessions.find(s => s.isActive);
        
        // Check if session ended or teacher disconnected
        if (!activeSession || 
            (activeSession.lastHeartbeat && Date.now() - activeSession.lastHeartbeat > 5000)) {
          if (isActiveRef.current) {
            isActiveRef.current = false;
            sessionRef.current = null;
            if (overlayRef.current) {
              overlayRef.current.style.display = 'none';
            }
          }
          return;
        }
        
        // Session is active
        if (!isActiveRef.current) {
          // Just joined
          isActiveRef.current = true;
          sessionRef.current = activeSession;
          registerStudent();
          
          // Show overlay
          if (overlayRef.current) {
            overlayRef.current.style.display = 'flex';
          }
        }
        
        sessionRef.current = activeSession;
        
        // Navigate if path changed
        if (activeSession.documentPath !== lastPathRef.current) {
          lastPathRef.current = activeSession.documentPath;
          // Use replace to avoid history buildup
          const targetUrl = `${activeSession.documentPath}?reader=true`;
          if (window.location.pathname + window.location.search !== targetUrl) {
            window.location.replace(targetUrl);
          }
        }
        
        // Sync scroll directly (no state update)
        if (activeSession.scrollPosition !== lastScrollRef.current) {
          lastScrollRef.current = activeSession.scrollPosition;
          window.scrollTo({
            top: activeSession.scrollPosition,
            behavior: 'auto' // instant, no animation
          });
        }
        
      } catch (e) {
        console.error('Sync error:', e);
      }
    };
    
    // Run sync loop frequently
    syncLoop();
    const interval = setInterval(syncLoop, 200);
    
    // Heartbeat for activity tracking
    const heartbeat = setInterval(() => {
      if (isActiveRef.current) {
        updateActivity(document.visibilityState === 'visible');
      }
    }, 2000);
    
    // Visibility change handler
    const handleVisibility = () => {
      if (isActiveRef.current) {
        updateActivity(document.visibilityState === 'visible');
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    
    // Prevent scroll when controlled
    const preventScroll = (e: WheelEvent) => {
      if (isActiveRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener('wheel', preventScroll, { passive: false });
    
    // Keyboard handler
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isActiveRef.current) {
        forceExit();
      }
      // Block scroll keys when controlled
      if (isActiveRef.current) {
        const scrollKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
        if (scrollKeys.includes(e.key)) {
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', handleKeydown);
    
    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('wheel', preventScroll);
      window.removeEventListener('keydown', handleKeydown);
      if (isActiveRef.current) {
        updateActivity(false);
      }
    };
  }, [isStudent, registerStudent, updateActivity, forceExit]);

  // Render minimal overlay - this never re-renders after mount
  return (
    <div 
      ref={overlayRef}
      style={{ display: 'none' }}
      className="fixed inset-0 z-[9999] pointer-events-none"
    >
      {/* Top bar indicator */}
      <div 
        className="absolute top-0 left-0 right-0 h-1 pointer-events-none"
        style={{ background: 'linear-gradient(90deg, #10b981, #059669, #10b981)' }}
      />
      
      {/* Exit button - always visible */}
      <button
        onClick={forceExit}
        className="absolute bottom-4 right-4 p-2 rounded-full bg-white/80 hover:bg-red-100 border border-slate-200 shadow-lg pointer-events-auto transition-colors"
        title="Ukončit sledování (Esc)"
      >
        <X className="w-5 h-5 text-slate-600 hover:text-red-500" />
      </button>
      
      {/* Subtle teacher indicator */}
      <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/90 text-white text-sm font-medium shadow-lg pointer-events-none">
        <div className="relative">
          <div className="w-2 h-2 bg-white rounded-full" />
          <div className="absolute inset-0 w-2 h-2 bg-white rounded-full animate-ping" />
        </div>
        <span>Učitel sdílí</span>
      </div>
    </div>
  );
}

