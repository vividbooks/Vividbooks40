/**
 * Teacher Grading Panel
 * 
 * Overlay/sidebar for teachers to grade student submissions.
 * Features:
 * - View student's document
 * - Add inline comments (Google Docs style)
 * - Set percentage grade
 * - Add final comment
 * - View AI suspicion alerts
 */

import React, { useState } from 'react';
import { 
  X, 
  MessageSquare, 
  Star, 
  Send, 
  AlertTriangle,
  CheckCircle2,
  User,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  StudentSubmission, 
  InlineComment,
  SubmissionGrade,
  getStatusLabel 
} from '../../types/student-submission';

interface TeacherGradingPanelProps {
  /** The submission being graded */
  submission: StudentSubmission;
  /** Current inline comments */
  comments: InlineComment[];
  /** Add a new comment */
  onAddComment: (comment: Omit<InlineComment, 'id' | 'createdAt' | 'isRead'>) => void;
  /** Delete a comment */
  onDeleteComment: (commentId: string) => void;
  /** Submit the grade */
  onSubmitGrade: (grade: SubmissionGrade) => void;
  /** Close the panel */
  onClose: () => void;
  /** Current teacher info */
  teacherId: string;
  teacherName: string;
}

// Grade presets for quick selection
const GRADE_PRESETS = [
  { percentage: 100, label: 'Výborně', color: 'bg-green-500', emoji: '🌟' },
  { percentage: 90, label: 'Velmi dobře', color: 'bg-green-400', emoji: '✨' },
  { percentage: 75, label: 'Dobře', color: 'bg-blue-500', emoji: '👍' },
  { percentage: 60, label: 'Dostačující', color: 'bg-amber-500', emoji: '📝' },
  { percentage: 40, label: 'Nedostačující', color: 'bg-orange-500', emoji: '⚠️' },
  { percentage: 20, label: 'Nesplněno', color: 'bg-red-500', emoji: '❌' },
];

export function TeacherGradingPanel({
  submission,
  comments,
  onAddComment,
  onDeleteComment,
  onSubmitGrade,
  onClose,
  teacherId,
  teacherName,
}: TeacherGradingPanelProps) {
  const [percentage, setPercentage] = useState<number>(75);
  const [finalComment, setFinalComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPasteEvents, setShowPasteEvents] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const grade: SubmissionGrade = {
        percentage,
        finalComment: finalComment.trim(),
        gradedAt: new Date().toISOString(),
        gradedBy: teacherId,
        gradedByName: teacherName,
      };
      await onSubmitGrade(grade);
      toast.success('Hodnocení bylo odesláno!', {
        description: `${submission.studentName} obdrží notifikaci.`
      });
      onClose();
    } catch (error) {
      toast.error('Chyba při odesílání hodnocení');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPreset = GRADE_PRESETS.find(p => p.percentage === percentage);
  const hasPasteEvents = submission.pasteEvents.length > 0;
  const suspiciousEvents = submission.pasteEvents.filter(e => e.dismissedWithoutSource);

  return (
    <div className="w-[380px] h-full bg-white border-l border-slate-200 flex flex-col shadow-xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Star className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800">Hodnocení</h2>
            <p className="text-sm text-slate-500">{submission.studentName}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X className="h-5 w-5 text-slate-500" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Student Info */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-medium">
              {submission.studentName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-slate-800">{submission.studentName}</p>
              <p className="text-sm text-slate-500">{submission.className}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>
                Odevzdáno: {submission.submittedAt 
                  ? new Date(submission.submittedAt).toLocaleString('cs-CZ')
                  : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* AI Suspicion Alert */}
        {hasPasteEvents && (
          <div className="p-4 border-b border-slate-100">
            <button
              onClick={() => setShowPasteEvents(!showPasteEvents)}
              className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                submission.aiSuspicionLevel === 'high'
                  ? 'bg-red-50 hover:bg-red-100'
                  : submission.aiSuspicionLevel === 'medium'
                  ? 'bg-amber-50 hover:bg-amber-100'
                  : 'bg-yellow-50 hover:bg-yellow-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className={`h-5 w-5 ${
                  submission.aiSuspicionLevel === 'high'
                    ? 'text-red-600'
                    : submission.aiSuspicionLevel === 'medium'
                    ? 'text-amber-600'
                    : 'text-yellow-600'
                }`} />
                <div className="text-left">
                  <p className={`font-medium ${
                    submission.aiSuspicionLevel === 'high'
                      ? 'text-red-700'
                      : submission.aiSuspicionLevel === 'medium'
                      ? 'text-amber-700'
                      : 'text-yellow-700'
                  }`}>
                    {submission.aiSuspicionLevel === 'high'
                      ? 'Vysoké podezření na AI/kopírování'
                      : submission.aiSuspicionLevel === 'medium'
                      ? 'Střední podezření'
                      : 'Nízké podezření'}
                  </p>
                  <p className="text-sm text-slate-600">
                    {submission.pasteEvents.length}x vložení textu
                    {suspiciousEvents.length > 0 && ` (${suspiciousEvents.length}x bez zdroje)`}
                  </p>
                </div>
              </div>
              {showPasteEvents ? (
                <ChevronUp className="h-5 w-5 text-slate-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-slate-400" />
              )}
            </button>

            {showPasteEvents && (
              <div className="mt-3 space-y-2">
                {submission.pasteEvents.map((event, idx) => (
                  <div 
                    key={event.id}
                    className={`p-3 rounded-lg text-sm ${
                      event.dismissedWithoutSource
                        ? 'bg-red-50 border border-red-200'
                        : 'bg-slate-50 border border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-slate-700">
                        {event.wordCount} slov
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(event.timestamp).toLocaleTimeString('cs-CZ')}
                      </span>
                    </div>
                    <p className="text-slate-600 italic text-xs mb-1">
                      "{event.textPreview}..."
                    </p>
                    {event.sourceUrl ? (
                      <a 
                        href={event.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Zdroj: {event.sourceUrl}
                      </a>
                    ) : (
                      <span className="text-xs text-red-600 font-medium">
                        ⚠️ Bez uvedení zdroje
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Inline Comments */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="h-5 w-5 text-slate-600" />
            <h3 className="font-medium text-slate-800">Komentáře v textu</h3>
            <span className="text-sm text-slate-500">({comments.length})</span>
          </div>
          
          {comments.length > 0 ? (
            <div className="space-y-2">
              {comments.map((comment) => (
                <div 
                  key={comment.id}
                  className="p-3 bg-amber-50 border border-amber-200 rounded-lg"
                >
                  <p className="text-sm text-amber-800 italic mb-1">
                    "{comment.selection.selectedText}"
                  </p>
                  <p className="text-sm text-slate-700">{comment.content}</p>
                  <button
                    onClick={() => onDeleteComment(comment.id)}
                    className="text-xs text-red-600 hover:underline mt-1"
                  >
                    Smazat
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">
              Označte text v dokumentu pro přidání komentáře
            </p>
          )}
        </div>

        {/* Percentage Grade */}
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-medium text-slate-800 mb-3">Hodnocení v procentech</h3>
          
          {/* Grade presets */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {GRADE_PRESETS.map((preset) => (
              <button
                key={preset.percentage}
                onClick={() => setPercentage(preset.percentage)}
                className={`p-2 rounded-lg border-2 transition-all text-center ${
                  percentage === preset.percentage
                    ? `${preset.color} border-transparent text-white shadow-md scale-105`
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="text-lg">{preset.emoji}</span>
                <p className="text-xs font-medium mt-1">{preset.label}</p>
                <p className="text-xs opacity-75">{preset.percentage}%</p>
              </button>
            ))}
          </div>

          {/* Custom slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Vlastní hodnota:</span>
              <span className="text-2xl font-bold text-slate-800">{percentage}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={percentage}
              onChange={(e) => setPercentage(parseInt(e.target.value))}
              className="w-full h-3 bg-gradient-to-r from-red-400 via-amber-400 to-green-400 rounded-lg appearance-none cursor-pointer accent-slate-800"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Final Comment */}
        <div className="p-4">
          <h3 className="font-medium text-slate-800 mb-3">Závěrečný komentář</h3>
          <textarea
            value={finalComment}
            onChange={(e) => setFinalComment(e.target.value)}
            placeholder="Napište zpětnou vazbu pro žáka..."
            rows={4}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
          />
        </div>
      </div>

      {/* Footer - Submit Button */}
      <div className="p-4 border-t border-slate-200 bg-slate-50">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all font-medium shadow-lg disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Odesílám...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5" />
              <span>Oznámkovat ({percentage}%)</span>
            </>
          )}
        </button>
        <p className="text-xs text-slate-500 text-center mt-2">
          Žák uvidí hodnocení na své nástěnce
        </p>
      </div>
    </div>
  );
}

export default TeacherGradingPanel;












