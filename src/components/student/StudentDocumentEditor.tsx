/**
 * Student Document Editor
 * 
 * A wrapper around the worksheet editor for students completing assignments.
 * Features:
 * - "Zadání" button showing assignment description
 * - "Odevzdat úkol" button for submission
 * - Paste detection for AI suspicion
 * - Conditional AI assistant (based on teacher settings)
 * - Simplified UI (no lesson label, no column settings)
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  FileText, 
  Send, 
  ChevronDown, 
  ChevronUp,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Undo,
  Redo,
  History
} from 'lucide-react';
import { toast } from 'sonner';
import { PasteWarningDialog, usePasteDetection } from './PasteWarningDialog';
import { 
  StudentSubmission, 
  PasteEvent, 
  calculateAiSuspicion,
  SubmissionStatus 
} from '../../types/student-submission';

interface StudentDocumentEditorProps {
  /** The submission data */
  submission: StudentSubmission;
  /** Update submission */
  onUpdateSubmission: (updates: Partial<StudentSubmission>) => void;
  /** Submit the work */
  onSubmit: () => void;
  /** Go back */
  onBack: () => void;
  /** Children - the actual editor content */
  children: React.ReactNode;
  /** Save status */
  saveStatus?: 'saved' | 'saving' | 'unsaved';
  /** Undo callback */
  onUndo?: () => void;
  /** Redo callback */
  onRedo?: () => void;
  /** Show version history */
  onShowHistory?: () => void;
}

export function StudentDocumentEditor({
  submission,
  onUpdateSubmission,
  onSubmit,
  onBack,
  children,
  saveStatus = 'saved',
  onUndo,
  onRedo,
  onShowHistory,
}: StudentDocumentEditorProps) {
  const [isAssignmentOpen, setIsAssignmentOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Paste detection
  const handlePasteRecorded = useCallback((event: PasteEvent) => {
    const newPasteEvents = [...submission.pasteEvents, event];
    onUpdateSubmission({
      pasteEvents: newPasteEvents,
      aiSuspicionLevel: calculateAiSuspicion(newPasteEvents),
    });
  }, [submission.pasteEvents, onUpdateSubmission]);

  const {
    showWarning,
    pastedText,
    wordCount,
    handleConfirm,
    handleCancel,
  } = usePasteDetection({
    minWords: 3,
    onPasteRecorded: handlePasteRecorded,
    enabled: true,
  });

  // Mark as started when component mounts
  useEffect(() => {
    if (submission.status === 'not_started') {
      onUpdateSubmission({
        status: 'writing',
        startedAt: new Date().toISOString(),
      });
    }
  }, []);

  // Update last edited time periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (submission.status === 'writing') {
        onUpdateSubmission({
          lastEditedAt: new Date().toISOString(),
        });
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [submission.status, onUpdateSubmission]);

  // Handle submit
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit();
      toast.success('Úkol byl odevzdán!', {
        description: 'Učitel bude informován o odevzdání.'
      });
    } catch (error) {
      toast.error('Chyba při odevzdávání', {
        description: 'Zkuste to prosím znovu.'
      });
    } finally {
      setIsSubmitting(false);
      setShowSubmitConfirm(false);
    }
  };

  const { settings } = submission;
  const hasAssignment = settings.hasAssignment && settings.assignmentDescription;
  const isSubmitted = submission.status === 'submitted' || submission.status === 'graded';

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      {/* Top Bar */}
      <header 
        style={{
          height: '56px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          flexShrink: 0,
          position: 'relative',
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Back Button */}
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            title="Zpět"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>

          {/* Assignment Button (if has assignment) */}
          {hasAssignment && (
            <button
              onClick={() => setIsAssignmentOpen(!isAssignmentOpen)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                isAssignmentOpen 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span className="font-medium">Zadání</span>
              {isAssignmentOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          )}

          {/* Title */}
          <h1 className="text-lg font-semibold text-slate-800 truncate max-w-[300px]">
            {submission.assignmentTitle}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* AI Assistant Button (if enabled) */}
          {settings.aiAssistantEnabled && !isSubmitted && (
            <button
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">AI Asistent</span>
            </button>
          )}

          {/* Due Date (if set) */}
          {settings.dueDate && (
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              <Clock className="h-4 w-4" />
              <span>Do: {new Date(settings.dueDate).toLocaleDateString('cs-CZ')}</span>
            </div>
          )}

          {/* Divider */}
          <div className="w-px h-6 bg-slate-200 mx-1" />

          {/* Version History Button */}
          {onShowHistory && (
            <button
              onClick={onShowHistory}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors text-slate-600"
              title="Historie verzí"
            >
              <History className="h-4 w-4" />
            </button>
          )}

          {/* Save Status */}
          <div className="text-sm text-slate-400 font-medium px-2">
            {saveStatus === 'saving' ? 'Ukládání...' : saveStatus === 'unsaved' ? 'Neuloženo' : 'Uloženo'}
          </div>

          {/* Undo/Redo */}
          <div className="flex items-center gap-1">
            <button
              onClick={onUndo}
              disabled={!onUndo}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors text-slate-600 disabled:opacity-50"
              title="Zpět (Ctrl+Z)"
            >
              <Undo className="h-4 w-4" />
            </button>
            <button
              onClick={onRedo}
              disabled={!onRedo}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors text-slate-600 disabled:opacity-50"
              title="Vpřed (Ctrl+Y)"
            >
              <Redo className="h-4 w-4" />
            </button>
          </div>

          {/* Divider before submit */}
          <div className="w-px h-6 bg-slate-200 mx-1" />

          {/* Submit Button */}
          {!isSubmitted ? (
            <button
              onClick={() => setShowSubmitConfirm(true)}
              disabled={isSubmitting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: '#16a34a',
                color: '#ffffff',
                borderRadius: '8px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                opacity: isSubmitting ? 0.5 : 1,
              }}
            >
              <Send style={{ width: '16px', height: '16px', color: '#ffffff' }} />
              <span>Odevzdat úkol</span>
            </button>
          ) : (
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: '#dcfce7',
                color: '#15803d',
                borderRadius: '8px',
                fontWeight: 500,
              }}
            >
              <CheckCircle2 style={{ width: '16px', height: '16px' }} />
              <span>Odevzdáno</span>
            </div>
          )}
        </div>
      </header>

      {/* Assignment Panel (collapsible) */}
      {hasAssignment && isAssignmentOpen && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-4 animate-in slide-in-from-top duration-200">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">Zadání úkolu</h3>
                <p className="text-blue-800 whitespace-pre-wrap">
                  {settings.assignmentDescription}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Suspicion Warning (for student awareness) */}
      {submission.aiSuspicionLevel !== 'none' && (
        <div className={`px-4 py-2 flex items-center justify-center gap-2 text-sm ${
          submission.aiSuspicionLevel === 'high' 
            ? 'bg-red-100 text-red-700' 
            : submission.aiSuspicionLevel === 'medium'
            ? 'bg-amber-100 text-amber-700'
            : 'bg-yellow-50 text-yellow-700'
        }`}>
          <AlertTriangle className="h-4 w-4" />
          <span>
            {submission.aiSuspicionLevel === 'high' 
              ? 'Vysoké podezření na kopírování - učitel bude informován'
              : submission.aiSuspicionLevel === 'medium'
              ? 'Střední podezření na kopírování textu'
              : 'Zaznamenáno vložení textu bez uvedení zdroje'}
          </span>
        </div>
      )}

      {/* Editor Content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>

      {/* Paste Warning Dialog */}
      {showWarning && (
        <PasteWarningDialog
          pastedText={pastedText}
          wordCount={wordCount}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      {/* Submit Confirmation Dialog */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center mb-6">
              <div className="inline-flex p-3 bg-green-100 rounded-full mb-4">
                <Send className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">
                Odevzdat úkol?
              </h2>
              <p className="text-slate-600">
                Po odevzdání už nebudete moci dokument upravovat. 
                Učitel uvidí vaši práci a může ji ohodnotit.
              </p>
            </div>

            {/* Paste events summary */}
            {submission.pasteEvents.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-amber-700">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  Zaznamenáno {submission.pasteEvents.length}x vložení textu
                  {submission.pasteEvents.filter(e => e.dismissedWithoutSource).length > 0 && (
                    <span className="font-medium">
                      {' '}({submission.pasteEvents.filter(e => e.dismissedWithoutSource).length}x bez uvedení zdroje)
                    </span>
                  )}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
              >
                Ještě pracuji
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Odevzdávám...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Ano, odevzdat</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentDocumentEditor;

