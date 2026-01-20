/**
 * Class Results Grid Component
 * 
 * Displays a matrix of student results with columns for each assignment
 * Supports toggling individual work visibility and demo/Supabase data
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  BookOpen,
  ClipboardList,
  Eye,
  EyeOff,
  Database,
  HardDrive,
  RefreshCw,
  Users,
  Plus,
  X,
  Mail,
  UserPlus,
  Pencil,
  Trash2,
  MoreVertical,
  Key,
  Link2,
  Copy,
  Check,
  ShieldCheck,
  Radio,
  Send,
  FileText,
  Presentation,
  AlertTriangle,
  Clock,
  MessageSquare,
  Loader2,
  Hash,
  Camera,
  Upload,
  Image,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Filter,
  BarChart3,
} from 'lucide-react';
import { sendClassMessage, getClassMessages, ClassMessage } from '../../utils/class-messages';
import {
  ClassGroup,
  Student,
  Assignment,
  StudentResult,
  getClassWithData,
  setDataSource,
  isUsingSupabase,
  addStudent,
  updateStudent,
  deleteStudent,
  generatePasswordSetupToken,
  getStudentAuthStatus,
  getClassSubjects,
  addClassSubject,
} from '../../utils/supabase/classes';
import {
  getAssignmentsForClass,
} from '../../utils/student-assignments';
import {
  StudentAssignment,
  StudentSubmission,
  ASSIGNMENT_TYPE_LABELS,
  SUBMISSION_STATUS_LABELS,
} from '../../types/student-assignment';
import { EvaluationModal } from './EvaluationModal';
import { getClassEvaluations, getEvaluationWithStudents, ClassEvaluation } from '../../utils/class-evaluations';
import { supabase } from '../../utils/supabase/client';
import { toast } from 'sonner';

interface ClassResultsGridProps {
  classId: string;
  className: string;
  onBack?: () => void;
}

export function ClassResultsGrid({ classId, className, onBack }: ClassResultsGridProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [results, setResults] = useState<{ [studentId: string]: { [assignmentId: string]: StudentResult } }>({});
  const [loading, setLoading] = useState(true);
  
  // Student task assignments (úkoly)
  const [studentTasks, setStudentTasks] = useState<StudentAssignment[]>([]);
  const [taskSubmissions, setTaskSubmissions] = useState<{ [assignmentId: string]: { [studentId: string]: StudentSubmission } }>({});
  
  // Toggle states
  const [showIndividual, setShowIndividual] = useState(true);
  // Use global Supabase setting from localStorage
  const [useSupabase, setUseSupabase] = useState(() => isUsingSupabase());
  
  // Column visibility filter
  const [columnVisibility, setColumnVisibility] = useState({
    individual: true,
    tasks: true,
    tests: true,
    evaluations: true,
    average: true,
  });
  const [showColumnFilter, setShowColumnFilter] = useState(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  
  // Hover states for highlighting
  // hoveredRow: when hovering student name cell - highlights entire row
  // hoveredColumn: when hovering column header - highlights entire column  
  // hoveredCell: when hovering a single result cell - highlights only that cell
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ studentId: string; assignmentId: string } | null>(null);
  
  // Selected board for detail panel
  const [selectedBoard, setSelectedBoard] = useState<Assignment | null>(null);
  
  // Available subjects in Vividbooks
  const VIVIDBOOKS_SUBJECTS = [
    'Fyzika',
    'Matematika', 
    'Chemie',
    'Biologie',
    'Zeměpis',
    'Dějepis',
    'Informatika',
    'Přírodopis',
    'Občanská výchova',
  ];
  
  // Subject and colleague management - load from Supabase with localStorage fallback
  const [subjects, setSubjects] = useState<string[]>(() => {
    // Start with localStorage for immediate display
    const saved = localStorage.getItem(`class_${classId}_subjects`);
    return saved ? JSON.parse(saved) : ['Fyzika'];
  });
  const [selectedSubject, setSelectedSubject] = useState<string>('Fyzika');
  const [subjectsLoaded, setSubjectsLoaded] = useState(false);
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [showAddColleagueModal, setShowAddColleagueModal] = useState(false);
  const [colleagueEmail, setColleagueEmail] = useState('');
  
  // Evaluation modal state
  const [showEvaluationModal, setShowEvaluationModal] = useState(false);
  const [evaluations, setEvaluations] = useState<ClassEvaluation[]>([]);
  
  // Message modal state
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageTitle, setMessageTitle] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [messagePriority, setMessagePriority] = useState<'normal' | 'important' | 'urgent'>('normal');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [classMessages, setClassMessages] = useState<ClassMessage[]>([]);
  const [studentEvaluationsMap, setStudentEvaluationsMap] = useState<Map<string, Map<string, string>>>(new Map()); // evaluationId -> studentId -> text
  const [colleagues, setColleagues] = useState<{ id: string; name: string; email: string; subject: string }[]>(() => {
    const saved = localStorage.getItem(`class_${classId}_colleagues`);
    return saved ? JSON.parse(saved) : [
      { id: 'c1', name: 'Mgr. Jana Nováková', email: 'novakova@skola.cz', subject: 'Matematika' },
    ];
  });
  
  // Student management
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentForm, setStudentForm] = useState({ name: '', email: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [studentMenuOpen, setStudentMenuOpen] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  
  // Password setup
  const [showPasswordSetupModal, setShowPasswordSetupModal] = useState(false);
  const [passwordSetupStudent, setPasswordSetupStudent] = useState<Student | null>(null);
  const [passwordSetupUrl, setPasswordSetupUrl] = useState<string | null>(null);
  const [passwordSetupLoading, setPasswordSetupLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  
  // Paper test photo upload
  const [paperTestMode, setPaperTestMode] = useState<'view' | 'upload'>('view');
  const [studentPhotos, setStudentPhotos] = useState<{ [studentId: string]: { file: File | null; url: string | null; analyzing: boolean; result: { score: number; maxScore: number; comment: string; answers?: string[]; detectedName?: string } | null } }>({});
  const [bulkPhotos, setBulkPhotos] = useState<File[]>([]);
  const [analyzingBulk, setAnalyzingBulk] = useState(false);
  const fileInputRefs = React.useRef<{ [studentId: string]: HTMLInputElement | null }>({});
  const bulkFileInputRef = React.useRef<HTMLInputElement | null>(null);
  
  // Selected result detail
  const [selectedResult, setSelectedResult] = useState<{ student: Student; result: StudentResult; assignment: Assignment } | null>(null);
  
  // Pending results for review before saving
  const [pendingResults, setPendingResults] = useState<{ 
    studentId: string; 
    student: Student; 
    imageUrl: string; 
    result: { score: number; maxScore: number; comment: string; answers?: string[]; detectedName?: string };
    assignmentId: string;
  }[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  
  // Load subjects from Supabase on mount
  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const loadedSubjects = await getClassSubjects(classId);
        if (loadedSubjects.length > 0) {
          const subjectNames = loadedSubjects.map(s => s.subject_name);
          setSubjects(subjectNames);
          setSelectedSubject(subjectNames[0]);
          // Also update localStorage
          localStorage.setItem(`class_${classId}_subjects`, JSON.stringify(subjectNames));
        }
      } catch (error) {
        console.error('Error loading subjects from Supabase:', error);
      } finally {
        setSubjectsLoaded(true);
      }
    };
    loadSubjects();
  }, [classId]);
  
  // Save subjects to localStorage when they change
  useEffect(() => {
    if (subjectsLoaded) {
    localStorage.setItem(`class_${classId}_subjects`, JSON.stringify(subjects));
    }
  }, [subjects, classId, subjectsLoaded]);
  
  // Save colleagues to localStorage when they change
  useEffect(() => {
    localStorage.setItem(`class_${classId}_colleagues`, JSON.stringify(colleagues));
  }, [colleagues, classId]);
  
  // Available subjects to add (those not already added)
  const availableSubjects = VIVIDBOOKS_SUBJECTS.filter(s => !subjects.includes(s));
  
  // Load data
  useEffect(() => {
    loadData();
    // Also load evaluations
    loadEvaluations();
    
    // Retry if data is empty after initial load
    const retryTimer = setTimeout(() => {
      if (students.length === 0 && assignments.length === 0) {
        console.log('[ClassResultsGrid] Data empty, retrying...');
        loadData();
      }
    }, 1200);
    
    return () => clearTimeout(retryTimer);
  }, [classId, showIndividual, useSupabase]);
  
  // Handle openUpload query parameter - navigate to upload page
  useEffect(() => {
    const openUploadId = searchParams.get('openUpload');
    if (openUploadId && assignments.length > 0) {
      const assignment = assignments.find(a => a.id === openUploadId);
      if (assignment) {
        // Clear the query param and navigate to dedicated upload page
        searchParams.delete('openUpload');
        setSearchParams(searchParams, { replace: true });
        navigate(`/paper-test/upload/${assignment.id}?classId=${classId}`);
      }
    }
  }, [searchParams, assignments, classId, navigate]);
  
  async function loadEvaluations() {
    try {
      const evals = await getClassEvaluations(classId);
      setEvaluations(evals);
      
      // Load student evaluations for sent evaluations
      const sentEvals = evals.filter(e => e.status === 'sent');
      const newMap = new Map<string, Map<string, string>>();
      
      for (const eval_ of sentEvals) {
        const { studentEvaluations } = await getEvaluationWithStudents(eval_.id);
        const studentMap = new Map<string, string>();
        studentEvaluations.forEach(se => {
          if (se.final_text) {
            studentMap.set(se.student_id, se.final_text);
          }
        });
        newMap.set(eval_.id, studentMap);
      }
      
      setStudentEvaluationsMap(newMap);
    } catch (error) {
      console.error('[ClassResultsGrid] Error loading evaluations:', error);
    }
  }
  
  const loadData = async () => {
    setLoading(true);
    setDataSource(useSupabase);
    
    try {
      // Add timeout to prevent infinite loading (15s to allow multiple API calls)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 15000)
      );
      
      const dataPromise = Promise.all([
        getClassWithData(classId, showIndividual),
        getAssignmentsForClass(classId),
      ]);
      
      const [data, tasks] = await Promise.race([dataPromise, timeoutPromise]) as [any, any];
      
      if (data) {
        setStudents(data.students);
        setAssignments(data.assignments);
        setResults(data.results);
      }
      
      // Store student tasks (úkoly)
      setStudentTasks(tasks || []);
      
      // Load task submissions from localStorage
      try {
        const allSubmissions = JSON.parse(localStorage.getItem('vivid-student-submissions') || '[]') as StudentSubmission[];
        const submissionsByTask: { [assignmentId: string]: { [studentId: string]: StudentSubmission } } = {};
        
        for (const sub of allSubmissions) {
          if (!submissionsByTask[sub.assignment_id]) {
            submissionsByTask[sub.assignment_id] = {};
          }
          submissionsByTask[sub.assignment_id][sub.student_id] = sub;
        }
        
        setTaskSubmissions(submissionsByTask);
      } catch (e) {
        console.log('[ClassResultsGrid] Error loading submissions:', e);
      }
    } catch (error) {
      console.error('[ClassResultsGrid] Error loading data:', error);
      // Set empty data on error so UI doesn't hang
      setStudents([]);
      setAssignments([]);
      setResults({});
      setStudentTasks([]);
    }
    
    setLoading(false);
  };
  
  // Student management functions
  const handleOpenAddStudent = () => {
    setEditingStudent(null);
    setStudentForm({ name: '', email: '' });
    setShowStudentModal(true);
  };
  
  const handleOpenEditStudent = (student: Student) => {
    setEditingStudent(student);
    setStudentForm({ name: student.name, email: student.email || '' });
    setShowStudentModal(true);
    setStudentMenuOpen(null);
  };
  
  const handleSaveStudent = async () => {
    if (!studentForm.name.trim()) return;
    
    setIsSavingStudent(true);
    
    // Ensure localStorage is in sync with current mode
    setDataSource(useSupabase);
    
    const colors = ['#EC4899', '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#84CC16'];
    const initials = studentForm.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    
    try {
      if (editingStudent) {
        // Update existing student
        await updateStudent(editingStudent.id, {
          name: studentForm.name,
          email: studentForm.email || undefined,
          initials,
        });
      } else {
        // Add new student
        await addStudent({
          name: studentForm.name,
          email: studentForm.email || undefined,
          class_id: classId,
          initials,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
      
      // Reload data
      await loadData();
      setShowStudentModal(false);
    } catch (error) {
      console.error('Error saving student:', error);
    }
    
    setIsSavingStudent(false);
  };
  
  const handleDeleteStudent = async (studentId: string) => {
    try {
      await deleteStudent(studentId);
      await loadData();
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting student:', error);
    }
  };
  
  // Generate password setup link
  const handleGeneratePasswordLink = async (student: Student) => {
    // Reset all state first
    setPasswordSetupStudent(student);
    setPasswordSetupUrl(null);
    setPasswordSetupLoading(true);
    setCopiedLink(false);
    setShowPasswordSetupModal(true);
    setStudentMenuOpen(null);
    
    try {
      const result = await generatePasswordSetupToken(student.id);
      if (result.url) {
        setPasswordSetupUrl(result.url);
      } else if (result.error) {
        console.error('Error:', result.error);
        alert(result.error);
      }
    } catch (error) {
      console.error('Error generating password link:', error);
      alert('Nepodařilo se vygenerovat odkaz');
    } finally {
      setPasswordSetupLoading(false);
    }
  };
  
  // Close password setup modal and reset state
  const handleClosePasswordModal = () => {
    setShowPasswordSetupModal(false);
    setPasswordSetupStudent(null);
    setPasswordSetupUrl(null);
    setPasswordSetupLoading(false);
    setCopiedLink(false);
  };
  
  // Copy link to clipboard
  const handleCopyLink = async () => {
    if (passwordSetupUrl) {
      await navigator.clipboard.writeText(passwordSetupUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };
  
  // Paper test photo analysis
  const analyzeStudentPhoto = async (studentId: string, file: File, assignmentId: string) => {
    console.log('[PaperTest] Starting analysis for student:', studentId, 'assignment:', assignmentId);
    
    // Show review modal immediately with loading state
    setShowReviewModal(true);
    
    setStudentPhotos(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], file, analyzing: true, result: null }
    }));
    
    try {
      // Convert file to base64 data URL
      const reader = new FileReader();
      const imageUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      console.log('[PaperTest] Image converted to base64, size:', imageUrl.length);
      
      setStudentPhotos(prev => ({
        ...prev,
        [studentId]: { ...prev[studentId], url: imageUrl }
      }));
      
      // Get student name
      const student = students.find(s => s.id === studentId);
      const studentName = student?.name || 'Unknown';
      
      console.log('[PaperTest] Calling edge function for student:', studentName);
      
      // Get questions from assignment (stored in Supabase when test was assigned)
      let worksheetQuestions = (selectedBoard as any)?.questions || [];
      let worksheetContent = selectedBoard?.title || 'Test';
      
      // Fallback to localStorage if no questions in assignment
      if (!worksheetQuestions || worksheetQuestions.length === 0) {
        const storedKeys = Object.keys(localStorage).filter(k => k.startsWith('paper-test-content-'));
        for (const key of storedKeys) {
          try {
            const stored = JSON.parse(localStorage.getItem(key) || '{}');
            if (stored.questions && stored.questions.length > 0) {
              worksheetQuestions = stored.questions;
              worksheetContent = JSON.stringify(stored);
              console.log('[PaperTest] Using stored questions from localStorage:', key);
              break;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      } else {
        console.log('[PaperTest] Using questions from assignment:', worksheetQuestions.length, 'questions');
        worksheetContent = JSON.stringify({ questions: worksheetQuestions });
      }
      
      // Call edge function with questions structure
      const { data, error } = await supabase.functions.invoke('analyze-test', {
        body: {
          imageUrl,
          worksheetContent,
          studentName,
          worksheetTitle: selectedBoard?.title || 'Test',
          worksheetQuestions, // Pass structured questions to AI
          studentList: students.map(s => s.name), // For name matching
        }
      });
      
      console.log('[PaperTest] Edge function response:', { data, error });
      
      if (error) throw error;
      
      if (!data || data.score === undefined) {
        console.error('[PaperTest] Invalid response from edge function:', data);
        throw new Error('Invalid response from AI');
      }
      
      const result = { 
        score: data.score, 
        maxScore: data.maxScore || 10, 
        comment: data.comment || '',
        answers: data.answers || [],
        detectedName: data.detectedName
      };
      console.log('[PaperTest] Parsed result:', result);
      
      setStudentPhotos(prev => ({
        ...prev,
        [studentId]: { ...prev[studentId], analyzing: false, result, url: imageUrl }
      }));
      
      // Add to pending results for review instead of saving immediately
      // student already defined above
      console.log('[PaperTest] Adding to pending results, student:', student?.name);
      if (student) {
        const newPending = {
          studentId,
          student,
          imageUrl,
          result,
          assignmentId
        };
        setPendingResults(prev => {
          const updated = [...prev, newPending];
          console.log('[PaperTest] Updated pending results:', updated.length);
          return updated;
        });
        setCurrentReviewIndex(0); // Start at first pending
        setShowReviewModal(true);
        console.log('[PaperTest] Set showReviewModal to true');
      }
      
      toast.info(`${studentName}: Připraveno ke kontrole`);
    } catch (error: any) {
      console.error('[PaperTest] Error analyzing photo:', error);
      setStudentPhotos(prev => ({
        ...prev,
        [studentId]: { ...prev[studentId], analyzing: false, result: null }
      }));
      toast.error(`Chyba při analýze fotky: ${error.message || 'Neznámá chyba'}`);
    }
  };
  
  const handleBulkPhotoUpload = async (files: FileList, assignmentId: string) => {
    setBulkPhotos(Array.from(files));
    setAnalyzingBulk(true);
    
    toast.info(`Analyzuji ${files.length} fotek pomocí AI s detekcí jmen...`);
    
    const studentNames = students.map(s => s.name);
    let matched = 0;
    let unmatched = 0;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        // Convert file to base64
        const reader = new FileReader();
        const imageUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        
        // Call edge function with student list for name detection
        const { data, error } = await supabase.functions.invoke('analyze-test', {
          body: {
            imageUrl,
            worksheetContent: selectedBoard?.title || 'Test',
            worksheetTitle: selectedBoard?.title || 'Test',
            studentList: studentNames,
          }
        });
        
        if (error) throw error;
        
        // Try to match detected name to a student
        const detectedName = data.detectedName;
        let matchedStudent = null;
        
        if (detectedName) {
          // Find best match from student list
          matchedStudent = students.find(s => 
            s.name.toLowerCase().includes(detectedName.toLowerCase()) ||
            detectedName.toLowerCase().includes(s.name.toLowerCase()) ||
            s.name.toLowerCase() === detectedName.toLowerCase()
          );
        }
        
        if (matchedStudent) {
          // Save result for matched student
          setStudentPhotos(prev => ({
            ...prev,
            [matchedStudent!.id]: { 
              file, 
              url: imageUrl, 
              analyzing: false, 
              result: { score: data.score, maxScore: data.maxScore || 10, comment: data.comment || '' }
            }
          }));
          
          await supabase.from('results').upsert({
            student_id: matchedStudent.id,
            assignment_id: assignmentId,
            score: data.score,
            max_score: data.maxScore || 10,
            percentage: Math.round((data.score / (data.maxScore || 10)) * 100),
            teacher_comment: data.comment,
          }, { onConflict: 'student_id,assignment_id' });
          
          toast.success(`${matchedStudent.name}: ${data.score}/${data.maxScore || 10} bodů`);
          matched++;
        } else {
          toast.warning(`Nepodařilo se spárovat fotku ${i + 1} (detekováno: "${detectedName || 'žádné jméno'}")`);
          unmatched++;
        }
      } catch (error: any) {
        console.error('Error analyzing bulk photo:', error);
        toast.error(`Chyba u fotky ${i + 1}: ${error.message}`);
        unmatched++;
      }
    }
    
    // Refresh data
    const classData = await getClassWithData(classId);
    if (classData) {
      setResults(classData.results);
    }
    
    setAnalyzingBulk(false);
    toast.success(`Hotovo! Spárováno: ${matched}, Nespárováno: ${unmatched}`);
  };
  
  // Save a pending result after review
  const saveReviewedResult = async (index: number) => {
    const pending = pendingResults[index];
    if (!pending) return;
    
    console.log('[PaperTest] Saving reviewed result for:', pending.student.name, 'with answers:', pending.result.answers);
    
    try {
      // Save to Supabase with answers (answers column should exist after running migration)
      const { error: saveError } = await supabase.from('results').upsert({
        student_id: pending.studentId,
        assignment_id: pending.assignmentId,
        score: pending.result.score,
        max_score: pending.result.maxScore,
        percentage: Math.round((pending.result.score / pending.result.maxScore) * 100),
        teacher_comment: pending.result.comment,
        answers: pending.result.answers, // JSONB column for individual question answers
      }, { onConflict: 'student_id,assignment_id' });
      
      // Also save to localStorage as fallback
      const answersKey = `paper-test-answers-${pending.assignmentId}-${pending.studentId}`;
      localStorage.setItem(answersKey, JSON.stringify(pending.result.answers || []));
      
      if (saveError) throw saveError;
      
      toast.success(`${pending.student.name}: ${pending.result.score}/${pending.result.maxScore} bodů uloženo`);
      
      // Remove from pending
      setPendingResults(prev => prev.filter((_, i) => i !== index));
      
      // Move to next or close modal
      if (pendingResults.length <= 1) {
        setShowReviewModal(false);
        setCurrentReviewIndex(0);
        // Refresh data
        const classData = await getClassWithData(classId);
        if (classData) {
          setResults(classData.results);
        }
      } else if (currentReviewIndex >= pendingResults.length - 1) {
        setCurrentReviewIndex(Math.max(0, pendingResults.length - 2));
      }
    } catch (error: any) {
      console.error('[PaperTest] Error saving result:', error);
      toast.error(`Chyba při ukládání: ${error.message}`);
    }
  };
  
  // Skip/reject a pending result
  const skipReviewedResult = (index: number) => {
    setPendingResults(prev => prev.filter((_, i) => i !== index));
    
    if (pendingResults.length <= 1) {
      setShowReviewModal(false);
      setCurrentReviewIndex(0);
    } else if (currentReviewIndex >= pendingResults.length - 1) {
      setCurrentReviewIndex(Math.max(0, pendingResults.length - 2));
    }
    
    toast.info('Výsledek přeskočen');
  };
  
  // Edit score in pending result
  const editPendingScore = (index: number, newScore: number) => {
    setPendingResults(prev => prev.map((p, i) => 
      i === index ? { ...p, result: { ...p.result, score: newScore } } : p
    ));
  };
  
  // Edit individual answer in pending result
  const editPendingAnswer = (resultIndex: number, answerIndex: number, field: string, value: any) => {
    setPendingResults(prev => prev.map((p, i) => {
      if (i !== resultIndex) return p;
      const newAnswers = [...(p.result.answers || [])];
      if (typeof newAnswers[answerIndex] === 'object') {
        newAnswers[answerIndex] = { ...newAnswers[answerIndex], [field]: value };
      }
      // Recalculate score
      const newScore = newAnswers.reduce((sum: number, a: any) => {
        return sum + (typeof a === 'object' ? (a.points || 0) : 0);
      }, 0);
      return { ...p, result: { ...p.result, answers: newAnswers, score: newScore } };
    }));
  };
  
  // Add missing question to pending result
  const addMissingQuestion = (resultIndex: number) => {
    setPendingResults(prev => prev.map((p, i) => {
      if (i !== resultIndex) return p;
      const existingQuestions = (p.result.answers || []).map((a: any) => 
        typeof a === 'object' ? a.questionNumber : 0
      );
      const maxQuestion = Math.max(0, ...existingQuestions);
      const newQuestion = {
        questionNumber: maxQuestion + 1,
        questionType: 'abc' as const,
        answer: '',
        isCorrect: null,
        points: 0,
        maxPoints: 1
      };
      return { 
        ...p, 
        result: { 
          ...p.result, 
          answers: [...(p.result.answers || []), newQuestion],
          maxScore: (p.result.maxScore || 0) + 1
        } 
      };
    }));
  };
  
  // Reset paper test state when modal closes
  const handleCloseBoardModal = () => {
    setSelectedBoard(null);
    setPaperTestMode('view');
    setStudentPhotos({});
    setBulkPhotos([]);
  };
  
  // Get score color based on value
  const getScoreColor = (score: number | null): string => {
    if (score === null || score === -1) return '#FFFFFF'; // White for no data or pending
    if (score >= 9) return '#6DE89B';
    if (score >= 8) return '#7ECD7E';
    if (score >= 7) return '#9FD99F';
    if (score >= 6) return '#C7B08A';
    if (score >= 5) return '#E8A07A';
    if (score >= 4) return '#E88A7A';
    if (score >= 3) return '#E87A7A';
    if (score >= 2) return '#E86A6A';
    return '#B84040';
  };
  
  // Get text color based on background
  const getTextColor = (score: number | null): string => {
    if (score === null) return '#9CA3AF';
    if (score === -1) return '#92400E';
    if (score <= 3) return '#FFFFFF';
    return '#1F2937';
  };
  
  // Format date
  const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return `${date.getDate()}.${date.getMonth() + 1}.`;
  };
  
  // Get assignment icon
  const getAssignmentIcon = (type: string): React.ReactNode => {
    switch (type) {
      case 'test':
        return (
          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
            <CheckCircle className="w-3 h-3" style={{ color: '#DC2626' }} />
          </div>
        );
      case 'practice':
        return (
          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: '#D1FAE5' }}>
            <BookOpen className="w-3 h-3" style={{ color: '#059669' }} />
          </div>
        );
      case 'individual':
        return (
          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: '#E0E7FF' }}>
            <ClipboardList className="w-3 h-3" style={{ color: '#4F46E5' }} />
          </div>
        );
      case 'live':
        return (
          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: '#FEF3C7' }}>
            <Radio className="w-3 h-3" style={{ color: '#D97706' }} />
          </div>
        );
      case 'task':
        return (
          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: '#DBEAFE' }}>
            <Send className="w-3 h-3" style={{ color: '#2563EB' }} />
          </div>
        );
      default:
        return null;
    }
  };
  
  // Calculate student average (using percentage)
  const calculateAverage = (studentId: string): number | null => {
    const studentResults = results[studentId];
    if (!studentResults) return null;
    
    const percentages = Object.values(studentResults)
      .map(r => {
        // Use percentage if available, otherwise calculate from score/max_score
        if (r.percentage !== undefined && r.percentage !== null) {
          return r.percentage;
        }
        if (r.score !== null && r.score !== -1 && r.max_score) {
          return Math.round((r.score / r.max_score) * 100);
        }
        return null;
      })
      .filter((p): p is number => p !== null);
    
    if (percentages.length === 0) return null;
    return Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length);
  };
  
  // Convert student tasks to Assignment format for unified display
  const taskAssignments: Assignment[] = studentTasks.map(task => ({
    id: task.id,
    title: task.title,
    type: 'task' as any, // Special type for student tasks
    class_id: task.class_id,
    subject: task.subject || selectedSubject,
    created_at: task.created_at,
    due_date: task.due_date,
    // Store extra info
    _taskType: task.type, // 'document' | 'presentation' | 'test'
    _allowAi: task.allow_ai,
    _description: task.description,
  } as Assignment & { _taskType?: string; _allowAi?: boolean; _description?: string }));
  
  // Merge regular assignments with student tasks
  const allAssignments = [...assignments, ...taskAssignments];
  
  // Filter assignments by type AND subject AND visibility settings
  const filteredAssignments = allAssignments.filter(a => {
    // Filter by subject - STRICT matching
    // Only show assignments that match the selected subject
    // Exception: 'task' and 'individual' types are shown for all subjects (they are personal work)
    const isPersonalWork = a.type === 'task' || a.type === 'individual';
    const subjectMatch = isPersonalWork || a.subject === selectedSubject;
    
    // Filter by column visibility settings
    const visibilityMatch = (() => {
      if (a.type === 'individual') return columnVisibility.individual;
      if (a.type === 'task') return columnVisibility.tasks;
      if (a.type === 'test' || a.type === 'paper_test') return columnVisibility.tests;
      if (a.type === 'practice') return columnVisibility.tests; // Practice is also a type of test
      if (a.type === 'live') return columnVisibility.tests; // Live quizzes are also tests
      return true; // Show other types by default
    })();
    
    return subjectMatch && visibilityMatch;
  });
  
  // Calculate student averages - SAME LOGIC AS StudentProfilePage
  // Uses average of percentages (not weighted by max_score), excludes individual work
  // Respects selected subject filter
  const calculateStudentAverage = (studentId: string): number | null => {
    const studentResults = results[studentId];
    if (!studentResults) return null;
    
    // Get all percentages from test/practice results only (exclude individual work)
    // Filter by selected subject
    const percentages: number[] = [];
    
    for (const assignmentId of Object.keys(studentResults)) {
      const result = studentResults[assignmentId];
      // Find the assignment to check its type and subject
      const assignment = allAssignments.find(a => a.id === assignmentId);
      
      // Skip if no assignment found
      if (!assignment) continue;
      
      // Skip individual work and tasks
      if (assignment.type === 'individual' || assignment.type === 'task') continue;
      
      // Filter by subject - only include results for selected subject
      if (assignment.subject && assignment.subject !== selectedSubject) continue;
      
      // Calculate percentage for this result
      let percentage: number | null = null;
      if (result.percentage !== undefined && result.percentage !== null) {
        percentage = result.percentage;
      } else if (result.score !== null && result.score !== -1 && result.max_score && result.max_score > 0) {
        percentage = Math.round((result.score / result.max_score) * 100);
      }
      
      if (percentage !== null) {
        percentages.push(percentage);
      }
    }
    
    if (percentages.length === 0) return null;
    return Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length);
  };
  
  // Filter evaluations by subject and status
  const filteredEvaluations = evaluations.filter(e => 
    e.status === 'sent' && (!e.subject || e.subject === selectedSubject)
  );
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Subject switcher and action buttons */}
      <div className="flex items-center justify-between">
        {/* Subject switcher */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-500">Předměty:</span>
          <div className="flex items-center gap-1 bg-white rounded-xl p-1.5 border border-slate-200">
          {subjects.map((subject) => (
            <button
              key={subject}
              onClick={() => setSelectedSubject(subject)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedSubject === subject
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-transparent text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div 
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ 
                    backgroundColor: selectedSubject === subject ? 'white' : 
                      subject === 'Fyzika' ? '#6366F1' : 
                      subject === 'Matematika' ? '#10B981' :
                      subject === 'Chemie' ? '#F59E0B' :
                      subject === 'Biologie' ? '#EC4899' :
                      subject === 'Informatika' ? '#3B82F6' :
                      '#8B5CF6'
                  }}
                />
              {subject}
            </button>
          ))}
          
          {/* Add subject dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSubjectDropdown(!showSubjectDropdown)}
                className="flex items-center gap-1 px-2 py-2 text-sm font-medium text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
            
            {showSubjectDropdown && availableSubjects.length > 0 && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSubjectDropdown(false)} />
                <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-20 min-w-[180px]">
                  {availableSubjects.map((subject) => (
                    <button
                      key={subject}
                      onClick={async () => {
                        setSubjects([...subjects, subject]);
                        setShowSubjectDropdown(false);
                        const userProfile = JSON.parse(localStorage.getItem('vividbooks_current_user_profile') || '{}');
                        await addClassSubject(classId, subject, userProfile.id || 'unknown');
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                    >
                      {subject}
                    </button>
                  ))}
                </div>
              </>
            )}
            </div>
          </div>
        </div>
        
        {/* Actions dropdown */}
        <div className="flex items-center gap-3">
          {/* Třídní chat */}
          <button
            onClick={() => navigate(`/class-chat/${classId}`)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#4E5871',
              color: 'white',
              borderRadius: '12px',
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3d4660'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4E5871'}
          >
            <Hash className="w-4 h-4" />
            Třídní chat
          </button>
          
          {/* Actions dropdown */}
          <div className="relative">
          <button
              onClick={() => setShowActionsDropdown(!showActionsDropdown)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6366F1',
                color: 'white',
                borderRadius: '12px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4F46E5'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6366F1'}
            >
              <MoreVertical className="w-4 h-4" />
              Akce
              <ChevronDown className={`w-4 h-4 transition-transform ${showActionsDropdown ? 'rotate-180' : ''}`} />
          </button>
            
            {showActionsDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowActionsDropdown(false)} />
                <div className="absolute top-full right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 py-3 z-50" style={{ minWidth: '280px' }}>
          <button
                    onClick={() => {
                      setShowActionsDropdown(false);
                      navigate(`/library/my-classes?classId=${classId}&action=assign`);
                    }}
                    className="w-full flex items-center gap-4 px-5 py-3.5 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                      <Send className="w-5 h-5 text-indigo-600" />
                    </div>
                    <span className="text-base font-medium">Zadat vlastní práci</span>
          </button>
          <button
                    onClick={() => {
                      setShowActionsDropdown(false);
                      setShowEvaluationModal(true);
                    }}
                    className="w-full flex items-center gap-4 px-5 py-3.5 text-slate-700 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-purple-600" />
                    </div>
                    <span className="text-base font-medium">Přidat hodnocení</span>
          </button>
          <button
                    onClick={() => {
                      setShowActionsDropdown(false);
                      setShowMessageModal(true);
                    }}
                    className="w-full flex items-center gap-4 px-5 py-3.5 text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="text-base font-medium">Poslat třídě zprávu</span>
          </button>
                  <div className="border-t border-slate-100 my-2" />
                  <button
                    onClick={() => {
                      setShowActionsDropdown(false);
                      setShowAddColleagueModal(true);
                    }}
                    className="w-full flex items-center gap-4 px-5 py-3.5 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                      <UserPlus className="w-5 h-5 text-emerald-600" />
                    </div>
                    <span className="text-base font-medium">Přidat kolegu</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Column visibility filter dropdown */}
          <div className="relative">
          <button
              onClick={() => setShowColumnFilter(!showColumnFilter)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Filter className="w-4 h-4" />
              Zobrazit sloupce
              <ChevronDown className={`w-4 h-4 transition-transform ${showColumnFilter ? 'rotate-180' : ''}`} />
          </button>
            
            {showColumnFilter && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowColumnFilter(false)} />
                <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-20 min-w-[200px]">
                  <label className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={columnVisibility.average}
                      onChange={(e) => setColumnVisibility({ ...columnVisibility, average: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-blue-500" />
                      <span className="text-sm text-slate-700">Průměr</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={columnVisibility.individual}
                      onChange={(e) => setColumnVisibility({ ...columnVisibility, individual: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-indigo-500" />
                      <span className="text-sm text-slate-700">Individuální práce</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={columnVisibility.tasks}
                      onChange={(e) => setColumnVisibility({ ...columnVisibility, tasks: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-amber-500" />
                      <span className="text-sm text-slate-700">Úkoly</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={columnVisibility.tests}
                      onChange={(e) => setColumnVisibility({ ...columnVisibility, tests: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-red-500" />
                      <span className="text-sm text-slate-700">Testy</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={columnVisibility.evaluations}
                      onChange={(e) => setColumnVisibility({ ...columnVisibility, evaluations: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm text-slate-700">Hodnocení</span>
                    </div>
                  </label>
                </div>
              </>
            )}
          </div>
          
          {/* Data source indicator (read-only, controlled from sidebar) */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
              useSupabase 
                ? 'bg-emerald-100 text-emerald-700' 
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {useSupabase ? <Database className="w-4 h-4" /> : <HardDrive className="w-4 h-4" />}
            {useSupabase ? 'Supabase' : 'Demo data'}
          </div>
        </div>
        
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Obnovit
        </button>
      </div>
      
      {/* Results Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderSpacing: '2px', borderCollapse: 'separate' }}>
            {/* Header */}
            <thead>
              {/* Date row */}
              <tr>
                <th className="sticky left-0 z-10 bg-white" style={{ minWidth: '200px' }}></th>
                {/* Average column header - first after name */}
                {columnVisibility.average && (
                  <th className="py-2 text-xs font-normal text-slate-400 text-center" style={{ width: '70px', minWidth: '70px' }}>
                  </th>
                )}
                {filteredAssignments.map((assignment) => {
                  const isIndividual = assignment.type === 'individual';
                  return (
                    <th 
                      key={`date-${assignment.id}`}
                      className={`py-2 text-xs font-normal text-slate-400 text-center ${
                        hoveredColumn === assignment.id ? 'bg-indigo-50' : ''
                      }`}
                      style={{ 
                        width: isIndividual ? '15px' : '120px',
                        minWidth: isIndividual ? '15px' : '120px',
                        maxWidth: isIndividual ? '15px' : '120px',
                        padding: '0',
                      }}
                    >
                      {isIndividual ? '' : formatDate(assignment.due_date)}
                    </th>
                  );
                })}
                {/* Evaluation columns */}
                {columnVisibility.evaluations && filteredEvaluations.map(eval_ => (
                  <th 
                    key={`date-eval-${eval_.id}`}
                    className="py-2 text-xs font-normal text-slate-400 text-center"
                    style={{ width: '100px', minWidth: '100px' }}
                  >
                    {eval_.sent_at ? new Date(eval_.sent_at).toLocaleDateString('cs-CZ') : ''}
                  </th>
                ))}
              </tr>
              
              {/* Assignment name row */}
              <tr>
                <th className="sticky left-0 z-10 bg-white px-4 py-2 text-left text-sm font-medium text-slate-700 border-b border-slate-200">
                  Student
                </th>
                {/* Average column header - first after name */}
                {columnVisibility.average && (
                  <th className="px-2 py-2 text-center text-xs font-medium text-slate-700 border-b border-slate-200 bg-blue-50" style={{ width: '70px', minWidth: '70px' }}>
                    <div className="flex flex-col items-center gap-1">
                      <BarChart3 className="w-4 h-4 text-blue-600" />
                      <span>Průměr</span>
                    </div>
                  </th>
                )}
                {filteredAssignments.map((assignment) => {
                  const isIndividual = assignment.type === 'individual';
                  
                  // Handle click on column header - navigate to results or show board detail
                  const handleColumnClick = () => {
                    if (isIndividual) return;
                    
                    // For live quiz assignments, navigate to quiz results page
                    if (assignment.session_id && (assignment.session_type === 'live' || assignment.type === 'live')) {
                      navigate(`/quiz/results/${assignment.session_id}?type=${assignment.session_type || 'live'}`);
                    } else if (assignment.type === 'paper_test' || (assignment.type === 'test' && !assignment.session_id)) {
                      // For paper tests, navigate to quiz results page with paper_test type
                      navigate(`/quiz/results/${assignment.id}?type=paper_test&classId=${classId}`);
                    } else {
                      // For other assignments, show board detail modal
                      setSelectedBoard(assignment);
                    }
                  };
                  
                  // Check if this is a clickable live quiz assignment
                  const isLiveQuizColumn = assignment.session_id && (assignment.session_type === 'live' || assignment.type === 'live');
                  
                  return (
                    <th 
                      key={`name-${assignment.id}`}
                      className={`py-2 border-b border-slate-200 ${!isIndividual ? 'cursor-pointer hover:bg-indigo-100' : ''} ${
                        hoveredColumn === assignment.id ? 'bg-indigo-50' : ''
                      }`}
                      style={{ 
                        width: isIndividual ? '15px' : '120px',
                        minWidth: isIndividual ? '15px' : '120px',
                        maxWidth: isIndividual ? '15px' : '120px',
                        padding: '0',
                      }}
                      onClick={handleColumnClick}
                      onMouseEnter={() => {
                        if (!isIndividual) {
                          setHoveredColumn(assignment.id);
                          setHoveredRow(null);
                          setHoveredCell(null);
                        }
                      }}
                      onMouseLeave={() => setHoveredColumn(null)}
                      title={isLiveQuizColumn ? 'Klikni pro zobrazení výsledků všech studentů' : assignment.title}
                    >
                      {isIndividual ? (
                        // Narrow column for individual - empty header
                        <div style={{ width: '15px', height: '20px' }} title={assignment.title}></div>
                      ) : (
                        // Wide column for tests/practice/live - clickable
                        <div className="flex flex-col items-center gap-1 py-1">
                          {getAssignmentIcon(assignment.type)}
                          <span className="text-xs text-slate-600 truncate" style={{ maxWidth: '110px' }} title={assignment.title}>
                            {assignment.title.length > 14 ? `${assignment.title.slice(0, 14)}...` : assignment.title}
                          </span>
                        </div>
                      )}
                    </th>
                  );
                })}
                {/* Evaluation column headers */}
                {columnVisibility.evaluations && filteredEvaluations.map(eval_ => (
                  <th 
                    key={`name-eval-${eval_.id}`}
                    className="px-2 py-2 text-center text-xs font-medium text-slate-700 border-b border-slate-200 bg-purple-50"
                    style={{ width: '100px', minWidth: '100px' }}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <FileText className="w-4 h-4 text-purple-600" />
                      <span className="text-xs text-purple-700 truncate" style={{ maxWidth: '90px' }} title={eval_.title}>
                        {eval_.title.length > 12 ? `${eval_.title.slice(0, 12)}...` : eval_.title}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            
            {/* Body */}
            <tbody>
              {students.map((student, studentIdx) => {
                const average = calculateAverage(student.id);
                const isHoveredRow = hoveredRow === student.id;
                
                return (
                  <tr 
                    key={student.id}
                  >
                    {/* Student name - click to view profile, hover highlights entire row */}
                    <td 
                      className="sticky left-0 z-10 transition-colors group" 
                      style={{ 
                        backgroundColor: isHoveredRow ? '#EEF2FF' : '#FFFFFF', 
                        padding: '1px 16px',
                      }}
                      onMouseEnter={() => {
                        setHoveredRow(student.id);
                        setHoveredColumn(null);
                        setHoveredCell(null);
                      }}
                      onMouseLeave={() => {
                        setHoveredRow(null);
                        if (studentMenuOpen !== student.id) setStudentMenuOpen(null);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold cursor-pointer"
                          style={{ backgroundColor: student.color }}
                          onClick={() => navigate(`/library/student/${student.id}`)}
                        >
                          {student.initials}
                        </div>
                        <span 
                          className="text-sm font-medium text-slate-700 hover:text-indigo-600 hover:underline cursor-pointer flex-1"
                          onClick={() => navigate(`/library/student/${student.id}`)}
                        >
                          {student.name}
                        </span>
                        
                        {/* Student actions menu */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (studentMenuOpen === student.id) {
                                setStudentMenuOpen(null);
                                setMenuPosition(null);
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect();
                                // Calculate position - ensure menu stays in viewport
                                const menuWidth = 200;
                                let left = rect.left;
                                // If menu would go off right edge, align to right of button
                                if (left + menuWidth > window.innerWidth) {
                                  left = rect.right - menuWidth;
                                }
                                setMenuPosition({ top: rect.bottom + 4, left });
                                setStudentMenuOpen(student.id);
                              }
                            }}
                            className={`p-1.5 rounded-lg transition-colors ${
                              studentMenuOpen === student.id 
                                ? 'bg-slate-200 text-slate-700' 
                                : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          
                          {studentMenuOpen === student.id && createPortal(
                            <>
                              <div 
                                className="fixed inset-0" 
                                style={{ zIndex: 99999 }}
                                onClick={() => setStudentMenuOpen(null)} 
                              />
                              <div 
                                className="fixed bg-white rounded-xl shadow-2xl border border-slate-200 py-2 w-[200px]"
                                style={{ 
                                  top: menuPosition?.top ?? 0, 
                                  left: menuPosition?.left ?? 0,
                                  zIndex: 100000 
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleOpenEditStudent(student); }}
                                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
                                >
                                  <Pencil className="w-4 h-4" />
                                  Upravit
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleGeneratePasswordLink(student); }}
                                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-indigo-600 hover:bg-indigo-50 transition-colors"
                                >
                                  <Key className="w-4 h-4" />
                                  Vytvořit přístup
                                </button>
                                <button
                                  onClick={() => {
                                    setShowDeleteConfirm(student.id);
                                    setStudentMenuOpen(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Odstranit
                                </button>
                              </div>
                            </>,
                            document.body
                          )}
                        </div>
                      </div>
                    </td>
                    
                    {/* Average column - first after name */}
                    {columnVisibility.average && (
                      <td 
                        className="text-center text-sm font-semibold"
                        style={{ 
                          width: '70px', 
                          minWidth: '70px',
                          padding: '4px',
                        }}
                      >
                        {(() => {
                          const avg = calculateStudentAverage(student.id);
                          if (avg === null) return <span className="text-slate-300">–</span>;
                          const bgColor = avg >= 80 ? '#D1FAE5' : avg >= 60 ? '#FEF3C7' : avg >= 40 ? '#FED7AA' : '#FECACA';
                          const textColor = avg >= 80 ? '#059669' : avg >= 60 ? '#D97706' : avg >= 40 ? '#EA580C' : '#DC2626';
                          return (
                            <div 
                              className="rounded-lg py-1.5 px-2"
                              style={{ backgroundColor: bgColor, color: textColor }}
                            >
                              {avg}%
                            </div>
                          );
                        })()}
                      </td>
                    )}
                    
                    {/* Results */}
                    {filteredAssignments.map((assignment) => {
                      const isTask = assignment.type === 'task';
                      const taskSubmission = isTask ? taskSubmissions[assignment.id]?.[student.id] : null;
                      
                      const result = results[student.id]?.[assignment.id];
                      const score = result?.score ?? null;
                      // Use percentage for color if available, otherwise calculate from score/max_score
                      const percentage = result?.percentage ?? (score !== null && result?.max_score ? Math.round((score / result.max_score) * 100) : null);
                      // Convert percentage (0-100) to 1-10 scale for color function
                      const colorScore = percentage !== null ? Math.round(percentage / 10) : score;
                      const bgColor = getScoreColor(colorScore);
                      const textColor = getTextColor(colorScore);
                      const isIndividual = assignment.type === 'individual';
                      const hasData = isTask ? !!taskSubmission : (score !== null && score !== -1);
                      
                      // Determine if this cell should be highlighted
                      const isCellHovered = hoveredCell?.studentId === student.id && hoveredCell?.assignmentId === assignment.id;
                      const isRowHighlighted = hoveredRow === student.id;
                      const isColumnHighlighted = hoveredColumn === assignment.id;
                      
                      // Don't highlight empty cells (no data) when row/column is highlighted
                      const shouldShowRing = isCellHovered || 
                        (isRowHighlighted && hasData) || 
                        (isColumnHighlighted && hasData);
                      
                      // Background for entire td when row or column is highlighted (but not for empty cells)
                      const showBgHighlight = (isRowHighlighted || isColumnHighlighted) && !isCellHovered && hasData;
                      const tdBgColor = showBgHighlight ? 'rgba(99, 102, 241, 0.08)' : 'transparent';
                      
                      // Check if this is a live quiz assignment that can be clicked
                      const isLiveQuiz = assignment.session_id && (assignment.session_type === 'live' || assignment.type === 'live');
                      // Paper test can be 'paper_test' (new) or 'test' (old) without session_id
                      const isPaperTest = assignment.type === 'paper_test' || (assignment.type === 'test' && !assignment.session_id);
                      const canClickLive = isLiveQuiz && hasData;
                      const canClickIndividual = isIndividual && hasData;
                      const canClickPaperTest = isPaperTest && hasData;
                      const canClick = canClickLive || canClickIndividual || canClickPaperTest;
                      
                      const handleCellClick = () => {
                        if (canClickLive) {
                          // Navigate to quiz results filtered by this student
                          navigate(`/quiz/results/${assignment.session_id}?type=${assignment.session_type || 'live'}&studentFilter=${student.id}`);
                        } else if (canClickIndividual) {
                          // For individual work, find the Firebase share session
                          // Assignment title format: "Board Title - ind."
                          // Share session ID format: shared_{boardId}_{classId}
                          const boardTitle = assignment.title.replace(' - ind.', '');
                          // Navigate to results with classId so we can find Firebase session
                          navigate(`/quiz/results/${assignment.id}?type=shared&studentFilter=${student.id}&title=${encodeURIComponent(boardTitle)}&individual=true&classId=${classId}`);
                        } else if (canClickPaperTest) {
                          // Navigate to quiz results page with paper_test type
                          navigate(`/quiz/results/${assignment.id}?type=paper_test&classId=${classId}&studentFilter=${student.id}`);
                        }
                      };
                      
                      return (
                        <td 
                          key={`result-${student.id}-${assignment.id}`}
                          style={{ 
                            width: isIndividual ? '15px' : '120px',
                            minWidth: isIndividual ? '15px' : '120px',
                            maxWidth: isIndividual ? '15px' : '120px',
                            padding: '1px 0',
                            backgroundColor: tdBgColor,
                          }}
                          onMouseEnter={() => setHoveredCell({ studentId: student.id, assignmentId: assignment.id })}
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          {isIndividual ? (
                             // Narrow bar for individual work - ONLY show if there's data
                             hasData ? (
                               <div 
                                 className={`
                                   ${shouldShowRing ? 'ring-2 ring-indigo-400' : ''}
                                   cursor-pointer hover:scale-105 transition-transform
                                 `}
                                 style={{ 
                                   width: '15px', 
                                   height: '45px', 
                                   backgroundColor: bgColor,
                                   borderRadius: '8px',
                                   margin: '0 auto',
                                 }}
                                 title={`${assignment.title}\n${student.name}: ${score}/${result?.max_score || '?'}\nKlikni pro detail`}
                                 onClick={handleCellClick}
                               />
                             ) : null // Empty individual cells are completely invisible
                          ) : isTask ? (
                            // Task submission cell - shows status, clickable to view student's work
                            <div 
                              className={`
                                flex flex-col items-center justify-center text-xs font-medium
                                ${shouldShowRing ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}
                                ${taskSubmission?.content_id ? 'cursor-pointer hover:scale-105 transition-transform' : ''}
                              `}
                              style={{ 
                                width: '120px', 
                                height: '45px', 
                                backgroundColor: taskSubmission 
                                  ? taskSubmission.status === 'submitted' || taskSubmission.status === 'graded'
                                    ? taskSubmission.ai_flags?.length > 0 ? '#FEF3C7' : '#DBEAFE'  // Amber if AI flags, blue if submitted
                                    : '#FEF9C3' // Yellow for draft
                                  : '#F3F4F6', // Gray for not started
                                borderRadius: '8px',
                                border: '1px solid',
                                borderColor: taskSubmission 
                                  ? taskSubmission.status === 'submitted' || taskSubmission.status === 'graded'
                                    ? taskSubmission.ai_flags?.length > 0 ? '#F59E0B' : '#3B82F6'
                                    : '#EAB308'
                                  : '#E5E7EB',
                              }}
                              title={taskSubmission?.content_id 
                                ? 'Klikni pro zobrazení práce studenta' 
                                : taskSubmission?.ai_flags?.length 
                                  ? `⚠️ ${taskSubmission.ai_flags.length}× AI podezření` 
                                  : undefined}
                              onClick={() => {
                                if (taskSubmission?.content_id) {
                                  // Open the student's document in read-only view mode
                                  navigate(`/library/my-content/view/${taskSubmission.content_id}?teacherView=true&studentId=${student.id}`);
                                }
                              }}
                            >
                              {!taskSubmission ? (
                                <span className="text-slate-400">-</span>
                              ) : taskSubmission.status === 'draft' ? (
                                <>
                                  <Clock className="w-3.5 h-3.5 text-amber-600 mb-0.5" />
                                  <span className="text-amber-700">Píše</span>
                                </>
                              ) : taskSubmission.status === 'submitted' ? (
                                <>
                                  {taskSubmission.ai_flags?.length > 0 ? (
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mb-0.5" />
                                  ) : (
                                    <Send className="w-3.5 h-3.5 text-blue-600 mb-0.5" />
                                  )}
                                  <span className={taskSubmission.ai_flags?.length > 0 ? 'text-amber-700' : 'text-blue-700'}>
                                    {taskSubmission.ai_flags?.length > 0 ? `AI! ⚠️` : 'Odevzdal'}
                                  </span>
                                </>
                              ) : taskSubmission.status === 'graded' ? (
                                <>
                                  <CheckCircle className="w-3.5 h-3.5 text-green-600 mb-0.5" />
                                  <span className="text-green-700">{taskSubmission.score ?? 'Hotovo'}</span>
                                </>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </div>
                          ) : (
                            // Wide cell for tests/practice/live - clickable for live quizzes
                            <div 
                              className={`
                                flex items-center justify-center text-sm font-medium
                                ${shouldShowRing ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}
                                ${canClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''}
                              `}
                              style={{ 
                                width: '120px', 
                                height: '45px', 
                                backgroundColor: bgColor, 
                                color: textColor,
                                borderRadius: '8px',
                                border: !hasData ? '1px solid #E5E7EB' : 'none',
                              }}
                              onClick={handleCellClick}
                              title={canClick ? 'Klikni pro zobrazení detailu' : undefined}
                            >
                              {!hasData ? '-' : `${score} / ${result?.max_score || 10}`}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    
                    {/* Evaluation cells */}
                    {columnVisibility.evaluations && evaluations.filter(e => e.status === 'sent').map(eval_ => {
                      const evalText = studentEvaluationsMap.get(eval_.id)?.get(student.id);
                      const hasEval = !!evalText;
                      
                      return (
                        <td 
                          key={`eval-${eval_.id}-${student.id}`}
                          className="text-center bg-purple-50/50"
                          style={{ padding: '1px' }}
                          onMouseEnter={() => setHoveredRow(student.id)}
                          onMouseLeave={() => setHoveredRow(null)}
                        >
                          <div 
                            className={`
                              flex items-center justify-center text-xs
                              ${hasEval ? 'cursor-pointer hover:scale-105 transition-transform' : ''}
                            `}
                            style={{ 
                              width: '90px', 
                              height: '45px', 
                              backgroundColor: hasEval ? '#E9D5FF' : '#F3F4F6',
                              borderRadius: '8px',
                              margin: '0 auto',
                              padding: '4px',
                            }}
                            title={evalText || 'Hodnocení není k dispozici'}
                            onClick={() => {
                              if (hasEval) {
                                // Show evaluation in a modal or navigate to detail
                                navigate(`/library/student/${student.id}`);
                              }
                            }}
                          >
                            {hasEval ? (
                              <span className="text-purple-700 line-clamp-2 text-center" style={{ fontSize: '10px' }}>
                                {evalText.length > 40 ? `${evalText.slice(0, 40)}...` : evalText}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                      );
                    })}
                    
              {/* Add student row - at bottom */}
              <tr>
                <td 
                  colSpan={filteredAssignments.length + (columnVisibility.evaluations ? filteredEvaluations.length : 0) + (columnVisibility.average ? 1 : 0) + 1}
                  className="sticky left-0 z-10 bg-white border-t border-slate-100"
                  style={{ padding: '8px 16px' }}
                >
                  <button
                    onClick={handleOpenAddStudent}
                    className="flex items-center gap-3 py-2 text-slate-400 hover:text-slate-600 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center transition-colors">
                      <Plus className="w-4 h-4" />
                      </div>
                    <span className="text-sm font-medium">Přidat studenta</span>
                  </button>
                    </td>
                  </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Board Detail Panel - NOT for paper tests (they have dedicated page) */}
      {selectedBoard && selectedBoard.type !== 'paper_test' && !(selectedBoard.type === 'test' && !selectedBoard.session_id) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleCloseBoardModal}>
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getAssignmentIcon(selectedBoard.type)}
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">{selectedBoard.title}</h2>
                    <p className="text-sm text-slate-500">
                      {selectedBoard.type === 'test' ? 'Test' : 'Procvičování'} • {formatDate(selectedBoard.due_date)}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={handleCloseBoardModal}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              {/* Mode toggle for paper tests */}
              {(selectedBoard.type === 'paper_test' || (selectedBoard.type === 'test' && !selectedBoard.board_id)) && (
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => {
                      // Close modal and navigate to dedicated upload page
                      setSelectedBoard(null);
                      navigate(`/paper-test/upload/${selectedBoard.id}?classId=${classId}`);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-purple-100 text-purple-700 hover:bg-purple-200"
                  >
                    <Camera className="w-4 h-4" />
                    Nahrát fotky
                  </button>
                </div>
              )}
            </div>
            
            {/* Content - Student Results for this board */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <>
              <h3 className="text-sm font-semibold text-slate-600 mb-4">Výsledky žáků</h3>
              <div className="space-y-2">
                {students.map(student => {
                  const result = results[student.id]?.[selectedBoard.id];
                  const score = result?.score ?? null;
                  const hasData = score !== null && score !== -1;
                  
                  return (
                    <div 
                      key={student.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100"
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: student.color }}
                        >
                          {student.initials}
                        </div>
                        <span className="font-medium text-slate-700">{student.name}</span>
                      </div>
                      <div 
                        className="px-4 py-2 rounded-lg text-sm font-medium"
                        style={{ 
                          backgroundColor: getScoreColor(score),
                          color: getTextColor(score),
                          border: !hasData ? '1px solid #E5E7EB' : 'none',
                        }}
                      >
                        {hasData ? `${score} / 10` : 'Neúčast'}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Stats for this board */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-slate-800">
                      {students.filter(s => {
                        const r = results[s.id]?.[selectedBoard.id];
                        return r?.score !== null && r?.score !== -1;
                      }).length}
                    </div>
                    <div className="text-xs text-slate-500">Zúčastnilo se</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-emerald-600">
                      {(() => {
                        const scores = students
                          .map(s => results[s.id]?.[selectedBoard.id]?.score)
                          .filter((s): s is number => s !== null && s !== undefined && s !== -1);
                        return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) : 0;
                      })()}%
                    </div>
                    <div className="text-xs text-slate-500">Průměr</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-400">
                      {students.filter(s => {
                        const r = results[s.id]?.[selectedBoard.id];
                        return r?.score === null || r?.score === undefined;
                      }).length}
                    </div>
                    <div className="text-xs text-slate-500">Chybělo</div>
                  </div>
                </div>
              </div>
                </>
            </div>
          </div>
        </div>
      )}
      
      {/* Add/Edit Student Modal */}
      {showStudentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowStudentModal(false)}>
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">
                  {editingStudent ? 'Upravit studenta' : 'Přidat studenta'}
                </h2>
                <button onClick={() => setShowStudentModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Jméno studenta *
                  </label>
                  <input
                    type="text"
                    value={studentForm.name}
                    onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                    placeholder="např. Jan Novák"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email (volitelné)
                  </label>
                  <input
                    type="email"
                    value={studentForm.email}
                    onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                    placeholder="jan.novak@skola.cz"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm"
                  />
                </div>
              </div>
              
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowStudentModal(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                >
                  Zrušit
                </button>
                <button
                  onClick={handleSaveStudent}
                  disabled={!studentForm.name.trim() || isSavingStudent}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSavingStudent ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Ukládám...
                    </>
                  ) : (
                    editingStudent ? 'Uložit změny' : 'Přidat studenta'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(null)}>
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 text-center mb-2">Odstranit studenta?</h2>
              <p className="text-slate-500 text-center text-sm mb-6">
                Tato akce smaže studenta a všechny jeho výsledky. Tuto akci nelze vrátit.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                >
                  Zrušit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteStudent(showDeleteConfirm);
                  }}
                  className="flex-1 py-3 rounded-xl font-medium transition-colors cursor-pointer"
                  style={{ backgroundColor: '#dc2626', color: 'white' }}
                >
                  Odstranit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Add Colleague Modal */}
      {showAddColleagueModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddColleagueModal(false)}>
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">Přidat kolegu</h2>
                <button onClick={() => setShowAddColleagueModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4">
                Sdílejte třídu s kolegou, který učí jiný předmět. Bude mít přístup k výsledkům svého předmětu.
              </p>
              
              {/* Existing colleagues section */}
              {colleagues.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Sdíleno s:</h3>
                  <div className="space-y-2">
                    {colleagues.map(colleague => (
                      <div key={colleague.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm font-bold">
                            {colleague.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-800 text-sm">{colleague.name}</p>
                            <p className="text-xs text-slate-500">{colleague.subject}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setColleagues(colleagues.filter(c => c.id !== colleague.id))}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Invite new colleague */}
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Pozvat nového kolegu:</h3>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={colleagueEmail}
                  onChange={(e) => setColleagueEmail(e.target.value)}
                  placeholder="email@skola.cz"
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm"
                />
                <button
                  onClick={() => {
                    if (colleagueEmail.trim()) {
                      setColleagues([...colleagues, {
                        id: `c${Date.now()}`,
                        name: colleagueEmail.split('@')[0],
                        email: colleagueEmail,
                        subject: 'Čeká na potvrzení',
                      }]);
                      setColleagueEmail('');
                    }
                  }}
                  className="px-4 py-3 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Pozvat
                </button>
              </div>
              
              <div className="mt-6 pt-4 border-t border-slate-200">
                <button
                  onClick={() => setShowAddColleagueModal(false)}
                  className="w-full py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                >
                  Hotovo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Password Setup Modal */}
      {showPasswordSetupModal && passwordSetupStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClosePasswordModal}>
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Key className="w-5 h-5 text-indigo-600" />
                  Přístup pro studenta
                </h2>
                <button onClick={handleClosePasswordModal} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6">
              {/* Student info */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl mb-6">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: passwordSetupStudent.color }}
                >
                  {passwordSetupStudent.initials}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{passwordSetupStudent.name}</p>
                  <p className="text-sm text-slate-500">{passwordSetupStudent.email || 'Bez emailu'}</p>
                </div>
              </div>
              
              {passwordSetupLoading ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
                  <p className="text-slate-600">Generuji odkaz...</p>
                </div>
              ) : passwordSetupUrl ? (
                <div>
                  <p className="text-sm text-slate-600 mb-4">
                    Pošlete tento odkaz studentovi. Po kliknutí si bude moci nastavit heslo pro přihlášení do Vividbooks.
                  </p>
                  
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      value={passwordSetupUrl}
                      readOnly
                      className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700"
                    />
                    <button
                      onClick={handleCopyLink}
                      className={`px-4 py-3 rounded-xl font-medium transition-colors flex items-center gap-2 ${
                        copiedLink 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {copiedLink ? (
                        <>
                          <Check className="w-4 h-4" />
                          Zkopírováno
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Kopírovat
                        </>
                      )}
                    </button>
                  </div>
                  
                  <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
                    <ShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800">Odkaz vyprší za 7 dní</p>
                      <p className="text-amber-700">Po vypršení bude potřeba vygenerovat nový odkaz.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <X className="w-8 h-8 text-red-600" />
                  </div>
                  <p className="text-slate-600">
                    {passwordSetupStudent.email 
                      ? 'Nepodařilo se vygenerovat odkaz.' 
                      : 'Student nemá nastavený email. Nejprve mu přidejte email v nastavení.'}
                  </p>
                </div>
              )}
              
              <div className="mt-6 pt-4 border-t border-slate-200">
                <button
                  onClick={handleClosePasswordModal}
                  className="w-full py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                >
                  Zavřít
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Evaluation Modal */}
      <EvaluationModal
        isOpen={showEvaluationModal}
        onClose={() => setShowEvaluationModal(false)}
        classId={classId}
        className={className || 'Třída'}
        students={students.map(s => {
          // results is { studentId: { assignmentId: result } }
          const studentResultsObj = results[s.id] || {};
          const studentResultsArray = Object.values(studentResultsObj);
          
          // Calculate percentage for each result
          const resultsWithPct = studentResultsArray.map(r => {
            const assignment = allAssignments.find(a => a.id === r.assignment_id);
            const pct = r.percentage !== undefined && r.percentage !== null 
              ? r.percentage 
              : (r.max_score > 0 ? Math.round((r.score / r.max_score) * 100) : 0);
            return {
              title: assignment?.title || 'Aktivita',
              score: r.score,
              maxScore: r.max_score,
              percentage: pct,
              date: r.completed_at || r.created_at || '',
              type: assignment?.type || 'test',
            };
          });
          
          let averageScore = 0;
          if (resultsWithPct.length > 0) {
            const total = resultsWithPct.reduce((sum, r) => sum + r.percentage, 0);
            averageScore = Math.round(total / resultsWithPct.length);
          }
          
          // Find best and worst results
          const sortedByScore = [...resultsWithPct].sort((a, b) => b.percentage - a.percentage);
          const bestResult = sortedByScore[0];
          const worstResult = sortedByScore[sortedByScore.length - 1];
          
          // Calculate trend from recent vs older results
          const sortedByDate = [...resultsWithPct].sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          const recentResults = sortedByDate.slice(0, Math.ceil(sortedByDate.length / 2));
          const olderResults = sortedByDate.slice(Math.ceil(sortedByDate.length / 2));
          
          let trend: 'improving' | 'declining' | 'stable' = 'stable';
          if (recentResults.length >= 1 && olderResults.length >= 1) {
            const recentAvg = recentResults.reduce((sum, r) => sum + r.percentage, 0) / recentResults.length;
            const olderAvg = olderResults.reduce((sum, r) => sum + r.percentage, 0) / olderResults.length;
            if (recentAvg > olderAvg + 5) trend = 'improving';
            else if (recentAvg < olderAvg - 5) trend = 'declining';
          }
          
          return {
            id: s.id,
            name: s.name,
            initials: s.initials,
            color: s.color,
            averageScore,
            resultsCount: resultsWithPct.length,
            bestResult,
            worstResult,
            recentResults: sortedByDate.slice(0, 5),
            trend,
          };
        })}
        onEvaluationSent={() => {
          // Reload evaluations
          getClassEvaluations(classId).then(setEvaluations);
        }}
      />
      
      {/* Message Modal */}
      {showMessageModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowMessageModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-500 to-indigo-500">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Poslat zprávu třídě</h2>
                  <p className="text-blue-100 text-sm">{className}</p>
                </div>
              </div>
              <button
                onClick={() => setShowMessageModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Předmět zprávy
                </label>
                <input
                  type="text"
                  value={messageTitle}
                  onChange={(e) => setMessageTitle(e.target.value)}
                  placeholder="např. Důležité oznámení, Připomínka..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Obsah zprávy
                </label>
                <textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="Napište zprávu pro studenty..."
                  rows={4}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Priorita
                </label>
                <div className="flex gap-2">
                  {[
                    { key: 'normal', label: 'Běžná', color: 'bg-slate-100 text-slate-700 border-slate-200' },
                    { key: 'important', label: 'Důležitá', color: 'bg-amber-100 text-amber-700 border-amber-300' },
                    { key: 'urgent', label: 'Urgentní', color: 'bg-red-100 text-red-700 border-red-300' },
                  ].map(p => (
                    <button
                      key={p.key}
                      onClick={() => setMessagePriority(p.key as any)}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border-2 transition-all ${
                        messagePriority === p.key 
                          ? p.color + ' ring-2 ring-offset-1 ring-blue-400'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="flex justify-end gap-3 p-6 border-t bg-slate-50">
              <button
                onClick={() => {
                  setShowMessageModal(false);
                  setMessageTitle('');
                  setMessageContent('');
                  setMessagePriority('normal');
                }}
                className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors font-medium"
              >
                Zrušit
              </button>
              <button
                onClick={async () => {
                  if (!messageTitle.trim() || !messageContent.trim()) return;
                  setSendingMessage(true);
                  const result = await sendClassMessage(classId, messageTitle, messageContent, messagePriority);
                  setSendingMessage(false);
                  if (result) {
                    setShowMessageModal(false);
                    setMessageTitle('');
                    setMessageContent('');
                    setMessagePriority('normal');
                    // Show success toast or notification
                    console.log('[ClassResultsGrid] Message sent successfully');
                  }
                }}
                disabled={!messageTitle.trim() || !messageContent.trim() || sendingMessage}
                style={{ backgroundColor: '#2563EB', color: 'white' }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl hover:opacity-90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingMessage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {sendingMessage ? 'Odesílám...' : 'Odeslat zprávu'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Paper Test Review Modal - Review AI results before saving */}
      {showReviewModal && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
        >
          <div className="bg-white rounded-2xl w-full max-w-4xl mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-purple-50 to-blue-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">
                    Kontrola AI výsledků
                  </h2>
                  <p className="text-sm text-slate-500">
                    {currentReviewIndex + 1} z {pendingResults.length} ke kontrole
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowReviewModal(false);
                  setPendingResults([]);
                  setCurrentReviewIndex(0);
                }}
                className="p-2 hover:bg-white/50 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            {(() => {
              const pending = pendingResults[currentReviewIndex];
              
              if (!pending || pendingResults.length === 0) {
                return (
                  <div className="flex-1 flex items-center justify-center p-12">
                    <div className="text-center">
                      <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
                      <p className="text-slate-600">Čekám na výsledky analýzy...</p>
                    </div>
                  </div>
                );
              }
              
              return (
                <>
                  {/* Content - Two columns */}
                  <div className="flex-1 overflow-auto p-6">
                    <div className="grid grid-cols-2 gap-6">
                      {/* Left - Photo */}
                      <div>
                        <h3 className="text-sm font-medium text-slate-600 mb-3">Fotka testu</h3>
                        <div className="rounded-xl overflow-hidden border-2 border-slate-200 bg-slate-50">
                          <img 
                            src={pending.imageUrl} 
                            alt="Test" 
                            className="w-full h-auto max-h-[400px] object-contain"
                          />
                        </div>
                        {pending.result.detectedName && (
                          <div className="mt-3 flex items-center gap-2 text-sm">
                            <span className="text-slate-500">Detekované jméno:</span>
                            <span className="font-medium text-purple-600">{pending.result.detectedName}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Right - AI Results */}
                      <div>
                        {/* Student */}
                        <div className="flex items-center gap-3 mb-4">
                          <div 
                            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                            style={{ backgroundColor: pending.student.color }}
                          >
                            {pending.student.initials}
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-800">{pending.student.name}</h3>
                            <p className="text-sm text-slate-500">Přiřazeno k tomuto studentovi</p>
                          </div>
                        </div>
                        
                        {/* Score Editor */}
                        <div className="bg-slate-50 rounded-xl p-4 mb-4">
                          <label className="text-sm font-medium text-slate-600 block mb-2">
                            Skóre (můžete upravit)
                          </label>
                          <div className="flex items-center gap-4">
                            <input
                              type="number"
                              min={0}
                              max={pending.result.maxScore}
                              value={pending.result.score}
                              onChange={(e) => editPendingScore(currentReviewIndex, Number(e.target.value))}
                              className="w-24 px-4 py-3 text-2xl font-bold text-center border-2 border-slate-200 rounded-xl focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none"
                            />
                            <span className="text-2xl text-slate-400">/</span>
                            <span className="text-2xl font-bold text-slate-600">{pending.result.maxScore}</span>
                            <div 
                              className="ml-4 px-4 py-2 rounded-xl text-lg font-bold"
                              style={{ 
                                backgroundColor: getScoreColor(Math.round((pending.result.score / pending.result.maxScore) * 10)),
                                color: getTextColor(Math.round((pending.result.score / pending.result.maxScore) * 10))
                              }}
                            >
                              {Math.round((pending.result.score / pending.result.maxScore) * 100)}%
                            </div>
                          </div>
                        </div>
                        
                        {/* AI Comment */}
                        {pending.result.comment && (
                          <div className="bg-purple-50 rounded-xl p-4 mb-4">
                            <h4 className="text-sm font-medium text-purple-700 mb-2 flex items-center gap-2">
                              <Sparkles className="w-4 h-4" />
                              AI komentář
                            </h4>
                            <p className="text-slate-700">{pending.result.comment}</p>
                          </div>
                        )}
                        
                        {/* Detected Answers - Editable */}
                        <div className="bg-slate-50 rounded-xl p-4 max-h-72 overflow-y-auto">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-medium text-slate-600">
                              Rozpoznané odpovědi ({pending.result.answers?.length || 0})
                            </h4>
                            <button
                              onClick={() => addMissingQuestion(currentReviewIndex)}
                              className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              Přidat otázku
                            </button>
                          </div>
                          
                          {(!pending.result.answers || pending.result.answers.length === 0) ? (
                            <div className="text-center py-4 text-slate-400 text-sm">
                              Žádné odpovědi nebyly rozpoznány. Klikněte na "Přidat otázku" pro ruční přidání.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {pending.result.answers.map((answer: any, i: number) => {
                                // Handle both old format (string) and new format (object)
                                const isObject = typeof answer === 'object';
                                const qNum = isObject ? answer.questionNumber : i + 1;
                                const qType = isObject ? answer.questionType : 'abc';
                                const answerText = isObject ? answer.answer : answer;
                                const isCorrect = isObject ? answer.isCorrect : null;
                                const points = isObject ? answer.points : null;
                                const maxPoints = isObject ? answer.maxPoints : 1;
                                const isRecognized = isObject ? (answer.recognized !== false) : true;
                                const questionText = isObject ? answer.question : null;
                                const correctAnswer = isObject ? answer.correctAnswer : null;
                                
                                // Determine background color
                                const bgClass = !isRecognized && !answerText
                                  ? 'bg-red-100 border-red-400 ring-2 ring-red-300' // Unrecognized - needs attention
                                  : isCorrect === true ? 'bg-green-50 border-green-200'
                                  : isCorrect === false ? 'bg-orange-50 border-orange-200'
                                  : 'bg-white border-slate-200';
                                
                                return (
                                  <div 
                                    key={i} 
                                    className={`p-3 rounded-lg border ${bgClass}`}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <span className={`text-xs font-medium ${!isRecognized && !answerText ? 'text-red-600' : 'text-slate-500'}`}>
                                          {!isRecognized && !answerText ? '⚠️ ' : ''}Ot. {qNum}
                                        </span>
                                        <span className={`text-xs px-1.5 py-0.5 rounded ${qType === 'open' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                          {qType === 'open' ? 'Otevřená' : 'ABC'}
                                        </span>
                                        {correctAnswer && (
                                          <span className="text-xs text-green-600">
                                            ✓ {correctAnswer}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="number"
                                          min={0}
                                          max={maxPoints}
                                          value={points || 0}
                                          onChange={(e) => editPendingAnswer(currentReviewIndex, i, 'points', Number(e.target.value))}
                                          className="w-8 text-xs text-center border rounded"
                                        />
                                        <span className="text-xs text-slate-400">/</span>
                                        <span className="text-xs font-medium">{maxPoints}</span>
                                        <span className="text-xs text-slate-400">b.</span>
                                      </div>
                                    </div>
                                    {questionText && (
                                      <p className="text-xs text-slate-500 mb-2 line-clamp-1">{questionText}</p>
                                    )}
                                    {qType === 'open' ? (
                                      <textarea
                                        value={answerText}
                                        onChange={(e) => {
                                          editPendingAnswer(currentReviewIndex, i, 'answer', e.target.value);
                                          if (!isRecognized && e.target.value) {
                                            editPendingAnswer(currentReviewIndex, i, 'recognized', true);
                                          }
                                        }}
                                        className={`w-full text-sm p-2 border rounded-lg resize-none italic ${
                                          !isRecognized && !answerText ? 'border-red-400 bg-red-50' : ''
                                        }`}
                                        rows={2}
                                        placeholder={!isRecognized ? '⚠️ AI nerozpoznala - doplň ručně...' : 'Přepis odpovědi...'}
                                      />
                                    ) : (
                                      <input
                                        type="text"
                                        value={answerText}
                                        onChange={(e) => {
                                          editPendingAnswer(currentReviewIndex, i, 'answer', e.target.value.toUpperCase());
                                          if (!isRecognized && e.target.value) {
                                            editPendingAnswer(currentReviewIndex, i, 'recognized', true);
                                          }
                                        }}
                                        className={`w-16 text-sm font-bold text-center p-1 border rounded ${
                                          !isRecognized && !answerText ? 'border-red-400 bg-red-50' : ''
                                        }`}
                                        placeholder={!isRecognized ? '?' : 'A/B/C/D'}
                                        maxLength={1}
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Footer */}
                  <div className="flex items-center justify-between p-6 border-t bg-slate-50">
                    {/* Navigation */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentReviewIndex(Math.max(0, currentReviewIndex - 1))}
                        disabled={currentReviewIndex === 0}
                        className="p-2 rounded-lg hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <span className="text-sm text-slate-500">
                        {currentReviewIndex + 1} / {pendingResults.length}
                      </span>
                      <button
                        onClick={() => setCurrentReviewIndex(Math.min(pendingResults.length - 1, currentReviewIndex + 1))}
                        disabled={currentReviewIndex >= pendingResults.length - 1}
                        className="p-2 rounded-lg hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                    
                    {/* Actions */}
                    {(() => {
                      // Check for unrecognized answers
                      const unrecognizedCount = (pending.result.answers || []).filter(
                        (a: any) => typeof a === 'object' && a.recognized === false && !a.answer
                      ).length;
                      const hasUnrecognized = unrecognizedCount > 0;
                      
                      return (
                        <div className="flex items-center gap-3">
                          {hasUnrecognized && (
                            <span className="text-sm text-red-500 font-medium">
                              ⚠️ {unrecognizedCount} nerozpoznán{unrecognizedCount === 1 ? 'á' : 'é'}
                            </span>
                          )}
                          <button
                            onClick={() => skipReviewedResult(currentReviewIndex)}
                            className="px-5 py-2.5 text-slate-600 hover:bg-slate-200 rounded-xl transition-colors font-medium"
                          >
                            Přeskočit
                          </button>
                          <button
                            onClick={() => saveReviewedResult(currentReviewIndex)}
                            disabled={hasUnrecognized}
                            className={`px-6 py-2.5 rounded-xl transition-colors font-medium flex items-center gap-2 ${
                              hasUnrecognized 
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                : 'bg-green-500 text-white hover:bg-green-600'
                            }`}
                            title={hasUnrecognized ? 'Nejdříve doplň chybějící odpovědi' : ''}
                          >
                            <Check className="w-5 h-5" />
                            {hasUnrecognized ? 'Doplň odpovědi' : 'Potvrdit a uložit'}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </>
              );
            })()}
          </div>
        </div>,
        document.body
      )}
      
      {/* Paper Test Result Detail Modal */}
      {selectedResult && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedResult(null);
          }}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  Detail výsledku
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {selectedResult.assignment.title}
                </p>
              </div>
              <button
                onClick={() => setSelectedResult(null)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            {/* Student Info */}
            <div className="p-6 border-b">
              <div className="flex items-center gap-4">
                <div 
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold"
                  style={{ backgroundColor: selectedResult.student.color }}
                >
                  {selectedResult.student.initials}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">
                    {selectedResult.student.name}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {selectedResult.assignment.due_date 
                      ? new Date(selectedResult.assignment.due_date).toLocaleDateString('cs-CZ')
                      : 'Bez data'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Score */}
            <div className="p-6 border-b">
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-600 font-medium">Dosažené skóre</span>
                <div 
                  className="px-4 py-2 rounded-xl text-lg font-bold"
                  style={{ 
                    backgroundColor: getScoreColor(
                      selectedResult.result.percentage !== undefined 
                        ? Math.round(selectedResult.result.percentage / 10)
                        : selectedResult.result.score
                    ),
                    color: getTextColor(
                      selectedResult.result.percentage !== undefined 
                        ? Math.round(selectedResult.result.percentage / 10)
                        : selectedResult.result.score
                    )
                  }}
                >
                  {selectedResult.result.score} / {selectedResult.result.max_score || 10}
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${(selectedResult.result.score / (selectedResult.result.max_score || 10)) * 100}%`,
                    backgroundColor: getScoreColor(
                      selectedResult.result.percentage !== undefined 
                        ? Math.round(selectedResult.result.percentage / 10)
                        : selectedResult.result.score
                    )
                  }}
                />
              </div>
              <div className="flex justify-between text-sm text-slate-500 mt-2">
                <span>0%</span>
                <span className="font-medium">
                  {Math.round((selectedResult.result.score / (selectedResult.result.max_score || 10)) * 100)}%
                </span>
                <span>100%</span>
              </div>
            </div>
            
            {/* AI Comment */}
            {selectedResult.result.teacher_comment && (
              <div className="p-6 border-b">
                <h4 className="text-sm font-medium text-slate-600 mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  AI komentář
                </h4>
                <p className="text-slate-700 bg-purple-50 p-4 rounded-xl">
                  {selectedResult.result.teacher_comment}
                </p>
              </div>
            )}
            
            {/* Footer */}
            <div className="flex justify-end gap-3 p-6">
              <button
                onClick={() => setSelectedResult(null)}
                className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors font-medium"
              >
                Zavřít
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

