import { useState, useEffect } from 'react';
import { storage } from '../utils/profile-storage';
import { isFeatureLicenseActive, isLicenseActive, FeatureLicense, SchoolLicense, normalizeTier, tierHasAccess } from '../types/profile';
import { supabase } from '../utils/supabase/client';

export interface EcosystemAccess {
  // Ekosystém Vividbooks
  hasEcosystem: boolean;
  ecosystemValidUntil?: string;
  
  // Vividboard (samostatně nebo součástí ekosystému)
  hasVividboard: boolean;
  vividboardValidUntil?: string;
  
  // Omezení bez ekosystému/vividboardu
  canCreateContent: boolean;      // Může vytvářet dokumenty a pracovní listy
  canUseTeachMe: boolean;         // Může používat "Nauč mě"
  canUseMyClasses: boolean;       // Může používat "Moje třídy"
  maxBoards: number;              // Maximální počet boardů (5 bez licence, neomezeno s licencí)
  
  loading: boolean;
}

// Konstanty pro omezení
const MAX_BOARDS_FREE = 5;
const MAX_BOARDS_UNLIMITED = -1; // -1 = neomezeno

/**
 * Hook to check user's ecosystem and vividboard access
 * @returns EcosystemAccess object with feature access information
 */
export function useEcosystemAccess(): EcosystemAccess {
  const [access, setAccess] = useState<EcosystemAccess>({
    hasEcosystem: false,
    hasVividboard: false,
    canCreateContent: false,
    canUseTeachMe: false,
    canUseMyClasses: false,
    maxBoards: MAX_BOARDS_FREE,
    loading: true,
  });

  useEffect(() => {
    const checkAccess = async () => {
      try {
        // Get current user's profile
        const profile = storage.getCurrentUserProfile();
        
        if (!profile || !profile.schoolId) {
          // No profile or not connected to school - free tier
          setAccess({
            hasEcosystem: false,
            hasVividboard: false,
            canCreateContent: false,
            canUseTeachMe: false,
            canUseMyClasses: false,
            maxBoards: MAX_BOARDS_FREE,
            loading: false,
          });
          return;
        }

        // Get school license from localStorage first
        let schoolLicense = storage.getLicenseBySchoolId(profile.schoolId);
        
        // If no license in localStorage, try Supabase
        if (!schoolLicense) {
          try {
            const { data: supabaseLicense, error } = await supabase
              .from('school_licenses')
              .select('*')
              .eq('school_id', profile.schoolId)
              .single();
            
            if (supabaseLicense && !error) {
              schoolLicense = {
                id: supabaseLicense.id,
                schoolId: supabaseLicense.school_id,
                subjects: supabaseLicense.subjects || [],
                features: supabaseLicense.features || { vividboardWall: true },
                updatedAt: supabaseLicense.updated_at,
              } as SchoolLicense;
              // Save to localStorage for future use
              storage.saveLicense(schoolLicense);
              console.log('✅ License loaded from Supabase in useEcosystemAccess');
            }
          } catch (supabaseError) {
            console.log('Could not load license from Supabase:', supabaseError);
          }
        }
        
        if (!schoolLicense) {
          // No license - free tier
          setAccess({
            hasEcosystem: false,
            hasVividboard: false,
            canCreateContent: false,
            canUseTeachMe: false,
            canUseMyClasses: false,
            maxBoards: MAX_BOARDS_FREE,
            loading: false,
          });
          return;
        }

        // Check ecosystem license
        const ecosystemFeature = schoolLicense.features.ecosystemVividbooks as FeatureLicense | undefined;
        const hasEcosystem = isFeatureLicenseActive(ecosystemFeature);
        
        // Check vividboard license (can be standalone or part of ecosystem)
        const vividboardFeature = schoolLicense.features.vividboard as FeatureLicense | undefined;
        const hasVividboard = isFeatureLicenseActive(vividboardFeature) || hasEcosystem; // Ecosystem includes vividboard
        
        // Check tier levels from subjects
        // New tier hierarchy:
        // - vividbooks-sesity: základní přístup (pracovní sešity)
        // - vividbooks-knihovna: rozšířený přístup (celá knihovna)
        // - vividbooks-tvurce: tvorba obsahu (boardy, dokumenty, pracovní listy)
        // - vividbooks-tridni: management tříd
        
        const hasCreatorAccess = schoolLicense.subjects.some(
          sub => tierHasAccess(normalizeTier(sub.tier), 'vividbooks-tvurce') && isLicenseActive(sub)
        );
        
        const hasClassAccess = schoolLicense.subjects.some(
          sub => tierHasAccess(normalizeTier(sub.tier), 'vividbooks-tridni') && isLicenseActive(sub)
        );
        
        // Fallback: check old tier format too
        const hasExtendedDigitalAccess = schoolLicense.subjects.some(
          sub => (sub.tier === 'digital-library' || sub.tier === 'vividbooks-knihovna' || sub.tier === 'vividbooks-tvurce' || sub.tier === 'vividbooks-tridni') && isLicenseActive(sub)
        );

        setAccess({
          hasEcosystem,
          ecosystemValidUntil: ecosystemFeature?.validUntil,
          hasVividboard,
          vividboardValidUntil: vividboardFeature?.validUntil || ecosystemFeature?.validUntil,
          // Content creation - requires vividbooks-tvurce tier OR ecosystem
          canCreateContent: hasEcosystem || hasCreatorAccess || hasExtendedDigitalAccess,
          // TeachMe - requires at least vividbooks-tvurce
          canUseTeachMe: hasEcosystem || hasCreatorAccess || hasExtendedDigitalAccess,
          // My Classes - requires vividbooks-tridni tier
          canUseMyClasses: hasEcosystem || hasClassAccess,
          // Boards limit
          maxBoards: hasVividboard ? MAX_BOARDS_UNLIMITED : MAX_BOARDS_FREE,
          loading: false,
        });
      } catch (error) {
        console.error('Error checking ecosystem access:', error);
        // On error, use free tier
        setAccess({
          hasEcosystem: false,
          hasVividboard: false,
          canCreateContent: false,
          canUseTeachMe: false,
          canUseMyClasses: false,
          maxBoards: MAX_BOARDS_FREE,
          loading: false,
        });
      }
    };

    checkAccess();
    
    // Listen for storage changes (when license is updated)
    const handleStorageChange = () => checkAccess();
    window.addEventListener('storage', handleStorageChange);
    
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return access;
}

/**
 * Get the current board count for the user
 * In a real app, this would come from the database
 */
export function useBoardCount(): { count: number; loading: boolean } {
  const [state, setState] = useState({ count: 0, loading: true });

  useEffect(() => {
    // TODO: Replace with actual board count from database
    // For now, use localStorage as a mock
    const savedCount = localStorage.getItem('vividboard_count');
    setState({
      count: savedCount ? parseInt(savedCount, 10) : 0,
      loading: false,
    });
  }, []);

  return state;
}

/**
 * Increment board count (called when creating a new board)
 */
export function incrementBoardCount(): number {
  const currentCount = parseInt(localStorage.getItem('vividboard_count') || '0', 10);
  const newCount = currentCount + 1;
  localStorage.setItem('vividboard_count', newCount.toString());
  return newCount;
}

/**
 * Decrement board count (called when deleting a board)
 */
export function decrementBoardCount(): number {
  const currentCount = parseInt(localStorage.getItem('vividboard_count') || '0', 10);
  const newCount = Math.max(0, currentCount - 1);
  localStorage.setItem('vividboard_count', newCount.toString());
  return newCount;
}



