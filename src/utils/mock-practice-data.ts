import { 
  PracticeSubject, 
  PlayerProgress, 
  LeaderboardEntry,
  Achievement,
  ACHIEVEMENTS 
} from '../types/profile';

// =============================================
// MOCK DATA - PROCVIČOVÁNÍ MATEMATIKY 6. ROČNÍK
// =============================================

export const MOCK_PRACTICE_MATEMATIKA_6: PracticeSubject = {
  id: 'practice-mat-6',
  subject: 'matematika-2',
  subjectName: 'Matematika',
  grade: 6,
  totalXp: 2400,
  earnedXp: 485,
  chapters: [
    {
      id: 'ch-prevody',
      title: 'Pokročilé převody jednotek',
      isExpanded: true,
      topics: [
        {
          id: 'topic-zlomek',
          title: 'Zlomek',
          totalXp: 200,
          earnedXp: 150,
          progress: 75,
          exercises: [
            { id: 'ex-1', title: 'Zlomek 1', difficulty: 1, xpReward: 50, status: 'mastered', bestScore: 100, attempts: 3, lastAttemptAt: '2024-12-07' },
            { id: 'ex-2', title: 'Zlomek 2', difficulty: 2, xpReward: 75, status: 'completed', bestScore: 85, attempts: 2, lastAttemptAt: '2024-12-06' },
            { id: 'ex-3', title: 'Zlomek – slovní úlohy', difficulty: 2, xpReward: 75, status: 'in_progress', bestScore: 60, attempts: 1 },
            { id: 'ex-4', title: 'Zlomek 3', difficulty: 3, xpReward: 100, status: 'available', attempts: 0 },
          ]
        },
        {
          id: 'topic-rozsir',
          title: 'Rozšiřování a krácení zlomků',
          totalXp: 350,
          earnedXp: 125,
          progress: 36,
          exercises: [
            { id: 'ex-5', title: 'Rozšiřování a krácení 1', difficulty: 1, xpReward: 50, status: 'mastered', bestScore: 100, attempts: 2 },
            { id: 'ex-6', title: 'Základní tvar zlomku 1', difficulty: 1, xpReward: 50, status: 'completed', bestScore: 90, attempts: 1 },
            { id: 'ex-7', title: 'Rozšiřování a krácení 2', difficulty: 2, xpReward: 75, status: 'in_progress', bestScore: 45, attempts: 2 },
            { id: 'ex-8', title: 'Základní tvar zlomku 2', difficulty: 2, xpReward: 75, status: 'available', attempts: 0 },
            { id: 'ex-9', title: 'Rozšiřování a krácení 3', difficulty: 3, xpReward: 100, status: 'locked', attempts: 0 },
            { id: 'ex-10', title: 'Základní tvar zlomku 3', difficulty: 3, xpReward: 100, status: 'locked', attempts: 0 },
          ]
        },
        {
          id: 'topic-desetinne',
          title: 'Desetinné zlomky a desetinná čísla',
          totalXp: 350,
          earnedXp: 100,
          progress: 29,
          exercises: [
            { id: 'ex-11', title: 'Zápis desetinného čísla', difficulty: 1, xpReward: 50, status: 'completed', bestScore: 95, attempts: 1 },
            { id: 'ex-12', title: 'Zápis zlomku ve tvaru desetinného čísla', difficulty: 1, xpReward: 50, status: 'completed', bestScore: 80, attempts: 2 },
            { id: 'ex-13', title: 'Zápis desetinného čísla 2', difficulty: 2, xpReward: 75, status: 'available', attempts: 0 },
            { id: 'ex-14', title: 'Zápis zlomku ve tvaru 2', difficulty: 2, xpReward: 75, status: 'available', attempts: 0 },
            { id: 'ex-15', title: 'Zápis desetinného čísla 3', difficulty: 3, xpReward: 100, status: 'locked', attempts: 0 },
            { id: 'ex-16', title: 'Zápis zlomku ve tvaru 3', difficulty: 3, xpReward: 100, status: 'locked', attempts: 0 },
          ]
        },
        {
          id: 'topic-porovnavani',
          title: 'Porovnávání desetinných čísel',
          totalXp: 150,
          earnedXp: 0,
          progress: 0,
          exercises: [
            { id: 'ex-17', title: 'Porovnávání desetinných čísel', difficulty: 2, xpReward: 75, status: 'available', attempts: 0 },
            { id: 'ex-18', title: 'Porovnávání desetinných čísel 2', difficulty: 3, xpReward: 75, status: 'locked', attempts: 0 },
          ]
        },
      ]
    },
    {
      id: 'ch-prirozena',
      title: 'Práce s přirozenými čísly',
      isExpanded: false,
      topics: [
        {
          id: 'topic-scitani',
          title: 'Sčítání a odčítání',
          totalXp: 200,
          earnedXp: 110,
          progress: 55,
          exercises: [
            { id: 'ex-19', title: 'Sčítání 1', difficulty: 1, xpReward: 50, status: 'mastered', bestScore: 100, attempts: 1 },
            { id: 'ex-20', title: 'Odčítání 1', difficulty: 1, xpReward: 50, status: 'completed', bestScore: 85, attempts: 2 },
            { id: 'ex-21', title: 'Sčítání a odčítání 2', difficulty: 2, xpReward: 75, status: 'available', attempts: 0 },
            { id: 'ex-22', title: 'Sčítání a odčítání 3', difficulty: 3, xpReward: 100, status: 'locked', attempts: 0 },
          ]
        },
        {
          id: 'topic-nasobeni',
          title: 'Násobení a dělení',
          totalXp: 250,
          earnedXp: 0,
          progress: 0,
          exercises: [
            { id: 'ex-23', title: 'Násobení 1', difficulty: 1, xpReward: 50, status: 'available', attempts: 0 },
            { id: 'ex-24', title: 'Dělení 1', difficulty: 1, xpReward: 50, status: 'available', attempts: 0 },
            { id: 'ex-25', title: 'Násobení a dělení 2', difficulty: 2, xpReward: 75, status: 'locked', attempts: 0 },
            { id: 'ex-26', title: 'Násobení a dělení 3', difficulty: 3, xpReward: 100, status: 'locked', attempts: 0 },
          ]
        },
      ]
    },
    {
      id: 'ch-uhel',
      title: 'Úhel',
      isExpanded: false,
      topics: [
        {
          id: 'topic-mereni',
          title: 'Měření úhlů',
          totalXp: 200,
          earnedXp: 0,
          progress: 0,
          exercises: [
            { id: 'ex-27', title: 'Měření úhlů 1', difficulty: 1, xpReward: 50, status: 'available', attempts: 0 },
            { id: 'ex-28', title: 'Měření úhlů 2', difficulty: 2, xpReward: 75, status: 'locked', attempts: 0 },
            { id: 'ex-29', title: 'Měření úhlů 3', difficulty: 3, xpReward: 100, status: 'locked', attempts: 0 },
          ]
        },
      ]
    },
    {
      id: 'ch-operace',
      title: 'Početní operace s úhly',
      isExpanded: false,
      topics: []
    },
    {
      id: 'ch-soumernost',
      title: 'Osová a středová souměrnost',
      isExpanded: false,
      topics: []
    },
    {
      id: 'ch-bonus',
      title: 'Bonusová kapitola kombinatorika',
      isExpanded: false,
      topics: []
    },
  ]
};

// =============================================
// MOCK DATA - DALŠÍ PŘEDMĚTY
// =============================================

export const MOCK_PRACTICE_FYZIKA_6: PracticeSubject = {
  id: 'practice-fyz-6',
  subject: 'fyzika',
  subjectName: 'Fyzika',
  grade: 6,
  totalXp: 1800,
  earnedXp: 320,
  chapters: [
    {
      id: 'ch-telesa',
      title: 'Tělesa a látky',
      isExpanded: true,
      topics: [
        {
          id: 'topic-vlastnosti',
          title: 'Vlastnosti látek',
          totalXp: 200,
          earnedXp: 150,
          progress: 75,
          exercises: [
            { id: 'fyz-1', title: 'Vlastnosti látek 1', difficulty: 1, xpReward: 50, status: 'mastered', bestScore: 100, attempts: 2 },
            { id: 'fyz-2', title: 'Vlastnosti látek 2', difficulty: 2, xpReward: 75, status: 'completed', bestScore: 88, attempts: 1 },
            { id: 'fyz-3', title: 'Vlastnosti látek 3', difficulty: 3, xpReward: 100, status: 'in_progress', bestScore: 55, attempts: 2 },
          ]
        },
        {
          id: 'topic-mereni',
          title: 'Měření délky a objemu',
          totalXp: 200,
          earnedXp: 100,
          progress: 50,
          exercises: [
            { id: 'fyz-4', title: 'Měření délky', difficulty: 1, xpReward: 50, status: 'completed', bestScore: 92, attempts: 1 },
            { id: 'fyz-5', title: 'Měření objemu', difficulty: 2, xpReward: 75, status: 'completed', bestScore: 78, attempts: 2 },
            { id: 'fyz-6', title: 'Převody jednotek', difficulty: 3, xpReward: 100, status: 'available', attempts: 0 },
          ]
        },
      ]
    },
    {
      id: 'ch-sila',
      title: 'Síla a její účinky',
      isExpanded: false,
      topics: []
    },
  ]
};

// =============================================
// MOCK DATA - HRÁČŮV PROGRES
// =============================================

export const MOCK_PLAYER_PROGRESS: PlayerProgress = {
  totalXp: 1245,
  weeklyXp: 285,
  currentLevel: 5,
  currentStreak: 7,
  longestStreak: 14,
  lastPracticeDate: '2024-12-08',
  exercisesCompleted: 47,
  perfectScores: 8,
  achievements: ['streak-3', 'streak-7', 'xp-500', 'ex-10', 'first-exercise'],
  subjectProgress: {
    'matematika-1': 0,
    'prvouka': 0,
    'fyzika': 320,
    'chemie': 0,
    'prirodopis': 0,
    'matematika-2': 485,
  }
};

// =============================================
// MOCK DATA - ŽEBŘÍČEK
// =============================================

export const MOCK_LEADERBOARD_CLASS: LeaderboardEntry[] = [
  { rank: 1, name: 'Karolína Veselá', xp: 2150, level: 6, streak: 21, avatarUrl: undefined },
  { rank: 2, name: 'Tomáš Dvořák', xp: 1890, level: 6, streak: 15 },
  { rank: 3, name: 'Eliška Procházková', xp: 1650, level: 5, streak: 12 },
  { rank: 4, name: 'Jan Novák', xp: 1245, level: 5, streak: 7, isCurrentUser: true },
  { rank: 5, name: 'Petr Svoboda', xp: 1120, level: 5, streak: 5 },
  { rank: 6, name: 'Anna Králová', xp: 980, level: 4, streak: 3 },
  { rank: 7, name: 'Martin Černý', xp: 850, level: 4, streak: 0 },
  { rank: 8, name: 'Tereza Horáková', xp: 720, level: 4, streak: 2 },
  { rank: 9, name: 'Jakub Němec', xp: 580, level: 3, streak: 1 },
  { rank: 10, name: 'Lucie Marková', xp: 450, level: 3, streak: 0 },
];

export const MOCK_LEADERBOARD_SCHOOL: LeaderboardEntry[] = [
  { rank: 1, name: 'Matěj Kolář (8.B)', xp: 4520, level: 9, streak: 45 },
  { rank: 2, name: 'Sofie Pokorná (9.A)', xp: 4210, level: 9, streak: 38 },
  { rank: 3, name: 'Adam Růžička (7.C)', xp: 3890, level: 8, streak: 32 },
  { rank: 12, name: 'Karolína Veselá (6.A)', xp: 2150, level: 6, streak: 21 },
  { rank: 28, name: 'Jan Novák (6.A)', xp: 1245, level: 5, streak: 7, isCurrentUser: true },
];

// Žebříček České republiky - Matematická výzva
export const MOCK_LEADERBOARD_NATIONAL: LeaderboardEntry[] = [
  { rank: 1, name: 'Jakub Marek, ZŠ Vinohrady Praha', xp: 12450, level: 10, streak: 89 },
  { rank: 2, name: 'Tereza Havlíčková, ZŠ Brno-střed', xp: 11890, level: 10, streak: 76 },
  { rank: 3, name: 'Filip Ondráček, ZŠ Olomouc', xp: 11200, level: 10, streak: 82 },
  { rank: 4, name: 'Anna Sýkorová, ZŠ Plzeň', xp: 10850, level: 10, streak: 71 },
  { rank: 5, name: 'Martin Beneš, ZŠ Ostrava', xp: 10340, level: 10, streak: 65 },
  { rank: 6, name: 'Klára Novotná, ZŠ Hradec Králové', xp: 9920, level: 10, streak: 58 },
  { rank: 7, name: 'Vojtěch Černý, ZŠ České Budějovice', xp: 9540, level: 10, streak: 52 },
  { rank: 8, name: 'Eliška Procházková, ZŠ Liberec', xp: 9120, level: 9, streak: 49 },
  { rank: 9, name: 'Dominik Král, ZŠ Pardubice', xp: 8780, level: 9, streak: 44 },
  { rank: 10, name: 'Natálie Veselá, ZŠ Zlín', xp: 8450, level: 9, streak: 41 },
  { rank: 847, name: 'Jan Novák, ZŠ Dukelská Praha', xp: 1245, level: 5, streak: 7, isCurrentUser: true },
];

// Informace o aktuální sezóně Matematické výzvy
export const MATH_CHALLENGE_INFO = {
  seasonName: 'Matematická výzva 2024/25',
  seasonStart: '2024-09-01',
  seasonEnd: '2025-06-30',
  totalParticipants: 24563,
  totalSchools: 892,
  currentWeek: 14,
  totalWeeks: 40,
};

// =============================================
// DOSTUPNÉ ROČNÍKY PRO MATEMATICKOU VÝZVU
// =============================================

export const AVAILABLE_MATH_GRADES: { grade: number; name: string; progress: number; totalXp: number; earnedXp: number }[] = [
  { grade: 6, name: '6. ročník', progress: 20, totalXp: 2400, earnedXp: 485 },
  { grade: 7, name: '7. ročník', progress: 0, totalXp: 2800, earnedXp: 0 },
  { grade: 8, name: '8. ročník', progress: 0, totalXp: 3200, earnedXp: 0 },
  { grade: 9, name: '9. ročník', progress: 0, totalXp: 3600, earnedXp: 0 },
];

// =============================================
// HELPER FUNCTIONS
// =============================================

export function getUnlockedAchievements(progress: PlayerProgress): Achievement[] {
  return ACHIEVEMENTS.filter(a => progress.achievements.includes(a.id));
}

export function getNextAchievements(progress: PlayerProgress): Achievement[] {
  return ACHIEVEMENTS
    .filter(a => !progress.achievements.includes(a.id))
    .slice(0, 3);
}

export function getDifficultyColor(difficulty: 1 | 2 | 3): string {
  switch (difficulty) {
    case 1: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 2: return 'bg-amber-100 text-amber-700 border-amber-200';
    case 3: return 'bg-red-100 text-red-700 border-red-200';
  }
}

export function getStatusIcon(status: string): string {
  switch (status) {
    case 'mastered': return '⭐';
    case 'completed': return '✓';
    case 'in_progress': return '▶';
    case 'available': return '○';
    case 'locked': return '🔒';
    default: return '○';
  }
}

