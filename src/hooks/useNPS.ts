/**
 * useNPS Hook - Manages NPS survey timing and submission
 * Shows NPS popup every 30 days
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase/client';

const NPS_INTERVAL_DAYS = 30;
const NPS_STORAGE_KEY = 'vb_nps_last_shown';
const NPS_DISMISSED_KEY = 'vb_nps_dismissed_until';

interface NPSResponse {
  id: string;
  user_id: string;
  school_id: string | null;
  score: number;
  category: 'detractor' | 'passive' | 'promoter';
  feedback: string | null;
  triggered_by: 'automatic' | 'manual';
  created_at: string;
  user_name: string | null;
  user_email: string | null;
}

interface UseNPSOptions {
  userId?: string;
  schoolId?: string;
  userName?: string;
  userEmail?: string;
  enabled?: boolean;
}

interface UseNPSReturn {
  showNPS: boolean;
  setShowNPS: (show: boolean) => void;
  submitNPS: (score: number, feedback: string) => Promise<void>;
  triggerNPSManually: () => void;
  dismissNPS: () => void;
  isLoading: boolean;
  lastResponse: NPSResponse | null;
  allResponses: NPSResponse[];
  fetchUserResponses: (userId: string) => Promise<NPSResponse[]>;
}

const getCategory = (score: number): 'detractor' | 'passive' | 'promoter' => {
  if (score <= 6) return 'detractor';
  if (score <= 8) return 'passive';
  return 'promoter';
};

export function useNPS(options: UseNPSOptions = {}): UseNPSReturn {
  const { userId, schoolId, userName, userEmail, enabled = true } = options;
  
  const [showNPS, setShowNPS] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<NPSResponse | null>(null);
  const [allResponses, setAllResponses] = useState<NPSResponse[]>([]);
  const [isManualTrigger, setIsManualTrigger] = useState(false);

  // Check if we should show NPS on mount
  useEffect(() => {
    if (!enabled || !userId) return;

    const checkNPSTiming = () => {
      const lastShown = localStorage.getItem(NPS_STORAGE_KEY);
      const dismissedUntil = localStorage.getItem(NPS_DISMISSED_KEY);
      
      const now = Date.now();
      
      // Check if dismissed
      if (dismissedUntil && parseInt(dismissedUntil) > now) {
        return;
      }
      
      // Check if enough time has passed
      if (lastShown) {
        const daysSinceLastShown = (now - parseInt(lastShown)) / (1000 * 60 * 60 * 24);
        if (daysSinceLastShown < NPS_INTERVAL_DAYS) {
          return;
        }
      }
      
      // Show NPS after a delay (don't interrupt immediately)
      setTimeout(() => {
        setShowNPS(true);
      }, 5000); // 5 second delay after page load
    };

    checkNPSTiming();
  }, [enabled, userId]);

  // Fetch last response
  useEffect(() => {
    if (!userId) return;

    const fetchLastResponse = async () => {
      try {
        const { data, error } = await supabase
          .from('nps_responses')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (data && !error) {
          setLastResponse(data);
        }
      } catch (err) {
        // No response yet, that's fine
      }
    };

    fetchLastResponse();
  }, [userId]);

  // Submit NPS response
  const submitNPS = useCallback(async (score: number, feedback: string) => {
    if (!userId) {
      console.warn('[NPS] No user ID provided');
      return;
    }

    setIsLoading(true);
    
    try {
      const response: Partial<NPSResponse> = {
        user_id: userId,
        school_id: schoolId || null,
        score,
        category: getCategory(score),
        feedback: feedback || null,
        triggered_by: isManualTrigger ? 'manual' : 'automatic',
        user_name: userName || null,
        user_email: userEmail || null,
      };

      const { data, error } = await supabase
        .from('nps_responses')
        .insert(response)
        .select()
        .single();

      if (error) {
        console.error('[NPS] Error saving response:', error);
        // Still mark as shown even if save fails
      } else {
        console.log('[NPS] Response saved:', data);
        setLastResponse(data);
      }

      // Mark as shown
      localStorage.setItem(NPS_STORAGE_KEY, Date.now().toString());
      setShowNPS(false);
      setIsManualTrigger(false);
      
    } catch (err) {
      console.error('[NPS] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, schoolId, userName, userEmail, isManualTrigger]);

  // Trigger NPS manually (from CS dashboard)
  const triggerNPSManually = useCallback(() => {
    setIsManualTrigger(true);
    setShowNPS(true);
  }, []);

  // Dismiss NPS (postpone for 7 days)
  const dismissNPS = useCallback(() => {
    const dismissUntil = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
    localStorage.setItem(NPS_DISMISSED_KEY, dismissUntil.toString());
    setShowNPS(false);
    setIsManualTrigger(false);
  }, []);

  // Fetch all responses for a specific user (for CS dashboard)
  const fetchUserResponses = useCallback(async (targetUserId: string): Promise<NPSResponse[]> => {
    try {
      const { data, error } = await supabase
        .from('nps_responses')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[NPS] Error fetching responses:', error);
        return [];
      }
      
      return data || [];
    } catch (err) {
      console.error('[NPS] Error:', err);
      return [];
    }
  }, []);

  return {
    showNPS,
    setShowNPS,
    submitNPS,
    triggerNPSManually,
    dismissNPS,
    isLoading,
    lastResponse,
    allResponses,
    fetchUserResponses,
  };
}

// Helper function to calculate NPS score from responses
export function calculateNPSScore(responses: NPSResponse[]): number {
  if (responses.length === 0) return 0;
  
  const promoters = responses.filter(r => r.category === 'promoter').length;
  const detractors = responses.filter(r => r.category === 'detractor').length;
  
  return Math.round((promoters / responses.length * 100) - (detractors / responses.length * 100));
}

// Helper to get NPS color based on score
export function getNPSColor(npsScore: number): string {
  if (npsScore >= 50) return 'text-green-600';
  if (npsScore >= 0) return 'text-amber-600';
  return 'text-red-600';
}

export function getNPSBgColor(npsScore: number): string {
  if (npsScore >= 50) return 'bg-green-100';
  if (npsScore >= 0) return 'bg-amber-100';
  return 'bg-red-100';
}

export default useNPS;



