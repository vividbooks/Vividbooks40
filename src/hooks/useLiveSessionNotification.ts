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
      
      if (data && data.active && data.sessionId) {
        console.log('[LiveSession] Active session found:', data.documentTitle);
        setPendingSession(data);
        setIsConnected(true);
        
        // Check if we're already on the target page to prevent infinite redirects
        const currentUrl = window.location.href;
        const targetUrl = data.documentPath;
        const isAlreadyOnTarget = currentUrl.includes(data.sessionId) || 
                                  currentUrl === targetUrl ||
                                  currentUrl.includes('/quiz/join/');
        
        if (!isAlreadyOnTarget) {
          // Auto-join after a short delay to show notification
          setTimeout(() => {
            if (data.sessionId) {
              // Store session ID for FirebaseStudentView to pick up
              localStorage.setItem('vivid-join-session', data.sessionId);
              // Navigate to the document
              window.location.href = data.documentPath;
            }
          }, 2000);
        } else {
          console.log('[LiveSession] Already on target page, skipping redirect');
        }
      } else {
        console.log('[LiveSession] No active session');
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
    setPendingSession(null);
  }, []);

  return {
    pendingSession,
    joinSession,
    dismissSession,
    isConnected,
  };
}
