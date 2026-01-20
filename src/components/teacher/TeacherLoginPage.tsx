import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Eye, EyeOff, Loader2, LogOut, Key, User, BookOpen } from 'lucide-react';
import { supabase } from '../../utils/supabase/client';
import { useViewMode } from '../../contexts/ViewModeContext';
import VividLogo from '../../imports/Group70';
import * as storage from '../../utils/profile-storage';
import { getLegacySchoolWithLicenses, MappedSchoolData } from '../../utils/legacy-api';

const SAVED_SCHOOL_KEY = 'vivid-teacher-school';
const SAVED_TEACHERS_KEY = 'vivid-teacher-school-teachers';

interface Teacher {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  authProvider?: 'password' | 'google';
}

interface School {
  id: string;
  name: string;
  code: string;
}

type Step = 'school-code' | 'select-teacher' | 'enter-password' | 'create-profile';

export function TeacherLoginPage() {
  const navigate = useNavigate();
  const { setViewMode } = useViewMode();
  
  // State
  const [step, setStep] = useState<Step>('school-code');
  const [schoolCode, setSchoolCode] = useState('');
  const [school, setSchool] = useState<School | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  
  // New profile state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  // Login mode - with school code or direct login
  const [loginMode, setLoginMode] = useState<'school-code' | 'direct-login'>('school-code');
  const [directEmail, setDirectEmail] = useState('');
  const [directPassword, setDirectPassword] = useState('');

  // Load saved school on mount
  useEffect(() => {
    console.log('[TeacherLogin] === MOUNT === VERSION 7.0 (session check) ===');
    
    const loadSavedSchool = async () => {
      console.log('[TeacherLogin] loadSavedSchool started');
      
      // Check if already logged in (with quick timeout)
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
        const result = await Promise.race([sessionPromise, timeoutPromise]);
        
        if (result && 'data' in result && result.data.session?.user) {
          console.log('[TeacherLogin] Already logged in as:', result.data.session.user.email);
          
          // Check if we have a saved profile
          const savedProfile = storage.getCurrentUserProfile();
          if (savedProfile) {
            console.log('[TeacherLogin] Found saved profile, redirecting...');
            setViewMode('teacher');
            navigate('/library/my-content');
            return;
          }
        } else {
          console.log('[TeacherLogin] No session or timeout, continuing...');
        }
      } catch (e) {
        console.log('[TeacherLogin] Session check failed, continuing normally');
      }
      
      try {
        const savedSchoolStr = localStorage.getItem(SAVED_SCHOOL_KEY);
        const savedTeachersStr = localStorage.getItem(SAVED_TEACHERS_KEY);
        
        console.log('[TeacherLogin] Cache check:', { 
          hasSchool: !!savedSchoolStr, 
          hasTeachers: !!savedTeachersStr 
        });
        
        if (savedSchoolStr) {
          const savedSchool = JSON.parse(savedSchoolStr);
          console.log('[TeacherLogin] Using cached school:', savedSchool.name);
          setSchool(savedSchool);
          setSchoolCode(savedSchool.code);
          
          // Load teachers from cache first (show immediately)
          if (savedTeachersStr) {
            const cachedTeachers = JSON.parse(savedTeachersStr);
            console.log('[TeacherLogin] Using cached teachers:', cachedTeachers.length);
            setTeachers(cachedTeachers);
            setStep('select-teacher');
            setInitialLoading(false);
            
            // Refresh teachers in background - don't await
            supabase
              .from('teachers')
              .select('*')
              .eq('school_id', savedSchool.id)
              .order('name')
              .then(({ data }) => {
                if (data) {
                  console.log('[TeacherLogin] Background refresh got:', data.length, 'teachers');
                  // Map Supabase fields to local interface
                  const mappedTeachers: Teacher[] = data.map((t: any) => ({
                    id: t.id,
                    name: t.name,
                    email: t.email,
                    avatar_url: t.avatar_url,
                    authProvider: t.auth_provider as 'password' | 'google' | undefined,
                  }));
                  setTeachers(mappedTeachers);
                  localStorage.setItem(SAVED_TEACHERS_KEY, JSON.stringify(mappedTeachers));
                }
              })
              .catch(err => console.warn('[TeacherLogin] Background refresh failed:', err));
            
            // Also refresh licenses from legacy API in background
            if (savedSchool.code) {
              console.log('[TeacherLogin] Refreshing licenses from legacy API...');
              getLegacySchoolWithLicenses(savedSchool.code).then(legacyData => {
                if (legacyData) {
                  console.log('[TeacherLogin] Got fresh licenses:', legacyData.licenses.subjects.length);
                  // Save to localStorage for hooks
                  storage.saveLicense({
                    id: `license-${savedSchool.id}`,
                    schoolId: savedSchool.id,
                    subjects: legacyData.licenses.subjects,
                    features: legacyData.licenses.features,
                    updatedAt: new Date().toISOString(),
                  });
                }
              }).catch(err => console.warn('[TeacherLogin] License refresh failed:', err));
            }
            
            return; // Exit early - page is already showing
          }
          
          setStep('select-teacher');
        }
      } catch (err) {
        console.error('[TeacherLogin] Error loading saved school:', err);
      } finally {
        console.log('[TeacherLogin] loadSavedSchool finished, setting initialLoading=false');
        setInitialLoading(false);
      }
    };
    
    loadSavedSchool();
  }, []);

  // Save school to localStorage after successful selection
  const saveSchoolToStorage = (schoolData: School, teachersData: Teacher[]) => {
    localStorage.setItem(SAVED_SCHOOL_KEY, JSON.stringify(schoolData));
    localStorage.setItem(SAVED_TEACHERS_KEY, JSON.stringify(teachersData));
  };

  // Clear saved school (change school)
  const handleChangeSchool = () => {
    localStorage.removeItem(SAVED_SCHOOL_KEY);
    localStorage.removeItem(SAVED_TEACHERS_KEY);
    setSchool(null);
    setTeachers([]);
    setSchoolCode('');
    setStep('school-code');
  };

  // Helper function to fetch with timeout
  const fetchWithTimeout = async <T,>(
    fetchFn: () => Promise<T>,
    timeoutMs: number = 10000
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        console.error('[TeacherLogin] Request timed out after', timeoutMs, 'ms');
        reject(new Error('TIMEOUT'));
      }, timeoutMs);
      
      fetchFn()
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timeoutId);
          reject(err);
        });
    });
  };

  // Sync legacy data to Supabase
  const syncLegacyDataToSupabase = async (legacyData: MappedSchoolData): Promise<School | null> => {
    const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';
    const baseUrl = 'https://njbtqmsxbyvpwigfceke.supabase.co/rest/v1';
    
    try {
      // Check if school already exists
      const checkResponse = await fetch(
        `${baseUrl}/schools?code=eq.${legacyData.school.code.toUpperCase()}&select=*`,
        {
          headers: {
            'apikey': apiKey,
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.pgrst.object+json'
          }
        }
      );
      
      let schoolData: School | null = null;
      
      if (checkResponse.ok) {
        schoolData = await checkResponse.json();
        console.log('[TeacherLogin] School already exists in Supabase:', schoolData?.name);
      }
      
      // If school doesn't exist, create it
      if (!schoolData) {
        console.log('[TeacherLogin] Creating school in Supabase...');
        const createResponse = await fetch(
          `${baseUrl}/schools`,
          {
            method: 'POST',
            headers: {
              'apikey': apiKey,
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify({
              code: legacyData.school.code.toUpperCase(),
              name: legacyData.school.name,
              address: legacyData.school.address || '',
              city: legacyData.school.city || '',
            })
          }
        );
        
        if (createResponse.ok) {
          const created = await createResponse.json();
          schoolData = Array.isArray(created) ? created[0] : created;
          console.log('[TeacherLogin] School created:', schoolData?.name);
        } else {
          console.error('[TeacherLogin] Failed to create school:', await createResponse.text());
        }
      }
      
      // Sync license if school exists
      if (schoolData?.id) {
        console.log('[TeacherLogin] Syncing license for school:', schoolData.id);
        
        // Upsert license - first check if exists
        const checkLicenseResponse = await fetch(
          `${baseUrl}/school_licenses?school_id=eq.${schoolData.id}&select=id`,
          {
            headers: {
              'apikey': apiKey,
              'Authorization': `Bearer ${apiKey}`,
            }
          }
        );
        
        let licenseId = `license-${schoolData.id}`;
        if (checkLicenseResponse.ok) {
          const existing = await checkLicenseResponse.json();
          if (existing && existing.length > 0) {
            licenseId = existing[0].id;
          }
        }
        
        const licenseResponse = await fetch(
          `${baseUrl}/school_licenses`,
          {
            method: 'POST',
            headers: {
              'apikey': apiKey,
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates,return=representation'
            },
            body: JSON.stringify({
              id: licenseId,
              school_id: schoolData.id,
              subjects: legacyData.licenses.subjects,
              features: legacyData.licenses.features,
              updated_at: new Date().toISOString(),
            })
          }
        );
        
        // Always save license to localStorage (even if Supabase fails)
        const localLicense = {
          id: licenseId,
          schoolId: schoolData.id,
          subjects: legacyData.licenses.subjects,
          features: legacyData.licenses.features,
          updatedAt: new Date().toISOString(),
        };
        storage.saveLicense(localLicense);
        console.log('[TeacherLogin] License saved to localStorage:', legacyData.licenses.subjects.length, 'subjects');
        
        if (licenseResponse.ok) {
          console.log('[TeacherLogin] License synced to Supabase successfully');
        } else {
          console.warn('[TeacherLogin] Failed to sync license to Supabase:', await licenseResponse.text());
        }
      }
      
      return schoolData;
    } catch (err) {
      console.error('[TeacherLogin] Error syncing legacy data:', err);
      return null;
    }
  };

  // Handle school code submission
  const handleSchoolCodeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    console.log('[TeacherLogin] handleSchoolCodeSubmit called, schoolCode:', schoolCode);
    
    if (!schoolCode.trim()) {
      console.log('[TeacherLogin] Empty school code, returning');
      return;
    }
    
    console.log('[TeacherLogin] Setting isLoading=true');
    setIsLoading(true);
    setError('');
    
    try {
      const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';
      const baseUrl = 'https://njbtqmsxbyvpwigfceke.supabase.co/rest/v1';
      
      // =============================================
      // STEP 1: Try Legacy API first
      // =============================================
      console.log('[TeacherLogin] Trying Legacy API for school code:', schoolCode);
      const legacyData = await getLegacySchoolWithLicenses(schoolCode.trim());
      
      let schoolData: School | null = null;
      
      if (legacyData) {
        console.log('[TeacherLogin] Legacy API returned data:', legacyData.school.name);
        
        // Sync to Supabase
        schoolData = await syncLegacyDataToSupabase(legacyData);
        
        if (!schoolData) {
          // Fallback: use legacy data directly without Supabase sync
          console.log('[TeacherLogin] Using legacy data without Supabase sync');
          schoolData = {
            id: legacyData.school.vat || `legacy-${Date.now()}`, // Use VAT as ID fallback
            code: legacyData.school.code,
            name: legacyData.school.name,
          };
        }
      } else {
        // =============================================
        // STEP 2: Fallback to Supabase direct lookup
        // =============================================
        console.log('[TeacherLogin] Legacy API failed, trying Supabase...');
        
        const schoolResponse = await fetch(
          `${baseUrl}/schools?code=eq.${schoolCode.toUpperCase()}&select=*`,
          {
            headers: {
              'apikey': apiKey,
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'Accept': 'application/vnd.pgrst.object+json'
            }
          }
        );
        
        if (schoolResponse.ok) {
          schoolData = await schoolResponse.json();
        }
      }
      
      if (!schoolData) {
        console.log('[TeacherLogin] School not found in either system');
        setError('Škola s tímto kódem nebyla nalezena');
        setIsLoading(false);
        return;
      }
      
      console.log('[TeacherLogin] School found:', schoolData.name);
      setSchool(schoolData);
      
      // =============================================
      // STEP 3: Load teachers from Supabase
      // =============================================
      console.log('[TeacherLogin] Fetching teachers from Supabase...');
      
      const teachersResponse = await fetch(
        `${baseUrl}/teachers?school_id=eq.${schoolData.id}&select=*&order=name.asc`,
        {
          headers: {
            'apikey': apiKey,
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      let teachersData: Teacher[] = [];
      
      if (teachersResponse.ok) {
        const rawTeachers = await teachersResponse.json();
        // Map Supabase fields to local interface
        teachersData = rawTeachers.map((t: any) => ({
          id: t.id,
          name: t.name,
          email: t.email,
          avatar_url: t.avatar_url,
          authProvider: t.auth_provider as 'password' | 'google' | undefined,
        }));
      }
      
      // TODO: Also fetch teachers from legacy API and merge
      // const legacyTeachers = await fetchLegacyTeachers(schoolCode);
      
      console.log('[TeacherLogin] Teachers loaded:', teachersData.length);
      setTeachers(teachersData);
      
      // Save school to localStorage for next time
      saveSchoolToStorage(schoolData, teachersData);
      
      console.log('[TeacherLogin] Setting step to select-teacher');
      setStep('select-teacher');
    } catch (err: any) {
      console.error('[TeacherLogin] Caught error:', err);
      if (err.message === 'TIMEOUT') {
        setError('Připojení k serveru trvá příliš dlouho. Zkuste obnovit stránku (Ctrl+Shift+R).');
      } else {
        setError('Nastala chyba při načítání: ' + (err.message || 'Neznámá chyba'));
      }
    } finally {
      console.log('[TeacherLogin] Setting isLoading=false');
      setIsLoading(false);
    }
  };

  // Handle direct login (without school code)
  const handleDirectLogin = async (e: FormEvent) => {
    e.preventDefault();
    console.log('[TeacherLogin] Direct login attempt:', directEmail);
    setIsLoading(true);
    setError('');
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: directEmail,
        password: directPassword,
      });
      
      if (error) {
        console.error('[TeacherLogin] Direct login error:', error);
        setError('Neplatný email nebo heslo');
        setIsLoading(false);
        return;
      }
      
      if (data.user) {
        console.log('[TeacherLogin] Direct login success:', data.user.email);
        
        // Save profile to localStorage
        const userProfile = {
          id: data.user.id,
          userId: data.user.id,
          email: data.user.email!,
          name: data.user.user_metadata?.name || directEmail.split('@')[0],
          role: 'teacher' as const,
          schoolId: '',
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
        };
        storage.saveCurrentUserProfile(userProfile);
        
        setViewMode('teacher');
        navigate('/library/fyzika');
      }
    } catch (err: any) {
      console.error('[TeacherLogin] Direct login exception:', err);
      setError('Nastala chyba při přihlášení');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Google Sign In (without school context)
  const handleGoogleSignInDirect = async () => {
    console.log('[TeacherLogin] Google Sign In (direct) clicked');
    setIsLoading(true);
    setError('');
    
    try {
      // Don't save school context - user will pair later
      localStorage.removeItem('google-oauth-pending-school');
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      if (error) {
        console.error('[TeacherLogin] Google Sign In error:', error);
        setError('Nepodařilo se přihlásit přes Google: ' + error.message);
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('[TeacherLogin] Google Sign In exception:', err);
      setError('Nastala chyba při přihlášení');
      setIsLoading(false);
    }
  };

  // Handle Google Sign In
  const handleGoogleSignIn = async () => {
    console.log('[TeacherLogin] Google Sign In clicked');
    setIsLoading(true);
    setError('');
    
    try {
      // Save school context for AuthCallback to use
      if (school) {
        localStorage.setItem('google-oauth-pending-school', JSON.stringify(school));
        console.log('[TeacherLogin] Saved pending school for OAuth:', school.name);
      }
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      if (error) {
        console.error('[TeacherLogin] Google Sign In error:', error);
        setError('Nepodařilo se přihlásit přes Google: ' + error.message);
        setIsLoading(false);
        localStorage.removeItem('google-oauth-pending-school');
      }
      // If successful, user will be redirected to Google
    } catch (err: any) {
      console.error('[TeacherLogin] Google Sign In exception:', err);
      setError('Nastala chyba při přihlášení');
      setIsLoading(false);
      localStorage.removeItem('google-oauth-pending-school');
    }
  };

  // Handle teacher selection
  const handleSelectTeacher = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setPassword('');
    setError('');
    
    // If teacher was registered via Google, redirect to Google OAuth
    if (teacher.authProvider === 'google') {
      console.log('[TeacherLogin] Google user selected, redirecting to OAuth...');
      handleGoogleSignIn();
      return;
    }
    
    setStep('enter-password');
  };

  // Handle password submission
  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    console.log('[TeacherLogin] handlePasswordSubmit called');
    console.log('[TeacherLogin] selectedTeacher:', selectedTeacher?.email);
    console.log('[TeacherLogin] password length:', password?.length);
    
    if (!selectedTeacher || !password) {
      console.log('[TeacherLogin] Missing teacher or password, returning');
      return;
    }
    
    console.log('[TeacherLogin] Setting isLoading=true for password');
    setIsLoading(true);
    setError('');
    
    // Helper to complete login after auth succeeds
    const completeLogin = () => {
      console.log('[TeacherLogin] Completing login...');
      
      // Save user profile to localStorage for ProfilePageLayout
      if (school && selectedTeacher) {
        const userProfile = {
          id: selectedTeacher.id,
          userId: selectedTeacher.id,
          email: selectedTeacher.email,
          name: selectedTeacher.name,
          role: 'teacher' as const,
          schoolId: school.id,
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
        };
        console.log('[TeacherLogin] Saving user profile to localStorage');
        storage.saveCurrentUserProfile(userProfile);
        
        // Update teacher's last_active in Supabase for analytics (don't await - do in background)
        supabase
          .from('teachers')
          .update({ 
            last_active: new Date().toISOString(),
            activity_level: 'active'
          })
          .eq('id', selectedTeacher.id)
          .then(() => console.log('[TeacherLogin] Updated last_active'))
          .catch(err => console.warn('[TeacherLogin] Failed to update last_active:', err));
      }
      
      // Success - set teacher view mode and redirect to library
      console.log('[TeacherLogin] Setting viewMode and navigating...');
      setViewMode('teacher');
      setIsLoading(false);
      navigate('/library/my-content');
    };
    
    // Set up auth state listener BEFORE calling signIn
    // This catches the SIGNED_IN event even if the Promise never resolves
    let authHandled = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[TeacherLogin] Auth state change:', event, session?.user?.email);
      if (event === 'SIGNED_IN' && session && !authHandled) {
        authHandled = true;
        console.log('[TeacherLogin] SIGNED_IN detected via listener!');
        subscription.unsubscribe();
        completeLogin();
      }
    });
    
    // Also set a timeout to clean up if nothing happens
    const timeoutId = setTimeout(() => {
      if (!authHandled) {
        console.log('[TeacherLogin] Auth timeout - cleaning up listener');
        subscription.unsubscribe();
        setError('Přihlášení trvá příliš dlouho. Zkuste to znovu.');
        setIsLoading(false);
      }
    }, 20000);
    
    try {
      console.log('[TeacherLogin] Calling signInWithPassword...');
      
      // Fire and forget - we rely on the auth state listener above
      supabase.auth.signInWithPassword({
        email: selectedTeacher.email,
        password: password,
      }).then(({ error: signInError }) => {
        clearTimeout(timeoutId);
        
        if (signInError) {
          console.log('[TeacherLogin] Sign in error:', signInError.message);
          subscription.unsubscribe();
          setError('Nesprávné heslo');
          setIsLoading(false);
          return;
        }
        
        // If we get here and auth wasn't handled by listener, complete login
        if (!authHandled) {
          console.log('[TeacherLogin] signInWithPassword resolved, completing...');
          authHandled = true;
          subscription.unsubscribe();
          completeLogin();
        }
      }).catch((err) => {
        clearTimeout(timeoutId);
        console.error('[TeacherLogin] signInWithPassword error:', err);
        subscription.unsubscribe();
        setError('Nastala chyba při přihlašování');
        setIsLoading(false);
      });
      
    } catch (err: any) {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
      console.error('[TeacherLogin] Caught error in handlePasswordSubmit:', err);
      setError('Nastala chyba při přihlašování: ' + (err.message || 'Neznámá chyba'));
      setIsLoading(false);
    }
  };

  // Handle new profile creation - using auth listener approach
  const handleCreateProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail || !newPassword || !school) return;
    
    setIsLoading(true);
    setError('');
    
    console.log('[TeacherLogin] handleCreateProfile VERSION 2.0 (auth listener)');
    
    // Helper to complete profile creation and redirect
    const completeProfileCreation = (userId: string) => {
      console.log('[TeacherLogin] Completing profile creation for:', userId);
      
      // Save school to localStorage (needed for license loading)
      saveSchoolToStorage(school, teachers);
      console.log('[TeacherLogin] School saved to localStorage');
      
      // Save to localStorage immediately
      const userProfile = {
        id: userId,
        userId: userId,
        email: newEmail,
        name: newName,
        role: 'teacher' as const,
        schoolId: school.id,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      };
      storage.saveCurrentUserProfile(userProfile);
      console.log('[TeacherLogin] Profile saved to localStorage');
      
      // Add new teacher to the local list immediately
      console.log('[TeacherLogin] Creating teacher with school_id:', school.id);
      
      const newTeacher: Teacher = {
        id: userId,
        school_id: school.id,
        name: newName,
        email: newEmail,
        last_active: new Date().toISOString(),
        activity_level: 'active',
        authProvider: 'password' as const,
      };
      const updatedTeachers = [...teachers, newTeacher];
      setTeachers(updatedTeachers);
      saveSchoolToStorage(school, updatedTeachers);
      console.log('[TeacherLogin] Teacher added to local list, total:', updatedTeachers.length);
      console.log('[TeacherLogin] Saved to localStorage:', localStorage.getItem(SAVED_TEACHERS_KEY)?.slice(0, 200));
      
      // Save teacher to Supabase - use direct REST API to avoid session issues
      const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';
      const baseUrl = 'https://njbtqmsxbyvpwigfceke.supabase.co/rest/v1';
      
      fetch(`${baseUrl}/teachers`, {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify({
          id: userId,
          school_id: school.id,
          name: newName,
          email: newEmail,
          last_active: new Date().toISOString(),
          activity_level: 'active',
          auth_provider: 'password',
        })
      })
        .then(async (res) => {
          if (!res.ok) {
            const text = await res.text();
            console.error('[TeacherLogin] Failed to save teacher to Supabase:', text);
          } else {
            console.log('[TeacherLogin] Teacher saved to Supabase successfully');
          }
        })
        .catch(err => console.warn('[TeacherLogin] Failed to save teacher to Supabase:', err));
      
      // Redirect immediately
      console.log('[TeacherLogin] Redirecting to library...');
      setViewMode('teacher');
      setIsLoading(false);
      navigate('/library/my-content');
    };
    
    // Set up auth listener FIRST - this catches the event even if Promise never resolves
    let handled = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[TeacherLogin] Auth event:', event, session?.user?.email);
      if (handled) return;
      
      if (event === 'SIGNED_IN' && session?.user) {
        handled = true;
        subscription.unsubscribe();
        completeProfileCreation(session.user.id);
      }
    });
    
    // Set timeout to clean up listener if nothing happens
    const timeoutId = setTimeout(() => {
      if (!handled) {
        console.log('[TeacherLogin] Auth listener timeout - checking localStorage');
        subscription.unsubscribe();
        
        // Check if we got signed in anyway (via App.tsx listener)
        const savedProfile = storage.getCurrentUserProfile();
        if (savedProfile?.email === newEmail) {
          console.log('[TeacherLogin] Found profile in localStorage, redirecting');
          handled = true;
          setViewMode('teacher');
          setIsLoading(false);
          navigate('/library/my-content');
          return;
        }
        
        setError('Registrace trvá příliš dlouho. Zkuste obnovit stránku.');
        setIsLoading(false);
      }
    }, 10000); // 10 second total timeout
    
    try {
      // Fire and forget - don't wait for response
      // First try signUp (for new users)
      console.log('[TeacherLogin] Calling signUp (fire and forget)...');
      supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
      }).then(({ error }) => {
        if (error && !handled) {
          console.log('[TeacherLogin] SignUp error:', error.message);
          
          if (error.message?.includes('already registered') || error.message?.includes('already been registered')) {
            // User exists - try signIn
            console.log('[TeacherLogin] User exists, trying signIn...');
            supabase.auth.signInWithPassword({
              email: newEmail,
              password: newPassword,
            }).then(({ error: signInError }) => {
              if (signInError && !handled) {
                clearTimeout(timeoutId);
                subscription.unsubscribe();
                setError('Email je zaregistrován s jiným heslem. Použijte správné heslo.');
                setIsLoading(false);
              }
            });
          } else if (!handled) {
            clearTimeout(timeoutId);
            subscription.unsubscribe();
            setError(error.message);
            setIsLoading(false);
          }
        }
      });
      
    } catch (err) {
      console.error('[TeacherLogin] Unexpected error:', err);
      clearTimeout(timeoutId);
      subscription.unsubscribe();
      if (!handled) {
        setError('Nastala neočekávaná chyba');
        setIsLoading(false);
      }
    }
  };
  

  // Generate avatar with initials
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Generate random pastel color based on name (hex values for inline styles)
  const getAvatarColor = (name: string): string => {
    const colors = [
      '#FACC15', // yellow
      '#60A5FA', // blue
      '#FB923C', // orange
      '#4ADE80', // green
      '#F472B6', // pink
      '#A78BFA', // purple
      '#F87171', // red
      '#2DD4BF', // teal
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className="min-h-screen flex">
      {/* Login form */}
      <div 
        className="flex-1 flex flex-col items-center justify-center p-8"
        style={{ background: 'linear-gradient(180deg, #e8eef5 0%, #d9e2ec 100%)' }}
      >
        {/* Back button - only show when navigating away from main step */}
        {(step === 'enter-password' || step === 'create-profile') && (
          <button
            onClick={() => {
              setStep('select-teacher');
              setError('');
            }}
            className="absolute top-6 left-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Zpět
          </button>
        )}

        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-40 h-20 mx-auto mb-4" style={{ color: '#4E5871' }}>
              <VividLogo />
            </div>
            <p className="text-gray-600">
              Aplikace ve které najdete naše online předměty a pracovní sešity.
            </p>
          </div>

          {/* Initial Loading */}
          {initialLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400 mb-4" />
              <p className="text-gray-500">Načítání...</p>
            </div>
          )}

          {/* Step: School Code */}
          {!initialLoading && step === 'school-code' && (
            <div className="text-center">
              {/* Login mode toggle */}
              <div className="flex justify-center mb-6">
                <div className="inline-flex bg-gray-200 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => { setLoginMode('school-code'); setError(''); }}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition-all ${
                      loginMode === 'school-code' 
                        ? 'bg-white text-gray-800 shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Key className="w-4 h-4" />
                    Kód školy
                  </button>
                  <button
                    type="button"
                    onClick={() => { setLoginMode('direct-login'); setError(''); }}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition-all ${
                      loginMode === 'direct-login' 
                        ? 'bg-white text-gray-800 shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    Můj účet
                  </button>
                </div>
              </div>
              
              {/* School code login */}
              {loginMode === 'school-code' && (
                <form onSubmit={handleSchoolCodeSubmit}>
                  <input
                    type="text"
                    value={schoolCode}
                    onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                    placeholder="Zadejte KÓD ŠKOLY"
                    className="w-full px-6 py-4 border border-gray-300 text-center text-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    style={{ borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}
                  />
                  
                  {error && (
                    <p className="mt-3 text-red-500 text-sm">{error}</p>
                  )}
                  
                  <button
                    type="submit"
                    disabled={isLoading || !schoolCode.trim()}
                    className="w-full mt-6 py-4 text-white font-medium transition-all disabled:opacity-50"
                    style={{ 
                      borderRadius: '16px',
                      background: '#4a5568',
                      boxShadow: '0 4px 15px rgba(74, 85, 104, 0.3)',
                    }}
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    ) : (
                      'Pokračovat'
                    )}
                  </button>
                </form>
              )}
              
              {/* Direct login (email/password or Google) */}
              {loginMode === 'direct-login' && (
                <div>
                  <form onSubmit={handleDirectLogin}>
                    <input
                      type="email"
                      value={directEmail}
                      onChange={(e) => setDirectEmail(e.target.value)}
                      placeholder="E-mail"
                      className="w-full px-6 py-4 border border-gray-300 text-center text-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
                      style={{ borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}
                    />
                    <input
                      type="password"
                      value={directPassword}
                      onChange={(e) => setDirectPassword(e.target.value)}
                      placeholder="Heslo"
                      className="w-full px-6 py-4 border border-gray-300 text-center text-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      style={{ borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}
                    />
                    
                    {error && (
                      <p className="mt-3 text-red-500 text-sm">{error}</p>
                    )}
                    
                    <button
                      type="submit"
                      disabled={isLoading || !directEmail.trim() || !directPassword.trim()}
                      className="w-full mt-6 py-4 text-white font-medium transition-all disabled:opacity-50"
                      style={{ 
                        borderRadius: '16px',
                        background: '#4a5568',
                        boxShadow: '0 4px 15px rgba(74, 85, 104, 0.3)',
                      }}
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                      ) : (
                        'Přihlásit se'
                      )}
                    </button>
                  </form>
                  
                  {/* Google login */}
                  <div className="mt-4">
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-[#e8eef5] text-gray-400">nebo</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={handleGoogleSignInDirect}
                      disabled={isLoading}
                      className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-white/50 transition-colors disabled:opacity-50 mx-auto"
                      style={{ background: 'white' }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      <span className="text-gray-600">Přihlásit přes Google</span>
                    </button>
                  </div>
                </div>
              )}
              
              <div className="mt-8">
                <p className="text-sm text-gray-500 mb-3">Nemáte Vividbooks účet?</p>
                <button 
                  className="px-6 py-3 text-white font-medium"
                  style={{ borderRadius: '16px', background: '#f6ad55' }}
                  onClick={() => window.open('https://vividbooks.com/trial', '_blank')}
                >
                  Zaregistrujte si přístup na 14 dní zdarma
                </button>
              </div>
              
              {/* Student link */}
              <div className="mt-6">
                <button
                  onClick={() => navigate('/student/login')}
                  className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors text-sm"
                >
                  <User className="w-4 h-4" />
                  Přihlásit se jako žák
                </button>
              </div>
            </div>
          )}

          {/* Step: Select Teacher */}
          {!initialLoading && step === 'select-teacher' && (
            <div className="text-center">
              <h2 className="text-2xl font-medium text-gray-800 mb-2">
                Kdo dnes učí?
              </h2>
              <div className="flex items-center justify-center gap-2 mb-8">
                <p className="text-gray-500">
                  {school?.name}
                </p>
                <button
                  onClick={handleChangeSchool}
                  className="p-1.5 rounded-full hover:bg-gray-200 transition-colors"
                  title="Změnit školu"
                >
                  <LogOut className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              
              <div className="grid grid-cols-3 gap-6 mb-8">
                {teachers.map((teacher) => (
                  <button
                    key={teacher.id}
                    onClick={() => handleSelectTeacher(teacher)}
                    className="flex flex-col items-center group"
                  >
                    <div className="relative mb-2">
                      <div 
                        className="w-20 h-20 rounded-full flex items-center justify-center text-white text-xl font-bold transition-transform group-hover:scale-110"
                        style={{ backgroundColor: getAvatarColor(teacher.name), boxShadow: '0 4px 15px rgba(0,0,0,0.15)' }}
                      >
                        {teacher.avatar_url ? (
                          <img 
                            src={teacher.avatar_url} 
                            alt={teacher.name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          getInitials(teacher.name)
                        )}
                      </div>
                      {/* Google badge - positioned at top right */}
                      {teacher.authProvider === 'google' && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md border border-gray-100">
                          <svg width="12" height="12" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-800">{teacher.name}</p>
                  </button>
                ))}
                
                {/* Add new teacher button */}
                <button
                  onClick={() => {
                    setStep('create-profile');
                    setError('');
                  }}
                  className="flex flex-col items-center group"
                >
                  <div 
                    className="w-20 h-20 rounded-full flex items-center justify-center border-2 border-dashed border-gray-400 text-gray-400 mb-2 transition-all group-hover:border-blue-500 group-hover:text-blue-500 group-hover:scale-110"
                  >
                    <Plus className="w-8 h-8" />
                  </div>
                  <p className="text-sm font-medium text-gray-600">Nový profil</p>
                </button>
              </div>
              
              {teachers.length === 0 && (
                <p className="text-gray-500 mb-4">
                  V této škole zatím nejsou žádní učitelé.
                </p>
              )}
            </div>
          )}

          {/* Step: Enter Password */}
          {!initialLoading && step === 'enter-password' && selectedTeacher && (
            <div className="text-center">
              {/* Circle avatar with initials */}
              <div 
                className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4"
                style={{ backgroundColor: getAvatarColor(selectedTeacher.name), boxShadow: '0 4px 15px rgba(0,0,0,0.15)' }}
              >
                {selectedTeacher.avatar_url ? (
                  <img 
                    src={selectedTeacher.avatar_url} 
                    alt={selectedTeacher.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  getInitials(selectedTeacher.name)
                )}
              </div>
              
              <h2 className="text-xl font-medium text-gray-800 mb-1">
                {selectedTeacher.name}
              </h2>
              <p className="text-gray-500 mb-6">{school?.name}</p>
              
              <form onSubmit={handlePasswordSubmit}>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Zadejte heslo"
                    className="w-full px-6 py-4 pr-12 border border-gray-300 text-center text-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    style={{ borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                
                {error && (
                  <p className="mt-3 text-red-500 text-sm">{error}</p>
                )}
                
                <button
                  type="submit"
                  disabled={isLoading || !password}
                  className="w-full mt-6 py-4 text-white font-medium transition-all disabled:opacity-50"
                  style={{ 
                    borderRadius: '16px',
                    background: '#4a5568',
                    boxShadow: '0 4px 15px rgba(74, 85, 104, 0.3)',
                  }}
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    'Přihlásit se'
                  )}
                </button>
              </form>
              
              <button
                className="mt-4 text-sm text-gray-500 hover:text-gray-700"
                onClick={() => alert('Funkce resetování hesla bude brzy k dispozici.')}
              >
                Zapomněli jste heslo?
              </button>
              
              {/* Google Sign In */}
              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-2 bg-[#e8eef5] text-gray-400">nebo</span>
                  </div>
                </div>
                
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="mt-3 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-white/50 transition-colors disabled:opacity-50 mx-auto"
                  style={{ background: 'white' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span className="text-gray-600 text-sm">Google</span>
                </button>
              </div>
            </div>
          )}

          {/* Step: Create Profile */}
          {!initialLoading && step === 'create-profile' && (
            <div>
              <h2 className="text-2xl font-medium text-gray-800 mb-2 text-center">
                Nový profil učitele
              </h2>
              <p className="text-gray-500 mb-6 text-center">{school?.name}</p>
              
              <form onSubmit={handleCreateProfile} className="space-y-4">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Jméno a příjmení"
                  className="w-full px-6 py-4 border border-gray-300 text-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{ borderRadius: '16px' }}
                  required
                />
                
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="E-mail"
                  className="w-full px-6 py-4 border border-gray-300 text-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{ borderRadius: '16px' }}
                  required
                />
                
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Heslo"
                  className="w-full px-6 py-4 border border-gray-300 text-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{ borderRadius: '16px' }}
                  required
                />
                
                {error && (
                  <p className="text-red-500 text-sm text-center">{error}</p>
                )}
                
                <button
                  type="submit"
                  disabled={isLoading || !newName || !newEmail || !newPassword}
                  className="w-full py-4 text-white font-medium transition-all disabled:opacity-50"
                  style={{ 
                    borderRadius: '16px',
                    background: '#4a5568',
                    boxShadow: '0 4px 15px rgba(74, 85, 104, 0.3)',
                  }}
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    'Vytvořit profil a přihlásit se'
                  )}
                </button>
              </form>
              
              {/* Google Sign In */}
              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-2 bg-[#e8eef5] text-gray-400">nebo</span>
                  </div>
                </div>
                
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="mt-3 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-white/50 transition-colors disabled:opacity-50 mx-auto"
                  style={{ background: 'white' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span className="text-gray-600 text-sm">Registrovat přes Google</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right side - Testimonial */}
      <div 
        className="hidden lg:flex flex-1 flex-col items-center justify-center p-12"
        style={{ background: '#fafafa' }}
      >
        <div className="max-w-md">
          <h3 className="text-xl font-medium text-gray-700 mb-6">Vaše reakce:</h3>
          <blockquote 
            className="text-2xl leading-relaxed"
            style={{ color: '#9ca3af' }}
          >
            Dobrý den, chtěl bych Vám oznámit svůj názor na vividbooks. Je mi 12 let a během prvních deseti minut jsem pochopil vztlakovou a gravitační sílu. Proto si myslím, že vividbooks je skvělý výukový nástroj a proto mu dávám 15 z 10.
          </blockquote>
        </div>
      </div>
    </div>
  );
}

