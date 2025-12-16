/**
 * Example Slide Editor
 * 
 * Editor for worked example slides with steps
 */

import React, { useState, useRef } from 'react';
import {
  Plus,
  Trash2,
  Lightbulb,
  Image as ImageIcon,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Calculator,
} from 'lucide-react';
import { ExampleActivitySlide, ExampleStep } from '../../../types/quiz';
import { MathInputModal, MathDisplay } from '../../math/MathKeyboard';

interface ExampleSlideEditorProps {
  slide: ExampleActivitySlide;
  onUpdate: (id: string, updates: Partial<ExampleActivitySlide>) => void;
}

export function ExampleSlideEditor({ slide, onUpdate }: ExampleSlideEditorProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [showMathInput, setShowMathInput] = useState(false);
  const [mathInputTarget, setMathInputTarget] = useState<{
    type: 'problem' | 'step' | 'finalAnswer';
    stepId?: string;
  } | null>(null);
  
  // Refs for text inputs to get cursor position
  const problemRef = useRef<HTMLTextAreaElement>(null);
  const finalAnswerRef = useRef<HTMLTextAreaElement>(null);
  const stepRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  
  // Insert LaTeX at cursor position
  const insertMathAtCursor = (latex: string) => {
    if (!mathInputTarget) return;
    
    const wrappedLatex = `$${latex}$`; // Wrap in $ for inline math
    
    if (mathInputTarget.type === 'problem') {
      const textarea = problemRef.current;
      if (textarea) {
        const start = textarea.selectionStart || 0;
        const before = slide.problem.slice(0, start);
        const after = slide.problem.slice(start);
        onUpdate(slide.id, { problem: before + wrappedLatex + after });
      } else {
        onUpdate(slide.id, { problem: slide.problem + wrappedLatex });
      }
    } else if (mathInputTarget.type === 'finalAnswer') {
      const textarea = finalAnswerRef.current;
      if (textarea) {
        const start = textarea.selectionStart || 0;
        const before = slide.finalAnswer.slice(0, start);
        const after = slide.finalAnswer.slice(start);
        onUpdate(slide.id, { finalAnswer: before + wrappedLatex + after });
      } else {
        onUpdate(slide.id, { finalAnswer: slide.finalAnswer + wrappedLatex });
      }
    } else if (mathInputTarget.type === 'step' && mathInputTarget.stepId) {
      const step = slide.steps.find(s => s.id === mathInputTarget.stepId);
      if (step) {
        const textarea = stepRefs.current[mathInputTarget.stepId];
        if (textarea) {
          const start = textarea.selectionStart || 0;
          const before = step.content.slice(0, start);
          const after = step.content.slice(start);
          updateStep(mathInputTarget.stepId, { content: before + wrappedLatex + after });
        } else {
          updateStep(mathInputTarget.stepId, { content: step.content + wrappedLatex });
        }
      }
    }
    
    setShowMathInput(false);
    setMathInputTarget(null);
  };
  
  // Open math input for specific field
  const openMathInput = (type: 'problem' | 'step' | 'finalAnswer', stepId?: string) => {
    setMathInputTarget({ type, stepId });
    setShowMathInput(true);
  };
  
  const addStep = () => {
    const newStep: ExampleStep = {
      id: `step-${Date.now()}`,
      content: '',
    };
    onUpdate(slide.id, { steps: [...slide.steps, newStep] });
    setExpandedStep(newStep.id);
  };
  
  const updateStep = (stepId: string, updates: Partial<ExampleStep>) => {
    const newSteps = slide.steps.map(step =>
      step.id === stepId ? { ...step, ...updates } : step
    );
    onUpdate(slide.id, { steps: newSteps });
  };
  
  const removeStep = (stepId: string) => {
    const newSteps = slide.steps.filter(step => step.id !== stepId);
    onUpdate(slide.id, { steps: newSteps });
  };
  
  const moveStep = (stepId: string, direction: 'up' | 'down') => {
    const idx = slide.steps.findIndex(s => s.id === stepId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === slide.steps.length - 1) return;
    
    const newSteps = [...slide.steps];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newSteps[idx], newSteps[targetIdx]] = [newSteps[targetIdx], newSteps[idx]];
    
    onUpdate(slide.id, { steps: newSteps });
  };
  
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-500 to-violet-600 p-4">
        <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
          <Lightbulb className="w-4 h-4" />
          <span>Příklad</span>
        </div>
        <h2 className="text-white font-bold text-lg">Řešený příklad</h2>
      </div>
      
      {/* Title */}
      <div className="p-6 border-b border-slate-100">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Název příkladu
        </label>
        <input
          type="text"
          value={slide.title}
          onChange={(e) => onUpdate(slide.id, { title: e.target.value })}
          placeholder="Např.: Výpočet obvodu kruhu"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-lg"
        />
      </div>
      
      {/* Problem statement */}
      <div className="p-6 border-b border-slate-100">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Zadání problému *
        </label>
        <textarea
          ref={problemRef}
          value={slide.problem}
          onChange={(e) => onUpdate(slide.id, { problem: e.target.value })}
          placeholder="Zadej problém k řešení... (můžeš použít LaTeX)"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all resize-none"
          rows={3}
        />
        
        {/* Preview rendered math if contains LaTeX */}
        {slide.problem.includes('$') && (
          <div className="mt-2 p-3 bg-slate-50 rounded-lg">
            <span className="text-xs text-slate-400 mb-1 block">Náhled:</span>
            <div className="text-[#4E5871]">
              {slide.problem.split(/(\$[^$]+\$)/g).map((part, i) => {
                if (part.startsWith('$') && part.endsWith('$')) {
                  return <MathDisplay key={i} math={part.slice(1, -1)} />;
                }
                return <span key={i}>{part}</span>;
              })}
            </div>
          </div>
        )}
        
        {/* Action buttons */}
        <div className="mt-2 flex items-center gap-2">
          <button 
            onClick={() => openMathInput('problem')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-violet-600 bg-violet-50 hover:bg-violet-100 transition-colors"
          >
            <Calculator className="w-4 h-4" />
            Vložit matematiku
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:bg-slate-100 transition-colors">
            <ImageIcon className="w-4 h-4" />
            Přidat obrázek
          </button>
        </div>
      </div>
      
      {/* Steps */}
      <div className="p-6 border-b border-slate-100">
        <label className="block text-sm font-medium text-slate-700 mb-3">
          Kroky řešení
        </label>
        
        <div className="space-y-3">
          {slide.steps.map((step, index) => (
            <div
              key={step.id}
              className="rounded-xl border border-slate-200 overflow-hidden"
            >
              {/* Step header */}
              <div 
                className="flex items-center gap-3 p-3 bg-slate-50 cursor-pointer"
                onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
              >
                {/* Drag handle */}
                <div className="text-slate-300 cursor-grab hover:text-slate-400">
                  <GripVertical className="w-4 h-4" />
                </div>
                
                {/* Step number */}
                <div className="w-7 h-7 rounded-full bg-violet-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {index + 1}
                </div>
                
                {/* Step preview */}
                <div className="flex-1 text-sm text-slate-600 truncate">
                  {step.content || 'Prázdný krok...'}
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveStep(step.id, 'up');
                    }}
                    disabled={index === 0}
                    className="p-1 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-30"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveStep(step.id, 'down');
                    }}
                    disabled={index === slide.steps.length - 1}
                    className="p-1 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-30"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeStep(step.id);
                    }}
                    className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* Step content (expanded) */}
              {expandedStep === step.id && (
                <div className="p-4 border-t border-slate-200 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      Obsah kroku
                    </label>
                    <textarea
                      ref={(el) => { stepRefs.current[step.id] = el; }}
                      value={step.content}
                      onChange={(e) => updateStep(step.id, { content: e.target.value })}
                      placeholder="Popis tohoto kroku..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all resize-none text-sm"
                      rows={3}
                    />
                    
                    {/* Preview rendered math if contains LaTeX */}
                    {step.content.includes('$') && (
                      <div className="mt-2 p-2 bg-slate-50 rounded-lg">
                        <span className="text-xs text-slate-400 mb-1 block">Náhled:</span>
                        <div className="text-[#4E5871] text-sm">
                          {step.content.split(/(\$[^$]+\$)/g).map((part, i) => {
                            if (part.startsWith('$') && part.endsWith('$')) {
                              return <MathDisplay key={i} math={part.slice(1, -1)} />;
                            }
                            return <span key={i}>{part}</span>;
                          })}
                        </div>
                      </div>
                    )}
                    
                    {/* Math button */}
                    <button 
                      onClick={() => openMathInput('step', step.id)}
                      className="mt-2 flex items-center gap-2 px-2 py-1 rounded text-xs text-violet-600 bg-violet-50 hover:bg-violet-100 transition-colors"
                    >
                      <Calculator className="w-3 h-3" />
                      Vložit matematiku
                    </button>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      Nápověda (volitelná)
                    </label>
                    <input
                      type="text"
                      value={step.hint || ''}
                      onChange={(e) => updateStep(step.id, { hint: e.target.value })}
                      placeholder="Tip pro studenty..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Add step button */}
        <button
          onClick={addStep}
          className="mt-3 w-full py-2 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-violet-300 hover:text-violet-500 hover:bg-violet-50 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Přidat krok
        </button>
      </div>
      
      {/* Final answer */}
      <div className="p-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Výsledek / Závěr
        </label>
        <textarea
          ref={finalAnswerRef}
          value={slide.finalAnswer}
          onChange={(e) => onUpdate(slide.id, { finalAnswer: e.target.value })}
          placeholder="Konečná odpověď nebo závěr..."
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all resize-none"
          rows={2}
        />
        
        {/* Preview rendered math if contains LaTeX */}
        {slide.finalAnswer.includes('$') && (
          <div className="mt-2 p-3 bg-emerald-50 rounded-lg">
            <span className="text-xs text-emerald-600 mb-1 block">Náhled výsledku:</span>
            <div className="text-[#4E5871] font-medium">
              {slide.finalAnswer.split(/(\$[^$]+\$)/g).map((part, i) => {
                if (part.startsWith('$') && part.endsWith('$')) {
                  return <MathDisplay key={i} math={part.slice(1, -1)} />;
                }
                return <span key={i}>{part}</span>;
              })}
            </div>
          </div>
        )}
        
        {/* Math button */}
        <button 
          onClick={() => openMathInput('finalAnswer')}
          className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-violet-600 bg-violet-50 hover:bg-violet-100 transition-colors"
        >
          <Calculator className="w-4 h-4" />
          Vložit matematiku
        </button>
      </div>
      
      {/* Math Input Modal */}
      <MathInputModal
        isOpen={showMathInput}
        onClose={() => {
          setShowMathInput(false);
          setMathInputTarget(null);
        }}
        onSubmit={insertMathAtCursor}
        title="Vložit matematický výraz"
      />
    </div>
  );
}

export default ExampleSlideEditor;

