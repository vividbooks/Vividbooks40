/**
 * Legacy Vividbooks API client
 * 
 * Used for:
 * - Teacher login with school code
 * - Fetching license information
 * - Fetching teacher profiles
 */

import { Subject, SubjectLicense, SchoolLicense, normalizeTier } from '../types/profile';

const LEGACY_API_BASE = 'https://api.vividbooks.com/v1';

// =============================================
// TYPES
// =============================================

/**
 * Response from legacy login endpoint
 */
export interface LegacyLoginResponse {
  name: string;           // School name
  vat: string;            // IČO (company ID)
  subjects: {
    [key: string]: string; // Subject name → expiration date ISO string
  };
  // TODO: Add teachers array when legacy API provides it
  teachers?: LegacyTeacher[];
}

/**
 * Teacher from legacy system
 */
export interface LegacyTeacher {
  id: number;
  name: string;
  email?: string;
  // Other fields TBD based on legacy API
}

/**
 * Mapped school data ready for our system
 */
export interface MappedSchoolData {
  school: {
    code: string;
    name: string;
    vat: string;
    address: string;
    city: string;
  };
  licenses: {
    subjects: SubjectLicense[];
    features: {
      vividboard?: { active: boolean; validFrom: string; validUntil: string };
      ecosystemVividbooks?: { active: boolean; validFrom: string; validUntil: string };
    };
  };
  teachers: LegacyTeacher[];
}

// =============================================
// SUBJECT MAPPING
// =============================================

/**
 * Map legacy subject names to our internal subject IDs
 */
const SUBJECT_MAP: Record<string, Subject[]> = {
  'Fyzika': ['fyzika'],
  'Chemie': ['chemie'],
  'Přírodopis': ['prirodopis'],
  'Matematika': ['matematika-1', 'matematika-2'], // Activate both grades
  'Zeměpis': ['zemepis'],
  'Dějepis': ['dejepis'],
  'Prvouka': ['prvouka'],
};

/**
 * Features that are not subjects
 */
const FEATURE_KEYS = ['Vividboard', 'Ecosystem', 'EcosystemVividbooks'];

// =============================================
// API FUNCTIONS
// =============================================

/**
 * Fetch school and license data from legacy API using teacher code
 */
export async function fetchLegacySchoolData(teacherCode: string): Promise<LegacyLoginResponse | null> {
  try {
    const response = await fetch(
      `${LEGACY_API_BASE}/vividblock/login?teacherCode=${encodeURIComponent(teacherCode)}`
    );
    
    if (!response.ok) {
      console.error('[LegacyAPI] Login failed:', response.status);
      return null;
    }
    
    const data = await response.json();
    return data as LegacyLoginResponse;
  } catch (error) {
    console.error('[LegacyAPI] Error fetching school data:', error);
    return null;
  }
}

/**
 * Fetch teachers list from legacy API for a school
 * TODO: Implement when legacy API endpoint is available
 */
export async function fetchLegacyTeachers(schoolCode: string): Promise<LegacyTeacher[]> {
  // TODO: Call legacy API to get teachers list
  // For now, return empty array
  console.log('[LegacyAPI] fetchLegacyTeachers not implemented yet, schoolCode:', schoolCode);
  return [];
}

/**
 * Fetch school address from ARES API using IČO
 */
export async function fetchAresData(ico: string): Promise<{ address: string; city: string } | null> {
  try {
    // ARES API endpoint
    const response = await fetch(
      `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`
    );
    
    if (!response.ok) {
      console.warn('[ARES] Failed to fetch data for IČO:', ico);
      return null;
    }
    
    const data = await response.json();
    
    // Extract address from ARES response
    const sidlo = data?.sidlo;
    if (sidlo) {
      const address = [
        sidlo.nazevUlice,
        sidlo.cisloDomovni ? `${sidlo.cisloDomovni}${sidlo.cisloOrientacni ? '/' + sidlo.cisloOrientacni : ''}` : '',
      ].filter(Boolean).join(' ');
      
      const city = sidlo.nazevObce || '';
      
      return { address, city };
    }
    
    return null;
  } catch (error) {
    console.error('[ARES] Error fetching data:', error);
    return null;
  }
}

// =============================================
// DATA MAPPING
// =============================================

/**
 * Map legacy API response to our internal data structures
 */
export async function mapLegacyDataToInternal(
  legacyData: LegacyLoginResponse,
  teacherCode: string
): Promise<MappedSchoolData> {
  const today = new Date().toISOString();
  
  // Try to get address from ARES
  let address = '';
  let city = '';
  
  if (legacyData.vat) {
    const aresData = await fetchAresData(legacyData.vat);
    if (aresData) {
      address = aresData.address;
      city = aresData.city;
    }
  }
  
  // Map subjects to SubjectLicense[]
  const subjectLicenses: SubjectLicense[] = [];
  let vividboardLicense: { active: boolean; validFrom: string; validUntil: string } | undefined;
  let ecosystemLicense: { active: boolean; validFrom: string; validUntil: string } | undefined;
  
  for (const [legacyName, expirationDate] of Object.entries(legacyData.subjects)) {
    // Handle features separately
    if (legacyName === 'Vividboard') {
      vividboardLicense = {
        active: new Date(expirationDate) > new Date(),
        validFrom: today,
        validUntil: expirationDate,
      };
      continue;
    }
    
    if (legacyName === 'Ecosystem' || legacyName === 'EcosystemVividbooks') {
      ecosystemLicense = {
        active: new Date(expirationDate) > new Date(),
        validFrom: today,
        validUntil: expirationDate,
      };
      continue;
    }
    
    // Map subject name to internal IDs
    const internalSubjects = SUBJECT_MAP[legacyName];
    if (!internalSubjects) {
      console.warn('[LegacyAPI] Unknown subject:', legacyName);
      continue;
    }
    
    // Create license for each mapped subject
    for (const subject of internalSubjects) {
      subjectLicenses.push({
        id: `${subject}-${Date.now()}`,
        subject,
        tier: 'vividbooks-knihovna', // Default: full library access
        validFrom: today,
        validUntil: expirationDate,
        isFree: false,
      });
    }
  }
  
  // Default ecosystemVividbooks to active if not specified
  if (!ecosystemLicense) {
    ecosystemLicense = {
      active: true,
      validFrom: today,
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year default
    };
  }
  
  return {
    school: {
      code: teacherCode,
      name: legacyData.name,
      vat: legacyData.vat,
      address,
      city,
    },
    licenses: {
      subjects: subjectLicenses,
      features: {
        vividboard: vividboardLicense,
        ecosystemVividbooks: ecosystemLicense,
      },
    },
    teachers: legacyData.teachers || [],
  };
}

/**
 * Full flow: Fetch and map legacy data
 */
export async function getLegacySchoolWithLicenses(teacherCode: string): Promise<MappedSchoolData | null> {
  const legacyData = await fetchLegacySchoolData(teacherCode);
  
  if (!legacyData) {
    return null;
  }
  
  return mapLegacyDataToInternal(legacyData, teacherCode);
}

// =============================================
// STUDENT ACCESS
// =============================================

/**
 * Response from student login endpoint
 */
export interface StudentLoginResponse {
  valid: boolean;
  schoolName?: string;
  schoolId?: string;
  subjects?: {
    [key: string]: {
      validUntil: string;
      tier: string;
    };
  };
  accessLevel?: 'library-readonly';
  error?: string;
}

/**
 * Mapped student access data
 */
export interface StudentAccessData {
  schoolName: string;
  schoolId: string;
  subjects: {
    subject: string;
    validUntil: string;
  }[];
}

/**
 * Verify student code and get library access
 * 
 * TODO: When legacy API implements /v1/vividblock/student-login, use that.
 * For now, we simulate by checking if code ends with 'S' and stripping it.
 */
export async function verifyStudentCode(studentCode: string): Promise<StudentAccessData | null> {
  try {
    // Try the new student-login endpoint first
    const response = await fetch(
      `${LEGACY_API_BASE}/vividblock/student-login?studentCode=${encodeURIComponent(studentCode)}`
    );
    
    if (response.ok) {
      const data: StudentLoginResponse = await response.json();
      
      if (data.valid && data.schoolName) {
        return {
          schoolName: data.schoolName,
          schoolId: data.schoolId || '',
          subjects: Object.entries(data.subjects || {}).map(([name, info]) => ({
            subject: name,
            validUntil: info.validUntil,
          })),
        };
      }
    }
    
    // Fallback: Try stripping 'S' suffix and using teacher login
    // This is temporary until legacy API implements student-login
    if (studentCode.toUpperCase().endsWith('S')) {
      const teacherCode = studentCode.slice(0, -1);
      const legacyData = await fetchLegacySchoolData(teacherCode);
      
      if (legacyData) {
        return {
          schoolName: legacyData.name,
          schoolId: legacyData.vat || '',
          subjects: Object.entries(legacyData.subjects).map(([name, validUntil]) => ({
            subject: name,
            validUntil: typeof validUntil === 'string' ? validUntil : '',
          })),
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('[LegacyAPI] Error verifying student code:', error);
    return null;
  }
}

