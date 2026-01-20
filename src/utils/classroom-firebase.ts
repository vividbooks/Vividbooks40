// Classroom Sharing Service - Firebase with localStorage fallback
import { database, ref, set, onValue, remove, update, isFirebaseAvailable } from './firebase-config';

export interface ConnectedStudent {
  id: string;
  name: string;
  isActive: boolean;
  lastSeen: number;
  joinedAt: number;
}

export interface AnimationState {
  animationId: string;      // Unique ID for the animation (e.g., URL or element ID)
  currentStep: number;      // Current step index
  isPlaying: boolean;       // Play/pause state
  timestamp: number;        // When this state was set
}

export interface TextSelection {
  text: string;
  startOffset: number;
  endOffset: number;
  containerPath: string;  // CSS selector or XPath to find the element
  timestamp: number;
}

export interface ShareSession {
  id: string;
  classId: string;
  className: string;
  teacherId: string;
  teacherName: string;
  isActive: boolean;
  startedAt: number;
  lastHeartbeat: number;
  documentPath: string;
  documentTitle: string;
  scrollPosition: number;
  animationState?: AnimationState;  // Current animation state
  textSelection?: TextSelection;    // Currently selected text
  studentCanControl: boolean;       // Can student scroll/interact?
  students: Record<string, ConnectedStudent>;
}

// Session paths
const SESSIONS_PATH = 'classroom-sessions';
const getSessionPath = (sessionId: string) => `${SESSIONS_PATH}/${sessionId}`;
const getStudentPath = (sessionId: string, studentId: string) => `${SESSIONS_PATH}/${sessionId}/students/${studentId}`;

// =====================================
// THROTTLE UTILITY FOR SCALABILITY
// =====================================
// Prevents excessive Firebase writes during rapid scroll/updates

let lastScrollUpdate = 0;
let pendingScrollUpdate: { sessionId: string; scrollPosition: number } | null = null;
let scrollUpdateTimer: ReturnType<typeof setTimeout> | null = null;
const SCROLL_THROTTLE_MS = 150; // Max 6-7 updates per second

// =====================================
// FALLBACK: localStorage + BroadcastChannel
// =====================================
const LOCAL_STORAGE_KEY = 'vivid-share-session';
const BROADCAST_CHANNEL = 'vivid-share-channel';

let broadcastChannel: BroadcastChannel | null = null;
try {
  broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL);
} catch (e) {
  console.warn('BroadcastChannel not supported');
}

function getLocalSession(): ShareSession | null {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function setLocalSession(session: ShareSession | null): void {
  if (session) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
  // Broadcast change
  broadcastChannel?.postMessage({ type: 'session-update', session });
}

// Check if we should use Firebase or fallback
function useFirebase(): boolean {
  // Use Firebase if available
  return isFirebaseAvailable();
}

// =====================================
// TEACHER FUNCTIONS
// =====================================

export async function createSession(
  classId: string,
  className: string,
  teacherId: string,
  teacherName: string,
  documentPath: string,
  documentTitle: string
): Promise<string> {
  const sessionId = `session-${classId}-${Date.now()}`;
  
  const session: ShareSession = {
    id: sessionId,
    classId,
    className,
    teacherId,
    teacherName,
    isActive: true,
    startedAt: Date.now(),
    lastHeartbeat: Date.now(),
    documentPath,
    documentTitle,
    scrollPosition: 0,
    studentCanControl: true,  // By default, student CAN control (unlocked)
    students: {}
  };

  if (useFirebase() && database) {
    const sessionRef = ref(database, getSessionPath(sessionId));
    await set(sessionRef, session);
    console.log('Session created (Firebase):', sessionId);
  } else {
    // Fallback to localStorage
    setLocalSession(session);
    console.log('Session created (localStorage):', sessionId);
  }
  
  return sessionId;
}

export async function endSession(sessionId: string): Promise<void> {
  if (useFirebase() && database) {
    const sessionRef = ref(database, getSessionPath(sessionId));
    await update(sessionRef, { 
      isActive: false,
      endedAt: Date.now()
    });
  } else {
    const session = getLocalSession();
    if (session && session.id === sessionId) {
      session.isActive = false;
      setLocalSession(session);
    }
  }
  console.log('Session ended:', sessionId);
}

export async function updateSessionScroll(sessionId: string, scrollPosition: number): Promise<void> {
  const now = Date.now();
  
  // Throttle scroll updates for better scalability
  // Store pending update
  pendingScrollUpdate = { sessionId, scrollPosition };
  
  // If we updated recently, schedule delayed update
  if (now - lastScrollUpdate < SCROLL_THROTTLE_MS) {
    if (!scrollUpdateTimer) {
      scrollUpdateTimer = setTimeout(async () => {
        scrollUpdateTimer = null;
        if (pendingScrollUpdate) {
          await executeScrollUpdate(pendingScrollUpdate.sessionId, pendingScrollUpdate.scrollPosition);
          pendingScrollUpdate = null;
        }
      }, SCROLL_THROTTLE_MS);
    }
    return;
  }
  
  // Execute immediately
  lastScrollUpdate = now;
  await executeScrollUpdate(sessionId, scrollPosition);
}

// Internal function to actually perform the scroll update
async function executeScrollUpdate(sessionId: string, scrollPosition: number): Promise<void> {
  lastScrollUpdate = Date.now();
  
  if (useFirebase() && database) {
    const sessionRef = ref(database, getSessionPath(sessionId));
    await update(sessionRef, { 
      scrollPosition,
      lastHeartbeat: Date.now()
    });
  } else {
    const session = getLocalSession();
    if (session && session.id === sessionId) {
      session.scrollPosition = scrollPosition;
      session.lastHeartbeat = Date.now();
      setLocalSession(session);
    }
  }
}

export async function updateSessionPath(sessionId: string, documentPath: string, documentTitle: string): Promise<void> {
  if (useFirebase() && database) {
    const sessionRef = ref(database, getSessionPath(sessionId));
    await update(sessionRef, { 
      documentPath,
      documentTitle,
      scrollPosition: 0,
      animationState: null, // Clear animation state when navigating
      lastHeartbeat: Date.now()
    });
  } else {
    const session = getLocalSession();
    if (session && session.id === sessionId) {
      session.documentPath = documentPath;
      session.documentTitle = documentTitle;
      session.scrollPosition = 0;
      session.animationState = undefined;
      session.lastHeartbeat = Date.now();
      setLocalSession(session);
    }
  }
}

// Update animation state (teacher controls animation)
export async function updateAnimationState(
  sessionId: string, 
  animationId: string, 
  currentStep: number, 
  isPlaying: boolean
): Promise<void> {
  const animationState: AnimationState = {
    animationId,
    currentStep,
    isPlaying,
    timestamp: Date.now()
  };
  
  if (useFirebase() && database) {
    const sessionRef = ref(database, getSessionPath(sessionId));
    await update(sessionRef, { 
      animationState,
      lastHeartbeat: Date.now()
    });
  } else {
    const session = getLocalSession();
    if (session && session.id === sessionId) {
      session.animationState = animationState;
      session.lastHeartbeat = Date.now();
      setLocalSession(session);
    }
  }
  console.log('[Firebase] Animation state updated:', animationId, 'step:', currentStep, 'playing:', isPlaying);
}

// Update student control permission
export async function updateStudentCanControl(sessionId: string, canControl: boolean): Promise<void> {
  console.log('[Firebase] Updating studentCanControl:', canControl, 'for session:', sessionId);
  if (useFirebase() && database) {
    const sessionRef = ref(database, getSessionPath(sessionId));
    await update(sessionRef, { 
      studentCanControl: canControl,
      lastHeartbeat: Date.now()
    });
    console.log('[Firebase] studentCanControl updated successfully');
  } else {
    const session = getLocalSession();
    if (session && session.id === sessionId) {
      session.studentCanControl = canControl;
      session.lastHeartbeat = Date.now();
      setLocalSession(session);
    }
  }
  console.log('[Firebase] Student control updated:', canControl);
}

// Update text selection (teacher highlights text)
export async function updateTextSelection(
  sessionId: string, 
  selection: TextSelection | null
): Promise<void> {
  if (useFirebase() && database) {
    const sessionRef = ref(database, getSessionPath(sessionId));
    await update(sessionRef, { 
      textSelection: selection,
      lastHeartbeat: Date.now()
    });
  } else {
    const session = getLocalSession();
    if (session && session.id === sessionId) {
      session.textSelection = selection || undefined;
      session.lastHeartbeat = Date.now();
      setLocalSession(session);
    }
  }
}

export async function sendTeacherHeartbeat(sessionId: string): Promise<void> {
  if (useFirebase() && database) {
    const sessionRef = ref(database, getSessionPath(sessionId));
    await update(sessionRef, { 
      lastHeartbeat: Date.now()
    });
  } else {
    const session = getLocalSession();
    if (session && session.id === sessionId) {
      session.lastHeartbeat = Date.now();
      setLocalSession(session);
    }
  }
}

// Listen to session changes (for teacher to see connected students)
export function subscribeToSession(
  sessionId: string, 
  callback: (session: ShareSession | null) => void
): () => void {
  if (useFirebase() && database) {
    const sessionRef = ref(database, getSessionPath(sessionId));
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const data = snapshot.val();
      callback(data as ShareSession | null);
    });
    return unsubscribe;
  } else {
    // Fallback: poll localStorage + listen to BroadcastChannel
    const interval = setInterval(() => {
      const session = getLocalSession();
      if (session && session.id === sessionId) {
        callback(session);
      }
    }, 500);

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'session-update' && event.data.session?.id === sessionId) {
        callback(event.data.session);
      }
    };
    broadcastChannel?.addEventListener('message', handler);

    // Initial call
    const session = getLocalSession();
    if (session && session.id === sessionId) {
      callback(session);
    }

    return () => {
      clearInterval(interval);
      broadcastChannel?.removeEventListener('message', handler);
    };
  }
}

// =====================================
// STUDENT FUNCTIONS
// =====================================

// Find active session for any class
export function subscribeToActiveSessions(
  callback: (session: ShareSession | null) => void
): () => void {
  console.log('[Firebase] subscribeToActiveSessions called, useFirebase:', useFirebase());
  
  if (useFirebase() && database) {
    const sessionsRef = ref(database, SESSIONS_PATH);
    console.log('[Firebase] Subscribing to:', SESSIONS_PATH);
    
    const unsubscribe = onValue(sessionsRef, (snapshot) => {
      const data = snapshot.val();
      console.log('[Firebase] Got update, data exists:', !!data);
      
      if (!data) {
        callback(null);
        return;
      }

      // Find any active session
      const sessions = Object.values(data) as ShareSession[];
      const activeSession = sessions.find(s => {
        // Session is active if isActive and has recent heartbeat (within 15 seconds)
        const isRecent = s.lastHeartbeat && (Date.now() - s.lastHeartbeat < 15000);
        return s.isActive && isRecent;
      });

      if (activeSession) {
        console.log('[Firebase] Active session found:', activeSession.id, 'scroll:', activeSession.scrollPosition, 'studentCanControl:', activeSession.studentCanControl);
      }
      
      callback(activeSession || null);
    });

    return unsubscribe;
  } else {
    // Fallback: poll localStorage + listen to BroadcastChannel
    const checkSession = () => {
      const session = getLocalSession();
      if (session && session.isActive && session.lastHeartbeat && (Date.now() - session.lastHeartbeat < 10000)) {
        callback(session);
      } else {
        callback(null);
      }
    };

    const interval = setInterval(checkSession, 300);

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'session-update') {
        const session = event.data.session as ShareSession | null;
        if (session && session.isActive && session.lastHeartbeat && (Date.now() - session.lastHeartbeat < 10000)) {
          callback(session);
        } else {
          callback(null);
        }
      }
    };
    broadcastChannel?.addEventListener('message', handler);

    // Initial check
    checkSession();

    return () => {
      clearInterval(interval);
      broadcastChannel?.removeEventListener('message', handler);
    };
  }
}

export async function joinSession(
  sessionId: string, 
  studentId: string, 
  studentName: string
): Promise<void> {
  const student: ConnectedStudent = {
    id: studentId,
    name: studentName,
    isActive: true,
    lastSeen: Date.now(),
    joinedAt: Date.now()
  };

  if (useFirebase() && database) {
    const studentRef = ref(database, getStudentPath(sessionId, studentId));
    await set(studentRef, student);
  } else {
    const session = getLocalSession();
    if (session && session.id === sessionId) {
      if (!session.students) session.students = {};
      session.students[studentId] = student;
      setLocalSession(session);
    }
  }
  console.log('Student joined:', studentId);
}

export async function updateStudentStatus(
  sessionId: string, 
  studentId: string, 
  isActive: boolean
): Promise<void> {
  if (useFirebase() && database) {
    const studentRef = ref(database, getStudentPath(sessionId, studentId));
    await update(studentRef, { 
      isActive,
      lastSeen: Date.now()
    });
  } else {
    const session = getLocalSession();
    if (session && session.id === sessionId && session.students?.[studentId]) {
      session.students[studentId].isActive = isActive;
      session.students[studentId].lastSeen = Date.now();
      setLocalSession(session);
    }
  }
}

export async function leaveSession(sessionId: string, studentId: string): Promise<void> {
  if (useFirebase() && database) {
    const studentRef = ref(database, getStudentPath(sessionId, studentId));
    await remove(studentRef);
  } else {
    const session = getLocalSession();
    if (session && session.id === sessionId && session.students) {
      delete session.students[studentId];
      setLocalSession(session);
    }
  }
  console.log('Student left:', studentId);
}

