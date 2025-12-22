/**
 * Hook to listen for live session notifications from teachers
 * 
 * Uses Firebase Realtime Database for reliable notifications.
 * When a teacher selects a class and starts sharing, all online students
 * in that class receive a notification and are automatically connected.
 */

import { useEffect, useState, useCallback } from 'react';
import { database } from '../utils/firebase-config';
import { ref, onValue, off } from 'firebase/database';
import { useStudentAuth } from '../contexts/StudentAuthContext';

interface LiveSessionNotification {
  sessionId: string;
  documentPath: string;
  documentTitle: string;
  timestamp: string;
  active: boolean;
}

interface UseLiveSessionNotificationReturn {
  pendingSession: LiveSessionNotification | null;
  joinSession: () => void;
  dismissSession: () => void;
  isConnected: boolean;
}

// Session is considered stale after 5 minutes of inactivity
const SESSION_TIMEOUT_MS = 5 * 60 * 1000;
// Key for storing dismissed sessions in localStorage
const DISMISSED_SESSIONS_KEY = 'vivid-dismissed-sessions';

function getDismissedSessions(): string[] {
  try {
    const stored = localStorage.getItem(DISMISSED_SESSIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addDismissedSession(sessionId: string) {
  const dismissed = getDismissedSessions();
  if (!dismissed.includes(sessionId)) {
    dismissed.push(sessionId);
    // Keep only last 20 dismissed sessions
    const trimmed = dismissed.slice(-20);
    localStorage.setItem(DISMISSED_SESSIONS_KEY, JSON.stringify(trimmed));
  }
}

function isSessionDismissed(sessionId: string): boolean {
  return getDismissedSessions().includes(sessionId);
}

function isSessionStale(timestamp: string): boolean {
  try {
    const sessionTime = new Date(timestamp).getTime();
    const now = Date.now();
    const age = now - sessionTime;
    // Session is stale if older than SESSION_TIMEOUT_MS
    return age > SESSION_TIMEOUT_MS;
  } catch {
    // If timestamp is invalid, consider it stale
    return true;
  }
}

export function useLiveSessionNotification(): UseLiveSessionNotificationReturn {
  const { student } = useStudentAuth();
  const [pendingSession, setPendingSession] = useState<LiveSessionNotification | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Subscribe to class live session channel via Firebase
  useEffect(() => {
    if (!student) {
      console.log('[LiveSession] No student profile yet, waiting...');
      return;
    }
    
    if (!student.class_id) {
      console.log('[LiveSession] Student has no class_id:', student.name);
      return;
    }

    console.log('[LiveSession] Subscribing to Firebase notifications for class:', student.class_id, 'student:', student.name);

    const notificationRef = ref(database, `class-notifications/${student.class_id}`);
    
    const unsubscribe = onValue(notificationRef, (snapshot) => {
      const data = snapshot.val() as LiveSessionNotification | null;
      console.log('[LiveSession] Firebase notification received:', data);
      
      // Check if session is valid
      if (data && data.active && data.sessionId) {
        // Check if session is too old (stale)
        if (isSessionStale(data.timestamp)) {
          console.log('[LiveSession] Session is stale (older than 5 minutes), ignoring:', data.documentTitle);
          setPendingSession(null);
          return;
        }
        
        // Check if user already dismissed this session
        if (isSessionDismissed(data.sessionId)) {
          console.log('[LiveSession] Session was dismissed by user, ignoring:', data.documentTitle);
          setPendingSession(null);
          return;
        }
        
        console.log('[LiveSession] Active session found:', data.documentTitle);
        setPendingSession(data);
        setIsConnected(true);
        
        // Check if we're already on the target page to prevent infinite redirects
        const currentUrl = window.location.href;
        const isAlreadyOnTarget = currentUrl.includes(data.sessionId) || 
                                  currentUrl.includes('/quiz/join/');
        
        if (isAlreadyOnTarget) {
          console.log('[LiveSession] Already on target page, skipping redirect');
          // Don't auto-redirect if already there, but still show notification
        }
        // NOTE: Removed auto-redirect - let user click "Připojit se nyní" manually
      } else {
        console.log('[LiveSession] No active session or session ended');
        setPendingSession(null);
      }
    }, (error) => {
      console.error('[LiveSession] Firebase error:', error);
      setIsConnected(false);
    });

    setIsConnected(true);
    console.log('[LiveSession] Subscribed to Firebase notifications');

    return () => {
      console.log('[LiveSession] Unsubscribing from Firebase notifications');
      off(notificationRef);
      setIsConnected(false);
    };
  }, [student?.class_id, student?.name]);

  const joinSession = useCallback(() => {
    if (pendingSession) {
      localStorage.setItem('vivid-join-session', pendingSession.sessionId);
      window.location.href = pendingSession.documentPath;
    }
  }, [pendingSession]);

  const dismissSession = useCallback(() => {
    if (pendingSession) {
      // Remember that user dismissed this session
      addDismissedSession(pendingSession.sessionId);
      console.log('[LiveSession] User dismissed session:', pendingSession.sessionId);
    }
    setPendingSession(null);
  }, [pendingSession]);

  return {
    pendingSession,
    joinSession,
    dismissSession,
    isConnected,
  };
}
