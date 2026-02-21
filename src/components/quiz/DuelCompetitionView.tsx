import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ref, update } from 'firebase/database';
import { database } from '../../utils/firebase-config';
import { QRCodeSVG } from 'qrcode.react';
import Lottie from 'lottie-react';
import { Copy, CheckCircle, Users, Play, SkipForward, X, ArrowRight, ArrowLeft, Swords } from 'lucide-react';
import { Quiz, LiveQuizSession, CompetitionPhase, QuizSlide } from '../../types/quiz';

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
const DUEL_COLOR = '#FF6B35';

const SCORABLE_TYPES = new Set(['abc', 'open', 'example', 'trueFalse']);
function isScorableSlide(slide: QuizSlide): boolean {
  return slide.type === 'activity' && SCORABLE_TYPES.has((slide as any).activityType);
}

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

interface DuelCompetitionViewProps {
  session: LiveQuizSession;
  sessionId: string;
  quiz: Quiz;
  sessionCode: string;
  onEnd: () => void;
  renderSlide: (slide: QuizSlide) => React.ReactNode;
}

export default function DuelCompetitionView({ session, sessionId, quiz, sessionCode, onEnd, renderSlide }: DuelCompetitionViewProps) {
  const phase = (session.competitionPhase || 'lobby') as CompetitionPhase;
  const dData = session.duelCompetitionData;
  const students = session.students || {};
  const studentEntries = Object.entries(students);
  const onlineCount = studentEntries.filter(([, s]) => s.isOnline).length;

  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIMER);
  const [showQRPopup, setShowQRPopup] = useState<'qr' | 'code' | null>(null);
  const [duelsCreated, setDuelsCreated] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audio = useAudio();

  const currentSlideIndex = session.currentSlideIndex || 0;
  const currentSlide = quiz.slides[currentSlideIndex];
  const totalSlides = quiz.slides.length;
  const isScorable = currentSlide ? isScorableSlide(currentSlide) : false;

  const scorableSlides = useMemo(() => quiz.slides.filter(isScorableSlide), [quiz.slides]);

  const duelEntries = useMemo(() => {
    if (!dData?.duels) return [];
    return Object.entries(dData.duels);
  }, [dData?.duels]);

  const joinLink = `${window.location.origin}${import.meta.env.BASE_URL || '/'}go/${sessionCode}`;

  const updateSession = useCallback((data: Record<string, any>) => {
    update(ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}`), data);
  }, [sessionId]);

  // Track if duels were created
  useEffect(() => {
    if (dData?.duels && Object.keys(dData.duels).length > 0) {
      setDuelsCreated(true);
    }
  }, [dData?.duels]);

  // Timer logic
  useEffect(() => {
    if (phase !== 'question' || !isScorable || !dData?.timerStartedAt || dData?.timerPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const tick = () => {
      const elapsed = (Date.now() - new Date(dData.timerStartedAt!).getTime()) / 1000;
      const duration = dData.timerDuration || DEFAULT_TIMER;
      const remaining = Math.max(0, duration - elapsed);
      setTimeLeft(Math.ceil(remaining));
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        goToEvaluation();
      }
    };
    tick();
    timerRef.current = setInterval(tick, 200);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, isScorable, dData?.timerStartedAt, dData?.timerPaused, dData?.timerDuration]);

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

  const goToEvaluation = useCallback(() => {
    updateSession({
      competitionPhase: 'evaluation',
      duelCompetitionData: {
        ...dData,
        timerStartedAt: null,
        timerPaused: false,
        evaluated: false,
      },
    });
  }, [dData, updateSession]);

  const goToSlide = useCallback((idx: number) => {
    const slide = quiz.slides[idx];
    if (!slide) return;

    if (isScorableSlide(slide)) {
      const qPlayed = (dData?.questionsPlayed || 0);
      updateSession({
        competitionPhase: 'question',
        currentSlideIndex: idx,
        showResults: false,
        duelCompetitionData: {
          ...dData,
          currentQuestionIndex: scorableSlides.findIndex(s => s.id === slide.id),
          timerStartedAt: new Date().toISOString(),
          timerDuration: DEFAULT_TIMER,
          timerPaused: false,
          evaluated: false,
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
  }, [quiz.slides, dData, scorableSlides, updateSession]);

  const createDuels = useCallback(() => {
    const ids = studentEntries.filter(([, s]) => s.isOnline).map(([id]) => id);
    if (ids.length < 2) return;

    // Shuffle
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }

    const duels: Record<string, { playerIds: string[]; scores: Record<string, number> }> = {};
    const studentDuelMap: Record<string, string> = {};
    let duelIdx = 0;

    // If odd, last 3 form a triple
    const hasTriple = ids.length % 2 !== 0;
    const pairEnd = hasTriple ? ids.length - 3 : ids.length;

    for (let i = 0; i < pairEnd; i += 2) {
      const duelId = `duel_${duelIdx}`;
      const p1 = ids[i], p2 = ids[i + 1];
      duels[duelId] = { playerIds: [p1, p2], scores: { [p1]: 0, [p2]: 0 } };
      studentDuelMap[p1] = duelId;
      studentDuelMap[p2] = duelId;
      duelIdx++;
    }

    if (hasTriple) {
      const duelId = `duel_${duelIdx}`;
      const p1 = ids[pairEnd], p2 = ids[pairEnd + 1], p3 = ids[pairEnd + 2];
      duels[duelId] = { playerIds: [p1, p2, p3], scores: { [p1]: 0, [p2]: 0, [p3]: 0 } };
      studentDuelMap[p1] = duelId;
      studentDuelMap[p2] = duelId;
      studentDuelMap[p3] = duelId;
    }

    updateSession({
      duelCompetitionData: {
        duels,
        studentDuelMap,
        timerDuration: DEFAULT_TIMER,
        timerPaused: false,
        evaluated: false,
        questionSlideIds: scorableSlides.map(s => s.id),
        currentQuestionIndex: 0,
        questionsPlayed: 0,
      },
    });
  }, [studentEntries, scorableSlides, updateSession]);

  const startCountdown = useCallback(() => {
    updateSession({ competitionPhase: 'countdown' });
    setTimeout(() => goToSlide(0), 4000);
  }, [updateSession, goToSlide]);

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

  const evaluateAnswers = () => {
    const slideId = currentSlide?.id;
    if (!slideId || !dData) return;
    const updatedDuels = { ...dData.duels };

    Object.entries(dData.duels).forEach(([duelId, duel]) => {
      const results: Record<string, boolean> = {};

      // Check each player's answer
      duel.playerIds.forEach(pid => {
        const student = students[pid];
        const response = (student?.responses || []).find((r: any) => r.slideId === slideId);
        if (response) {
          const isCorrect = checkCorrect(currentSlide, response);
          const responses = student.responses.map((r: any) => r.slideId === slideId ? { ...r, isCorrect, points: isCorrect ? 1 : 0 } : r);
          update(ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/students/${pid}`), { responses });
          results[pid] = isCorrect;
        } else {
          results[pid] = false;
        }
      });

      // Count how many got it right
      const correctCount = Object.values(results).filter(Boolean).length;
      const updatedScores = { ...duel.scores };

      duel.playerIds.forEach(pid => {
        if (results[pid]) {
          // Bonus: if you're the ONLY one correct in the duel, +2 instead of +1
          updatedScores[pid] = (updatedScores[pid] || 0) + (correctCount === 1 ? 2 : 1);
        }
      });

      updatedDuels[duelId] = { ...duel, scores: updatedScores };
    });

    updateSession({
      showResults: true,
      duelCompetitionData: { ...dData, evaluated: true, duels: updatedDuels },
    });
    audio.play(ASSETS.evaluationRevealMusic);
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
    if (!dData) return;
    if (dData.timerPaused) {
      const newStart = new Date(Date.now() - (DEFAULT_TIMER - timeLeft) * 1000).toISOString();
      updateSession({ duelCompetitionData: { ...dData, timerPaused: false, timerStartedAt: newStart } });
    } else {
      updateSession({ duelCompetitionData: { ...dData, timerPaused: true } });
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
          style={{ backgroundColor: DUEL_COLOR, color: '#fff', width: '206px' }}
        >
          {copied ? <><CheckCircle className="w-4 h-4" /><span>Zkopírováno!</span></> : <><Copy className="w-4 h-4" /><span>Kopírovat odkaz</span></>}
        </button>
      </div>
    </div>
  );

  const renderCloseBtn = () => (
    <button onClick={onEnd} className="absolute top-3 left-4 z-30 w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors bg-white/10 text-white/70 hover:bg-white/20 hover:text-white" title="Zavřít soutěž">
      <X className="w-5 h-5" />
    </button>
  );

  // Helper: render a duel card for the right panel
  const renderDuelCard = (duelId: string, duel: { playerIds: string[]; scores: Record<string, number> }, showAnswers = false) => {
    const isTriple = duel.playerIds.length > 2;
    return (
      <div key={duelId} className="rounded-xl overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: `1px solid ${DUEL_COLOR}30` }}>
        {duel.playerIds.map((pid, pidx) => {
          const student = students[pid];
          if (!student) return null;
          const score = duel.scores[pid] || 0;
          const hasAnswered = showAnswers && currentSlide && (student.responses || []).some((r: any) => r.slideId === currentSlide.id);
          const response = showAnswers && currentSlide ? (student.responses || []).find((r: any) => r.slideId === currentSlide.id) : null;

          let answerBadge = null;
          if (showAnswers && response && dData?.evaluated) {
            answerBadge = (
              <div className="px-2 py-0.5 rounded text-xs font-bold flex-shrink-0" style={{ backgroundColor: response.isCorrect ? '#10b981' : '#ef4444', color: '#fff' }}>
                {response.isCorrect ? '✓' : '✗'}
              </div>
            );
          } else if (showAnswers && hasAnswered) {
            answerBadge = <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0" />;
          }

          return (
            <React.Fragment key={pid}>
              {pidx > 0 && (
                <div className="flex items-center justify-center py-0.5" style={{ backgroundColor: `${DUEL_COLOR}15` }}>
                  <span className="text-xs font-black" style={{ color: DUEL_COLOR }}>VS</span>
                </div>
              )}
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="text-sm text-white truncate flex-1 font-medium">{student.name}</span>
                {answerBadge}
                <span className="text-sm font-black ml-1" style={{ color: DUEL_COLOR }}>{score}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // ================================================================
  // RENDER: LOBBY
  // ================================================================
  if (phase === 'lobby') {
    return (
      <div className="flex h-full relative">
        {renderQRPopup()}
        {renderCloseBtn()}

        <div className="flex-1 overflow-hidden relative" style={{ backgroundColor: '#ffffff' }}>
          <div className="absolute bottom-0 left-0 right-0" style={{ zIndex: 1, pointerEvents: 'none' }}>
            <LottieAnimation url={ASSETS.fight} loop autoplay className="w-full" style={{ pointerEvents: 'none' }} />
          </div>

          <div className="absolute inset-0 flex flex-col items-center" style={{ paddingTop: 80, zIndex: 20 }}>
            <h1 className="text-4xl font-bold mb-6 drop-shadow-sm" style={{ color: DUEL_COLOR, textShadow: '0 2px 8px rgba(255,255,255,0.8)' }}>
              Souboje
            </h1>

            {!duelsCreated ? (
              <div className="flex flex-col items-center gap-4">
                <p className="text-lg text-slate-600 font-medium">Připojte studenty a rozlosujte souboje</p>
                <button
                  onClick={createDuels}
                  className="py-3 px-8 rounded-2xl text-white font-bold text-lg transition-all hover:scale-[1.03] active:scale-[0.97] shadow-xl flex items-center gap-3"
                  style={{ backgroundColor: onlineCount >= 2 ? DUEL_COLOR : '#94a3b8', opacity: onlineCount >= 2 ? 1 : 0.6, cursor: onlineCount >= 2 ? 'pointer' : 'not-allowed' }}
                >
                  <Swords className="w-6 h-6" />
                  Rozlosovat souboje
                </button>
                {onlineCount < 2 && <p className="text-sm text-slate-400">Potřebujete alespoň 2 studenty</p>}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                {/* Duel preview cards */}
                <div className="flex flex-wrap justify-center gap-3 max-w-2xl px-4">
                  {duelEntries.map(([duelId, duel]) => (
                    <div key={duelId} className="rounded-2xl shadow-lg px-5 py-3 flex flex-col items-center" style={{ backgroundColor: 'rgba(255,255,255,0.95)', minWidth: 160 }}>
                      {duel.playerIds.map((pid, i) => {
                        const s = students[pid];
                        return (
                          <React.Fragment key={pid}>
                            {i > 0 && <span className="text-xs font-black my-1" style={{ color: DUEL_COLOR }}>VS</span>}
                            <span className="text-sm font-bold text-slate-700">{s?.name || '?'}</span>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => startCountdown()}
                  className="py-4 rounded-2xl text-white font-bold text-xl transition-all flex items-center justify-center gap-3 shadow-xl hover:scale-[1.03] active:scale-[0.97]"
                  style={{ backgroundColor: DUEL_COLOR, width: '100%', maxWidth: 400 }}
                >
                  <Play className="w-7 h-7" />
                  Zahájit souboje
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="w-80 flex flex-col text-white flex-shrink-0" style={{ backgroundColor: '#1e2533' }}>
          {renderQRSection()}
          <div className="flex-1 overflow-y-auto p-4">
            {duelsCreated ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Souboje</p>
                {duelEntries.map(([duelId, duel]) => renderDuelCard(duelId, duel))}
              </div>
            ) : (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Studenti ({onlineCount})</p>
                <div className="space-y-1">
                  {studentEntries.filter(([, s]) => s.isOnline).map(([id, s]) => (
                    <div key={id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#10b981' }} />
                      <span className="text-xs text-white truncate">{s.name}</span>
                    </div>
                  ))}
                </div>
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
        <div className="w-80 flex flex-col text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: '#1e2533' }}>
          {isScorable ? (
            <>
              <div className="p-4 flex flex-col items-center" style={{ borderBottom: '1px solid #334155' }}>
                <button onClick={toggleTimer} className="group cursor-pointer w-full text-center">
                  <div className="font-mono font-bold transition-colors leading-none" style={{ fontSize: 'min(9rem, 28vw)', color: timeLeft <= 10 ? '#ef4444' : timeLeft <= 20 ? '#f59e0b' : '#ffffff' }}>
                    {timeLeft}
                  </div>
                  <p className="text-xs text-slate-500 mt-2 group-hover:text-slate-300 transition-colors">
                    {dData?.timerPaused ? '▶ Pokračovat' : '⏸ Pozastavit'}
                  </p>
                </button>
                <button onClick={goToEvaluation} className="mt-3 w-full py-3 rounded-xl text-sm font-medium text-amber-300 hover:bg-amber-500/20 transition-colors border border-amber-500/30">
                  Ukončit hlasování
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Souboje</p>
                <div className="space-y-3">
                  {duelEntries.map(([duelId, duel]) => renderDuelCard(duelId, duel, true))}
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
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Souboje</p>
                <div className="space-y-3">
                  {duelEntries.map(([duelId, duel]) => renderDuelCard(duelId, duel))}
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
    const evaluated = dData?.evaluated;

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
        <div className="w-80 flex flex-col text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: '#1e2533' }}>
          <div className="p-4" style={{ borderBottom: '1px solid #334155' }}>
            {!evaluated ? (
              <button onClick={evaluateAnswers} className="w-full py-3 rounded-2xl text-white font-bold text-lg transition-all hover:scale-[1.03] active:scale-[0.97] shadow-lg" style={{ backgroundColor: DUEL_COLOR }}>
                Vyhodnotit
              </button>
            ) : (
              <button onClick={nextSlide} className="w-full py-3 rounded-2xl text-white font-bold text-lg transition-all hover:scale-[1.03] active:scale-[0.97] shadow-lg flex items-center justify-center gap-2" style={{ backgroundColor: DUEL_COLOR }}>
                {currentSlideIndex + 1 >= totalSlides ? 'Výsledky' : 'Další'}
                <SkipForward className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Výsledky duelů</p>
            <div className="space-y-3">
              {duelEntries.map(([duelId, duel]) => renderDuelCard(duelId, duel, true))}
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

        <div className="flex-1 overflow-hidden relative" style={{ backgroundColor: '#ffffff' }}>
          <div className="absolute pointer-events-none" style={{ bottom: 0, left: '-10%', right: '-10%', transform: 'scale(1.26)', transformOrigin: 'bottom center' }}>
            <LottieAnimation url={ASSETS.final} loop autoplay className="w-full" />
          </div>
        </div>

        <div className="w-80 flex flex-col text-white flex-shrink-0" style={{ backgroundColor: '#1e2533' }}>
          <div className="px-4 py-4 text-center" style={{ borderBottom: '1px solid #334155' }}>
            <p className="text-lg font-bold">Výsledky soubojů</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {duelEntries.map(([duelId, duel]) => {
                const sorted = [...duel.playerIds].sort((a, b) => (duel.scores[b] || 0) - (duel.scores[a] || 0));
                const topScore = duel.scores[sorted[0]] || 0;
                const isTie = sorted.length > 1 && (duel.scores[sorted[1]] || 0) === topScore;

                return (
                  <div key={duelId} className="rounded-2xl overflow-hidden" style={{ border: `2px solid ${DUEL_COLOR}40` }}>
                    {sorted.map((pid, i) => {
                      const s = students[pid];
                      if (!s) return null;
                      const score = duel.scores[pid] || 0;
                      const isWinner = !isTie && i === 0 && topScore > 0;
                      return (
                        <React.Fragment key={pid}>
                          {i > 0 && (
                            <div className="flex items-center justify-center py-0.5" style={{ backgroundColor: `${DUEL_COLOR}20` }}>
                              <span className="text-xs font-black" style={{ color: DUEL_COLOR }}>VS</span>
                            </div>
                          )}
                          <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: isWinner ? `${DUEL_COLOR}15` : 'transparent' }}>
                            {isWinner && <span className="text-lg">🏆</span>}
                            <span className={`text-sm font-bold truncate flex-1 ${isWinner ? 'text-white' : 'text-slate-300'}`}>{s.name}</span>
                            <span className="text-xl font-black" style={{ color: isWinner ? DUEL_COLOR : '#94a3b8' }}>{score}</span>
                          </div>
                        </React.Fragment>
                      );
                    })}
                    {isTie && topScore > 0 && (
                      <div className="text-center py-1 text-xs font-bold" style={{ color: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.1)' }}>Remíza!</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="p-4" style={{ borderTop: '1px solid #334155' }}>
            <button onClick={onEnd} className="w-full py-3 rounded-xl font-semibold text-white transition-colors hover:brightness-110" style={{ backgroundColor: DUEL_COLOR }}>
              Ukončit soutěž
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <div className="flex items-center justify-center h-full text-white text-xl">Načítání...</div>;
}
