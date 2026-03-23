/**
 * Student session utilities for QuizJoinPage
 * Handles persistent student identity, device ID, and session storage.
 */

const STUDENT_SESSION_KEY = 'vivid-student-session';
const STUDENT_IDENTITY_KEY = 'vivid-student-identity';
const LEGACY_STUDENT_IDENTITY_KEY = 'vividbooks_student_identity';

export interface StudentData {
  name: string;
  schoolName?: string;
  joinedAt: string;
  currentSlide: number;
  responses: import('../types/quiz').SlideResponse[];
  isOnline: boolean;
  isFocused?: boolean;
  lastSeen: string;
  deviceId: string;
  startTime?: string;
  totalTimeMs?: number;
  clientIdentityId?: string;
}

export interface SavedSession {
  sessionId: string;
  sessionCode: string;
  studentId: string;
  studentName: string;
  joinedAt: string;
  backend?: 'firebase' | 'supabase';
}

export interface StudentIdentity {
  id: string;
  name: string;
  createdAt: string;
}

function persistIdentity(identity: StudentIdentity): void {
  localStorage.setItem(STUDENT_IDENTITY_KEY, JSON.stringify(identity));
  localStorage.setItem(LEGACY_STUDENT_IDENTITY_KEY, JSON.stringify(identity));
}

export function getDeviceId(): string {
  let deviceId = localStorage.getItem('vivid-device-id');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('vivid-device-id', deviceId);
  }
  return deviceId;
}

export function getStudentIdentity(name?: string): StudentIdentity {
  const saved = localStorage.getItem(STUDENT_IDENTITY_KEY) || localStorage.getItem(LEGACY_STUDENT_IDENTITY_KEY);
  if (saved) {
    const identity = JSON.parse(saved) as StudentIdentity;
    if (name && name !== identity.name) {
      identity.name = name;
      persistIdentity(identity);
    }
    if (!localStorage.getItem(STUDENT_IDENTITY_KEY)) {
      persistIdentity(identity);
    }
    return identity;
  }

  const newIdentity: StudentIdentity = {
    id: `student_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: name || '',
    createdAt: new Date().toISOString(),
  };
  persistIdentity(newIdentity);
  return newIdentity;
}

export function saveActiveSession(session: SavedSession): void {
  localStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify(session));
}

export function getSavedSession(): SavedSession | null {
  const saved = localStorage.getItem(STUDENT_SESSION_KEY);
  return saved ? JSON.parse(saved) : null;
}

export function clearSavedSession(): void {
  localStorage.removeItem(STUDENT_SESSION_KEY);
}

export function matchesStudentIdentity(
  record: { clientIdentityId?: string; studentId?: string; deviceId?: string; name?: string; studentName?: string } | undefined,
  identity: StudentIdentity,
  deviceId?: string,
  fallbackName?: string
): boolean {
  if (!record) return false;
  const recordIdentity = record.clientIdentityId || record.studentId;
  if (recordIdentity && recordIdentity === identity.id) return true;
  if (deviceId && record.deviceId && record.deviceId === deviceId) return true;
  if (fallbackName) {
    const normalizedFallback = fallbackName.trim().toLowerCase();
    const recordName = (record.name || record.studentName || '').trim().toLowerCase();
    if (normalizedFallback && recordName && recordName === normalizedFallback) return true;
  }
  return false;
}

export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Operation failed (attempt ${attempt + 1}/${maxRetries}):`, error);
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }

  throw lastError;
}
