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

  // Notify ViewModeContext when student changes
  useEffect(() => {
    if (onStudentAuthChange) {
      onStudentAuthChange(student);
    }
  }, [student]);

  // Load student profile from database using auth_id
  const loadStudentProfile = async (authId: string) => {
    console.log('[StudentAuth] Loading student profile for auth_id:', authId);
    try {
      // Create query with timeout (8 seconds for slow connections)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const { data, error } = await supabase
        .from('students')
        .select(`
          *,
          classes:class_id (
            name, 
            school_id,
            schools:school_id (name)
          )
        `)
        .eq('auth_id', authId)
        .maybeSingle()
        .abortSignal(controller.signal);
      
      clearTimeout(timeoutId);
      console.log('[StudentAuth] Query completed, data:', data ? 'found' : 'null', 'error:', error?.message || 'none');
      
      if (error) {
        // No student found for this auth_id - this is expected for new students
        if (error?.code !== 'PGRST116') {
          console.error('Error loading student profile:', error);
        }
        return null;
      }
      
      if (data) {
        console.log('[StudentAuth] Found student profile:', data.name, 'class_id:', data.class_id, 'school_id:', data.classes?.school_id, 'has_avatar:', !!data.avatar);
        const profile: StudentProfile = {
          id: data.id,
          name: data.name,
          email: data.email,
          initials: data.initials,
          color: data.color,
          class_id: data.class_id,
          class_name: data.classes?.name,
          school_id: data.classes?.school_id,
          school_name: data.classes?.schools?.name,
          auth_id: data.auth_id,
          is_online: data.is_online,
          last_seen: data.last_seen,
          avatar: data.avatar,
        };
        return profile;
      }
      console.log('[StudentAuth] No student profile found for this auth_id');
      return null;
    } catch (error) {
      console.error('[StudentAuth] Error loading student profile:', error);
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

  // Initialize auth state
  useEffect(() => {
    console.log('[StudentAuth] Starting auth initialization...');
    
    // Don't fast-track anymore - wait for proper auth loading
    
    // Get initial session with timeout
    const initAuth = async () => {
      try {
      console.log('[StudentAuth] Getting session...');
      
      // Try to get session with retry for Safari
      let session = null;
      let sessionError = null;
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const result = await supabase.auth.getSession();
          session = result.data.session;
          sessionError = result.error;
          
          if (session) {
            console.log('[StudentAuth] Session found on attempt', attempt);
            break;
          } else if (attempt < 3) {
            console.log('[StudentAuth] No session on attempt', attempt, '- retrying...');
            await new Promise(r => setTimeout(r, 500));
          }
        } catch (e) {
          console.error('[StudentAuth] Session attempt', attempt, 'failed:', e);
          if (attempt < 3) {
            await new Promise(r => setTimeout(r, 500));
          }
        }
      }
      
      if (sessionError) {
        console.error('[StudentAuth] Session error:', sessionError);
      }
      
      console.log('[StudentAuth] Session result:', session?.user?.email || 'NO SESSION - student not logged in');
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        console.log('[StudentAuth] Loading profile for user:', session.user.id);
        const profile = await loadStudentProfile(session.user.id);
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
      
      if (session?.user) {
        const profile = await loadStudentProfile(session.user.id);
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
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('Login error:', error);
        return { error: error.message };
      }
      
      if (data.user) {
        const profile = await loadStudentProfile(data.user.id);
        if (!profile) {
          // User exists in auth but not linked to a student
          await supabase.auth.signOut();
          return { error: 'Tento účet není propojen se žádným studentem.' };
        }
        setStudent(profile);
        updateOnlineStatus(profile.id, true);
      }
      
      return {};
    } catch (error: any) {
      return { error: error.message || 'Přihlášení se nezdařilo.' };
    }
  };

  // Logout function
  const logout = async () => {
    if (student) {
      await updateOnlineStatus(student.id, false);
    }
    await supabase.auth.signOut();
    setStudent(null);
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
      const profile = await loadStudentProfile(user.id);
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



