import { useState, useEffect } from 'react';
import { storage } from '../utils/profile-storage';
import { Subject, SubjectLicense, FeatureTier, isLicenseActive, SchoolLicense } from '../types/profile';
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
      try {
        // Get current user's profile from localStorage
        const profile = storage.getCurrentUserProfile();
        
        if (!profile || !profile.schoolId) {
          // No profile or not connected to school - needs school connection
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

        // Try to get license from Supabase first
        let schoolLicense: SchoolLicense | null = null;
        
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
            };
            console.log('✅ License loaded from Supabase for school:', profile.schoolId);
          }
        } catch (supabaseError) {
          console.log('Supabase license lookup failed, trying localStorage');
        }

        // Fallback to localStorage if not found in Supabase
        if (!schoolLicense) {
          schoolLicense = storage.getLicenseBySchoolId(profile.schoolId);
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
        const canViewFolders = subjectLicense.tier === 'digital-library';
        
        setAccess({
          hasAccess: true,
          tier: subjectLicense.tier,
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


