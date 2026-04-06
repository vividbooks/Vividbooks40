import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { ClassroomShareSession, ClassroomShareState, ConnectedStudent } from '../types/classroom-share';
import { useViewMode } from './ViewModeContext';
import { supabase } from '../utils/supabase/client';
import { getMojeTridaFlags } from '../features/moje-trida';
import { isUsingSupabase } from '../utils/supabase/classes';
import { useStudentAuth } from './StudentAuthContext';
import {
  createClassroomDocumentShareSession,
  patchShareSessionSettings,
  subscribeShareSession,
  upsertShareStudentRecord,
  updateShareStudentRecord,
  loadShareSession,
  findActiveClassroomDocumentShareForClass,
  type ShareSessionRecord,
} from '../utils/live-session-repository';

function shareRecordToConnectedStudents(share: ShareSessionRecord): ConnectedStudent[] {
  return Object.values(share.responses).map((r) => ({
    id: r.studentId,
    name: r.studentName,
    isActive: (r.isOnline ?? true) && (r.isFocused ?? true),
    lastSeen: new Date(r.lastActiveAt).getTime(),
    joinedAt: new Date(r.joinedAt).getTime(),
  }));
}

function shareRecordToClassroomSession(share: ShareSessionRecord): ClassroomShareSession {
  return {
    id: share.id,
    classId: share.classId || '',
    className: share.classroomClassName || '',
    teacherId: share.createdBy,
    teacherName: share.shareTeacherName || 'Učitel',
    isActive: share.sessionStatus !== 'ended',
    startedAt: share.createdAt,
    documentPath: share.classroomDocumentPath || '',
    documentTitle: share.sessionName,
    scrollPosition: share.scrollPosition ?? 0,
    currentSection: share.currentSection ?? undefined,
    connectedStudents: shareRecordToConnectedStudents(share),
  };
}

// =============================================
// FIREBASE CONFIG (replace with your config)
// =============================================
// For production, use Firebase Realtime Database:
// import { initializeApp } from 'firebase/app';
// import { getDatabase, ref, set, onValue, remove, update } from 'firebase/database';

// =============================================
// MOCK REAL-TIME SYNC (using localStorage + BroadcastChannel)
// This simulates Firebase behavior for demo purposes
// =============================================

const STORAGE_KEY = 'vivid-classroom-share';
const CHANNEL_NAME = 'vivid-classroom-sync';

// BroadcastChannel for cross-tab communication (simulates real-time)
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
}

interface ClassroomShareContextType {
  // State
  state: ClassroomShareState;
  
  // Connected students (for teacher panel)
  connectedStudents: ConnectedStudent[];
  
  // Teacher actions
  startSharing: (classId: string, className: string, documentPath: string, documentTitle: string) => void;
  stopSharing: () => void;
  updateScrollPosition: (scrollY: number) => void;
  updateDocumentPath: (path: string, title: string) => void;
  updateCurrentSection: (sectionId: string) => void;
  
  // Student actions
  joinSession: (sessionId: string) => void;
  leaveSession: () => void;
  registerStudent: (studentId: string, studentName: string) => void;
  updateStudentActivity: (studentId: string, isActive: boolean) => void;
  
  // Utils
  getActiveSessionForClass: (classId: string) => ClassroomShareSession | null;
  /** Načte aktivní sdílení z Supabase a uloží do cache (pro `getActiveSessionForClass`). */
  prefetchActiveSessionForClass: (classId: string) => Promise<ClassroomShareSession | null>;
}

const ClassroomShareContext = createContext<ClassroomShareContextType | undefined>(undefined);

export function ClassroomShareProvider({ children }: { children: ReactNode }) {
  const { viewMode } = useViewMode();
  const { student: authStudent } = useStudentAuth();
  const [state, setState] = useState<ClassroomShareState>({
    isSharing: false,
    currentSession: null,
    isLocked: false,
    activeSession: null,
  });
  
  const [connectedStudents, setConnectedStudents] = useState<ConnectedStudent[]>([]);
  /** Cache aktivního classroom share z DB (`undefined` = ještě nenačteno). */
  const [supabaseSessionsByClass, setSupabaseSessionsByClass] = useState<
    Record<string, ClassroomShareSession | null>
  >({});
  const [supabaseShareMode, setSupabaseShareMode] = useState(false);
  const supabaseShareModeRef = useRef(false);
  const currentSessionRef = useRef<ClassroomShareSession | null>(null);
  const scrollUpdateTimeout = useRef<NodeJS.Timeout | null>(null);
  const studentHeartbeatRef = useRef<NodeJS.Timeout | null>(null);

  const setSupabaseShare = useCallback((v: boolean) => {
    supabaseShareModeRef.current = v;
    setSupabaseShareMode(v);
  }, []);

  useEffect(() => {
    currentSessionRef.current = state.currentSession;
  }, [state.currentSession]);

  // Auto-stop sharing when teacher closes window/tab
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (state.isSharing && state.currentSession) {
        // Synchronously update storage to mark session as inactive
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const sessions: ClassroomShareSession[] = JSON.parse(stored);
            const updatedSessions = sessions.map(s => 
              s.id === state.currentSession?.id 
                ? { ...s, isActive: false } 
                : s
            );
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSessions));
            // Broadcast to other tabs immediately
            broadcastChannel?.postMessage({ type: 'SESSION_UPDATE' });
          }
        } catch (e) {
          console.error('Failed to stop sharing on unload:', e);
        }
      }
    };

    // Handle both beforeunload and unload for better coverage
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [state.isSharing, state.currentSession]);

  // Teacher heartbeat - update lastHeartbeat to detect if teacher disconnects
  useEffect(() => {
    if (!state.isSharing || !state.currentSession) return;

    if (supabaseShareMode) {
      const sendHeartbeat = () => {
        const id = currentSessionRef.current?.id;
        if (!id) return;
        void patchShareSessionSettings(id, { lastHeartbeat: Date.now() }).catch((e) =>
          console.error('Classroom share heartbeat (Supabase):', e),
        );
      };
      sendHeartbeat();
      const interval = setInterval(sendHeartbeat, 2000);
      return () => clearInterval(interval);
    }

    const sendHeartbeat = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const sessions: ClassroomShareSession[] = JSON.parse(stored);
          const updatedSessions = sessions.map(s => 
            s.id === state.currentSession?.id 
              ? { ...s, lastHeartbeat: Date.now() } 
              : s
          );
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSessions));
        }
      } catch (e) {
        console.error('Failed to send heartbeat:', e);
      }
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 2000);
    return () => clearInterval(interval);
  }, [state.isSharing, state.currentSession?.id, supabaseShareMode]);

  // Load initial state from storage
  useEffect(() => {
    const loadState = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const sessions: ClassroomShareSession[] = JSON.parse(stored);
          const activeSession = sessions.find(s => s.isActive);
          
          if (viewMode === 'student' && activeSession) {
            // Student: check if there's an active session for their class
            setState(prev => ({
              ...prev,
              isLocked: true,
              activeSession,
            }));
          }
        }
      } catch (e) {
        console.error('Failed to load classroom share state:', e);
      }
    };
    
    loadState();
    
    // Listen for changes from other tabs/windows
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'SESSION_UPDATE') {
        loadState();
      }
    };
    
    broadcastChannel?.addEventListener('message', handleMessage);
    
    // Poll for changes (fallback for browsers without BroadcastChannel)
    const pollInterval = setInterval(loadState, 1000);
    
    return () => {
      broadcastChannel?.removeEventListener('message', handleMessage);
      clearInterval(pollInterval);
    };
  }, [viewMode]);

  // Save session to storage and broadcast
  const saveSession = useCallback((session: ClassroomShareSession | null) => {
    try {
      let sessions: ClassroomShareSession[] = [];
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        sessions = JSON.parse(stored);
      }
      
      if (session) {
        // Update or add session
        const index = sessions.findIndex(s => s.id === session.id);
        if (index >= 0) {
          sessions[index] = session;
        } else {
          sessions.push(session);
        }
      }
      
      // Remove inactive sessions older than 1 hour
      const oneHourAgo = Date.now() - 3600000;
      sessions = sessions.filter(s => 
        s.isActive || new Date(s.startedAt).getTime() > oneHourAgo
      );
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
      
      // Broadcast to other tabs
      broadcastChannel?.postMessage({ type: 'SESSION_UPDATE' });
    } catch (e) {
      console.error('Failed to save session:', e);
    }
  }, []);

  // Teacher: Start sharing
  const startSharing = useCallback((
    classId: string, 
    className: string, 
    documentPath: string, 
    documentTitle: string
  ) => {
    void (async () => {
      let sessionId = `session-${Date.now()}`;
      let teacherId = 'teacher-1';
      let teacherName = 'Učitel';
      let supabaseOk = false;

      const flags = getMojeTridaFlags();
      if (flags.classroomShareSupabase && isUsingSupabase()) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          teacherId = user?.id ?? 'teacher-1';
          teacherName =
            (user?.user_metadata as { full_name?: string } | undefined)?.full_name ||
            user?.email ||
            'Učitel';
          const { publicId } = await createClassroomDocumentShareSession({
            classId,
            className,
            documentPath,
            documentTitle,
            teacherUserId: teacherId,
            teacherName,
          });
          sessionId = publicId;
          supabaseOk = true;
        } catch (e) {
          console.error('Classroom share Supabase create failed, using legacy localStorage only', e);
        }
      }

      const session: ClassroomShareSession = {
        id: sessionId,
        classId,
        className,
        teacherId,
        teacherName,
        isActive: true,
        startedAt: new Date().toISOString(),
        documentPath,
        documentTitle,
        scrollPosition: 0,
        connectedStudents: [],
      };

      setSupabaseShare(supabaseOk);
      setState(prev => ({
        ...prev,
        isSharing: true,
        currentSession: session,
      }));
      saveSession(session);
    })();
  }, [saveSession, setSupabaseShare]);

  // Teacher: Stop sharing
  const stopSharing = useCallback(() => {
    const cur = currentSessionRef.current;
    const wasSupabase = supabaseShareModeRef.current;
    if (wasSupabase && cur) {
      void patchShareSessionSettings(cur.id, {}, { status: 'ended' }).catch((e) =>
        console.error('Classroom share stop (Supabase):', e),
      );
    }
    setSupabaseShare(false);
    if (cur) {
      saveSession({ ...cur, isActive: false });
      if (cur.classId) {
        setSupabaseSessionsByClass((prev) => ({ ...prev, [cur.classId]: null }));
      }
    }
    setConnectedStudents([]);
    setState(prev => ({
      ...prev,
      isSharing: false,
      currentSession: null,
    }));
  }, [saveSession, setSupabaseShare]);

  // Teacher: Update scroll position (debounced)
  const updateScrollPosition = useCallback((scrollY: number) => {
    if (scrollUpdateTimeout.current) {
      clearTimeout(scrollUpdateTimeout.current);
    }
    
    scrollUpdateTimeout.current = setTimeout(() => {
      const cur = currentSessionRef.current;
      if (!cur) return;
      const updatedSession = {
        ...cur,
        scrollPosition: scrollY,
      };
      if (supabaseShareModeRef.current) {
        void patchShareSessionSettings(cur.id, { scrollPosition: scrollY }).catch((e) =>
          console.error('Classroom share scroll (Supabase):', e),
        );
      }
      setState(prev => ({
        ...prev,
        currentSession: updatedSession,
      }));
      saveSession(updatedSession);
    }, 50); // Debounce 50ms for smoother sync
  }, [saveSession]);

  // Teacher: Update document path (when navigating to different content)
  const updateDocumentPath = useCallback((path: string, title: string) => {
    const cur = currentSessionRef.current;
    if (cur && cur.documentPath !== path) {
      const updatedSession = {
        ...cur,
        documentPath: path,
        documentTitle: title,
        scrollPosition: 0,
      };
      if (supabaseShareModeRef.current) {
        void patchShareSessionSettings(cur.id, {
          documentPath: path,
          documentTitle: title,
          scrollPosition: 0,
        }, { title }).catch((e) => console.error('Classroom share doc path (Supabase):', e));
      }
      setState(prev => ({
        ...prev,
        currentSession: updatedSession,
      }));
      saveSession(updatedSession);
    }
  }, [saveSession]);

  // Teacher: Update current section
  const updateCurrentSection = useCallback((sectionId: string) => {
    const cur = currentSessionRef.current;
    if (cur) {
      const updatedSession = {
        ...cur,
        currentSection: sectionId,
      };
      if (supabaseShareModeRef.current) {
        void patchShareSessionSettings(cur.id, { currentSection: sectionId }).catch((e) =>
          console.error('Classroom share section (Supabase):', e),
        );
      }
      setState(prev => ({
        ...prev,
        currentSession: updatedSession,
      }));
      saveSession(updatedSession);
    }
  }, [saveSession]);

  // Student: Join session
  const joinSession = useCallback((sessionId: string) => {
    void (async () => {
      if (getMojeTridaFlags().classroomShareSupabase && isUsingSupabase()) {
        try {
          const loaded = await loadShareSession(sessionId);
          if (loaded?.share && loaded.share.sessionStatus !== 'ended') {
            const session = shareRecordToClassroomSession(loaded.share);
            if (session.isActive) {
              setState(prev => ({
                ...prev,
                isLocked: true,
                activeSession: session,
              }));
              return;
            }
          }
        } catch (e) {
          console.error('Join session (Supabase):', e);
        }
      }
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const sessions: ClassroomShareSession[] = JSON.parse(stored);
          const session = sessions.find(s => s.id === sessionId && s.isActive);
          if (session) {
            setState(prev => ({
              ...prev,
              isLocked: true,
              activeSession: session,
            }));
          }
        }
      } catch (e) {
        console.error('Failed to join session:', e);
      }
    })();
  }, []);

  // Student: Leave session (only when teacher stops)
  const leaveSession = useCallback(() => {
    setState(prev => ({
      ...prev,
      isLocked: false,
      activeSession: null,
    }));
  }, []);

  // Student: Register as connected
  const registerStudent = useCallback((studentId: string, studentName: string) => {
    if (!state.activeSession) return;

    if (getMojeTridaFlags().classroomShareSupabase && isUsingSupabase()) {
      const sid = state.activeSession.id;
      const now = new Date().toISOString();
      void upsertShareStudentRecord('supabase', sid, studentId, {
        studentId,
        studentName,
        joinedAt: now,
        lastActiveAt: now,
        currentSlide: 0,
        isOnline: true,
        isFocused: true,
        responses: {},
        deviceId: '',
      }).catch((e) => console.error('registerStudent (Supabase):', e));
    }
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const sessions: ClassroomShareSession[] = JSON.parse(stored);
        const sessionIndex = sessions.findIndex(s => s.id === state.activeSession?.id);
        
        if (sessionIndex >= 0) {
          const session = sessions[sessionIndex];
          const existingStudent = session.connectedStudents.find(s => s.id === studentId);
          
          if (!existingStudent) {
            session.connectedStudents.push({
              id: studentId,
              name: studentName,
              isActive: true,
              lastSeen: Date.now(),
              joinedAt: Date.now(),
            });
          } else {
            existingStudent.isActive = true;
            existingStudent.lastSeen = Date.now();
          }
          
          localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
          broadcastChannel?.postMessage({ type: 'SESSION_UPDATE' });
        }
      }
    } catch (e) {
      console.error('Failed to register student:', e);
    }
  }, [state.activeSession]);

  // Student: Update activity status
  const updateStudentActivity = useCallback((studentId: string, isActive: boolean) => {
    if (!state.activeSession) return;

    if (getMojeTridaFlags().classroomShareSupabase && isUsingSupabase()) {
      const sid = state.activeSession.id;
      void updateShareStudentRecord('supabase', sid, studentId, {
        isOnline: isActive,
        isFocused: isActive,
        lastActiveAt: new Date().toISOString(),
      }).catch((e) => console.error('updateStudentActivity (Supabase):', e));
    }
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const sessions: ClassroomShareSession[] = JSON.parse(stored);
        const sessionIndex = sessions.findIndex(s => s.id === state.activeSession?.id);
        
        if (sessionIndex >= 0) {
          const session = sessions[sessionIndex];
          const studentIndex = session.connectedStudents.findIndex(s => s.id === studentId);
          
          if (studentIndex >= 0) {
            session.connectedStudents[studentIndex].isActive = isActive;
            session.connectedStudents[studentIndex].lastSeen = Date.now();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
            broadcastChannel?.postMessage({ type: 'SESSION_UPDATE' });
          }
        }
      }
    } catch (e) {
      console.error('Failed to update student activity:', e);
    }
  }, [state.activeSession]);

  // Realtime účastníci při sdílení přes Supabase
  useEffect(() => {
    if (!supabaseShareMode || !state.currentSession?.id) return;
    const unsub = subscribeShareSession('supabase', state.currentSession.id, (share) => {
      setConnectedStudents(shareRecordToConnectedStudents(share));
    });
    return () => unsub();
  }, [supabaseShareMode, state.currentSession?.id]);

  // Load connected students when teacher is sharing (legacy localStorage)
  useEffect(() => {
    if (!state.isSharing || !state.currentSession) {
      setConnectedStudents([]);
      return;
    }
    if (supabaseShareMode) {
      return;
    }

    const loadStudents = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const sessions: ClassroomShareSession[] = JSON.parse(stored);
          const session = sessions.find(s => s.id === state.currentSession?.id);
          if (session) {
            // Mark students as inactive if no recent heartbeat (10 seconds)
            const now = Date.now();
            const students = session.connectedStudents.map(s => ({
              ...s,
              isActive: s.isActive && (now - s.lastSeen) < 10000
            }));
            setConnectedStudents(students);
          }
        }
      } catch (e) {
        console.error('Failed to load students:', e);
      }
    };

    loadStudents();
    const interval = setInterval(loadStudents, 1000);
    return () => clearInterval(interval);
  }, [state.isSharing, state.currentSession?.id]);

  /** Souběžné volání pro stejnou třídu sdílí jeden Promise (žák + getActiveSessionForClass). */
  const prefetchPromisesRef = useRef<Map<string, Promise<ClassroomShareSession | null>>>(new Map());

  const prefetchActiveSessionForClass = useCallback(
    async (classId: string): Promise<ClassroomShareSession | null> => {
      if (!getMojeTridaFlags().classroomShareSupabase || !isUsingSupabase()) {
        return null;
      }
      let existing = prefetchPromisesRef.current.get(classId);
      if (existing) return existing;

      const p = (async (): Promise<ClassroomShareSession | null> => {
        try {
          const share = await findActiveClassroomDocumentShareForClass(classId);
          const mapped = share ? shareRecordToClassroomSession(share) : null;
          setSupabaseSessionsByClass((prev) => ({ ...prev, [classId]: mapped }));
          return mapped;
        } catch (e) {
          console.error('prefetchActiveSessionForClass:', e);
          setSupabaseSessionsByClass((prev) => ({ ...prev, [classId]: null }));
          return null;
        } finally {
          prefetchPromisesRef.current.delete(classId);
        }
      })();

      prefetchPromisesRef.current.set(classId, p);
      return p;
    },
    [],
  );

  // Žák (jiné zařízení): aktivní sdílení z Supabase; lokální session stejné třídy má přednost
  useEffect(() => {
    if (viewMode !== 'student' || !authStudent?.class_id) return;
    if (!getMojeTridaFlags().classroomShareSupabase || !isUsingSupabase()) return;

    let cancelled = false;
    const classId = authStudent.class_id;

    const apply = async () => {
      const remote = await prefetchActiveSessionForClass(classId);
      if (cancelled) return;

      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const sessions: ClassroomShareSession[] = JSON.parse(stored);
          const local = sessions.find((s) => s.classId === classId && s.isActive);
          if (local) {
            setState((prev) => ({ ...prev, isLocked: true, activeSession: local }));
            return;
          }
        }
      } catch {
        /* ignore */
      }

      if (remote) {
        setState((prev) => ({ ...prev, isLocked: true, activeSession: remote }));
      } else {
        setState((prev) => ({ ...prev, isLocked: false, activeSession: null }));
      }
    };

    void apply();
    const interval = setInterval(() => void apply(), 12000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [viewMode, authStudent?.class_id, prefetchActiveSessionForClass]);

  // Get active session for a specific class (localStorage first, pak cache z Supabase)
  const getActiveSessionForClass = useCallback(
    (classId: string): ClassroomShareSession | null => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const sessions: ClassroomShareSession[] = JSON.parse(stored);
          const local = sessions.find((s) => s.classId === classId && s.isActive) || null;
          if (local) return local;
        }
      } catch (e) {
        console.error('Failed to get session:', e);
      }
      const remote = supabaseSessionsByClass[classId];
      if (remote !== undefined) {
        return remote;
      }
      void prefetchActiveSessionForClass(classId);
      return null;
    },
    [supabaseSessionsByClass, prefetchActiveSessionForClass],
  );

  return (
    <ClassroomShareContext.Provider value={{
      state,
      connectedStudents,
      startSharing,
      stopSharing,
      updateScrollPosition,
      updateDocumentPath,
      updateCurrentSection,
      joinSession,
      leaveSession,
      registerStudent,
      updateStudentActivity,
      getActiveSessionForClass,
      prefetchActiveSessionForClass,
    }}>
      {children}
    </ClassroomShareContext.Provider>
  );
}

export function useClassroomShare() {
  const context = useContext(ClassroomShareContext);
  if (context === undefined) {
    throw new Error('useClassroomShare must be used within a ClassroomShareProvider');
  }
  return context;
}

