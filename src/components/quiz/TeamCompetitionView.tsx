import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ref, update } from 'firebase/database';
import { database } from '../../utils/firebase-config';
import { QRCodeSVG } from 'qrcode.react';
import Lottie from 'lottie-react';
import { Copy, CheckCircle, Users, Play, SkipForward, X, ArrowRight, ArrowLeft, Zap, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Quiz, LiveQuizSession, CompetitionPhase, QuizSlide } from '../../types/quiz';

// Pulsing gradient style for special rounds
const SPECIAL_ROUND_STYLE = document.createElement('style');
SPECIAL_ROUND_STYLE.textContent = `
@keyframes specialPulse {
  0%, 100% { opacity: 0.18; }
  50% { opacity: 0.35; }
}
@keyframes specialGradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
.special-round-power {
  position: relative;
}
.special-round-power::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #7C3AED, #F59E0B, #7C3AED, #EC4899);
  background-size: 300% 300%;
  animation: specialGradientShift 3s ease infinite, specialPulse 2s ease-in-out infinite;
  pointer-events: none;
  z-index: 0;
  border-radius: inherit;
}
.special-round-double {
  position: relative;
}
.special-round-double::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #F59E0B, #EF4444, #F59E0B, #FF6B00);
  background-size: 300% 300%;
  animation: specialGradientShift 3s ease infinite, specialPulse 2s ease-in-out infinite;
  pointer-events: none;
  z-index: 0;
  border-radius: inherit;
}
.special-round-tip {
  position: relative;
}
.special-round-tip::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #10B981, #06B6D4, #10B981, #34D399);
  background-size: 300% 300%;
  animation: specialGradientShift 3s ease infinite, specialPulse 2s ease-in-out infinite;
  pointer-events: none;
  z-index: 0;
  border-radius: inherit;
}
.special-round-power > *, .special-round-double > *, .special-round-tip > * {
  position: relative;
  z-index: 1;
}
`;
if (!document.getElementById('special-round-styles')) {
  SPECIAL_ROUND_STYLE.id = 'special-round-styles';
  document.head.appendChild(SPECIAL_ROUND_STYLE);
}

// Supabase storage
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
const TIP_TIMER = 10;

const SCORABLE_TYPES = new Set(['abc', 'open', 'example', 'trueFalse']);
function isScorableSlide(slide: QuizSlide): boolean {
  return slide.type === 'activity' && SCORABLE_TYPES.has((slide as any).activityType);
}

// Team presets
const TEAM_PRESETS = [
  { name: 'Ohniví draci', emoji: '🐉', color: '#EF4444' },
  { name: 'Ledoví vlci', emoji: '🐺', color: '#3B82F6' },
  { name: 'Zlatí orli', emoji: '🦅', color: '#F59E0B' },
  { name: 'Smaragdoví hadi', emoji: '🐍', color: '#10B981' },
];

// Lottie loader with error handling
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

// Audio hook
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

// Decide special round type based on question count
function decideRoundType(questionsPlayed: number): 'normal' | 'power' | 'double' {
  if (questionsPlayed > 0 && questionsPlayed % 5 === 0) return 'power';
  if (questionsPlayed > 0 && questionsPlayed % 4 === 0) return 'double';
  return 'normal';
}

function shouldTriggerTip(questionsPlayed: number): boolean {
  return questionsPlayed > 0 && questionsPlayed % 3 === 0;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

interface TeamCompetitionViewProps {
  session: LiveQuizSession;
  sessionId: string;
  quiz: Quiz;
  sessionCode: string;
  onEnd: () => void;
  renderSlide: (slide: QuizSlide) => React.ReactNode;
}

export default function TeamCompetitionView({ session, sessionId, quiz, sessionCode, onEnd, renderSlide }: TeamCompetitionViewProps) {
  const phase = (session.competitionPhase || 'lobby') as CompetitionPhase;
  const tData = session.teamCompetitionData;
  const students = session.students || {};
  const studentEntries = Object.entries(students);
  const onlineCount = studentEntries.filter(([, s]) => s.isOnline).length;

  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIMER);
  const [showQRPopup, setShowQRPopup] = useState<'qr' | 'code' | null>(null);
  const [selectedTeamCount, setSelectedTeamCount] = useState(2);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audio = useAudio();

  // Current slide from session
  const currentSlideIndex = session.currentSlideIndex || 0;
  const currentSlide = quiz.slides[currentSlideIndex];
  const totalSlides = quiz.slides.length;
  const isScorable = currentSlide ? isScorableSlide(currentSlide) : false;

  const scorableSlides = useMemo(() => quiz.slides.filter(isScorableSlide), [quiz.slides]);

  // Teams sorted by score
  const teamsSorted = useMemo(() => {
    if (!tData?.teams) return [];
    return Object.entries(tData.teams).sort(([, a], [, b]) => b.score - a.score);
  }, [tData?.teams]);

  const joinLink = `${window.location.origin}${import.meta.env.BASE_URL || '/'}go/${sessionCode}`;

  // Firebase helpers
  const updateSession = useCallback((data: Record<string, any>) => {
    update(ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}`), data);
  }, [sessionId]);

  // Assign student to team on join (round-robin)
  useEffect(() => {
    if (!tData?.teams || phase !== 'lobby') return;
    const teamIds = Object.keys(tData.teams);
    if (teamIds.length === 0) return;

    const currentMap = tData.studentTeamMap || {};
    const unassigned = studentEntries.filter(([id]) => !currentMap[id]);
    if (unassigned.length === 0) return;

    const newMap = { ...currentMap };
    unassigned.forEach(([id]) => {
      const teamSizes = teamIds.map(tid => Object.values(newMap).filter(t => t === tid).length);
      const minSize = Math.min(...teamSizes);
      const smallestTeam = teamIds[teamSizes.indexOf(minSize)];
      newMap[id] = smallestTeam;
    });

    // Update memberIds on teams
    const updatedTeams = { ...tData.teams };
    teamIds.forEach(tid => {
      updatedTeams[tid] = {
        ...updatedTeams[tid],
        memberIds: Object.entries(newMap).filter(([, t]) => t === tid).map(([id]) => id),
      };
    });

    updateSession({
      teamCompetitionData: { ...tData, studentTeamMap: newMap, teams: updatedTeams },
    });
  }, [studentEntries.length, phase, tData?.teams ? Object.keys(tData.teams).length : 0]);

  // Timer logic
  useEffect(() => {
    if (phase !== 'question' || !isScorable || !tData?.timerStartedAt || tData?.timerPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const tick = () => {
      const elapsed = (Date.now() - new Date(tData.timerStartedAt!).getTime()) / 1000;
      const duration = tData.tipRoundActive ? TIP_TIMER : (tData.timerDuration || DEFAULT_TIMER);
      const remaining = Math.max(0, duration - elapsed);
      setTimeLeft(Math.ceil(remaining));
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        if (tData.tipRoundActive) {
          // Tip round ended — go to evaluation
          goToEvaluation();
        } else {
          // Normal timer ended — check if tip round should trigger
          handleTimerEnd();
        }
      }
    };
    tick();
    timerRef.current = setInterval(tick, 200);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, isScorable, tData?.timerStartedAt, tData?.timerPaused, tData?.timerDuration, tData?.tipRoundActive]);

  // Audio per phase
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

  // Pick active players for each team
  const pickActivePlayers = useCallback(() => {
    if (!tData?.teams) return {};
    const activeMap: { [teamId: string]: string } = {};
    const playedMap = tData.playedPlayersMap || {};

    Object.entries(tData.teams).forEach(([teamId, team]) => {
      const members = team.memberIds || [];
      if (members.length === 0) return;
      const played = playedMap[teamId] || [];
      let available = members.filter(id => !played.includes(id));
      if (available.length === 0) available = [...members]; // reset
      const pick = available[Math.floor(Math.random() * available.length)];
      activeMap[teamId] = pick;
    });
    return activeMap;
  }, [tData?.teams, tData?.playedPlayersMap]);

  const goToEvaluation = useCallback(() => {
    updateSession({
      competitionPhase: 'evaluation',
      teamCompetitionData: {
        ...tData,
        timerStartedAt: null,
        timerPaused: false,
        evaluated: false,
        tipRoundActive: false,
      },
    });
  }, [tData, updateSession]);

  const handleTimerEnd = useCallback(() => {
    const qPlayed = tData?.questionsPlayed || 0;
    const roundType = tData?.currentRoundType || 'normal';

    // Tip round only makes sense if at least one team has >1 member (so someone can tip)
    const hasMultiMemberTeam = tData?.teams
      ? Object.values(tData.teams).some(t => (t.memberIds?.length || 0) > 1)
      : false;

    if (roundType !== 'power' && hasMultiMemberTeam && shouldTriggerTip(qPlayed)) {
      // Activate tip round
      updateSession({
        teamCompetitionData: {
          ...tData,
          tipRoundActive: true,
          tipVotes: {},
          timerStartedAt: new Date().toISOString(),
          timerDuration: TIP_TIMER,
        },
      });
    } else {
      goToEvaluation();
    }
  }, [tData, updateSession, goToEvaluation]);

  // Navigate to a slide
  const goToSlide = useCallback((idx: number) => {
    const slide = quiz.slides[idx];
    if (!slide) return;

    if (isScorableSlide(slide)) {
      const qPlayed = (tData?.questionsPlayed || 0);
      const roundType = decideRoundType(qPlayed);
      const activeMap = roundType === 'power' ? {} : pickActivePlayers();

      // Update played players
      const newPlayedMap = { ...(tData?.playedPlayersMap || {}) };
      if (roundType !== 'power') {
        Object.entries(activeMap).forEach(([teamId, studentId]) => {
          const played = newPlayedMap[teamId] || [];
          const team = tData?.teams?.[teamId];
          if (team && played.length >= team.memberIds.length) {
            newPlayedMap[teamId] = [studentId]; // reset cycle
          } else {
            newPlayedMap[teamId] = [...played, studentId];
          }
        });
      }

      updateSession({
        competitionPhase: 'question',
        currentSlideIndex: idx,
        showResults: false,
        teamCompetitionData: {
          ...tData,
          currentQuestionIndex: scorableSlides.findIndex(s => s.id === slide.id),
          timerStartedAt: new Date().toISOString(),
          timerDuration: DEFAULT_TIMER,
          timerPaused: false,
          evaluated: false,
          tipRoundActive: false,
          tipVotes: {},
          currentRoundType: roundType,
          activePlayerMap: activeMap,
          playedPlayersMap: newPlayedMap,
          questionsPlayed: qPlayed + 1,
        },
      });
    } else {
      updateSession({
        competitionPhase: 'question',
        currentSlideIndex: idx,
        showResults: false,
      });
    }
  }, [quiz.slides, tData, scorableSlides, updateSession, pickActivePlayers]);

  const startCountdown = useCallback(() => {
    updateSession({
      competitionPhase: 'countdown',
    });
    setTimeout(() => goToSlide(0), 4000);
  }, [updateSession, goToSlide]);

  const evaluateAnswers = () => {
    const slideId = currentSlide?.id;
    if (!slideId || !tData) return;
    const roundType = tData.currentRoundType || 'normal';
    const multiplier = roundType === 'double' ? 2 : 1;
    const updatedTeams = { ...tData.teams };

    if (roundType === 'power') {
      // Everyone answers — count correct per team
      Object.entries(tData.teams).forEach(([teamId, team]) => {
        let teamPoints = 0;
        team.memberIds.forEach(studentId => {
          const student = students[studentId];
          const response = (student?.responses || []).find((r: any) => r.slideId === slideId);
          if (response) {
            const isCorrect = checkCorrect(currentSlide, response);
            const responses = student.responses.map((r: any) => r.slideId === slideId ? { ...r, isCorrect, points: isCorrect ? 1 : 0 } : r);
            update(ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/students/${studentId}`), { responses });
            if (isCorrect) teamPoints++;
          }
        });
        updatedTeams[teamId] = { ...updatedTeams[teamId], score: (updatedTeams[teamId].score || 0) + teamPoints };
      });
    } else {
      // Only active player answers per team
      const activeMap = tData.activePlayerMap || {};
      Object.entries(activeMap).forEach(([teamId, studentId]) => {
        const student = students[studentId];
        const response = (student?.responses || []).find((r: any) => r.slideId === slideId);
        if (response) {
          const isCorrect = checkCorrect(currentSlide, response);
          const responses = student.responses.map((r: any) => r.slideId === slideId ? { ...r, isCorrect, points: isCorrect ? multiplier : 0 } : r);
          update(ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/students/${studentId}`), { responses });
          if (isCorrect) {
            updatedTeams[teamId] = { ...updatedTeams[teamId], score: (updatedTeams[teamId].score || 0) + multiplier };
          }
        }
      });
    }

    // Process tip votes bonus
    if (tData.tipVotes && Object.keys(tData.tipVotes).length > 0) {
      const activeMap = tData.activePlayerMap || {};
      Object.entries(tData.teams).forEach(([teamId, team]) => {
        const activePlayer = activeMap[teamId];
        if (!activePlayer) return;
        const student = students[activePlayer];
        const response = (student?.responses || []).find((r: any) => r.slideId === slideId);
        const wasCorrect = response?.isCorrect || false;

        team.memberIds.forEach(memberId => {
          if (memberId === activePlayer) return;
          const vote = tData.tipVotes[memberId];
          if (vote !== undefined && vote === wasCorrect) {
            updatedTeams[teamId] = { ...updatedTeams[teamId], score: (updatedTeams[teamId].score || 0) + 1 };
          }
        });
      });
    }

    updateSession({
      showResults: true,
      teamCompetitionData: { ...tData, evaluated: true, teams: updatedTeams },
    });
    audio.play(ASSETS.evaluationRevealMusic);
  };

  const checkCorrect = (slide: QuizSlide, response: any): boolean => {
    const act = slide as any;
    if (act.activityType === 'abc') {
      const correctOpt = act.options?.find((o: any) => o.isCorrect);
      return response.answer === correctOpt?.id;
    } else if (act.activityType === 'open') {
      return (act.correctAnswers || []).some((a: string) => a.trim().toLowerCase() === String(response.answer).trim().toLowerCase());
    } else if (act.activityType === 'example') {
      const studentAns = String(response.answer).trim().toLowerCase();
      return (act.finalAnswer || '').trim().toLowerCase() === studentAns || (act.alternativeAnswers || []).some((a: string) => a.trim().toLowerCase() === studentAns);
    } else if (act.activityType === 'trueFalse') {
      return response.answer === String(act.correctAnswer);
    }
    return false;
  };

  const nextSlide = () => {
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
      const duration = tData.tipRoundActive ? TIP_TIMER : DEFAULT_TIMER;
      const newStart = new Date(Date.now() - (duration - timeLeft) * 1000).toISOString();
      updateSession({ teamCompetitionData: { ...tData, timerPaused: false, timerStartedAt: newStart } });
    } else {
      updateSession({ teamCompetitionData: { ...tData, timerPaused: true } });
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase !== 'question' && phase !== 'evaluation') return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prevSlide();
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') nextSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, currentSlideIndex]);

  // Progress bar
  const renderProgressBar = () => {
    const progressPercent = totalSlides > 0 ? ((currentSlideIndex + 1) / totalSlides) * 100 : 0;
    if (totalSlides > 30) {
      return (
        <div className="flex-1 h-2 rounded-full overflow-hidden cursor-pointer" style={{ backgroundColor: '#334155' }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const targetIndex = Math.max(0, Math.min(totalSlides - 1, Math.floor(((e.clientX - rect.left) / rect.width) * totalSlides)));
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
          <div className="rounded-full cursor-pointer hover:opacity-80" style={{ height: 8, backgroundColor: '#94a3b8', flex: currentSlideIndex + 1 }}
            onClick={() => { if (currentSlideIndex > 0) goToSlide(0); }}
          />
        )}
        {quiz.slides.slice(currentSlideIndex + 1).map((_, idx) => {
          const actualIndex = currentSlideIndex + 1 + idx;
          return (
            <div key={actualIndex} onClick={() => goToSlide(actualIndex)}
              className="flex-1 rounded-full cursor-pointer hover:opacity-80" style={{ height: 8, backgroundColor: '#334155' }}
            />
          );
        })}
      </>
    );
  };

  // QR popup (fullscreen)
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
            <p className="text-slate-500 text-lg mb-4">Naskenujte QR kód</p>
            <div className="bg-white p-6 rounded-2xl inline-block shadow-lg">
              <QRCodeSVG value={joinLink} size={Math.min(400, window.innerWidth * 0.4)} level="M" />
            </div>
          </div>
        )}
      </div>
    );
  };

  // QR section for right panel
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

  // Close button
  const renderCloseBtn = () => (
    <button onClick={onEnd} className="absolute top-3 left-4 z-30 w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors bg-white/10 text-white/70 hover:bg-white/20 hover:text-white" title="Zavřít soutěž">
      <X className="w-5 h-5" />
    </button>
  );

  // Round type badge
  const renderRoundBadge = () => {
    const roundType = tData?.currentRoundType || 'normal';
    if (roundType === 'power') {
      return (
        <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl mb-3 animate-pulse" style={{ backgroundColor: '#7C3AED' }}>
          <Zap className="w-5 h-5 text-yellow-300" />
          <span className="text-white font-bold text-sm">POWER KOLO — Všichni hrají!</span>
          <Zap className="w-5 h-5 text-yellow-300" />
        </div>
      );
    }
    if (roundType === 'double') {
      return (
        <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl mb-3" style={{ backgroundColor: '#F59E0B' }}>
          <span className="text-slate-900 font-black text-lg">x2</span>
          <span className="text-slate-900 font-bold text-sm">Dvojité body!</span>
        </div>
      );
    }
    if (tData?.tipRoundActive) {
      return (
        <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl mb-3 animate-pulse" style={{ backgroundColor: '#10B981' }}>
          <ThumbsUp className="w-5 h-5 text-white" />
          <span className="text-white font-bold text-sm">TIP KOLO — Uhodnete?</span>
        </div>
      );
    }
    return null;
  };

  // ================================================================
  // RENDER: LOBBY
  // ================================================================
  if (phase === 'lobby') {
    const teamsCreated = tData?.teams && Object.keys(tData.teams).length > 0;

    return (
      <div className="flex h-full relative">
        {renderQRPopup()}
        {renderCloseBtn()}

        {/* Main area */}
        <div className="flex-1 overflow-hidden relative" style={{ backgroundColor: '#ffffff' }}>
          {/* Animation — fully non-interactive */}
          <div className="absolute bottom-0 left-0 right-0" style={{ zIndex: 1, pointerEvents: 'none' }}>
            <LottieAnimation url={ASSETS.fight} loop autoplay className="w-full" style={{ pointerEvents: 'none' }} />
          </div>

          {/* Content overlay — interactive */}
          <div className="absolute inset-0 flex flex-col items-center" style={{ paddingTop: 80, zIndex: 20 }}>
            <h1 className="text-4xl font-bold text-slate-800 mb-6 drop-shadow-sm" style={{ textShadow: '0 2px 8px rgba(255,255,255,0.8)' }}>
              Týmová soutěž
            </h1>

            {!teamsCreated ? (
              <div className="flex flex-col items-center gap-4">
                <p className="text-lg text-slate-600 font-medium">Vyberte počet týmů</p>
                <div className="flex gap-3">
                  {[2, 3, 4].map(n => (
                    <button
                      key={n}
                      onClick={() => setSelectedTeamCount(n)}
                      className="w-16 h-16 rounded-2xl text-2xl font-black transition-all hover:scale-110"
                      style={{
                        backgroundColor: selectedTeamCount === n ? '#7C3AED' : 'rgba(255,255,255,0.9)',
                        color: selectedTeamCount === n ? '#fff' : '#4E5871',
                        boxShadow: selectedTeamCount === n ? '0 4px 20px rgba(124,58,237,0.4)' : '0 2px 8px rgba(0,0,0,0.1)',
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    const teams: Record<string, any> = {};
                    for (let i = 0; i < selectedTeamCount; i++) {
                      const preset = TEAM_PRESETS[i];
                      teams[`team_${i}`] = { name: preset.name, emoji: preset.emoji, color: preset.color, memberIds: [], score: 0 };
                    }
                    updateSession({
                      teamCompetitionData: {
                        teamCount: selectedTeamCount,
                        teams,
                        studentTeamMap: {},
                        activePlayerMap: {},
                        playedPlayersMap: {},
                        currentRoundType: 'normal',
                        tipRoundActive: false,
                        tipVotes: {},
                        timerDuration: DEFAULT_TIMER,
                        timerPaused: false,
                        evaluated: false,
                        questionSlideIds: scorableSlides.map(s => s.id),
                        currentQuestionIndex: 0,
                        questionsPlayed: 0,
                      },
                    });
                  }}
                  className="py-3 px-8 rounded-2xl text-white font-bold text-lg transition-all hover:scale-[1.03] active:scale-[0.97] shadow-xl"
                  style={{ backgroundColor: '#7C3AED' }}
                >
                  Vytvořit týmy
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                {/* Team preview */}
                <div className="flex gap-4 mb-2">
                  {Object.entries(tData!.teams).map(([tid, team]) => {
                    const memberCount = team.memberIds?.length || 0;
                    return (
                      <div key={tid} className="flex flex-col items-center px-6 py-4 rounded-2xl shadow-lg" style={{ backgroundColor: 'rgba(255,255,255,0.95)', minWidth: 140 }}>
                        <span className="text-3xl mb-1">{team.emoji}</span>
                        <span className="text-sm font-bold" style={{ color: team.color }}>{team.name}</span>
                        <span className="text-xs text-slate-500 mt-1">{memberCount} {memberCount === 1 ? 'hráč' : memberCount < 5 ? 'hráči' : 'hráčů'}</span>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => startCountdown()}
                  className="py-4 rounded-2xl text-white font-bold text-xl transition-all flex items-center justify-center gap-3 shadow-xl hover:scale-[1.03] active:scale-[0.97]"
                  style={{ backgroundColor: onlineCount > 0 ? '#7C3AED' : '#94a3b8', width: '100%', maxWidth: 400, opacity: onlineCount > 0 ? 1 : 0.6, cursor: onlineCount > 0 ? 'pointer' : 'not-allowed' }}
                >
                  <Play className="w-7 h-7" />
                  Zahájit soutěž
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right panel — QR + teams */}
        <div className="w-80 flex flex-col text-white flex-shrink-0" style={{ backgroundColor: '#1e2533' }}>
          {renderQRSection()}
          <div className="flex-1 overflow-y-auto p-4">
            {teamsCreated ? (
              <div className="space-y-4">
                {Object.entries(tData!.teams).map(([tid, team]) => (
                  <div key={tid}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{team.emoji}</span>
                      <span className="text-sm font-bold" style={{ color: team.color }}>{team.name}</span>
                      <span className="text-xs text-slate-500 ml-auto">{(team.memberIds || []).length}</span>
                    </div>
                    <div className="space-y-1">
                      {(team.memberIds || []).map(mid => {
                        const s = students[mid];
                        return s ? (
                          <div key={mid} className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.isOnline ? '#10b981' : '#64748b' }} />
                            <span className="text-xs text-white truncate">{s.name}</span>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8" style={{ color: '#64748b' }}>
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nejprve vyberte počet týmů</p>
              </div>
            )}
          </div>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: '1px solid #334155' }}>
            <span className="text-sm text-slate-400">Připojeno: <span className="text-white font-bold">{onlineCount}</span></span>
            <button onClick={onEnd} className="text-sm text-red-300 hover:text-red-200 transition-colors">Zrušit</button>
          </div>
        </div>
      </div>
    );
  }

  // ================================================================
  // RENDER: COUNTDOWN
  // ================================================================
  if (phase === 'countdown') {
    return (
      <div className="flex items-center justify-center h-full w-full relative" style={{ backgroundColor: '#4E5871' }}>
        {renderCloseBtn()}
        <div style={{ width: '60vmin', height: '60vmin' }}>
          <LottieAnimation url={ASSETS.countdown} loop={false} autoplay />
        </div>
      </div>
    );
  }

  // ================================================================
  // RENDER: QUESTION
  // ================================================================
  if (phase === 'question' && currentSlide) {
    const bgColor = currentSlide.backgroundColor || '#ffffff';
    const roundType = tData?.currentRoundType || 'normal';

    return (
      <div className="flex h-full relative">
        {renderQRPopup()}
        {renderCloseBtn()}

        {/* Main area */}
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
              <button onClick={prevSlide} disabled={currentSlideIndex === 0}
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
              <button onClick={currentSlideIndex >= totalSlides - 1 ? goToResults : nextSlide}
                className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ease-out hover:h-28 hover:rounded-full bg-white/10 text-white/70"
                style={{ transitionProperty: 'height, background-color' }}
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className={`w-80 flex flex-col text-white flex-shrink-0 overflow-hidden ${roundType === 'power' ? 'special-round-power' : roundType === 'double' ? 'special-round-double' : tData?.tipRoundActive ? 'special-round-tip' : ''}`} style={{ backgroundColor: '#1e2533' }}>
          {isScorable ? (
            <>
              {/* Round badge + Timer */}
              <div className="p-4 flex flex-col items-center" style={{ borderBottom: '1px solid #334155' }}>
                {renderRoundBadge()}
                <button onClick={toggleTimer} className="group cursor-pointer w-full text-center">
                  <div className="font-mono font-bold transition-colors leading-none" style={{ fontSize: 'min(9rem, 28vw)', color: timeLeft <= 10 ? '#ef4444' : timeLeft <= 20 ? '#f59e0b' : '#ffffff' }}>
                    {timeLeft}
                  </div>
                  <p className="text-xs text-slate-500 mt-2 group-hover:text-slate-300 transition-colors">
                    {tData?.timerPaused ? '▶ Pokračovat' : '⏸ Pozastavit'}
                  </p>
                </button>
                <button onClick={goToEvaluation} className="mt-3 w-full py-3 rounded-xl text-sm font-medium text-amber-300 hover:bg-amber-500/20 transition-colors border border-amber-500/30">
                  Ukončit hlasování
                </button>
              </div>

              {/* Active players per team */}
              {roundType !== 'power' && tData?.activePlayerMap && (
                <div className="px-4 py-3" style={{ borderBottom: '1px solid #334155' }}>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Odpovídá</p>
                  <div className="space-y-1.5">
                    {Object.entries(tData.activePlayerMap).map(([teamId, studentId]) => {
                      const team = tData.teams[teamId];
                      const student = students[studentId];
                      if (!team || !student) return null;
                      const hasAnswered = (student.responses || []).some((r: any) => r.slideId === currentSlide.id);
                      return (
                        <div key={teamId} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: `${team.color}20`, borderLeft: `3px solid ${team.color}` }}>
                          <span className="text-sm">{team.emoji}</span>
                          <span className="text-sm text-white truncate flex-1 font-medium">{student.name}</span>
                          {hasAnswered && <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Team scores */}
              <div className="flex-1 overflow-y-auto p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Skóre týmů</p>
                <div className="space-y-2">
                  {teamsSorted.map(([tid, team], i) => (
                    <div key={tid} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ backgroundColor: `${team.color}15` }}>
                      <span className="text-lg">{team.emoji}</span>
                      <span className="text-sm font-bold truncate flex-1" style={{ color: team.color }}>{team.name}</span>
                      <span className="text-lg font-black text-yellow-400">{team.score}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-4 py-3 text-center text-xs text-slate-500" style={{ borderTop: '1px solid #334155' }}>
                Slide {currentSlideIndex + 1}/{totalSlides}
              </div>
            </>
          ) : (
            <>
              <div className="p-4 text-center" style={{ borderBottom: '1px solid #334155' }}>
                <p className="text-sm text-slate-400">Tento slide není soutěžní</p>
                <p className="text-xs text-slate-500 mt-1">Pokračujte šipkami</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Skóre týmů</p>
                <div className="space-y-2">
                  {teamsSorted.map(([tid, team]) => (
                    <div key={tid} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ backgroundColor: `${team.color}15` }}>
                      <span className="text-lg">{team.emoji}</span>
                      <span className="text-sm font-bold truncate flex-1" style={{ color: team.color }}>{team.name}</span>
                      <span className="text-lg font-black text-yellow-400">{team.score}</span>
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
  // RENDER: EVALUATION
  // ================================================================
  if (phase === 'evaluation' && currentSlide) {
    const bgColor = currentSlide.backgroundColor || '#ffffff';
    const evaluated = tData?.evaluated;
    const roundType = tData?.currentRoundType || 'normal';

    return (
      <div className="flex h-full relative">
        {renderQRPopup()}
        {renderCloseBtn()}

        <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#1e2533', minHeight: 0 }}>
          <div className="flex items-end justify-center flex-shrink-0" style={{ height: 40, paddingBottom: 8 }}>
            <div className="w-1/2 max-w-xl flex items-center gap-1.5">
              {renderProgressBar()}
            </div>
          </div>

          <div className="flex-1 flex items-stretch overflow-hidden" style={{ minHeight: 0, paddingBottom: 5 }}>
            <div className="flex flex-shrink-0 items-center justify-center" style={{ width: 65 }}>
              <button onClick={prevSlide} disabled={currentSlideIndex === 0}
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
              <button onClick={currentSlideIndex >= totalSlides - 1 ? goToResults : nextSlide}
                className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ease-out hover:h-28 hover:rounded-full bg-white/10 text-white/70"
                style={{ transitionProperty: 'height, background-color' }}
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className={`w-80 flex flex-col text-white flex-shrink-0 overflow-hidden ${roundType === 'power' ? 'special-round-power' : roundType === 'double' ? 'special-round-double' : tData?.tipRoundActive ? 'special-round-tip' : ''}`} style={{ backgroundColor: '#1e2533' }}>
          {/* Evaluate / Next button */}
          <div className="p-4" style={{ borderBottom: '1px solid #334155' }}>
            {!evaluated ? (
              <button onClick={evaluateAnswers} className="w-full py-3 rounded-2xl text-white font-bold text-lg transition-all hover:scale-[1.03] active:scale-[0.97] shadow-lg" style={{ backgroundColor: '#7C3AED' }}>
                Vyhodnotit
              </button>
            ) : (
              <button onClick={nextSlide} className="w-full py-3 rounded-2xl text-white font-bold text-lg transition-all hover:scale-[1.03] active:scale-[0.97] shadow-lg flex items-center justify-center gap-2" style={{ backgroundColor: '#7C3AED' }}>
                {currentSlideIndex + 1 >= totalSlides ? 'Výsledky' : 'Další'}
                <SkipForward className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Round info */}
          {(roundType === 'power' || roundType === 'double') && (
            <div className="px-4 py-2 text-center" style={{ borderBottom: '1px solid #334155' }}>
              {roundType === 'power' && <span className="text-xs font-bold text-purple-400">⚡ POWER KOLO</span>}
              {roundType === 'double' && <span className="text-xs font-bold text-amber-400">x2 DVOJITÉ BODY</span>}
            </div>
          )}

          {/* Answers per team */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {Object.entries(tData?.teams || {}).map(([teamId, team]) => {
                const activePlayer = tData?.activePlayerMap?.[teamId];
                const respondents = roundType === 'power' ? team.memberIds : (activePlayer ? [activePlayer] : []);

                return (
                  <div key={teamId}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{team.emoji}</span>
                      <span className="text-sm font-bold" style={{ color: team.color }}>{team.name}</span>
                      <span className="text-lg font-black text-yellow-400 ml-auto">{team.score}</span>
                    </div>
                    <div className="space-y-1">
                      {respondents.map(sid => {
                        const student = students[sid];
                        if (!student) return null;
                        const response = (student.responses || []).find((r: any) => r.slideId === currentSlide.id);
                        let answerLabel = '—';
                        let answerBg = '#334155';
                        if (response) {
                          if ((currentSlide as any).activityType === 'abc') {
                            const optIdx = ((currentSlide as any).options || []).findIndex((o: any) => o.id === response.answer);
                            answerLabel = optIdx >= 0 ? String.fromCharCode(65 + optIdx) : '?';
                          } else { answerLabel = String(response.answer || '').substring(0, 15); }
                          answerBg = evaluated ? (response.isCorrect ? '#10b981' : '#ef4444') : team.color;
                        }
                        return (
                          <div key={sid} className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                            <span className="text-xs text-white truncate flex-1">{student.name}</span>
                            <div className="px-2 py-0.5 rounded text-xs font-bold flex-shrink-0" style={{ backgroundColor: answerBg, color: '#fff' }}>{answerLabel}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ================================================================
  // RENDER: RESULTS
  // ================================================================
  if (phase === 'results') {
    return (
      <div className="flex h-full relative">
        {renderCloseBtn()}

        {/* Left: animation */}
        <div className="flex-1 overflow-hidden relative" style={{ backgroundColor: '#ffffff' }}>
          <div className="absolute pointer-events-none" style={{ bottom: 0, left: '-10%', right: '-10%', transform: 'scale(1.26)', transformOrigin: 'bottom center' }}>
            <LottieAnimation url={ASSETS.final} loop autoplay className="w-full" />
          </div>
        </div>

        {/* Right panel — final team ranking */}
        <div className="w-80 flex flex-col text-white flex-shrink-0" style={{ backgroundColor: '#1e2533' }}>
          <div className="px-4 py-4 text-center" style={{ borderBottom: '1px solid #334155' }}>
            <p className="text-lg font-bold">Konečné pořadí</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-3">
              {teamsSorted.map(([tid, team], i) => {
                const medalColors = ['#FBBF24', '#C0C0C0', '#CD7F32'];
                return (
                  <div key={tid}>
                    <div className="flex items-center gap-3 px-4 py-4 rounded-2xl" style={{ backgroundColor: i < 3 ? `${team.color}20` : 'rgba(255,255,255,0.03)', border: i === 0 ? `2px solid ${team.color}` : 'none' }}>
                      {i < 3 ? (
                        <span className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-black flex-shrink-0" style={{ backgroundColor: medalColors[i], color: '#1e293b' }}>{i + 1}</span>
                      ) : (
                        <span className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ backgroundColor: '#334155', color: '#94a3b8' }}>{i + 1}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{team.emoji}</span>
                          <span className={`font-bold truncate ${i === 0 ? 'text-lg' : 'text-sm'}`} style={{ color: team.color }}>{team.name}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(team.memberIds || []).map(mid => {
                            const s = students[mid];
                            return s ? <span key={mid} className="text-xs text-slate-400">{s.name}</span> : null;
                          })}
                        </div>
                      </div>
                      <span className="text-2xl font-black text-yellow-400 flex-shrink-0">{team.score}</span>
                    </div>
                  </div>
                );
              })}
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

  return <div className="flex items-center justify-center h-full text-white text-xl">Načítání...</div>;
}
