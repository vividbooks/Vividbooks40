/**
 * Student Authentication Context
 * 
 * Provides global state for student authentication throughout the app.
 * When a student is logged in, all components can access their identity.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../utils/supabase/client';

// Import ViewMode to sync student login with app-wide view mode
// Note: We can't use useViewMode here since StudentAuthProvider is nested inside ViewModeProvider
// Instead, we'll export a function that ViewModeContext can use to get the real student
import { User, Session } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../utils/supabase/info';

// Avatar configuration type
export interface AvatarConfig {
  backgroundColor: string;
  skinTone: string;
  faceShape: string;
  eyeStyle: string;
  mouthStyle: string;
  hairStyle: string;
  hairColor: string;
}

// Student profile from our database
export interface StudentProfile {
  id: string;
  name: string;
  email?: string;
  initials: string;
  color: string;
  class_id: string;
  class_name?: string;
  school_id?: string;
  school_name?: string;
  auth_id?: string;
  is_online?: boolean;
  last_seen?: string;
  avatar?: AvatarConfig;
}

interface StudentAuthContextType {
  // Auth state
  user: User | null;
  session: Session | null;
  student: StudentProfile | null;
  loading: boolean;
  
  // Actions
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  setupPassword: (token: string, password: string) => Promise<{ error?: string; success?: boolean }>;
  refreshStudent: () => Promise<void>;
  updateAvatar: (avatar: AvatarConfig) => Promise<{ error?: string; success?: boolean }>;
}

const StudentAuthContext = createContext<StudentAuthContextType | undefined>(undefined);

// Callback for when student auth state changes
let onStudentAuthChange: ((student: StudentProfile | null) => void) | null = null;

export function setStudentAuthChangeCallback(callback: (student: StudentProfile | null) => void) {
  onStudentAuthChange = callback;
}

export function StudentAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Flag to prevent race conditions during login
  const isLoggingIn = React.useRef(false);

  // Notify ViewModeContext when student changes
  useEffect(() => {
    if (onStudentAuthChange) {
      onStudentAuthChange(student);
    }
  }, [student]);

  // Load student profile from database using auth_id
  const loadStudentProfile = async (authId: string, providedSession?: Session | null) => {
    console.log('[StudentAuth] Loading student profile for auth_id:', authId);
    try {
      let accessToken = providedSession?.access_token || null;
      
      if (!accessToken) {
        try {
          const { data } = await supabase.auth.getSession();
          accessToken = data.session?.access_token || null;
        } catch (e) {
          console.warn('[StudentAuth] getSession failed during profile load:', e);
        }
      }
      
      if (!accessToken) {
        const stored = readStoredSessionTokens();
        accessToken = stored?.access_token || null;
      }
      
      if (!accessToken) {
        console.error('[StudentAuth] ❌ NO ACCESS TOKEN - cannot query database!');
        return null;
      }
      
      console.log('[StudentAuth] Querying students via REST API...');
      const response = await fetch(
        `https://${projectId}.supabase.co/rest/v1/students?auth_id=eq.${authId}&select=*`,
        {
          headers: {
            'apikey': publicAnonKey,
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );
      
      console.log('[StudentAuth] REST API response:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[StudentAuth] REST API error:', errorText);
        return null;
      }
      
      const restData = await response.json();
      const data = restData[0] || null;
      if (!data) {
        console.log('[StudentAuth] No student profile found for this auth_id');
        return null;
      }
      
      console.log('[StudentAuth] ✓ Student data loaded:', data.name);
      
      // Fetch class and school info (REST, avoid client timeouts)
      let className: string | undefined;
      let schoolId: string | undefined;
      let schoolName: string | undefined;
      
      if (data.class_id) {
        try {
          const classRes = await fetch(
            `https://${projectId}.supabase.co/rest/v1/classes?id=eq.${data.class_id}&select=id,name,school_id,schools:school_id(name)`,
            {
              headers: {
                'apikey': publicAnonKey,
                'Authorization': `Bearer ${accessToken}`,
              },
            }
          );
          if (classRes.ok) {
            const classes = await classRes.json();
            const classData = classes?.[0];
            if (classData) {
              className = classData.name;
              schoolId = classData.school_id;
              schoolName = classData.schools?.name;
              console.log('[StudentAuth] ✓ Class info loaded:', className);
            }
          }
        } catch (e: any) {
          console.warn('[StudentAuth] Could not load class info:', e?.message);
        }
      }
      
      console.log('[StudentAuth] ✓ Profile complete:', data.name);
      const profile: StudentProfile = {
        id: data.id,
        name: data.name,
        email: data.email,
        initials: data.initials,
        color: data.color,
        class_id: data.class_id,
        class_name: className,
        school_id: schoolId,
        school_name: schoolName,
        auth_id: data.auth_id,
        is_online: data.is_online,
        last_seen: data.last_seen,
        avatar: data.avatar,
      };
      return profile;
    } catch (error: any) {
      console.error('[StudentAuth] ❌ EXCEPTION in loadStudentProfile:', error);
      return null;
    }
  };

  // Update online status
  const updateOnlineStatus = async (studentId: string, isOnline: boolean) => {
    console.log('[StudentAuth] Updating online status:', studentId, isOnline);
    try {
      const { error } = await supabase
        .from('students')
        .update({ 
          is_online: isOnline, 
          last_seen: new Date().toISOString() 
        })
        .eq('id', studentId);
      
      if (error) {
        console.error('[StudentAuth] Error updating online status:', error);
      } else {
        console.log('[StudentAuth] Online status updated successfully');
      }
    } catch (error) {
      console.error('[StudentAuth] Error updating online status:', error);
    }
  };

  const readStoredSessionTokens = () => {
    try {
      const raw = localStorage.getItem(`sb-${projectId}-auth-token`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.access_token && parsed?.refresh_token) {
        return { access_token: parsed.access_token as string, refresh_token: parsed.refresh_token as string };
      }
    } catch {
      // ignore
    }
    return null;
  };

  const restoreSessionFromStorage = async (): Promise<Session | null> => {
    const stored = readStoredSessionTokens();
    if (!stored) return null;
    try {
      const { data, error } = await supabase.auth.setSession(stored);
      if (error) {
        console.warn('[StudentAuth] Failed to restore session from storage:', error.message);
        return null;
      }
      return data.session || null;
    } catch (e: any) {
      console.warn('[StudentAuth] Exception restoring session:', e?.message || e);
      return null;
    }
  };

  // Initialize auth state
  useEffect(() => {
    console.log('[StudentAuth] Starting auth initialization...');
    
    // Don't fast-track anymore - wait for proper auth loading
    
    // Get initial session with timeout
    const initAuth = async () => {
      try {
      console.log('[StudentAuth] Getting session...');
      
      let session: Session | null = null;
      let sessionError: any = null;
      
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 2500)
      );
      
      const result = await Promise.race([sessionPromise, timeoutPromise]);
      
      if (result === null) {
        console.warn('[StudentAuth] getSession() timed out, attempting storage restore');
        const restored = await restoreSessionFromStorage();
        if (restored) {
          session = restored;
          console.log('[StudentAuth] Session restored from storage');
        } else {
          console.warn('[StudentAuth] No session restored from storage');
          // Don't overwrite existing session on timeout
          return;
        }
      } else {
        session = result.data.session;
        sessionError = result.error;
      }
      
      if (sessionError) {
        console.error('[StudentAuth] Session error:', sessionError);
      }
      
      console.log('[StudentAuth] Session result:', session?.user?.email || 'NO SESSION - student not logged in');
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        console.log('[StudentAuth] Loading profile for user:', session.user.id);
        const profile = await loadStudentProfile(session.user.id, session);
        console.log('[StudentAuth] Profile loaded:', profile?.name || 'null');
          
          // Set online status and save to localStorage for license access
          if (profile) {
            updateOnlineStatus(profile.id, true);
            
            // Save student profile to localStorage for license access hooks
            if (profile.school_id) {
              const userProfile = {
                id: profile.id,
                userId: profile.id,
                name: profile.name,
                email: profile.email,
                role: 'student' as const,
                schoolId: profile.school_id,
                classId: profile.class_id,
                className: profile.class_name,
                createdAt: new Date().toISOString(),
                lastActiveAt: new Date().toISOString(),
              };
              localStorage.setItem('vividbooks_current_user_profile', JSON.stringify(userProfile));
              console.log('[StudentAuth] Saved student profile to localStorage with school_id:', profile.school_id);
            }
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        console.log('[StudentAuth] Setting loading to false');
        setLoading(false);
      }
    };
    
    // Set a timeout to ensure loading is always set to false (5 seconds for slow connections)
    const timeout = setTimeout(() => {
      console.log('[StudentAuth] Timeout reached, forcing loading to false');
      setLoading(false);
    }, 5000);
    
    initAuth().finally(() => clearTimeout(timeout));

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      
      setSession(session);
      setUser(session?.user ?? null);
      
      // Skip profile loading if login is in progress (login() handles it)
      if (isLoggingIn.current) {
        console.log('[StudentAuth] Skipping profile load - login in progress');
        return;
      }
      
      if (session?.user) {
        const profile = await loadStudentProfile(session.user.id, session);
        setStudent(profile);
        
        if (profile) {
          updateOnlineStatus(profile.id, true);
          
          // Save student identity for self-study/quiz modes
          // This allows QuizSelfStudyPage and QuizStudentView to auto-identify the student
          localStorage.setItem('vividbooks_student_identity', JSON.stringify({
            id: profile.id,
            name: profile.name,
            email: profile.email || '',
            schoolName: profile.class_name || '',
            class_id: profile.class_id, // Important for syncing results to class
          }));
          
          // Save profile for license access
          if (profile.school_id) {
            const userProfile = {
              id: profile.id,
              userId: profile.id,
              name: profile.name,
              email: profile.email,
              role: 'student' as const,
              schoolId: profile.school_id,
              classId: profile.class_id,
              className: profile.class_name,
              createdAt: new Date().toISOString(),
              lastActiveAt: new Date().toISOString(),
            };
            localStorage.setItem('vividbooks_current_user_profile', JSON.stringify(userProfile));
          }
        }
      } else {
        // User logged out - update offline status
        if (student) {
          updateOnlineStatus(student.id, false);
        }
        setStudent(null);
      }
    });

    // Cleanup
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Update last_seen periodically while online
  useEffect(() => {
    if (!student) return;
    
    const interval = setInterval(() => {
      updateOnlineStatus(student.id, true);
    }, 60000); // Every minute
    
    // Set offline on window close
    const handleBeforeUnload = () => {
      updateOnlineStatus(student.id, false);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [student]);

  // Login function
  const login = async (email: string, password: string): Promise<{ error?: string }> => {
    console.log('[StudentAuth] Login attempt for:', email);
    isLoggingIn.current = true;
    
    try {
      console.log('[StudentAuth] Signing in...');
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('[StudentAuth] Login auth error:', error);
        isLoggingIn.current = false;
        return { error: error.message };
      }
      
      console.log('[StudentAuth] Auth successful, checking student profile...');
      
      if (data.user) {
        const profile = await loadStudentProfile(data.user.id, data.session);
        console.log('[StudentAuth] Profile result:', profile ? profile.name : 'NOT FOUND');
        
        if (!profile) {
          console.log('[StudentAuth] No student profile, signing out...');
          await supabase.auth.signOut();
          isLoggingIn.current = false;
          return { error: 'Tento účet není propojen se žádným studentem. Zkuste to znovu.' };
        }
        setStudent(profile);
        updateOnlineStatus(profile.id, true);
        
        if (profile.school_id) {
          const userProfile = {
            id: profile.id,
            userId: profile.id,
            name: profile.name,
            email: profile.email,
            role: 'student' as const,
            schoolId: profile.school_id,
            classId: profile.class_id,
            className: profile.class_name,
            createdAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
          };
          localStorage.setItem('vividbooks_current_user_profile', JSON.stringify(userProfile));
          console.log('[StudentAuth] Saved profile to localStorage after login, schoolId:', profile.school_id);
        }
        
        console.log('[StudentAuth] Login successful for student:', profile.name);
      }
      
      isLoggingIn.current = false;
      return {};
    } catch (error: any) {
      console.error('[StudentAuth] Login exception:', error);
      isLoggingIn.current = false;
      return { error: error.message || 'Přihlášení se nezdařilo.' };
    }
  };

  // Logout function
  const logout = async () => {
    console.log('[StudentAuth] Logout started...');
    
    // Update online status with timeout (don't block logout)
    if (student) {
      try {
        const statusPromise = updateOnlineStatus(student.id, false);
        await Promise.race([
          statusPromise,
          new Promise(resolve => setTimeout(resolve, 2000))
        ]);
      } catch (e) {
        console.warn('[StudentAuth] Failed to update online status:', e);
      }
    }
    
    // Sign out with timeout
    try {
      const signOutPromise = supabase.auth.signOut();
      await Promise.race([
        signOutPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ]);
      console.log('[StudentAuth] Sign out successful');
    } catch (e) {
      console.warn('[StudentAuth] Sign out timeout or error:', e);
      // Clear local state anyway
    }
    
    // Always clear student state
    setStudent(null);
    setUser(null);
    setSession(null);
    
    // Clear localStorage
    localStorage.removeItem('vividbooks_student_identity');
    localStorage.removeItem('vividbooks_current_user_profile');
    
    console.log('[StudentAuth] Logout complete');
  };

  // Setup password using token
  const setupPassword = async (token: string, password: string): Promise<{ error?: string; success?: boolean }> => {
    console.log('setupPassword called with token:', token);
    try {
      // Find student by token
      console.log('Finding student by token...');
      const { data: studentData, error: findError } = await supabase
        .from('students')
        .select('*')
        .eq('password_setup_token', token)
        .gt('password_setup_expires', new Date().toISOString())
        .single();
      
      console.log('Find result:', { studentData, findError });
      if (findError || !studentData) {
        console.error('Student not found or token expired:', findError);
        return { error: 'Neplatný nebo expirovaný odkaz. Požádejte učitele o nový.' };
      }
      
      if (!studentData.email) {
        return { error: 'Student nemá nastavený email.' };
      }
      
      // Create auth user - disable email confirmation by setting emailRedirectTo
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: studentData.email,
        password,
        options: {
          data: {
            student_id: studentData.id,
            name: studentData.name,
          },
          // This helps with email confirmation flow
          emailRedirectTo: window.location.origin + '/student/login',
        }
      });
      
      console.log('SignUp result:', { authData, signUpError });
      if (signUpError) {
        console.error('SignUp error:', signUpError);
        // If user already exists, try to update password
        if (signUpError.message.includes('already registered')) {
          return { error: 'Účet s tímto emailem již existuje. Zkuste se přihlásit.' };
        }
        return { error: signUpError.message };
      }
      
      // Check if we got a user (even if email not confirmed yet)
      const userId = authData.user?.id || authData.session?.user?.id;
      
      if (userId) {
        // Link auth user to student
        console.log('Updating student:', studentData.id, 'with auth_id:', userId);
        const { data: updateData, error: updateError } = await supabase
          .from('students')
          .update({
            auth_id: userId,
            password_setup_token: null,
            password_setup_expires: null,
          })
          .eq('id', studentData.id)
          .select();
        
        console.log('Update result:', { updateData, updateError });
        
        if (updateError) {
          console.error('Error linking auth to student:', updateError);
          // If auth_id already exists, the account might already be set up
          if (updateError.code === '23505') {
            return { error: 'Tento email je již registrován. Zkuste se přihlásit.' };
          }
          return { error: 'Chyba při propojování účtu: ' + (updateError.message || updateError.code) };
        }
        
        return { success: true };
      }
      
      return { error: 'Nepodařilo se vytvořit účet.' };
    } catch (error: any) {
      return { error: error.message || 'Chyba při nastavování hesla.' };
    }
  };

  // Refresh student profile
  const refreshStudent = async () => {
    if (user) {
      const profile = await loadStudentProfile(user.id, session);
      setStudent(profile);
    }
  };

  // Update avatar
  const updateAvatar = async (avatar: AvatarConfig): Promise<{ error?: string; success?: boolean }> => {
    if (!student) {
      return { error: 'Nejste přihlášen/a.' };
    }

    try {
      console.log('[StudentAuth] Updating avatar for student:', student.id);
      const { error } = await supabase
        .from('students')
        .update({ avatar })
        .eq('id', student.id);

      if (error) {
        console.error('[StudentAuth] Error updating avatar:', error);
        return { error: error.message };
      }

      // Update local state
      setStudent(prev => prev ? { ...prev, avatar } : null);
      console.log('[StudentAuth] Avatar updated successfully');
      return { success: true };
    } catch (error: any) {
      console.error('[StudentAuth] Error updating avatar:', error);
      return { error: error.message || 'Chyba při ukládání avataru.' };
    }
  };

  const value: StudentAuthContextType = {
    user,
    session,
    student,
    loading,
    login,
    logout,
    setupPassword,
    refreshStudent,
    updateAvatar,
  };

  return (
    <StudentAuthContext.Provider value={value}>
      {children}
    </StudentAuthContext.Provider>
  );
}

// Hook for using student auth
export function useStudentAuth() {
  const context = useContext(StudentAuthContext);
  if (context === undefined) {
    throw new Error('useStudentAuth must be used within a StudentAuthProvider');
  }
  return context;
}

// Check if current user is a student
export function useIsStudent(): boolean {
  const { student } = useStudentAuth();
  return student !== null;
}



