/**
 * NPS (Net Promoter Score) Popup Component
 * Beautiful modal that asks users to rate their experience
 */

import React, { useState } from 'react';
import { X, Send, Heart, Sparkles, MessageSquare } from 'lucide-react';

interface NPSPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (score: number, feedback: string) => void;
  userName?: string;
}

type Step = 'score' | 'feedback' | 'thanks';

const getScoreColor = (score: number, selected: number | null): string => {
  if (selected === null) {
    // Default colors when nothing selected
    if (score <= 6) return 'bg-red-100 text-red-600 hover:bg-red-200 border-red-200';
    if (score <= 8) return 'bg-amber-100 text-amber-600 hover:bg-amber-200 border-amber-200';
    return 'bg-green-100 text-green-600 hover:bg-green-200 border-green-200';
  }
  
  // When something is selected
  if (score === selected) {
    if (score <= 6) return 'bg-red-500 text-white border-red-600 ring-4 ring-red-200';
    if (score <= 8) return 'bg-amber-500 text-white border-amber-600 ring-4 ring-amber-200';
    return 'bg-green-500 text-white border-green-600 ring-4 ring-green-200';
  }
  
  // Non-selected scores when something is selected
  return 'bg-slate-100 text-slate-400 border-slate-200';
};

const getCategory = (score: number): 'detractor' | 'passive' | 'promoter' => {
  if (score <= 6) return 'detractor';
  if (score <= 8) return 'passive';
  return 'promoter';
};

const getFeedbackQuestion = (score: number): string => {
  if (score <= 6) {
    return 'Co můžeme zlepšit, aby byl váš zážitek lepší?';
  }
  if (score <= 8) {
    return 'Co by vás přesvědčilo dát nám vyšší hodnocení?';
  }
  return 'Skvělé! Co se vám nejvíce líbí?';
};

const getFeedbackPlaceholder = (score: number): string => {
  if (score <= 6) {
    return 'Napište nám, co bychom mohli zlepšit...';
  }
  if (score <= 8) {
    return 'Napište nám, co by vám pomohlo...';
  }
  return 'Napište nám, co máte nejraději...';
};

export function NPSPopup({ isOpen, onClose, onSubmit, userName }: NPSPopupProps) {
  const [step, setStep] = useState<Step>('score');
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleScoreSelect = (score: number) => {
    setSelectedScore(score);
  };

  const handleContinue = () => {
    if (selectedScore !== null) {
      setStep('feedback');
    }
  };

  const handleSubmit = async () => {
    if (selectedScore === null) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(selectedScore, feedback);
      setStep('thanks');
      // Auto-close after 2 seconds
      setTimeout(() => {
        handleClose();
      }, 2500);
    } catch (error) {
      console.error('Error submitting NPS:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep('score');
    setSelectedScore(null);
    setFeedback('');
    onClose();
  };

  const handleSkipFeedback = () => {
    if (selectedScore !== null) {
      onSubmit(selectedScore, '');
      setStep('thanks');
      setTimeout(() => {
        handleClose();
      }, 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Step 1: Score Selection */}
        {step === 'score' && (
          <div className="p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                {userName ? `Ahoj, ${userName.split(' ')[0]}!` : 'Ahoj!'}
              </h2>
              <p className="text-slate-600">
                Jak moc byste doporučili Vividbooks svým kolegům?
              </p>
            </div>

            {/* Score buttons */}
            <div className="flex justify-center gap-2 mb-6">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                <button
                  key={score}
                  onClick={() => handleScoreSelect(score)}
                  className={`w-10 h-10 rounded-xl font-semibold text-sm border-2 transition-all duration-200 ${getScoreColor(score, selectedScore)}`}
                >
                  {score}
                </button>
              ))}
            </div>

            {/* Scale labels */}
            <div className="flex justify-between text-xs text-slate-500 mb-8 px-1">
              <span>Vůbec ne</span>
              <span>Rozhodně ano</span>
            </div>

            {/* Continue button */}
            <button
              onClick={handleContinue}
              disabled={selectedScore === null}
              className={`w-full py-3 px-6 rounded-xl font-semibold text-white transition-all duration-200 ${
                selectedScore !== null
                  ? 'bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-xl'
                  : 'bg-slate-300 cursor-not-allowed'
              }`}
            >
              Pokračovat
            </button>

            {/* Later button */}
            <button
              onClick={handleClose}
              className="w-full mt-3 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Zeptat se později
            </button>
          </div>
        )}

        {/* Step 2: Feedback */}
        {step === 'feedback' && selectedScore !== null && (
          <div className="p-8">
            {/* Header with score badge */}
            <div className="text-center mb-6">
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-4 ${
                getCategory(selectedScore) === 'promoter' 
                  ? 'bg-green-100 text-green-700'
                  : getCategory(selectedScore) === 'passive'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700'
              }`}>
                <span>Vaše hodnocení:</span>
                <span className="font-bold">{selectedScore}/10</span>
              </div>
              
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-7 h-7 text-slate-600" />
              </div>
              
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                {getFeedbackQuestion(selectedScore)}
              </h3>
              <p className="text-sm text-slate-500">
                Vaše zpětná vazba nám pomáhá se zlepšovat
              </p>
            </div>

            {/* Feedback textarea */}
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={getFeedbackPlaceholder(selectedScore)}
              className="w-full h-32 p-4 border-2 border-slate-200 rounded-xl resize-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-slate-700 placeholder:text-slate-400"
              autoFocus
            />

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full mt-4 py-3 px-6 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Odeslat
                </>
              )}
            </button>

            {/* Skip button */}
            <button
              onClick={handleSkipFeedback}
              className="w-full mt-3 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Přeskočit
            </button>

            {/* Back button */}
            <button
              onClick={() => setStep('score')}
              className="w-full mt-1 py-2 text-sm text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              ← Změnit hodnocení
            </button>
          </div>
        )}

        {/* Step 3: Thank you */}
        {step === 'thanks' && (
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg animate-bounce">
              <Heart className="w-10 h-10 text-white" />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              Děkujeme! 💜
            </h2>
            <p className="text-slate-600 mb-6">
              Vaše zpětná vazba nám velmi pomáhá.<br />
              Těšíme se na další spolupráci!
            </p>
            
            <div className="text-sm text-slate-400">
              Okno se automaticky zavře...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default NPSPopup;



