import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { setStudentAuthChangeCallback, StudentProfile as AuthStudentProfile } from './StudentAuthContext';
import { UserRole, StudentProfile, StudentAssignment, StudentTestResult, TeacherEvaluation, StudentActivity } from '../types/profile';

// Mock student data
export const MOCK_STUDENT: StudentProfile = {
  id: 'student-1',
  userId: 'student-user-1',
  email: 'jan.novak@student.zs-dukelska.cz',
  name: 'Jan Novák',
  role: 'student',
  schoolId: 'school-1',
  classId: 'class-6a',
  className: '6.A',
  grade: 6,
  avatarUrl: '',
  createdAt: '2024-09-01',
  lastActiveAt: new Date().toISOString(),
  stats: {
    completedLessons: 24,
    totalLessons: 45,
    averageScore: 78,
    lastActivity: new Date().toISOString(),
    streakDays: 5,
  },
};

// Mock assignments
export const MOCK_ASSIGNMENTS: StudentAssignment[] = [
  {
    id: 'assign-1',
    title: 'Síly a jejich působení',
    description: 'Projděte si lekci o silách a vypracujte pracovní list',
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    assignedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    assignedBy: 'Mgr. Petra Svobodová',
    subjectId: 'fyzika',
    subjectName: 'Fyzika',
    type: 'lesson',
    completed: false,
  },
  {
    id: 'assign-2',
    title: 'Chemické prvky - procvičování',
    description: 'Dokončete interaktivní cvičení na chemické prvky',
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    assignedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    assignedBy: 'RNDr. Karel Malý',
    subjectId: 'chemie',
    subjectName: 'Chemie',
    type: 'worksheet',
    completed: false,
  },
  {
    id: 'assign-3',
    title: 'Stavba těla člověka',
    assignedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    assignedBy: 'Mgr. Jana Horáková',
    subjectId: 'prirodopis',
    subjectName: 'Přírodopis',
    type: 'material',
    completed: true,
    completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// Mock test results
export const MOCK_TEST_RESULTS: StudentTestResult[] = [
  {
    id: 'test-1',
    testName: 'Mechanika - základy',
    subjectName: 'Fyzika',
    score: 18,
    maxScore: 20,
    percentage: 90,
    completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    teacherComment: 'Výborná práce! Jen pozor na jednotky.',
    grade: '1',
  },
  {
    id: 'test-2',
    testName: 'Periodická tabulka',
    subjectName: 'Chemie',
    score: 14,
    maxScore: 20,
    percentage: 70,
    completedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    grade: '3',
  },
  {
    id: 'test-3',
    testName: 'Buňka a její části',
    subjectName: 'Přírodopis',
    score: 17,
    maxScore: 20,
    percentage: 85,
    completedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    teacherComment: 'Pěkně zpracované.',
    grade: '2',
  },
];

// Mock evaluations
export const MOCK_EVALUATIONS: TeacherEvaluation[] = [
  {
    id: 'eval-1',
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    teacherName: 'Mgr. Petra Svobodová',
    subjectName: 'Fyzika',
    type: 'praise',
    message: 'Výborná aktivita v hodině, skvělé dotazy!',
  },
  {
    id: 'eval-2',
    date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    teacherName: 'RNDr. Karel Malý',
    subjectName: 'Chemie',
    type: 'note',
    message: 'Nezapomeň si doplnit poznámky z minulé hodiny.',
  },
];

// Mock activities
export const MOCK_ACTIVITIES: StudentActivity[] = [
  {
    id: 'act-1',
    type: 'lesson_completed',
    title: 'Newtonovy zákony',
    subjectName: 'Fyzika',
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'act-2',
    type: 'test_completed',
    title: 'Mechanika - základy',
    subjectName: 'Fyzika',
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    details: '90%',
  },
  {
    id: 'act-3',
    type: 'material_viewed',
    title: 'Chemické reakce - video',
    subjectName: 'Chemie',
    timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'act-4',
    type: 'assignment_submitted',
    title: 'Pracovní list - Síly',
    subjectName: 'Fyzika',
    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// Shared folder type for students
export interface SharedFolder {
  id: string;
  name: string;
  color: string;
  sharedBy: string; // Teacher name
  sharedAt: string;
  itemCount: number;
}

interface ViewModeContextType {
  viewMode: UserRole;
  setViewMode: (mode: UserRole) => void;
  isStudent: boolean;
  isTeacher: boolean;
  currentStudent: StudentProfile | null;
  studentAssignments: StudentAssignment[];
  studentTestResults: StudentTestResult[];
  studentEvaluations: TeacherEvaluation[];
  studentActivities: StudentActivity[];
  sharedFolders: SharedFolder[];
  refreshSharedFolders: () => void;
}

const ViewModeContext = createContext<ViewModeContextType | null>(null);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<UserRole>('teacher');
  const [sharedFolders, setSharedFolders] = useState<SharedFolder[]>([]);
  const [realStudent, setRealStudent] = useState<AuthStudentProfile | null>(null);

  // Listen for student auth changes
  useEffect(() => {
    setStudentAuthChangeCallback((student) => {
      setRealStudent(student);
      // When a real student is logged in, always set to student mode
      // This ensures students see student menu regardless of current URL
      if (student) {
        setViewModeState('student');
        localStorage.setItem('viewMode', 'student');
      }
    });
    
    return () => {
      setStudentAuthChangeCallback(() => {});
    };
  }, []);

  // Function to load shared folders from teacher's localStorage
  const loadSharedFolders = (studentClassName: string) => {
    try {
      const foldersStr = localStorage.getItem('vivid-my-folders');
      if (!foldersStr) {
        setSharedFolders([]);
        return;
      }
      
      const folders = JSON.parse(foldersStr);
      const shared: SharedFolder[] = [];
      
      // Find folders shared with the student's class
      folders.forEach((folder: any) => {
        if (folder.sharedWithClasses && folder.sharedWithClasses.length > 0) {
          const isSharedWithStudent = folder.sharedWithClasses.some(
            (cls: any) => cls.name === studentClassName
          );
          
          if (isSharedWithStudent) {
            // Count items in folder
            const childCount = folder.children?.length || 0;
            
            shared.push({
              id: folder.id,
              name: folder.name,
              color: folder.color || '#bbf7d0',
              sharedBy: 'Učitel', // In real app, this would come from the teacher's profile
              sharedAt: folder.createdAt || new Date().toISOString(),
              itemCount: childCount,
            });
          }
        }
      });
      
      setSharedFolders(shared);
    } catch (e) {
      console.error('Failed to load shared folders', e);
      setSharedFolders([]);
    }
  };

  const refreshSharedFolders = () => {
    if (viewMode === 'student') {
      loadSharedFolders(MOCK_STUDENT.className);
    }
  };

  useEffect(() => {
    // Load saved view mode from localStorage
    const savedMode = localStorage.getItem('viewMode') as UserRole | null;
    if (savedMode && (savedMode === 'teacher' || savedMode === 'student')) {
      setViewModeState(savedMode);
      
      // If student mode, ensure mock student data is saved to localStorage
      if (savedMode === 'student') {
        localStorage.setItem('vividbooks_student_profile', JSON.stringify(MOCK_STUDENT));
        loadSharedFolders(MOCK_STUDENT.className);
      }
    }
  }, []);

  // Reload shared folders when switching to student mode
  useEffect(() => {
    if (viewMode === 'student') {
      loadSharedFolders(MOCK_STUDENT.className);
    }
  }, [viewMode]);

  const setViewMode = (mode: UserRole) => {
    setViewModeState(mode);
    localStorage.setItem('viewMode', mode);
    
    // When switching to student mode, save/update the student profile in localStorage
    if (mode === 'student') {
      // Check if there's already a student profile saved
      const existingProfile = localStorage.getItem('vividbooks_student_profile');
      if (!existingProfile) {
        // Save the mock student data as initial profile
        localStorage.setItem('vividbooks_student_profile', JSON.stringify(MOCK_STUDENT));
      }
      loadSharedFolders(MOCK_STUDENT.className);
    }
  };

  const value: ViewModeContextType = {
    viewMode,
    setViewMode,
    isStudent: viewMode === 'student',
    isTeacher: viewMode === 'teacher',
    // Use real student if logged in, otherwise fall back to mock student
    currentStudent: viewMode === 'student' ? (realStudent ? {
      ...MOCK_STUDENT,
      id: realStudent.id,
      name: realStudent.name,
      email: realStudent.email || MOCK_STUDENT.email,
      className: realStudent.class_name || MOCK_STUDENT.className,
    } : MOCK_STUDENT) : null,
    studentAssignments: MOCK_ASSIGNMENTS,
    studentTestResults: MOCK_TEST_RESULTS,
    studentEvaluations: MOCK_EVALUATIONS,
    studentActivities: MOCK_ACTIVITIES,
    sharedFolders,
    refreshSharedFolders,
  };

  return (
    <ViewModeContext.Provider value={value}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error('useViewMode must be used within a ViewModeProvider');
  }
  return context;
}

