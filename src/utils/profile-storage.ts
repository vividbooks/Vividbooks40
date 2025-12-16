// =============================================
// LOCAL STORAGE FOR PROFILE & LICENSE SYSTEM
// Fallback when API is not available
// =============================================

import { 
  School, 
  UserProfile, 
  SchoolLicense, 
  SubjectLicense,
  Colleague 
} from '../types/profile';

// Storage keys
const STORAGE_KEYS = {
  SCHOOLS: 'vividbooks_schools',
  PROFILES: 'vividbooks_profiles',
  LICENSES: 'vividbooks_licenses',
  CURRENT_USER_PROFILE: 'vividbooks_current_user_profile',
};

// =============================================
// INITIAL MOCK DATA
// =============================================

const today = new Date();
const nextYear = new Date(today);
nextYear.setFullYear(nextYear.getFullYear() + 1);
const nextYearAugust = new Date(nextYear.getFullYear(), 7, 31);

const INITIAL_SCHOOLS: School[] = [
  {
    id: 'school-1',
    code: 'VVD123',
    name: 'Základní škola Dukelská',
    address: 'Dukelská 123',
    city: 'Praha 6',
    createdAt: '2024-01-15T10:00:00Z'
  },
  {
    id: 'school-2',
    code: 'ABC456',
    name: 'ZŠ a MŠ Horní Počernice',
    address: 'Stoliňská 823',
    city: 'Praha 9',
    createdAt: '2024-02-20T14:30:00Z'
  },
];

const INITIAL_LICENSES: SchoolLicense[] = [
  {
    id: 'license-1',
    schoolId: 'school-1',
    subjects: [
      {
        id: 'sublic-1',
        subject: 'fyzika',
        tier: 'digital-library',
        validFrom: '2024-09-01T00:00:00Z',
        validUntil: nextYearAugust.toISOString(),
      },
      {
        id: 'sublic-2',
        subject: 'chemie',
        tier: 'workbooks',
        validFrom: '2024-09-01T00:00:00Z',
        validUntil: nextYearAugust.toISOString(),
        isFree: true,
        workbookCount: 20,
      },
      {
        id: 'sublic-3',
        subject: 'matematika-2',
        tier: 'digital-library',
        validFrom: '2024-09-01T00:00:00Z',
        validUntil: nextYearAugust.toISOString(),
      },
    ],
    features: {
      vividboardWall: true,
      ecosystemVividbooks: true,
    },
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'license-2',
    schoolId: 'school-2',
    subjects: [
      {
        id: 'sublic-10',
        subject: 'fyzika',
        tier: 'workbooks',
        validFrom: '2024-09-01T00:00:00Z',
        validUntil: nextYearAugust.toISOString(),
        isFree: true,
        workbookCount: 15,
      },
    ],
    features: {
      vividboardWall: true,
      ecosystemVividbooks: false,
    },
    updatedAt: new Date().toISOString(),
  },
];

// =============================================
// INITIALIZATION
// =============================================

export function initializeStorage(): void {
  if (!localStorage.getItem(STORAGE_KEYS.SCHOOLS)) {
    localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(INITIAL_SCHOOLS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.LICENSES)) {
    localStorage.setItem(STORAGE_KEYS.LICENSES, JSON.stringify(INITIAL_LICENSES));
  }
  if (!localStorage.getItem(STORAGE_KEYS.PROFILES)) {
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify([]));
  }
}

// =============================================
// SCHOOLS
// =============================================

export function getSchools(): School[] {
  initializeStorage();
  const data = localStorage.getItem(STORAGE_KEYS.SCHOOLS);
  return data ? JSON.parse(data) : [];
}

export function getSchoolById(id: string): School | null {
  const schools = getSchools();
  return schools.find(s => s.id === id) || null;
}

export function getSchoolByCode(code: string): School | null {
  const schools = getSchools();
  return schools.find(s => s.code.toUpperCase() === code.toUpperCase()) || null;
}

export function createSchool(school: Omit<School, 'id' | 'createdAt'>): School {
  const schools = getSchools();
  const newSchool: School = {
    ...school,
    id: `school-${Date.now()}`,
    code: school.code.toUpperCase(),
    createdAt: new Date().toISOString(),
  };
  schools.push(newSchool);
  localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(schools));
  return newSchool;
}

export function deleteSchool(id: string): void {
  const schools = getSchools().filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(schools));
}

// =============================================
// PROFILES
// =============================================

export function getProfiles(): UserProfile[] {
  initializeStorage();
  const data = localStorage.getItem(STORAGE_KEYS.PROFILES);
  return data ? JSON.parse(data) : [];
}

export function getCurrentUserProfile(): UserProfile | null {
  const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_PROFILE);
  return data ? JSON.parse(data) : null;
}

export function saveCurrentUserProfile(profile: UserProfile): void {
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER_PROFILE, JSON.stringify(profile));
  
  // Also save to profiles list
  const profiles = getProfiles();
  const existingIndex = profiles.findIndex(p => p.userId === profile.userId);
  if (existingIndex >= 0) {
    profiles[existingIndex] = profile;
  } else {
    profiles.push(profile);
  }
  localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
}

export function getColleagues(currentUserId: string, schoolId: string): Colleague[] {
  const profiles = getProfiles();
  return profiles
    .filter(p => p.schoolId === schoolId && p.userId !== currentUserId)
    .map(p => ({
      id: p.id,
      name: p.name,
      email: p.email,
      avatarUrl: p.avatarUrl,
      lastActiveAt: p.lastActiveAt,
      usageStats: {
        totalSessions: Math.floor(Math.random() * 200) + 10,
        lastWeekSessions: Math.floor(Math.random() * 20),
      },
    }));
}

// =============================================
// LICENSES
// =============================================

export function getLicenses(): SchoolLicense[] {
  initializeStorage();
  const data = localStorage.getItem(STORAGE_KEYS.LICENSES);
  return data ? JSON.parse(data) : [];
}

export function getLicenseBySchoolId(schoolId: string): SchoolLicense | null {
  const licenses = getLicenses();
  return licenses.find(l => l.schoolId === schoolId) || null;
}

export function saveLicense(license: SchoolLicense): SchoolLicense {
  const licenses = getLicenses();
  const existingIndex = licenses.findIndex(l => l.schoolId === license.schoolId);
  
  const updatedLicense = {
    ...license,
    id: license.id || `license-${Date.now()}`,
    updatedAt: new Date().toISOString(),
  };
  
  if (existingIndex >= 0) {
    licenses[existingIndex] = updatedLicense;
  } else {
    licenses.push(updatedLicense);
  }
  
  localStorage.setItem(STORAGE_KEYS.LICENSES, JSON.stringify(licenses));
  return updatedLicense;
}

export function deleteLicense(schoolId: string): void {
  const licenses = getLicenses().filter(l => l.schoolId !== schoolId);
  localStorage.setItem(STORAGE_KEYS.LICENSES, JSON.stringify(licenses));
}

// =============================================
// RESET (for testing)
// =============================================

export function resetStorage(): void {
  localStorage.removeItem(STORAGE_KEYS.SCHOOLS);
  localStorage.removeItem(STORAGE_KEYS.PROFILES);
  localStorage.removeItem(STORAGE_KEYS.LICENSES);
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_PROFILE);
  initializeStorage();
}

// =============================================
// STORAGE OBJECT (convenience wrapper)
// =============================================

export const storage = {
  // Schools
  getSchools,
  getSchoolById,
  getSchoolByCode,
  createSchool,
  deleteSchool,
  
  // Profiles
  getProfiles,
  getCurrentUserProfile,
  saveCurrentUserProfile,
  
  // Colleagues
  getColleagues,
  
  // Licenses
  getLicenses,
  getLicenseBySchoolId,
  saveLicense,
  deleteLicense,
  
  // Reset
  resetStorage,
  initializeStorage,
};

