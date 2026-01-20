/**
 * GradedAssignmentCard - Displays a graded assignment on the student wall
 * 
 * Shows score, teacher comment, and allows viewing the document
 */

import React from 'react';
import { Trophy, Star, Medal, Award, MessageSquare, FileText, Eye, Calendar } from 'lucide-react';
import { StudentAssignment, StudentSubmission } from '../../types/student-assignment';
import { format, parseISO } from 'date-fns';
import { cs } from 'date-fns/locale';

interface GradedAssignmentCardProps {
  assignment: StudentAssignment;
  submission: StudentSubmission;
  onViewDocument?: () => void;
}

export function GradedAssignmentCard({
  assignment,
  submission,
  onViewDocument,
}: GradedAssignmentCardProps) {
  const score = submission.score || 0;
  const maxScore = submission.max_score || 100;
  const percentage = Math.round((score / maxScore) * 100);

  // Get color based on score
  const getScoreStyle = (pct: number) => {
    if (pct >= 90) return { 
      gradient: 'from-emerald-400 to-teal-500',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      Icon: Trophy,
    };
    if (pct >= 75) return { 
      gradient: 'from-blue-400 to-indigo-500',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      Icon: Medal,
    };
    if (pct >= 50) return { 
      gradient: 'from-amber-400 to-orange-500',
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      Icon: Award,
    };
    return { 
      gradient: 'from-rose-400 to-red-500',
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200',
      Icon: Star,
    };
  };

  const style = getScoreStyle(percentage);
  const ScoreIcon = style.Icon;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Header with gradient */}
      <div className={`h-2 bg-gradient-to-r ${style.gradient}`} />
      
      <div className="p-5">
        {/* Title row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${style.bg} ${style.text}`}>
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-white">
                {assignment.title}
              </h3>
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  Hodnoceno: {submission.graded_at 
                    ? format(parseISO(submission.graded_at), 'd. MMMM yyyy', { locale: cs })
                    : 'N/A'
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Score Badge */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${style.bg} ${style.border} border-2`}>
            <ScoreIcon className={`w-5 h-5 ${style.text}`} />
            <span className={`text-2xl font-bold ${style.text}`}>
              {percentage}%
            </span>
          </div>
        </div>

        {/* Teacher comment */}
        {submission.teacher_comment && (
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Komentář učitele
              </span>
            </div>
            <p className="text-slate-700 dark:text-slate-200 text-sm leading-relaxed">
              {submission.teacher_comment}
            </p>
          </div>
        )}

        {/* View button */}
        {onViewDocument && (
          <button
            onClick={onViewDocument}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 transition-colors"
          >
            <Eye className="w-4 h-4" />
            Zobrazit práci
          </button>
        )}
      </div>
    </div>
  );
}

export default GradedAssignmentCard;

