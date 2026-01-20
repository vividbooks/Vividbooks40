/**
 * Video Quiz Slide Editor (Otázky ve videu)
 * 
 * Editor for creating video-based quiz activities
 * Add ABC questions at specific timestamps in YouTube videos
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Film,
  Clock,
  Settings,
  X,
  Play,
  Check,
  ChevronDown,
  ChevronUp,
  Edit2,
} from 'lucide-react';
import { VideoQuizActivitySlide, VideoQuestion } from '../../../types/quiz';
import { getContrastColor } from '../../../utils/color-utils';

interface VideoQuizEditorProps {
  slide: VideoQuizActivitySlide;
  onUpdate: (id: string, updates: Partial<VideoQuizActivitySlide>) => void;
}

// Toggle Switch component
const ToggleSwitch = ({ 
  enabled, 
  onChange, 
  label, 
  description 
}: { 
  enabled: boolean; 
  onChange: (v: boolean) => void; 
  label: string;
  description?: string;
}) => (
  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
    <div className="flex-1">
      <span className="font-medium text-slate-700">{label}</span>
      {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
    </div>
    <div 
      className="relative flex-shrink-0"
      style={{ 
        width: '52px', 
        height: '28px', 
        borderRadius: '14px',
        backgroundColor: enabled ? '#7C3AED' : '#94a3b8',
        transition: 'background-color 0.2s ease',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)'
      }}
    >
      <div 
        style={{ 
          position: 'absolute',
          top: '2px',
          left: enabled ? '26px' : '2px',
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
      checked={enabled}
      onChange={(e) => onChange(e.target.checked)}
      className="sr-only"
    />
  </label>
);

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

// Format seconds to mm:ss
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Parse mm:ss to seconds
function parseTime(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

// Question editor component
function QuestionEditor({
  question,
  index,
  onUpdate,
  onRemove,
  isExpanded,
  onToggle,
}: {
  question: VideoQuestion;
  index: number;
  onUpdate: (updates: Partial<VideoQuestion>) => void;
  onRemove: () => void;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [timeInput, setTimeInput] = useState(formatTime(question.timestamp));

  const updateOption = (optionId: string, updates: Partial<typeof question.options[0]>) => {
    const newOptions = question.options.map(opt =>
      opt.id === optionId ? { ...opt, ...updates } : opt
    );
    onUpdate({ options: newOptions });
  };

  const setCorrectOption = (optionId: string) => {
    const newOptions = question.options.map(opt => ({
      ...opt,
      isCorrect: opt.id === optionId,
    }));
    onUpdate({ options: newOptions });
  };

  const handleTimeBlur = () => {
    const seconds = parseTime(timeInput);
    onUpdate({ timestamp: seconds });
    setTimeInput(formatTime(seconds));
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2 text-red-500 font-mono text-sm bg-red-50 px-2 py-1 rounded">
          <Clock className="w-3 h-3" />
          {formatTime(question.timestamp)}
        </div>
        <span className="flex-1 text-left font-medium text-slate-700 truncate">
          {question.question || `Otázka ${index + 1}`}
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="p-4 border-t border-slate-100 space-y-4">
          {/* Timestamp */}
          <div className="flex gap-4">
            <div className="w-32">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Časový bod
              </label>
              <input
                type="text"
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                onBlur={handleTimeBlur}
                placeholder="0:00"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Otázka
              </label>
              <input
                type="text"
                value={question.question}
                onChange={(e) => onUpdate({ question: e.target.value })}
                placeholder="Zadej otázku..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
              />
            </div>
          </div>

          {/* Options */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">
              Možnosti odpovědí
            </label>
            <div className="space-y-2">
              {question.options.map((option) => (
                <div key={option.id} className="flex items-center gap-2">
                  <button
                    onClick={() => setCorrectOption(option.id)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm transition-colors ${
                      option.isCorrect
                        ? 'bg-green-500 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {option.isCorrect ? <Check className="w-4 h-4" /> : option.label}
                  </button>
                  <input
                    type="text"
                    value={option.content}
                    onChange={(e) => updateOption(option.id, { content: e.target.value })}
                    placeholder={`Možnost ${option.label}...`}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Delete button */}
          <button
            onClick={onRemove}
            className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600"
          >
            <Trash2 className="w-4 h-4" />
            Smazat otázku
          </button>
        </div>
      )}
    </div>
  );
}

export function VideoQuizEditor({ slide, onUpdate }: VideoQuizEditorProps) {
  const [editingInstruction, setEditingInstruction] = useState(false);
  const [videoUrlInput, setVideoUrlInput] = useState(slide.videoUrl || '');
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  // Get video ID
  const videoId = extractYouTubeId(slide.videoUrl || '');

  // Save video URL
  const saveVideoUrl = () => {
    const id = extractYouTubeId(videoUrlInput);
    if (id) {
      onUpdate(slide.id, { videoUrl: videoUrlInput, videoId: id });
    }
  };

  // Add new question
  const addQuestion = () => {
    const newQuestion: VideoQuestion = {
      id: `question-${Date.now()}`,
      timestamp: 0,
      question: '',
      options: [
        { id: 'a', label: 'A', content: '', isCorrect: true },
        { id: 'b', label: 'B', content: '', isCorrect: false },
        { id: 'c', label: 'C', content: '', isCorrect: false },
        { id: 'd', label: 'D', content: '', isCorrect: false },
      ],
    };
    onUpdate(slide.id, { questions: [...slide.questions, newQuestion] });
    setExpandedQuestionId(newQuestion.id);
  };

  // Update question
  const updateQuestion = (questionId: string, updates: Partial<VideoQuestion>) => {
    const newQuestions = slide.questions.map(q =>
      q.id === questionId ? { ...q, ...updates } : q
    );
    onUpdate(slide.id, { questions: newQuestions });
  };

  // Remove question
  const removeQuestion = (questionId: string) => {
    onUpdate(slide.id, { 
      questions: slide.questions.filter(q => q.id !== questionId) 
    });
    if (expandedQuestionId === questionId) {
      setExpandedQuestionId(null);
    }
  };

  // Sort questions by timestamp
  const sortedQuestions = [...slide.questions].sort((a, b) => a.timestamp - b.timestamp);

  // Get background color and contrast color for text
  const bgColor = (slide as any).slideBackground?.color || '#ffffff';
  const textColor = getContrastColor(bgColor);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: bgColor, color: textColor }}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center gap-2 text-sm mb-1" style={{ opacity: 0.7 }}>
          <Film className="w-4 h-4" />
          <span>Video kvíz</span>
        </div>
        <h2 className="font-bold text-lg">Otázky ve videu</h2>
      </div>

      {/* Instruction */}
      <div className="p-4 border-b border-slate-100">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Instrukce
        </label>
        {editingInstruction ? (
          <input
            type="text"
            value={slide.instruction || ''}
            onChange={(e) => onUpdate(slide.id, { instruction: e.target.value })}
            onBlur={() => setEditingInstruction(false)}
            autoFocus
            placeholder="Sleduj video a odpovídej na otázky..."
            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-red-500 outline-none"
          />
        ) : (
          <div
            onClick={() => setEditingInstruction(true)}
            className="px-4 py-2 rounded-xl border border-slate-200 hover:border-red-300 cursor-text"
          >
            {slide.instruction || <span className="text-slate-400">Klikni pro zadání instrukce...</span>}
          </div>
        )}
      </div>

      {/* Video URL */}
      <div className="p-4 border-b border-slate-100">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          YouTube video
        </label>
        
        {videoId ? (
          <div className="space-y-3">
            {/* Video preview */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${videoId}`}
                title="Video preview"
                className="w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <button
              onClick={() => onUpdate(slide.id, { videoUrl: '', videoId: '' })}
              className="text-sm text-red-500 hover:text-red-600"
            >
              Změnit video
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={videoUrlInput}
              onChange={(e) => setVideoUrlInput(e.target.value)}
              placeholder="Vlož YouTube URL..."
              className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-sm"
            />
            <button
              onClick={saveVideoUrl}
              disabled={!extractYouTubeId(videoUrlInput)}
              className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              Přidat
            </button>
          </div>
        )}
      </div>

      {/* Questions */}
      {videoId && (
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <label className="text-sm font-medium text-slate-700">
              Otázky v průběhu videa ({slide.questions.length})
            </label>
          </div>

          <div className="space-y-2">
            {sortedQuestions.map((question, index) => (
              <QuestionEditor
                key={question.id}
                question={question}
                index={index}
                onUpdate={(updates) => updateQuestion(question.id, updates)}
                onRemove={() => removeQuestion(question.id)}
                isExpanded={expandedQuestionId === question.id}
                onToggle={() => setExpandedQuestionId(
                  expandedQuestionId === question.id ? null : question.id
                )}
              />
            ))}
          </div>

          {/* Add question button */}
          <button
            onClick={addQuestion}
            className="mt-4 w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Přidat otázku
          </button>
        </div>
      )}

      {/* Settings */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
          <Settings className="w-4 h-4" />
          Nastavení
        </div>

        <ToggleSwitch
          enabled={slide.countAsMultiple}
          onChange={(v) => onUpdate(slide.id, { countAsMultiple: v })}
          label="Počítat jako více otázek"
          description={slide.countAsMultiple 
            ? `Každá otázka = 1 bod (celkem ${slide.questions.length} bodů)` 
            : 'Celá aktivita = 1 bod'}
        />

        <ToggleSwitch
          enabled={slide.mustAnswerToProgress}
          onChange={(v) => onUpdate(slide.id, { mustAnswerToProgress: v })}
          label="Video se zastaví u otázky"
          description="Student musí odpovědět, než video pokračuje"
        />
      </div>

      {/* Preview hint */}
      <div className="px-4 pb-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Film className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h4 className="font-medium text-red-900">Video kvíz</h4>
              <p className="text-sm text-red-700 mt-1">
                Video se v nastavených časech automaticky zastaví a zobrazí otázku.
                Student musí odpovědět správně pro pokračování.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VideoQuizEditor;










