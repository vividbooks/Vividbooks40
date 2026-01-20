import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase/client';
import { useViewMode } from '../../contexts/ViewModeContext';
import * as storage from '../../utils/profile-storage';
import { Loader2 } from 'lucide-react';

/**
 * OAuth Callback handler for Google Sign In
 * 
 * This page is shown after user returns from Google OAuth flow.
 * It extracts the session, creates/updates teacher profile, and redirects to library.
 */
export function AuthCallback() {
  const navigate = useNavigate();
  const { setViewMode } = useViewMode();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Přihlašování...');

  useEffect(() => {
    let handled = false;
    
    // Helper to process user after successful auth
    const processUser = async (user: any) => {
      if (handled) return;
      handled = true;
      
      try {
        console.log('[AuthCallback] User authenticated:', user.email);
        
        // Extract user info from Google
        const userMetadata = user.user_metadata;
        const fullName = userMetadata?.full_name || userMetadata?.name || user.email?.split('@')[0] || 'Nový učitel';
        const email = user.email!;
        
        console.log('[AuthCallback] Creating/updating teacher profile:', { fullName, email });
        
        // Check if we have pending school context from Google OAuth
        const pendingSchoolJson = localStorage.getItem('google-oauth-pending-school');
        let schoolId = '';
        let school: any = null;
        
        if (pendingSchoolJson) {
          try {
            school = JSON.parse(pendingSchoolJson);
            schoolId = school.id;
            console.log('[AuthCallback] Found pending school:', school.name);
            
            // Save school to localStorage
            localStorage.setItem('vivid-teacher-school', pendingSchoolJson);
            
            // Add teacher to school's teacher list
            const teachersJson = localStorage.getItem('vivid-teacher-school-teachers');
            let teachers: any[] = [];
            if (teachersJson) {
              try {
                teachers = JSON.parse(teachersJson);
              } catch (e) {
                teachers = [];
              }
            }
            
            // Check if teacher already exists
            const existingIndex = teachers.findIndex(t => t.email === email || t.id === user.id);
            if (existingIndex === -1) {
              const newTeacher = {
                id: user.id,
                name: fullName,
                email: email,
                avatar_url: userMetadata?.avatar_url || userMetadata?.picture,
                authProvider: 'google' as const,
              };
              teachers.push(newTeacher);
              localStorage.setItem('vivid-teacher-school-teachers', JSON.stringify(teachers));
              console.log('[AuthCallback] Added teacher to school list:', fullName);
            } else {
              // Update existing teacher with authProvider
              teachers[existingIndex] = {
                ...teachers[existingIndex],
                authProvider: 'google' as const,
                avatar_url: userMetadata?.avatar_url || userMetadata?.picture || teachers[existingIndex].avatar_url,
              };
              localStorage.setItem('vivid-teacher-school-teachers', JSON.stringify(teachers));
              console.log('[AuthCallback] Updated existing teacher with Google auth');
            }
            
            // Clean up pending school
            localStorage.removeItem('google-oauth-pending-school');
          } catch (e) {
            console.error('[AuthCallback] Error parsing pending school:', e);
            localStorage.removeItem('google-oauth-pending-school');
          }
        }
        
        // Save user profile to localStorage
        const userProfile = {
          id: user.id,
          userId: user.id,
          email: email,
          name: fullName,
          role: 'teacher' as const,
          schoolId: schoolId,
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
        };
        
        storage.saveCurrentUserProfile(userProfile);
        console.log('[AuthCallback] Profile saved to localStorage');
        
        // Create/update teacher record in Supabase
        const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';
        const baseUrl = 'https://njbtqmsxbyvpwigfceke.supabase.co/rest/v1';
        
        const teacherData: any = {
          id: user.id,
          name: fullName,
          email: email,
          last_active: new Date().toISOString(),
          activity_level: 'active',
          auth_provider: 'google',
        };
        
        // Include school_id if we have it
        if (schoolId) {
          teacherData.school_id = schoolId;
        }
        
        console.log('[AuthCallback] Saving teacher to Supabase:', teacherData);
        
        const response = await fetch(`${baseUrl}/teachers`, {
          method: 'POST',
          headers: {
            'apikey': apiKey,
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify(teacherData)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[AuthCallback] Failed to save teacher:', response.status, errorText);
        } else {
          console.log('[AuthCallback] Teacher record created/updated in Supabase');
        }
        
        setStatus('success');
        setMessage('Přihlášení úspěšné! Přesměrování...');
        setViewMode('teacher');
        
        // Redirect to profile page
        setTimeout(() => navigate('/library/profile'), 1500);
        
      } catch (err: any) {
        console.error('[AuthCallback] Error:', err);
        setStatus('error');
        setMessage('Nastala neočekávaná chyba');
        setTimeout(() => navigate('/teacher-login'), 3000);
      }
    };
    
    const handleCallback = async () => {
      console.log('[AuthCallback] Starting callback handler...');
      
      // Parse tokens from URL hash
      const hash = window.location.hash;
      if (hash && hash.includes('access_token=')) {
        console.log('[AuthCallback] Found access_token in hash, parsing...');
        
        // Parse hash params
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        
        if (accessToken && refreshToken) {
          console.log('[AuthCallback] Setting session from tokens...');
          
          // Set session manually
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (error) {
            console.error('[AuthCallback] Error setting session:', error);
            setStatus('error');
            setMessage('Chyba při přihlášení: ' + error.message);
            setTimeout(() => navigate('/teacher-login'), 3000);
            return;
          }
          
          if (data.user) {
            console.log('[AuthCallback] Session set successfully for:', data.user.email);
            await processUser(data.user);
            return;
          }
        }
      }
      
      // Fallback: try getSession
      console.log('[AuthCallback] No hash tokens, trying getSession...');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        await processUser(session.user);
      } else {
        setStatus('error');
        setMessage('Nepodařilo se dokončit přihlášení');
        setTimeout(() => navigate('/teacher-login'), 3000);
      }
    };
    
    handleCallback();
  }, [navigate, setViewMode]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        {status === 'processing' && (
          <>
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-600 mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">{message}</h2>
            <p className="text-gray-500">Prosím počkejte...</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">{message}</h2>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">{message}</h2>
            <p className="text-gray-500">Přesměrování na přihlašovací stránku...</p>
          </>
        )}
      </div>
    </div>
  );
}

