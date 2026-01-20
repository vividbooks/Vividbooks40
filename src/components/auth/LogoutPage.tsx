/**
 * Logout Page
 * 
 * Simple page that logs out the user and redirects to home.
 * Accessible at /logout
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../utils/supabase/client';

export function LogoutPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Odhlašuji...');

  useEffect(() => {
    const doLogout = async () => {
      try {
        console.log('[Logout] Starting logout...');
        
        // Sign out from Supabase
        await supabase.auth.signOut();
        
        // Clear all auth-related localStorage
        const keysToRemove = [
          'vividbooks_current_user_profile',
          'vividbooks_student_identity',
          'vivid-teacher-school',
          'vivid-teacher-school-teachers',
        ];
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        console.log('[Logout] Logout successful');
        setStatus('Odhlášeno! Přesměrovávám...');
        
        // Redirect to home after short delay
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 500);
      } catch (error) {
        console.error('[Logout] Error during logout:', error);
        setStatus('Chyba při odhlašování. Přesměrovávám...');
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 1000);
      }
    };

    doLogout();
  }, [navigate]);

  return (
    <div 
      className="min-h-screen flex items-center justify-center"
      style={{ background: '#3d4a5c' }}
    >
      <div className="text-center text-white">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
        <p>{status}</p>
      </div>
    </div>
  );
}




