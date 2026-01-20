import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { ClassroomShareSession, ClassroomShareState, ConnectedStudent } from '../types/classroom-share';
import { useViewMode } from './ViewModeContext';

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
}

const ClassroomShareContext = createContext<ClassroomShareContextType | undefined>(undefined);

export function ClassroomShareProvider({ children }: { children: ReactNode }) {
  const { viewMode } = useViewMode();
  const [state, setState] = useState<ClassroomShareState>({
    isSharing: false,
    currentSession: null,
    isLocked: false,
    activeSession: null,
  });
  
  const [connectedStudents, setConnectedStudents] = useState<ConnectedStudent[]>([]);
  const scrollUpdateTimeout = useRef<NodeJS.Timeout | null>(null);
  const studentHeartbeatRef = useRef<NodeJS.Timeout | null>(null);

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

    // Send heartbeat every 2 seconds
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 2000);
    return () => clearInterval(interval);
  }, [state.isSharing, state.currentSession?.id]);

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
    const session: ClassroomShareSession = {
      id: `session-${Date.now()}`,
      classId,
      className,
      teacherId: 'teacher-1', // Would come from auth
      teacherName: 'Učitel',
      isActive: true,
      startedAt: new Date().toISOString(),
      documentPath,
      documentTitle,
      scrollPosition: 0,
      connectedStudents: [],
    };
    
    setState(prev => ({
      ...prev,
      isSharing: true,
      currentSession: session,
    }));
    
    saveSession(session);
  }, [saveSession]);

  // Teacher: Stop sharing
  const stopSharing = useCallback(() => {
    if (state.currentSession) {
      const updatedSession = {
        ...state.currentSession,
        isActive: false,
      };
      saveSession(updatedSession);
    }
    
    setState(prev => ({
      ...prev,
      isSharing: false,
      currentSession: null,
    }));
  }, [state.currentSession, saveSession]);

  // Teacher: Update scroll position (debounced)
  const updateScrollPosition = useCallback((scrollY: number) => {
    if (scrollUpdateTimeout.current) {
      clearTimeout(scrollUpdateTimeout.current);
    }
    
    scrollUpdateTimeout.current = setTimeout(() => {
      if (state.currentSession) {
        const updatedSession = {
          ...state.currentSession,
          scrollPosition: scrollY,
        };
        
        setState(prev => ({
          ...prev,
          currentSession: updatedSession,
        }));
        
        saveSession(updatedSession);
      }
    }, 50); // Debounce 50ms for smoother sync
  }, [state.currentSession, saveSession]);

  // Teacher: Update document path (when navigating to different content)
  const updateDocumentPath = useCallback((path: string, title: string) => {
    if (state.currentSession && state.currentSession.documentPath !== path) {
      const updatedSession = {
        ...state.currentSession,
        documentPath: path,
        documentTitle: title,
        scrollPosition: 0, // Reset scroll when changing documents
      };
      
      setState(prev => ({
        ...prev,
        currentSession: updatedSession,
      }));
      
      saveSession(updatedSession);
    }
  }, [state.currentSession, saveSession]);

  // Teacher: Update current section
  const updateCurrentSection = useCallback((sectionId: string) => {
    if (state.currentSession) {
      const updatedSession = {
        ...state.currentSession,
        currentSection: sectionId,
      };
      
      setState(prev => ({
        ...prev,
        currentSession: updatedSession,
      }));
      
      saveSession(updatedSession);
    }
  }, [state.currentSession, saveSession]);

  // Student: Join session
  const joinSession = useCallback((sessionId: string) => {
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

  // Load connected students when teacher is sharing
  useEffect(() => {
    if (!state.isSharing || !state.currentSession) {
      setConnectedStudents([]);
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

  // Get active session for a specific class
  const getActiveSessionForClass = useCallback((classId: string): ClassroomShareSession | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const sessions: ClassroomShareSession[] = JSON.parse(stored);
        return sessions.find(s => s.classId === classId && s.isActive) || null;
      }
    } catch (e) {
      console.error('Failed to get session:', e);
    }
    return null;
  }, []);

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

