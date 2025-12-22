/**
 * Class Results Grid Component
 * 
 * Displays a matrix of student results with columns for each assignment
 * Supports toggling individual work visibility and demo/Supabase data
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
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
} from '../../utils/supabase/classes';

interface ClassResultsGridProps {
  classId: string;
  className: string;
  onBack?: () => void;
}

export function ClassResultsGrid({ classId, className, onBack }: ClassResultsGridProps) {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [results, setResults] = useState<{ [studentId: string]: { [assignmentId: string]: StudentResult } }>({});
  const [loading, setLoading] = useState(true);
  
  // Toggle states
  const [showIndividual, setShowIndividual] = useState(true);
  // Use global Supabase setting from localStorage
  const [useSupabase, setUseSupabase] = useState(() => isUsingSupabase());
  
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
  
  // Subject and colleague management - load from localStorage
  const [subjects, setSubjects] = useState<string[]>(() => {
    const saved = localStorage.getItem(`class_${classId}_subjects`);
    return saved ? JSON.parse(saved) : ['Fyzika', 'Matematika'];
  });
  const [selectedSubject, setSelectedSubject] = useState<string>('Fyzika');
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [showAddColleagueModal, setShowAddColleagueModal] = useState(false);
  const [colleagueEmail, setColleagueEmail] = useState('');
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
  
  // Save subjects to localStorage when they change
  useEffect(() => {
    localStorage.setItem(`class_${classId}_subjects`, JSON.stringify(subjects));
  }, [subjects, classId]);
  
  // Save colleagues to localStorage when they change
  useEffect(() => {
    localStorage.setItem(`class_${classId}_colleagues`, JSON.stringify(colleagues));
  }, [colleagues, classId]);
  
  // Available subjects to add (those not already added)
  const availableSubjects = VIVIDBOOKS_SUBJECTS.filter(s => !subjects.includes(s));
  
  // Load data
  useEffect(() => {
    loadData();
  }, [classId, showIndividual, useSupabase]);
  
  const loadData = async () => {
    setLoading(true);
    setDataSource(useSupabase);
    
    const data = await getClassWithData(classId, showIndividual);
    
    if (data) {
      setStudents(data.students);
      setAssignments(data.assignments);
      setResults(data.results);
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
  
  // Filter assignments by type AND subject
  const filteredAssignments = assignments.filter(a => {
    // Filter by subject - but always show 'live' type assignments (quiz results)
    const subjectMatch = !a.subject || a.subject === selectedSubject || a.type === 'live';
    // Filter by individual work visibility
    const typeMatch = showIndividual || a.type !== 'individual';
    return subjectMatch && typeMatch;
  });
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Subject tabs and colleague sharing */}
      <div className="flex items-center justify-between bg-white rounded-xl p-3 border border-slate-200">
        <div className="flex items-center gap-2">
          {/* Subject tabs */}
          {subjects.map((subject) => (
            <button
              key={subject}
              onClick={() => setSelectedSubject(subject)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedSubject === subject
                  ? 'bg-indigo-100 text-indigo-700 shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <div className={`w-2.5 h-2.5 rounded-full ${selectedSubject === subject ? 'bg-indigo-500' : 'bg-slate-400'}`} />
              {subject}
            </button>
          ))}
          
          {/* Add subject dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSubjectDropdown(!showSubjectDropdown)}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"
            >
              <Plus className="w-4 h-4" />
              Předmět
            </button>
            
            {showSubjectDropdown && availableSubjects.length > 0 && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSubjectDropdown(false)} />
                <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-20 min-w-[180px]">
                  {availableSubjects.map((subject) => (
                    <button
                      key={subject}
                      onClick={() => {
                        setSubjects([...subjects, subject]);
                        setShowSubjectDropdown(false);
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
        
        {/* Colleague sharing */}
        <div className="flex items-center gap-2">
          {colleagues.length > 0 && (
            <div className="flex -space-x-2">
              {colleagues.slice(0, 3).map((colleague) => (
                <div
                  key={colleague.id}
                  className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold border-2 border-white"
                  title={`${colleague.name} (${colleague.subject})`}
                >
                  {colleague.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowAddColleagueModal(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Přidat kolegu
          </button>
        </div>
      </div>
      
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Individual work toggle */}
          <button
            onClick={() => setShowIndividual(!showIndividual)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              showIndividual 
                ? 'bg-indigo-100 text-indigo-700' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {showIndividual ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            Individuální práce
          </button>
          
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
      
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#FEE2E2' }}>
            <CheckCircle className="w-3 h-3 m-0.5" style={{ color: '#DC2626' }} />
          </div>
          <span>Test</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#D1FAE5' }}>
            <BookOpen className="w-3 h-3 m-0.5" style={{ color: '#059669' }} />
          </div>
          <span>Procvičování</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#E0E7FF' }}>
            <ClipboardList className="w-3 h-3 m-0.5" style={{ color: '#4F46E5' }} />
          </div>
          <span>Individuální</span>
        </div>
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
                <th className="px-4 py-2 text-xs font-normal text-slate-400 text-center" style={{ minWidth: '80px' }}>
                  Ø
                </th>
              </tr>
              
              {/* Assignment name row */}
              <tr>
                <th className="sticky left-0 z-10 bg-white px-4 py-2 text-left text-sm font-medium text-slate-700 border-b border-slate-200">
                  Student
                </th>
                {filteredAssignments.map((assignment) => {
                  const isIndividual = assignment.type === 'individual';
                  
                  // Handle click on column header - navigate to results or show board detail
                  const handleColumnClick = () => {
                    if (isIndividual) return;
                    
                    // For live quiz assignments, navigate to quiz results page
                    if (assignment.session_id && (assignment.session_type === 'live' || assignment.type === 'live')) {
                      navigate(`/quiz/results/${assignment.session_id}?type=${assignment.session_type || 'live'}`);
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
                <th className="px-4 py-2 text-center text-xs font-medium text-slate-700 border-b border-slate-200">
                  Průměr
                </th>
              </tr>
            </thead>
            
            {/* Body */}
            <tbody>
              {/* Add student row */}
              <tr>
                <td 
                  colSpan={filteredAssignments.length + 2}
                  className="sticky left-0 z-10 bg-white"
                  style={{ padding: '1px 16px' }}
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
                    
                    {/* Results */}
                    {filteredAssignments.map((assignment) => {
                      const result = results[student.id]?.[assignment.id];
                      const score = result?.score ?? null;
                      // Use percentage for color if available, otherwise calculate from score/max_score
                      const percentage = result?.percentage ?? (score !== null && result?.max_score ? Math.round((score / result.max_score) * 100) : null);
                      // Convert percentage (0-100) to 1-10 scale for color function
                      const colorScore = percentage !== null ? Math.round(percentage / 10) : score;
                      const bgColor = getScoreColor(colorScore);
                      const textColor = getTextColor(colorScore);
                      const isIndividual = assignment.type === 'individual';
                      const hasData = score !== null && score !== -1;
                      
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
                      const canClick = isLiveQuiz && hasData;
                      
                      const handleCellClick = () => {
                        if (canClick) {
                          // Navigate to quiz results filtered by this student
                          navigate(`/quiz/results/${assignment.session_id}?type=${assignment.session_type || 'live'}&studentFilter=${student.id}`);
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
                                 style={{ 
                                   width: '15px', 
                                   height: '45px', 
                                   backgroundColor: bgColor,
                                   borderRadius: '8px',
                                   margin: '0 auto',
                                 }}
                                 title={`${score}/10`}
                               />
                             ) : null // Empty individual cells are completely invisible
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
                    
                    {/* Average */}
                    <td className="px-2 text-center" style={{ padding: '1px 8px' }}>
                      <div 
                        className="flex items-center justify-center text-sm font-bold text-white"
                        style={{ 
                          width: '70px', 
                          height: '45px', 
                          backgroundColor: '#4A90E2',
                          borderRadius: '8px',
                          margin: '0 auto',
                        }}
                      >
                        {average !== null ? `${average}%` : '-'}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Stats summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-2xl font-bold text-slate-800">{students.length}</div>
          <div className="text-sm text-slate-500">Studentů</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-2xl font-bold text-slate-800">{filteredAssignments.filter(a => a.type === 'test').length}</div>
          <div className="text-sm text-slate-500">Testů</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-2xl font-bold text-slate-800">{filteredAssignments.filter(a => a.type === 'practice').length}</div>
          <div className="text-sm text-slate-500">Procvičování</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-2xl font-bold text-indigo-600">{filteredAssignments.filter(a => a.type === 'individual').length}</div>
          <div className="text-sm text-slate-500">Individuální</div>
        </div>
      </div>
      
      {/* Board Detail Panel */}
      {selectedBoard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedBoard(null)}>
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
                  onClick={() => setSelectedBoard(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            {/* Content - Student Results for this board */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
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
    </div>
  );
}

