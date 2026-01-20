/**
 * Graded Work Card
 * 
 * Displays a graded submission on the student's wall.
 * Shows percentage, teacher comment, and allows viewing the document with comments.
 */

import React, { useState } from 'react';
import { 
  FileText, 
  MessageSquare, 
  ExternalLink, 
  Star,
  Calendar,
  User,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { StudentSubmission, InlineComment } from '../../types/student-submission';

interface GradedWorkCardProps {
  submission: StudentSubmission;
  onViewDocument: (submissionId: string) => void;
}

// Get color based on percentage
function getGradeColor(percentage: number): string {
  if (percentage >= 90) return 'from-green-400 to-emerald-500';
  if (percentage >= 75) return 'from-blue-400 to-indigo-500';
  if (percentage >= 60) return 'from-amber-400 to-orange-500';
  if (percentage >= 40) return 'from-orange-400 to-red-400';
  return 'from-red-400 to-red-600';
}

function getGradeEmoji(percentage: number): string {
  if (percentage >= 90) return '🌟';
  if (percentage >= 75) return '✨';
  if (percentage >= 60) return '👍';
  if (percentage >= 40) return '📝';
  return '⚠️';
}

function getGradeLabel(percentage: number): string {
  if (percentage >= 90) return 'Výborně!';
  if (percentage >= 75) return 'Velmi dobře';
  if (percentage >= 60) return 'Dobře';
  if (percentage >= 40) return 'Dostačující';
  return 'Je třeba zlepšit';
}

export function GradedWorkCard({ submission, onViewDocument }: GradedWorkCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!submission.grade) return null;

  const { grade, inlineComments } = submission;
  const percentage = grade.percentage;
  const hasComments = inlineComments.length > 0;
  const unreadComments = inlineComments.filter(c => !c.isRead).length;

  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
      {/* Header with grade */}
      <div className={`bg-gradient-to-r ${getGradeColor(percentage)} p-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <span className="text-3xl">{getGradeEmoji(percentage)}</span>
            </div>
            <div className="text-white">
              <p className="text-4xl font-bold">{percentage}%</p>
              <p className="text-sm opacity-90">{getGradeLabel(percentage)}</p>
            </div>
          </div>
          <div className="text-right text-white/80">
            <p className="text-sm">
              <Calendar className="h-4 w-4 inline mr-1" />
              {new Date(grade.gradedAt).toLocaleDateString('cs-CZ')}
            </p>
            <p className="text-xs mt-1">
              <User className="h-3 w-3 inline mr-1" />
              {grade.gradedByName}
            </p>
          </div>
        </div>
      </div>

      {/* Assignment info */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-slate-100 rounded-lg shrink-0">
            <FileText className="h-5 w-5 text-slate-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-800 truncate">
              {submission.assignmentTitle}
            </h3>
            <p className="text-sm text-slate-500">
              {submission.className} • {submission.assignmentType === 'worksheet' ? 'Pracovní list' : 
                submission.assignmentType === 'board' ? 'Board' : 'Dokument'}
            </p>
          </div>
          
          {/* Comments badge */}
          {hasComments && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${
              unreadComments > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
            }`}>
              <MessageSquare className="h-4 w-4" />
              <span className="text-sm font-medium">{inlineComments.length}</span>
              {unreadComments > 0 && (
                <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full">
                  {unreadComments} nové
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Teacher's final comment */}
      {grade.finalComment && (
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
              <User className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1">
                Komentář od {grade.gradedByName}:
              </p>
              <p className="text-slate-600">{grade.finalComment}</p>
            </div>
          </div>
        </div>
      )}

      {/* Inline comments preview (expandable) */}
      {hasComments && (
        <div className="border-b border-slate-100">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-slate-700">
                {inlineComments.length} komentářů v textu
              </span>
            </div>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>
          
          {isExpanded && (
            <div className="px-4 pb-4 space-y-2">
              {inlineComments.slice(0, 3).map((comment) => (
                <div 
                  key={comment.id}
                  className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm"
                >
                  <p className="text-amber-800 italic mb-1">
                    "{comment.selection.selectedText}"
                  </p>
                  <p className="text-slate-700">{comment.content}</p>
                </div>
              ))}
              {inlineComments.length > 3 && (
                <p className="text-sm text-slate-500 text-center">
                  +{inlineComments.length - 3} dalších komentářů
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* View document button */}
      <div className="p-4">
        <button
          onClick={() => onViewDocument(submission.id)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
        >
          <ExternalLink className="h-4 w-4" />
          <span>Zobrazit dokument s komentáři</span>
        </button>
      </div>

      {/* AI Warning (if applicable) */}
      {submission.aiSuspicionLevel !== 'none' && (
        <div className={`px-4 py-2 flex items-center justify-center gap-2 text-xs ${
          submission.aiSuspicionLevel === 'high'
            ? 'bg-red-50 text-red-600'
            : 'bg-amber-50 text-amber-600'
        }`}>
          <AlertTriangle className="h-3 w-3" />
          <span>
            Učitel zaznamenal podezření na kopírování ({submission.pasteEvents.length}x vložení textu)
          </span>
        </div>
      )}
    </div>
  );
}

export default GradedWorkCard;


















