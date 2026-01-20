import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronDown, 
  ChevronRight, 
  Flame, 
  Trophy, 
  Star, 
  Zap, 
  Target,
  Lock,
  CheckCircle2,
  Play,
  Crown,
  Medal,
  Users,
  TrendingUp,
  Calendar,
  Gift,
  Sparkles,
  Menu,
  X
} from 'lucide-react';
import VividLogo from '../imports/Group70';
import { ToolsMenu } from './ToolsMenu';
import { ToolsDropdown } from './ToolsDropdown';
import { useViewMode } from '../contexts/ViewModeContext';
import { 
  PracticeSubject, 
  PracticeChapter, 
  PracticeTopic, 
  PracticeExercise,
  PlayerProgress,
  LeaderboardEntry,
  Achievement,
  getPlayerLevel,
  getXpProgress,
  PLAYER_LEVELS,
  ACHIEVEMENTS
} from '../types/profile';
import {
  MOCK_PRACTICE_MATEMATIKA_6,
  MOCK_PLAYER_PROGRESS,
  MOCK_LEADERBOARD_CLASS,
  MOCK_LEADERBOARD_NATIONAL,
  AVAILABLE_MATH_GRADES,
  MATH_CHALLENGE_INFO,
  getUnlockedAchievements,
  getDifficultyColor
} from '../utils/mock-practice-data';

interface PracticeLayoutProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export function PracticeLayout({ theme, toggleTheme }: PracticeLayoutProps) {
  const navigate = useNavigate();
  const { viewMode } = useViewMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  
  // State
  const [selectedGrade, setSelectedGrade] = useState<number>(6);
  const [selectedSubject, setSelectedSubject] = useState<PracticeSubject>(MOCK_PRACTICE_MATEMATIKA_6);
  const [playerProgress, setPlayerProgress] = useState<PlayerProgress>(MOCK_PLAYER_PROGRESS);
  const [expandedChapters, setExpandedChapters] = useState<string[]>(['ch-prevody']);
  const [showLeaderboard, setShowLeaderboard] = useState<'class' | 'national' | null>(null);
  const [showAchievements, setShowAchievements] = useState(false);

  // Calculate challenge progress
  const challengeWeekProgress = (MATH_CHALLENGE_INFO.currentWeek / MATH_CHALLENGE_INFO.totalWeeks) * 100;

  // Note: This page is primarily for students but accessible to anyone for testing

  const currentLevel = getPlayerLevel(playerProgress.totalXp);
  const xpProgress = getXpProgress(playerProgress.totalXp);
  const unlockedAchievements = getUnlockedAchievements(playerProgress);

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters(prev => 
      prev.includes(chapterId) 
        ? prev.filter(id => id !== chapterId)
        : [...prev, chapterId]
    );
  };

  const handleExerciseClick = (exercise: PracticeExercise) => {
    if (exercise.status === 'locked') return;
    // TODO: Navigate to exercise
    alert(`Spouštím cvičení: ${exercise.title}`);
  };

  const getStatusStyles = (status: string): { className: string; style?: React.CSSProperties } => {
    switch (status) {
      case 'mastered':
        return { 
          className: 'text-white shadow-lg', 
          style: { background: 'linear-gradient(135deg, #facc15, #f59e0b)', boxShadow: '0 10px 15px -3px rgba(251, 191, 36, 0.3)' }
        };
      case 'completed':
        return { 
          className: 'text-white shadow-lg', 
          style: { background: 'linear-gradient(135deg, #34d399, #22c55e)', boxShadow: '0 10px 15px -3px rgba(34, 197, 94, 0.3)' }
        };
      case 'in_progress':
        return { 
          className: 'text-white shadow-lg', 
          style: { background: 'linear-gradient(135deg, #60a5fa, #6366f1)', boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3)' }
        };
      case 'available':
        return { 
          className: 'bg-white border-2 border-slate-200 text-slate-700 hover:border-blue-400 hover:shadow-lg' 
        };
      case 'locked':
        return { 
          className: 'bg-slate-100 border-2 border-slate-200 text-slate-400 cursor-not-allowed' 
        };
      default:
        return { className: 'bg-white border-2 border-slate-200 text-slate-700' };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="flex">
        {/* Left Sidebar */}
        <aside 
          className={`
            top-0 h-screen shrink-0 flex flex-col 
            transition-all duration-300 ease-in-out
            fixed left-0 z-30 w-[294px]
            ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
            lg:sticky lg:translate-x-0 lg:shadow-none lg:w-[312px]
            ${toolsOpen ? 'bg-[#4E5871]' : 'bg-white border-r border-slate-200'}
          `}
        >
          <div className={`w-[294px] lg:w-[312px] h-full flex flex-col min-w-[294px] lg:min-w-[312px] ${toolsOpen ? 'bg-[#4E5871]' : 'bg-white'}`}>
            {/* Header */}
            <div className={`p-4 ${toolsOpen ? '' : 'border-b border-slate-200'}`}>
              {toolsOpen ? (
                <div className="flex items-center justify-between min-h-[40px] animate-in fade-in duration-200">
                  <span className="text-white/90 font-bold text-[12px] uppercase tracking-wider pl-1">
                    Naše produkty
                  </span>
                  <button
                    onClick={() => setToolsOpen(false)}
                    className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-white/90"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <div className="flex items-center justify-center min-h-[40px] w-20">
                      <div className="w-20 h-10 text-[#4E5871]">
                        <VividLogo />
                      </div>
                    </div>
                    <ToolsDropdown 
                      isOpen={toolsOpen} 
                      onToggle={() => setToolsOpen(!toolsOpen)} 
                      label="Mat. výzva"
                      variant="default"
                    />
                  </div>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="lg:hidden p-1.5 rounded-md transition-colors text-slate-600 hover:bg-slate-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto">
              {toolsOpen ? (
                <ToolsMenu 
                  activeItem="practice"
                  onItemClick={() => {
                    setToolsOpen(false);
                    setSidebarOpen(false);
                  }}
                  isStudentMode={true}
                />
              ) : (
                <div className="p-4">
                  {/* Player Stats Card */}
                  <div className="rounded-2xl p-4 text-white mb-6 shadow-xl" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed, #8b5cf6)' }}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                        {currentLevel.icon}
                      </div>
                      <div>
                        <div className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>Úroveň {currentLevel.level}</div>
                        <div className="font-bold text-lg">{currentLevel.name}</div>
                      </div>
                    </div>
                    
                    {/* XP Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-white/70 mb-1">
                        <span>{xpProgress.current} XP</span>
                        <span>{xpProgress.max} XP</span>
                      </div>
                      <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-yellow-400 to-amber-400 rounded-full transition-all duration-500"
                          style={{ width: `${xpProgress.percentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white/10 rounded-xl py-2 px-1">
                        <div className="flex items-center justify-center gap-1 text-lg font-bold">
                          <Flame className="w-4 h-4 text-orange-400" />
                          {playerProgress.currentStreak}
                        </div>
                        <div className="text-[10px] text-white/60">série</div>
                      </div>
                      <div className="bg-white/10 rounded-xl py-2 px-1">
                        <div className="flex items-center justify-center gap-1 text-lg font-bold">
                          <Zap className="w-4 h-4 text-yellow-400" />
                          {playerProgress.totalXp}
                        </div>
                        <div className="text-[10px] text-white/60">celkem XP</div>
                      </div>
                      <div className="bg-white/10 rounded-xl py-2 px-1">
                        <div className="flex items-center justify-center gap-1 text-lg font-bold">
                          <Trophy className="w-4 h-4 text-amber-400" />
                          {unlockedAchievements.length}
                        </div>
                        <div className="text-[10px] text-white/60">odznaky</div>
                      </div>
                    </div>
                  </div>

                  {/* Challenge Info Banner */}
                  <div className="rounded-xl p-4 mb-6 border border-orange-200" style={{ background: 'linear-gradient(135deg, #fff7ed, #ffedd5)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🏆</span>
                      <span className="font-bold text-orange-800 text-sm">{MATH_CHALLENGE_INFO.seasonName}</span>
                    </div>
                    <div className="flex justify-between text-xs text-orange-600 mb-1">
                      <span>Týden {MATH_CHALLENGE_INFO.currentWeek}/{MATH_CHALLENGE_INFO.totalWeeks}</span>
                      <span>{Math.round(challengeWeekProgress)}%</span>
                    </div>
                    <div className="h-2 bg-orange-200 rounded-full overflow-hidden mb-2">
                      <div 
                        className="h-full rounded-full"
                        style={{ width: `${challengeWeekProgress}%`, background: 'linear-gradient(90deg, #f97316, #ea580c)' }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-orange-500">
                      <span>👥 {MATH_CHALLENGE_INFO.totalParticipants.toLocaleString()} účastníků</span>
                      <span>🏫 {MATH_CHALLENGE_INFO.totalSchools} škol</span>
                    </div>
                  </div>

                  {/* Daily Goal */}
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-emerald-600" />
                        <span className="font-semibold text-emerald-800">Denní cíl</span>
                      </div>
                      <span className="text-sm text-emerald-600 font-medium">{playerProgress.weeklyXp}/50 XP</span>
                    </div>
                    <div className="h-2 bg-emerald-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full"
                        style={{ width: `${Math.min((playerProgress.weeklyXp / 50) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-emerald-600 mt-2">
                      {playerProgress.weeklyXp >= 50 
                        ? '🎉 Splněno! Získej bonus XP!' 
                        : `Zbývá ${50 - playerProgress.weeklyXp} XP do splnění`
                      }
                    </p>
                  </div>

                  {/* Grade Selector */}
                  <div className="mb-4">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Ročník</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {AVAILABLE_MATH_GRADES.map((grade) => (
                        <button
                          key={grade.grade}
                          onClick={() => setSelectedGrade(grade.grade)}
                          className={`p-3 rounded-xl transition-all text-center ${
                            selectedGrade === grade.grade
                              ? 'border-2 border-orange-400'
                              : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'
                          }`}
                          style={selectedGrade === grade.grade ? { background: 'linear-gradient(135deg, #fff7ed, #ffedd5)' } : {}}
                        >
                          <div className="font-bold text-slate-800">{grade.grade}.</div>
                          <div className="text-[10px] text-slate-500">{grade.progress}%</div>
                          <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden mt-1">
                            <div 
                              className="h-full rounded-full"
                              style={{ width: `${grade.progress}%`, background: 'linear-gradient(90deg, #f97316, #ea580c)' }}
                            />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="space-y-2">
                    <button 
                      onClick={() => setShowLeaderboard('class')}
                      className="w-full flex items-center gap-3 p-3 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors text-left"
                    >
                      <Users className="w-5 h-5 text-amber-600" />
                      <span className="font-medium text-amber-800">Žebříček třídy</span>
                      <span className="ml-auto text-sm text-amber-600">#{MOCK_LEADERBOARD_CLASS.find(e => e.isCurrentUser)?.rank || '-'}</span>
                    </button>
                    <button 
                      onClick={() => setShowLeaderboard('national')}
                      className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left border border-orange-200"
                      style={{ background: 'linear-gradient(135deg, #fff7ed, #ffedd5)' }}
                    >
                      <Crown className="w-5 h-5 text-orange-600" />
                      <span className="font-medium text-orange-800">Žebříček ČR</span>
                      <span className="ml-auto text-sm text-orange-600">#{MOCK_LEADERBOARD_NATIONAL.find(e => e.isCurrentUser)?.rank || '-'}</span>
                    </button>
                    <button 
                      onClick={() => setShowAchievements(true)}
                      className="w-full flex items-center gap-3 p-3 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors text-left"
                    >
                      <Medal className="w-5 h-5 text-purple-600" />
                      <span className="font-medium text-purple-800">Moje odznaky</span>
                      <span className="ml-auto text-sm text-purple-600">{unlockedAchievements.length}/{ACHIEVEMENTS.length}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 z-20 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {/* Mobile header */}
          <div className="lg:hidden border-b border-orange-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10" style={{ background: 'linear-gradient(135deg, #fff7ed, #ffedd5)' }}>
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-md hover:bg-orange-100 text-orange-600"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-semibold text-orange-800">Matematická výzva</span>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-1 text-orange-500">
                <Flame className="w-4 h-4" />
                <span className="font-bold text-sm">{playerProgress.currentStreak}</span>
              </div>
              <div className="flex items-center gap-1 text-orange-600">
                <Zap className="w-4 h-4" />
                <span className="font-bold text-sm">{playerProgress.totalXp}</span>
              </div>
            </div>
          </div>

          <div className="p-6 lg:p-8 max-w-5xl mx-auto">
            {/* Challenge Header */}
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg" style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
                🧮
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-800">Matematická výzva</h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className="px-3 py-1 rounded-full text-sm font-medium text-orange-700" style={{ background: 'linear-gradient(135deg, #fff7ed, #ffedd5)' }}>
                    {selectedGrade}. ročník
                  </span>
                  <span className="text-slate-500 text-sm">
                    {selectedSubject.earnedXp} / {selectedSubject.totalXp} XP
                  </span>
                </div>
              </div>
            </div>

            {/* Chapters */}
            <div className="space-y-6">
              {selectedSubject.chapters.map((chapter) => (
                <div key={chapter.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  {/* Chapter Header */}
                  <button
                    onClick={() => toggleChapter(chapter.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {expandedChapters.includes(chapter.id) ? (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      )}
                      <h2 className="font-semibold text-slate-800">{chapter.title}</h2>
                    </div>
                    {chapter.topics.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">
                          {chapter.topics.filter(t => t.progress === 100).length}/{chapter.topics.length}
                        </span>
                        <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-emerald-400 to-green-500 rounded-full"
                            style={{ 
                              width: `${chapter.topics.length > 0 
                                ? (chapter.topics.reduce((acc, t) => acc + t.progress, 0) / chapter.topics.length) 
                                : 0}%` 
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </button>

                  {/* Topics */}
                  {expandedChapters.includes(chapter.id) && chapter.topics.length > 0 && (
                    <div className="border-t border-slate-100">
                      {chapter.topics.map((topic, topicIndex) => (
                        <div 
                          key={topic.id}
                          className={`p-4 ${topicIndex !== chapter.topics.length - 1 ? 'border-b border-slate-100' : ''}`}
                        >
                          {/* Topic Title */}
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-700">{topic.title}</h3>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate-500">{topic.earnedXp}/{topic.totalXp} XP</span>
                              <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full"
                                  style={{ width: `${topic.progress}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Exercises Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            {topic.exercises.map((exercise) => {
                              const statusStyles = getStatusStyles(exercise.status);
                              return (
                              <button
                                key={exercise.id}
                                onClick={() => handleExerciseClick(exercise)}
                                disabled={exercise.status === 'locked'}
                                className={`relative p-3 rounded-xl transition-all duration-200 ${statusStyles.className}`}
                                style={statusStyles.style}
                              >
                                {/* Status Icon */}
                                <div className="absolute -top-1 -left-1">
                                  {exercise.status === 'mastered' && (
                                    <div className="w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center shadow">
                                      <Star className="w-3.5 h-3.5 text-white" fill="currentColor" />
                                    </div>
                                  )}
                                  {exercise.status === 'completed' && (
                                    <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shadow">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                    </div>
                                  )}
                                  {exercise.status === 'locked' && (
                                    <div className="w-6 h-6 bg-slate-300 rounded-full flex items-center justify-center">
                                      <Lock className="w-3 h-3 text-slate-500" />
                                    </div>
                                  )}
                                </div>

                                {/* Play Icon for available/in_progress */}
                                {(exercise.status === 'available' || exercise.status === 'in_progress') && (
                                  <div className="absolute -top-1 -left-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow">
                                    <Play className="w-3 h-3 text-white ml-0.5" fill="currentColor" />
                                  </div>
                                )}

                                {/* Difficulty Badge */}
                                <div className={`absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${getDifficultyColor(exercise.difficulty)}`}>
                                  {exercise.difficulty}
                                </div>

                                {/* Content */}
                                <div className="pt-2">
                                  <div className="text-sm font-medium line-clamp-2 mb-1">
                                    {exercise.title}
                                  </div>
                                  {exercise.bestScore !== undefined && (
                                    <div className="text-xs opacity-80">
                                      Nejlepší: {exercise.bestScore}%
                                    </div>
                                  )}
                                  <div className="text-xs mt-1 flex items-center gap-1">
                                    <Zap className="w-3 h-3" />
                                    +{exercise.xpReward} XP
                                  </div>
                                </div>
                              </button>
                            );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Empty State for chapters without topics */}
                  {expandedChapters.includes(chapter.id) && chapter.topics.length === 0 && (
                    <div className="p-8 text-center text-slate-500 border-t border-slate-100">
                      <Lock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p>Tato kapitola bude brzy k dispozici</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden">
            <div 
              className="p-4 border-b border-slate-200 flex items-center justify-between"
              style={{ background: showLeaderboard === 'national' 
                ? 'linear-gradient(135deg, #f97316, #ea580c)' 
                : 'linear-gradient(135deg, #f59e0b, #d97706)' 
              }}
            >
              <div className="flex items-center gap-2 text-white">
                {showLeaderboard === 'national' ? <Crown className="w-6 h-6" /> : <Users className="w-6 h-6" />}
                <h2 className="text-xl font-bold">
                  {showLeaderboard === 'national' ? 'Žebříček České republiky' : 'Žebříček třídy 6.A'}
                </h2>
              </div>
              <button onClick={() => setShowLeaderboard(null)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            
            {/* Tab switcher */}
            <div className="flex border-b border-slate-200">
              <button 
                onClick={() => setShowLeaderboard('class')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  showLeaderboard === 'class' 
                    ? 'text-orange-600 border-b-2 border-orange-500' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Moje třída
              </button>
              <button 
                onClick={() => setShowLeaderboard('national')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  showLeaderboard === 'national' 
                    ? 'text-orange-600 border-b-2 border-orange-500' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Celá ČR 🇨🇿
              </button>
            </div>

            <div className="p-4 max-h-[50vh] overflow-y-auto">
              {showLeaderboard === 'national' && (
                <div className="mb-4 p-3 rounded-xl text-center text-sm" style={{ background: 'linear-gradient(135deg, #fff7ed, #ffedd5)' }}>
                  <span className="text-orange-700">
                    👥 {MATH_CHALLENGE_INFO.totalParticipants.toLocaleString()} účastníků z {MATH_CHALLENGE_INFO.totalSchools} škol
                  </span>
                </div>
              )}
              {(showLeaderboard === 'national' ? MOCK_LEADERBOARD_NATIONAL : MOCK_LEADERBOARD_CLASS).map((entry, index) => (
                <div 
                  key={index}
                  className={`flex items-center gap-3 p-3 rounded-xl mb-2 ${
                    entry.isCurrentUser 
                      ? 'border-2 border-orange-400' 
                      : 'bg-slate-50'
                  }`}
                  style={entry.isCurrentUser ? { background: 'linear-gradient(135deg, #fff7ed, #ffedd5)' } : {}}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    entry.rank === 1 ? 'bg-yellow-400 text-white' :
                    entry.rank === 2 ? 'bg-slate-400 text-white' :
                    entry.rank === 3 ? 'bg-amber-600 text-white' :
                    'bg-slate-200 text-slate-600'
                  }`}>
                    {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : entry.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 truncate">{entry.name}</div>
                    <div className="text-xs text-slate-500">Úroveň {entry.level}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-orange-600">{entry.xp.toLocaleString()} XP</div>
                    <div className="text-xs text-orange-500 flex items-center justify-end gap-0.5">
                      <Flame className="w-3 h-3" /> {entry.streak}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Achievements Modal */}
      {showAchievements && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-purple-500 to-violet-500">
              <div className="flex items-center gap-2 text-white">
                <Medal className="w-6 h-6" />
                <h2 className="text-xl font-bold">Moje odznaky</h2>
              </div>
              <button onClick={() => setShowAchievements(false)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-3">
                {ACHIEVEMENTS.map((achievement) => {
                  const unlocked = playerProgress.achievements.includes(achievement.id);
                  return (
                    <div 
                      key={achievement.id}
                      className={`p-3 rounded-xl text-center ${
                        unlocked 
                          ? 'bg-gradient-to-br from-purple-100 to-violet-100 border-2 border-purple-300' 
                          : 'bg-slate-100 opacity-50'
                      }`}
                    >
                      <div className="text-3xl mb-1">{achievement.icon}</div>
                      <div className="text-xs font-semibold text-slate-800 line-clamp-1">{achievement.name}</div>
                      <div className={`text-[10px] mt-1 px-1.5 py-0.5 rounded-full inline-block ${
                        achievement.rarity === 'legendary' ? 'bg-amber-200 text-amber-800' :
                        achievement.rarity === 'epic' ? 'bg-purple-200 text-purple-800' :
                        achievement.rarity === 'rare' ? 'bg-blue-200 text-blue-800' :
                        'bg-slate-200 text-slate-600'
                      }`}>
                        {achievement.rarity === 'legendary' ? 'Legendární' :
                         achievement.rarity === 'epic' ? 'Epický' :
                         achievement.rarity === 'rare' ? 'Vzácný' : 'Běžný'}
                      </div>
                      {unlocked && (
                        <div className="text-[10px] text-purple-600 mt-1">+{achievement.xpReward} XP</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

