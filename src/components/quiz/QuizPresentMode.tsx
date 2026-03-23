/**
 * QuizPresentMode — "Prezentace bez studentů"
 *
 * Vypadá IDENTICKY jako QuizViewPage (stejné barvy, karty, šipky, progress bar).
 * Přidává pouze:
 *  - Klikání na odpovědi ABC → počítá hlasy (místo výběru odpovědi)
 *  - Pravý panel s živým grafem hlasů
 *  - "Vyhodnotit" + "Resetovat"
 *  - +1 animace při kliknutí
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  X,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  RotateCcw,
  Settings,
} from 'lucide-react';
import {
  Quiz,
  QuizSlide,
  ABCActivitySlide,
  OpenActivitySlide,
  ExampleActivitySlide,
  BoardActivitySlide,
  VotingActivitySlide,
  ConnectPairsActivitySlide,
  FillBlanksActivitySlide,
  ImageHotspotsActivitySlide,
  VideoQuizActivitySlide,
  InfoSlide,
  BoardPost,
} from '../../types/quiz';
import { getQuizAsync } from '../../utils/quiz-storage';
import { speakText, stopSpeech } from '../../utils/sounds';
import { ABCSlideView, VOTE_COLORS } from './slides/ABCSlideView';
import { InfoSlideView } from './slides/InfoSlideView';
import { OpenSlideView } from './slides/OpenSlideView';
import { TeacherExampleView } from './slides/TeacherExampleView';
import { BoardSlideView } from './slides/BoardSlideView';
import { VotingSlideView } from './slides/VotingSlideView';
import { ConnectPairsView } from './slides/ConnectPairsView';
import { FillBlanksView } from './slides/FillBlanksView';
import { ImageHotspotsView } from './slides/ImageHotspotsView';
import { VideoQuizView } from './slides/VideoQuizView';
import { FormView } from './slides/FormView';
import { CertificateView } from './slides/CertificateView';
import { PlusOneAnimation } from './PlusOneAnimation';
import { PresentationAnnotationsLayer } from '../../features/board-v2/annotations/PresentationAnnotationsLayer';
import { usePresentationAnnotations } from '../../features/board-v2/annotations/annotation-session-store';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlusOne {
  id: string;
  x: number;
  y: number;
  color: string;
}

// ─── SVG Pie chart (generic) ──────────────────────────────────────────────────

interface PieOption {
  id: string;
  label: string;
  name: string; // display name in legend
}

function PieChart({
  options,
  voteCounts,
  showSolution,
  correctIds,
}: {
  options: PieOption[];
  voteCounts: Record<string, number>;
  showSolution?: boolean;
  correctIds?: string[];
}) {
  const total = Object.values(voteCounts).reduce((a, b) => a + b, 0);
  const R = 96;
  const cx = 100;
  const cy = 100;

  const slices: { path: string; color: string; pct: number; label: string; name: string; count: number }[] = [];
  let startAngle = -Math.PI / 2;

  options.forEach((opt, idx) => {
    const count = voteCounts[opt.id] ?? 0;
    const fraction = total > 0 ? count / total : 1 / options.length;
    const endAngle = startAngle + fraction * 2 * Math.PI;
    const isCorrect = showSolution && correctIds?.includes(opt.id);
    const isWrongWithVotes = showSolution && !isCorrect && count > 0;
    const color = isCorrect ? '#4ade80' : isWrongWithVotes ? '#dc2626' : VOTE_COLORS[idx % VOTE_COLORS.length];

    const x1 = cx + R * Math.cos(startAngle);
    const y1 = cy + R * Math.sin(startAngle);
    const x2 = cx + R * Math.cos(endAngle);
    const y2 = cy + R * Math.sin(endAngle);
    const largeArc = fraction > 0.5 ? 1 : 0;

    const isFullCircle = fraction >= 0.9999;
    const path = isFullCircle
      ? `M ${cx - R} ${cy} a ${R} ${R} 0 1 1 ${R * 2} 0 a ${R} ${R} 0 1 1 -${R * 2} 0`
      : `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    slices.push({
      path, color,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
      label: opt.label,
      name: opt.name,
      count,
    });

    startAngle = endAngle;
  });

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <svg viewBox="0 0 200 200" className="w-full" style={{ maxWidth: 260 }}>
        {total === 0 ? (
          <circle cx={cx} cy={cy} r={R} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} />
        ) : (
          slices.map((s, i) => (
            <path
              key={i}
              d={s.path}
              fill={s.color}
              stroke="#1e2533"
              strokeWidth={1.5}
              style={{ transition: 'fill 0.3s ease' }}
            />
          ))
        )}
      </svg>
      <div className="flex flex-col gap-2 w-full">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="flex-shrink-0 w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="text-xs flex-1 truncate" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {s.label}: {s.name}
            </span>
            <span className="text-xs font-bold tabular-nums flex-shrink-0" style={{ color: s.color }}>
              {s.count} ({s.pct}%)
            </span>
          </div>
        ))}
        <p className="text-xs text-center mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Celkem: <strong style={{ color: 'rgba(255,255,255,0.6)' }}>{total}</strong>
        </p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function QuizPresentMode() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [prevIndex, setPrevIndex] = useState(0);

  // Per-slide vote state: { [slideId]: { [optionId]: count } }
  const [allVotes, setAllVotes] = useState<Record<string, Record<string, number>>>({});
  // Per-slide solution revealed state
  const [solutionShown, setSolutionShown] = useState<Record<string, boolean>>({});
  // Local board posts: { [slideId]: BoardPost[] }
  const [boardPosts, setBoardPosts] = useState<Record<string, BoardPost[]>>({});

  // "+1" animations queue
  const [plusOnes, setPlusOnes] = useState<PlusOne[]>([]);

  // Right panel
  const [showRightPanel, setShowRightPanel] = useState(true);
  const annotations = usePresentationAnnotations();
  const annotationDockHeight = annotations.toolbarOpen ? 60 : 0;

  // ── Load quiz ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    getQuizAsync(id).then((q) => {
      setQuiz(q);
      setLoading(false);
    });
  }, [id]);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const goNext = useCallback(() => {
    if (!quiz || isAnimating) return;
    if (currentIndex >= quiz.slides.length - 1) return;
    setIsAnimating(true);
    setPrevIndex(currentIndex);
    setCurrentIndex((i) => i + 1);
    setTimeout(() => setIsAnimating(false), 400);
  }, [quiz, currentIndex, isAnimating]);

  const goPrev = useCallback(() => {
    if (!quiz || isAnimating) return;
    if (currentIndex <= 0) return;
    setIsAnimating(true);
    setPrevIndex(currentIndex);
    setCurrentIndex((i) => i - 1);
    setTimeout(() => setIsAnimating(false), 400);
  }, [quiz, currentIndex, isAnimating]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') goNext();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') goPrev();
      if (e.key === 'Escape') navigate(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, navigate]);

  // ── TTS autoplay — fires when slide changes ────────────────────────────────
  useEffect(() => {
    if (!quiz) return;
    const slide = quiz.slides[currentIndex];
    if (!slide || slide.type !== 'info' || !slide.layout) return;

    // Collect blocks with ttsAutoplay enabled
    const autoBlocks = slide.layout.blocks.filter((b: any) => b.ttsEnabled && b.ttsAutoplay);
    if (autoBlocks.length === 0) return;

    // Stop any previous speech first, then speak the first autoplay block
    stopSpeech();
    const block = autoBlocks[0];
    const text = block.ttsText || block.content || '';
    const lang = block.ttsLang || 'cs-CZ';

    // Small delay so the slide transition animation finishes first
    const timer = setTimeout(() => { speakText(text, lang).catch(console.error); }, 500);
    return () => {
      clearTimeout(timer);
      stopSpeech();
    };
  }, [quiz, currentIndex]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleOptionClick(optionId: string) {
    if (!quiz) return;
    const slide = quiz.slides[currentIndex];
    if (solutionShown[slide.id]) return;

    setAllVotes((prev) => {
      const cur = prev[slide.id] ?? {};
      return { ...prev, [slide.id]: { ...cur, [optionId]: (cur[optionId] ?? 0) + 1 } };
    });
  }

  function handleReveal() {
    if (!quiz) return;
    const slideId = quiz.slides[currentIndex].id;
    setSolutionShown((prev) => ({ ...prev, [slideId]: true }));
  }

  function handleReset() {
    if (!quiz) return;
    const slideId = quiz.slides[currentIndex].id;
    setAllVotes((prev) => ({ ...prev, [slideId]: {} }));
    setSolutionShown((prev) => ({ ...prev, [slideId]: false }));
  }

  // ── Render slide ───────────────────────────────────────────────────────────
  function renderSlide(slide: QuizSlide): React.ReactNode {
    switch (slide.type) {
      case 'info':
        return <InfoSlideView slide={slide as InfoSlide} />;
      case 'activity': {
        const activityType = (slide as any).activityType;
        switch (activityType) {
          case 'abc': {
            const abcSlide = slide as ABCActivitySlide;
            const slideVotes = allVotes[slide.id] ?? {};
            const isSolutionShown = !!solutionShown[slide.id];
            return (
              <div
                className="w-full h-full"
                onClick={(e) => {
                  if (isSolutionShown) return;
                  // Find which option button was clicked to get its color
                  const btn = (e.target as HTMLElement).closest('button');
                  let color = VOTE_COLORS[0];
                  if (btn) {
                    const allBtns = (e.currentTarget as HTMLElement).querySelectorAll('button');
                    const idx = Array.from(allBtns).indexOf(btn as HTMLButtonElement);
                    if (idx >= 0) color = VOTE_COLORS[idx % VOTE_COLORS.length];
                  }
                  const key = crypto.randomUUID();
                  setPlusOnes((prev) => [...prev, { id: key, x: e.clientX, y: e.clientY, color }]);
                }}
              >
                <ABCSlideView
                  slide={abcSlide}
                  showHint={false}
                  showSolution={isSolutionShown}
                  selectedAnswer={undefined}
                  onSelectAnswer={(optionId) => handleOptionClick(optionId)}
                  voteCounts={slideVotes}
                />
              </div>
            );
          }
          case 'open':
            return <OpenSlideView slide={slide as OpenActivitySlide} />;
          case 'example':
            return (
              <TeacherExampleView
                slide={slide as ExampleActivitySlide}
                customKeys={quiz?.settings?.customKeys}
                extraKeys={quiz?.settings?.extraKeys}
              />
            );
          case 'board': {
            const boardSlide = slide as BoardActivitySlide;
            const posts = boardPosts[slide.id] ?? [];
            return (
              <BoardSlideView
                slide={boardSlide}
                posts={posts}
                isTeacher={true}
                currentUserId="teacher"
                currentUserName="Učitel"
                readOnly={false}
                presentMode={true}
                onAddPost={(text, mediaUrl, mediaType, backgroundColor, column) => {
                  const newPost: BoardPost = {
                    id: crypto.randomUUID(),
                    text,
                    mediaUrl,
                    mediaType,
                    authorName: 'Učitel',
                    authorId: 'teacher',
                    likes: [],
                    createdAt: Date.now(),
                    ...(backgroundColor ? { backgroundColor } : {}),
                    ...(column ? { column } : {}),
                  } as BoardPost;
                  setBoardPosts((prev) => ({
                    ...prev,
                    [slide.id]: [...(prev[slide.id] ?? []), newPost],
                  }));
                }}
                onDeletePost={(postId) => {
                  setBoardPosts((prev) => ({
                    ...prev,
                    [slide.id]: (prev[slide.id] ?? []).filter((p) => p.id !== postId),
                  }));
                }}
                onLikePost={(postId) => {
                  setBoardPosts((prev) => {
                    const cur = prev[slide.id] ?? [];
                    return {
                      ...prev,
                      [slide.id]: cur.map((p) =>
                        p.id === postId
                          ? { ...p, likes: p.likes.includes('teacher') ? p.likes.filter((l) => l !== 'teacher') : [...p.likes, 'teacher'] }
                          : p
                      ),
                    };
                  });
                }}
              />
            );
          }
          case 'voting': {
            const votingSlide = slide as VotingActivitySlide;
            const slideVotes = allVotes[slide.id] ?? {};
            const total = Object.values(slideVotes).reduce((a, b) => a + b, 0);
            return (
              <div
                className="w-full h-full"
                onClick={(e) => {
                  const btn = (e.target as HTMLElement).closest('button');
                  let color = VOTE_COLORS[0];
                  if (btn) {
                    const allBtns = (e.currentTarget as HTMLElement).querySelectorAll('button');
                    const idx = Array.from(allBtns).indexOf(btn as HTMLButtonElement);
                    if (idx >= 0) color = VOTE_COLORS[idx % VOTE_COLORS.length];
                  }
                  const key = crypto.randomUUID();
                  setPlusOnes((prev) => [...prev, { id: key, x: e.clientX, y: e.clientY, color }]);
                }}
              >
                <VotingSlideView
                  slide={votingSlide}
                  presentMode={true}
                  voteCounts={slideVotes}
                  totalVoters={total}
                  onVote={(optionIds) => {
                    const optionId = optionIds[0];
                    if (!optionId) return;
                    setAllVotes((prev) => {
                      const cur = prev[slide.id] ?? {};
                      return { ...prev, [slide.id]: { ...cur, [optionId]: (cur[optionId] ?? 0) + 1 } };
                    });
                  }}
                />
              </div>
            );
          }
          case 'connect-pairs':
            return <ConnectPairsView slide={slide as ConnectPairsActivitySlide} isTeacher readOnly />;
          case 'fill-blanks':
            return <FillBlanksView slide={slide as FillBlanksActivitySlide} isTeacher readOnly />;
          case 'image-hotspots':
            return <ImageHotspotsView slide={slide as ImageHotspotsActivitySlide} isTeacher readOnly />;
          case 'video-quiz':
            return <VideoQuizView slide={slide as VideoQuizActivitySlide} isTeacher readOnly />;
          case 'form':
            return <FormView slide={slide as any} isReadOnly={true} />;
          default:
            return <div className="flex items-center justify-center h-full text-slate-400">Nepodporovaný typ aktivity</div>;
        }
      }
      case 'tools': {
        const toolsSlide = slide as any;
        switch (toolsSlide.toolType) {
          case 'certificate':
            return <CertificateView slide={toolsSlide} quiz={quiz} isPreview={true} />;
          default:
            return <div className="flex items-center justify-center h-full text-slate-400">Nepodporovaný typ nástroje</div>;
        }
      }
      default:
        return <div className="flex items-center justify-center h-full text-slate-400">Nepodporovaný typ slidu</div>;
    }
  }

  // ── Loading / empty ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: '#F0F1F8' }}>
        <p className="text-slate-500 text-xl">Načítám prezentaci…</p>
      </div>
    );
  }

  if (!quiz || quiz.slides.length === 0) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4" style={{ backgroundColor: '#F0F1F8' }}>
        <p className="text-slate-600 text-xl">Prezentace nenalezena nebo je prázdná.</p>
        <button className="px-6 py-2 rounded-xl bg-indigo-600 text-white" onClick={() => navigate(-1)}>Zpět</button>
      </div>
    );
  }

  const slide = quiz.slides[currentIndex];
  const actType = (slide as any).activityType;
  const isABC = slide.type === 'activity' && actType === 'abc';
  const isVoting = slide.type === 'activity' && actType === 'voting';
  const isInteractive = isABC || isVoting;
  const abcSlide = isABC ? (slide as ABCActivitySlide) : null;
  const votingSlide = isVoting ? (slide as VotingActivitySlide) : null;
  const slideVotes = allVotes[slide.id] ?? {};
  const isSolutionShown = !!solutionShown[slide.id];
  const totalVotes = Object.values(slideVotes).reduce((a, b) => a + b, 0);
  const slideBackground = (slide as any).backgroundColor || '#ffffff';

  // Build generic PieChart options from current slide
  const pieOptions: { id: string; label: string; name: string }[] = isABC
    ? abcSlide!.options.map((o, i) => ({
        id: o.id,
        label: o.label || String.fromCharCode(65 + i),
        name: (o as any).textContent || o.content || '',
      }))
    : isVoting
    ? votingSlide!.options.map((o, i) => ({
        id: o.id,
        label: o.emoji || o.label || String.fromCharCode(65 + i),
        name: o.content || o.label || '',
      }))
    : [];

  const correctIds = isABC ? abcSlide!.options.filter((o) => o.isCorrect).map((o) => o.id) : [];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden relative" style={{ backgroundColor: '#F0F1F8' }}>

      {/* ── Left control column ── */}
      <div className="flex flex-col items-center flex-shrink-0 h-full relative" style={{ width: 64, paddingTop: 20, gap: 0 }}>
        {/* Close button */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.8)', color: '#64748b' }}
            title="Zavřít (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Left arrow — absolutely centered */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ease-out ${currentIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:h-28'} bg-[#CBD5E1] text-slate-600`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Main content area ── */}
      <div
        className="flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-out"
        style={{ minHeight: 0, paddingBottom: annotationDockHeight }}
      >

        {/* Progress bar dots */}
        <div
          className="flex items-end justify-center flex-shrink-0 transition-all duration-300 ease-out overflow-hidden"
          style={{
            height: annotations.toolbarOpen ? 0 : 40,
            paddingBottom: annotations.toolbarOpen ? 0 : 8,
            opacity: annotations.toolbarOpen ? 0 : 1,
          }}
        >
          <div className="w-1/2 max-w-xl flex items-center gap-1.5">
            {quiz.slides.map((_, idx) => (
              <div
                key={idx}
                onClick={() => {
                  if (!isAnimating) {
                    setIsAnimating(true);
                    setPrevIndex(currentIndex);
                    setCurrentIndex(idx);
                    setTimeout(() => setIsAnimating(false), 400);
                  }
                }}
                className="flex-1 rounded-full cursor-pointer hover:opacity-80"
                style={{
                  height: 8,
                  backgroundColor: idx === currentIndex ? '#7C3AED' : '#CBD5E1',
                  transition: 'background-color 0.3s',
                }}
              />
            ))}
          </div>
        </div>

        {/* Slide card + right arrow row */}
        <div
          className="flex-1 flex items-stretch overflow-hidden transition-all duration-300 ease-out"
          style={{ minHeight: 0, paddingBottom: 5 }}
        >

          {/* Slide card */}
          <div className="flex-1" style={{ minHeight: 0, padding: 16 }}>
            <div
              key={currentIndex}
              data-annotation-capture-slide-id={slide.id}
              className={`
                w-full h-full rounded-3xl shadow-md overflow-hidden flex flex-col relative
                ${slide.type !== 'info' ? 'max-w-5xl mx-auto' : ''}
                ${currentIndex > prevIndex && isAnimating ? 'animate-slide-in' : ''}
                ${currentIndex < prevIndex && isAnimating ? 'animate-slide-in-left' : ''}
              `}
              style={{ backgroundColor: slideBackground, height: '100%' }}
            >
              <div
                className="flex-1 flex flex-col"
                style={{
                  minHeight: 0,
                  pointerEvents: annotations.toolbarOpen ? 'none' : 'auto',
                  userSelect: annotations.toolbarOpen ? 'none' : 'auto',
                }}
              >
                {renderSlide(slide)}
              </div>
              <PresentationAnnotationsLayer slideId={slide.id} controller={annotations} renderToolbar={false} />
            </div>
          </div>

          {/* Right arrow */}
          <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 65 }}>
            <button
              onClick={goNext}
              disabled={currentIndex === quiz.slides.length - 1}
              className={`
                w-12 h-12 rounded-full flex items-center justify-center text-white
                transition-all duration-300 ease-out
                ${currentIndex === quiz.slides.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:h-28'}
              `}
              style={{ backgroundColor: '#7C3AED', transitionProperty: 'height, background-color' }}
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <PresentationAnnotationsLayer
        slideId={slide.id}
        controller={annotations}
        renderCanvas={false}
        toolbarPlacement="screen-corner"
        toolbarRightOffset={showRightPanel ? 336 : 18}
      />

      {/* ── Right panel toggle button ── */}
      <div className="flex-shrink-0 relative" style={{ width: 0 }}>
        <button
          onClick={() => setShowRightPanel((v) => !v)}
          className="absolute w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-lg"
          style={{ top: 20, right: 20, backgroundColor: '#1e2533', color: 'rgba(255,255,255,0.7)' }}
          title={showRightPanel ? 'Zavřít panel' : 'Otevřít panel'}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* ── Right panel ── */}
      <div
        className={`flex text-white flex-col transition-all duration-300 ease-out overflow-hidden`}
        style={{ backgroundColor: '#1e2533', width: showRightPanel ? 320 : 0 }}
      >
        {showRightPanel && (
          <div className="flex flex-col h-full p-5 gap-5 overflow-y-auto" style={{ width: 320 }}>
            <h2 className="text-white font-semibold text-base">Prezentace bez studentů</h2>

            {isInteractive ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Výsledky hlasování
                </p>

                {totalVotes === 0 ? (
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    Klikejte na odpovědi pro přidávání hlasů žáků.
                  </p>
                ) : (
                  <PieChart
                    options={pieOptions}
                    voteCounts={slideVotes}
                    showSolution={isABC ? isSolutionShown : false}
                    correctIds={correctIds}
                  />
                )}

                <div className="flex flex-col gap-2 mt-auto">
                  {/* Vyhodnotit — only for ABC */}
                  {isABC && (!isSolutionShown ? (
                    <button
                      onClick={handleReveal}
                      disabled={totalVotes === 0}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ backgroundColor: '#7C3AED', color: '#fff' }}
                    >
                      <CheckCircle className="w-4 h-4" />
                      Vyhodnotit
                    </button>
                  ) : (
                    <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: 'rgba(16,185,129,0.2)', color: '#10b981' }}>
                      <CheckCircle className="w-4 h-4" />
                      Vyhodnoceno
                    </div>
                  ))}

                  <button
                    onClick={handleReset}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-colors"
                    style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
                  >
                    <RotateCcw className="w-4 h-4" />
                    Resetovat hlasy
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Tento typ slidu není interaktivní. Přejděte na ABC otázku nebo hlasování.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── +1 animations ── */}
      {plusOnes.map((p) => (
        <PlusOneAnimation key={p.id} x={p.x} y={p.y} color={p.color} onDone={() => setPlusOnes((prev) => prev.filter((x) => x.id !== p.id))} />
      ))}
    </div>
  );
}

