/**
 * StudentWorkspace - Student's personal content workspace
 * 
 * Similar to MyContentLayout for teachers, but for students:
 * - View and work on assigned tasks
 * - Create own documents/presentations
 * - View submitted and graded work
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  FileText,
  Presentation,
  ClipboardCheck,
  Plus,
  Clock,
  CheckCircle,
  Star,
  Folder,
  FolderPlus,
  ChevronRight,
  ChevronLeft,
  Send,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Calendar,
  Bot,
  BotOff,
  Sparkles,
  Eye,
  Edit,
  Moon,
  Sun,
  Menu,
  X,
  LogOut,
  Home,
  MoreVertical,
  Trash2,
  Pencil,
} from 'lucide-react';
import VividLogo from '../../imports/Group70';
import { ToolsMenu } from '../ToolsMenu';
import { ToolsDropdown } from '../ToolsDropdown';
import { useStudentAuth } from '../../contexts/StudentAuthContext';
import {
  StudentAssignment,
  StudentSubmission,
  ASSIGNMENT_TYPE_LABELS,
  SUBMISSION_STATUS_LABELS,
  SUBMISSION_STATUS_COLORS,
} from '../../types/student-assignment';
import {
  getAssignmentsForStudent,
  getStudentSubmissions,
  startAssignment,
  submitAssignment,
} from '../../utils/student-assignments';
import { parseISO, format, formatDistanceToNow, isPast } from 'date-fns';
import { cs } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  StudentContentItem,
  getStudentContent,
  addStudentContentItem,
  createStudentFolder,
  deleteStudentContentItem,
  updateStudentContentItem,
  syncStudentContentToCloud,
} from '../../utils/student-content-sync';
import { loadWorksheet } from '../../utils/worksheet-storage';

interface StudentWorkspaceProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

type TabType = 'assignments' | 'my-work' | 'submitted';

export function StudentWorkspace({ theme, toggleTheme }: StudentWorkspaceProps) {
  const navigate = useNavigate();
  const { student, loading: authLoading, logout } = useStudentAuth();

  const [activeTab, setActiveTab] = useState<TabType>('assignments');
  const [assignments, setAssignments] = useState<(StudentAssignment & { submission?: StudentSubmission })[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  
  // Student's own content
  const [myContent, setMyContent] = useState<StudentContentItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Load data
  useEffect(() => {
    async function loadData() {
      if (!student?.id || !student?.class_id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [loadedAssignments, loadedSubmissions] = await Promise.all([
          getAssignmentsForStudent(student.class_id),
          getStudentSubmissions(student.id),
        ]);

        setAssignments(loadedAssignments);
        setSubmissions(loadedSubmissions);
        
        // Load student's own content
        const content = getStudentContent(student.id);
        setMyContent(content);
      } catch (error) {
        console.error('Error loading workspace data:', error);
        toast.error('Nepodařilo se načíst data');
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      loadData();
    }
  }, [student, authLoading]);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !student) {
      navigate('/student/login');
    }
  }, [authLoading, student, navigate]);

  // Categorize assignments
  const pendingAssignments = assignments.filter(a => {
    const sub = submissions.find(s => s.assignment_id === a.id);
    return !sub || sub.status === 'not_started' || sub.status === 'draft';
  });

  const submittedAssignments = assignments.filter(a => {
    const sub = submissions.find(s => s.assignment_id === a.id);
    return sub && (sub.status === 'submitted' || sub.status === 'graded');
  });

  const handleStartAssignment = async (assignment: StudentAssignment) => {
    if (!student) return;

    // Check if already started
    const existing = submissions.find(s => s.assignment_id === assignment.id);
    if (existing) {
      // Navigate to continue working
      navigate(`/student/assignment/${assignment.id}`);
      return;
    }

    // Create new submission and navigate
    try {
      const contentType = assignment.type === 'presentation' ? 'board' : 'document';
      const contentId = `student_${assignment.type}_${Date.now()}`;
      
      await startAssignment(student.id, assignment.id, contentType, contentId);
      
      // Navigate to assignment editor
      navigate(`/student/assignment/${assignment.id}`);
    } catch (error) {
      console.error('Error starting assignment:', error);
      toast.error('Nepodařilo se zahájit úkol');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/student/login');
  };

  // Create new document
  const handleCreateDocument = () => {
    if (!student) return;
    
    // Create a new worksheet with student ID as prefix
    const worksheetId = `student_doc_${Date.now()}`;
    
    // Add to student content
    addStudentContentItem(student.id, {
      name: 'Nový dokument',
      type: 'document',
      content_id: worksheetId,
      folder_id: currentFolderId,
    });
    
    // Refresh content list
    setMyContent(getStudentContent(student.id));
    
    // Sync to cloud
    syncStudentContentToCloud(student.id);
    
    // Navigate to editor
    navigate(`/library/my-content/worksheet-editor/${worksheetId}?studentMode=true`);
  };

  // Create new presentation
  const handleCreatePresentation = () => {
    if (!student) return;
    
    const boardId = `student_board_${Date.now()}`;
    
    addStudentContentItem(student.id, {
      name: 'Nová prezentace',
      type: 'board',
      content_id: boardId,
      folder_id: currentFolderId,
    });
    
    setMyContent(getStudentContent(student.id));
    syncStudentContentToCloud(student.id);
    navigate(`/quiz/${boardId}?studentMode=true`);
  };

  // Create folder
  const handleCreateFolder = () => {
    if (!student || !newFolderName.trim()) return;
    
    createStudentFolder(student.id, newFolderName.trim(), currentFolderId);
    setMyContent(getStudentContent(student.id));
    syncStudentContentToCloud(student.id);
    
    setNewFolderName('');
    setShowCreateFolderModal(false);
    toast.success('Složka vytvořena');
  };

  // Delete content item
  const handleDeleteItem = (itemId: string) => {
    if (!student) return;
    
    deleteStudentContentItem(student.id, itemId);
    setMyContent(getStudentContent(student.id));
    syncStudentContentToCloud(student.id);
    toast.success('Smazáno');
  };

  // Open content item
  const handleOpenItem = (item: StudentContentItem) => {
    if (item.type === 'folder') {
      setCurrentFolderId(item.id);
    } else if (item.type === 'document' && item.content_id) {
      navigate(`/library/my-content/worksheet-editor/${item.content_id}?studentMode=true`);
    } else if (item.type === 'board' && item.content_id) {
      navigate(`/library/quiz-editor/${item.content_id}?studentMode=true`);
    }
  };

  // Navigate to parent folder
  const handleGoBack = () => {
    if (!currentFolderId) return;
    
    // Find parent folder
    const currentFolder = myContent.find(c => c.id === currentFolderId);
    setCurrentFolderId(currentFolder?.folder_id);
  };

  // Get current folder's content
  const currentFolderContent = myContent.filter(
    item => (item.folder_id || undefined) === currentFolderId
  );
  const currentFolderInfo = currentFolderId 
    ? myContent.find(c => c.id === currentFolderId) 
    : null;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!student) {
    return null;
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-slate-900' : 'bg-slate-50'}`}>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="h-full px-4 flex items-center justify-between">
          {/* Left side */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <Link to="/student" className="flex items-center gap-3">
              <VividLogo theme={theme} />
              <div>
                <span className="text-lg font-bold text-slate-800 dark:text-white">
                  Můj pracovní prostor
                </span>
              </div>
            </Link>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-slate-400" />
              ) : (
                <Moon className="w-5 h-5 text-slate-500" />
              )}
            </button>

            {/* Student info */}
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: student.color }}
              >
                {student.initials}
              </div>
              <span className="hidden md:block text-sm font-medium text-slate-700 dark:text-slate-300">
                {student.name}
              </span>
            </div>

            <ToolsDropdown 
              theme={theme} 
              isOpen={toolsOpen} 
              setIsOpen={setToolsOpen}
            >
              <ToolsMenu
                theme={theme}
                toggleTheme={toggleTheme}
                closeDropdown={() => setToolsOpen(false)}
              />
            </ToolsDropdown>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="pt-16 flex">
        {/* Sidebar */}
        <aside className={`
          fixed lg:static inset-y-0 left-0 z-40 w-64 pt-16 lg:pt-0
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700
        `}>
          <nav className="p-4 space-y-2">
            <Link
              to="/student"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Home className="w-5 h-5" />
              Moje zeď
            </Link>

            <div className="h-px bg-slate-200 dark:bg-slate-700 my-2" />

            <button
              onClick={() => setActiveTab('assignments')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                activeTab === 'assignments'
                  ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Send className="w-5 h-5" />
              Zadané úkoly
              {pendingAssignments.length > 0 && (
                <span className="ml-auto px-2 py-0.5 text-xs font-bold bg-indigo-600 text-white rounded-full">
                  {pendingAssignments.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('my-work')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                activeTab === 'my-work'
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Folder className="w-5 h-5" />
              Moje práce
            </button>

            <button
              onClick={() => setActiveTab('submitted')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                activeTab === 'submitted'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <CheckCircle className="w-5 h-5" />
              Odevzdané
              {submittedAssignments.length > 0 && (
                <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                  {submittedAssignments.length}
                </span>
              )}
            </button>

            <div className="h-px bg-slate-200 dark:bg-slate-700 my-2" />

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Odhlásit se
            </button>
          </nav>
        </aside>

        {/* Content area */}
        <main className="flex-1 p-6 lg:p-8 min-h-[calc(100vh-4rem)]">
          {/* Tab: Assignments */}
          {activeTab === 'assignments' && (
            <div className="max-w-4xl mx-auto">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                  Zadané úkoly
                </h1>
                <p className="text-slate-500 dark:text-slate-400">
                  Úkoly zadané učitelem ke splnění
                </p>
              </div>

              {pendingAssignments.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
                  <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-2">
                    Všechno hotovo!
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400">
                    Nemáte žádné nezpracované úkoly
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingAssignments.map(assignment => {
                    const submission = submissions.find(s => s.assignment_id === assignment.id);
                    const isDraft = submission?.status === 'draft';
                    const isOverdue = assignment.due_date && isPast(parseISO(assignment.due_date));

                    return (
                      <div
                        key={assignment.id}
                        className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 hover:shadow-lg transition-shadow"
                      >
                        <div className="flex items-start gap-4">
                          {/* Type icon */}
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                            assignment.type === 'document'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                              : assignment.type === 'presentation'
                              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                              : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                          }`}>
                            {assignment.type === 'document' && <FileText className="w-6 h-6" />}
                            {assignment.type === 'presentation' && <Presentation className="w-6 h-6" />}
                            {assignment.type === 'test' && <ClipboardCheck className="w-6 h-6" />}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                                {assignment.title}
                              </h3>
                              {isDraft && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                                  Rozpracováno
                                </span>
                              )}
                            </div>

                            <p className="text-slate-600 dark:text-slate-300 mb-3 line-clamp-2">
                              {assignment.description}
                            </p>

                            <div className="flex items-center gap-4 text-sm">
                              {/* Due date */}
                              {assignment.due_date && (
                                <div className={`flex items-center gap-1 ${
                                  isOverdue ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'
                                }`}>
                                  <Calendar className="w-4 h-4" />
                                  <span>
                                    {isOverdue ? 'Po termínu: ' : 'Do: '}
                                    {format(parseISO(assignment.due_date), 'd. M. yyyy', { locale: cs })}
                                  </span>
                                </div>
                              )}

                              {/* AI indicator */}
                              <div className={`flex items-center gap-1 ${
                                assignment.allow_ai
                                  ? 'text-purple-500 dark:text-purple-400'
                                  : 'text-slate-400 dark:text-slate-500'
                              }`}>
                                {assignment.allow_ai ? (
                                  <>
                                    <Sparkles className="w-4 h-4" />
                                    <span>AI povoleno</span>
                                  </>
                                ) : (
                                  <>
                                    <BotOff className="w-4 h-4" />
                                    <span>Bez AI</span>
                                  </>
                                )}
                              </div>

                              {/* Type label */}
                              <span className="text-slate-400 dark:text-slate-500">
                                {ASSIGNMENT_TYPE_LABELS[assignment.type]}
                              </span>
                            </div>
                          </div>

                          {/* Action button */}
                          <button
                            onClick={() => handleStartAssignment(assignment)}
                            className={`px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 shrink-0 ${
                              isDraft
                                ? 'bg-amber-100 hover:bg-amber-200 text-amber-700'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            }`}
                          >
                            {isDraft ? (
                              <>
                                <Edit className="w-4 h-4" />
                                Pokračovat
                              </>
                            ) : (
                              <>
                                <Plus className="w-4 h-4" />
                                Začít
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab: My Work */}
          {activeTab === 'my-work' && (
            <div className="max-w-4xl mx-auto">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {currentFolderId && (
                    <button
                      onClick={handleGoBack}
                      className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  )}
                  <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                      {currentFolderInfo ? currentFolderInfo.name : 'Moje práce'}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                      {currentFolderInfo ? 'Obsah složky' : 'Vlastní dokumenty a prezentace'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCreateFolderModal(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-xl transition-colors"
                  >
                    <FolderPlus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleCreateDocument}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 font-medium rounded-xl transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Nový dokument
                  </button>
                  <button
                    onClick={handleCreatePresentation}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 font-medium rounded-xl transition-colors"
                  >
                    <Presentation className="w-4 h-4" />
                    Nová prezentace
                  </button>
                </div>
              </div>

              {currentFolderContent.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <Folder className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                  <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-2">
                    {currentFolderId ? 'Složka je prázdná' : 'Zatím nemáte žádné vlastní práce'}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-6">
                    Vytvořte si první dokument nebo prezentaci
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {/* Folders first */}
                  {currentFolderContent
                    .filter(item => item.type === 'folder')
                    .map(folder => (
                      <div
                        key={folder.id}
                        onClick={() => handleOpenItem(folder)}
                        className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 cursor-pointer hover:shadow-lg transition-all group"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <Folder className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteItem(folder.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <h3 className="font-medium text-slate-800 dark:text-white truncate">
                          {folder.name}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Složka
                        </p>
                      </div>
                    ))}

                  {/* Files */}
                  {currentFolderContent
                    .filter(item => item.type !== 'folder')
                    .map(item => (
                      <div
                        key={item.id}
                        onClick={() => handleOpenItem(item)}
                        className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 cursor-pointer hover:shadow-lg transition-all group"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            item.type === 'document'
                              ? 'bg-blue-100 dark:bg-blue-900/30'
                              : 'bg-purple-100 dark:bg-purple-900/30'
                          }`}>
                            {item.type === 'document' ? (
                              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            ) : (
                              <Presentation className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteItem(item.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <h3 className="font-medium text-slate-800 dark:text-white truncate">
                          {item.name}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {item.type === 'document' ? 'Dokument' : 'Prezentace'}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Submitted */}
          {activeTab === 'submitted' && (
            <div className="max-w-4xl mx-auto">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                  Odevzdané úkoly
                </h1>
                <p className="text-slate-500 dark:text-slate-400">
                  Historie odevzdaných prací a hodnocení
                </p>
              </div>

              {submittedAssignments.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <Clock className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                  <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-2">
                    Zatím nic odevzdáno
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400">
                    Odevzdané úkoly se zobrazí zde
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {submittedAssignments.map(assignment => {
                    const submission = submissions.find(s => s.assignment_id === assignment.id);
                    if (!submission) return null;

                    const isGraded = submission.status === 'graded';
                    const statusColors = SUBMISSION_STATUS_COLORS[submission.status];

                    return (
                      <div
                        key={assignment.id}
                        className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6"
                      >
                        <div className="flex items-start gap-4">
                          {/* Type icon */}
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                            assignment.type === 'document'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                              : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                          }`}>
                            {assignment.type === 'document' && <FileText className="w-6 h-6" />}
                            {assignment.type === 'presentation' && <Presentation className="w-6 h-6" />}
                            {assignment.type === 'test' && <ClipboardCheck className="w-6 h-6" />}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                                {assignment.title}
                              </h3>
                              <span
                                className="px-2 py-0.5 text-xs font-medium rounded-full"
                                style={{
                                  backgroundColor: statusColors.bg,
                                  color: statusColors.text,
                                }}
                              >
                                {SUBMISSION_STATUS_LABELS[submission.status]}
                              </span>
                            </div>

                            <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mb-3">
                              <span>
                                Odevzdáno: {submission.submitted_at
                                  ? format(parseISO(submission.submitted_at), 'd. M. yyyy', { locale: cs })
                                  : 'N/A'
                                }
                              </span>
                            </div>

                            {/* Grading info */}
                            {isGraded && submission.score !== undefined && (
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <Star className="w-4 h-4 text-amber-500" />
                                  <span className="font-semibold text-slate-800 dark:text-white">
                                    {submission.score} / {submission.max_score || 100} bodů
                                  </span>
                                </div>
                                {submission.teacher_comment && (
                                  <p className="text-slate-600 dark:text-slate-300">
                                    "{submission.teacher_comment}"
                                  </p>
                                )}
                              </div>
                            )}

                            {/* AI flags warning */}
                            {submission.ai_flags.length > 0 && (
                              <div className="mt-2 flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
                                <AlertCircle className="w-4 h-4" />
                                <span>
                                  Detekováno {submission.ai_flags.length}× podezření na AI text
                                </span>
                              </div>
                            )}
                          </div>

                          {/* View button */}
                          <button
                            onClick={() => {
                              // Navigate to view the submitted work
                              toast.info('Zobrazení odevzdané práce bude brzy k dispozici');
                            }}
                            className="px-4 py-2 rounded-xl font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-2"
                          >
                            <Eye className="w-4 h-4" />
                            Zobrazit
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Create Folder Modal */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">
              Nová složka
            </h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Název složky"
              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
                if (e.key === 'Escape') setShowCreateFolderModal(false);
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateFolderModal(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Zrušit
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Vytvořit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentWorkspace;

