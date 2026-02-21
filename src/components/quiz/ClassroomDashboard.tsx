import React, { useMemo, useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

type SortMode = 'none' | 'fastest' | 'best' | 'distracted';

interface StudentData {
  studentId: string;
  studentName: string;
  currentSlide: number;
  isOnline: boolean;
  isFocused?: boolean;
  lastActiveAt?: string;
  completedAt?: string;
  responses: Record<string, {
    slideId: string;
    isCorrect?: boolean;
    answer?: string | string[];
  }>;
}

interface ClassroomDashboardProps {
  students: Record<string, StudentData>;
  quiz: {
    slides: { id: string; type: string; activityType?: string }[];
    title: string;
  };
  sessionCode: string;
  shareLink: string;
  onEnd: () => void;
}

export default function ClassroomDashboard({ students, quiz, sessionCode, shareLink, onEnd }: ClassroomDashboardProps) {
  const [sortMode, setSortMode] = useState<SortMode>('none');
  const [copied, setCopied] = useState(false);
  
  const totalSlides = quiz.slides.length;
  const activitySlides = quiz.slides.filter(s => s.type === 'activity');

  const studentEntries = useMemo(() => {
    const entries = Object.entries(students);
    
    switch (sortMode) {
      case 'fastest': {
        // Sort by progress (most slides completed first), then by completedAt time
        return entries.sort((a, b) => {
          const aCompleted = a[1].completedAt ? 1 : 0;
          const bCompleted = b[1].completedAt ? 1 : 0;
          if (aCompleted !== bCompleted) return bCompleted - aCompleted;
          if (a[1].completedAt && b[1].completedAt) return a[1].completedAt.localeCompare(b[1].completedAt);
          return (b[1].currentSlide || 0) - (a[1].currentSlide || 0);
        });
      }
      case 'best': {
        // Sort by correct answers count
        return entries.sort((a, b) => {
          const aCorrect = Object.values(a[1].responses || {}).filter(r => r.isCorrect === true).length;
          const bCorrect = Object.values(b[1].responses || {}).filter(r => r.isCorrect === true).length;
          return bCorrect - aCorrect;
        });
      }
      case 'distracted': {
        // Distracted first, then offline, then active
        return entries.sort((a, b) => {
          const aDistracted = a[1].isOnline && a[1].isFocused === false ? 0 : a[1].isOnline ? 2 : 1;
          const bDistracted = b[1].isOnline && b[1].isFocused === false ? 0 : b[1].isOnline ? 2 : 1;
          return aDistracted - bDistracted;
        });
      }
      default: {
        // Online first, then by name
        return entries.sort((a, b) => {
          if (a[1].isOnline !== b[1].isOnline) return a[1].isOnline ? -1 : 1;
          return (a[1].studentName || '').localeCompare(b[1].studentName || '');
        });
      }
    }
  }, [students, sortMode]);

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sortOptions: { value: SortMode; label: string }[] = [
    { value: 'none', label: 'Neřadit' },
    { value: 'fastest', label: 'Nejrychlejší' },
    { value: 'best', label: 'Nejúspěšnější' },
    { value: 'distracted', label: 'Kouká jinam' },
  ];

  // If no students yet, show a big join screen
  if (studentEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8" style={{ backgroundColor: '#0f172a' }}>
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Čekání na studenty...</h1>
          <p className="text-slate-400 text-lg">Studenti se mohou připojit QR kódem nebo odkazem</p>
        </div>
        
        <div className="flex flex-col items-center gap-6 mb-6">
          <div className="bg-white p-4 rounded-2xl shadow-xl">
            <QRCodeSVG value={shareLink} size={Math.min(320, window.innerWidth * 0.4)} level="M" />
          </div>
          
          <button
            onClick={copyLink}
            className="py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 text-base font-medium hover:opacity-90"
            style={{ backgroundColor: '#f59e0b', color: '#1e293b' }}
          >
            {copied ? (
              <>
                <CheckCircle className="w-5 h-5" />
                <span>Zkopírováno!</span>
              </>
            ) : (
              <>
                <Copy className="w-5 h-5" />
                <span>Kopírovat odkaz pro studenty</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#0f172a' }}>
      {/* Top bar — close button + centered title */}
      <div className="flex items-center px-4 py-3 border-b border-white/10" style={{ minHeight: 52 }}>
        <button
          onClick={onEnd}
          className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
        <h1 className="flex-1 text-center text-white font-semibold text-base">
          Přehled studentů a výsledků
        </h1>
        {/* Invisible spacer to balance the X button */}
        <div className="w-9 flex-shrink-0" />
      </div>
      
      {/* Sort filter row */}
      <div className="flex items-center justify-center gap-1.5 px-4 py-2 border-b border-white/5">
        {sortOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => setSortMode(opt.value)}
            className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
            style={{
              backgroundColor: sortMode === opt.value ? 'rgba(139,92,246,0.25)' : 'transparent',
              color: sortMode === opt.value ? '#c4b5fd' : '#94a3b8',
              border: sortMode === opt.value ? '1px solid rgba(139,92,246,0.4)' : '1px solid transparent',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
      
      {/* Student grid */}
      <div
        className="flex-1 overflow-auto p-4"
        style={{ minHeight: 0 }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12,
          }}
        >
          {studentEntries.map(([id, student]) => (
            <StudentCard
              key={id}
              student={student}
              totalSlides={totalSlides}
              activitySlides={activitySlides}
              quizSlides={quiz.slides}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Individual student card
function StudentCard({ student, totalSlides, activitySlides, quizSlides }: {
  student: StudentData;
  totalSlides: number;
  activitySlides: { id: string; type: string }[];
  quizSlides: { id: string; type: string; activityType?: string }[];
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState(200);
  
  useEffect(() => {
    if (!cardRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setCardWidth(e.contentRect.width);
    });
    ro.observe(cardRef.current);
    return () => ro.disconnect();
  }, []);
  
  const progress = totalSlides > 0 ? (student.currentSlide + 1) / totalSlides : 0;
  const isCompleted = !!student.completedAt;
  const isDistracted = student.isOnline && student.isFocused === false;
  const isOffline = !student.isOnline;

  // Count answers
  const responses = student.responses || {};
  const answeredCount = Object.keys(responses).length;
  const correctCount = Object.values(responses).filter(r => r.isCorrect === true).length;
  const wrongCount = Object.values(responses).filter(r => r.isCorrect === false).length;

  // Status color
  const statusColor = isCompleted
    ? '#3b82f6'
    : isOffline
    ? '#475569'
    : isDistracted
    ? '#f59e0b'
    : '#10b981';

  const statusLabel = isCompleted
    ? 'Hotovo'
    : isOffline
    ? 'Offline'
    : isDistracted
    ? 'Rozptýlen/a'
    : 'Aktivní';

  return (
    <div
      ref={cardRef}
      className="relative rounded-xl p-3 transition-all"
      style={{
        backgroundColor: isCompleted ? 'rgba(59,130,246,0.1)' : isDistracted ? 'rgba(245,158,11,0.15)' : isOffline ? 'rgba(71,85,105,0.2)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${isDistracted ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.08)'}`,
        opacity: isOffline ? 0.6 : 1,
      }}
    >
      {/* Distracted banner */}
      {isDistracted && (
        <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded-md" style={{ backgroundColor: 'rgba(245,158,11,0.2)' }}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#f59e0b' }} />
          <span className="text-xs font-medium" style={{ color: '#fbbf24' }}>Kouká jinam</span>
        </div>
      )}
      
      {/* Top row: name + status */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-white truncate mr-2" style={{ maxWidth: '80%' }}>
          {student.studentName || 'Student'}
        </span>
        {!isDistracted && (
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: statusColor }}
            title={statusLabel}
          />
        )}
      </div>
      
      {/* Progress bar */}
      <div className="w-full h-1.5 rounded-full mb-2" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(progress * 100, 100)}%`,
            backgroundColor: isCompleted ? '#3b82f6' : '#8b5cf6',
          }}
        />
      </div>
      
      {/* Bottom row: slide position + correct count */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {isCompleted ? (
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-blue-400" />
              Dokončeno
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {student.currentSlide + 1}/{totalSlides}
            </span>
          )}
        </span>
        
      </div>
      
      {/* Slide dot indicators */}
      {activitySlides.length > 0 && activitySlides.length <= 20 && (() => {
        const gap = 3;
        const count = activitySlides.length;
        const available = cardWidth - 24;
        const rawSize = count > 0 ? (available - gap * (count - 1)) / count : 9;
        const dotSize = Math.min(Math.max(Math.floor(rawSize), 4), 10);
        return (
          <div className="flex mt-2" style={{ gap }}>
            {activitySlides.map((slide, i) => {
              const response = responses[slide.id];
              const dotColor = response
                ? response.isCorrect === true
                  ? '#10b981'
                  : response.isCorrect === false
                  ? '#ef4444'
                  : '#8b5cf6'
                : 'rgba(255,255,255,0.15)';
              return (
                <div
                  key={slide.id}
                  className="rounded-full flex-shrink-0"
                  style={{
                    width: dotSize,
                    height: dotSize,
                    backgroundColor: dotColor,
                  }}
                  title={`Slide ${i + 1}: ${response ? (response.isCorrect ? 'Správně' : response.isCorrect === false ? 'Špatně' : 'Odpovězeno') : 'Neodpovězeno'}`}
                />
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
