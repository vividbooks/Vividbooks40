/**
 * AssignmentReview Component
 * 
 * Shows submitted assignments for a class with AI detection flags.
 * Teachers can review, grade, and see AI warnings.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Presentation,
  ClipboardCheck,
  CheckCircle,
  AlertTriangle,
  Star,
  MessageSquare,
  Calendar,
  User,
  Eye,
  ChevronRight,
  Loader2,
  Bot,
  Clock,
  Send,
} from 'lucide-react';
import {
  StudentAssignment,
  StudentSubmission,
  ASSIGNMENT_TYPE_LABELS,
  SUBMISSION_STATUS_LABELS,
  SUBMISSION_STATUS_COLORS,
  AIDetectionFlag,
} from '../../types/student-assignment';
import { 
  getAssignmentsForClass,
} from '../../utils/student-assignments';
import { parseISO, format, formatDistanceToNow } from 'date-fns';
import { cs } from 'date-fns/locale';
import { toast } from 'sonner';

interface AssignmentReviewProps {
  classId: string;
  className: string;
  onClose: () => void;
}

// Mock submission data for demo (in real app, fetch from Supabase)
interface SubmissionWithStudent extends StudentSubmission {
  studentName: string;
  studentInitials: string;
  studentColor: string;
}

export function AssignmentReview({ classId, className, onClose }: AssignmentReviewProps) {
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<StudentAssignment | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionWithStudent | null>(null);

  // Load assignments
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const loadedAssignments = await getAssignmentsForClass(classId);
        setAssignments(loadedAssignments);
      } catch (error) {
        console.error('Error loading assignments:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [classId]);

  // Load submissions when assignment selected
  useEffect(() => {
    if (!selectedAssignment) {
      setSubmissions([]);
      return;
    }

    // In real app, fetch from Supabase joining with students table
    // For now, get from localStorage
    try {
      const allSubmissions = JSON.parse(localStorage.getItem('vivid-student-submissions') || '[]');
      const assignmentSubmissions = allSubmissions.filter(
        (s: StudentSubmission) => s.assignment_id === selectedAssignment.id
      );

      // Mock student data
      const colors = ['#EC4899', '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B'];
      const names = ['Jan Novák', 'Marie Svobodová', 'Petr Dvořák', 'Anna Horáková', 'Tomáš Černý'];
      
      const withStudents: SubmissionWithStudent[] = assignmentSubmissions.map((s: StudentSubmission, i: number) => ({
        ...s,
        studentName: names[i % names.length],
        studentInitials: names[i % names.length].split(' ').map(n => n[0]).join(''),
        studentColor: colors[i % colors.length],
      }));

      setSubmissions(withStudents);
    } catch (error) {
      console.error('Error loading submissions:', error);
    }
  }, [selectedAssignment]);

  const getAIFlagSeverity = (flags: AIDetectionFlag[]): 'none' | 'low' | 'medium' | 'high' => {
    if (!flags || flags.length === 0) return 'none';
    const maxConfidence = Math.max(...flags.map(f => f.confidence));
    if (maxConfidence >= 0.7) return 'high';
    if (maxConfidence >= 0.4) return 'medium';
    return 'low';
  };

  const getAIFlagColor = (severity: 'none' | 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'high': return { bg: '#FEE2E2', text: '#DC2626', icon: '#EF4444' };
      case 'medium': return { bg: '#FEF3C7', text: '#D97706', icon: '#F59E0B' };
      case 'low': return { bg: '#FEF9C3', text: '#CA8A04', icon: '#EAB308' };
      default: return { bg: '#F3F4F6', text: '#6B7280', icon: '#9CA3AF' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
              Odevzdané úkoly
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Třída: {className}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left: Assignment list */}
          <div className="w-1/3 border-r border-slate-200 dark:border-slate-700 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">
                Zadané úkoly ({assignments.length})
              </h3>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : assignments.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">
                  Žádné zadané úkoly
                </p>
              ) : (
                <div className="space-y-2">
                  {assignments.map(assignment => (
                    <button
                      key={assignment.id}
                      onClick={() => setSelectedAssignment(assignment)}
                      className={`w-full p-3 rounded-xl text-left transition-colors ${
                        selectedAssignment?.id === assignment.id
                          ? 'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700'
                          : 'bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700'
                      } border border-transparent`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {assignment.type === 'document' && <FileText className="w-4 h-4 text-blue-500" />}
                        {assignment.type === 'presentation' && <Presentation className="w-4 h-4 text-purple-500" />}
                        {assignment.type === 'test' && <ClipboardCheck className="w-4 h-4 text-green-500" />}
                        <span className="font-medium text-slate-800 dark:text-white text-sm truncate">
                          {assignment.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{ASSIGNMENT_TYPE_LABELS[assignment.type]}</span>
                        {assignment.due_date && (
                          <>
                            <span>•</span>
                            <span>{format(parseISO(assignment.due_date), 'd. M.', { locale: cs })}</span>
                          </>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Submissions */}
          <div className="flex-1 overflow-y-auto">
            {!selectedAssignment ? (
              <div className="flex items-center justify-center h-full text-slate-400">
                <div className="text-center">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Vyberte úkol pro zobrazení odevzdaných prací</p>
                </div>
              </div>
            ) : (
              <div className="p-4">
                {/* Assignment header */}
                <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                  <h3 className="font-semibold text-slate-800 dark:text-white mb-1">
                    {selectedAssignment.title}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                    {selectedAssignment.description}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>{ASSIGNMENT_TYPE_LABELS[selectedAssignment.type]}</span>
                    {!selectedAssignment.allow_ai && (
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <Bot className="w-3 h-3" />
                        AI zakázáno
                      </span>
                    )}
                  </div>
                </div>

                {/* Submissions list */}
                <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">
                  Odevzdané práce ({submissions.length})
                </h4>

                {submissions.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>Zatím nikdo neodevzdal</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {submissions.map(submission => {
                      const severity = getAIFlagSeverity(submission.ai_flags);
                      const flagColor = getAIFlagColor(severity);
                      const statusColors = SUBMISSION_STATUS_COLORS[submission.status];

                      return (
                        <div
                          key={submission.id}
                          className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700"
                        >
                          <div className="flex items-center gap-3">
                            {/* Student avatar */}
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                              style={{ backgroundColor: submission.studentColor }}
                            >
                              {submission.studentInitials}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-800 dark:text-white">
                                  {submission.studentName}
                                </span>
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
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {submission.submitted_at
                                  ? `Odevzdáno ${formatDistanceToNow(parseISO(submission.submitted_at), { addSuffix: true, locale: cs })}`
                                  : 'Rozpracováno'
                                }
                              </div>
                            </div>

                            {/* AI Warning */}
                            {severity !== 'none' && (
                              <div
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                                style={{ backgroundColor: flagColor.bg }}
                              >
                                <AlertTriangle 
                                  className="w-4 h-4" 
                                  style={{ color: flagColor.icon }}
                                />
                                <span 
                                  className="text-xs font-medium"
                                  style={{ color: flagColor.text }}
                                >
                                  {submission.ai_flags.length}× AI podezření
                                </span>
                              </div>
                            )}

                            {/* Actions */}
                            <button
                              onClick={() => setSelectedSubmission(submission)}
                              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                          </div>

                          {/* AI Flags detail */}
                          {severity !== 'none' && (
                            <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                              <div className="text-xs font-medium text-slate-500 mb-2">
                                Detekovaná podezření:
                              </div>
                              {submission.ai_flags.map((flag, i) => (
                                <div key={flag.id || i} className="text-xs text-slate-600 dark:text-slate-300 mb-1">
                                  • {flag.details || `Vložený text (${Math.round(flag.confidence * 100)}% jistota)`}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Submission detail modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: selectedSubmission.studentColor }}
                >
                  {selectedSubmission.studentInitials}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-white">
                    {selectedSubmission.studentName}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {selectedAssignment?.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Content preview */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-slate-500 mb-2">Obsah práce</h4>
                <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-xl">
                  <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                    {localStorage.getItem(`assignment_content_${selectedSubmission.content_id}`) || 'Obsah není k dispozici'}
                  </p>
                </div>
              </div>

              {/* AI Flags */}
              {selectedSubmission.ai_flags.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-amber-600 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    AI podezření ({selectedSubmission.ai_flags.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedSubmission.ai_flags.map((flag, i) => (
                      <div 
                        key={flag.id || i}
                        className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                            {flag.type === 'paste' ? 'Vložený text' : 'Detekováno'}
                          </span>
                          <span className="text-xs text-amber-600">
                            {Math.round(flag.confidence * 100)}% jistota
                          </span>
                        </div>
                        <p className="text-sm text-amber-800 dark:text-amber-200 mb-1">
                          "{flag.textSnippet}..."
                        </p>
                        {flag.details && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            {flag.details}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Grading form */}
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-2">Hodnocení</h4>
                <div className="flex gap-4 mb-3">
                  <div className="flex-1">
                    <label className="text-xs text-slate-400 mb-1 block">Body</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="0"
                        className="w-20 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white"
                      />
                      <span className="text-slate-500">/</span>
                      <input
                        type="number"
                        placeholder="100"
                        className="w-20 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
                <label className="text-xs text-slate-400 mb-1 block">Komentář</label>
                <textarea
                  placeholder="Napište zpětnou vazbu..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setSelectedSubmission(null)}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Zavřít
              </button>
              <button
                onClick={() => {
                  toast.success('Hodnocení uloženo');
                  setSelectedSubmission(null);
                }}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Uložit hodnocení
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AssignmentReview;


