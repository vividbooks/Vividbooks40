import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ref, update } from 'firebase/database';
import { database } from '../../utils/firebase-config';
import { QRCodeSVG } from 'qrcode.react';
import Lottie from 'lottie-react';
import { Copy, CheckCircle, Users, Play, SkipForward, X, ArrowRight, ArrowLeft } from 'lucide-react';
import { Quiz, LiveQuizSession, CompetitionPhase, QuizSlide, TreasureType } from '../../types/quiz';

// Supabase storage — competition_files bucket (same as CompetitionView)
const SB = 'https://njbtqmsxbyvpwigfceke.supabase.co/storage/v1/object/public/competition_files';

const ASSETS = {
  fight: `${SB}/animace/fight.json`,
  countdown: `${SB}/animace/321.json`,
  celebrate: `${SB}/animace/celebrate.json`,
  final: `${SB}/animace/final.json`,
  rank: (n: number) => `${SB}/animace/rank_${n}.json`,
  lobbyMusic: `${SB}/mp3/QR_code_02.mp3`,
  countdownMusic: `${SB}/mp3/3-2-1-start_06.mp3`,
  gameMusic: [`${SB}/mp3/Game_0.mp3`, `${SB}/mp3/Game_1.mp3`, `${SB}/mp3/Game_2.mp3`],
  evaluationMusic: `${SB}/mp3/Vysledky_Napeti_01.mp3`,
  evaluationRevealMusic: `${SB}/mp3/Vysledky_Vyhral.mp3`,
  resultsMusic: `${SB}/mp3/Vysledky_Vyhodnoceni_01.mp3`,
};

const QUIZ_SESSIONS_PATH = 'quiz_sessions';
const DEFAULT_TIMER = 45;

// Scorable activity types — same as CompetitionView
const SCORABLE_TYPES = new Set(['abc', 'open', 'example', 'trueFalse']);

function isScorableSlide(slide: QuizSlide): boolean {
  return slide.type === 'activity' && SCORABLE_TYPES.has((slide as any).activityType);
}

const ALL_TREASURES: TreasureType[] = ['double', 'sabotage', 'block', 'shield', 'xray', 'timeBoost'];

const TREASURE_INFO: Record<TreasureType, { emoji: string; label: string }> = {
  double: { emoji: '💰', label: 'Dvojnásobek' },
  sabotage: { emoji: '💣', label: 'Sabotáž' },
  block: { emoji: '🚫', label: 'Blokáda' },
  shield: { emoji: '🛡️', label: 'Štít' },
  xray: { emoji: '👁️', label: 'Rentgen' },
  timeBoost: { emoji: '⏰', label: 'Čas+' },
};

// Lottie loader with error handling (same as CompetitionView)
function LottieAnimation({ url, loop = true, autoplay = true, className = '', style }: {
  url: string; loop?: boolean; autoplay?: boolean; className?: string; style?: React.CSSProperties;
}) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    setData(null); setError(false);
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(json => { if (json && (json.layers || json.assets)) setData(json); else setError(true); })
      .catch(() => setError(true));
  }, [url]);
  if (error) return <div className={`flex items-center justify-center ${className}`} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, ...style }}>Animace se nenačetla</div>;
  if (!data) return null;
  return <Lottie animationData={data} loop={loop} autoplay={autoplay} className={className} style={style} />;
}

// Audio hook (same as CompetitionView)
function useAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stop = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; audioRef.current = null; }
  }, []);
  const play = useCallback((url: string, loop = false) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; audioRef.current = null; }
    try { const a = new Audio(url); a.loop = loop; a.volume = 0.5; a.play().catch(() => {}); audioRef.current = a; } catch {}
  }, []);
  useEffect(() => () => stop(), [stop]);
  return { play, stop };
}

// ============================================================
// MAIN COMPONENT
// ============================================================

interface TacticalCompetitionViewProps {
  session: LiveQuizSession;
  sessionId: string;
  quiz: Quiz;
  sessionCode: string;
  onEnd: () => void;
  renderSlide: (slide: QuizSlide) => React.ReactNode;
}

export default function TacticalCompetitionView({ session, sessionId, quiz, sessionCode, onEnd, renderSlide }: TacticalCompetitionViewProps) {
  const phase = (session.competitionPhase || 'lobby') as CompetitionPhase;
  const tData = session.tacticalCompetitionData;
  const students = session.students || {};
  const studentEntries = Object.entries(students);
  const onlineCount = studentEntries.filter(([, s]) => s.isOnline).length;

  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIMER);
  const [showQRPopup, setShowQRPopup] = useState<'qr' | 'code' | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audio = useAudio();

  // Current slide from session (same as CompetitionView — navigates ALL slides)
  const currentSlideIndex = session.currentSlideIndex || 0;
  const currentSlide = quiz.slides[currentSlideIndex];
  const totalSlides = quiz.slides.length;
  const isScorable = currentSlide ? isScorableSlide(currentSlide) : false;

  // Count scorable slides for display
  const scorableSlides = useMemo(() => quiz.slides.filter(isScorableSlide), [quiz.slides]);
  const currentScorableIdx = currentSlide ? scorableSlides.findIndex(s => s.id === currentSlide.id) : -1;

  // Power round: every 3rd scorable question
  const isPowerRound = tData?.isPowerRound || false;
  const basePoints = isPowerRound ? 6 : 3;

  // Leaderboard sorted by score
  const leaderboard = useMemo(() => {
    const scores = tData?.scores || {};
    return studentEntries
      .map(([id, s]) => ({
        id,
        name: s.name,
        score: scores[id] || 0,
        streak: tData?.streaks?.[id] || 0,
        isOnline: s.isOnline,
      }))
      .sort((a, b) => b.score - a.score);
  }, [studentEntries, tData?.scores, tData?.streaks]);

  const joinLink = `${window.location.origin}${import.meta.env.BASE_URL || '/'}go/${sessionCode}`;

  // Pending choice count
  const pendingChoiceCount = useMemo(() => {
    if (!tData?.choices) return 0;
    return Object.values(tData.choices).filter(c => c === 'pending').length;
  }, [tData?.choices]);

  // Firebase helpers
  const updateSession = useCallback((data: Record<string, any>) => {
    update(ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}`), data);
  }, [sessionId]);

  const shouldBePowerRound = (questionIndex: number): boolean => {
    return questionIndex > 0 && questionIndex % 3 === 0;
  };

  const generateTreasureOptions = (): TreasureType[] => {
    const shuffled = [...ALL_TREASURES].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  };

  // Phase transitions (same pattern as CompetitionView)
  const goToEvaluation = useCallback(() => {
    updateSession({
      competitionPhase: 'evaluation',
      tacticalCompetitionData: {
        ...(tData || { scores: {}, streaks: {}, powerUps: {}, blockedPlayers: {}, choices: {}, treasureOffers: {}, choicePhaseActive: false, events: [], isPowerRound: false, timerDuration: DEFAULT_TIMER, timerPaused: false, evaluated: false, questionSlideIds: scorableSlides.map(s => s.id), currentQuestionIndex: 0, questionsPlayed: 0 }),
        timerStartedAt: null,
        timerPaused: false,
        evaluated: false,
        choicePhaseActive: false,
      },
    });
  }, [tData, scorableSlides, updateSession]);

  // Timer logic (same as CompetitionView)
  useEffect(() => {
    if (phase !== 'question' || !isScorable || !tData?.timerStartedAt || tData?.timerPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const tick = () => {
      const elapsed = (Date.now() - new Date(tData.timerStartedAt!).getTime()) / 1000;
      const remaining = Math.max(0, (tData.timerDuration || DEFAULT_TIMER) - elapsed);
      setTimeLeft(Math.ceil(remaining));
      if (remaining <= 0) { if (timerRef.current) clearInterval(timerRef.current); goToEvaluation(); }
    };
    tick();
    timerRef.current = setInterval(tick, 200);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, isScorable, tData?.timerStartedAt, tData?.timerPaused, tData?.timerDuration, goToEvaluation]);

  // No automatic choice timer — teacher controls when to move on

  // Audio per phase (same as CompetitionView)
  useEffect(() => {
    if (phase === 'lobby') audio.play(ASSETS.lobbyMusic, true);
    else if (phase === 'countdown') audio.play(ASSETS.countdownMusic);
    else if (phase === 'question' && isScorable) {
      const track = ASSETS.gameMusic[Math.floor(Math.random() * ASSETS.gameMusic.length)];
      audio.play(track, true);
    } else if (phase === 'question' && !isScorable) audio.stop();
    else if (phase === 'evaluation') audio.play(ASSETS.evaluationMusic, true);
    else if (phase === 'results') audio.play(ASSETS.resultsMusic, true);
    return () => audio.stop();
  }, [phase, isScorable, currentSlideIndex]);

  // Navigate to a slide — same logic as CompetitionView
  const goToSlide = useCallback((idx: number) => {
    const slide = quiz.slides[idx];
    if (!slide) return;

    const scorableIdx = scorableSlides.findIndex(s => s.id === slide.id);
    const isPower = scorableIdx >= 0 ? shouldBePowerRound(scorableIdx) : false;

    if (isScorableSlide(slide)) {
      updateSession({
        competitionPhase: 'question',
        currentSlideIndex: idx,
        showResults: false,
        tacticalCompetitionData: {
          ...(tData || { scores: {}, streaks: {}, powerUps: {}, blockedPlayers: {}, choices: {}, treasureOffers: {}, choicePhaseActive: false, events: [], isPowerRound: false, timerDuration: DEFAULT_TIMER, timerPaused: false, evaluated: false, questionSlideIds: scorableSlides.map(s => s.id), currentQuestionIndex: 0, questionsPlayed: 0 }),
          currentQuestionIndex: scorableIdx,
          isPowerRound: isPower,
          timerStartedAt: new Date().toISOString(),
          timerDuration: DEFAULT_TIMER,
          timerPaused: false,
          evaluated: false,
          choicePhaseActive: false,
          choices: {},
          treasureOffers: {},
          events: [],
        },
      });
    } else {
      updateSession({
        competitionPhase: 'question',
        currentSlideIndex: idx,
        showResults: false,
      });
    }
  }, [quiz.slides, tData, scorableSlides, updateSession]);

  const startCountdown = useCallback(() => {
    updateSession({
      competitionPhase: 'countdown',
      tacticalCompetitionData: {
        scores: {},
        streaks: {},
        powerUps: {},
        blockedPlayers: {},
        choices: {},
        treasureOffers: {},
        choicePhaseActive: false,
        events: [],
        isPowerRound: false,
        currentQuestionIndex: 0,
        questionSlideIds: scorableSlides.map(s => s.id),
        timerDuration: DEFAULT_TIMER,
        timerPaused: false,
        evaluated: false,
        questionsPlayed: 0,
      },
    });
    setTimeout(() => goToSlide(0), 4000);
  }, [scorableSlides, updateSession, goToSlide]);

  const evaluateAnswers = () => {
    const slideId = currentSlide?.id;
    if (!slideId || !tData) return;
    const newScores = { ...(tData.scores || {}) };
    const newStreaks = { ...(tData.streaks || {}) };
    const newChoices: Record<string, 'pending' | 'points' | 'treasure'> = {};
    const newTreasureOffers: Record<string, any> = {};
    const blocked = tData.blockedPlayers || {};

    studentEntries.forEach(([id, student]) => {
      // Blocked players get nothing
      if (blocked[id]) {
        newChoices[id] = 'points';
        return;
      }

      const response = (student.responses || []).find((r: any) => r.slideId === slideId);
      if (response) {
        let isCorrect = false;
        const act = currentSlide as any;
        if (act.activityType === 'abc') {
          const correctOpt = act.options?.find((o: any) => o.isCorrect);
          isCorrect = response.answer === correctOpt?.id;
        } else if (act.activityType === 'open') {
          isCorrect = (act.correctAnswers || []).some((a: string) => a.trim().toLowerCase() === String(response.answer).trim().toLowerCase());
        } else if (act.activityType === 'example') {
          const studentAns = String(response.answer).trim().toLowerCase();
          isCorrect = (act.finalAnswer || '').trim().toLowerCase() === studentAns || (act.alternativeAnswers || []).some((a: string) => a.trim().toLowerCase() === studentAns);
        } else if (act.activityType === 'trueFalse') {
          isCorrect = response.answer === String(act.correctAnswer);
        }
        const responses = student.responses.map((r: any) => r.slideId === slideId ? { ...r, isCorrect, points: isCorrect ? basePoints : 0 } : r);
        update(ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/students/${id}`), { responses });

        if (isCorrect) {
          newStreaks[id] = (newStreaks[id] || 0) + 1;
          newChoices[id] = 'pending';
          newTreasureOffers[id] = { options: generateTreasureOptions() };
          if (!newScores[id]) newScores[id] = 0;
        } else {
          newStreaks[id] = 0;
          newChoices[id] = 'points';
        }
      } else {
        newStreaks[id] = 0;
        newChoices[id] = 'points';
      }
    });

    updateSession({
      showResults: true,
      tacticalCompetitionData: {
        ...tData,
        scores: newScores,
        streaks: newStreaks,
        evaluated: true,
        choices: newChoices,
        treasureOffers: newTreasureOffers,
        choicePhaseActive: true,
        choicePhaseStartedAt: new Date().toISOString(),
        events: [],
        blockedPlayers: {},
      },
    });
    audio.play(ASSETS.evaluationRevealMusic);
  };

  const autoResolveChoices = useCallback(() => {
    if (!tData) return;
    const updatedScores = { ...tData.scores };
    const updatedChoices = { ...tData.choices };

    Object.entries(updatedChoices).forEach(([pid, choice]) => {
      if (choice === 'pending') {
        const streak = tData.streaks?.[pid] || 0;
        const streakBonus = streak >= 3 ? 1 : 0;
        const pts = (tData.isPowerRound ? 6 : 3) + streakBonus;
        updatedScores[pid] = (updatedScores[pid] || 0) + pts;
        updatedChoices[pid] = 'points';
      }
    });

    updateSession({
      tacticalCompetitionData: {
        ...tData,
        scores: updatedScores,
        choices: updatedChoices,
        choicePhaseActive: false,
      },
    });
  }, [tData, updateSession]);

  const nextSlide = () => {
    if (tData?.choicePhaseActive) autoResolveChoices();
    const next = currentSlideIndex + 1;
    if (next >= totalSlides) {
      updateSession({ competitionPhase: 'results', showResults: false });
    } else {
      goToSlide(next);
    }
  };

  const goToResults = () => {
    updateSession({ competitionPhase: 'results', showResults: false });
  };

  const prevSlide = () => {
    if (currentSlideIndex > 0) goToSlide(currentSlideIndex - 1);
  };

  const toggleTimer = () => {
    if (!tData) return;
    if (tData.timerPaused) {
      const newStart = new Date(Date.now() - (DEFAULT_TIMER - timeLeft) * 1000).toISOString();
      updateSession({ tacticalCompetitionData: { ...tData, timerPaused: false, timerStartedAt: newStart } });
    } else {
      updateSession({ tacticalCompetitionData: { ...tData, timerPaused: true } });
    }
  };

  // Keyboard navigation (same as CompetitionView)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase !== 'question' && phase !== 'evaluation') return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        prevSlide();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        nextSlide();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, currentSlideIndex]);

  // Progress bar (same style as CompetitionView)
  const renderProgressBar = () => {
    const progressPercent = totalSlides > 0 ? ((currentSlideIndex + 1) / totalSlides) * 100 : 0;

    if (totalSlides > 30) {
      return (
        <div
          className="flex-1 h-2 rounded-full overflow-hidden cursor-pointer"
          style={{ backgroundColor: '#334155' }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const targetIndex = Math.max(0, Math.min(totalSlides - 1, Math.floor((clickX / rect.width) * totalSlides)));
            if (targetIndex !== currentSlideIndex) goToSlide(targetIndex);
          }}
        >
          <div className="h-full rounded-full transition-all duration-300 ease-out" style={{ width: `${progressPercent}%`, backgroundColor: '#94a3b8' }} />
        </div>
      );
    }

    return (
      <>
        {currentSlideIndex >= 0 && (
          <div
            className="rounded-full cursor-pointer hover:opacity-80"
            style={{ height: 8, backgroundColor: '#94a3b8', flex: currentSlideIndex + 1 }}
            onClick={() => { if (currentSlideIndex > 0) goToSlide(0); }}
          />
        )}
        {quiz.slides.slice(currentSlideIndex + 1).map((_, idx) => {
          const actualIndex = currentSlideIndex + 1 + idx;
          return (
            <div
              key={actualIndex}
              onClick={() => goToSlide(actualIndex)}
              className="flex-1 rounded-full cursor-pointer hover:opacity-80"
              style={{ height: 8, backgroundColor: '#334155' }}
            />
          );
        })}
      </>
    );
  };

  // QR popup (same as CompetitionView)
  const renderQRPopup = () => {
    if (!showQRPopup) return null;
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'white', right: '320px' }}>
        <button onClick={() => setShowQRPopup(null)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-10">
          <X className="w-6 h-6" />
        </button>
        {showQRPopup === 'code' ? (
          <div className="text-center">
            <p className="text-slate-500 text-lg mb-4">Připojte se na <span className="font-semibold text-slate-700">{window.location.host}{import.meta.env.BASE_URL || ''}/go</span></p>
            <div className="text-9xl font-black tracking-widest text-slate-800">{sessionCode}</div>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-slate-500 text-lg mb-6">Naskenujte QR kód</p>
            <div className="bg-white p-6 rounded-2xl inline-block shadow-lg"><QRCodeSVG value={joinLink} size={Math.min(400, window.innerWidth * 0.35)} level="M" /></div>
            <div className="mt-6"><span className="text-slate-500 text-xl">Kód: </span><span className="text-3xl font-bold text-slate-800 tracking-wider">{sessionCode}</span></div>
          </div>
        )}
      </div>
    );
  };

  // Right panel QR section (same as CompetitionView)
  const renderQRSection = () => (
    <div className="p-4" style={{ borderBottom: '1px solid #334155' }}>
      <p className="text-center text-white/80 text-sm mb-2">
        Připojte se na <span className="font-medium text-white">{window.location.host}{import.meta.env.BASE_URL || ''}/go</span>
      </p>
      <div className="text-center mb-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setShowQRPopup('code')}>
        <span className="text-white/70 text-xl">Kód: </span>
        <span className="text-yellow-400 text-xl font-bold tracking-wider">{sessionCode}</span>
      </div>
      <div className="flex justify-center mb-3 cursor-pointer transition-all group" onClick={() => setShowQRPopup('qr')}>
        <div className="bg-white p-3 rounded-xl transition-all group-hover:ring-4 group-hover:ring-orange-400">
          <QRCodeSVG value={joinLink} size={160} level="M" />
        </div>
      </div>
      <div className="flex justify-center">
        <button
          onClick={() => { navigator.clipboard.writeText(joinLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="py-2 px-3 rounded-lg flex items-center justify-center gap-2 text-sm font-medium hover:opacity-90"
          style={{ backgroundColor: '#f59e0b', color: '#1e293b', width: '206px' }}
        >
          {copied ? <><CheckCircle className="w-4 h-4" /><span>Zkopírováno!</span></> : <><Copy className="w-4 h-4" /><span>Kopírovat odkaz</span></>}
        </button>
      </div>
    </div>
  );

  // ================================================================
  // RENDER: LOBBY (identical to CompetitionView)
  // ================================================================
  if (phase === 'lobby') {
    return (
      <div className="flex h-full relative">
        {renderQRPopup()}
        <div className="flex-1 overflow-hidden relative" style={{ backgroundColor: '#ffffff' }}>
          <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{ zIndex: 10 }}>
            <LottieAnimation url={ASSETS.fight} loop autoplay className="w-full" />
          </div>
          <div className="absolute inset-0 z-20 flex flex-col items-center pointer-events-none" style={{ paddingTop: 140 }}>
            <h1 className="text-4xl font-bold text-slate-800 mb-6 drop-shadow-sm" style={{ textShadow: '0 2px 8px rgba(255,255,255,0.8)' }}>Připojte studenty</h1>
            <button
              onClick={() => startCountdown()}
              className="py-4 rounded-2xl text-white font-bold text-xl transition-all flex items-center justify-center gap-3 shadow-xl hover:scale-[1.03] active:scale-[0.97]"
              style={{ backgroundColor: '#7C3AED', width: '100%', maxWidth: 400, cursor: 'pointer', position: 'relative', zIndex: 50, pointerEvents: 'auto' }}
            >
              <Play className="w-7 h-7" />
              Zahájit soutěž
            </button>
          </div>
        </div>
        <div className="w-80 flex flex-col text-white flex-shrink-0" style={{ backgroundColor: '#1e2533' }}>
          {renderQRSection()}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2" style={{ color: '#94a3b8' }}><Users className="w-4 h-4" /><span className="text-sm">Připojení studenti</span></div>
              <span className="font-bold text-white">{onlineCount}</span>
            </div>
            {studentEntries.length === 0 ? (
              <div className="text-center py-8" style={{ color: '#64748b' }}><Users className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm">Čekám na studenty...</p></div>
            ) : (
              <div className="space-y-1.5">
                {studentEntries.map(([id, s]) => (
                  <div key={id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    <span className="text-sm text-white truncate">{s.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="p-4" style={{ borderTop: '1px solid #334155' }}>
            <button onClick={onEnd} className="w-full py-2 rounded-xl text-sm text-red-300 hover:bg-red-500/20 transition-colors">Zrušit</button>
          </div>
        </div>
      </div>
    );
  }

  // ================================================================
  // RENDER: COUNTDOWN (identical to CompetitionView)
  // ================================================================
  if (phase === 'countdown') {
    return (
      <div className="flex items-center justify-center h-full w-full relative" style={{ backgroundColor: '#4E5871' }}>
        <button onClick={onEnd} className="absolute top-3 left-4 z-30 w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors bg-white/10 text-white/70 hover:bg-white/20 hover:text-white" title="Zavřít soutěž">
          <X className="w-5 h-5" />
        </button>
        <div style={{ width: '60vmin', height: '60vmin' }}>
          <LottieAnimation url={ASSETS.countdown} loop={false} autoplay />
        </div>
      </div>
    );
  }

  // ================================================================
  // RENDER: QUESTION (same layout as CompetitionView)
  // ================================================================
  if (phase === 'question' && currentSlide) {
    const bgColor = currentSlide.backgroundColor || '#ffffff';

    return (
      <div className="flex h-full relative">
        {renderQRPopup()}
        <button onClick={onEnd} className="absolute top-3 left-4 z-30 w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors bg-white/10 text-white/70 hover:bg-white/20 hover:text-white" title="Zavřít soutěž">
          <X className="w-5 h-5" />
        </button>

        {/* Power round bg overlay */}
        {isPowerRound && isScorable && (
          <div className="absolute inset-0 pointer-events-none z-0" style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.08), rgba(245,158,11,0.08))',
            backgroundSize: '300% 300%',
            animation: 'specialGradientShift 3s ease infinite',
          }} />
        )}

        <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#1e2533', minHeight: 0 }}>
          {/* Progress bar */}
          <div className="flex items-end justify-center flex-shrink-0" style={{ height: 40, paddingBottom: 8 }}>
            <div className="w-1/2 max-w-xl flex items-center gap-1.5">
              {renderProgressBar()}
            </div>
          </div>

          {/* Content with side arrows */}
          <div className="flex-1 flex items-stretch overflow-hidden" style={{ minHeight: 0, paddingBottom: 5 }}>
            <div className="flex flex-shrink-0 items-center justify-center" style={{ width: 65 }}>
              <button
                onClick={prevSlide}
                disabled={currentSlideIndex === 0}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ease-out ${currentSlideIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:h-28 hover:rounded-full'} bg-white/10 text-white/70`}
                style={{ transitionProperty: 'height, background-color' }}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1" style={{ minHeight: 0, padding: 16 }}>
              <div className={`w-full h-full rounded-3xl shadow-md overflow-hidden flex flex-col ${currentSlide.type !== 'info' ? 'max-w-5xl mx-auto' : ''}`} style={{ backgroundColor: bgColor }}>
                <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
                  {renderSlide(currentSlide)}
                </div>
              </div>
            </div>

            <div className="flex flex-shrink-0 items-center justify-center" style={{ width: 65 }}>
              <button
                onClick={currentSlideIndex >= totalSlides - 1 ? goToResults : nextSlide}
                className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ease-out hover:h-28 hover:rounded-full bg-white/10 text-white/70"
                style={{ transitionProperty: 'height, background-color' }}
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right panel (same structure as CompetitionView, with tactical additions) */}
        <div className="w-80 flex flex-col text-white flex-shrink-0" style={{ backgroundColor: '#1e2533' }}>
          {isScorable ? (
            <>
              {/* Timer */}
              <div className="flex flex-col items-center justify-center p-6" style={{ borderBottom: '1px solid #334155' }}>
                <button onClick={toggleTimer} className="group cursor-pointer w-full">
                  <div className="font-mono font-bold transition-colors leading-none" style={{ fontSize: 'min(9rem, 28vw)', color: timeLeft <= 10 ? '#ef4444' : timeLeft <= 20 ? '#f59e0b' : '#ffffff' }}>
                    {timeLeft}
                  </div>
                  <p className="text-xs text-slate-500 mt-2 group-hover:text-slate-300 transition-colors text-center">
                    {tData?.timerPaused ? '▶ Pokračovat' : '⏸ Pozastavit'}
                  </p>
                </button>
                <button onClick={goToEvaluation} className="mt-4 w-full py-3 rounded-xl text-sm font-medium text-amber-300 hover:bg-amber-500/20 transition-colors border border-amber-500/30">
                  Ukončit hlasování
                </button>
              </div>
              {/* Power round indicator */}
              {isPowerRound && (
                <div className="px-4 py-2 text-center animate-pulse" style={{ backgroundColor: 'rgba(245,158,11,0.15)', borderBottom: '1px solid #334155' }}>
                  <span className="text-sm font-bold" style={{ color: '#F59E0B' }}>⚡ POWER KOLO — {basePoints} bodů</span>
                </div>
              )}
              {/* Leaderboard */}
              <div className="flex-1 overflow-y-auto p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Pořadí</p>
                <div className="space-y-1">
                  {leaderboard.map((s, i) => {
                    const hasAnswered = (students[s.id]?.responses || []).some((r: any) => r.slideId === currentSlide.id);
                    const powerUps = tData?.powerUps?.[s.id];
                    return (
                      <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                        <span className="text-xs font-bold w-5 text-center" style={{ color: '#94a3b8' }}>{i + 1}</span>
                        <span className="text-sm text-white truncate flex-1">{s.name}</span>
                        {s.streak >= 3 && <span className="text-xs flex-shrink-0" title={`${s.streak}x série`}>🔥</span>}
                        {powerUps?.shield && <span className="text-xs flex-shrink-0" title="Štít">🛡️</span>}
                        {powerUps?.xray && <span className="text-xs flex-shrink-0" title="Rentgen">👁️</span>}
                        {powerUps?.timeBoost && <span className="text-xs flex-shrink-0" title="Čas+">⏰</span>}
                        {hasAnswered && <div className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0" title="Odpověděl/a" />}
                        <span className="text-xs font-bold text-yellow-400 flex-shrink-0">{s.score}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="px-4 py-3 text-center text-xs text-slate-500" style={{ borderTop: '1px solid #334155' }}>
                Otázka {currentScorableIdx + 1} z {scorableSlides.length} • Slide {currentSlideIndex + 1}/{totalSlides}
              </div>
            </>
          ) : (
            <>
              <div className="p-4 text-center" style={{ borderBottom: '1px solid #334155' }}>
                <p className="text-sm text-slate-400">Tento slide není soutěžní</p>
                <p className="text-xs text-slate-500 mt-1">Pokračujte šipkami</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Pořadí</p>
                <div className="space-y-1">
                  {leaderboard.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                      <span className="text-xs font-bold w-5 text-center" style={{ color: '#94a3b8' }}>{i + 1}</span>
                      <span className="text-sm text-white truncate flex-1">{s.name}</span>
                      <span className="text-xs font-bold text-yellow-400 flex-shrink-0">{s.score}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-4 py-3 text-center text-xs text-slate-500" style={{ borderTop: '1px solid #334155' }}>
                Slide {currentSlideIndex + 1} / {totalSlides}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ================================================================
  // RENDER: EVALUATION (same layout as CompetitionView, with choice phase)
  // ================================================================
  if (phase === 'evaluation' && currentSlide) {
    const bgColor = currentSlide.backgroundColor || '#ffffff';
    const evaluated = tData?.evaluated;
    const choiceActive = tData?.choicePhaseActive;

    return (
      <div className="flex h-full relative">
        {renderQRPopup()}
        <button onClick={onEnd} className="absolute top-3 left-4 z-30 w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors bg-white/10 text-white/70 hover:bg-white/20 hover:text-white" title="Zavřít soutěž">
          <X className="w-5 h-5" />
        </button>

        <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#1e2533', minHeight: 0 }}>
          {/* Progress bar */}
          <div className="flex items-end justify-center flex-shrink-0" style={{ height: 40, paddingBottom: 8 }}>
            <div className="w-1/2 max-w-xl flex items-center gap-1.5">
              {renderProgressBar()}
            </div>
          </div>

          {/* Slide content with side arrows */}
          <div className="flex-1 flex items-stretch overflow-hidden" style={{ minHeight: 0, paddingBottom: 5 }}>
            <div className="flex flex-shrink-0 items-center justify-center" style={{ width: 65 }}>
              <button
                onClick={prevSlide}
                disabled={currentSlideIndex === 0}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ease-out ${currentSlideIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:h-28 hover:rounded-full'} bg-white/10 text-white/70`}
                style={{ transitionProperty: 'height, background-color' }}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1" style={{ minHeight: 0, padding: 16 }}>
              <div className={`w-full h-full rounded-3xl shadow-md overflow-hidden flex flex-col ${currentSlide.type !== 'info' ? 'max-w-5xl mx-auto' : ''}`} style={{ backgroundColor: bgColor }}>
                <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
                  {renderSlide(currentSlide)}
                </div>
              </div>
            </div>

            <div className="flex flex-shrink-0 items-center justify-center" style={{ width: 65 }}>
              <button
                onClick={currentSlideIndex >= totalSlides - 1 ? goToResults : nextSlide}
                className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ease-out hover:h-28 hover:rounded-full bg-white/10 text-white/70"
                style={{ transitionProperty: 'height, background-color' }}
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right panel — buttons + answers (same as CompetitionView, with choice phase) */}
        <div className="w-80 flex flex-col text-white flex-shrink-0" style={{ backgroundColor: '#1e2533' }}>
          {/* Vyhodnotit / Choice phase / Další button */}
          <div className="p-4" style={{ borderBottom: '1px solid #334155' }}>
            {!evaluated ? (
              <button onClick={evaluateAnswers} className="w-full py-3 rounded-2xl text-white font-bold text-lg transition-all hover:scale-[1.03] active:scale-[0.97] shadow-lg" style={{ backgroundColor: '#7C3AED' }}>
                Vyhodnotit
              </button>
            ) : choiceActive ? (
              <div>
                <p className="text-sm font-bold text-amber-300 mb-1">Studenti volí odměnu</p>
                <p className="text-xs text-slate-400 mb-3">{pendingChoiceCount} čeká na volbu</p>
                <button onClick={autoResolveChoices} className="w-full py-3 rounded-2xl text-white font-bold text-lg transition-all hover:scale-[1.03] active:scale-[0.97] shadow-lg flex items-center justify-center gap-2" style={{ backgroundColor: '#F59E0B' }}>
                  Ukončit volbu
                  <SkipForward className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button onClick={nextSlide} className="w-full py-3 rounded-2xl text-white font-bold text-lg transition-all hover:scale-[1.03] active:scale-[0.97] shadow-lg flex items-center justify-center gap-2" style={{ backgroundColor: '#7C3AED' }}>
                {currentSlideIndex + 1 >= totalSlides ? 'Výsledky' : 'Další'}
                <SkipForward className="w-5 h-5" />
              </button>
            )}
          </div>
          {/* Power round indicator */}
          {isPowerRound && (
            <div className="px-4 py-2 text-center" style={{ backgroundColor: 'rgba(245,158,11,0.15)', borderBottom: '1px solid #334155' }}>
              <span className="text-sm font-bold" style={{ color: '#F59E0B' }}>⚡ POWER KOLO</span>
            </div>
          )}
          <div className="px-4 py-2 text-center text-sm font-semibold" style={{ borderBottom: '1px solid #334155' }}>
            {evaluated ? 'Výsledky' : 'Odpovědi studentů'}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-1.5">
              {leaderboard.map((s, i) => {
                const student = students[s.id];
                const response = (student?.responses || []).find((r: any) => r.slideId === currentSlide.id);
                let answerLabel = '—';
                let answerBg = '#334155';
                if (response) {
                  if ((currentSlide as any).activityType === 'abc') {
                    const optIdx = ((currentSlide as any).options || []).findIndex((o: any) => o.id === response.answer);
                    answerLabel = optIdx >= 0 ? String.fromCharCode(65 + optIdx) : '?';
                  } else { answerLabel = String(response.answer || '').substring(0, 15); }
                  answerBg = evaluated ? (response.isCorrect ? '#10b981' : '#ef4444') : '#7C3AED';
                }
                const choice = tData?.choices?.[s.id];
                const treasure = tData?.treasureOffers?.[s.id]?.picked;
                const powerUps = tData?.powerUps?.[s.id];
                return (
                  <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                    <span className="text-xs font-bold w-5 text-center" style={{ color: '#94a3b8' }}>{i + 1}</span>
                    <span className="text-sm text-white truncate flex-1">{s.name}</span>
                    {s.streak >= 3 && <span className="text-xs flex-shrink-0">🔥</span>}
                    {powerUps?.shield && <span className="text-xs flex-shrink-0">🛡️</span>}
                    {choice === 'pending' && <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse flex-shrink-0" title="Volí..." />}
                    {treasure && <span className="text-xs flex-shrink-0">{TREASURE_INFO[treasure]?.emoji}</span>}
                    <div className="px-2 py-0.5 rounded text-xs font-bold flex-shrink-0" style={{ backgroundColor: answerBg, color: '#fff' }}>{answerLabel}</div>
                    <span className="text-xs font-bold text-yellow-400 flex-shrink-0 w-4 text-right">{s.score}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="px-4 py-3 text-center text-xs text-slate-500" style={{ borderTop: '1px solid #334155' }}>
            Otázka {currentScorableIdx + 1} z {scorableSlides.length}
          </div>
        </div>
      </div>
    );
  }

  // ================================================================
  // RENDER: RESULTS (identical to CompetitionView)
  // ================================================================
  if (phase === 'results') {
    const medalColors = ['#FBBF24', '#C0C0C0', '#CD7F32'];

    return (
      <div className="flex h-full relative">
        <button onClick={onEnd} className="absolute top-3 left-4 z-30 w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors bg-white/10 text-white/70 hover:bg-white/20 hover:text-white" title="Zavřít soutěž">
          <X className="w-5 h-5" />
        </button>

        <div className="flex-1 overflow-hidden relative" style={{ backgroundColor: '#ffffff' }}>
          <div className="absolute pointer-events-none" style={{ bottom: 0, left: '-10%', right: '-10%', transform: 'scale(1.26)', transformOrigin: 'bottom center' }}>
            <LottieAnimation url={ASSETS.final} loop autoplay className="w-full" />
          </div>
        </div>

        <div className="w-80 flex flex-col text-white flex-shrink-0" style={{ backgroundColor: '#1e2533' }}>
          <div className="px-4 py-4 text-center" style={{ borderBottom: '1px solid #334155' }}>
            <p className="text-lg font-bold">Konečné pořadí</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-1.5">
              {leaderboard.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: i < 3 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)' }}>
                  {i < 3 ? (
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0" style={{ backgroundColor: medalColors[i], color: '#1e293b' }}>{i + 1}</span>
                  ) : (
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ backgroundColor: '#334155', color: '#94a3b8' }}>{i + 1}</span>
                  )}
                  <span className={`text-sm truncate flex-1 ${i < 3 ? 'text-white font-semibold' : 'text-slate-300'}`}>{s.name}</span>
                  <span className={`text-sm font-bold flex-shrink-0 ${i < 3 ? 'text-yellow-400' : 'text-slate-500'}`}>{s.score}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-4" style={{ borderTop: '1px solid #334155' }}>
            <button onClick={onEnd} className="w-full py-3 rounded-xl font-semibold text-white transition-colors hover:brightness-110" style={{ backgroundColor: '#7C3AED' }}>
              Ukončit soutěž
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <div className="flex items-center justify-center h-full text-white text-xl">Loading...</div>;
}
