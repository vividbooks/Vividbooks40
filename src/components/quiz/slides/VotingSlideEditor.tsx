/**
 * Voting Slide Editor
 * 
 * Editor for voting/poll activities where students vote and teacher sees results
 * Supports: single choice, multiple choice, scale (1-10), feedback (emoji/hearts)
 */

import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  BarChart2,
  PieChart,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Heart,
  Smile,
  Hash,
  CheckCircle,
  List,
} from 'lucide-react';
import { VotingActivitySlide, VotingOption, VotingType, FeedbackStyle, getOptionLabel, createVotingSlide } from '../../../types/quiz';
import { useAssetPicker } from '../../../hooks/useAssetPicker';
import { getContrastColor } from '../../../utils/color-utils';

interface VotingSlideEditorProps {
  slide: VotingActivitySlide;
  onUpdate: (id: string, updates: Partial<VotingActivitySlide>) => void;
}

// Option colors for the chart
const OPTION_COLORS = [
  '#10b981', // emerald
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#ef4444', // red
  '#06b6d4', // cyan
  '#84cc16', // lime
];

// Scale colors (orange to blue gradient)
const SCALE_COLORS = [
  '#f97316', '#f97316', '#c084fc', '#a855f7', '#8b5cf6',
  '#7c3aed', '#6366f1', '#4f46e5', '#4338ca', '#4f46e5',
];

// Voting type configurations
const VOTING_TYPES: { type: VotingType; label: string; description: string; icon: React.ReactNode }[] = [
  { type: 'single', label: 'Jedna možnost', description: 'Koláčový graf', icon: <PieChart className="w-5 h-5" /> },
  { type: 'multiple', label: 'Více možností', description: 'Sloupcový graf', icon: <BarChart2 className="w-5 h-5" /> },
  { type: 'scale', label: 'Od–do (škála)', description: 'Číselná stupnice', icon: <Hash className="w-5 h-5" /> },
  { type: 'feedback', label: 'Zpětná vazba', description: 'Emoji nebo srdíčka', icon: <Smile className="w-5 h-5" /> },
];

// Default emoji options for feedback
const EMOJI_OPTIONS = ['😢', '😟', '😐', '😊', '🥳'];

export function VotingSlideEditor({ slide, onUpdate }: VotingSlideEditorProps) {
  const [editingQuestion, setEditingQuestion] = useState(false);
  const [editingOption, setEditingOption] = useState<string | null>(null);
  
  const { openAssetPicker, AssetPickerModal } = useAssetPicker({
    onSelect: (result) => {
      onUpdate(slide.id, { media: { type: 'image', url: result.url } });
    },
  });
  
  // Default votingType to 'single' for backwards compatibility
  const votingType = slide.votingType || (slide.allowMultiple ? 'multiple' : 'single');
  
  const updateOption = (optionId: string, updates: Partial<VotingOption>) => {
    const newOptions = slide.options.map(opt =>
      opt.id === optionId ? { ...opt, ...updates } : opt
    );
    onUpdate(slide.id, { options: newOptions });
  };
  
  const addOption = () => {
    const newLabel = getOptionLabel(slide.options.length);
    const newOption: VotingOption = {
      id: newLabel.toLowerCase(),
      label: newLabel,
      content: '',
      color: OPTION_COLORS[slide.options.length % OPTION_COLORS.length],
    };
    onUpdate(slide.id, { options: [...slide.options, newOption] });
  };
  
  const removeOption = (optionId: string) => {
    if (slide.options.length <= 2) return; // Minimum 2 options
    
    const newOptions = slide.options
      .filter(opt => opt.id !== optionId)
      .map((opt, idx) => ({
        ...opt,
        id: getOptionLabel(idx).toLowerCase(),
        label: getOptionLabel(idx),
        color: OPTION_COLORS[idx % OPTION_COLORS.length],
      }));
    
    onUpdate(slide.id, { options: newOptions });
  };
  
  // Handle voting type change
  const handleVotingTypeChange = (newType: VotingType) => {
    let newOptions = slide.options;
    let newAllowMultiple = slide.allowMultiple;
    
    if (newType === 'scale') {
      // Generate scale options
      const min = slide.scaleMin || 1;
      const max = slide.scaleMax || 10;
      newOptions = Array.from({ length: max - min + 1 }, (_, i) => ({
        id: `scale-${min + i}`,
        label: String(min + i),
        content: String(min + i),
        color: SCALE_COLORS[(i * 10) / (max - min + 1) | 0] || SCALE_COLORS[0],
      }));
      newAllowMultiple = false;
    } else if (newType === 'feedback') {
      // Generate feedback options based on style
      const style = slide.feedbackStyle || 'emoji';
      if (style === 'emoji') {
        newOptions = EMOJI_OPTIONS.map((emoji, i) => ({
          id: `feedback-${i + 1}`,
          label: String(i + 1),
          content: emoji,
          emoji,
        }));
      } else {
        newOptions = [1, 2, 3, 4, 5].map(i => ({
          id: `feedback-${i}`,
          label: String(i),
          content: String(i),
        }));
      }
      newAllowMultiple = false;
    } else if (newType === 'single' || newType === 'multiple') {
      // If coming from scale/feedback, reset to ABC options
      if (votingType === 'scale' || votingType === 'feedback') {
        newOptions = [
          { id: 'a', label: 'A', content: '' },
          { id: 'b', label: 'B', content: '' },
          { id: 'c', label: 'C', content: '' },
        ];
      }
      newAllowMultiple = newType === 'multiple';
    }
    
    onUpdate(slide.id, { 
      votingType: newType, 
      options: newOptions,
      allowMultiple: newAllowMultiple,
    });
  };
  
  // Handle scale range change
  const handleScaleChange = (min: number, max: number) => {
    const newOptions = Array.from({ length: max - min + 1 }, (_, i) => ({
      id: `scale-${min + i}`,
      label: String(min + i),
      content: String(min + i),
      color: SCALE_COLORS[Math.floor((i / (max - min)) * 9)] || SCALE_COLORS[0],
    }));
    
    onUpdate(slide.id, { 
      scaleMin: min, 
      scaleMax: max, 
      options: newOptions 
    });
  };
  
  // Handle feedback style change
  const handleFeedbackStyleChange = (style: FeedbackStyle) => {
    let newOptions: VotingOption[];
    
    if (style === 'emoji') {
      newOptions = EMOJI_OPTIONS.map((emoji, i) => ({
        id: `feedback-${i + 1}`,
        label: String(i + 1),
        content: emoji,
        emoji,
      }));
    } else {
      newOptions = [1, 2, 3, 4, 5].map(i => ({
        id: `feedback-${i}`,
        label: String(i),
        content: '❤️',
      }));
    }
    
    onUpdate(slide.id, { feedbackStyle: style, options: newOptions });
  };
  
  // Get background color and contrast color for text
  const bgColor = (slide as any).slideBackground?.color || '#ffffff';
  const textColor = getContrastColor(bgColor);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: bgColor, color: textColor }}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center gap-2 text-sm mb-1" style={{ opacity: 0.7 }}>
          <BarChart2 className="w-4 h-4" />
          <span>Hlasování</span>
        </div>
        <h2 className="font-bold text-lg">Anketa s grafem</h2>
      </div>
      
      {/* Voting Type Selector */}
      <div className="p-4 border-b border-slate-100">
        <label className="block text-sm font-medium text-slate-700 mb-3">
          Typ hlasování
        </label>
        <div className="grid grid-cols-2 gap-2">
          {VOTING_TYPES.map((vt) => (
            <button
              key={vt.type}
              onClick={() => handleVotingTypeChange(vt.type)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                votingType === vt.type
                  ? 'border-sky-500 bg-sky-50'
                  : 'border-slate-200 hover:border-sky-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={votingType === vt.type ? 'text-sky-600' : 'text-slate-400'}>
                  {vt.icon}
                </div>
                <span className={`font-medium ${votingType === vt.type ? 'text-sky-700' : 'text-slate-700'}`}>
                  {vt.label}
                </span>
              </div>
              <p className="text-xs text-slate-500">{vt.description}</p>
            </button>
          ))}
        </div>
      </div>
      
      {/* Question input */}
      <div className="p-6 border-b border-slate-100">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Otázka *
        </label>
        {editingQuestion ? (
          <textarea
            value={slide.question}
            onChange={(e) => onUpdate(slide.id, { question: e.target.value })}
            onBlur={() => setEditingQuestion(false)}
            autoFocus
            placeholder="Jaká je vaše oblíbená...? Co si myslíte o...?"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all resize-none text-lg"
            rows={3}
          />
        ) : (
          <div
            onClick={() => setEditingQuestion(true)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 hover:border-sky-300 cursor-text min-h-[80px] text-lg"
          >
            {slide.question ? (
              <span className="text-[#4E5871]">{slide.question}</span>
            ) : (
              <span className="text-slate-400">Zadej otázku... (klikni pro editaci)</span>
            )}
          </div>
        )}
        
        {/* Image section */}
        {slide.media?.url ? (
          <div className="mt-4 relative">
            <img 
              src={slide.media.url} 
              alt="Obrázek k otázce"
              className="max-w-full max-h-48 rounded-lg border border-slate-200"
            />
            <button
              onClick={() => onUpdate(slide.id, { media: undefined })}
              className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button 
            onClick={openAssetPicker}
            className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <ImageIcon className="w-4 h-4" />
            Přidat obrázek
          </button>
        )}
      </div>
      
      {/* Scale Settings */}
      {votingType === 'scale' && (
        <div className="p-6 border-b border-slate-100">
          <label className="block text-sm font-medium text-slate-700 mb-4">
            Nastavení škály
          </label>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Od (min)</label>
              <input
                type="number"
                min={1}
                max={(slide.scaleMax || 10) - 1}
                value={slide.scaleMin || 1}
                onChange={(e) => handleScaleChange(parseInt(e.target.value) || 1, slide.scaleMax || 10)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-sky-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Do (max)</label>
              <input
                type="number"
                min={(slide.scaleMin || 1) + 1}
                max={20}
                value={slide.scaleMax || 10}
                onChange={(e) => handleScaleChange(slide.scaleMin || 1, parseInt(e.target.value) || 10)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-sky-500 outline-none"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Popisek minima</label>
              <input
                type="text"
                value={slide.scaleMinLabel || ''}
                onChange={(e) => onUpdate(slide.id, { scaleMinLabel: e.target.value })}
                placeholder="Určitě ne"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-sky-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Popisek maxima</label>
              <input
                type="text"
                value={slide.scaleMaxLabel || ''}
                onChange={(e) => onUpdate(slide.id, { scaleMaxLabel: e.target.value })}
                placeholder="Určitě ano"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-sky-500 outline-none text-sm"
              />
            </div>
          </div>
          
          {/* Scale Preview */}
          <div className="mt-6">
            <label className="block text-xs text-slate-500 mb-2">Náhled</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-orange-500 font-medium">{slide.scaleMinLabel || 'Min'}</span>
              <div className="flex-1 flex gap-1">
                {slide.options.map((opt, i) => (
                  <div
                    key={opt.id}
                    className="flex-1 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: opt.color || SCALE_COLORS[i] }}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
              <span className="text-sm text-indigo-500 font-medium">{slide.scaleMaxLabel || 'Max'}</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Feedback Settings */}
      {votingType === 'feedback' && (
        <div className="p-6 border-b border-slate-100">
          <label className="block text-sm font-medium text-slate-700 mb-4">
            Styl zpětné vazby
          </label>
          
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => handleFeedbackStyleChange('emoji')}
              className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                slide.feedbackStyle !== 'hearts'
                  ? 'border-sky-500 bg-sky-50'
                  : 'border-slate-200 hover:border-sky-200'
              }`}
            >
              <div className="text-3xl mb-2">😊</div>
              <span className="font-medium text-slate-700">Smajlíky</span>
            </button>
            <button
              onClick={() => handleFeedbackStyleChange('hearts')}
              className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                slide.feedbackStyle === 'hearts'
                  ? 'border-sky-500 bg-sky-50'
                  : 'border-slate-200 hover:border-sky-200'
              }`}
            >
              <div className="text-3xl mb-2">❤️</div>
              <span className="font-medium text-slate-700">Srdíčka</span>
            </button>
          </div>
          
          {/* Feedback Preview */}
          <div>
            <label className="block text-xs text-slate-500 mb-2">Náhled</label>
            <div className="flex justify-center gap-4">
              {slide.feedbackStyle === 'hearts' ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="text-center">
                    <Heart 
                      className="w-10 h-10 transition-all"
                      style={{ 
                        fill: i <= 3 ? '#e2e8f0' : '#ef4444',
                        color: i <= 3 ? '#cbd5e1' : '#ef4444',
                        transform: `scale(${0.6 + i * 0.15})`,
                      }}
                    />
                    <span className="text-xs text-slate-500 mt-1">{i}</span>
                  </div>
                ))
              ) : (
                slide.options.map((opt, i) => (
                  <div 
                    key={opt.id} 
                    className="text-center transition-all"
                    style={{ transform: `scale(${0.7 + i * 0.15})` }}
                  >
                    <span className="text-4xl">{opt.emoji || opt.content}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Options (only for single/multiple) */}
      {(votingType === 'single' || votingType === 'multiple') && (
        <div className="p-6 border-b border-slate-100">
          <label className="block text-sm font-medium text-slate-700 mb-4">
            Možnosti hlasování
          </label>
          
          <div className="space-y-3">
            {slide.options.map((option, index) => (
              <div
                key={option.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-sky-200 transition-colors"
              >
                {/* Color indicator */}
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                  style={{ backgroundColor: option.color || OPTION_COLORS[index % OPTION_COLORS.length] }}
                >
                  {option.label}
                </div>
                
                {/* Content input */}
                <div className="flex-1">
                  {editingOption === option.id ? (
                    <input
                      type="text"
                      value={option.content}
                      onChange={(e) => updateOption(option.id, { content: e.target.value })}
                      onBlur={() => setEditingOption(null)}
                      onKeyDown={(e) => e.key === 'Enter' && setEditingOption(null)}
                      autoFocus
                      placeholder={`Možnost ${option.label}...`}
                      className="w-full px-3 py-2 rounded-lg border border-sky-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none text-sm"
                    />
                  ) : (
                    <div
                      onClick={() => setEditingOption(option.id)}
                      className="px-3 py-2 rounded-lg hover:bg-slate-50 cursor-text text-sm"
                    >
                      {option.content ? (
                        <span className="text-[#4E5871]">{option.content}</span>
                      ) : (
                        <span className="text-slate-400">Klikni pro zadání možnosti...</span>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Delete button */}
                <button
                  onClick={() => removeOption(option.id)}
                  disabled={slide.options.length <= 2}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          
          {/* Add option button */}
          {slide.options.length < 8 && (
            <button
              onClick={addOption}
              className="mt-4 w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-sky-300 hover:text-sky-600 hover:bg-sky-50 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Přidat možnost
            </button>
          )}
        </div>
      )}
      
      {/* Settings */}
      <div className="p-6 space-y-4">
        <h3 className="text-sm font-medium text-slate-700 mb-3">Nastavení</h3>
        
        {/* Show results to students toggle */}
        <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {slide.showResultsToStudents ? (
                <Eye className="w-4 h-4 text-sky-500" />
              ) : (
                <EyeOff className="w-4 h-4 text-slate-400" />
              )}
              <span className="font-medium text-slate-700">Zobrazit výsledky studentům</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {slide.showResultsToStudents 
                ? 'Studenti uvidí graf po odhlasování' 
                : 'Výsledky uvidí pouze učitel'}
            </p>
          </div>
          <div 
            className="relative flex-shrink-0"
            style={{ 
              width: '52px', 
              height: '28px', 
              borderRadius: '14px',
              backgroundColor: slide.showResultsToStudents ? '#0ea5e9' : '#94a3b8',
              transition: 'background-color 0.2s ease',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)'
            }}
          >
            <div 
              style={{ 
                position: 'absolute',
                top: '2px',
                left: slide.showResultsToStudents ? '26px' : '2px',
                width: '24px', 
                height: '24px', 
                borderRadius: '12px',
                backgroundColor: '#ffffff',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                transition: 'left 0.2s ease'
              }}
            />
          </div>
          <input
            type="checkbox"
            checked={slide.showResultsToStudents}
            onChange={(e) => onUpdate(slide.id, { showResultsToStudents: e.target.checked })}
            className="sr-only"
          />
        </label>
      </div>
      
      {/* Preview hint */}
      <div className="px-6 pb-6">
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-sky-100 rounded-lg">
              {votingType === 'scale' ? (
                <Hash className="w-5 h-5 text-sky-600" />
              ) : votingType === 'feedback' ? (
                <Smile className="w-5 h-5 text-sky-600" />
              ) : votingType === 'multiple' ? (
                <BarChart2 className="w-5 h-5 text-sky-600" />
              ) : (
                <PieChart className="w-5 h-5 text-sky-600" />
              )}
            </div>
            <div>
              <h4 className="font-medium text-sky-900">
                {votingType === 'scale' && 'Sloupcový graf škály'}
                {votingType === 'feedback' && 'Vizuální zpětná vazba'}
                {votingType === 'multiple' && 'Sloupcový graf'}
                {votingType === 'single' && 'Koláčový graf'}
              </h4>
              <p className="text-sm text-sky-700 mt-1">
                Učitel uvidí realtime graf hlasování. Studenti {slide.showResultsToStudents ? 'uvidí' : 'neuvidí'} výsledky po odhlasování.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {AssetPickerModal}
    </div>
  );
}

export default VotingSlideEditor;
