import type { ReactNode } from 'react';
import {
  AlertTriangle,
  BarChart2,
  CheckCircle,
  ChevronDown,
  Copy,
  Crosshair,
  Lock,
  MessageSquare,
  Share2,
  StopCircle,
  Swords,
  Unlock,
  Users,
  Vote,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { LiveQuizSession, Quiz, SlideResponse } from '../../../../../types/quiz';

interface LiveStudent {
  name: string;
  joinedAt: string;
  currentSlide: number;
  responses: SlideResponse[];
  isOnline: boolean;
  isFocused?: boolean;
  lastSeen?: string;
  deviceId?: string;
}

interface BoardPost {
  authorId?: string;
  text?: string;
}

interface VoteState {
  selectedOptions?: string[];
}

interface BoardViewLiveSessionPanelProps {
  session: LiveQuizSession | null;
  sessionCode: string;
  showModeDropdown: boolean;
  onToggleModeDropdown: () => void;
  onCloseModeDropdown: () => void;
  onSelectTeacherPresent: () => void;
  onSelectStudentsSelf: () => void;
  onStartCompetition: () => void;
  onStartTeamCompetition: () => void;
  onStartDuelCompetition: () => void;
  onStartTacticalCompetition: () => void;
  onOpenQrPopup: (mode: 'qr' | 'code') => void;
  onCopyLink: (text: string) => void;
  copied: boolean;
  students: Array<[string, LiveStudent]>;
  onlineStudentsCount: number;
  quiz: Quiz;
  currentSlideIndex: number;
  votingVotes: Record<string, VoteState>;
  boardPosts: BoardPost[];
  evaluateControls?: ReactNode;
  onViewResults: () => void;
  onOpenEndDialog: () => void;
  showEndDialog: boolean;
  endDialog?: ReactNode;
}

export function BoardViewLiveSessionPanel({
  session,
  sessionCode,
  showModeDropdown,
  onToggleModeDropdown,
  onCloseModeDropdown,
  onSelectTeacherPresent,
  onSelectStudentsSelf,
  onStartCompetition,
  onStartTeamCompetition,
  onStartDuelCompetition,
  onStartTacticalCompetition,
  onOpenQrPopup,
  onCopyLink,
  copied,
  students,
  onlineStudentsCount,
  quiz,
  currentSlideIndex,
  votingVotes,
  boardPosts,
  evaluateControls,
  onViewResults,
  onOpenEndDialog,
  showEndDialog,
  endDialog,
}: BoardViewLiveSessionPanelProps) {
  return (
    <div className="flex flex-col h-full text-white" style={{ backgroundColor: '#1e2533' }}>
      <div className="px-4 py-3" style={{ borderBottom: '1px solid #334155' }}>
        <div className="relative">
          <button
            onClick={onToggleModeDropdown}
            className="w-full flex items-center justify-between p-3 rounded-xl transition-colors"
            style={{ backgroundColor: '#334155' }}
          >
            <div className="flex items-center gap-3">
              {(session?.isLocked ?? true) ? (
                <Lock className="w-5 h-5" style={{ color: '#94a3b8' }} />
              ) : (
                <Unlock className="w-5 h-5" style={{ color: '#4ade80' }} />
              )}
              <div className="text-left">
                <p className="text-xs" style={{ color: '#64748b' }}>Promítat:</p>
                <p className="text-sm font-medium" style={{ color: '#ffffff' }}>
                  {(session?.isLocked ?? true) ? 'Učitel prezentuje' : 'Studenti sami'}
                </p>
              </div>
            </div>
            <ChevronDown
              className={`w-5 h-5 transition-transform ${showModeDropdown ? 'rotate-180' : ''}`}
              style={{ color: '#94a3b8' }}
            />
          </button>

          {showModeDropdown && (
            <div
              className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-10 shadow-lg"
              style={{ backgroundColor: '#334155' }}
            >
              <button
                onClick={onSelectTeacherPresent}
                className={`w-full flex items-center gap-3 p-3 text-left hover:bg-slate-600/50 transition-colors ${(session?.isLocked ?? true) ? 'bg-slate-600/30' : ''}`}
              >
                <Lock className="w-4 h-4" style={{ color: '#94a3b8' }} />
                <span className="text-sm text-white">Učitel prezentuje</span>
                {(session?.isLocked ?? true) && <CheckCircle className="w-4 h-4 ml-auto" style={{ color: '#4ade80' }} />}
              </button>
              <button
                onClick={onSelectStudentsSelf}
                className={`w-full flex items-center gap-3 p-3 text-left hover:bg-slate-600/50 transition-colors ${!(session?.isLocked ?? true) ? 'bg-slate-600/30' : ''}`}
              >
                <Unlock className="w-4 h-4" style={{ color: '#94a3b8' }} />
                <span className="text-sm text-white">Studenti sami</span>
                {!(session?.isLocked ?? true) && <CheckCircle className="w-4 h-4 ml-auto" style={{ color: '#4ade80' }} />}
              </button>
              <button onClick={onStartCompetition} className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-600/50 transition-colors">
                <BarChart2 className="w-4 h-4" style={{ color: '#94a3b8' }} />
                <span className="text-sm text-white">Soutěž</span>
              </button>
              <button onClick={onStartTeamCompetition} className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-600/50 transition-colors">
                <Users className="w-4 h-4" style={{ color: '#94a3b8' }} />
                <span className="text-sm text-white">Týmová soutěž</span>
              </button>
              <button onClick={onStartDuelCompetition} className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-600/50 transition-colors">
                <Swords className="w-4 h-4" style={{ color: '#94a3b8' }} />
                <span className="text-sm text-white">Duely</span>
              </button>
              <button onClick={onCloseModeDropdown} className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-600/50 transition-colors">
                <Share2 className="w-4 h-4" style={{ color: '#94a3b8' }} />
                <span className="text-sm text-white">Sdílet odkaz</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="p-4" style={{ borderBottom: '1px solid #334155' }}>
        <p className="text-center text-white/80 text-sm mb-2">
          Připojte se na <span className="font-medium text-white">{window.location.host}{import.meta.env.BASE_URL || ''}/go</span>
        </p>
        <div className="text-center mb-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => onOpenQrPopup('code')} title="Zobrazit kód přes celou obrazovku">
          <span className="text-white/70 text-xl">Kód: </span>
          <span className="text-yellow-400 text-xl font-bold tracking-wider">{sessionCode}</span>
        </div>
        <div className="flex justify-center mb-3 cursor-pointer transition-all group" onClick={() => onOpenQrPopup('qr')} title="Zobrazit QR kód přes celou obrazovku">
          <div className="bg-white p-3 rounded-xl transition-all group-hover:ring-4 group-hover:ring-orange-400">
            <QRCodeSVG value={`${window.location.origin}${import.meta.env.BASE_URL || '/'}go/${sessionCode}`} size={180} level="M" />
          </div>
        </div>
        <div className="flex justify-center">
          <button
            onClick={() => onCopyLink(`${window.location.origin}${import.meta.env.BASE_URL || '/'}go/${sessionCode}`)}
            className="py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium hover:opacity-90"
            style={{ backgroundColor: '#f59e0b', color: '#1e293b', width: '206px' }}
          >
            {copied ? (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Zkopírováno!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Kopírovat odkaz</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2" style={{ color: '#94a3b8' }}>
            <Users className="w-4 h-4" />
            <span className="text-sm">Připojení studenti</span>
          </div>
          <span className="font-bold" style={{ color: '#ffffff' }}>{onlineStudentsCount}</span>
        </div>

        {students.length === 0 ? (
          <div className="text-center py-8" style={{ color: '#64748b' }}>
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Čekám na studenty...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {students.map(([id, student]) => {
              const totalSlides = quiz?.slides.length || 1;
              const studentSlide = student.currentSlide || 0;
              const progressPercent = ((studentSlide + 1) / totalSlides) * 100;
              const studentResponses = student.responses || [];
              const correctCount = studentResponses.filter(r => r.isCorrect === true).length;
              const wrongCount = studentResponses.filter(r => r.isCorrect === false).length;
              const hasFinished = studentResponses.length >= (quiz?.slides.filter(s => s.type === 'activity').length || 0);
              const isDistracted = student.isOnline && student.isFocused === false;
              const currentSlideData = quiz?.slides[currentSlideIndex];
              const currentSlideResponse = studentResponses.find(r => r.slideId === currentSlideData?.id);
              let answerLabel = '';
              let answerColor = '#7C3AED';

              if (currentSlideData?.type === 'activity') {
                const activityType = (currentSlideData as any).activityType;

                if (activityType === 'abc' && currentSlideResponse) {
                  const optionIndex = (currentSlideData as any).options?.findIndex((o: any) => o.id === currentSlideResponse.answer);
                  if (optionIndex >= 0) {
                    answerLabel = String.fromCharCode(65 + optionIndex);
                  }
                } else if (activityType === 'open' && currentSlideResponse) {
                  answerLabel = String(currentSlideResponse.answer).substring(0, 10) + (String(currentSlideResponse.answer).length > 10 ? '...' : '');
                } else if (activityType === 'voting') {
                  const studentVote = votingVotes[id];
                  if (studentVote && studentVote.selectedOptions?.length) {
                    const votedOptions = studentVote.selectedOptions.map(optId => {
                      const optIndex = (currentSlideData as any).options?.findIndex((o: any) => o.id === optId);
                      return optIndex >= 0 ? String.fromCharCode(65 + optIndex) : '?';
                    });
                    answerLabel = votedOptions.join(', ');
                    answerColor = '#0ea5e9';
                  }
                } else if (activityType === 'board') {
                  const studentPosts = boardPosts.filter(post => post.authorId === id);
                  if (studentPosts.length > 0) {
                    const lastPost = studentPosts[studentPosts.length - 1];
                    answerLabel = `${studentPosts.length}× ${lastPost.text?.substring(0, 8) || ''}${(lastPost.text?.length || 0) > 8 ? '...' : ''}`;
                    answerColor = '#10b981';
                  }
                }
              }

              return (
                <div
                  key={id}
                  className="flex items-center gap-3 p-3 rounded-lg transition-colors"
                  style={{
                    backgroundColor: isDistracted ? 'rgba(251, 146, 60, 0.2)' : 'rgba(51, 65, 85, 0.5)',
                    borderLeft: isDistracted ? '3px solid #fb923c' : '3px solid transparent',
                  }}
                >
                  {isDistracted ? (
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: '#fb923c' }} />
                  ) : (
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: student.isOnline ? '#4ade80' : '#64748b' }} />
                  )}

                  <span className="text-sm flex-1 truncate" style={{ color: isDistracted ? '#fb923c' : '#ffffff' }}>
                    {student.name}
                  </span>

                  {(session?.isLocked ?? true) && currentSlideData?.type === 'activity' ? (
                    answerLabel ? (
                      <div
                        className="px-2 py-1 rounded text-xs font-bold flex-shrink-0 max-w-[120px] truncate flex items-center gap-1"
                        style={{
                          backgroundColor: currentSlideResponse?.isCorrect === true ? '#4ade80' :
                            currentSlideResponse?.isCorrect === false ? '#f87171' : answerColor,
                          color: '#ffffff',
                        }}
                        title={answerLabel}
                      >
                        {(currentSlideData as any).activityType === 'voting' && <Vote className="w-3 h-3" />}
                        {(currentSlideData as any).activityType === 'board' && <MessageSquare className="w-3 h-3" />}
                        <span className="truncate">{answerLabel}</span>
                      </div>
                    ) : (
                      <span className="text-xs flex-shrink-0" style={{ color: '#64748b' }}>—</span>
                    )
                  ) : hasFinished ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-medium" style={{ color: '#4ade80' }}>{correctCount}✓</span>
                      <span className="text-xs font-medium" style={{ color: '#f87171' }}>{wrongCount}✗</span>
                    </div>
                  ) : (session?.isLocked === false) ? (
                    <div className="w-20 h-2 rounded-full overflow-hidden flex-shrink-0" style={{ backgroundColor: '#1e2533' }}>
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${progressPercent}%`,
                          backgroundColor: isDistracted ? '#fb923c' : (studentSlide === currentSlideIndex ? '#7C3AED' : '#475569'),
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-4 space-y-2" style={{ borderTop: '1px solid #334155' }}>
        {evaluateControls}
        <div className="flex gap-2">
          <button
            onClick={onViewResults}
            className="flex-1 py-2 rounded-lg text-white text-sm flex items-center justify-center gap-1 transition-colors"
            style={{ backgroundColor: '#334155' }}
          >
            <BarChart2 className="w-4 h-4" />
            Výsledky
          </button>
          <button
            onClick={onOpenEndDialog}
            className="flex-1 py-2 rounded-lg text-white text-sm flex items-center justify-center gap-1"
            style={{ backgroundColor: '#dc2626' }}
          >
            <StopCircle className="w-4 h-4" />
            Ukončit
          </button>
        </div>
      </div>

      {showEndDialog && endDialog}
    </div>
  );
}
