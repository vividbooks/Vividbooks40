/**
 * Video Quiz Slide View (Otázky ve videu)
 * 
 * Student view for video-based quiz activities
 * Video pauses at timestamps for ABC questions
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Check,
  X,
  Film,
  Play,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { VideoQuizActivitySlide, VideoQuestion } from '../../../types/quiz';

interface VideoQuizViewProps {
  slide: VideoQuizActivitySlide;
  isTeacher?: boolean;
  readOnly?: boolean;
  onSubmit?: (result: { correct: number; total: number; answers: Record<string, string> }) => void;
  showResults?: boolean;
}

// Format seconds to mm:ss
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Extract YouTube video ID from URL
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// ABC option button
function OptionButton({
  option,
  isSelected,
  showResult,
  onClick,
  disabled,
}: {
  option: { id: string; label: string; content: string; isCorrect: boolean };
  isSelected: boolean;
  showResult: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  const getStyles = () => {
    if (showResult) {
      if (option.isCorrect) {
        return { bg: '#dcfce7', border: '#22c55e', text: '#166534', labelBg: '#22c55e' };
      }
      if (isSelected && !option.isCorrect) {
        return { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', labelBg: '#ef4444' };
      }
      return { bg: '#f8fafc', border: '#e2e8f0', text: '#94a3b8', labelBg: '#e2e8f0' };
    }
    if (isSelected) {
      return { bg: '#fef2f2', border: '#ef4444', text: '#dc2626', labelBg: '#ef4444' };
    }
    return { bg: '#ffffff', border: '#e2e8f0', text: '#4E5871', labelBg: '#f1f5f9' };
  };

  const styles = getStyles();

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-3 hover:scale-[1.02]"
      style={{
        backgroundColor: styles.bg,
        borderColor: styles.border,
        color: styles.text,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      <span 
        className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg flex-shrink-0"
        style={{
          backgroundColor: isSelected || (showResult && option.isCorrect) ? styles.labelBg : '#f1f5f9',
          color: isSelected || (showResult && option.isCorrect) ? 'white' : '#64748b',
        }}
      >
        {option.label}
      </span>
      <span className="font-medium flex-1">{option.content}</span>
      
      {showResult && (
        <span className="ml-auto">
          {option.isCorrect && <Check className="w-5 h-5 text-green-600" />}
          {isSelected && !option.isCorrect && <X className="w-5 h-5 text-red-600" />}
        </span>
      )}
    </button>
  );
}

export function VideoQuizView({
  slide,
  isTeacher = false,
  readOnly = false,
  onSubmit,
  showResults = false,
}: VideoQuizViewProps) {
  // State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({}); // questionId -> optionId
  const [showQuestionResult, setShowQuestionResult] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get video ID
  const videoId = slide.videoId || extractYouTubeId(slide.videoUrl || '');

  // Sort questions by timestamp
  const sortedQuestions = useMemo(() => {
    return [...slide.questions].sort((a, b) => a.timestamp - b.timestamp);
  }, [slide.questions]);

  // Current question
  const currentQuestion = currentQuestionIndex !== null 
    ? sortedQuestions[currentQuestionIndex] 
    : null;

  // Current answer
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;

  // Calculate score
  const score = useMemo(() => {
    let correct = 0;
    sortedQuestions.forEach(q => {
      const answer = answers[q.id];
      const correctOption = q.options.find(o => o.isCorrect);
      if (answer === correctOption?.id) {
        correct++;
      }
    });
    return { correct, total: sortedQuestions.length };
  }, [sortedQuestions, answers]);

  // Handle option select
  const handleOptionSelect = (optionId: string) => {
    if (readOnly || showQuestionResult || !currentQuestion) return;

    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: optionId,
    }));
  };

  // Confirm answer and continue
  const confirmAnswer = () => {
    if (!currentQuestion || !currentAnswer) return;

    // Show result briefly
    setShowQuestionResult(true);

    setTimeout(() => {
      setShowQuestionResult(false);
      setCurrentQuestionIndex(null);

      // Check if all questions answered
      const answeredCount = Object.keys(answers).length;
      if (answeredCount >= sortedQuestions.length) {
        setIsComplete(true);
        onSubmit?.({
          correct: score.correct,
          total: score.total,
          answers,
        });
      }
    }, 1500);
  };

  // Handle simulated question trigger (for demo without actual YouTube API)
  const triggerQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
  };

  const showFinalResults = showResults || isComplete;

  // If no video, show message
  if (!videoId) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50 rounded-3xl">
        <div className="text-center text-slate-500">
          <Film className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Žádné video</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-red-900/20 rounded-3xl overflow-auto"
    >
      <div className="max-w-5xl mx-auto p-6 md:p-8">
        {/* Instruction */}
        <div className="text-center mb-6" style={{ paddingTop: '20px' }}>
          <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
            {slide.instruction || 'Sleduj video a odpovídej na otázky'}
          </h2>
          
          {/* Progress */}
          <div className="flex items-center justify-center gap-4 mt-3">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
              <Film className="w-4 h-4 text-red-400" />
              <span className="font-medium text-white/80">
                {Object.keys(answers).length} / {sortedQuestions.length} otázek
              </span>
            </div>
            
            {showFinalResults && (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                score.correct === score.total ? 'bg-green-500/20 text-green-300' : 'bg-amber-500/20 text-amber-300'
              }`}>
                <span className="font-bold">{score.correct} / {score.total} správně</span>
              </div>
            )}
          </div>
        </div>

        {/* Video player with overlay */}
        <div className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl mb-6">
          {/* YouTube embed */}
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&modestbranding=1&rel=0`}
            title="Video"
            className="w-full h-full"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />

          {/* Question overlay */}
          {currentQuestionIndex !== null && currentQuestion && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8">
              <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
                {/* Question header */}
                <div className="bg-red-500 p-4">
                  <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
                    <Clock className="w-4 h-4" />
                    {formatTime(currentQuestion.timestamp)}
                  </div>
                  <h3 className="text-white font-bold text-xl">
                    {currentQuestion.question}
                  </h3>
                </div>

                {/* Options */}
                <div className="p-4 space-y-3">
                  {currentQuestion.options.map((option) => (
                    <OptionButton
                      key={option.id}
                      option={option}
                      isSelected={currentAnswer === option.id}
                      showResult={showQuestionResult}
                      onClick={() => handleOptionSelect(option.id)}
                      disabled={readOnly || showQuestionResult}
                    />
                  ))}
                </div>

                {/* Confirm button */}
                {!showQuestionResult && (
                  <div className="p-4 pt-0">
                    <button
                      onClick={confirmAnswer}
                      disabled={!currentAnswer}
                      className="w-full py-3 rounded-xl font-bold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{
                        background: currentAnswer 
                          ? 'linear-gradient(to right, #ef4444, #f97316)' 
                          : '#94a3b8',
                      }}
                    >
                      Potvrdit
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Question timeline */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
          <div className="flex items-center gap-2 text-white/60 text-sm mb-3">
            <Clock className="w-4 h-4" />
            Otázky v průběhu videa
          </div>
          
          <div className="flex flex-wrap gap-2">
            {sortedQuestions.map((question, index) => {
              const isAnswered = !!answers[question.id];
              const correctOption = question.options.find(o => o.isCorrect);
              const isCorrect = answers[question.id] === correctOption?.id;

              return (
                <button
                  key={question.id}
                  onClick={() => !readOnly && !isAnswered && triggerQuestion(index)}
                  disabled={readOnly || (slide.mustAnswerToProgress && isAnswered)}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${isAnswered 
                      ? isCorrect 
                        ? 'bg-green-500/20 text-green-300' 
                        : 'bg-red-500/20 text-red-300'
                      : 'bg-white/10 text-white/80 hover:bg-white/20 cursor-pointer'
                    }
                  `}
                >
                  <span className="font-mono text-xs opacity-70">{formatTime(question.timestamp)}</span>
                  {isAnswered && (
                    isCorrect ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />
                  )}
                  {!isAnswered && <Play className="w-3 h-3" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Final results */}
        {showFinalResults && (
          <div className={`mt-6 p-6 rounded-2xl text-center ${
            score.correct === score.total ? 'bg-green-500/20' : 'bg-amber-500/20'
          }`}>
            <div className={`text-5xl font-bold mb-2 ${
              score.correct === score.total ? 'text-green-300' : 'text-amber-300'
            }`}>
              {score.correct}/{score.total}
            </div>
            <p className={`text-lg font-medium ${
              score.correct === score.total ? 'text-green-200' : 'text-amber-200'
            }`}>
              {score.correct === score.total 
                ? 'Výborně! Vše správně!' 
                : `${score.correct} z ${score.total} správně`}
            </p>
          </div>
        )}

        {/* Teacher view - show all answers */}
        {isTeacher && (
          <div className="mt-6 p-4 bg-white/10 backdrop-blur-sm rounded-xl">
            <h3 className="font-medium text-white mb-3">Všechny otázky:</h3>
            <div className="space-y-2">
              {sortedQuestions.map((question, i) => {
                const correctOption = question.options.find(o => o.isCorrect);
                return (
                  <div key={question.id} className="flex items-center gap-3 text-sm text-white/80">
                    <span className="font-mono text-xs text-red-400">{formatTime(question.timestamp)}</span>
                    <span className="flex-1">{question.question}</span>
                    <span className="text-green-400 font-medium">{correctOption?.content}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default VideoQuizView;










