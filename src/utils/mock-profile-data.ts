// =============================================
// MOCK DATA FOR PROFILE & LICENSE SYSTEM
// =============================================

import { 
  School, 
  UserProfile, 
  SchoolLicense, 
  SubjectLicense,
  Colleague 
} from '../types/profile';

// =============================================
// MOCK SCHOOLS
// =============================================

export const MOCK_SCHOOLS: School[] = [
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
  {
    id: 'school-3',
    code: 'XYZ789',
    name: 'Základní škola Jiřího z Poděbrad',
    address: 'Náměstí Jiřího z Poděbrad 7',
    city: 'Brno',
    createdAt: '2024-03-10T09:15:00Z'
  }
];

// =============================================
// MOCK USER PROFILES
// =============================================

export const MOCK_PROFILES: UserProfile[] = [
  {
    id: 'profile-1',
    userId: 'user-auth-1',
    email: 'jan.novak@zs-dukelska.cz',
    name: 'Jan Novák',
    role: 'teacher',
    schoolId: 'school-1',
    avatarUrl: undefined,
    createdAt: '2024-01-20T08:00:00Z',
    lastActiveAt: '2024-12-08T09:30:00Z'
  },
  {
    id: 'profile-2',
    userId: 'user-auth-2',
    email: 'marie.svobodova@zs-dukelska.cz',
    name: 'Marie Svobodová',
    role: 'teacher',
    schoolId: 'school-1',
    avatarUrl: undefined,
    createdAt: '2024-02-15T10:00:00Z',
    lastActiveAt: '2024-12-07T14:20:00Z'
  },
  {
    id: 'profile-3',
    userId: 'user-auth-3',
    email: 'petr.horak@zs-dukelska.cz',
    name: 'Petr Horák',
    role: 'teacher',
    schoolId: 'school-1',
    avatarUrl: undefined,
    createdAt: '2024-03-01T11:30:00Z',
    lastActiveAt: '2024-12-06T16:45:00Z'
  },
  {
    id: 'profile-4',
    userId: 'user-auth-4',
    email: 'eva.kralova@zs-pocernice.cz',
    name: 'Eva Králová',
    role: 'teacher',
    schoolId: 'school-2',
    avatarUrl: undefined,
    createdAt: '2024-04-10T09:00:00Z',
    lastActiveAt: '2024-12-08T08:15:00Z'
  }
];

// =============================================
// MOCK LICENSES
// =============================================

const today = new Date();
const nextYear = new Date(today);
nextYear.setFullYear(nextYear.getFullYear() + 1);
const nextYearAugust = new Date(nextYear.getFullYear(), 7, 31); // 31. srpna

const threeMonthsFromNow = new Date(today);
threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);

const expiringSoon = new Date(today);
expiringSoon.setDate(expiringSoon.getDate() + 14); // Za 14 dní

export const MOCK_LICENSES: SchoolLicense[] = [
  {
    id: 'license-1',
    schoolId: 'school-1',
    subjects: [
      {
        id: 'sublic-1',
        subject: 'fyzika',
        tier: 'workbooks', // Základní digitální přístup - nevidí složky
        validFrom: '2024-09-01T00:00:00Z',
        validUntil: nextYearAugust.toISOString(),
      },
      {
        id: 'sublic-2',
        subject: 'chemie',
        tier: 'digital-library',
        validFrom: '2024-09-01T00:00:00Z',
        validUntil: nextYearAugust.toISOString(),
      },
      {
        id: 'sublic-3',
        subject: 'prirodopis',
        tier: 'workbooks',
        validFrom: '2024-09-01T00:00:00Z',
        validUntil: threeMonthsFromNow.toISOString(),
      },
      {
        id: 'sublic-4',
        subject: 'matematika-2',
        tier: 'digital-library', // Rozšířený digitální přístup
        validFrom: '2024-09-01T00:00:00Z',
        validUntil: nextYearAugust.toISOString(),
      },
      {
        id: 'sublic-5',
        subject: 'matematika-1',
        tier: 'workbooks',
        validFrom: '2024-09-01T00:00:00Z',
        validUntil: nextYearAugust.toISOString(),
        workbookCount: 25,
        isFree: true,
      },
      {
        id: 'sublic-6',
        subject: 'prvouka',
        tier: 'digital-library',
        validFrom: '2024-09-01T00:00:00Z',
        validUntil: expiringSoon.toISOString(), // Brzy vyprší
      },
    ],
    features: {
      vividboardWall: true,
      ecosystemVividbooks: {
        active: true,
        validFrom: '2024-09-01T00:00:00Z',
        validUntil: nextYearAugust.toISOString(),
      },
      vividboard: {
        active: true,
        validFrom: '2024-09-01T00:00:00Z',
        validUntil: nextYearAugust.toISOString(),
      },
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
        tier: 'digital-library',
        validFrom: '2024-09-01T00:00:00Z',
        validUntil: nextYearAugust.toISOString(),
      },
      {
        id: 'sublic-11',
        subject: 'matematika-1',
        tier: 'digital-library', // Rozšířený digitální přístup
        validFrom: '2024-09-01T00:00:00Z',
        validUntil: nextYearAugust.toISOString(),
        workbookCount: 30,
        isFree: true,
      },
    ],
    features: {
      vividboardWall: true,
      vividboard: {
        active: true,
        validFrom: '2024-09-01T00:00:00Z',
        validUntil: nextYearAugust.toISOString(),
      },
    },
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'license-3',
    schoolId: 'school-3',
    subjects: [],
    features: {
      vividboardWall: true, // Vždy zdarma
    },
    updatedAt: new Date().toISOString(),
  }
];

// =============================================
// MOCK USAGE STATS (pro kolegy)
// =============================================

export const MOCK_USAGE_STATS: Record<string, { totalSessions: number; lastWeekSessions: number }> = {
  'profile-1': { totalSessions: 145, lastWeekSessions: 12 },
  'profile-2': { totalSessions: 89, lastWeekSessions: 8 },
  'profile-3': { totalSessions: 234, lastWeekSessions: 15 },
  'profile-4': { totalSessions: 67, lastWeekSessions: 5 },
};

// =============================================
// HELPER FUNCTIONS FOR MOCK DATA
// =============================================

export function getSchoolByCode(code: string): School | undefined {
  return MOCK_SCHOOLS.find(s => s.code.toUpperCase() === code.toUpperCase());
}

export function getSchoolById(id: string): School | undefined {
  return MOCK_SCHOOLS.find(s => s.id === id);
}

export function getProfileByUserId(userId: string): UserProfile | undefined {
  return MOCK_PROFILES.find(p => p.userId === userId);
}

export function getProfilesBySchoolId(schoolId: string): UserProfile[] {
  return MOCK_PROFILES.filter(p => p.schoolId === schoolId);
}

export function getLicenseBySchoolId(schoolId: string): SchoolLicense | undefined {
  return MOCK_LICENSES.find(l => l.schoolId === schoolId);
}

export function getColleagues(currentProfileId: string, schoolId: string): Colleague[] {
  const profiles = getProfilesBySchoolId(schoolId);
  return profiles
    .filter(p => p.id !== currentProfileId)
    .map(p => ({
      id: p.id,
      name: p.name,
      email: p.email,
      avatarUrl: p.avatarUrl,
      lastActiveAt: p.lastActiveAt,
      usageStats: MOCK_USAGE_STATS[p.id],
    }));
}

// =============================================
// LOCAL STORAGE KEYS (pro mock persistenci)
// =============================================

export const STORAGE_KEYS = {
  CURRENT_PROFILE: 'vividbooks_current_profile',
  SCHOOLS: 'vividbooks_schools',
  PROFILES: 'vividbooks_profiles',
  LICENSES: 'vividbooks_licenses',
};

// Initialize mock data in localStorage if not present
export function initializeMockData(): void {
  if (!localStorage.getItem(STORAGE_KEYS.SCHOOLS)) {
    localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(MOCK_SCHOOLS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.PROFILES)) {
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(MOCK_PROFILES));
  }
  if (!localStorage.getItem(STORAGE_KEYS.LICENSES)) {
    localStorage.setItem(STORAGE_KEYS.LICENSES, JSON.stringify(MOCK_LICENSES));
  }
}

// Get data from localStorage (with fallback to mock)
export function getStoredSchools(): School[] {
  const stored = localStorage.getItem(STORAGE_KEYS.SCHOOLS);
  return stored ? JSON.parse(stored) : MOCK_SCHOOLS;
}

export function getStoredProfiles(): UserProfile[] {
  const stored = localStorage.getItem(STORAGE_KEYS.PROFILES);
  return stored ? JSON.parse(stored) : MOCK_PROFILES;
}

export function getStoredLicenses(): SchoolLicense[] {
  const stored = localStorage.getItem(STORAGE_KEYS.LICENSES);
  return stored ? JSON.parse(stored) : MOCK_LICENSES;
}

// Save data to localStorage
export function saveSchools(schools: School[]): void {
  localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(schools));
}

export function saveProfiles(profiles: UserProfile[]): void {
  localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
}

export function saveLicenses(licenses: SchoolLicense[]): void {
  localStorage.setItem(STORAGE_KEYS.LICENSES, JSON.stringify(licenses));
}

