/**
 * GradingModal - Modal for teachers to grade student submissions
 * 
 * Features:
 * - Percentage slider/input
 * - Final comment textarea
 * - Visual score display
 */

import React, { useState } from 'react';
import { X, Star, Send, Trophy, Medal, Award } from 'lucide-react';

interface GradingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (score: number, comment: string) => void;
  studentName: string;
  assignmentTitle: string;
  isSubmitting?: boolean;
}

export function GradingModal({
  isOpen,
  onClose,
  onSubmit,
  studentName,
  assignmentTitle,
  isSubmitting = false,
}: GradingModalProps) {
  const [score, setScore] = useState(80);
  const [comment, setComment] = useState('');

  if (!isOpen) return null;

  // Get color based on score
  const getScoreColor = (score: number) => {
    if (score >= 90) return { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' };
    if (score >= 75) return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' };
    if (score >= 50) return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' };
    return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' };
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Výborně!';
    if (score >= 75) return 'Velmi dobře';
    if (score >= 50) return 'Dobře';
    if (score >= 30) return 'Dostačující';
    return 'Nedostačující';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 90) return Trophy;
    if (score >= 75) return Medal;
    return Award;
  };

  const colors = getScoreColor(score);
  const ScoreIcon = getScoreIcon(score);

  const handleSubmit = () => {
    onSubmit(score, comment);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Oznámkovat úkol</h2>
              <p className="text-indigo-200 text-sm mt-0.5">{assignmentTitle}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Student info */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <span className="text-lg font-semibold text-indigo-600">
                {studentName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-medium text-slate-800">{studentName}</p>
              <p className="text-sm text-slate-500">Odevzdaný úkol</p>
            </div>
          </div>

          {/* Score Display */}
          <div className={`p-6 rounded-2xl ${colors.bg} ${colors.border} border-2 text-center`}>
            <div className="flex items-center justify-center gap-3 mb-2">
              <ScoreIcon className={`w-8 h-8 ${colors.text}`} />
              <span className={`text-5xl font-bold ${colors.text}`}>{score}%</span>
            </div>
            <p className={`text-sm font-medium ${colors.text}`}>{getScoreLabel(score)}</p>
          </div>

          {/* Score Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                Procento splnění
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={score}
                onChange={(e) => setScore(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                className="w-16 px-2 py-1 text-center border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={score}
              onChange={(e) => setScore(parseInt(e.target.value))}
              className="w-full h-3 bg-slate-200 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-6
                [&::-webkit-slider-thumb]:h-6
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-indigo-600
                [&::-webkit-slider-thumb]:shadow-lg
                [&::-webkit-slider-thumb]:cursor-pointer
                [&::-webkit-slider-thumb]:transition-transform
                [&::-webkit-slider-thumb]:hover:scale-110"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Quick Score Buttons */}
          <div className="flex gap-2">
            {[100, 90, 80, 70, 60, 50].map((quickScore) => (
              <button
                key={quickScore}
                onClick={() => setScore(quickScore)}
                className={`flex-1 py-2 px-1 rounded-lg text-sm font-medium transition-colors ${
                  score === quickScore
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {quickScore}%
              </button>
            ))}
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Finální komentář (volitelné)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Napište zpětnou vazbu pro studenta..."
              className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={3}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 pt-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
          >
            Zrušit
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                Odeslat hodnocení
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default GradingModal;

