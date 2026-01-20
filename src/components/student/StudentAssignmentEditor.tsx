/**
 * StudentAssignmentEditor - Editor for student assignments
 * 
 * Opens when student starts/continues working on an assignment.
 * Shows the assignment instructions and provides the appropriate editor.
 * Includes AI detection when AI is not allowed.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Send,
  FileText,
  Presentation,
  ClipboardCheck,
  Clock,
  Calendar,
  Sparkles,
  BotOff,
  AlertTriangle,
  CheckCircle,
  Info,
  Loader2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  History,
} from 'lucide-react';
import { useStudentAuth } from '../../contexts/StudentAuthContext';
import {
  StudentAssignment,
  StudentSubmission,
  ASSIGNMENT_TYPE_LABELS,
  AIDetectionFlag,
} from '../../types/student-assignment';
import {
  getAssignment,
  getSubmission,
  startAssignment,
  submitAssignment,
  updateSubmissionStatus,
  addAIFlag,
  analyzeTextForAI,
} from '../../utils/student-assignments';
import { parseISO, format, isPast } from 'date-fns';
import { cs } from 'date-fns/locale';
import { toast } from 'sonner';
import { RichTextEditor } from '../RichTextEditor';
import { useVersionHistory } from '../../hooks/useVersionHistory';
import { VersionHistoryPanel } from '../shared/VersionHistoryPanel';

interface StudentAssignmentEditorProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export function StudentAssignmentEditor({ theme, toggleTheme }: StudentAssignmentEditorProps) {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { student, loading: authLoading } = useStudentAuth();

  const [assignment, setAssignment] = useState<StudentAssignment | null>(null);
  const [submission, setSubmission] = useState<StudentSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInstructions, setShowInstructions] = useState(true);
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAIWarning, setShowAIWarning] = useState(false);
  const [currentAIAnalysis, setCurrentAIAnalysis] = useState<{
    isLikelyAI: boolean;
    confidence: number;
    reasons: string[];
  } | null>(null);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);

  // Version history hook
  const versionHistory = useVersionHistory({
    documentId: submission?.id || assignmentId || 'new',
    documentType: 'my_content',
    content: content,
    title: assignment?.title || 'Úkol',
    userId: student?.id,
    userType: 'student',
    userName: student?.name,
    autoSave: true,
    autoSaveDelay: 5000,
    readOnly: !submission,
    onVersionRestored: (version) => {
      setContent(version.content);
      toast.success(`Obnovena verze ${version.version_number}`);
    },
  });

  // Load assignment and submission
  useEffect(() => {
    async function loadData() {
      if (!assignmentId || !student?.id) {
        setLoading(false);
        return;
      }

      try {
        const [loadedAssignment, loadedSubmission] = await Promise.all([
          getAssignment(assignmentId),
          getSubmission(student.id, assignmentId),
        ]);

        setAssignment(loadedAssignment);

        if (loadedSubmission) {
          setSubmission(loadedSubmission);
          
          // For document type, redirect to the document editor
          if (loadedAssignment?.type === 'document') {
            // Ensure document exists in localStorage before navigating
            const docKey = `vivid-doc-${loadedSubmission.content_id}`;
            if (!localStorage.getItem(docKey)) {
              const docData = {
                id: loadedSubmission.content_id,
                title: loadedAssignment.title || 'Úkol',
                content: '',
                documentType: 'lesson',
                slug: loadedSubmission.content_id,
                featuredMedia: '',
                sectionImages: [],
                showTOC: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              localStorage.setItem(docKey, JSON.stringify(docData));
            }
            
            // Store assignment info for the editor
            localStorage.setItem('student_assignment_context', JSON.stringify({
              assignmentId: loadedAssignment.id,
              title: loadedAssignment.title,
              description: loadedAssignment.description,
              dueDate: loadedAssignment.due_date,
              allowAI: loadedAssignment.allow_ai,
              submissionId: loadedSubmission.id,
            }));
            // Navigate to document editor
            navigate(`/library/my-content/edit/${loadedSubmission.content_id}?studentAssignmentId=${assignmentId}&studentId=${student.id}`);
            return;
          }
          
          // Load saved content from localStorage
          const savedContent = localStorage.getItem(`assignment_content_${loadedSubmission.content_id}`);
          if (savedContent) {
            setContent(savedContent);
          }
        } else if (loadedAssignment) {
          // Start new submission
          const contentType = loadedAssignment.type === 'presentation' ? 'board' : 'document';
          const contentId = `student_assign_${assignmentId}_${Date.now()}`;
          const newSubmission = await startAssignment(
            student.id,
            assignmentId,
            contentType,
            contentId
          );
          setSubmission(newSubmission);
          
          // For document type, redirect to the document editor
          if (loadedAssignment.type === 'document') {
            // Create the document in localStorage first
            const docKey = `vivid-doc-${newSubmission.content_id}`;
            const docData = {
              id: newSubmission.content_id,
              title: loadedAssignment.title || 'Úkol',
              content: '',
              documentType: 'lesson',
              slug: newSubmission.content_id,
              featuredMedia: '',
              sectionImages: [],
              showTOC: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            localStorage.setItem(docKey, JSON.stringify(docData));
            
            // Store assignment info for the editor
            localStorage.setItem('student_assignment_context', JSON.stringify({
              assignmentId: loadedAssignment.id,
              title: loadedAssignment.title,
              description: loadedAssignment.description,
              dueDate: loadedAssignment.due_date,
              allowAI: loadedAssignment.allow_ai,
              submissionId: newSubmission.id,
            }));
            // Navigate to document editor
            navigate(`/library/my-content/edit/${newSubmission.content_id}?studentAssignmentId=${assignmentId}&studentId=${student.id}`);
            return;
          }
        }
      } catch (error) {
        console.error('Error loading assignment:', error);
        toast.error('Nepodařilo se načíst úkol');
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      loadData();
    }
  }, [assignmentId, student?.id, authLoading]);

  // Handle paste event for AI detection
  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!assignment || assignment.allow_ai || !submission) return;

    const pastedText = e.clipboardData.getData('text');
    if (pastedText.length < 100) return; // Skip short pastes

    const analysis = analyzeTextForAI(pastedText);

    if (analysis.isLikelyAI) {
      setCurrentAIAnalysis(analysis);
      setShowAIWarning(true);

      // Add AI flag to submission
      await addAIFlag(submission.id, {
        type: 'paste',
        confidence: analysis.confidence,
        textSnippet: pastedText.substring(0, 100),
        details: analysis.reasons.join('; '),
      });
    }
  }, [assignment, submission]);

  // Save content
  const handleSave = useCallback(async () => {
    if (!submission) return;

    setIsSaving(true);
    try {
      localStorage.setItem(`assignment_content_${submission.content_id}`, content);
      await updateSubmissionStatus(submission.id, 'draft');
      toast.success('Uloženo');
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Nepodařilo se uložit');
    } finally {
      setIsSaving(false);
    }
  }, [submission, content]);

  // Submit assignment
  const handleSubmit = useCallback(async () => {
    if (!submission) return;

    setIsSubmitting(true);
    try {
      localStorage.setItem(`assignment_content_${submission.content_id}`, content);
      await submitAssignment(submission.id);
      
      toast.success('Úkol odevzdán!', {
        description: 'Učitel bude informován o vašem odevzdání.',
      });
      
      navigate('/student/workspace');
    } catch (error) {
      console.error('Error submitting:', error);
      toast.error('Nepodařilo se odevzdat');
    } finally {
      setIsSubmitting(false);
    }
  }, [submission, content, navigate]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!submission || !content) return;

    const interval = setInterval(() => {
      localStorage.setItem(`assignment_content_${submission.content_id}`, content);
    }, 30000);

    return () => clearInterval(interval);
  }, [submission, content]);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !student) {
      navigate('/student/login');
    }
  }, [authLoading, student, navigate]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 mx-auto text-amber-500 mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-2">
            Úkol nenalezen
          </h2>
          <Link
            to="/student/workspace"
            className="text-indigo-600 hover:text-indigo-700"
          >
            Zpět do pracovního prostoru
          </Link>
        </div>
      </div>
    );
  }

  const isOverdue = assignment.due_date && isPast(parseISO(assignment.due_date));

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-slate-900' : 'bg-slate-50'}`}>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="h-full px-4 flex items-center justify-between">
          {/* Left side */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/student/workspace')}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              {/* Type icon */}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                assignment.type === 'document'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : assignment.type === 'presentation'
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
              }`}>
                {assignment.type === 'document' && <FileText className="w-4 h-4" />}
                {assignment.type === 'presentation' && <Presentation className="w-4 h-4" />}
                {assignment.type === 'test' && <ClipboardCheck className="w-4 h-4" />}
              </div>

              <div>
                <h1 className="font-semibold text-slate-800 dark:text-white text-sm">
                  {assignment.title}
                </h1>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>{ASSIGNMENT_TYPE_LABELS[assignment.type]}</span>
                  {assignment.due_date && (
                    <>
                      <span>•</span>
                      <span className={isOverdue ? 'text-red-500' : ''}>
                        {isOverdue ? 'Po termínu' : `Do ${format(parseISO(assignment.due_date), 'd. M.', { locale: cs })}`}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* AI indicator */}
            {!assignment.allow_ai && (
              <div className="flex items-center gap-1 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-medium">
                <BotOff className="w-3.5 h-3.5" />
                Bez AI
              </div>
            )}

            {/* Version History Button */}
            <button
              onClick={() => setVersionHistoryOpen(true)}
              className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors text-sm font-medium ${
                versionHistory.hasUnsavedChanges 
                  ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-400' 
                  : 'border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
              title="Historie verzí"
            >
              <History className="w-4 h-4" />
              Historie
              {versionHistory.autoSavePending && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              )}
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium transition-colors"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Uložit
            </button>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !content.trim()}
              className="flex items-center gap-2 px-4 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white font-medium rounded-lg text-sm transition-colors"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Odevzdat
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="pt-14 flex h-[calc(100vh-3.5rem)]">
        {/* Instructions panel */}
        <div className={`
          ${showInstructions ? 'w-80' : 'w-12'}
          shrink-0 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700
          transition-all duration-200 overflow-hidden
        `}>
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="w-full p-3 flex items-center justify-between text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <span className={`font-medium ${!showInstructions ? 'hidden' : ''}`}>
              Zadání
            </span>
            {showInstructions ? (
              <ChevronDown className="w-5 h-5 rotate-90" />
            ) : (
              <Info className="w-5 h-5" />
            )}
          </button>

          {showInstructions && (
            <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-8rem)]">
              {/* Assignment details */}
              <div className="space-y-3">
                <h2 className="font-semibold text-slate-800 dark:text-white">
                  {assignment.title}
                </h2>

                {/* Due date */}
                {assignment.due_date && (
                  <div className={`flex items-center gap-2 text-sm ${
                    isOverdue ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    <Calendar className="w-4 h-4" />
                    <span>
                      {isOverdue ? 'Po termínu: ' : 'Odevzdat do: '}
                      {format(parseISO(assignment.due_date), 'd. MMMM yyyy', { locale: cs })}
                    </span>
                  </div>
                )}

                {/* AI status */}
                <div className={`flex items-center gap-2 text-sm ${
                  assignment.allow_ai
                    ? 'text-purple-600 dark:text-purple-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}>
                  {assignment.allow_ai ? (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>AI pomocník je povolen</span>
                    </>
                  ) : (
                    <>
                      <BotOff className="w-4 h-4" />
                      <span>AI pomocník není povolen</span>
                    </>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                  Instrukce
                </h3>
                <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                  {assignment.description}
                </p>
              </div>

              {/* AI warning reminder */}
              {!assignment.allow_ai && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      U tohoto úkolu není povoleno použití AI. Systém automaticky detekuje podezřelý text a učitel bude informován.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Editor area */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            {/* Rich text editor for document type */}
            {assignment.type === 'document' && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <RichTextEditor
                  content={content}
                  onChange={(newContent) => {
                    setContent(newContent);
                    // AI detection on content change for pasted text
                    if (!assignment.allow_ai && submission) {
                      // Extract plain text from HTML for analysis
                      const tempDiv = document.createElement('div');
                      tempDiv.innerHTML = newContent;
                      const plainText = tempDiv.textContent || '';
                      
                      // Only analyze if content significantly changed (possible paste)
                      const prevDiv = document.createElement('div');
                      prevDiv.innerHTML = content;
                      const prevText = prevDiv.textContent || '';
                      
                      if (plainText.length - prevText.length > 100) {
                        const addedText = plainText.substring(prevText.length);
                        const analysis = analyzeTextForAI(addedText);
                        
                        if (analysis.isLikelyAI) {
                          setCurrentAIAnalysis(analysis);
                          setShowAIWarning(true);
                          addAIFlag(submission.id, {
                            type: 'paste',
                            confidence: analysis.confidence,
                            textSnippet: addedText.substring(0, 100),
                            details: analysis.reasons.join('; '),
                          });
                        }
                      }
                    }
                  }}
                />
              </div>
            )}

            {/* Placeholder for presentation/test types */}
            {assignment.type !== 'document' && (
              <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                <Presentation className="w-16 h-16 mx-auto text-purple-500 mb-4" />
                <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-2">
                  Editor {ASSIGNMENT_TYPE_LABELS[assignment.type]}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mb-4">
                  Tato funkce bude brzy k dispozici
                </p>
                <button
                  onClick={() => navigate('/quiz/new')}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-colors"
                >
                  Otevřít Vividboard editor
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Warning Modal */}
      {showAIWarning && currentAIAnalysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>

              <h2 className="text-xl font-bold text-center text-slate-800 dark:text-white mb-2">
                Detekován podezřelý text
              </h2>

              <p className="text-center text-slate-600 dark:text-slate-300 mb-4">
                Vložený text vypadá jako vygenerovaný umělou inteligencí.
                U tohoto úkolu není použití AI povoleno.
              </p>

              <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-xl mb-4">
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                  Důvody podezření:
                </div>
                <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                  {currentAIAnalysis.reasons.map((reason, i) => (
                    <li key={i}>• {reason}</li>
                  ))}
                </ul>
              </div>

              <p className="text-xs text-center text-slate-500 dark:text-slate-400 mb-4">
                Učitel bude informován o tomto podezření.
                Text můžete ponechat, ale doporučujeme ho přeformulovat vlastními slovy.
              </p>

              <button
                onClick={() => {
                  setShowAIWarning(false);
                  setCurrentAIAnalysis(null);
                }}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors"
              >
                Rozumím
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentAssignmentEditor;

