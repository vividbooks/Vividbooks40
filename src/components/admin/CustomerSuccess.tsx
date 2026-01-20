/**
 * Customer Success Dashboard
 * 
 * Hlavní stránka pro Customer Success manažera
 * - Přehled: základní metriky
 * - Školy: seznam a detaily
 * - Upozornění: churn risk, upsell opportunities
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../utils/supabase/client';
import { useAlertAgent, Alert } from '../../hooks/useAlertAgent';
import { useAnalytics } from '../../hooks/useAnalytics';
import { calculateNPSScore, getNPSColor, getNPSBgColor } from '../../hooks/useNPS';
import * as profileStorage from '../../utils/profile-storage';
import { 
  LayoutDashboard, 
  Building2, 
  Bell,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Search,
  Filter,
  MoreVertical,
  Mail,
  Phone,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Target,
  Zap,
  Database,
  ToggleLeft,
  ToggleRight,
  Radio,
  GraduationCap,
  RefreshCw,
  Bot,
  Loader2,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  Minus,
  MessageSquare
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

// ============================================
// DEMO DATA
// ============================================

// Typy pro školy
interface TeacherDocument {
  id: string;
  name: string;
  type: 'vividbooks' | 'custom' | 'edited';
  lastAccessed: string;
  timeSpent: number; // v minutách
}

interface TeacherClass {
  id: string;
  name: string;
  studentCount: number;
  testsAssigned: number;
  filesShared: number;
}

interface Teacher {
  id: string;
  name: string;
  email: string;
  subject: string;
  monthlyAccess: number;
  lastActive: string;
  activityLevel: 'very_active' | 'active' | 'inactive';
  // Klíčové metriky
  accessLast30Days: number;
  timeSpentMinutes: number; // čas strávený v aplikaci (minuty) - celkem za 30 dní
  weeklyTimeMinutes: number[]; // čas strávený v aplikaci za posledních 50 týdnů (průměr za týden)
  aiCostCents: number; // útrata za AI v centech
  technologyAdoption: number; // 0-100 procento využití funkcí
  // Knihovna
  library: {
    documents: TeacherDocument[];
    worksheets: TeacherDocument[];
    vividboards: TeacherDocument[];
    usesConnectStudents: boolean;
    connectStudentsSessions: number;
    usesShareLinks: boolean;
    sharedLinksCount: number;
    usesAITeachMe: boolean;
    aiTeachMeSessions: number;
  };
  // Můj obsah
  myContent: {
    customDocuments: number;
    editedVividbooksDocuments: number;
    customVividboards: number;
    editedVividboards: number;
    customWorksheets: number;
    editedWorksheets: number;
    aiCreationUsage: number; // 0-100
    uploadedFiles: number;
    uploadedLinks: number;
    storageUsedMB: number;
  };
  // Výsledky / Moje třída
  classResults: {
    classes: TeacherClass[];
    testsPerMonth: number;
    hasCreatedClasses: boolean;
    sharesFilesWithClasses: boolean;
  };
}

interface Student {
  id: string;
  name: string;
  class: string;
  monthlyAccess: number;
  lastActive: string;
}

// Typy licencí předmětů
type SubjectTier = 'none' | 'workbooks' | 'digital-library';

interface SubjectLicense {
  subject: string;
  tier: SubjectTier;
  validUntil?: string;
  isFree?: boolean;
}

interface School {
  id: string;
  name: string;
  logo: string | null;
  schoolCode: string;
  studentCode: string;
  totalTeachers: number;
  activeTeachers: number;
  totalStudents: number;
  activeStudents: number;
  licenseExpiry: string;
  monthlyAICost: number;
  monthlyAccess: number;
  lastActivity: string;
  trend: 'up' | 'stable' | 'down';
  healthScore: number;
  activityLevel: 'very_active' | 'active' | 'inactive';
  contact: {
    name: string;
    email: string;
    phone: string;
  };
  // Licence předmětů (2. stupeň)
  subjectLicenses: SubjectLicense[];
  // Zakoupené nástroje
  hasEcosystemVividbooks: boolean;
  hasVividboard: boolean;
  hasVividboardWall: boolean; // zdarma
  aiRecommendation?: {
    type: 'warning' | 'opportunity' | 'info';
    title: string;
    description: string;
  };
  teachers: Teacher[];
  students: Student[];
}

// Generátor detailních dat učitele - musí být před DEMO_SCHOOLS
const generateTeacherDetails = (baseAccess: number, activityLevel: 'very_active' | 'active' | 'inactive'): Omit<Teacher, 'id' | 'name' | 'email' | 'subject' | 'monthlyAccess' | 'lastActive' | 'activityLevel'> => {
  const multiplier = activityLevel === 'very_active' ? 1.5 : activityLevel === 'active' ? 1 : 0.3;
  
  const generateDocuments = (count: number, prefix: string): TeacherDocument[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `${prefix}-${i}`,
      name: `${prefix === 'doc' ? 'Kapitola' : prefix === 'ws' ? 'Pracovní list' : 'Prezentace'} ${i + 1}`,
      type: Math.random() > 0.7 ? 'custom' : Math.random() > 0.5 ? 'edited' : 'vividbooks' as 'vividbooks' | 'custom' | 'edited',
      lastAccessed: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      timeSpent: Math.floor(Math.random() * 45 * multiplier) + 5
    }));
  };

  const generateClasses = (): TeacherClass[] => {
    const classCount = activityLevel === 'very_active' ? Math.floor(Math.random() * 3) + 2 : 
                       activityLevel === 'active' ? Math.floor(Math.random() * 2) + 1 : 
                       Math.random() > 0.5 ? 1 : 0;
    return Array.from({ length: classCount }, (_, i) => ({
      id: `class-${i}`,
      name: `${6 + i}.${String.fromCharCode(65 + i)}`,
      studentCount: Math.floor(Math.random() * 10) + 18,
      testsAssigned: Math.floor(Math.random() * 8 * multiplier),
      filesShared: Math.floor(Math.random() * 15 * multiplier)
    }));
  };

  // Generuj 50 týdnů dat s trendem (novější týdny mají vyšší hodnoty pro aktivní učitele)
  const generateWeeklyTime = (): number[] => {
    const weeks: number[] = [];
    const baseWeeklyTime = (30 + Math.random() * 60) * multiplier; // průměrný čas za týden v minutách
    for (let i = 0; i < 50; i++) {
      // Starší týdny (i=0) mají menší hodnoty, novější (i=49) vyšší
      const trendFactor = 0.6 + (i / 50) * 0.8; // od 0.6 do 1.4
      const seasonalVariation = Math.sin((i / 50) * Math.PI * 4) * 0.2; // sezónní výkyvy
      const randomVariation = 0.7 + Math.random() * 0.6; // náhodnost
      const weekTime = Math.floor(baseWeeklyTime * trendFactor * randomVariation * (1 + seasonalVariation));
      weeks.push(Math.max(0, weekTime));
    }
    return weeks;
  };

  const weeklyTimeMinutes = generateWeeklyTime();
  const totalTimeFromWeeks = weeklyTimeMinutes.slice(-4).reduce((a, b) => a + b, 0); // poslední 4 týdny = ~30 dní

  return {
    accessLast30Days: Math.floor(baseAccess * (0.8 + Math.random() * 0.4)),
    timeSpentMinutes: totalTimeFromWeeks,
    weeklyTimeMinutes,
    aiCostCents: Math.floor((50 + Math.random() * 500) * multiplier), // 0.50$ - 5.50$ za měsíc podle aktivity
    technologyAdoption: Math.min(100, Math.floor((40 + Math.random() * 50) * multiplier)),
    library: {
      documents: generateDocuments(Math.floor(5 * multiplier) + 2, 'doc'),
      worksheets: generateDocuments(Math.floor(4 * multiplier) + 1, 'ws'),
      vividboards: generateDocuments(Math.floor(3 * multiplier), 'vb'),
      usesConnectStudents: multiplier > 0.5,
      connectStudentsSessions: Math.floor(12 * multiplier),
      usesShareLinks: multiplier > 0.3,
      sharedLinksCount: Math.floor(25 * multiplier),
      usesAITeachMe: multiplier > 0.8,
      aiTeachMeSessions: Math.floor(8 * multiplier)
    },
    myContent: {
      customDocuments: Math.floor(Math.random() * 5 * multiplier),
      editedVividbooksDocuments: Math.floor(Math.random() * 12 * multiplier),
      customVividboards: Math.floor(Math.random() * 4 * multiplier),
      editedVividboards: Math.floor(Math.random() * 8 * multiplier),
      customWorksheets: Math.floor(Math.random() * 6 * multiplier),
      editedWorksheets: Math.floor(Math.random() * 10 * multiplier),
      aiCreationUsage: Math.min(100, Math.floor((20 + Math.random() * 60) * multiplier)),
      uploadedFiles: Math.floor(Math.random() * 15 * multiplier),
      uploadedLinks: Math.floor(Math.random() * 8 * multiplier),
      storageUsedMB: Math.floor((50 + Math.random() * 200) * multiplier)
    },
    classResults: {
      classes: generateClasses(),
      testsPerMonth: Math.floor(Math.random() * 6 * multiplier),
      hasCreatedClasses: multiplier > 0.5,
      sharesFilesWithClasses: multiplier > 0.4
    }
  };
};

const DEMO_SCHOOLS: School[] = [
  {
    id: '1',
    name: 'ZŠ Komenského, Praha 3',
    logo: null,
    schoolCode: 'VB-2024-001',
    studentCode: 'ZAK-001',
    totalTeachers: 28,
    activeTeachers: 24,
    totalStudents: 520,
    activeStudents: 445,
    licenseExpiry: '2026-08-31',
    monthlyAICost: 125.50,
    monthlyAccess: 4850,
    lastActivity: '2025-12-15T10:30:00',
    trend: 'up',
    healthScore: 92,
    activityLevel: 'very_active',
    contact: {
      name: 'Mgr. Jana Nováková',
      email: 'novakova@zskomenskeho.cz',
      phone: '+420 777 123 456'
    },
    subjectLicenses: [
      { subject: 'Fyzika', tier: 'digital-library', validUntil: '2026-08-31' },
      { subject: 'Chemie', tier: 'digital-library', validUntil: '2026-08-31' },
      { subject: 'Matematika', tier: 'digital-library', validUntil: '2026-08-31' },
      { subject: 'Přírodopis', tier: 'workbooks', validUntil: '2026-08-31', isFree: true },
      { subject: 'Zeměpis', tier: 'none' },
      { subject: 'Dějepis', tier: 'none' },
    ],
    hasEcosystemVividbooks: true,
    hasVividboard: true,
    hasVividboardWall: true,
    teachers: [
      { id: 't1', name: 'Mgr. Jana Nováková', email: 'novakova@zs.cz', subject: 'Fyzika', monthlyAccess: 145, lastActive: '2025-12-15T10:30:00', activityLevel: 'very_active', ...generateTeacherDetails(145, 'very_active') },
      { id: 't2', name: 'Ing. Pavel Černý', email: 'cerny@zs.cz', subject: 'Matematika', monthlyAccess: 132, lastActive: '2025-12-15T09:15:00', activityLevel: 'very_active', ...generateTeacherDetails(132, 'very_active') },
      { id: 't3', name: 'Mgr. Marie Svobodová', email: 'svobodova@zs.cz', subject: 'Chemie', monthlyAccess: 98, lastActive: '2025-12-14T14:20:00', activityLevel: 'active', ...generateTeacherDetails(98, 'active') },
      { id: 't4', name: 'PhDr. Jan Novák', email: 'novak@zs.cz', subject: 'Přírodopis', monthlyAccess: 67, lastActive: '2025-12-13T11:00:00', activityLevel: 'active', ...generateTeacherDetails(67, 'active') },
      { id: 't5', name: 'Bc. Lucie Malá', email: 'mala@zs.cz', subject: 'Fyzika', monthlyAccess: 12, lastActive: '2025-12-01T08:30:00', activityLevel: 'inactive', ...generateTeacherDetails(12, 'inactive') },
    ],
    students: [
      { id: 's1', name: 'Adam Horák', class: '8.A', monthlyAccess: 45, lastActive: '2025-12-15T10:00:00' },
      { id: 's2', name: 'Barbora Králová', class: '8.A', monthlyAccess: 38, lastActive: '2025-12-15T09:45:00' },
      { id: 's3', name: 'Cyril Dvořák', class: '7.B', monthlyAccess: 52, lastActive: '2025-12-14T15:30:00' },
    ]
  },
  {
    id: '2',
    name: 'Gymnázium Brno, Křenová',
    logo: null,
    schoolCode: 'VB-2024-002',
    studentCode: 'ZAK-002',
    totalTeachers: 45,
    activeTeachers: 32,
    totalStudents: 890,
    activeStudents: 620,
    licenseExpiry: '2025-06-15',
    monthlyAICost: 89.20,
    monthlyAccess: 3200,
    lastActivity: '2025-12-14T16:45:00',
    trend: 'stable',
    healthScore: 78,
    activityLevel: 'active',
    contact: {
      name: 'PhDr. Martin Svoboda',
      email: 'svoboda@gymkrenova.cz',
      phone: '+420 608 555 123'
    },
    subjectLicenses: [
      { subject: 'Fyzika', tier: 'digital-library', validUntil: '2025-06-15' },
      { subject: 'Chemie', tier: 'workbooks', validUntil: '2025-06-15', isFree: true },
      { subject: 'Přírodopis', tier: 'digital-library', validUntil: '2025-06-15' },
      { subject: 'Matematika', tier: 'none' },
      { subject: 'Zeměpis', tier: 'none' },
      { subject: 'Dějepis', tier: 'none' },
    ],
    hasEcosystemVividbooks: true,
    hasVividboard: false,
    hasVividboardWall: true,
    aiRecommendation: {
      type: 'info',
      title: 'Blížící se konec licence',
      description: 'Licence vyprší za 182 dní. Doporučujeme kontaktovat školu ohledně prodloužení.'
    },
    teachers: [
      { id: 't1', name: 'PhDr. Martin Svoboda', email: 'svoboda@gym.cz', subject: 'Fyzika', monthlyAccess: 89, lastActive: '2025-12-14T16:45:00', activityLevel: 'active', ...generateTeacherDetails(89, 'active') },
      { id: 't2', name: 'RNDr. Eva Kučerová', email: 'kucerova@gym.cz', subject: 'Chemie', monthlyAccess: 76, lastActive: '2025-12-14T14:00:00', activityLevel: 'active', ...generateTeacherDetails(76, 'active') },
      { id: 't3', name: 'Mgr. Tomáš Veselý', email: 'vesely@gym.cz', subject: 'Přírodopis', monthlyAccess: 23, lastActive: '2025-12-10T10:00:00', activityLevel: 'inactive', ...generateTeacherDetails(23, 'inactive') },
    ],
    students: [
      { id: 's1', name: 'David Němec', class: '2.A', monthlyAccess: 67, lastActive: '2025-12-14T15:00:00' },
      { id: 's2', name: 'Eliška Procházková', class: '3.B', monthlyAccess: 54, lastActive: '2025-12-14T14:30:00' },
    ]
  },
  {
    id: '3',
    name: 'ZŠ a MŠ Ostrava-Poruba',
    logo: null,
    schoolCode: 'VB-2024-003',
    studentCode: 'ZAK-003',
    totalTeachers: 22,
    activeTeachers: 8,
    totalStudents: 380,
    activeStudents: 95,
    licenseExpiry: '2025-03-01',
    monthlyAICost: 12.30,
    monthlyAccess: 320,
    lastActivity: '2025-12-10T09:15:00',
    trend: 'down',
    healthScore: 35,
    activityLevel: 'inactive',
    contact: {
      name: 'Ing. Petr Horák',
      email: 'horak@zsporuba.cz',
      phone: '+420 723 987 654'
    },
    subjectLicenses: [
      { subject: 'Fyzika', tier: 'workbooks', validUntil: '2025-03-01', isFree: true },
      { subject: 'Chemie', tier: 'none' },
      { subject: 'Přírodopis', tier: 'none' },
      { subject: 'Matematika', tier: 'none' },
      { subject: 'Zeměpis', tier: 'none' },
      { subject: 'Dějepis', tier: 'none' },
    ],
    hasEcosystemVividbooks: false,
    hasVividboard: false,
    hasVividboardWall: true,
    aiRecommendation: {
      type: 'warning',
      title: 'Kritický pokles aktivity',
      description: 'Aktivita klesla o 68% za posledních 30 dní. Doporučujeme urgentní kontakt s vedením školy.'
    },
    teachers: [
      { id: 't1', name: 'Ing. Petr Horák', email: 'horak@zs.cz', subject: 'Fyzika', monthlyAccess: 15, lastActive: '2025-12-10T09:15:00', activityLevel: 'inactive', ...generateTeacherDetails(15, 'inactive') },
      { id: 't2', name: 'Mgr. Anna Kovářová', email: 'kovarova@zs.cz', subject: 'Fyzika', monthlyAccess: 8, lastActive: '2025-12-05T11:00:00', activityLevel: 'inactive', ...generateTeacherDetails(8, 'inactive') },
    ],
    students: [
      { id: 's1', name: 'Filip Marek', class: '6.A', monthlyAccess: 12, lastActive: '2025-12-08T10:00:00' },
    ]
  },
  {
    id: '4',
    name: 'ZŠ Masarykova, Plzeň',
    logo: null,
    schoolCode: 'VB-2024-004',
    studentCode: 'ZAK-004',
    totalTeachers: 35,
    activeTeachers: 33,
    totalStudents: 650,
    activeStudents: 598,
    licenseExpiry: '2026-01-15',
    monthlyAICost: 156.80,
    monthlyAccess: 5890,
    lastActivity: '2025-12-15T11:00:00',
    trend: 'up',
    healthScore: 96,
    activityLevel: 'very_active',
    contact: {
      name: 'Mgr. Eva Procházková',
      email: 'prochazkova@zsmasaryk.cz',
      phone: '+420 602 333 444'
    },
    subjectLicenses: [
      { subject: 'Fyzika', tier: 'digital-library', validUntil: '2026-01-15' },
      { subject: 'Chemie', tier: 'digital-library', validUntil: '2026-01-15' },
      { subject: 'Matematika', tier: 'digital-library', validUntil: '2026-01-15' },
      { subject: 'Přírodopis', tier: 'digital-library', validUntil: '2026-01-15' },
      { subject: 'Zeměpis', tier: 'digital-library', validUntil: '2026-01-15' },
      { subject: 'Dějepis', tier: 'none' },
    ],
    hasEcosystemVividbooks: true,
    hasVividboard: true,
    hasVividboardWall: true,
    aiRecommendation: {
      type: 'opportunity',
      title: 'Příležitost pro upsell',
      description: 'Škola vykazuje excelentní metriky. Doporučujeme nabídnout rozšíření na Dějepis.'
    },
    teachers: [
      { id: 't1', name: 'Mgr. Eva Procházková', email: 'prochazkova@zs.cz', subject: 'Fyzika', monthlyAccess: 178, lastActive: '2025-12-15T11:00:00', activityLevel: 'very_active', ...generateTeacherDetails(178, 'very_active') },
      { id: 't2', name: 'RNDr. Karel Beneš', email: 'benes@zs.cz', subject: 'Chemie', monthlyAccess: 156, lastActive: '2025-12-15T10:30:00', activityLevel: 'very_active', ...generateTeacherDetails(156, 'very_active') },
      { id: 't3', name: 'Mgr. Petra Horáková', email: 'horakova@zs.cz', subject: 'Matematika', monthlyAccess: 143, lastActive: '2025-12-15T09:45:00', activityLevel: 'very_active', ...generateTeacherDetails(143, 'very_active') },
      { id: 't4', name: 'Ing. David Kříž', email: 'kriz@zs.cz', subject: 'Přírodopis', monthlyAccess: 98, lastActive: '2025-12-14T15:00:00', activityLevel: 'active', ...generateTeacherDetails(98, 'active') },
    ],
    students: [
      { id: 's1', name: 'Gabriela Šimková', class: '9.A', monthlyAccess: 89, lastActive: '2025-12-15T10:00:00' },
      { id: 's2', name: 'Hynek Poláček', class: '8.B', monthlyAccess: 76, lastActive: '2025-12-15T09:30:00' },
      { id: 's3', name: 'Ivana Růžičková', class: '7.A', monthlyAccess: 65, lastActive: '2025-12-14T14:00:00' },
    ]
  },
  {
    id: '5',
    name: 'Základní škola Liberec',
    logo: null,
    schoolCode: 'VB-2024-005',
    studentCode: 'ZAK-005',
    totalTeachers: 18,
    activeTeachers: 12,
    totalStudents: 290,
    activeStudents: 180,
    licenseExpiry: '2025-04-30',
    monthlyAICost: 34.50,
    monthlyAccess: 890,
    lastActivity: '2025-12-13T14:20:00',
    trend: 'stable',
    healthScore: 62,
    activityLevel: 'active',
    contact: {
      name: 'Bc. Tomáš Král',
      email: 'kral@zsliberec.cz',
      phone: '+420 739 111 222'
    },
    subjectLicenses: [
      { subject: 'Fyzika', tier: 'digital-library', validUntil: '2025-04-30' },
      { subject: 'Chemie', tier: 'workbooks', validUntil: '2025-04-30', isFree: true },
      { subject: 'Přírodopis', tier: 'none' },
      { subject: 'Matematika', tier: 'none' },
      { subject: 'Zeměpis', tier: 'none' },
      { subject: 'Dějepis', tier: 'none' },
    ],
    hasEcosystemVividbooks: false,
    hasVividboard: true,
    hasVividboardWall: true,
    teachers: [
      { id: 't1', name: 'Bc. Tomáš Král', email: 'kral@zs.cz', subject: 'Fyzika', monthlyAccess: 67, lastActive: '2025-12-13T14:20:00', activityLevel: 'active', ...generateTeacherDetails(67, 'active') },
      { id: 't2', name: 'Mgr. Lenka Marešová', email: 'maresova@zs.cz', subject: 'Chemie', monthlyAccess: 54, lastActive: '2025-12-12T11:00:00', activityLevel: 'active', ...generateTeacherDetails(54, 'active') },
    ],
    students: [
      { id: 's1', name: 'Jan Kučera', class: '6.B', monthlyAccess: 34, lastActive: '2025-12-13T13:00:00' },
      { id: 's2', name: 'Klára Novotná', class: '7.A', monthlyAccess: 28, lastActive: '2025-12-12T15:30:00' },
    ]
  }
];

const DEMO_ALERTS = [
  {
    id: '1',
    type: 'churn_risk',
    severity: 'high',
    schoolId: '3',
    schoolName: 'ZŠ a MŠ Ostrava-Poruba',
    title: 'Kritický pokles aktivity',
    description: 'Aktivita klesla o 68% za posledních 30 dní. Licence vyprší za 75 dní.',
    recommendation: 'Doporučujeme urgentní telefonát s ředitelem školy.',
    createdAt: '2025-12-14T08:00:00',
    status: 'new'
  },
  {
    id: '2',
    type: 'upsell',
    severity: 'medium',
    schoolId: '4',
    schoolName: 'ZŠ Masarykova, Plzeň',
    title: 'Příležitost pro upgrade',
    description: 'Škola využívá 95% kapacity. Vysoká spokojenost učitelů.',
    recommendation: 'Nabídnout rozšíření licence nebo AI balíček.',
    createdAt: '2025-12-13T14:30:00',
    status: 'new'
  },
  {
    id: '3',
    type: 'renewal',
    severity: 'medium',
    schoolId: '2',
    schoolName: 'Gymnázium Brno, Křenová',
    title: 'Blížící se konec licence',
    description: 'Licence vyprší za 182 dní. Dobrá aktivita, ale klesající trend.',
    recommendation: 'Naplánovat schůzku k prodloužení s nabídkou slevy za včasné obnovení.',
    createdAt: '2025-12-12T10:00:00',
    status: 'acknowledged'
  },
  {
    id: '4',
    type: 'engagement',
    severity: 'low',
    schoolId: '5',
    schoolName: 'Základní škola Liberec',
    title: 'Nevyužitý potenciál',
    description: 'Pouze 67% učitelů aktivně používá platformu.',
    recommendation: 'Nabídnout bezplatné školení pro neaktivní učitele.',
    createdAt: '2025-12-11T16:45:00',
    status: 'in_progress'
  }
];

const DEMO_METRICS = {
  totalSchools: 47,
  activeSchools: 42,
  totalTeachers: 892,
  activeTeachers: 756,
  totalStudents: 15840,
  activeStudents: 12450,
  monthlyRevenue: 28500,
  monthlyAICost: 4250,
  avgHealthScore: 74,
  churnRiskCount: 5,
  upsellOpportunities: 8
};

const ACTIVITY_TREND = [
  { date: 'Po', teachers: 680, students: 11200 },
  { date: 'Út', teachers: 720, students: 12100 },
  { date: 'St', teachers: 756, students: 12450 },
  { date: 'Čt', teachers: 710, students: 11800 },
  { date: 'Pá', teachers: 650, students: 10500 },
  { date: 'So', teachers: 120, students: 2100 },
  { date: 'Ne', teachers: 85, students: 1800 },
];

const HEALTH_DISTRIBUTION = [
  { name: 'Výborný (80-100)', value: 18, color: '#22c55e' },
  { name: 'Dobrý (60-79)', value: 15, color: '#3b82f6' },
  { name: 'Rizikový (40-59)', value: 9, color: '#f59e0b' },
  { name: 'Kritický (0-39)', value: 5, color: '#ef4444' },
];

// Aktivita škol - koláčový graf
const SCHOOL_ACTIVITY_DISTRIBUTION = [
  { name: 'Velmi aktivní', value: 18, color: '#22c55e' },
  { name: 'Aktivní', value: 21, color: '#3b82f6' },
  { name: 'Neaktivní', value: 8, color: '#ef4444' },
];

// Přístupy podle období
const ACCESS_DATA = {
  live: { students: 847, teachers: 156, schools: 38 },
  today: { students: 4250, teachers: 412, schools: 42 },
  week: { students: 12450, teachers: 756, schools: 45 },
  month: { students: 48200, teachers: 2890, schools: 47 },
  year: { students: 524000, teachers: 32400, schools: 47 },
};

// Vývoj aktivity škol za posledních 50 týdnů
const generateWeeklyActivityData = () => {
  const data = [];
  const now = new Date();
  
  for (let i = 49; i >= 0; i--) {
    const weekDate = new Date(now);
    weekDate.setDate(weekDate.getDate() - (i * 7));
    const weekNum = getWeekNumber(weekDate);
    
    // Simulace realistického vývoje s mírným růstem
    const baseVeryActive = 12 + Math.floor(i * 0.12); // Postupný růst
    const baseActive = 18 + Math.floor(Math.sin(i * 0.3) * 3); // Oscilace
    const baseInactive = Math.max(5, 12 - Math.floor(i * 0.1)); // Postupný pokles
    
    // Přidání náhodnosti
    const veryActive = Math.max(8, baseVeryActive + Math.floor(Math.random() * 4 - 2));
    const active = Math.max(12, baseActive + Math.floor(Math.random() * 6 - 3));
    const inactive = Math.max(3, baseInactive + Math.floor(Math.random() * 4 - 2));
    
    data.push({
      week: `T${weekNum}`,
      weekFull: `Týden ${weekNum}`,
      veryActive,
      active,
      inactive,
      total: veryActive + active + inactive
    });
  }
  
  return data;
};

// Vývoj používání funkcí učiteli za posledních 50 týdnů
const generateTeacherFeatureUsageData = () => {
  const data = [];
  const now = new Date();
  
  for (let i = 49; i >= 0; i--) {
    const weekDate = new Date(now);
    weekDate.setDate(weekDate.getDate() - (i * 7));
    const weekNum = getWeekNumber(weekDate);
    
    // Simulace realistického vývoje s růstem
    const growthFactor = 1 + (49 - i) * 0.015; // Postupný růst 1.5% týdně
    const seasonalFactor = 1 + Math.sin((i + 10) * 0.15) * 0.2; // Sezónní vlny
    
    // Základní hodnoty s růstem
    const documents = Math.round((120 + Math.random() * 40) * growthFactor * seasonalFactor);
    const worksheets = Math.round((80 + Math.random() * 30) * growthFactor * seasonalFactor);
    const vividboards = Math.round((45 + Math.random() * 20) * growthFactor * seasonalFactor);
    const aiUsage = Math.round((60 + Math.random() * 25) * growthFactor * seasonalFactor * 1.3); // AI roste rychleji
    
    data.push({
      week: `T${weekNum}`,
      weekFull: `Týden ${weekNum}`,
      documents,
      worksheets,
      vividboards,
      aiUsage,
    });
  }
  
  return data;
};

const TEACHER_FEATURE_USAGE_DATA = generateTeacherFeatureUsageData();

// Předměty z aplikace - pouze ty které máte
const APP_SUBJECTS = {
  // 2. stupeň
  'fyzika': { label: 'Fyzika', icon: '⚡', grade: 2, color: '#6366f1', baseValue: 180 },
  'chemie': { label: 'Chemie', icon: '🧪', grade: 2, color: '#f59e0b', baseValue: 120 },
  'prirodopis': { label: 'Přírodopis', icon: '🌿', grade: 2, color: '#ec4899', baseValue: 95 },
  'matematika2': { label: 'Matematika 2. st.', icon: '📐', grade: 2, color: '#22c55e', baseValue: 160 },
  // 1. stupeň
  'matematika1': { label: 'Matematika 1. st.', icon: '🔢', grade: 1, color: '#06b6d4', baseValue: 140 },
  'prvouka': { label: 'Prvouka', icon: '🏠', grade: 1, color: '#f97316', baseValue: 110 },
};

// Vývoj aktivity podle předmětů za posledních 50 týdnů
const generateSubjectActivityData = () => {
  const data = [];
  const now = new Date();
  
  for (let i = 49; i >= 0; i--) {
    const weekDate = new Date(now);
    weekDate.setDate(weekDate.getDate() - (i * 7));
    const weekNum = getWeekNumber(weekDate);
    
    // Simulace realistického vývoje s růstem pro každý předmět
    const growthFactor = 1 + (49 - i) * 0.012;
    const seasonalFactor = 1 + Math.sin((i + 8) * 0.12) * 0.15;
    
    const entry: Record<string, any> = {
      week: `T${weekNum}`,
      weekFull: `Týden ${weekNum}`,
    };
    
    // Generovat data pro všechny předměty
    Object.entries(APP_SUBJECTS).forEach(([key, subject]) => {
      entry[key] = Math.round((subject.baseValue + Math.random() * (subject.baseValue * 0.3)) * growthFactor * seasonalFactor);
    });
    
    data.push(entry);
  }
  
  return data;
};

const SUBJECT_ACTIVITY_DATA = generateSubjectActivityData();

// Demo NPS trend data
const generateDemoNPSTrend = () => {
  const data = [];
  const now = new Date();
  
  for (let i = 11; i >= 0; i--) {
    const weekDate = new Date(now);
    weekDate.setDate(weekDate.getDate() - (i * 7));
    const weekNum = getWeekNumber(weekDate);
    
    // NPS varies between 50-80 with some noise
    const baseNPS = 65;
    const trend = (11 - i) * 0.5; // Slight upward trend
    const noise = (Math.random() - 0.5) * 20;
    const npsScore = Math.round(baseNPS + trend + noise);
    
    data.push({
      week: `T${weekNum}`,
      nps_score: Math.min(100, Math.max(-100, npsScore)),
      responses: Math.round(10 + Math.random() * 15),
      avg_score: Math.round((7.5 + Math.random()) * 10) / 10,
    });
  }
  
  return data;
};

function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

const WEEKLY_ACTIVITY_DATA = generateWeeklyActivityData();

type TimePeriod = 'live' | 'today' | 'week' | 'month' | 'year';

// ============================================
// TYPES
// ============================================

type ActiveView = 'prehled' | 'skoly' | 'ucitele' | 'upozorneni';

// ============================================
// COMPONENT
// ============================================

export const CustomerSuccess: React.FC = () => {
  const [activeView, setActiveView] = useState<ActiveView>('prehled');
  const [selectedSchool, setSelectedSchool] = useState<typeof DEMO_SCHOOLS[0] | null>(null);
  const [selectedTeacherFromList, setSelectedTeacherFromList] = useState<(Teacher & { schoolId: string; schoolName: string }) | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [useDemoData, setUseDemoData] = useState(true);
  const [isLoadingLiveData, setIsLoadingLiveData] = useState(false);
  const [liveDataError, setLiveDataError] = useState<string | null>(null);
  
  // Live data from Supabase
  const [liveSchools, setLiveSchools] = useState<School[]>([]);
  const [liveTeachers, setLiveTeachers] = useState<Teacher[]>([]);

  // Analytics tracking
  const analytics = useAnalytics();

  // Fetch live data when switching to Supabase
  useEffect(() => {
    if (!useDemoData) {
      setIsLoadingLiveData(true);
      setLiveDataError(null);
      
      const fetchLiveData = async () => {
        try {
          // Fetch schools from the unified schools table (shared with License Admin)
          const { data: schoolsData, error: schoolsError } = await supabase
            .from('schools')
            .select('*')
            .order('created_at', { ascending: false });
          
          if (schoolsError) {
            if (schoolsError.code === '42P01' || schoolsError.message.includes('does not exist')) {
              setLiveDataError('Tabulka schools neexistuje. Spusťte SQL migraci 20241216_schools_licenses.sql');
            } else {
              setLiveDataError(`Chyba načítání škol: ${schoolsError.message}`);
            }
            return;
          }
          
          // Fetch licenses
          const { data: licensesData } = await supabase
            .from('school_licenses')
            .select('*');
          
          // Fetch teachers from Supabase
          const { data: teachersData } = await supabase
            .from('teachers')
            .select('*')
            .order('last_active', { ascending: false });
          
          // Fetch user_events for activity data (last 60 days for weekly charts)
          const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
          const { data: userEventsData, error: eventsError } = await supabase
            .from('user_events')
            .select('*')
            .gte('created_at', sixtyDaysAgo)
            .order('created_at', { ascending: false });
          
          console.log(`[CS] Loaded ${userEventsData?.length || 0} user events`, eventsError || '');
          
          // Aggregate events per user
          const userEventStats: Record<string, {
            documentsOpened: number;
            documentsCreated: number;
            worksheetsOpened: number;
            worksheetsCreated: number;
            vividboardsOpened: number;
            vividboardsCreated: number;
            aiTeachMeSessions: number;
            connectStudentSessions: number;
            shareLinksCreated: number;
            testsAssigned: number;
            filesUploaded: number;
            sessionCount: number;
            lastActivity: string;
            weeklyActivity: number[];
            // Document details for library view
            documentsList: Array<{ id: string; name: string; type: 'vividbooks' | 'custom' | 'edited'; lastAccessed: string; timeSpent: number }>;
            worksheetsList: Array<{ id: string; name: string; type: 'vividbooks' | 'custom' | 'edited'; lastAccessed: string; timeSpent: number }>;
            vividboardsList: Array<{ id: string; name: string; type: 'vividbooks' | 'custom' | 'edited'; lastAccessed: string; timeSpent: number }>;
          }> = {};
          
          if (userEventsData) {
            // Debug: show event types (support both event_type and event_name columns)
            const eventTypes = [...new Set(userEventsData.map((e: any) => e.event_type || e.event_name))];
            console.log('[CS] Event types found:', eventTypes);
            
            // Group events by user_id
            userEventsData.forEach((event: any) => {
              const userId = event.user_id;
              if (!userId) return;
              
              if (!userEventStats[userId]) {
                userEventStats[userId] = {
                  documentsOpened: 0,
                  documentsCreated: 0,
                  worksheetsOpened: 0,
                  worksheetsCreated: 0,
                  vividboardsOpened: 0,
                  vividboardsCreated: 0,
                  aiTeachMeSessions: 0,
                  connectStudentSessions: 0,
                  shareLinksCreated: 0,
                  testsAssigned: 0,
                  filesUploaded: 0,
                  sessionCount: 0,
                  lastActivity: event.created_at,
                  weeklyActivity: Array(50).fill(0),
                  documentsList: [],
                  worksheetsList: [],
                  vividboardsList: [],
                };
              }
              
              const stats = userEventStats[userId];
              const eventData = event.event_data || {};
              
              // Update last activity
              if (event.created_at > stats.lastActivity) {
                stats.lastActivity = event.created_at;
              }
              
              // Count events by type and track details (support both event_type and event_name)
              const eventType = event.event_type || event.event_name;
              switch (eventType) {
                case 'document_opened':
                  stats.documentsOpened++;
                  // Track document details
                  const docId = eventData.document_id || event.id;
                  const existingDoc = stats.documentsList.find(d => d.id === docId);
                  if (existingDoc) {
                    existingDoc.timeSpent += 2; // Add 2 minutes per view
                    if (event.created_at > existingDoc.lastAccessed) {
                      existingDoc.lastAccessed = event.created_at;
                    }
                  } else {
                    stats.documentsList.push({
                      id: docId,
                      name: eventData.subject || eventData.document_id || 'Dokument',
                      type: (eventData.document_type as 'vividbooks' | 'custom' | 'edited') || 'vividbooks',
                      lastAccessed: event.created_at,
                      timeSpent: 2,
                    });
                  }
                  break;
                case 'document_created':
                  stats.documentsCreated++;
                  break;
                case 'worksheet_opened':
                  stats.worksheetsOpened++;
                  const wsId = eventData.worksheet_id || event.id;
                  const existingWs = stats.worksheetsList.find(w => w.id === wsId);
                  if (existingWs) {
                    existingWs.timeSpent += 3;
                    if (event.created_at > existingWs.lastAccessed) {
                      existingWs.lastAccessed = event.created_at;
                    }
                  } else {
                    stats.worksheetsList.push({
                      id: wsId,
                      name: eventData.subject || 'Pracovní list',
                      type: 'vividbooks',
                      lastAccessed: event.created_at,
                      timeSpent: 3,
                    });
                  }
                  break;
                case 'worksheet_created':
                  stats.worksheetsCreated++;
                  break;
                case 'vividboard_opened':
                  stats.vividboardsOpened++;
                  const vbId = eventData.board_id || event.id;
                  const existingVb = stats.vividboardsList.find(v => v.id === vbId);
                  if (existingVb) {
                    existingVb.timeSpent += 3;
                    if (event.created_at > existingVb.lastAccessed) {
                      existingVb.lastAccessed = event.created_at;
                    }
                  } else {
                    stats.vividboardsList.push({
                      id: vbId,
                      name: eventData.subject || 'Vividboard',
                      type: 'vividbooks',
                      lastAccessed: event.created_at,
                      timeSpent: 3,
                    });
                  }
                  break;
                case 'vividboard_created':
                  stats.vividboardsCreated++;
                  break;
                case 'ai_teach_me_used':
                  stats.aiTeachMeSessions++;
                  break;
                case 'connect_students_session':
                  stats.connectStudentSessions++;
                  break;
                case 'share_link_created':
                  stats.shareLinksCreated++;
                  break;
                case 'test_assigned':
                  stats.testsAssigned++;
                  break;
                case 'file_uploaded':
                  stats.filesUploaded++;
                  break;
                case 'session_started':
                  stats.sessionCount++;
                  break;
              }
              
              // Calculate week index for weekly activity (0 = oldest, 49 = most recent)
              // Only count time for content-related events, not every event
              const eventDate = new Date(event.created_at);
              const now = new Date();
              const weeksDiff = Math.floor((now.getTime() - eventDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
              if (weeksDiff >= 0 && weeksDiff < 50) {
                // Add realistic time only for content events
                let timeToAdd = 0;
                if (eventType === 'document_opened') timeToAdd = 2;
                else if (eventType === 'worksheet_opened') timeToAdd = 3;
                else if (eventType === 'vividboard_opened') timeToAdd = 3;
                else if (eventType === 'session_started') timeToAdd = 1;
                // Don't count other events (page_viewed, etc.)
                
                stats.weeklyActivity[49 - weeksDiff] += timeToAdd;
              }
            });
            
            // Log aggregated stats for debugging
            const userIds = Object.keys(userEventStats);
            console.log(`[CS] Aggregated events for ${userIds.length} users:`, userIds.map(uid => ({
              userId: uid,
              docs: userEventStats[uid].documentsOpened,
              sessions: userEventStats[uid].sessionCount
            })));
          }
          
          // Transform Supabase data to match our School type
          if (schoolsData && schoolsData.length > 0) {
            const transformedSchools: School[] = schoolsData.map((s: any) => {
              const license = licensesData?.find((l: any) => l.school_id === s.id);
              const schoolTeachers = teachersData?.filter((t: any) => t.school_id === s.id) || [];
              const activeTeacherCount = schoolTeachers.filter((t: any) => 
                t.activity_level === 'active' || t.activity_level === 'very_active'
              ).length;
              
              // Calculate health score based on activity
              const healthScore = schoolTeachers.length === 0 ? 30 : 
                Math.min(100, 30 + Math.round((activeTeacherCount / schoolTeachers.length) * 70));
              
              // Get license expiry from subjects
              const subjectLicenses = license?.subjects || [];
              const latestExpiry = subjectLicenses.length > 0 
                ? subjectLicenses.reduce((max: string, sub: any) => 
                    sub.validUntil > max ? sub.validUntil : max, subjectLicenses[0]?.validUntil || '')
                : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
              
              return {
                id: s.id,
                name: s.name,
                logo: null,
                schoolCode: s.code || '',
                studentCode: (s.code || '') + 'S',
                totalTeachers: schoolTeachers.length,
                activeTeachers: activeTeacherCount,
                totalStudents: 0,
                activeStudents: 0,
                licenseExpiry: latestExpiry,
                monthlyAICost: 0,
                monthlyAccess: schoolTeachers.reduce((sum: number, t: any) => sum + (t.monthly_access || 0), 0),
                lastActivity: schoolTeachers[0]?.last_active || s.created_at,
                trend: 'stable' as const,
                healthScore,
                activityLevel: healthScore > 70 ? 'very_active' : healthScore > 40 ? 'active' : 'inactive' as const,
                contact: {
                  name: s.contact_name || '',
                  email: s.contact_email || '',
                  phone: s.contact_phone || '',
                  role: s.contact_role || '',
                },
                subjectLicenses: subjectLicenses.map((sub: any) => ({
                  subject: sub.subject,
                  tier: sub.tier,
                  validUntil: sub.validUntil,
                })),
                hasEcosystemVividbooks: license?.features?.ecosystemVividbooks?.active || license?.features?.ecosystemVividbooks === true || false,
                hasVividboard: license?.features?.vividboard?.active || license?.features?.vividboard === true || false,
                hasVividboardWall: license?.features?.vividboardWall || true,
                students: [], // No students data from Supabase yet
                teachers: schoolTeachers.map((t: any) => {
                  // Get user_events stats for this teacher (try multiple matching strategies)
                  // 1. Match by user_id field in teacher record
                  // 2. Match by teacher id
                  // 3. Match by email (search through all events)
                  // 4. Fallback: if only one user has events, use those (for single-teacher testing)
                  let eventStats = userEventStats[t.user_id] || userEventStats[t.id];
                  
                  // If no match, try to find by looking through events for matching email pattern
                  if (!eventStats && t.email && userEventsData) {
                    // Find events where school_id_text contains teacher email or id
                    const matchingUserId = Object.keys(userEventStats).find(uid => {
                      // Check if any event from this user has related data
                      const userEvents = userEventsData.filter((e: any) => e.user_id === uid);
                      return userEvents.some((e: any) => 
                        e.event_data?.user_email === t.email ||
                        e.event_data?.school_id_text?.includes(t.id)
                      );
                    });
                    if (matchingUserId) {
                      eventStats = userEventStats[matchingUserId];
                    }
                  }
                  
                  // Fallback: if there's only one user with events and this is a school's teacher, assign those events
                  if (!eventStats) {
                    const allUserIds = Object.keys(userEventStats);
                    if (allUserIds.length === 1) {
                      // Only one user has events - likely the current tester
                      eventStats = userEventStats[allUserIds[0]];
                      console.log(`[CS] Assigned events from user ${allUserIds[0]} to teacher ${t.name} (${t.id})`);
                      console.log(`[CS] eventStats:`, {
                        documentsOpened: eventStats.documentsOpened,
                        sessionCount: eventStats.sessionCount,
                        documentsList: eventStats.documentsList?.length,
                        weeklySum: eventStats.weeklyActivity?.reduce((a: number, b: number) => a + b, 0)
                      });
                    }
                  }
                  
                  // Fall back to empty stats
                  if (!eventStats) {
                    eventStats = {
                    documentsOpened: 0,
                    documentsCreated: 0,
                    worksheetsOpened: 0,
                    worksheetsCreated: 0,
                    vividboardsOpened: 0,
                    vividboardsCreated: 0,
                    aiTeachMeSessions: 0,
                    connectStudentSessions: 0,
                    shareLinksCreated: 0,
                    testsAssigned: 0,
                    filesUploaded: 0,
                    sessionCount: 0,
                    lastActivity: t.last_active || new Date().toISOString(),
                    weeklyActivity: Array(50).fill(0),
                    documentsList: [],
                    worksheetsList: [],
                    vividboardsList: [],
                  };
                  }
                  
                  // Calculate activity level based on recent activity
                  const totalActivity = eventStats.documentsOpened + eventStats.worksheetsOpened + eventStats.vividboardsOpened + eventStats.sessionCount;
                  const activityLevel = totalActivity > 20 ? 'very_active' : totalActivity > 5 ? 'active' : totalActivity > 0 ? 'low' : 'inactive';
                  
                  // Calculate time spent from actual document interactions
                  const docTime = (eventStats.documentsList || []).reduce((sum, d) => sum + d.timeSpent, 0);
                  const wsTime = (eventStats.worksheetsList || []).reduce((sum, w) => sum + w.timeSpent, 0);
                  const vbTime = (eventStats.vividboardsList || []).reduce((sum, v) => sum + v.timeSpent, 0);
                  // Time = document time + worksheet time + vividboard time + 1 min per session
                  const estimatedTimeMinutes = docTime + wsTime + vbTime + eventStats.sessionCount;
                  
                  return {
                    id: t.id,
                    name: t.name,
                    email: t.email || '',
                    avatar: t.avatar_url,
                    subject: t.subject || '',
                    monthlyAccess: t.monthly_access || eventStats.sessionCount,
                    lastActive: eventStats.lastActivity || t.last_active || new Date().toISOString(),
                    activityLevel: activityLevel as 'very_active' | 'active' | 'low' | 'inactive',
                    documentsCount: t.documents_count || eventStats.documentsOpened,
                    worksheetsCount: t.worksheets_count || eventStats.worksheetsOpened,
                    vividboardsCount: t.vividboards_count || eventStats.vividboardsOpened,
                    aiUsagePercent: t.ai_usage_percent || (eventStats.aiTeachMeSessions > 0 ? Math.min(100, eventStats.aiTeachMeSessions * 10) : 0),
                    storageUsedMB: t.storage_used_mb || 0,
                    classes: [],
                    documents: [],
                    // Detailed stats from user_events
                    weeklyTimeSpent: eventStats.weeklyActivity,
                    accessLast30Days: eventStats.sessionCount,
                    timeSpentMinutes: estimatedTimeMinutes,
                    weeklyTimeMinutes: eventStats.weeklyActivity,
                    aiCostCents: 0,
                    technologyAdoption: Math.min(100, Math.round(
                      ((eventStats.documentsOpened > 0 ? 20 : 0) +
                       (eventStats.worksheetsOpened > 0 ? 20 : 0) +
                       (eventStats.vividboardsOpened > 0 ? 20 : 0) +
                       (eventStats.aiTeachMeSessions > 0 ? 20 : 0) +
                       (eventStats.connectStudentSessions > 0 ? 20 : 0))
                    )),
                    adoption: {
                      currentAdoption: 0,
                      weeklyAdoption: Array(50).fill(0),
                    },
                    studentEngagement: {
                      testsAssigned: eventStats.testsAssigned,
                      filesShared: eventStats.shareLinksCreated,
                      averageClassScore: 0,
                      weeklyTestsTrend: Array(50).fill(0),
                    },
                    library: {
                      documents: eventStats.documentsList || [],
                      worksheets: eventStats.worksheetsList || [],
                      vividboards: eventStats.vividboardsList || [],
                      usesConnectStudents: eventStats.connectStudentSessions > 0,
                      connectStudentsSessions: eventStats.connectStudentSessions,
                      usesShareLinks: eventStats.shareLinksCreated > 0,
                      sharedLinksCount: eventStats.shareLinksCreated,
                      usesAITeachMe: eventStats.aiTeachMeSessions > 0,
                      aiTeachMeSessions: eventStats.aiTeachMeSessions,
                    },
                    myContent: {
                      customDocuments: eventStats.documentsCreated,
                      editedVividbooksDocuments: 0,
                      customVividboards: eventStats.vividboardsCreated,
                      editedVividboards: 0,
                      customWorksheets: eventStats.worksheetsCreated,
                      editedWorksheets: 0,
                      aiCreationUsage: 0,
                      uploadedFiles: eventStats.filesUploaded,
                      uploadedLinks: 0,
                      storageUsedMB: 0,
                    },
                    classResults: {
                      classes: [],
                      testsPerMonth: eventStats.testsAssigned,
                      hasCreatedClasses: false,
                      sharesFilesWithClasses: eventStats.shareLinksCreated > 0,
                    },
                  };
                }),
              };
            });
            
            setLiveSchools(transformedSchools);
            setLiveDataError(null);
            console.log(`✅ Loaded ${transformedSchools.length} schools from Supabase`);
          } else {
            setLiveDataError('Žádné školy v databázi. Přidejte školy ve Správě licencí nebo použijte demo režim.');
          }
        } catch (err) {
          console.error('Error fetching live data:', err);
          setLiveDataError('Chyba připojení k databázi');
        } finally {
          setIsLoadingLiveData(false);
        }
      };
      
      fetchLiveData();
    }
  }, [useDemoData]);

  // Use live data or demo data based on toggle
  const schools = useDemoData ? DEMO_SCHOOLS : (liveSchools.length > 0 ? liveSchools : DEMO_SCHOOLS);
  
  // Spočítej všechny učitele ze všech škol
  const allTeachers = schools.flatMap(school => 
    school.teachers.map(teacher => ({ ...teacher, schoolId: school.id, schoolName: school.name }))
  );

  const menuItems = [
    { id: 'prehled' as ActiveView, label: 'Přehled', icon: LayoutDashboard },
    { id: 'skoly' as ActiveView, label: 'Školy', icon: Building2, badge: schools.length },
    { id: 'ucitele' as ActiveView, label: 'Učitelé', icon: Users, badge: allTeachers.length },
    { id: 'upozorneni' as ActiveView, label: 'Upozornění', icon: Bell, badge: DEMO_ALERTS.filter(a => a.status === 'new').length },
  ];

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Left Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        {/* Logo/Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Target className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800">Customer Success</h1>
              <p className="text-xs text-slate-500">Vividbooks Dashboard</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {menuItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => {
                    setActiveView(item.id);
                    setSelectedSchool(null);
                    setSelectedTeacherFromList(null);
                    // Track view change
                    analytics.trackCSViewChanged(item.id as 'prehled' | 'skoly' | 'ucitele' | 'upozorneni');
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                    activeView === item.id
                      ? 'bg-indigo-50 text-indigo-700 font-medium'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      activeView === item.id
                        ? 'bg-indigo-200 text-indigo-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Demo Data Toggle */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={() => setUseDemoData(!useDemoData)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
              useDemoData 
                ? 'bg-amber-50 border border-amber-200' 
                : 'bg-green-50 border border-green-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <Database className={`h-5 w-5 ${useDemoData ? 'text-amber-600' : 'text-green-600'}`} />
              <div className="text-left">
                <p className={`text-sm font-medium ${useDemoData ? 'text-amber-700' : 'text-green-700'}`}>
                  {useDemoData ? 'Demo data' : 'Live data'}
                </p>
                <p className="text-xs text-slate-500">
                  {useDemoData ? 'Testovací režim' : 'Supabase'}
                </p>
              </div>
            </div>
            {useDemoData ? (
              <ToggleLeft className="h-6 w-6 text-amber-500" />
            ) : (
              <ToggleRight className="h-6 w-6 text-green-500" />
            )}
          </button>
        </div>

        {/* User/Footer */}
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50">
            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold text-indigo-600">CS</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">CS Manager</p>
              <p className="text-xs text-slate-500 truncate">vividbooks.cz</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Live Data Loading/Error State */}
        {!useDemoData && (isLoadingLiveData || liveDataError) && (
          <div className="p-8">
            <div className={`p-6 rounded-2xl border-2 ${liveDataError ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
              <div className="flex items-center gap-4">
                {isLoadingLiveData ? (
                  <>
                    <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
                    <div>
                      <p className="font-medium text-blue-800">Připojuji se k Supabase...</p>
                      <p className="text-sm text-blue-600">Načítám live data</p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-6 w-6 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-800">Live data nejsou dostupná</p>
                      <p className="text-sm text-amber-600">{liveDataError}</p>
                      <button 
                        onClick={() => setUseDemoData(true)}
                        className="mt-2 text-sm font-medium text-amber-700 underline hover:no-underline"
                      >
                        Přepnout zpět na demo data
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Show content with demo data or when live data is ready */}
        {(useDemoData || (!isLoadingLiveData && !liveDataError)) && (
          <>
            {activeView === 'prehled' && (
              <OverviewView 
                schools={schools} 
                useDemoData={useDemoData}
                metrics={DEMO_METRICS} 
                activityTrend={ACTIVITY_TREND} 
                healthDistribution={HEALTH_DISTRIBUTION} 
              />
            )}
            {activeView === 'skoly' && (
              <SchoolsView 
                schools={schools} 
                selectedSchool={selectedSchool}
                onSelectSchool={(school) => {
                  setSelectedSchool(school);
                  if (school) {
                    analytics.trackSchoolSelected(school.id, school.name, school.healthScore);
                  }
                }}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                alerts={DEMO_ALERTS}
                useDemoData={useDemoData}
              />
            )}
            {activeView === 'ucitele' && (
              <TeachersListView
                teachers={allTeachers}
                selectedTeacher={selectedTeacherFromList}
                onSelectTeacher={(teacher) => {
                  setSelectedTeacherFromList(teacher);
                  if (teacher) {
                    analytics.trackTeacherSelected(teacher.id, teacher.name, teacher.schoolId);
                  }
                }}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                useDemoData={useDemoData}
              />
            )}
            {activeView === 'upozorneni' && (
              <AlertsView alerts={DEMO_ALERTS} schools={schools} />
            )}
          </>
        )}
      </main>
    </div>
  );
};

// ============================================
// PŘEHLED VIEW
// ============================================

interface OverviewViewProps {
  schools: School[];
  useDemoData: boolean;
  metrics: typeof DEMO_METRICS;
  activityTrend: typeof ACTIVITY_TREND;
  healthDistribution: typeof HEALTH_DISTRIBUTION;
}

const OverviewView: React.FC<OverviewViewProps> = ({ schools, useDemoData, metrics, activityTrend, healthDistribution }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('today');
  const [weeklyFeatureData, setWeeklyFeatureData] = useState<any[]>([]);
  const [isLoadingFeatureData, setIsLoadingFeatureData] = useState(false);
  const [weeklySubjectData, setWeeklySubjectData] = useState<any[]>([]);
  const [isLoadingSubjectData, setIsLoadingSubjectData] = useState(false);
  const [npsData, setNpsData] = useState<any[]>([]);
  const [npsStats, setNpsStats] = useState<{ total: number; promoters: number; passives: number; detractors: number; npsScore: number; avgScore: number } | null>(null);
  const [isLoadingNPS, setIsLoadingNPS] = useState(false);

  // Fetch weekly feature usage data from Supabase
  useEffect(() => {
    if (!useDemoData) {
      setIsLoadingFeatureData(true);
      
      const fetchWeeklyStats = async () => {
        try {
          // Try the view first
          const { data, error } = await supabase
            .from('weekly_feature_stats')
            .select('*')
            .order('week_start', { ascending: true })
            .limit(50);
          
          if (error) {
            // View might not exist, try direct query on user_events
            console.log('weekly_feature_stats view not available, trying direct query');
            
            const { data: eventsData, error: eventsError } = await supabase
              .from('user_events')
              .select('event_type, created_at')
              .gte('created_at', new Date(Date.now() - 50 * 7 * 24 * 60 * 60 * 1000).toISOString());
            
            if (eventsError) {
              console.log('Could not fetch events:', eventsError);
              return;
            }
            
            // Aggregate events by week client-side
            const weeklyAggregates: Record<string, any> = {};
            
            (eventsData || []).forEach((event: any) => {
              const date = new Date(event.created_at);
              const weekStart = new Date(date);
              weekStart.setDate(date.getDate() - date.getDay());
              const weekKey = weekStart.toISOString().split('T')[0];
              const weekNum = Math.ceil((date.getDate() + new Date(date.getFullYear(), date.getMonth(), 1).getDay()) / 7);
              
              if (!weeklyAggregates[weekKey]) {
                weeklyAggregates[weekKey] = {
                  week_start: weekKey,
                  week: `T${weekNum}`,
                  documents: 0,
                  worksheets: 0,
                  vividboards: 0,
                  ai_usage: 0,
                };
              }
              
              if (['document_opened', 'document_created', 'document_time_spent'].includes(event.event_type)) {
                weeklyAggregates[weekKey].documents++;
              } else if (['worksheet_opened', 'worksheet_created', 'worksheet_completed'].includes(event.event_type)) {
                weeklyAggregates[weekKey].worksheets++;
              } else if (['vividboard_opened', 'vividboard_created'].includes(event.event_type)) {
                weeklyAggregates[weekKey].vividboards++;
              } else if (['ai_teach_me_used', 'ai_generation_completed', 'ai_alerts_generated', 'ai_email_generated'].includes(event.event_type)) {
                weeklyAggregates[weekKey].ai_usage++;
              }
            });
            
            const sortedData = Object.values(weeklyAggregates).sort((a: any, b: any) => 
              a.week_start.localeCompare(b.week_start)
            );
            
            setWeeklyFeatureData(sortedData);
          } else if (data && data.length > 0) {
            setWeeklyFeatureData(data.map((d: any) => ({
              week: d.week,
              documents: d.documents || 0,
              worksheets: d.worksheets || 0,
              vividboards: d.vividboards || 0,
              aiUsage: d.ai_usage || 0,
            })));
          }
        } catch (err) {
          console.error('Error fetching weekly feature data:', err);
        } finally {
          setIsLoadingFeatureData(false);
        }
      };
      
      fetchWeeklyStats();
    }
  }, [useDemoData]);

  // Fetch weekly subject access data from Supabase
  useEffect(() => {
    if (!useDemoData) {
      setIsLoadingSubjectData(true);
      
      const fetchWeeklySubjectStats = async () => {
        try {
          const { data, error } = await supabase
            .from('weekly_subject_stats')
            .select('*')
            .order('week_start', { ascending: true })
            .limit(50);
          
          if (error) {
            console.log('[CS] weekly_subject_stats view not available:', error.message);
            setWeeklySubjectData([]);
          } else if (data && data.length > 0) {
            console.log(`[CS] ✅ Loaded ${data.length} weeks of subject data`);
            setWeeklySubjectData(data);
          } else {
            console.log('[CS] No subject data yet - tracking will populate this');
            setWeeklySubjectData([]);
          }
        } catch (err) {
          console.error('[CS] Error fetching subject stats:', err);
          setWeeklySubjectData([]);
        } finally {
          setIsLoadingSubjectData(false);
        }
      };
      
      fetchWeeklySubjectStats();
    }
  }, [useDemoData]);

  const hasLiveSubjectData = weeklySubjectData.length > 0;

  // Fetch NPS data from Supabase
  useEffect(() => {
    if (!useDemoData) {
      setIsLoadingNPS(true);
      
      const fetchNPSData = async () => {
        try {
          // Fetch weekly NPS trend
          const { data: trendData, error: trendError } = await supabase
            .from('nps_weekly_trend')
            .select('*')
            .order('week_start', { ascending: true })
            .limit(52);
          
          if (!trendError && trendData) {
            setNpsData(trendData);
          }

          // Fetch overall stats
          const { data: statsData, error: statsError } = await supabase
            .from('nps_responses')
            .select('score, category');
          
          if (!statsError && statsData && statsData.length > 0) {
            const promoters = statsData.filter(r => r.category === 'promoter').length;
            const passives = statsData.filter(r => r.category === 'passive').length;
            const detractors = statsData.filter(r => r.category === 'detractor').length;
            const total = statsData.length;
            const avgScore = statsData.reduce((sum, r) => sum + r.score, 0) / total;
            const npsScore = Math.round((promoters / total * 100) - (detractors / total * 100));
            
            setNpsStats({ total, promoters, passives, detractors, npsScore, avgScore: Math.round(avgScore * 10) / 10 });
          }
        } catch (err) {
          console.error('[CS] Error fetching NPS data:', err);
        } finally {
          setIsLoadingNPS(false);
        }
      };
      
      fetchNPSData();
    }
  }, [useDemoData]);

  const hasLiveNPSData = npsData.length > 0 || npsStats !== null;

  // Calculate live metrics from schools
  const liveMetrics = {
    totalSchools: schools.length,
    activeSchools: schools.filter(s => s.activityLevel === 'very_active' || s.activityLevel === 'active').length,
    totalTeachers: schools.reduce((sum, s) => sum + (s.totalTeachers || 0), 0),
    activeTeachers: schools.reduce((sum, s) => sum + (s.activeTeachers || 0), 0),
    totalStudents: schools.reduce((sum, s) => sum + (s.totalStudents || 0), 0),
    activeStudents: schools.reduce((sum, s) => sum + (s.activeStudents || 0), 0),
    monthlyAccess: schools.reduce((sum, s) => sum + (s.monthlyAccess || 0), 0),
  };
  
  // Use live feature data if available
  const hasLiveFeatureData = !useDemoData && weeklyFeatureData.length > 0;

  // Calculate live health distribution
  const liveHealthDistribution = [
    { name: 'Velmi aktivní', value: schools.filter(s => s.activityLevel === 'very_active').length, color: '#22c55e' },
    { name: 'Aktivní', value: schools.filter(s => s.activityLevel === 'active').length, color: '#3b82f6' },
    { name: 'Neaktivní', value: schools.filter(s => s.activityLevel === 'low' || s.activityLevel === 'inactive').length, color: '#ef4444' },
  ];

  // Use live data when not in demo mode and we have schools
  const displayMetrics = useDemoData ? metrics : liveMetrics;
  const displayHealthDistribution = useDemoData ? healthDistribution : liveHealthDistribution;

  const periods: { id: TimePeriod; label: string }[] = [
    { id: 'live', label: 'Live' },
    { id: 'today', label: 'Dnes' },
    { id: 'week', label: 'Tento týden' },
    { id: 'month', label: 'Tento měsíc' },
    { id: 'year', label: 'Tento rok' },
  ];

  // Use live data when not in demo mode, otherwise use ACCESS_DATA
  const liveAccessData = {
    students: liveMetrics.activeStudents || liveMetrics.monthlyAccess,
    teachers: liveMetrics.activeTeachers,
    schools: liveMetrics.activeSchools,
  };
  
  const currentAccess = useDemoData ? ACCESS_DATA[selectedPeriod] : liveAccessData;

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Přehled</h2>
          <p className="text-slate-500">Základní metriky a stav portfolia škol</p>
        </div>
        {!useDemoData && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live data ({schools.length} {schools.length === 1 ? 'škola' : schools.length < 5 ? 'školy' : 'škol'})
          </div>
        )}
      </div>

      {/* First Row - Key Metrics + Period Switcher */}
      <div className="flex flex-row gap-6 mb-8">
        {/* Key Metrics - Schools & Teachers Count */}
        <div className="w-[200px] flex-shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="text-center">
              <p className="text-4xl font-bold text-indigo-600">
                {useDemoData ? metrics.totalSchools : schools.length}
              </p>
              <p className="text-sm text-slate-500 mt-1">Škol</p>
            </div>
            <div className="w-full h-px bg-slate-200" />
            <div className="text-center">
              <p className="text-4xl font-bold text-green-600">
                {useDemoData ? metrics.totalTeachers : liveMetrics.totalTeachers}
              </p>
              <p className="text-sm text-slate-500 mt-1">Učitelů</p>
            </div>
          </div>
        </div>

        {/* Period Switcher Panel */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 p-4 border-b border-slate-100">
            {periods.map((period) => (
              <button
                key={period.id}
                onClick={() => setSelectedPeriod(period.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedPeriod === period.id
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                } ${period.id === 'live' && selectedPeriod === 'live' ? 'animate-pulse' : ''}`}
              >
                {period.id === 'live' && (
                  <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse" />
                )}
                {period.label}
              </button>
            ))}
          </div>

          {/* Access Stats */}
          <div className="flex flex-row">
            <div className="flex-1 p-6 text-center border-r border-slate-100">
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <GraduationCap className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-800 mb-1">
                {currentAccess.students.toLocaleString('cs-CZ')}
              </p>
              <p className="text-sm text-slate-500">Přístupy studentů</p>
            </div>
            <div className="flex-1 p-6 text-center border-r border-slate-100">
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <Users className="h-6 w-6 text-indigo-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-800 mb-1">
                {currentAccess.teachers.toLocaleString('cs-CZ')}
              </p>
              <p className="text-sm text-slate-500">Přístupy učitelů</p>
            </div>
            <div className="flex-1 p-6 text-center">
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-800 mb-1">
                {currentAccess.schools.toLocaleString('cs-CZ')}
              </p>
              <p className="text-sm text-slate-500">Aktivních škol</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row - Activity Distribution - HORIZONTAL */}
      <div className="flex flex-row gap-6 mb-8">
        {/* Pie Chart - School Activity Distribution */}
        <div className="w-[320px] flex-shrink-0 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4">Aktivita škol</h3>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={displayHealthDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {displayHealthDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [`${value} škol`, '']}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-4">
            {displayHealthDistribution.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600">{item.name}</span>
                </div>
                <span className="font-bold text-slate-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bar Chart - Weekly Activity Trend (50 weeks) */}
        <div className="flex-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-2">Vývoj aktivity škol</h3>
          <p className="text-sm text-slate-500 mb-4">
            {useDemoData ? 'Posledních 50 týdnů' : 'Aktuální stav'}
          </p>
          
          {useDemoData ? (
            <>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={WEEKLY_ACTIVITY_DATA} barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="week" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 9 }}
                      interval={9}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      width={30}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        borderRadius: '12px', 
                        border: 'none', 
                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                        padding: '12px 16px'
                      }}
                      labelFormatter={(label) => `Týden ${String(label).replace('T', '')}`}
                    />
                    <Bar dataKey="veryActive" stackId="a" fill="#22c55e" name="Velmi aktivní" />
                    <Bar dataKey="active" stackId="a" fill="#3b82f6" name="Aktivní" />
                    <Bar dataKey="inactive" stackId="a" fill="#ef4444" name="Neaktivní" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-slate-600">Velmi aktivní</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-slate-600">Aktivní</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-slate-600">Neaktivní</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-[280px] text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <TrendingUp className="w-8 h-8 text-slate-400" />
              </div>
              <h4 className="font-medium text-slate-700 mb-2">Historická data se sbírají</h4>
              <p className="text-sm text-slate-500 max-w-xs">
                Graf vývoje aktivity se zobrazí jakmile budou k dispozici data za více období.
                Aktuálně máte {schools.length} {schools.length === 1 ? 'školu' : schools.length < 5 ? 'školy' : 'škol'}.
              </p>
              <div className="flex gap-4 mt-4">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-slate-600">{liveMetrics.activeSchools} aktivních</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-slate-600">{schools.length - liveMetrics.activeSchools} neaktivních</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Charts Row - Feature Usage & Subject Activity */}
      <div className="flex flex-row gap-6 mb-8">
        {/* Teacher Feature Usage Chart */}
        <div className="flex-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-800">Používání funkcí učiteli</h3>
            <p className="text-sm text-slate-500">
              {useDemoData ? 'Posledních 50 týdnů' : hasLiveFeatureData ? `Posledních ${weeklyFeatureData.length} týdnů` : 'Aktuální stav'}
            </p>
          </div>
          {!useDemoData && hasLiveFeatureData && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              <Database className="w-3 h-3" />
              Live data
            </div>
          )}
          {!useDemoData && !hasLiveFeatureData && !isLoadingFeatureData && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
              <Clock className="w-3 h-3" />
              Data se sbírají
            </div>
          )}
        </div>
        
        {(useDemoData || hasLiveFeatureData) ? (
          <>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hasLiveFeatureData ? weeklyFeatureData : TEACHER_FEATURE_USAGE_DATA}>
                  <defs>
                    <linearGradient id="colorDocuments" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorWorksheets" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorVividboards" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorAI" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="week" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 9 }}
                    interval={9}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    width={40}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                      padding: '12px 16px'
                    }}
                    labelFormatter={(label) => `Týden ${String(label).replace('T', '')}`}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="documents" 
                    stroke="#6366f1" 
                    strokeWidth={2}
                    fill="url(#colorDocuments)" 
                    name="Dokumenty"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="worksheets" 
                    stroke="#22c55e" 
                    strokeWidth={2}
                    fill="url(#colorWorksheets)" 
                    name="Pracovní listy"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="vividboards" 
                    stroke="#f59e0b" 
                    strokeWidth={2}
                    fill="url(#colorVividboards)" 
                    name="Vividboardy"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="aiUsage" 
                    stroke="#ec4899" 
                    strokeWidth={2}
                    fill="url(#colorAI)" 
                    name="AI funkce"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-indigo-500" />
                <span className="text-slate-600">Dokumenty</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-slate-600">Pracovní listy</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-slate-600">Vividboardy</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-pink-500" />
                <span className="text-slate-600">AI funkce</span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-[300px] text-center">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-indigo-400" />
            </div>
            <h4 className="font-medium text-slate-700 mb-2">Sledování používání funkcí</h4>
            <p className="text-sm text-slate-500 max-w-md mb-4">
              Graf používání funkcí učiteli se zobrazí jakmile budou k dispozici analytická data.
              Sledujeme: dokumenty, pracovní listy, vividboardy a AI funkce.
            </p>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 bg-indigo-50 rounded-lg">
                <div className="text-lg font-bold text-indigo-600">
                  {schools.reduce((sum, s) => sum + s.teachers.reduce((t, teacher) => t + (teacher.documentsCount || 0), 0), 0)}
                </div>
                <div className="text-xs text-slate-500">Dokumenty</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-lg font-bold text-green-600">
                  {schools.reduce((sum, s) => sum + s.teachers.reduce((t, teacher) => t + (teacher.worksheetsCount || 0), 0), 0)}
                </div>
                <div className="text-xs text-slate-500">Pracovní listy</div>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <div className="text-lg font-bold text-amber-600">
                  {schools.reduce((sum, s) => sum + s.teachers.reduce((t, teacher) => t + (teacher.vividboardsCount || 0), 0), 0)}
                </div>
                <div className="text-xs text-slate-500">Vividboardy</div>
              </div>
              <div className="text-center p-3 bg-pink-50 rounded-lg">
                <div className="text-lg font-bold text-pink-600">
                  {schools.reduce((sum, s) => sum + s.teachers.reduce((t, teacher) => t + (teacher.aiUsagePercent || 0), 0), 0)}%
                </div>
                <div className="text-xs text-slate-500">AI využití</div>
              </div>
            </div>
          </div>
        )}
        </div>

        {/* Subject Activity Chart */}
        <div className="flex-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800">Aktivita podle předmětů</h3>
              <p className="text-sm text-slate-500">
                {useDemoData ? 'Posledních 50 týdnů' : hasLiveSubjectData ? `Posledních ${weeklySubjectData.length} týdnů` : 'Data se sbírají'}
              </p>
            </div>
            {!useDemoData && hasLiveSubjectData && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                <Database className="w-3 h-3" />
                Live data
              </div>
            )}
            {!useDemoData && !hasLiveSubjectData && !isLoadingSubjectData && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                <Clock className="w-3 h-3" />
                Data se sbírají
              </div>
            )}
          </div>
        
        {/* Show empty state in live mode when no data, otherwise show chart */}
        {!useDemoData && !hasLiveSubjectData && !isLoadingSubjectData ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-center">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4">
              <Clock className="w-8 h-8 text-amber-400" />
            </div>
            <h4 className="font-medium text-slate-700 mb-2">Data se sbírají</h4>
            <p className="text-sm text-slate-500 max-w-xs">
              Jakmile učitelé začnou procházet předměty, data se zde zobrazí.
            </p>
          </div>
        ) : (
          <>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={useDemoData ? SUBJECT_ACTIVITY_DATA : weeklySubjectData}>
                  <defs>
                    {Object.entries(APP_SUBJECTS).map(([key, subject]) => (
                      <linearGradient key={key} id={`colorSubject_${key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={subject.color} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={subject.color} stopOpacity={0}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="week" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 9 }}
                    interval={9}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    width={40}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                      padding: '12px 16px'
                    }}
                    labelFormatter={(label) => `Týden ${String(label).replace('T', '')}`}
                  />
                  {Object.entries(APP_SUBJECTS).map(([key, subject]) => (
                    <Area 
                      key={key}
                      type="monotone" 
                      dataKey={key} 
                      stroke={subject.color} 
                      strokeWidth={2}
                      fill={`url(#colorSubject_${key})`} 
                      name={subject.label}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {/* Legend - split by grade */}
            <div className="mt-4">
              <div className="flex flex-wrap justify-center gap-3 mb-2">
                <span className="text-xs font-medium text-slate-400 mr-2">2. stupeň:</span>
                {Object.entries(APP_SUBJECTS).filter(([_, s]) => s.grade === 2).map(([key, subject]) => (
                  <div key={key} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: subject.color }} />
                    <span className="text-slate-600">{subject.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <span className="text-xs font-medium text-slate-400 mr-2">1. stupeň:</span>
                {Object.entries(APP_SUBJECTS).filter(([_, s]) => s.grade === 1).map(([key, subject]) => (
                  <div key={key} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: subject.color }} />
                    <span className="text-slate-600">{subject.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        </div>
      </div>

      {/* NPS Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-slate-800">Net Promoter Score (NPS)</h3>
            <p className="text-sm text-slate-500">
              {useDemoData ? 'Demo data' : hasLiveNPSData ? 'Zpětná vazba od učitelů' : 'Čekáme na odpovědi'}
            </p>
          </div>
          {!useDemoData && hasLiveNPSData && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              <Database className="w-3 h-3" />
              Live data
            </div>
          )}
        </div>

        {/* NPS Content */}
        {!useDemoData && !hasLiveNPSData && !isLoadingNPS ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-center">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-amber-400" />
            </div>
            <h4 className="font-medium text-slate-700 mb-2">Zatím žádné NPS odpovědi</h4>
            <p className="text-sm text-slate-500 max-w-xs">
              Učitelé budou dotázáni na NPS každých 30 dní.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-6">
            {/* NPS Score */}
            <div className="col-span-1">
              <div className={`text-center p-6 rounded-xl ${
                useDemoData || !npsStats 
                  ? 'bg-green-50' 
                  : npsStats.npsScore >= 50 ? 'bg-green-50' : npsStats.npsScore >= 0 ? 'bg-amber-50' : 'bg-red-50'
              }`}>
                <p className={`text-5xl font-bold mb-2 ${
                  useDemoData || !npsStats 
                    ? 'text-green-600' 
                    : npsStats.npsScore >= 50 ? 'text-green-600' : npsStats.npsScore >= 0 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {useDemoData ? '+72' : npsStats ? (npsStats.npsScore >= 0 ? '+' : '') + npsStats.npsScore : '—'}
                </p>
                <p className="text-sm text-slate-600 font-medium">NPS Skóre</p>
                <p className="text-xs text-slate-500 mt-1">
                  {useDemoData ? 'Výborné' : npsStats ? (npsStats.npsScore >= 50 ? 'Výborné' : npsStats.npsScore >= 0 ? 'Dobré' : 'Potřebuje zlepšení') : '—'}
                </p>
              </div>
              
              <div className="mt-4 text-center">
                <p className="text-2xl font-bold text-slate-800">
                  {useDemoData ? '8.4' : npsStats?.avgScore || '—'}
                </p>
                <p className="text-xs text-slate-500">Průměrné hodnocení</p>
              </div>
            </div>

            {/* Distribution */}
            <div className="col-span-1">
              <div className="space-y-4">
                {/* Promoters */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <ThumbsUp className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-slate-700">Promotéři (9-10)</span>
                    </div>
                    <span className="text-sm font-bold text-green-600">
                      {useDemoData ? '68%' : npsStats ? Math.round(npsStats.promoters / npsStats.total * 100) + '%' : '—'}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 rounded-full transition-all duration-500"
                      style={{ width: useDemoData ? '68%' : npsStats ? `${npsStats.promoters / npsStats.total * 100}%` : '0%' }}
                    />
                  </div>
                </div>

                {/* Passives */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Minus className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-medium text-slate-700">Pasivní (7-8)</span>
                    </div>
                    <span className="text-sm font-bold text-amber-600">
                      {useDemoData ? '24%' : npsStats ? Math.round(npsStats.passives / npsStats.total * 100) + '%' : '—'}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 rounded-full transition-all duration-500"
                      style={{ width: useDemoData ? '24%' : npsStats ? `${npsStats.passives / npsStats.total * 100}%` : '0%' }}
                    />
                  </div>
                </div>

                {/* Detractors */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <ThumbsDown className="w-4 h-4 text-red-600" />
                      <span className="text-sm font-medium text-slate-700">Kritici (0-6)</span>
                    </div>
                    <span className="text-sm font-bold text-red-600">
                      {useDemoData ? '8%' : npsStats ? Math.round(npsStats.detractors / npsStats.total * 100) + '%' : '—'}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-red-500 rounded-full transition-all duration-500"
                      style={{ width: useDemoData ? '8%' : npsStats ? `${npsStats.detractors / npsStats.total * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-500 text-center">
                  Celkem odpovědí: <span className="font-medium text-slate-700">{useDemoData ? '156' : npsStats?.total || 0}</span>
                </p>
              </div>
            </div>

            {/* NPS Trend Chart */}
            <div className="col-span-2">
              <p className="text-sm font-medium text-slate-600 mb-3">Vývoj NPS</p>
              {useDemoData || npsData.length > 0 ? (
                <div style={{ width: '100%', height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={useDemoData ? generateDemoNPSTrend() : npsData}>
                      <defs>
                        <linearGradient id="colorNPS" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="week" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        interval={4}
                      />
                      <YAxis 
                        domain={[-100, 100]}
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        width={35}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '12px', 
                          border: 'none', 
                          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                          padding: '12px 16px'
                        }}
                        formatter={(value: number) => [`NPS: ${value >= 0 ? '+' : ''}${value}`, '']}
                        labelFormatter={(label) => `Týden ${String(label).replace('T', '')}`}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="nps_score" 
                        stroke="#22c55e" 
                        strokeWidth={2}
                        fill="url(#colorNPS)" 
                        name="NPS"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[180px] text-slate-400 text-sm">
                  Data budou k dispozici po nasbírání odpovědí
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-6">
        <QuickActionCard
          icon={AlertTriangle}
          title="Rizikové školy"
          description={useDemoData 
            ? `${metrics.churnRiskCount} škol vyžaduje pozornost`
            : `${schools.filter(s => s.activityLevel === 'inactive' || s.activityLevel === 'low').length} škol vyžaduje pozornost`
          }
          buttonLabel="Zobrazit"
          color="red"
        />
        <QuickActionCard
          icon={Zap}
          title="Upsell příležitosti"
          description={useDemoData
            ? `${metrics.upsellOpportunities} škol připraveno na upgrade`
            : `${schools.filter(s => s.activityLevel === 'very_active').length} škol připraveno na upgrade`
          }
          buttonLabel="Prozkoumat"
          color="amber"
        />
        <QuickActionCard
          icon={Calendar}
          title="Blížící se expirace"
          description={useDemoData
            ? "12 licencí vyprší do 90 dní"
            : `${schools.filter(s => {
                const expiry = new Date(s.licenseExpiry);
                const daysUntil = (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
                return daysUntil > 0 && daysUntil <= 90;
              }).length} licencí vyprší do 90 dní`
          }
          buttonLabel="Naplánovat"
          color="blue"
        />
      </div>
    </div>
  );
};

// ============================================
// ŠKOLY VIEW
// ============================================

type ActivityFilter = 'all' | 'very_active' | 'active' | 'inactive';

interface SchoolsViewProps {
  schools: School[];
  selectedSchool: School | null;
  onSelectSchool: (school: School | null) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  alerts: typeof DEMO_ALERTS;
  useDemoData: boolean;
}

const SchoolsView: React.FC<SchoolsViewProps> = ({ 
  schools, 
  selectedSchool, 
  onSelectSchool,
  searchTerm,
  onSearchChange,
  alerts,
  useDemoData
}) => {
  const analytics = useAnalytics();
  
  // Alert state for resolved history
  const [resolvedAlerts, setResolvedAlerts] = useState<Record<string, typeof DEMO_ALERTS>>({});
  
  const resolveAlert = (alert: typeof DEMO_ALERTS[0]) => {
    const schoolId = alert.schoolId;
    // Track alert resolution
    analytics.trackAlertResolved(alert.id, alert.type);
    setResolvedAlerts(prev => ({
      ...prev,
      [schoolId]: [...(prev[schoolId] || []), { ...alert, status: 'resolved' }]
    }));
  };

  // Get active alerts for a school
  const getSchoolAlerts = (schoolId: string) => 
    alerts.filter(a => a.schoolId === schoolId && a.status !== 'resolved');
  
  // Get resolved alerts history for a school
  const getSchoolHistory = (schoolId: string) => 
    resolvedAlerts[schoolId] || [];
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  
  // Zjisti všechny předměty ze všech škol
  const allSubjects = [...new Set(schools.flatMap(s => s.subjectLicenses.map(l => l.subject)))];

  // Komplexní filtry
  const [filters, setFilters] = useState({
    healthScoreMin: 0,
    healthScoreMax: 100,
    trend: 'all' as 'all' | 'up' | 'stable' | 'down',
    licenseExpiry: 'all' as 'all' | 'expiring_30' | 'expiring_90' | 'valid',
    aiCostMin: 0,
    aiCostMax: 1000,
    accessMin: 0,
    accessMax: 10000,
    teacherCountMin: 0,
    teacherCountMax: 100,
    studentCountMin: 0,
    studentCountMax: 2000,
    selectedSubjects: [] as string[],
    hasEcosystem: false,
    hasVividboard: false,
    hasVividboardWall: false,
  });

  const updateFilter = (key: keyof typeof filters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleSubject = (subject: string) => {
    setFilters(prev => ({
      ...prev,
      selectedSubjects: prev.selectedSubjects.includes(subject)
        ? prev.selectedSubjects.filter(s => s !== subject)
        : [...prev.selectedSubjects, subject]
    }));
  };

  const resetFilters = () => {
    setFilters({
      healthScoreMin: 0,
      healthScoreMax: 100,
      trend: 'all',
      licenseExpiry: 'all',
      aiCostMin: 0,
      aiCostMax: 1000,
      accessMin: 0,
      accessMax: 10000,
      teacherCountMin: 0,
      teacherCountMax: 100,
      studentCountMin: 0,
      studentCountMax: 2000,
      selectedSubjects: [],
      hasEcosystem: false,
      hasVividboard: false,
      hasVividboardWall: false,
    });
    setActivityFilter('all');
  };
  
  // Reset selected teacher when school changes
  React.useEffect(() => {
    setSelectedTeacher(null);
  }, [selectedSchool]);

  // Spočítej dny do expirace licence
  const getDaysUntilExpiry = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const now = new Date();
    return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const filteredSchools = schools.filter(s => {
    // Text search
    if (searchTerm && !s.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    // Activity filter
    if (activityFilter !== 'all' && s.activityLevel !== activityFilter) {
      return false;
    }
    // Health score filter
    if (s.healthScore < filters.healthScoreMin || s.healthScore > filters.healthScoreMax) {
      return false;
    }
    // Trend filter
    if (filters.trend !== 'all' && s.trend !== filters.trend) {
      return false;
    }
    // License expiry filter
    if (filters.licenseExpiry !== 'all') {
      const daysUntil = getDaysUntilExpiry(s.licenseExpiry);
      if (filters.licenseExpiry === 'expiring_30' && daysUntil > 30) return false;
      if (filters.licenseExpiry === 'expiring_90' && (daysUntil > 90 || daysUntil <= 30)) return false;
      if (filters.licenseExpiry === 'valid' && daysUntil <= 90) return false;
    }
    // AI cost filter
    if (s.monthlyAICost < filters.aiCostMin || s.monthlyAICost > filters.aiCostMax) {
      return false;
    }
    // Monthly access filter
    if (s.monthlyAccess < filters.accessMin || s.monthlyAccess > filters.accessMax) {
      return false;
    }
    // Teacher count filter
    if (s.totalTeachers < filters.teacherCountMin || s.totalTeachers > filters.teacherCountMax) {
      return false;
    }
    // Student count filter
    if (s.totalStudents < filters.studentCountMin || s.totalStudents > filters.studentCountMax) {
      return false;
    }
    // Subject filter - škola musí mít licenci na VŠECHNY vybrané předměty
    if (filters.selectedSubjects.length > 0) {
      const schoolSubjects = s.subjectLicenses.filter(l => l.tier !== 'none').map(l => l.subject);
      const hasAllSubjects = filters.selectedSubjects.every(sub => schoolSubjects.includes(sub));
      if (!hasAllSubjects) return false;
    }
    // Tools filters - checkboxy (pokud je zaškrtnuto, musí mít)
    if (filters.hasEcosystem && !s.hasEcosystemVividbooks) return false;
    if (filters.hasVividboard && !s.hasVividboard) return false;
    if (filters.hasVividboardWall && !s.hasVividboardWall) return false;
    
    return true;
  });

  // Počet aktivních filtrů
  const activeFiltersCount = [
    activityFilter !== 'all',
    filters.healthScoreMin > 0 || filters.healthScoreMax < 100,
    filters.trend !== 'all',
    filters.licenseExpiry !== 'all',
    filters.aiCostMin > 0 || filters.aiCostMax < 1000,
    filters.accessMin > 0 || filters.accessMax < 10000,
    filters.teacherCountMin > 0 || filters.teacherCountMax < 100,
    filters.studentCountMin > 0 || filters.studentCountMax < 2000,
    filters.selectedSubjects.length > 0,
    filters.hasEcosystem,
    filters.hasVividboard,
    filters.hasVividboardWall,
  ].filter(Boolean).length;

  const activityCounts = {
    all: schools.length,
    very_active: schools.filter(s => s.activityLevel === 'very_active').length,
    active: schools.filter(s => s.activityLevel === 'active').length,
    inactive: schools.filter(s => s.activityLevel === 'inactive').length,
  };

  return (
    <div className="flex h-full">
      {/* Schools List */}
      <div className="w-[340px] flex-shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">Školy</h2>
            <button
              onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                showAdvancedFilter || activeFiltersCount > 0 
                  ? 'bg-indigo-100 text-indigo-700' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Filter className="h-4 w-4" />
              Filtr
              {activeFiltersCount > 0 && (
                <span className="bg-indigo-600 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Hledat školu..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Activity Filter Tabs */}
          <div className="flex gap-1">
            {[
              { id: 'all' as ActivityFilter, label: 'Všechny', color: 'slate' },
              { id: 'very_active' as ActivityFilter, label: 'Velmi aktivní', color: 'green' },
              { id: 'active' as ActivityFilter, label: 'Aktivní', color: 'blue' },
              { id: 'inactive' as ActivityFilter, label: 'Neaktivní', color: 'red' },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActivityFilter(filter.id)}
                className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activityFilter === filter.id
                    ? filter.color === 'green' ? 'bg-green-100 text-green-700' :
                      filter.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                      filter.color === 'red' ? 'bg-red-100 text-red-700' :
                      'bg-slate-200 text-slate-700'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                }`}
              >
                {filter.label} ({activityCounts[filter.id]})
              </button>
            ))}
          </div>

          {/* Advanced Filter Panel */}
          {showAdvancedFilter && (
            <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Health Score */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-medium text-slate-600">Health Score</label>
                  <span className="text-xs font-bold text-amber-600">{filters.healthScoreMin} - {filters.healthScoreMax}</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filters.healthScoreMin}
                    onChange={(e) => updateFilter('healthScoreMin', Math.min(Number(e.target.value), filters.healthScoreMax - 1))}
                    className="flex-1 h-2 rounded-lg cursor-pointer"
                    style={{ accentColor: '#f59e0b' }}
                  />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filters.healthScoreMax}
                    onChange={(e) => updateFilter('healthScoreMax', Math.max(Number(e.target.value), filters.healthScoreMin + 1))}
                    className="flex-1 h-2 rounded-lg cursor-pointer"
                    style={{ accentColor: '#f59e0b' }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>Min: {filters.healthScoreMin}</span>
                  <span>Max: {filters.healthScoreMax}</span>
                </div>
              </div>

              {/* Trend */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Trend</label>
                <div className="flex gap-1">
                  {[
                    { id: 'all', label: 'Vše', icon: null },
                    { id: 'up', label: '↑ Roste', color: 'green' },
                    { id: 'stable', label: '→ Stabilní', color: 'slate' },
                    { id: 'down', label: '↓ Klesá', color: 'red' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => updateFilter('trend', opt.id)}
                      className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                        filters.trend === opt.id
                          ? opt.color === 'green' ? 'bg-green-100 text-green-700' :
                            opt.color === 'red' ? 'bg-red-100 text-red-700' :
                            'bg-slate-200 text-slate-700'
                          : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* License Expiry */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Expirace licence</label>
                <select
                  value={filters.licenseExpiry}
                  onChange={(e) => updateFilter('licenseExpiry', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs"
                >
                  <option value="all">Všechny</option>
                  <option value="expiring_30">⚠️ Expiruje do 30 dní</option>
                  <option value="expiring_90">📅 Expiruje do 90 dní</option>
                  <option value="valid">✓ Platná (90+ dní)</option>
                </select>
              </div>

              {/* AI Cost */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-medium text-slate-600">AI útrata/měsíc</label>
                  <span className="text-xs font-bold text-purple-600">${filters.aiCostMin} - ${filters.aiCostMax}</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="1000"
                    step="10"
                    value={filters.aiCostMin}
                    onChange={(e) => updateFilter('aiCostMin', Math.min(Number(e.target.value), filters.aiCostMax - 10))}
                    className="flex-1 h-2 rounded-lg cursor-pointer"
                    style={{ accentColor: '#9333ea' }}
                  />
                  <input
                    type="range"
                    min="0"
                    max="1000"
                    step="10"
                    value={filters.aiCostMax}
                    onChange={(e) => updateFilter('aiCostMax', Math.max(Number(e.target.value), filters.aiCostMin + 10))}
                    className="flex-1 h-2 rounded-lg cursor-pointer"
                    style={{ accentColor: '#9333ea' }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>Min: ${filters.aiCostMin}</span>
                  <span>Max: ${filters.aiCostMax}</span>
                </div>
              </div>

              {/* Monthly Access */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-medium text-slate-600">Přístupy/měsíc</label>
                  <span className="text-xs font-bold text-blue-600">{filters.accessMin.toLocaleString()} - {filters.accessMax.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="10000"
                    step="100"
                    value={filters.accessMin}
                    onChange={(e) => updateFilter('accessMin', Math.min(Number(e.target.value), filters.accessMax - 100))}
                    className="flex-1 h-2 rounded-lg cursor-pointer"
                    style={{ accentColor: '#2563eb' }}
                  />
                  <input
                    type="range"
                    min="0"
                    max="10000"
                    step="100"
                    value={filters.accessMax}
                    onChange={(e) => updateFilter('accessMax', Math.max(Number(e.target.value), filters.accessMin + 100))}
                    className="flex-1 h-2 rounded-lg cursor-pointer"
                    style={{ accentColor: '#2563eb' }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>Min: {filters.accessMin}</span>
                  <span>Max: {filters.accessMax}</span>
                </div>
              </div>

              {/* Teacher Count */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-medium text-slate-600">Počet učitelů</label>
                  <span className="text-xs font-bold text-indigo-600">{filters.teacherCountMin} - {filters.teacherCountMax}</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filters.teacherCountMin}
                    onChange={(e) => updateFilter('teacherCountMin', Math.min(Number(e.target.value), filters.teacherCountMax - 1))}
                    className="flex-1 h-2 rounded-lg cursor-pointer"
                    style={{ accentColor: '#4f46e5' }}
                  />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filters.teacherCountMax}
                    onChange={(e) => updateFilter('teacherCountMax', Math.max(Number(e.target.value), filters.teacherCountMin + 1))}
                    className="flex-1 h-2 rounded-lg cursor-pointer"
                    style={{ accentColor: '#4f46e5' }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>Min: {filters.teacherCountMin}</span>
                  <span>Max: {filters.teacherCountMax}</span>
                </div>
              </div>

              {/* Student Count */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-medium text-slate-600">Počet studentů</label>
                  <span className="text-xs font-bold text-emerald-600">{filters.studentCountMin} - {filters.studentCountMax}</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="2000"
                    step="50"
                    value={filters.studentCountMin}
                    onChange={(e) => updateFilter('studentCountMin', Math.min(Number(e.target.value), filters.studentCountMax - 50))}
                    className="flex-1 h-2 rounded-lg cursor-pointer"
                    style={{ accentColor: '#10b981' }}
                  />
                  <input
                    type="range"
                    min="0"
                    max="2000"
                    step="50"
                    value={filters.studentCountMax}
                    onChange={(e) => updateFilter('studentCountMax', Math.max(Number(e.target.value), filters.studentCountMin + 50))}
                    className="flex-1 h-2 rounded-lg cursor-pointer"
                    style={{ accentColor: '#10b981' }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>Min: {filters.studentCountMin}</span>
                  <span>Max: {filters.studentCountMax}</span>
                </div>
              </div>

              {/* Subject License - Checkboxes */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">
                  Licence předmětů 
                  {filters.selectedSubjects.length > 0 && (
                    <span className="text-indigo-600 ml-1">({filters.selectedSubjects.length} vybráno)</span>
                  )}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {allSubjects.map(subject => (
                    <label 
                      key={subject} 
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                        filters.selectedSubjects.includes(subject) 
                          ? 'bg-indigo-50 border border-indigo-200' 
                          : 'bg-white border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={filters.selectedSubjects.includes(subject)}
                        onChange={() => toggleSubject(subject)}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                      <span className="text-xs text-slate-700">{subject}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Tools - Checkboxes */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Zakoupené nástroje</label>
                <div className="space-y-2">
                  <label className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                    filters.hasEcosystem ? 'bg-green-50 border border-green-200' : 'bg-white border border-slate-200 hover:bg-slate-50'
                  }`}>
                    <input
                      type="checkbox"
                      checked={filters.hasEcosystem}
                      onChange={(e) => updateFilter('hasEcosystem', e.target.checked)}
                      className="w-4 h-4 text-green-600 rounded border-slate-300 focus:ring-green-500"
                    />
                    <div className="flex-1">
                      <span className="text-xs font-medium text-slate-700">Ekosystém Vividbooks</span>
                      <p className="text-[10px] text-slate-500">Kompletní digitální knihovna</p>
                    </div>
                  </label>
                  
                  <label className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                    filters.hasVividboard ? 'bg-purple-50 border border-purple-200' : 'bg-white border border-slate-200 hover:bg-slate-50'
                  }`}>
                    <input
                      type="checkbox"
                      checked={filters.hasVividboard}
                      onChange={(e) => updateFilter('hasVividboard', e.target.checked)}
                      className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                    />
                    <div className="flex-1">
                      <span className="text-xs font-medium text-slate-700">Vividboard</span>
                      <p className="text-[10px] text-slate-500">Interaktivní tabule</p>
                    </div>
                  </label>
                  
                  <label className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                    filters.hasVividboardWall ? 'bg-blue-50 border border-blue-200' : 'bg-white border border-slate-200 hover:bg-slate-50'
                  }`}>
                    <input
                      type="checkbox"
                      checked={filters.hasVividboardWall}
                      onChange={(e) => updateFilter('hasVividboardWall', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <span className="text-xs font-medium text-slate-700">Vividboard Wall</span>
                      <p className="text-[10px] text-slate-500 flex items-center gap-1">
                        Nástěnka pro studenty
                        <span className="text-[9px] bg-slate-200 text-slate-600 px-1 rounded">zdarma</span>
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Reset */}
              <button
                onClick={resetFilters}
                className="w-full py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
                🗑️ Resetovat všechny filtry
              </button>
            </div>
          )}
        </div>

        {/* Schools List */}
        <div className="flex-1 overflow-y-auto">
          {filteredSchools.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Žádné školy nenalezeny</p>
            </div>
          ) : (
            filteredSchools.map((school) => (
              <button
                key={school.id}
                onClick={() => onSelectSchool(school)}
                className={`w-full p-4 text-left border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                  selectedSchool?.id === school.id ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-slate-800 leading-tight">{school.name}</h3>
                  <HealthBadge score={school.healthScore} />
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className={`px-2 py-0.5 rounded-full font-medium ${
                    school.activityLevel === 'very_active' ? 'bg-green-100 text-green-700' :
                    school.activityLevel === 'active' ? 'bg-blue-100 text-blue-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {school.activityLevel === 'very_active' ? 'Velmi aktivní' :
                     school.activityLevel === 'active' ? 'Aktivní' : 'Neaktivní'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {school.activeTeachers}/{school.totalTeachers}
                  </span>
                  <span>{school.licenseType}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* School Detail OR Teacher Detail (overlay) */}
      <div className="flex-1 bg-slate-50 overflow-y-auto">
        {selectedTeacher ? (
          // Teacher detail překryje detail školy
          <TeacherDetail 
            teacher={selectedTeacher} 
            schoolName={selectedSchool?.name || ''}
            onClose={() => setSelectedTeacher(null)}
            useDemoData={useDemoData}
          />
        ) : selectedSchool ? (
          <SchoolDetail 
            school={selectedSchool} 
            useDemoData={useDemoData}
            selectedTeacher={selectedTeacher}
            onSelectTeacher={setSelectedTeacher}
            activeAlerts={getSchoolAlerts(selectedSchool.id)}
            alertHistory={getSchoolHistory(selectedSchool.id)}
            onResolveAlert={resolveAlert}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400">
            <div className="text-center">
              <Building2 className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p>Vyberte školu ze seznamu</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface SchoolDetailProps {
  school: School;
  selectedTeacher: Teacher | null;
  onSelectTeacher: (teacher: Teacher | null) => void;
  activeAlerts: typeof DEMO_ALERTS;
  alertHistory: typeof DEMO_ALERTS;
  onResolveAlert: (alert: typeof DEMO_ALERTS[0]) => void;
  useDemoData?: boolean;
}

const SchoolDetail: React.FC<SchoolDetailProps> = ({ 
  school,
  useDemoData = true, 
  selectedTeacher, 
  onSelectTeacher,
  activeAlerts,
  alertHistory,
  onResolveAlert
}) => {
  const teacherRate = Math.round((school.activeTeachers / school.totalTeachers) * 100);
  const daysToExpiry = Math.ceil((new Date(school.licenseExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const getActivityColor = (level: string) => {
    switch (level) {
      case 'very_active': return 'bg-green-500';
      case 'active': return 'bg-blue-500';
      default: return 'bg-red-500';
    }
  };

  const getActivityBgColor = (level: string) => {
    switch (level) {
      case 'very_active': return 'bg-green-50 border-green-200 text-green-700';
      case 'active': return 'bg-blue-50 border-blue-200 text-blue-700';
      default: return 'bg-red-50 border-red-200 text-red-700';
    }
  };

  const getTierLabel = (tier: SubjectTier) => {
    switch (tier) {
      case 'digital-library': return 'Rozšířený digitální přístup';
      case 'workbooks': return 'Základní digitální přístup';
      default: return 'Neaktivní';
    }
  };

  const getTierColor = (tier: SubjectTier) => {
    switch (tier) {
      case 'digital-library': return 'bg-green-100 text-green-700 border-green-200';
      case 'workbooks': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header with Contact Info */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">{school.name}</h2>
        
        {/* Contact Info Row */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <Mail className="h-5 w-5 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">Email</p>
              <a href={`mailto:${school.contact.email}`} className="text-sm font-medium text-indigo-600 hover:underline">
                {school.contact.email}
              </a>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <Phone className="h-5 w-5 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">Telefon</p>
              <a href={`tel:${school.contact.phone}`} className="text-sm font-medium text-slate-800">
                {school.contact.phone}
              </a>
            </div>
          </div>
        </div>
        
        {/* Codes Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl">
            <Building2 className="h-5 w-5 text-indigo-500" />
            <div>
              <p className="text-xs text-indigo-600">Školní kód</p>
              <p className="text-sm font-bold text-indigo-800 font-mono">{school.schoolCode}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
            <GraduationCap className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-xs text-green-600">Žákovský kód</p>
              <p className="text-sm font-bold text-green-800 font-mono">{school.studentCode}</p>
            </div>
          </div>
        </div>
        
        {/* License Expiry */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Clock className="h-4 w-4" />
            <span>Licence vyprší za <strong className={daysToExpiry < 90 ? 'text-red-600' : 'text-slate-800'}>{daysToExpiry} dní</strong></span>
          </div>
          <span className="text-sm text-slate-500">Kontakt: {school.contact.name}</span>
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="flex flex-row gap-4">
        {/* Health Score */}
        <div className={`flex-1 p-5 rounded-2xl border-2 ${
          school.healthScore >= 80 ? 'bg-green-50 border-green-200' :
          school.healthScore >= 60 ? 'bg-blue-50 border-blue-200' :
          school.healthScore >= 40 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
        }`}>
          <p className="text-sm text-slate-500 mb-1">Health Score</p>
          <p className={`text-4xl font-bold ${
            school.healthScore >= 80 ? 'text-green-600' :
            school.healthScore >= 60 ? 'text-blue-600' :
            school.healthScore >= 40 ? 'text-amber-600' : 'text-red-600'
          }`}>{school.healthScore}</p>
        </div>

        {/* Aktivní učitelé */}
        <div className="flex-1 bg-white p-5 rounded-2xl border border-slate-200">
          <p className="text-sm text-slate-500 mb-1">Aktivní učitelé</p>
          <p className="text-3xl font-bold text-slate-800">{school.activeTeachers}<span className="text-lg text-slate-400">/{school.totalTeachers}</span></p>
          <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${teacherRate}%` }} />
          </div>
        </div>

        {/* Přístupy / měsíc */}
        <div className="flex-1 bg-white p-5 rounded-2xl border border-slate-200">
          <p className="text-sm text-slate-500 mb-1">Přístupy / měsíc</p>
          <p className="text-3xl font-bold text-slate-800">{school.monthlyAccess.toLocaleString()}</p>
        </div>

        {/* AI útrata */}
        <div className="flex-1 bg-white p-5 rounded-2xl border border-slate-200">
          <p className="text-sm text-slate-500 mb-1">AI útrata / měsíc</p>
          <p className="text-3xl font-bold text-slate-800">${school.monthlyAICost.toFixed(0)}</p>
        </div>
      </div>

      {/* Upozornění pro školu */}
      {(activeAlerts.length > 0 || alertHistory.length > 0) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-indigo-600" />
              <h3 className="font-bold text-slate-800">Upozornění</h3>
              {activeAlerts.length > 0 && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                  {activeAlerts.length} aktivních
                </span>
              )}
            </div>
          </div>
          
          {/* Aktivní upozornění */}
          {activeAlerts.length > 0 && (
            <div className="p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Aktivní upozornění</p>
              {activeAlerts.map((alert) => (
                <div 
                  key={alert.id}
                  className={`p-4 rounded-xl border-2 ${
                    alert.severity === 'high' ? 'bg-red-50 border-red-200' :
                    alert.severity === 'medium' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className={`h-4 w-4 ${
                          alert.severity === 'high' ? 'text-red-600' :
                          alert.severity === 'medium' ? 'text-amber-600' : 'text-blue-600'
                        }`} />
                        <span className="font-semibold text-slate-800">{alert.title}</span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          alert.type === 'churn_risk' ? 'bg-red-100 text-red-700' :
                          alert.type === 'upsell' ? 'bg-green-100 text-green-700' :
                          alert.type === 'renewal' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {alert.type === 'churn_risk' ? 'Riziko' : 
                           alert.type === 'upsell' ? 'Příležitost' :
                           alert.type === 'renewal' ? 'Obnovení' : 'Engagement'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mb-2">{alert.description}</p>
                      <p className="text-xs text-indigo-600">💡 {alert.recommendation}</p>
                    </div>
                    <button
                      onClick={() => onResolveAlert(alert)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Vyřešeno
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Historie vyřešených upozornění */}
          {alertHistory.length > 0 && (
            <div className="p-4 bg-slate-50 border-t border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Historie vyřešených</p>
              <div className="space-y-2">
                {alertHistory.map((alert, idx) => (
                  <div key={`${alert.id}-${idx}`} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{alert.title}</p>
                      <p className="text-xs text-slate-400">
                        {alert.type === 'churn_risk' ? 'Riziko odchodu' : 
                         alert.type === 'upsell' ? 'Příležitost' :
                         alert.type === 'renewal' ? 'Obnovení' : 'Engagement'}
                      </p>
                    </div>
                    <span className="text-xs text-green-600 font-medium">✓ Vyřešeno</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prázdný stav */}
          {activeAlerts.length === 0 && alertHistory.length === 0 && (
            <div className="p-8 text-center text-slate-400">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Žádná upozornění pro tuto školu</p>
            </div>
          )}
        </div>
      )}

      {/* Two Charts Row */}
      <div className="flex flex-row gap-6">
        {/* Active vs Inactive Teachers - 50 weeks */}
        <div className="flex-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-2">Aktivní vs. neaktivní učitelé</h3>
          <p className="text-sm text-slate-500 mb-4">Posledních 50 týdnů</p>
          
          {useDemoData ? (
            <>
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={generateSchoolTeacherTrend(school.totalTeachers, school.activeTeachers)} barSize={6}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 9 }} interval={9} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} width={25} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                      labelFormatter={(label) => `Týden ${String(label).replace('T', '')}`}
                    />
                    <Bar dataKey="active" stackId="a" fill="#22c55e" name="Aktivní" />
                    <Bar dataKey="inactive" stackId="a" fill="#ef4444" name="Neaktivní" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-3">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-slate-600">Aktivní</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-slate-600">Neaktivní</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-[200px] bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
              <Clock className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-500">Data se sbírají</p>
              <p className="text-xs text-slate-400 mt-1">Historická data budou brzy k dispozici</p>
              <div className="flex items-center gap-4 mt-4 text-sm">
                <span className="text-green-600 font-medium">{school.activeTeachers} aktivních</span>
                <span className="text-slate-400">•</span>
                <span className="text-red-500 font-medium">{school.totalTeachers - school.activeTeachers} neaktivních</span>
              </div>
            </div>
          )}
        </div>

        {/* Teacher vs Student Access - 50 weeks */}
        <div className="flex-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-2">Přístupy učitelé vs. studenti</h3>
          <p className="text-sm text-slate-500 mb-4">Posledních 50 týdnů</p>
          
          {useDemoData ? (
            <>
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={generateSchoolAccessTrend(school.monthlyAccess, school.totalTeachers, school.totalStudents)} barSize={6}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 9 }} interval={9} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} width={35} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                      labelFormatter={(label) => `Týden ${String(label).replace('T', '')}`}
                    />
                    <Bar dataKey="teachers" fill="#6366f1" name="Učitelé" />
                    <Bar dataKey="students" fill="#22c55e" name="Studenti" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-3">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full bg-indigo-500" />
                  <span className="text-slate-600">Učitelé</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-slate-600">Studenti</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-[200px] bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
              <Clock className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-500">Data se sbírají</p>
              <p className="text-xs text-slate-400 mt-1">Historická data budou brzy k dispozici</p>
              <div className="flex items-center gap-4 mt-4 text-sm">
                <span className="text-indigo-600 font-medium">{school.monthlyAccess} přístupů učitelů</span>
                <span className="text-slate-400">•</span>
                <span className="text-green-600 font-medium">{school.activeStudents || 0} aktivních studentů</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nástroje + Licence předmětů - Two Columns */}
      <div className="flex flex-row gap-6">
        {/* Nástroje */}
        <div className="w-1/3 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4">Zakoupené nástroje</h3>
          <div className="space-y-3">
            <div className={`p-4 rounded-xl border-2 ${school.hasEcosystemVividbooks ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className={`h-5 w-5 ${school.hasEcosystemVividbooks ? 'text-green-600' : 'text-slate-400'}`} />
                <span className={`text-sm font-bold ${school.hasEcosystemVividbooks ? 'text-green-700' : 'text-slate-500'}`}>
                  Ekosystém Vividbooks
                </span>
              </div>
              <p className="text-xs text-slate-500">AI asistent, výsledky žáků</p>
              {school.hasEcosystemVividbooks && <span className="inline-block mt-2 px-2 py-0.5 bg-green-200 text-green-800 text-xs rounded-full font-medium">Aktivní</span>}
            </div>
            <div className={`p-4 rounded-xl border-2 ${school.hasVividboard ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Target className={`h-5 w-5 ${school.hasVividboard ? 'text-blue-600' : 'text-slate-400'}`} />
                <span className={`text-sm font-bold ${school.hasVividboard ? 'text-blue-700' : 'text-slate-500'}`}>
                  Vividboard
                </span>
              </div>
              <p className="text-xs text-slate-500">Tvorba materiálů</p>
              {school.hasVividboard && <span className="inline-block mt-2 px-2 py-0.5 bg-blue-200 text-blue-800 text-xs rounded-full font-medium">Aktivní</span>}
            </div>
            <div className="p-4 rounded-xl border-2 bg-slate-50 border-slate-200">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="h-5 w-5 text-slate-400" />
                <span className="text-sm font-bold text-slate-600">Nástěnka</span>
              </div>
              <p className="text-xs text-slate-500">Interaktivní nástěnka</p>
              <span className="inline-block mt-2 px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded-full font-medium">Zdarma</span>
            </div>
          </div>
        </div>

        {/* Licence předmětů */}
        <div className="flex-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4">Licence předmětů (2. stupeň)</h3>
          <div className="grid grid-cols-2 gap-3">
            {school.subjectLicenses.map((license) => (
              <div 
                key={license.subject} 
                className={`p-3 rounded-xl border ${getTierColor(license.tier)} flex items-center justify-between`}
              >
                <div>
                  <p className="font-medium">{license.subject}</p>
                  <p className="text-xs opacity-75">{getTierLabel(license.tier)}</p>
                  {license.isFree && <span className="text-xs">(od pracovních sešitů)</span>}
                </div>
                {license.tier !== 'none' && license.validUntil && (
                  <span className="text-xs opacity-75">do {new Date(license.validUntil).toLocaleDateString('cs-CZ')}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Teachers List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">Učitelé ({school.teachers.length})</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {school.teachers.map((teacher) => (
            <button
              type="button"
              key={teacher.id}
              onClick={(e) => {
                e.stopPropagation();
                // Pokud je učitel již vybrán, neklikej (zavře se jinak - tlačítkem v detailu)
                if (selectedTeacher?.id !== teacher.id) {
                  onSelectTeacher(teacher);
                }
              }}
              className={`w-full p-4 flex items-center justify-between transition-colors ${
                selectedTeacher?.id === teacher.id 
                  ? 'bg-indigo-50 border-l-4 border-indigo-500' 
                  : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full ${getActivityColor(teacher.activityLevel)}`} />
                <div className="text-left">
                  <p className="font-medium text-slate-800">{teacher.name}</p>
                  <p className="text-sm text-slate-500">{teacher.subject}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className={`px-3 py-1 rounded-lg text-sm font-bold border ${getActivityBgColor(teacher.activityLevel)}`}>
                  {teacher.monthlyAccess} přístupů
                </div>
                <ChevronRight className={`h-5 w-5 text-slate-400 transition-transform ${
                  selectedTeacher?.id === teacher.id ? 'rotate-90' : ''
                }`} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Students List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">Žáci ({(school.students || []).length} zobrazeno / {school.totalStudents} celkem)</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {(school.students || []).length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <GraduationCap className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>Zatím žádní žáci</p>
            </div>
          ) : (
            (school.students || []).map((student) => (
              <div key={student.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                    <GraduationCap className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{student.name}</p>
                    <p className="text-sm text-slate-500">Třída {student.class}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <span>{student.monthlyAccess} přístupů</span>
                  <span>{formatRelativeTime(student.lastActive)}</span>
                </div>
              </div>
            ))
          )}
        </div>
        {school.totalStudents > (school.students || []).length && (
          <div className="p-4 text-center border-t border-slate-100">
            <button className="text-sm text-indigo-600 font-medium hover:underline">
              Zobrazit všechny žáky ({school.totalStudents})
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// TEACHER DETAIL VIEW
// ============================================

interface TeacherDetailProps {
  teacher: Teacher;
  schoolName: string;
  onClose: () => void;
  useDemoData?: boolean;
}

const TeacherDetail: React.FC<TeacherDetailProps> = ({ teacher: rawTeacher, schoolName, onClose, useDemoData = true }) => {
  // Safe defaults for teacher properties that might be undefined from Supabase
  const teacher = {
    ...rawTeacher,
    weeklyTimeMinutes: rawTeacher.weeklyTimeMinutes || Array(50).fill(0),
    myContent: {
      customDocuments: 0,
      editedVividbooksDocuments: 0,
      customVividboards: 0,
      editedVividboards: 0,
      customWorksheets: 0,
      editedWorksheets: 0,
      aiCreationUsage: 0,
      uploadedFiles: 0,
      uploadedLinks: 0,
      storageUsedMB: 0,
      ...rawTeacher.myContent
    },
    library: {
      documents: [],
      worksheets: [],
      vividboards: [],
      usesConnectStudents: false,
      connectStudentsSessions: 0,
      usesShareLinks: false,
      sharedLinksCount: 0,
      usesAITeachMe: false,
      aiTeachMeSessions: 0,
      ...rawTeacher.library
    },
    classResults: {
      classes: [],
      testsPerMonth: 0,
      hasCreatedClasses: false,
      sharesFilesWithClasses: false,
      ...rawTeacher.classResults
    }
  };

  // State pro rozbalené sekce
  const [expandedLibrary, setExpandedLibrary] = useState<'documents' | 'worksheets' | 'vividboards' | null>(null);
  const [expandedMyContent, setExpandedMyContent] = useState<'documents' | 'vividboards' | 'worksheets' | null>(null);

  const formatMinutes = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
  };

  const getAdoptionColor = (value: number) => {
    if (value >= 80) return 'text-green-600 bg-green-50';
    if (value >= 50) return 'text-blue-600 bg-blue-50';
    if (value >= 30) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const MetricCard: React.FC<{ label: string; value: string | number; subValue?: string; colorClass?: string }> = 
    ({ label, value, subValue, colorClass }) => (
      <div className={`p-4 rounded-xl border ${colorClass || 'bg-white border-slate-200'}`}>
        <p className="text-xs text-slate-500 mb-1">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
        {subValue && <p className="text-xs text-slate-500 mt-1">{subValue}</p>}
      </div>
    );

  const FeatureIndicator: React.FC<{ label: string; active: boolean; count?: number }> = ({ label, active, count }) => (
    <div className={`flex items-center justify-between p-3 rounded-xl border ${active ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
      <span className={`text-sm ${active ? 'text-green-700' : 'text-slate-500'}`}>{label}</span>
      {active ? (
        <div className="flex items-center gap-2">
          {count !== undefined && <span className="text-sm font-bold text-green-700">{count}×</span>}
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        </div>
      ) : (
        <div className="w-5 h-5 rounded-full border-2 border-slate-300" />
      )}
    </div>
  );

  // Generuj demo dokumenty pro Můj obsah
  const generateMyContentDocs = (count: number, type: 'custom' | 'edited'): { id: string; name: string; createdAt: string }[] => {
    const names = type === 'custom' 
      ? ['Můj test z fyziky', 'Opakování - síly', 'Domácí úkol', 'Kvíz - elektrický proud', 'Projekt - magnetismus', 'Poznámky k hodině']
      : ['Newtonovy zákony (upraveno)', 'Elektřina - doplněno', 'Mechanika - zjednodušeno', 'Optika - rozšířeno', 'Termika - překlad'];
    return Array.from({ length: count }, (_, i) => ({
      id: `${type}-${i}`,
      name: names[i % names.length] + (i >= names.length ? ` ${Math.floor(i / names.length) + 1}` : ''),
      createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString()
    }));
  };

  const myContentData = {
    documents: {
      custom: generateMyContentDocs(teacher.myContent.customDocuments, 'custom'),
      edited: generateMyContentDocs(teacher.myContent.editedVividbooksDocuments, 'edited')
    },
    vividboards: {
      custom: generateMyContentDocs(teacher.myContent.customVividboards, 'custom'),
      edited: generateMyContentDocs(teacher.myContent.editedVividboards, 'edited')
    },
    worksheets: {
      custom: generateMyContentDocs(teacher.myContent.customWorksheets, 'custom'),
      edited: generateMyContentDocs(teacher.myContent.editedWorksheets, 'edited')
    }
  };

  const ContentStat: React.FC<{ 
    label: string; 
    custom: number; 
    edited: number; 
    type: 'documents' | 'vividboards' | 'worksheets';
  }> = ({ label, custom, edited, type }) => (
    <div>
      <button
        onClick={() => setExpandedMyContent(expandedMyContent === type ? null : type)}
        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer hover:ring-2 hover:ring-purple-300 ${
          expandedMyContent === type ? 'bg-purple-100 ring-2 ring-purple-400' : 'bg-slate-50'
        }`}
      >
        <span className="text-sm text-slate-600">{label}</span>
        <div className="flex items-center gap-3">
          <span className="text-sm">
            <span className="font-bold text-indigo-600">{custom}</span>
            <span className="text-slate-400"> vlastní</span>
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-sm">
            <span className="font-bold text-blue-600">{edited}</span>
            <span className="text-slate-400"> upravené</span>
          </span>
          <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${expandedMyContent === type ? 'rotate-90' : ''}`} />
        </div>
      </button>
      
      {/* Expanded list */}
      {expandedMyContent === type && (
        <div className="mt-2 bg-purple-50/50 rounded-xl p-3 border border-purple-100">
          {/* Vlastní */}
          {myContentData[type].custom.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-purple-700 mb-2">Vlastní ({myContentData[type].custom.length})</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {myContentData[type].custom.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-2 bg-white rounded-lg text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                      <span className="text-slate-700">{doc.name}</span>
                    </div>
                    <span className="text-slate-400">{formatDate(doc.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Upravené */}
          {myContentData[type].edited.length > 0 && (
            <div>
              <p className="text-xs font-medium text-blue-700 mb-2">Upravené ({myContentData[type].edited.length})</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {myContentData[type].edited.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-2 bg-white rounded-lg text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-slate-700">{doc.name}</span>
                    </div>
                    <span className="text-slate-400">{formatDate(doc.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {myContentData[type].custom.length === 0 && myContentData[type].edited.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-2">Žádný obsah</p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Back Button + Header */}
      <div>
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 mb-4 transition-colors"
        >
          <ChevronRight className="h-5 w-5 rotate-180" />
          <span className="font-medium">Zpět na {schoolName}</span>
        </button>
        
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{teacher.name}</h2>
            <p className="text-slate-500">{teacher.subject} • {teacher.email}</p>
          </div>
          <div className={`px-4 py-2 rounded-xl font-bold ${
            teacher.activityLevel === 'very_active' ? 'bg-green-100 text-green-700' :
            teacher.activityLevel === 'active' ? 'bg-blue-100 text-blue-700' :
            'bg-red-100 text-red-700'
          }`}>
            {teacher.activityLevel === 'very_active' ? 'Velmi aktivní' :
             teacher.activityLevel === 'active' ? 'Aktivní' : 'Neaktivní'}
          </div>
        </div>
      </div>

      {/* 4 Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard 
          label="Přístupy (30 dní)" 
          value={teacher.accessLast30Days}
          colorClass={teacher.activityLevel === 'very_active' ? 'bg-green-50 border-green-200' : 
                     teacher.activityLevel === 'active' ? 'bg-blue-50 border-blue-200' : 
                     'bg-red-50 border-red-200'}
        />
        <MetricCard 
          label="Čas v aplikaci (30 dní)" 
          value={formatMinutes(teacher.timeSpentMinutes)}
          subValue="součet posledních 4 týdnů"
        />
        <MetricCard 
          label="AI útrata" 
          value={`$${(teacher.aiCostCents / 100).toFixed(2)}`}
          subValue="za poslední měsíc"
          colorClass={teacher.aiCostCents > 300 ? 'bg-purple-50 border-purple-200' : 'bg-white border-slate-200'}
        />
        <div className={`p-4 rounded-xl border ${getAdoptionColor(teacher.technologyAdoption)}`}>
          <p className="text-xs text-slate-500 mb-1">Adopce technologie</p>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold">{teacher.technologyAdoption}%</p>
          </div>
          <div className="mt-2 h-2 bg-white/50 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full ${
                teacher.technologyAdoption >= 80 ? 'bg-green-500' :
                teacher.technologyAdoption >= 50 ? 'bg-blue-500' :
                teacher.technologyAdoption >= 30 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${teacher.technologyAdoption}%` }}
            />
          </div>
        </div>
      </div>

      {/* Weekly Time Chart - 50 weeks */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-800">Čas v aplikaci</h3>
            <p className="text-xs text-slate-500">Průměrný čas za týden (posledních 50 týdnů)</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-indigo-600">
              {formatMinutes(Math.round(teacher.weeklyTimeMinutes.reduce((a, b) => a + b, 0) / 50))}
            </p>
            <p className="text-xs text-slate-500">průměr/týden</p>
          </div>
        </div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={teacher.weeklyTimeMinutes.map((minutes, index) => ({ 
              week: index + 1, 
              minutes,
              label: `Týden ${50 - index}`
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis 
                dataKey="week" 
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickFormatter={(value) => value % 10 === 0 ? `T${value}` : ''}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickFormatter={(value) => value >= 60 ? `${Math.floor(value/60)}h` : `${value}m`}
                axisLine={{ stroke: '#e2e8f0' }}
                width={35}
              />
              <Tooltip 
                formatter={(value: number) => [formatMinutes(value), 'Čas']}
                labelFormatter={(label) => `Týden ${label} (před ${50 - label} týdny)`}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
              />
              <Bar 
                dataKey="minutes" 
                fill="#6366f1" 
                radius={[2, 2, 0, 0]}
                opacity={0.8}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Knihovna Section */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-indigo-600" />
                Knihovna
                <span className="text-xs text-slate-400 font-normal ml-1">(klikni pro detail)</span>
              </h3>
            </div>
            <div className="p-3 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => setExpandedLibrary(expandedLibrary === 'documents' ? null : 'documents')}
                  className={`p-2 rounded-lg text-center transition-all cursor-pointer hover:ring-2 hover:ring-indigo-300 ${
                    expandedLibrary === 'documents' ? 'bg-indigo-100 ring-2 ring-indigo-400' : 'bg-slate-50'
                  }`}
                >
                  <p className="text-lg font-bold text-slate-800">{teacher.library.documents.length}</p>
                  <p className="text-xs text-slate-500">Dokumenty</p>
                </button>
                <button 
                  onClick={() => setExpandedLibrary(expandedLibrary === 'worksheets' ? null : 'worksheets')}
                  className={`p-2 rounded-lg text-center transition-all cursor-pointer hover:ring-2 hover:ring-indigo-300 ${
                    expandedLibrary === 'worksheets' ? 'bg-indigo-100 ring-2 ring-indigo-400' : 'bg-slate-50'
                  }`}
                >
                  <p className="text-lg font-bold text-slate-800">{teacher.library.worksheets.length}</p>
                  <p className="text-xs text-slate-500">Prac. listy</p>
                </button>
                <button 
                  onClick={() => setExpandedLibrary(expandedLibrary === 'vividboards' ? null : 'vividboards')}
                  className={`p-2 rounded-lg text-center transition-all cursor-pointer hover:ring-2 hover:ring-indigo-300 ${
                    expandedLibrary === 'vividboards' ? 'bg-indigo-100 ring-2 ring-indigo-400' : 'bg-slate-50'
                  }`}
                >
                  <p className="text-lg font-bold text-slate-800">{teacher.library.vividboards.length}</p>
                  <p className="text-xs text-slate-500">Vividboardy</p>
                </button>
              </div>

              {/* Expanded document list for Knihovna */}
              {expandedLibrary && (
                <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100">
                  <p className="text-xs font-medium text-indigo-700 mb-2">
                    {expandedLibrary === 'documents' ? 'Otevřené dokumenty' : 
                     expandedLibrary === 'worksheets' ? 'Otevřené pracovní listy' : 'Otevřené vividboardy'} 
                    <span className="text-indigo-500"> (posledních 30 dní)</span>
                  </p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {(expandedLibrary === 'documents' ? teacher.library.documents :
                      expandedLibrary === 'worksheets' ? teacher.library.worksheets :
                      teacher.library.vividboards
                    ).map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 bg-white rounded-lg text-xs">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            doc.type === 'vividbooks' ? 'bg-indigo-500' :
                            doc.type === 'custom' ? 'bg-purple-500' : 'bg-blue-500'
                          }`} />
                          <span className="truncate text-slate-700">{doc.name}</span>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                          <span className="text-slate-400">{formatMinutes(doc.timeSpent)}</span>
                          <span className="text-slate-400">{formatDate(doc.lastAccessed)}</span>
                        </div>
                      </div>
                    ))}
                    {(expandedLibrary === 'documents' ? teacher.library.documents :
                      expandedLibrary === 'worksheets' ? teacher.library.worksheets :
                      teacher.library.vividboards
                    ).length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-2">Žádné záznamy</p>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <FeatureIndicator label="Připojit studenty" active={teacher.library.usesConnectStudents} count={teacher.library.connectStudentsSessions} />
                <FeatureIndicator label="Sdílení odkazů" active={teacher.library.usesShareLinks} count={teacher.library.sharedLinksCount} />
                <FeatureIndicator label="AI Nauč mě" active={teacher.library.usesAITeachMe} count={teacher.library.aiTeachMeSessions} />
              </div>
            </div>
          </div>

          {/* Výsledky / Moje třída Section */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-3 border-b border-slate-100 bg-gradient-to-r from-green-50 to-white">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                <GraduationCap className="h-4 w-4 text-green-600" />
                Výsledky / Moje třída
              </h3>
            </div>
            <div className="p-3 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className={`p-2 rounded-lg text-center ${teacher.classResults.hasCreatedClasses ? 'bg-green-50 border border-green-200' : 'bg-slate-50'}`}>
                  <p className="text-lg font-bold text-slate-800">{teacher.classResults.classes.length}</p>
                  <p className="text-xs text-slate-500">Třídy</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg text-center">
                  <p className="text-lg font-bold text-slate-800">{teacher.classResults.testsPerMonth}</p>
                  <p className="text-xs text-slate-500">Testy/měsíc</p>
                </div>
                <div className={`p-2 rounded-lg text-center ${teacher.classResults.sharesFilesWithClasses ? 'bg-green-50 border border-green-200' : 'bg-slate-50'}`}>
                  <p className="text-lg font-bold text-slate-800">{teacher.classResults.sharesFilesWithClasses ? 'Ano' : 'Ne'}</p>
                  <p className="text-xs text-slate-500">Sdílí</p>
                </div>
              </div>
              {teacher.classResults.classes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {teacher.classResults.classes.map((cls) => (
                    <div key={cls.id} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
                      {cls.name} ({cls.studentCount} žáků)
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Můj obsah Section */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-3 border-b border-slate-100 bg-gradient-to-r from-purple-50 to-white">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-purple-600" />
                Můj obsah
              </h3>
            </div>
            <div className="p-3 space-y-2">
              <ContentStat label="Dokumenty" custom={teacher.myContent.customDocuments} edited={teacher.myContent.editedVividbooksDocuments} type="documents" />
              <ContentStat label="Vividboardy" custom={teacher.myContent.customVividboards} edited={teacher.myContent.editedVividboards} type="vividboards" />
              <ContentStat label="Pracovní listy" custom={teacher.myContent.customWorksheets} edited={teacher.myContent.editedWorksheets} type="worksheets" />
              
              <div className="p-2 bg-gradient-to-r from-amber-50 to-white rounded-lg border border-amber-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600 flex items-center gap-1">
                    <Zap className="h-3 w-3 text-amber-500" />
                    AI tvorba
                  </span>
                  <span className="font-bold text-amber-600 text-sm">{teacher.myContent.aiCreationUsage}%</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 bg-slate-50 rounded-lg text-center">
                  <p className="text-lg font-bold text-slate-800">{teacher.myContent.uploadedFiles}</p>
                  <p className="text-xs text-slate-500">Soubory</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg text-center">
                  <p className="text-lg font-bold text-slate-800">{teacher.myContent.uploadedLinks}</p>
                  <p className="text-xs text-slate-500">Odkazy</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg text-center">
                  <p className="text-lg font-bold text-slate-800">{teacher.myContent.storageUsedMB}</p>
                  <p className="text-xs text-slate-500">MB</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

// ============================================
// UČITELÉ VIEW
// ============================================

interface TeachersListViewProps {
  teachers: (Teacher & { schoolId: string; schoolName: string })[];
  selectedTeacher: (Teacher & { schoolId: string; schoolName: string }) | null;
  onSelectTeacher: (teacher: (Teacher & { schoolId: string; schoolName: string }) | null) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  useDemoData?: boolean;
}

const TeachersListView: React.FC<TeachersListViewProps> = ({ 
  teachers, 
  selectedTeacher, 
  onSelectTeacher,
  searchTerm,
  onSearchChange,
  useDemoData = true
}) => {
  const [sortBy, setSortBy] = useState<'name' | 'activity' | 'aiCost' | 'timeSpent'>('activity');
  const [filterActivity, setFilterActivity] = useState<'all' | 'very_active' | 'active' | 'inactive'>('all');
  const [teacherNPSHistory, setTeacherNPSHistory] = useState<any[]>([]);
  const [isLoadingNPS, setIsLoadingNPS] = useState(false);
  const [showNPSPopup, setShowNPSPopup] = useState(false);

  // Fetch NPS history when teacher is selected
  useEffect(() => {
    if (selectedTeacher) {
      setIsLoadingNPS(true);
      const fetchNPS = async () => {
        try {
          const { data, error } = await supabase
            .from('nps_responses')
            .select('*')
            .eq('user_id', selectedTeacher.id)
            .order('created_at', { ascending: false });
          
          if (!error && data) {
            setTeacherNPSHistory(data);
          }
        } catch (err) {
          console.error('Error fetching NPS:', err);
        } finally {
          setIsLoadingNPS(false);
        }
      };
      fetchNPS();
    } else {
      setTeacherNPSHistory([]);
    }
  }, [selectedTeacher]);

  // Trigger manual NPS for teacher
  const triggerManualNPS = async () => {
    if (!selectedTeacher) return;
    setShowNPSPopup(true);
  };

  // Submit NPS response for teacher
  const submitTeacherNPS = async (score: number, feedback: string) => {
    if (!selectedTeacher) return;
    
    const category = score <= 6 ? 'detractor' : score <= 8 ? 'passive' : 'promoter';
    
    try {
      const { data, error } = await supabase
        .from('nps_responses')
        .insert({
          user_id: selectedTeacher.id,
          school_id: selectedTeacher.schoolId,
          score,
          category,
          feedback: feedback || null,
          triggered_by: 'manual',
          user_name: selectedTeacher.name,
          user_email: selectedTeacher.email,
        })
        .select()
        .single();
      
      if (!error && data) {
        setTeacherNPSHistory(prev => [data, ...prev]);
      }
    } catch (err) {
      console.error('Error saving NPS:', err);
    }
    
    setShowNPSPopup(false);
  };

  const filteredTeachers = teachers
    .filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           t.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           t.schoolName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesActivity = filterActivity === 'all' || t.activityLevel === filterActivity;
      return matchesSearch && matchesActivity;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name);
        case 'activity': return b.accessLast30Days - a.accessLast30Days;
        case 'aiCost': return b.aiCostCents - a.aiCostCents;
        case 'timeSpent': return b.timeSpentMinutes - a.timeSpentMinutes;
        default: return 0;
      }
    });

  const formatMinutes = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getActivityColor = (level: string) => {
    switch (level) {
      case 'very_active': return 'bg-green-100 text-green-700';
      case 'active': return 'bg-blue-100 text-blue-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const getActivityLabel = (level: string) => {
    switch (level) {
      case 'very_active': return 'Velmi aktivní';
      case 'active': return 'Aktivní';
      default: return 'Neaktivní';
    }
  };

  // Stats
  const stats = {
    total: teachers.length,
    veryActive: teachers.filter(t => t.activityLevel === 'very_active').length,
    active: teachers.filter(t => t.activityLevel === 'active').length,
    inactive: teachers.filter(t => t.activityLevel === 'inactive').length,
    totalAiCost: teachers.reduce((sum, t) => sum + t.aiCostCents, 0),
    avgTimeSpent: Math.round(teachers.reduce((sum, t) => sum + t.timeSpentMinutes, 0) / teachers.length),
  };

  if (selectedTeacher) {
    return (
      <div className="p-8">
        <TeacherDetail 
          teacher={selectedTeacher} 
          schoolName={selectedTeacher.schoolName}
          onClose={() => onSelectTeacher(null)}
          useDemoData={useDemoData}
        />
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Učitelé</h2>
        <p className="text-slate-500">Přehled všech učitelů napříč školami</p>
      </div>

      {/* Stats Cards */}
      <div className="flex flex-row gap-4 mb-6">
        <div className="flex-1 bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500 mb-1">Celkem učitelů</p>
          <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
        </div>
        <div className="flex-1 bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-sm text-green-600 mb-1">Velmi aktivní</p>
          <p className="text-2xl font-bold text-green-700">{stats.veryActive}</p>
        </div>
        <div className="flex-1 bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-sm text-blue-600 mb-1">Aktivní</p>
          <p className="text-2xl font-bold text-blue-700">{stats.active}</p>
        </div>
        <div className="flex-1 bg-slate-50 rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500 mb-1">Neaktivní</p>
          <p className="text-2xl font-bold text-slate-600">{stats.inactive}</p>
        </div>
        <div className="flex-1 bg-purple-50 rounded-xl p-4 border border-purple-200">
          <p className="text-sm text-purple-600 mb-1">Celkem AI útrata</p>
          <p className="text-2xl font-bold text-purple-700">${(stats.totalAiCost / 100).toFixed(0)}</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Hledat učitele podle jména, emailu nebo školy..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Activity Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={filterActivity}
              onChange={(e) => setFilterActivity(e.target.value as any)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Všechny úrovně</option>
              <option value="very_active">Velmi aktivní</option>
              <option value="active">Aktivní</option>
              <option value="inactive">Neaktivní</option>
            </select>
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="activity">Řadit podle aktivity</option>
            <option value="name">Řadit podle jména</option>
            <option value="aiCost">Řadit podle AI útraty</option>
            <option value="timeSpent">Řadit podle času</option>
          </select>
        </div>
      </div>

      {/* Teachers Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Učitel</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Škola</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Předmět</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Přístupy (30d)</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Čas v aplikaci</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">AI útrata</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Adopce</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTeachers.map((teacher) => (
              <tr 
                key={`${teacher.schoolId}-${teacher.id}`}
                className="hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => onSelectTeacher(teacher)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {teacher.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{teacher.name}</p>
                      <p className="text-xs text-slate-500">{teacher.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-slate-600">{teacher.schoolName}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-slate-600">{teacher.subject}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getActivityColor(teacher.activityLevel)}`}>
                    {getActivityLabel(teacher.activityLevel)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm font-medium text-slate-700">{teacher.accessLast30Days}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm text-slate-600">{formatMinutes(teacher.timeSpentMinutes)}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-sm font-medium ${teacher.aiCostCents > 300 ? 'text-purple-600' : 'text-slate-600'}`}>
                    ${(teacher.aiCostCents / 100).toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          teacher.technologyAdoption >= 80 ? 'bg-green-500' :
                          teacher.technologyAdoption >= 50 ? 'bg-blue-500' :
                          teacher.technologyAdoption >= 30 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${teacher.technologyAdoption}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500">{teacher.technologyAdoption}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredTeachers.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Žádní učitelé nenalezeni</p>
            <p className="text-sm text-slate-400">Zkuste upravit filtry nebo vyhledávání</p>
          </div>
        )}
      </div>

      {/* Results count */}
      <div className="mt-4 text-sm text-slate-500">
        Zobrazeno {filteredTeachers.length} z {teachers.length} učitelů
      </div>

      {/* Teacher Detail Sidebar */}
      {selectedTeacher && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => onSelectTeacher(null)}
          />
          
          {/* Panel */}
          <div className="relative w-full max-w-lg bg-white shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 p-6 z-10">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-xl flex items-center justify-center text-white text-xl font-bold">
                    {selectedTeacher.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">{selectedTeacher.name}</h2>
                    <p className="text-sm text-slate-500">{selectedTeacher.email}</p>
                    <p className="text-sm text-indigo-600">{selectedTeacher.schoolName}</p>
                  </div>
                </div>
                <button
                  onClick={() => onSelectTeacher(null)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl text-center">
                  <p className="text-2xl font-bold text-slate-800">{selectedTeacher.accessLast30Days}</p>
                  <p className="text-xs text-slate-500">Přístupy (30d)</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl text-center">
                  <p className="text-2xl font-bold text-slate-800">{Math.round(selectedTeacher.timeSpentMinutes / 60)}h</p>
                  <p className="text-xs text-slate-500">Čas v aplikaci</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl text-center">
                  <p className="text-2xl font-bold text-purple-600">${(selectedTeacher.aiCostCents / 100).toFixed(0)}</p>
                  <p className="text-xs text-slate-500">AI útrata</p>
                </div>
              </div>

              {/* NPS Section */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-semibold text-slate-800">NPS Historie</h3>
                  </div>
                  <button
                    onClick={triggerManualNPS}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    Zeptat se na NPS
                  </button>
                </div>

                <div className="p-4">
                  {isLoadingNPS ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                    </div>
                  ) : teacherNPSHistory.length > 0 ? (
                    <div className="space-y-3">
                      {teacherNPSHistory.map((nps) => (
                        <div key={nps.id} className="border border-slate-100 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                                nps.category === 'promoter' ? 'bg-green-100 text-green-700' :
                                nps.category === 'passive' ? 'bg-amber-100 text-amber-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {nps.score}
                              </span>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                nps.category === 'promoter' ? 'bg-green-50 text-green-600' :
                                nps.category === 'passive' ? 'bg-amber-50 text-amber-600' :
                                'bg-red-50 text-red-600'
                              }`}>
                                {nps.category === 'promoter' ? 'Promotér' : nps.category === 'passive' ? 'Pasivní' : 'Kritik'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              {nps.triggered_by === 'manual' && (
                                <span className="bg-slate-100 px-2 py-0.5 rounded">Ruční</span>
                              )}
                              <span>{new Date(nps.created_at).toLocaleDateString('cs-CZ')}</span>
                            </div>
                          </div>
                          {nps.feedback && (
                            <p className="text-sm text-slate-600 bg-slate-50 p-2 rounded-lg mt-2">
                              "{nps.feedback}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <MessageSquare className="w-6 h-6 text-slate-400" />
                      </div>
                      <p className="text-slate-600 font-medium mb-1">Zatím žádné NPS odpovědi</p>
                      <p className="text-sm text-slate-400">Klikněte na "Zeptat se na NPS" pro ruční dotaz</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Activity Details */}
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="font-semibold text-slate-800 mb-3">Aktivita</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Předmět</span>
                    <span className="font-medium text-slate-800">{selectedTeacher.subject}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Stav</span>
                    <span className={`font-medium ${getActivityColor(selectedTeacher.activityLevel).replace('bg-', 'text-').replace('-100', '-700')}`}>
                      {getActivityLabel(selectedTeacher.activityLevel)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Poslední aktivita</span>
                    <span className="font-medium text-slate-800">
                      {new Date(selectedTeacher.lastActive).toLocaleDateString('cs-CZ')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Dokumenty</span>
                    <span className="font-medium text-slate-800">{selectedTeacher.documentsCreated}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Pracovní listy</span>
                    <span className="font-medium text-slate-800">{selectedTeacher.worksheetsCreated}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Třídy</span>
                    <span className="font-medium text-slate-800">{selectedTeacher.classesCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NPS Popup for manual trigger */}
      {showNPSPopup && selectedTeacher && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowNPSPopup(false)} />
          <div className="relative w-full max-w-lg mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-8">
              <button
                onClick={() => setShowNPSPopup(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-1">NPS pro {selectedTeacher.name}</h2>
                <p className="text-slate-500 text-sm">Ruční zadání NPS odpovědi</p>
              </div>
              
              <NPSManualInput onSubmit={submitTeacherNPS} onCancel={() => setShowNPSPopup(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// NPS Manual Input Component
const NPSManualInput: React.FC<{ onSubmit: (score: number, feedback: string) => void; onCancel: () => void }> = ({ onSubmit, onCancel }) => {
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [step, setStep] = useState<'score' | 'feedback'>('score');

  const getScoreColor = (s: number, selected: number | null) => {
    if (selected === s) {
      if (s <= 6) return 'bg-red-500 text-white ring-4 ring-red-200';
      if (s <= 8) return 'bg-amber-500 text-white ring-4 ring-amber-200';
      return 'bg-green-500 text-white ring-4 ring-green-200';
    }
    if (s <= 6) return 'bg-red-100 text-red-600 hover:bg-red-200';
    if (s <= 8) return 'bg-amber-100 text-amber-600 hover:bg-amber-200';
    return 'bg-green-100 text-green-600 hover:bg-green-200';
  };

  if (step === 'score') {
    return (
      <>
        <div className="flex justify-center gap-2 mb-4">
          {[0,1,2,3,4,5,6,7,8,9,10].map(s => (
            <button
              key={s}
              onClick={() => setScore(s)}
              className={`w-9 h-9 rounded-lg font-semibold text-sm transition-all ${getScoreColor(s, score)}`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-xs text-slate-500 mb-6">
          <span>Vůbec ne</span>
          <span>Rozhodně ano</span>
        </div>
        <button
          onClick={() => score !== null && setStep('feedback')}
          disabled={score === null}
          className={`w-full py-3 rounded-xl font-semibold transition-all ${
            score !== null ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          Pokračovat
        </button>
      </>
    );
  }

  return (
    <>
      <div className="mb-4">
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-lg font-bold ${
            score! <= 6 ? 'bg-red-100 text-red-700' : score! <= 8 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
          }`}>
            {score}
          </span>
        </div>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Volitelná zpětná vazba..."
          className="w-full h-24 p-3 border-2 border-slate-200 rounded-xl resize-none focus:border-indigo-500 outline-none"
        />
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => setStep('score')}
          className="flex-1 py-3 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200"
        >
          Zpět
        </button>
        <button
          onClick={() => onSubmit(score!, feedback)}
          className="flex-1 py-3 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Uložit
        </button>
      </div>
    </>
  );
};

// ============================================
// UPOZORNĚNÍ VIEW
// ============================================

// Gemini API klíč z environment variables
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

interface AlertsViewProps {
  alerts: typeof DEMO_ALERTS;
  schools: School[];
}

const AlertsView: React.FC<AlertsViewProps> = ({ alerts: initialAlerts, schools }) => {
  const analytics = useAnalytics();
  
  // AI Agent hook
  const { 
    generateAlerts, 
    fetchAlerts, 
    updateAlertStatus: updateAlertStatusInDb,
    isGenerating, 
    progress, 
    lastGeneration,
    localAlerts 
  } = useAlertAgent();

  // Combined alerts: AI-generated + demo fallback
  const [aiAlerts, setAiAlerts] = useState<Alert[]>([]);
  const [useAiAlerts, setUseAiAlerts] = useState(false);
  const [hasLoadedFromDb, setHasLoadedFromDb] = useState(false);
  
  // Use AI alerts if available (from local or DB), otherwise fall back to demo
  const combinedAiAlerts = [...localAlerts, ...aiAlerts];
  const alerts = useAiAlerts && combinedAiAlerts.length > 0 ? combinedAiAlerts : initialAlerts;
  
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedAlert, setSelectedAlertInternal] = useState<typeof alerts[0] | null>(null);
  const [alertStatuses, setAlertStatuses] = useState<Record<string, string>>(
    Object.fromEntries(alerts.map(a => [a.id, a.status]))
  );
  
  // Wrap setSelectedAlert to track alert views
  const setSelectedAlert = (alert: typeof alerts[0] | null) => {
    setSelectedAlertInternal(alert);
    if (alert) {
      analytics.trackAlertViewed(alert.id, alert.type, alert.severity);
    }
  };
  
  // AI Email generator state
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState<{ subject: string; body: string } | null>(null);
  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const [emailTone, setEmailTone] = useState<'formal' | 'friendly' | 'urgent'>('friendly');
  const [customAIInput, setCustomAIInput] = useState('');

  // Load existing alerts from Supabase on mount
  useEffect(() => {
    const loadExistingAlerts = async () => {
      try {
        const existingAlerts = await fetchAlerts({ limit: 50 });
        if (existingAlerts.length > 0) {
          setAiAlerts(existingAlerts.map(a => ({
            ...a,
            severity: a.severity === 'critical' ? 'high' : a.severity,
          })) as any);
          setUseAiAlerts(true);
          setAlertStatuses(Object.fromEntries(existingAlerts.map(a => [a.id, a.status])));
        }
        setHasLoadedFromDb(true);
      } catch (err) {
        console.warn('Could not load alerts from database:', err);
        setHasLoadedFromDb(true);
      }
    };
    loadExistingAlerts();
  }, [fetchAlerts]);

  // Update statuses when alerts change
  useEffect(() => {
    setAlertStatuses(Object.fromEntries(alerts.map(a => [a.id, a.status])));
  }, [alerts]);

  // Handle AI alert generation
  const handleGenerateAlerts = async () => {
    const schoolsData = schools.map(s => ({
      id: s.id,
      name: s.name,
      totalTeachers: s.totalTeachers,
      activeTeachers: s.activeTeachers,
      totalStudents: s.totalStudents,
      activeStudents: s.activeStudents,
      licenseExpiry: s.licenseExpiry,
      monthlyAICost: s.monthlyAICost,
      monthlyAccess: s.monthlyAccess,
      lastActivity: s.lastActivity,
      trend: s.trend,
      healthScore: s.healthScore,
      activityLevel: s.activityLevel,
      contact: s.contact,
      subjectLicenses: s.subjectLicenses,
      hasEcosystemVividbooks: s.hasEcosystemVividbooks,
      hasVividboard: s.hasVividboard,
      hasVividboardWall: s.hasVividboardWall,
      teachers: s.teachers?.map(t => ({
        id: t.id,
        name: t.name,
        email: t.email,
        subject: t.subject,
        monthlyAccess: t.monthlyAccess,
        lastActive: t.lastActive,
        activityLevel: t.activityLevel,
      })),
    }));

    const result = await generateAlerts(schoolsData, { maxAlerts: 10, saveToSupabase: true });
    
    // Track AI alerts generation
    analytics.trackAIAlertsGenerated(result.alerts.length, schoolsData.length);
    
    if (result.alerts.length > 0) {
      // Switch to AI mode - alerts are now in localAlerts from the hook
      setUseAiAlerts(true);
      
      // Also try to fetch from DB (will return localAlerts if DB unavailable)
      const updatedAlerts = await fetchAlerts({ limit: 50 });
      if (updatedAlerts.length > 0) {
        setAiAlerts(updatedAlerts.map(a => ({
          ...a,
          severity: a.severity === 'critical' ? 'high' : a.severity,
        })) as any);
      }
      setAlertStatuses(Object.fromEntries(updatedAlerts.map(a => [a.id, a.status])));
    }
  };

  // Generate email using Gemini AI
  const generateEmail = async (alert: typeof alerts[0]) => {
    setIsGeneratingEmail(true);
    setGeneratedEmail(null);
    setShowEmailPanel(true);

    const toneInstructions = {
      formal: 'Formální, profesionální tón. Používej vykání.',
      friendly: 'Přátelský, ale profesionální tón. Můžeš tykát pokud je to přirozené.',
      urgent: 'Naléhavý tón zdůrazňující důležitost. Používej vykání.'
    };

    const prompt = `Jsi Customer Success manažer ve společnosti Vividbooks (vzdělávací platforma pro školy).

KONTEXT UPOZORNĚNÍ:
- Typ: ${alert.type === 'churn_risk' ? 'Riziko odchodu zákazníka' : alert.type === 'upsell' ? 'Příležitost pro upsell' : alert.type === 'renewal' ? 'Blížící se obnovení licence' : 'Nízký engagement'}
- Priorita: ${alert.severity === 'high' ? 'Vysoká' : alert.severity === 'medium' ? 'Střední' : 'Nízká'}
- Škola: ${alert.schoolName}
- Problém/Příležitost: ${alert.title}
- Detail: ${alert.description}
- Doporučení systému: ${alert.recommendation}

POŽADAVEK:
Napiš email pro kontaktní osobu ve škole.
Tón: ${toneInstructions[emailTone]}
${customAIInput ? `\nDODATEČNÉ POKYNY OD UŽIVATELE:\n${customAIInput}` : ''}

FORMÁT ODPOVĚDI (JSON):
{
  "subject": "Předmět emailu",
  "body": "Tělo emailu v HTML formátu. Použij <p> pro odstavce, <strong> pro zvýraznění, <br> pro odřádkování. Zahrň pozdrav, hlavní sdělení, nabídku pomoci a podpis."
}

Odpověz POUZE validním JSON objektem.`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048,
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error('API error');
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setGeneratedEmail({
          subject: parsed.subject || 'Email ze Vividbooks',
          body: parsed.body || ''
        });
        // Track email generation
        analytics.trackAIEmailGenerated(alert.id, emailTone, alert.schoolId);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error generating email:', error);
      setGeneratedEmail({
        subject: 'Chyba při generování',
        body: '<p>Nepodařilo se vygenerovat email. Zkuste to prosím znovu.</p>'
      });
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  // Generate follow-up suggestions
  const generateFollowUp = async (alert: typeof alerts[0]) => {
    setIsGeneratingEmail(true);

    const prompt = `Jsi Customer Success manažer. Na základě tohoto upozornění navrhni 3 konkrétní kroky, které by měl CS manažer udělat:

Škola: ${alert.schoolName}
Problém: ${alert.title}
Detail: ${alert.description}

Odpověz jako JSON pole s 3 objekty:
[
  { "action": "Konkrétní akce", "priority": "high/medium/low", "timeframe": "ihned/tento týden/tento měsíc" },
  ...
]`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
          })
        }
      );

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log('Follow-up suggestions:', text);
      // Could display these in the UI
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'churn_risk': return AlertTriangle;
      case 'upsell': return TrendingUp;
      case 'renewal': return Clock;
      case 'engagement': return Users;
      default: return Bell;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'churn_risk': return 'Riziko odchodu';
      case 'upsell': return 'Příležitost';
      case 'renewal': return 'Obnovení';
      case 'engagement': return 'Engagement';
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'churn_risk': return 'text-red-600 bg-red-50';
      case 'upsell': return 'text-green-600 bg-green-50';
      case 'renewal': return 'text-amber-600 bg-amber-50';
      case 'engagement': return 'text-blue-600 bg-blue-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-amber-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-slate-500';
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'high': return 'Vysoká';
      case 'medium': return 'Střední';
      case 'low': return 'Nízká';
      default: return severity;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new': return <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full flex items-center gap-1"><span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />Nové</span>;
      case 'acknowledged': return <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">Přijato</span>;
      case 'in_progress': return <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">Řeší se</span>;
      case 'resolved': return <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Vyřešeno</span>;
      default: return null;
    }
  };

  const updateStatus = (alertId: string, newStatus: string) => {
    setAlertStatuses(prev => ({ ...prev, [alertId]: newStatus }));
    
    // Track alert status change
    if (newStatus === 'resolved') {
      const alert = alerts.find(a => a.id === alertId);
      if (alert) {
        analytics.trackAlertResolved(alertId, alert.type);
      }
    }
  };

  // Stats
  const stats = {
    total: alerts.length,
    new: alerts.filter(a => alertStatuses[a.id] === 'new').length,
    inProgress: alerts.filter(a => alertStatuses[a.id] === 'in_progress').length,
    resolved: alerts.filter(a => alertStatuses[a.id] === 'resolved').length,
    high: alerts.filter(a => a.severity === 'high').length,
    churnRisk: alerts.filter(a => a.type === 'churn_risk').length,
    upsell: alerts.filter(a => a.type === 'upsell').length,
  };

  // Filtered alerts
  const filteredAlerts = alerts.filter(a => {
    if (filterType !== 'all' && a.type !== filterType) return false;
    if (filterSeverity !== 'all' && a.severity !== filterSeverity) return false;
    if (filterStatus !== 'all' && alertStatuses[a.id] !== filterStatus) return false;
    return true;
  });

  // Sort by severity and status
  const sortedAlerts = [...filteredAlerts].sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    const statusOrder = { new: 0, in_progress: 1, acknowledged: 2, resolved: 3 };
    const statusA = alertStatuses[a.id];
    const statusB = alertStatuses[b.id];
    if (statusOrder[statusA as keyof typeof statusOrder] !== statusOrder[statusB as keyof typeof statusOrder]) {
      return statusOrder[statusA as keyof typeof statusOrder] - statusOrder[statusB as keyof typeof statusOrder];
    }
    return severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder];
  });

  return (
    <div className="p-8">
      {/* Header with AI Generator */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Upozornění</h2>
            <p className="text-slate-500">Důležitá upozornění, rizika a příležitosti</p>
          </div>
          
          {/* AI Agent Controls */}
          <div className="flex items-center gap-3">
            {/* Source Toggle - Simple Buttons */}
            <div className="flex items-center bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setUseAiAlerts(false)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  !useAiAlerts 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Demo
              </button>
              <button
                onClick={() => setUseAiAlerts(true)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1 ${
                  useAiAlerts 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Bot className="h-3.5 w-3.5" />
                AI
              </button>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerateAlerts}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 text-white font-medium rounded-lg transition-all disabled:opacity-50 shadow-md hover:shadow-lg"
              style={{ backgroundColor: '#4f46e5' }}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">{progress.status || 'Generuji...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Generovat AI upozornění</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Generation Result Banner */}
        {lastGeneration && !isGenerating && (
          <div className={`mt-4 p-3 rounded-xl flex items-center gap-3 ${
            lastGeneration.error 
              ? 'bg-red-50 border border-red-200' 
              : 'bg-green-50 border border-green-200'
          }`}>
            {lastGeneration.error ? (
              <>
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <span className="text-sm text-red-700">Chyba: {lastGeneration.error}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="text-sm text-green-700">
                  Analyzováno {lastGeneration.schoolsAnalyzed} škol • 
                  Vygenerováno {lastGeneration.alertsGenerated} nových upozornění
                  {lastGeneration.alertsSkipped > 0 && ` • ${lastGeneration.alertsSkipped} přeskočeno (duplicity)`}
                </span>
              </>
            )}
          </div>
        )}

        {/* AI Info Banner */}
        {useAiAlerts && combinedAiAlerts.length > 0 && (
          <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center gap-3">
            <Bot className="h-5 w-5 text-indigo-600" />
            <span className="text-sm text-indigo-700">
              Zobrazuji {combinedAiAlerts.length} AI-generovaných upozornění
              {localAlerts.length > 0 && ` (${localAlerts.length} v lokální paměti)`}
            </span>
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="flex flex-row gap-4 mb-6">
        <div className="flex-1 bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Bell className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
              <p className="text-xs text-slate-500">Celkem</p>
            </div>
          </div>
        </div>
        <div className="flex-1 bg-red-50 rounded-xl p-4 border border-red-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-700">{stats.new}</p>
              <p className="text-xs text-red-600">Nových</p>
            </div>
          </div>
        </div>
        <div className="flex-1 bg-blue-50 rounded-xl p-4 border border-blue-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-700">{stats.inProgress}</p>
              <p className="text-xs text-blue-600">Řeší se</p>
            </div>
          </div>
        </div>
        <div className="flex-1 bg-green-50 rounded-xl p-4 border border-green-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-700">{stats.resolved}</p>
              <p className="text-xs text-green-600">Vyřešeno</p>
            </div>
          </div>
        </div>
        <div className="flex-1 bg-amber-50 rounded-xl p-4 border border-amber-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-700">{stats.upsell}</p>
              <p className="text-xs text-amber-600">Příležitostí</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-600">Filtry:</span>
          </div>
          
          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              analytics.trackFilterApplied('alert_type', e.target.value);
            }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Všechny typy</option>
            <option value="churn_risk">🔴 Riziko odchodu</option>
            <option value="upsell">🟢 Příležitost</option>
            <option value="renewal">🟡 Obnovení</option>
            <option value="engagement">🔵 Engagement</option>
          </select>

          {/* Severity filter */}
          <select
            value={filterSeverity}
            onChange={(e) => {
              setFilterSeverity(e.target.value);
              analytics.trackFilterApplied('alert_severity', e.target.value);
            }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Všechny priority</option>
            <option value="high">⚠️ Vysoká</option>
            <option value="medium">Střední</option>
            <option value="low">Nízká</option>
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              analytics.trackFilterApplied('alert_status', e.target.value);
            }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Všechny stavy</option>
            <option value="new">Nové</option>
            <option value="in_progress">Řeší se</option>
            <option value="acknowledged">Přijato</option>
            <option value="resolved">Vyřešeno</option>
          </select>

          {(filterType !== 'all' || filterSeverity !== 'all' || filterStatus !== 'all') && (
            <button
              onClick={() => { setFilterType('all'); setFilterSeverity('all'); setFilterStatus('all'); }}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Resetovat filtry
            </button>
          )}

          <span className="ml-auto text-sm text-slate-500">
            Zobrazeno {filteredAlerts.length} z {alerts.length}
          </span>
        </div>
      </div>

      {/* Alerts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sortedAlerts.map((alert) => {
          const Icon = getAlertIcon(alert.type);
          const currentStatus = alertStatuses[alert.id];
          const isNew = currentStatus === 'new';
          
          return (
            <div 
              key={alert.id} 
              className={`bg-white rounded-2xl border-2 overflow-hidden transition-all hover:shadow-lg cursor-pointer ${
                isNew ? 'border-red-200 ring-2 ring-red-100' : 
                currentStatus === 'resolved' ? 'border-green-200 opacity-75' : 'border-slate-200'
              }`}
              onClick={() => { setSelectedAlert(alert); setShowEmailPanel(false); setGeneratedEmail(null); setCustomAIInput(''); }}
            >
              {/* Header with severity indicator */}
              <div className={`h-1.5 ${getSeverityColor(alert.severity)}`} />
              
              <div className="p-5">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`p-3 rounded-xl ${getTypeColor(alert.type)}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-800 truncate">{alert.title}</h3>
                        <p className="text-sm text-slate-500">{alert.schoolName}</p>
                      </div>
                      {getStatusBadge(currentStatus)}
                    </div>
                    
                    <p className="text-sm text-slate-600 mb-3 line-clamp-2">{alert.description}</p>
                    
                    {/* Tags */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(alert.type)}`}>
                        {getTypeLabel(alert.type)}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        alert.severity === 'high' ? 'bg-red-100 text-red-700' :
                        alert.severity === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {getSeverityLabel(alert.severity)}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {currentStatus === 'new' && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); updateStatus(alert.id, 'in_progress'); }}
                          className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                          Začít řešit
                        </button>
                      )}
                      {currentStatus === 'in_progress' && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); updateStatus(alert.id, 'resolved'); }}
                          className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
                        >
                          ✓ Vyřešeno
                        </button>
                      )}
                      {currentStatus === 'resolved' && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); updateStatus(alert.id, 'new'); }}
                          className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-200 transition-colors"
                        >
                          Znovu otevřít
                        </button>
                      )}
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedAlert(alert); setShowEmailPanel(false); setGeneratedEmail(null); }}
                        className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1"
                      >
                        <ChevronRight className="h-3 w-3" />
                        Detail
                      </button>
                      <span className="text-xs text-slate-400 ml-auto">
                        {formatRelativeTime(alert.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredAlerts.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <Bell className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Žádná upozornění</p>
          <p className="text-sm text-slate-400">Zkuste změnit filtry</p>
        </div>
      )}

      {/* Detail Modal */}
      {selectedAlert && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedAlert(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`p-6 border-b ${
              selectedAlert.severity === 'high' ? 'bg-red-50 border-red-200' :
              selectedAlert.severity === 'medium' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${getTypeColor(selectedAlert.type)}`}>
                    {React.createElement(getAlertIcon(selectedAlert.type), { className: "h-6 w-6" })}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">{selectedAlert.title}</h2>
                    <p className="text-slate-600">{selectedAlert.schoolName}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedAlert(null)}
                  className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                >
                  <span className="text-2xl text-slate-400">&times;</span>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* AI Email Generator - FIRST so it's always visible */}
              <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 p-4 rounded-xl border border-indigo-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-lg">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-slate-800">AI Email</h3>
                </div>

                {!showEmailPanel ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-1">
                      {[
                        { id: 'formal', label: '👔 Formální' },
                        { id: 'friendly', label: '😊 Přátelský' },
                        { id: 'urgent', label: '⚡ Naléhavý' },
                      ].map((tone) => (
                        <button
                          key={tone.id}
                          onClick={() => setEmailTone(tone.id as any)}
                          className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            emailTone === tone.id
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white border border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {tone.label}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={customAIInput}
                      onChange={(e) => setCustomAIInput(e.target.value)}
                      placeholder="Vlastní pokyny pro AI..."
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                    <button
                      onClick={() => generateEmail(selectedAlert!)}
                      disabled={isGeneratingEmail}
                      className="flex-shrink-0 px-4 py-2 bg-white text-black font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {isGeneratingEmail ? (
                        <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4" />
                      )}
                      Vygenerovat email
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {isGeneratingEmail ? (
                      <div className="flex flex-col items-center justify-center py-8">
                        <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3" />
                        <p className="text-sm text-slate-600">AI generuje email...</p>
                        <p className="text-xs text-slate-400">Analyzuji data a vytvářím personalizovanou zprávu</p>
                      </div>
                    ) : generatedEmail ? (
                      <>
                        {/* Email Preview */}
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                            <p className="text-xs text-slate-500 mb-1">Předmět:</p>
                            <p className="font-medium text-slate-800">{generatedEmail.subject}</p>
                          </div>
                          <div 
                            className="p-4 prose prose-sm max-w-none text-slate-700"
                            dangerouslySetInnerHTML={{ __html: generatedEmail.body }}
                          />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(
                                `Předmět: ${generatedEmail.subject}\n\n${generatedEmail.body.replace(/<[^>]*>/g, '')}`
                              );
                            }}
                            className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                          >
                            <Database className="h-4 w-4" />
                            Kopírovat
                          </button>
                          <button
                            onClick={() => generateEmail(selectedAlert!)}
                            className="flex-1 px-4 py-2 bg-indigo-100 text-indigo-700 font-medium rounded-lg hover:bg-indigo-200 transition-colors flex items-center justify-center gap-2"
                          >
                            <Zap className="h-4 w-4" />
                            Přegenerovat
                          </button>
                          <button
                            onClick={() => {
                              const mailto = `mailto:?subject=${encodeURIComponent(generatedEmail.subject)}&body=${encodeURIComponent(generatedEmail.body.replace(/<[^>]*>/g, ''))}`;
                              window.open(mailto);
                            }}
                            className="flex-1 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                          >
                            <Mail className="h-4 w-4" />
                            Otevřít v emailu
                          </button>
                        </div>

                        <button
                          onClick={() => { setShowEmailPanel(false); setGeneratedEmail(null); }}
                          className="w-full text-sm text-slate-500 hover:text-slate-700"
                        >
                          ← Zpět na výběr tónu
                        </button>
                      </>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Brief Description */}
              <div className="bg-slate-50 p-3 rounded-xl">
                <p className="text-sm text-slate-600">{selectedAlert.description}</p>
                <p className="text-xs text-indigo-600 mt-2">💡 {selectedAlert.recommendation}</p>
              </div>

              {/* Quick Actions */}
              <div>
                <h3 className="font-semibold text-slate-800 mb-3">Další akce</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button className="flex items-center gap-2 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors text-left">
                    <Phone className="h-5 w-5 text-slate-600" />
                    <div>
                      <p className="font-medium text-slate-800 text-sm">Zavolat</p>
                      <p className="text-xs text-slate-500">Přímý kontakt</p>
                    </div>
                  </button>
                  <button className="flex items-center gap-2 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors text-left">
                    <Calendar className="h-5 w-5 text-slate-600" />
                    <div>
                      <p className="font-medium text-slate-800 text-sm">Naplánovat schůzku</p>
                      <p className="text-xs text-slate-500">Osobní jednání</p>
                    </div>
                  </button>
                  <button className="flex items-center gap-2 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors text-left">
                    <Building2 className="h-5 w-5 text-slate-600" />
                    <div>
                      <p className="font-medium text-slate-800 text-sm">Zobrazit školu</p>
                      <p className="text-xs text-slate-500">Detail školy</p>
                    </div>
                  </button>
                  <button 
                    onClick={() => generateFollowUp(selectedAlert!)}
                    className="flex items-center gap-2 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 rounded-xl transition-colors text-left border border-indigo-100"
                  >
                    <Sparkles className="h-5 w-5 text-indigo-600" />
                    <div>
                      <p className="font-medium text-slate-800 text-sm">AI návrhy kroků</p>
                      <p className="text-xs text-slate-500">Doporučené akce</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Status Actions */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
                {alertStatuses[selectedAlert.id] === 'new' && (
                  <>
                    <button 
                      onClick={() => { updateStatus(selectedAlert.id, 'in_progress'); setSelectedAlert(null); }}
                      className="flex-1 px-4 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors"
                    >
                      Začít řešit
                    </button>
                    <button 
                      onClick={() => { updateStatus(selectedAlert.id, 'acknowledged'); }}
                      className="px-4 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors"
                    >
                      Přijmout
                    </button>
                  </>
                )}
                {alertStatuses[selectedAlert.id] === 'in_progress' && (
                  <button 
                    onClick={() => { updateStatus(selectedAlert.id, 'resolved'); setSelectedAlert(null); }}
                    className="flex-1 px-4 py-3 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-colors"
                  >
                    ✓ Označit jako vyřešené
                  </button>
                )}
                {alertStatuses[selectedAlert.id] === 'resolved' && (
                  <button 
                    onClick={() => { updateStatus(selectedAlert.id, 'new'); }}
                    className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Znovu otevřít
                  </button>
                )}
                <button 
                  onClick={() => setSelectedAlert(null)}
                  className="px-4 py-3 text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Zavřít
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// HELPER COMPONENTS
// ============================================

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  change?: number;
  changeLabel?: string;
  color: 'blue' | 'green' | 'purple' | 'red';
  invertChange?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ 
  icon: Icon, 
  label, 
  value, 
  subValue,
  change, 
  changeLabel, 
  color,
  invertChange 
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
  };

  const isPositive = invertChange ? (change ?? 0) < 0 : (change ?? 0) > 0;

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-800">
        {value}
        {subValue && <span className="text-sm text-slate-400 font-normal ml-1">{subValue}</span>}
      </p>
      {changeLabel && <p className="text-xs text-slate-400 mt-1">{changeLabel}</p>}
    </div>
  );
};

interface QuickActionCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  buttonLabel: string;
  color: 'red' | 'amber' | 'blue';
}

const QuickActionCard: React.FC<QuickActionCardProps> = ({ icon: Icon, title, description, buttonLabel, color }) => {
  const colors = {
    red: 'bg-red-50 border-red-100 text-red-600',
    amber: 'bg-amber-50 border-amber-100 text-amber-600',
    blue: 'bg-blue-50 border-blue-100 text-blue-600',
  };

  return (
    <div className={`p-6 rounded-2xl border-2 ${colors[color]}`}>
      <Icon className="h-8 w-8 mb-4" />
      <h3 className="font-bold text-slate-800 mb-1">{title}</h3>
      <p className="text-sm text-slate-600 mb-4">{description}</p>
      <button className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors">
        {buttonLabel}
      </button>
    </div>
  );
};

interface HealthBadgeProps {
  score: number;
  size?: 'small' | 'large';
}

const HealthBadge: React.FC<HealthBadgeProps> = ({ score, size = 'small' }) => {
  const getColor = () => {
    if (score >= 80) return 'bg-green-100 text-green-700 border-green-200';
    if (score >= 60) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (score >= 40) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  if (size === 'large') {
    return (
      <div className={`px-4 py-2 rounded-xl border ${getColor()}`}>
        <p className="text-xs opacity-70">Health Score</p>
        <p className="text-2xl font-bold">{score}</p>
      </div>
    );
  }

  return (
    <span className={`px-2 py-1 text-xs font-bold rounded-lg border ${getColor()}`}>
      {score}
    </span>
  );
};

// ============================================
// UTILS
// ============================================

// Generate teacher activity trend for a school (50 weeks)
function generateSchoolTeacherTrend(totalTeachers: number, currentActive: number) {
  const data = [];
  const now = new Date();
  
  // Starting values (school grew over time)
  const startTotal = Math.floor(totalTeachers * 0.7);
  const startActive = Math.floor(startTotal * 0.4);
  
  for (let i = 49; i >= 0; i--) {
    const weekDate = new Date(now);
    weekDate.setDate(weekDate.getDate() - (i * 7));
    const weekNum = getWeekNumber(weekDate);
    
    // Generate realistic trend - both total and active grow over time
    const progress = (50 - i) / 50;
    
    // Total teachers grows gradually with some variation
    const total = Math.floor(startTotal + (totalTeachers - startTotal) * progress + (Math.random() * 2 - 1));
    
    // Active teachers ratio improves over time
    const targetActiveRatio = currentActive / totalTeachers;
    const startActiveRatio = 0.35;
    const activeRatio = startActiveRatio + (targetActiveRatio - startActiveRatio) * progress;
    const active = Math.min(total, Math.max(1, Math.floor(total * activeRatio + (Math.random() * 3 - 1.5))));
    
    data.push({
      week: `T${weekNum}`,
      active,
      inactive: Math.max(0, total - active)
    });
  }
  
  return data;
}

// Generate access trend for a school (50 weeks)
function generateSchoolAccessTrend(monthlyAccess: number, totalTeachers: number, totalStudents: number) {
  const data = [];
  const now = new Date();
  const weeklyAccess = monthlyAccess / 4;
  const teacherRatio = totalTeachers / (totalTeachers + totalStudents);
  
  for (let i = 49; i >= 0; i--) {
    const weekDate = new Date(now);
    weekDate.setDate(weekDate.getDate() - (i * 7));
    const weekNum = getWeekNumber(weekDate);
    
    // Generate realistic trend with growth
    const progress = (50 - i) / 50;
    const multiplier = 0.3 + (progress * 0.7) + (Math.random() * 0.2 - 0.1);
    const weekTotal = Math.floor(weeklyAccess * multiplier);
    
    // Weekend drop
    const isSchoolWeek = true; // Simplified
    const accessMultiplier = isSchoolWeek ? 1 : 0.2;
    
    const teachers = Math.floor(weekTotal * teacherRatio * 0.3 * accessMultiplier);
    const students = Math.floor(weekTotal * (1 - teacherRatio) * accessMultiplier);
    
    data.push({
      week: `T${weekNum}`,
      teachers: Math.max(5, teachers),
      students: Math.max(10, students)
    });
  }
  
  return data;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `před ${diffMins} min`;
  if (diffHours < 24) return `před ${diffHours} hod`;
  if (diffDays === 1) return 'včera';
  if (diffDays < 7) return `před ${diffDays} dny`;
  return date.toLocaleDateString('cs-CZ');
}

export default CustomerSuccess;

