import { useState, useEffect } from 'react';
import { storage } from '../utils/profile-storage';
import { Subject, SubjectLicense, FeatureTier, isLicenseActive, SchoolLicense, normalizeTier, tierHasAccess } from '../types/profile';
import { supabase } from '../utils/supabase/client';

export interface LicenseAccess {
  hasAccess: boolean;
  tier: FeatureTier | null;
  canViewFolders: boolean;
  license: SubjectLicense | null;
  loading: boolean;
  needsSchoolConnection: boolean; // User needs to connect to a school
}

/**
 * Hook to check user's license access for a specific subject/category
 * @param category - The category/subject to check (e.g., 'fyzika', 'chemie')
 * @returns LicenseAccess object with access information
 */
export function useLicenseAccess(category: string): LicenseAccess {
  const [access, setAccess] = useState<LicenseAccess>({
    hasAccess: true, // Default to true for development
    tier: null,
    canViewFolders: true, // Default to true for development
    license: null,
    loading: true,
    needsSchoolConnection: false,
  });

  useEffect(() => {
    const checkAccess = async () => {
      // Helper to wrap supabase calls with timeout
      const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | null> => {
        return Promise.race([
          promise,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
        ]);
      };
      
      try {
        // Get current user's profile from localStorage
        const profile = storage.getCurrentUserProfile();
        
        // For students: check if they have class_id (they're connected to a class)
        // Students might not have schoolId directly but are connected via class
        const isStudent = profile?.role === 'student';
        const hasClassConnection = profile?.classId;
        
        if (!profile) {
          // No profile - needs school connection
          setAccess({
            hasAccess: false,
            tier: null,
            canViewFolders: false,
            license: null,
            loading: false,
            needsSchoolConnection: true,
          });
          return;
        }
        
        // Students with a class connection should have access
        // even if schoolId is null (data issue in classes table)
        if (isStudent && hasClassConnection) {
          console.log('[LicenseAccess] Student with class connection - granting access');
          
          // Try to find school_id from class if not in profile (with timeout)
          let schoolId = profile.schoolId;
          if (!schoolId && profile.classId) {
            try {
              const classResult = await withTimeout(
                supabase
                  .from('classes')
                  .select('school_id')
                  .eq('id', profile.classId)
                  .single(),
                3000
              );
              
              if (classResult && 'data' in classResult && classResult.data?.school_id) {
                schoolId = classResult.data.school_id;
                console.log('[LicenseAccess] Found school_id from class:', schoolId);
              }
            } catch (e) {
              console.warn('[LicenseAccess] Failed to lookup school from class');
            }
          }
          
          // If still no schoolId, grant full access for now (connected student)
          if (!schoolId) {
            console.log('[LicenseAccess] Student connected but no school_id found - granting full access');
            setAccess({
              hasAccess: true,
              tier: 'vividbooks-knihovna', // Full library access
              canViewFolders: true,
              license: null,
              loading: false,
              needsSchoolConnection: false,
            });
            return;
          }
          
          // Continue with license check using found schoolId
          profile.schoolId = schoolId;
        }
        
        if (!profile.schoolId) {
          // No schoolId and not a connected student - needs school connection
          setAccess({
            hasAccess: false,
            tier: null,
            canViewFolders: false,
            license: null,
            loading: false,
            needsSchoolConnection: true,
          });
          return;
        }

        // Try to get license from localStorage FIRST (instant)
        let schoolLicense: SchoolLicense | null = storage.getLicenseBySchoolId(profile.schoolId);
        
        // Then try Supabase in background (with timeout)
        if (!schoolLicense) {
          try {
            const licenseResult = await withTimeout(
              supabase
                .from('school_licenses')
                .select('*')
                .eq('school_id', profile.schoolId)
                .single(),
              3000
            );

            if (licenseResult && 'data' in licenseResult && licenseResult.data) {
              const supabaseLicense = licenseResult.data;
              schoolLicense = {
                id: supabaseLicense.id,
                schoolId: supabaseLicense.school_id,
                subjects: supabaseLicense.subjects || [],
                features: supabaseLicense.features || { vividboardWall: true },
                updatedAt: supabaseLicense.updated_at,
              };
              console.log('✅ License loaded from Supabase for school:', profile.schoolId);
            }
          } catch (supabaseError) {
            console.log('[LicenseAccess] Supabase license lookup failed or timed out');
          }
        }
        
        if (!schoolLicense) {
          // No license - allow full access for now (development)
          setAccess({
            hasAccess: true,
            tier: null,
            canViewFolders: true,
            license: null,
            loading: false,
            needsSchoolConnection: false,
          });
          return;
        }

        // Map category to subject ID
        const subjectId = mapCategoryToSubject(category);
        
        if (!subjectId) {
          // Unknown category - allow full access
          setAccess({
            hasAccess: true,
            tier: null,
            canViewFolders: true,
            license: null,
            loading: false,
            needsSchoolConnection: false,
          });
          return;
        }

        // Find license for this subject
        const subjectLicense = schoolLicense.subjects.find(
          (l) => l.subject === subjectId
        );

        if (!subjectLicense || !isLicenseActive(subjectLicense)) {
          // No license for this subject
          setAccess({
            hasAccess: false,
            tier: null,
            canViewFolders: false,
            license: null,
            loading: false,
            needsSchoolConnection: false,
          });
          return;
        }

        // Has license - check tier
        // Normalize legacy tiers and check access level
        const normalizedTier = normalizeTier(subjectLicense.tier);
        
        // canViewFolders requires at least 'vividbooks-knihovna' tier
        const canViewFolders = tierHasAccess(normalizedTier, 'vividbooks-knihovna');
        
        setAccess({
          hasAccess: true,
          tier: normalizedTier,
          canViewFolders,
          license: subjectLicense,
          loading: false,
          needsSchoolConnection: false,
        });
      } catch (error) {
        console.error('Error checking license access:', error);
        // On error, allow full access
        setAccess({
          hasAccess: true,
          tier: null,
          canViewFolders: true,
          license: null,
          loading: false,
          needsSchoolConnection: false,
        });
      }
    };

    checkAccess();
    
    // Re-check after a short delay (profile might be loading)
    const retryTimer = setTimeout(() => {
      if (access.needsSchoolConnection) {
        checkAccess();
      }
    }, 1000);
    
    // Listen for storage changes (profile updates)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'vividbooks_current_user_profile') {
        checkAccess();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      clearTimeout(retryTimer);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [category]);

  return access;
}

/**
 * Maps a category slug to a Subject ID
 */
function mapCategoryToSubject(category: string): Subject | null {
  const categoryMap: Record<string, Subject> = {
    'fyzika': 'fyzika',
    'chemie': 'chemie',
    'prirodopis': 'prirodopis',
    'matematika': 'matematika-2', // Default to 2. stupeň
    'matematika-1': 'matematika-1',
    'matematika-2': 'matematika-2',
    'prvouka': 'prvouka',
  };

  return categoryMap[category.toLowerCase()] || null;
}


