/**
 * Quiz Results Page
 * 
 * Comprehensive results view after a quiz session ends
 * - Přehled (Overview): Stats, success chart, student list
 * - Aktivity (Activities): Breakdown by question
 * - Studenti (Students): Individual student results
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ref, onValue, off } from 'firebase/database';
import { database } from '../../utils/firebase-config';
import {
  ArrowLeft,
  RefreshCw,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  BarChart2,
  Printer,
  Share2,
  Settings,
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react';
import {
  Quiz,
  QuizSlide,
  ABCActivitySlide,
  OpenActivitySlide,
  SlideResponse,
  LiveQuizSession,
} from '../../types/quiz';
import { MathText } from '../math/MathText';

const QUIZ_SESSIONS_PATH = 'quiz_sessions';
const QUIZ_SHARES_PATH = 'quiz_shares';

interface StudentResult {
  id: string;
  name: string;
  responses: SlideResponse[];
  correctCount: number;
  totalAnswered: number;
  successRate: number;
  totalTime: number;
}

interface QuestionStats {
  slideId: string;
  question: string;
  type: string;
  activityType?: string;
  options?: { id: string; label: string; content: string; isCorrect: boolean }[];
  answerCounts: Record<string, number>;
  correctAnswer?: string;
  totalResponses: number;
  averageTime: number;
}

type TabType = 'prehled' | 'aktivity' | 'studenti';

export function QuizResultsPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const sessionType = searchParams.get('type') || 'live';
  
  const [session, setSession] = useState<LiveQuizSession | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('prehled');
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'name' | 'success' | 'time'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Load session data based on type
  useEffect(() => {
    if (!sessionId) return;
    
    const path = sessionType === 'shared' ? QUIZ_SHARES_PATH : QUIZ_SESSIONS_PATH;
    const sessionRef = ref(database, `${path}/${sessionId}`);
    
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // For shared sessions, convert the responses format to match LiveQuizSession structure
        if (sessionType === 'shared' && data.responses) {
          const convertedStudents: Record<string, any> = {};
          Object.entries(data.responses).forEach(([studentId, studentData]: [string, any]) => {
            convertedStudents[studentId] = {
              name: studentData.studentName || 'Anonymní',
              responses: studentData.responses ? Object.values(studentData.responses) : [],
              joinedAt: studentData.joinedAt || data.createdAt,
              isOnline: false,
            };
          });
          
          setSession({
            ...data,
            students: convertedStudents,
          } as LiveQuizSession);
        } else {
          setSession(data as LiveQuizSession);
        }
        
        if (data.quizData) {
          setQuiz(data.quizData as Quiz);
        }
      }
      setLoading(false);
    });
    
    return () => off(sessionRef);
  }, [sessionId, sessionType]);
  
  // Calculate student results
  const studentResults: StudentResult[] = React.useMemo(() => {
    if (!session?.students || !quiz) return [];
    
    const activitySlides = quiz.slides.filter(s => s.type === 'activity');
    
    return Object.entries(session.students).map(([id, student]) => {
      const responses = student.responses || [];
      const correctCount = responses.filter(r => r.isCorrect).length;
      const totalAnswered = responses.length;
      const totalTime = responses.reduce((sum, r) => sum + (r.timeSpent || 0), 0);
      
      return {
        id,
        name: student.name,
        responses,
        correctCount,
        totalAnswered,
        successRate: totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0,
        totalTime,
      };
    });
  }, [session, quiz]);
  
  // Calculate question stats
  const questionStats: QuestionStats[] = React.useMemo(() => {
    if (!quiz || !session?.students) return [];
    
    return quiz.slides
      .filter(s => s.type === 'activity')
      .map(slide => {
        const answerCounts: Record<string, number> = {};
        let totalTime = 0;
        let responseCount = 0;
        
        // Get all responses for this slide
        Object.values(session.students || {}).forEach(student => {
          const response = student.responses?.find(r => r.slideId === slide.id);
          if (response) {
            const answer = String(response.answer);
            answerCounts[answer] = (answerCounts[answer] || 0) + 1;
            totalTime += response.timeSpent || 0;
            responseCount++;
          }
        });
        
        // Get correct answer for ABC
        let correctAnswer: string | undefined;
        let options: { id: string; label: string; content: string; isCorrect: boolean }[] | undefined;
        
        if (slide.activityType === 'abc') {
          const abcSlide = slide as ABCActivitySlide;
          options = abcSlide.options;
          correctAnswer = abcSlide.options.find(o => o.isCorrect)?.id;
        }
        
        return {
          slideId: slide.id,
          question: (slide as any).question || (slide as any).problem || 'Otázka',
          type: slide.type,
          activityType: slide.activityType,
          options,
          answerCounts,
          correctAnswer,
          totalResponses: responseCount,
          averageTime: responseCount > 0 ? totalTime / responseCount : 0,
        };
      });
  }, [quiz, session]);
  
  // Overall stats
  const overallStats = React.useMemo(() => {
    const totalQuestions = questionStats.length;
    const totalStudents = studentResults.length;
    const avgCorrect = totalStudents > 0 
      ? studentResults.reduce((sum, s) => sum + s.correctCount, 0) / totalStudents 
      : 0;
    const avgSuccessRate = totalStudents > 0
      ? studentResults.reduce((sum, s) => sum + s.successRate, 0) / totalStudents
      : 0;
    const avgTime = totalStudents > 0
      ? studentResults.reduce((sum, s) => sum + s.totalTime, 0) / totalStudents
      : 0;
    
    // Success distribution for bar chart
    const distribution = {
      excellent: studentResults.filter(s => s.successRate >= 80).length,
      good: studentResults.filter(s => s.successRate >= 60 && s.successRate < 80).length,
      average: studentResults.filter(s => s.successRate >= 40 && s.successRate < 60).length,
      belowAverage: studentResults.filter(s => s.successRate >= 20 && s.successRate < 40).length,
      poor: studentResults.filter(s => s.successRate < 20).length,
    };
    
    return {
      totalQuestions,
      totalStudents,
      avgCorrect: Math.round(avgCorrect * 10) / 10,
      avgSuccessRate: Math.round(avgSuccessRate),
      avgTime,
      distribution,
    };
  }, [questionStats, studentResults]);
  
  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins.toString().padStart(2, '0')}.${secs.toString().padStart(2, '0')}`;
  };
  
  // Get success color
  const getSuccessColor = (rate: number) => {
    if (rate >= 80) return '#10b981'; // green
    if (rate >= 60) return '#84cc16'; // lime
    if (rate >= 40) return '#f59e0b'; // amber
    if (rate >= 20) return '#f97316'; // orange
    return '#dc2626'; // red
  };
  
  // Toggle activity expansion
  const toggleActivity = (slideId: string) => {
    const newExpanded = new Set(expandedActivities);
    if (newExpanded.has(slideId)) {
      newExpanded.delete(slideId);
    } else {
      newExpanded.add(slideId);
    }
    setExpandedActivities(newExpanded);
  };
  
  // Sort students
  const sortedStudents = [...studentResults].sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'name') {
      comparison = a.name.localeCompare(b.name);
    } else if (sortBy === 'success') {
      comparison = a.successRate - b.successRate;
    } else if (sortBy === 'time') {
      comparison = a.totalTime - b.totalTime;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });
  
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600">Načítám výsledky...</p>
        </div>
      </div>
    );
  }
  
  if (!session || !quiz) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Session nenalezena</p>
          <button
            onClick={() => navigate('/quiz')}
            className="text-indigo-600 hover:text-indigo-700"
          >
            Zpět na kvízy
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Výsledky</span>
            </button>
            
            <div className="flex items-center gap-3">
              <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-600">
                <RefreshCw className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 text-slate-600">
                <Users className="w-5 h-5" />
                <span className="font-bold">{overallStats.totalStudents}</span>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      {/* Quiz info card */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-slate-200/50 rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-6">
            {/* Quiz thumbnail */}
            <div className="w-40 h-28 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center overflow-hidden flex-shrink-0">
              <div className="bg-orange-400 rounded-lg p-3 text-white text-center transform -rotate-2">
                <p className="font-bold text-sm">{quiz.title || 'Kvíz'}</p>
              </div>
            </div>
            
            {/* Info */}
            <div className="flex-1">
              <h1 className="text-xl font-bold text-slate-800 mb-1">Výsledky</h1>
              <p className="text-slate-500 text-sm">
                Session {new Date(session.createdAt).toLocaleDateString('cs-CZ')} {new Date(session.createdAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              <button 
                className="px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                style={{ 
                  border: '1px solid #cbd5e1', 
                  backgroundColor: '#ffffff', 
                  color: '#334155' 
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
              >
                <Settings className="w-4 h-4" />
                Nastavení
              </button>
              <button 
                className="px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                style={{ 
                  border: '1px solid #cbd5e1', 
                  backgroundColor: '#ffffff', 
                  color: '#334155' 
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
              >
                <Share2 className="w-4 h-4" />
                Sdílet
              </button>
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(['prehled', 'aktivity', 'studenti'] as TabType[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-4 px-6 rounded-xl font-medium transition-all"
              style={{
                backgroundColor: activeTab === tab ? '#334155' : 'rgba(226, 232, 240, 0.5)',
                color: activeTab === tab ? '#ffffff' : '#475569',
              }}
            >
              {tab === 'prehled' ? 'Přehled' : tab === 'aktivity' ? 'Aktivity' : 'Studenti'}
            </button>
          ))}
        </div>
        
        {/* Tab content */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          {/* PŘEHLED TAB */}
          {activeTab === 'prehled' && (
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-6">Základní přehled</h2>
              
              {/* Stats cards */}
              <div className="grid grid-cols-4 gap-6 mb-8">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Celkový<br/>počet otázek</p>
                  <p className="text-4xl font-bold text-slate-800">{overallStats.totalQuestions}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Průměr správných<br/>odpovědí</p>
                  <p className="text-4xl font-bold text-slate-800">{overallStats.avgCorrect}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Průměrná<br/>úspěšnost</p>
                  <p className="text-4xl font-bold text-slate-800">{overallStats.avgSuccessRate} %</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Průměrný<br/>čas</p>
                  <p className="text-4xl font-bold text-slate-800 flex items-center gap-2">
                    <Clock className="w-8 h-8" />
                    {formatTime(overallStats.avgTime)}
                  </p>
                </div>
              </div>
              
              {/* Distribution bar */}
              <div className="h-32 rounded-xl overflow-hidden flex mb-8">
                {overallStats.distribution.excellent > 0 && (
                  <div 
                    className="h-full flex items-end justify-start p-3"
                    style={{ 
                      width: `${(overallStats.distribution.excellent / overallStats.totalStudents) * 100}%`,
                      backgroundColor: '#10b981'
                    }}
                  >
                    <span className="text-white text-sm font-medium">
                      {Math.round((overallStats.distribution.excellent / overallStats.totalStudents) * 100)}%
                    </span>
                  </div>
                )}
                {overallStats.distribution.good > 0 && (
                  <div 
                    className="h-full"
                    style={{ 
                      width: `${(overallStats.distribution.good / overallStats.totalStudents) * 100}%`,
                      backgroundColor: '#84cc16'
                    }}
                  />
                )}
                {overallStats.distribution.average > 0 && (
                  <div 
                    className="h-full"
                    style={{ 
                      width: `${(overallStats.distribution.average / overallStats.totalStudents) * 100}%`,
                      backgroundColor: '#f59e0b'
                    }}
                  />
                )}
                {overallStats.distribution.belowAverage > 0 && (
                  <div 
                    className="h-full"
                    style={{ 
                      width: `${(overallStats.distribution.belowAverage / overallStats.totalStudents) * 100}%`,
                      backgroundColor: '#f97316'
                    }}
                  />
                )}
                {overallStats.distribution.poor > 0 && (
                  <div 
                    className="h-full flex items-end justify-end p-3"
                    style={{ 
                      width: `${(overallStats.distribution.poor / overallStats.totalStudents) * 100}%`,
                      backgroundColor: '#dc2626'
                    }}
                  >
                    <span className="text-white text-sm font-medium">
                      {Math.round((overallStats.distribution.poor / overallStats.totalStudents) * 100)}%
                    </span>
                  </div>
                )}
              </div>
              
              {/* Student table */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">#</th>
                      <th 
                        className="px-4 py-3 text-left text-sm font-medium text-slate-600 cursor-pointer hover:text-slate-800"
                        onClick={() => {
                          if (sortBy === 'name') {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortBy('name');
                            setSortOrder('asc');
                          }
                        }}
                      >
                        <span className="flex items-center gap-1">
                          {sortBy === 'name' && (sortOrder === 'asc' ? '▼' : '▲')} Jméno
                        </span>
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Úspěšnost</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Správné odpovědi</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Celkový čas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStudents.map((student, index) => (
                      <tr key={student.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-indigo-600 font-medium">{index + 1}</td>
                        <td className="px-4 py-3 text-sm text-slate-800">{student.name}</td>
                        <td className="px-4 py-3 text-center">
                          <span 
                            className="inline-block px-4 py-1 rounded-full text-white text-sm font-medium"
                            style={{ backgroundColor: getSuccessColor(student.successRate) }}
                          >
                            {student.successRate}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-slate-600">
                          {student.correctCount} / {student.totalAnswered}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-slate-600">
                          {student.totalTime > 0 ? formatTime(student.totalTime) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* AKTIVITY TAB */}
          {activeTab === 'aktivity' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Přehled aktivit</h2>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">Seřadit</span>
                    <select className="px-3 py-2 rounded-lg border border-slate-200 text-sm">
                      <option>Podle pořadí</option>
                      <option>Podle úspěšnosti</option>
                      <option>Podle času</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" className="rounded" />
                    Zobrazovat pouze aktivity
                  </label>
                </div>
              </div>
              
              <div className="space-y-4">
                {questionStats.map((stat, index) => (
                  <div key={stat.slideId} className="border border-slate-200 rounded-xl overflow-hidden">
                    {/* Activity header */}
                    <div 
                      className="flex items-center justify-between px-4 py-3 bg-slate-50 cursor-pointer hover:bg-slate-100"
                      onClick={() => toggleActivity(stat.slideId)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-slate-700 text-white flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </span>
                        <span className="w-6 h-6 rounded-full bg-amber-400 text-white flex items-center justify-center text-xs">?</span>
                        <span className="text-sm font-medium text-slate-600">
                          Aktivita {stat.activityType?.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-6 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          Průměrný čas
                          <Clock className="w-4 h-4" />
                          {formatTime(stat.averageTime)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {stat.totalResponses}
                        </span>
                        {expandedActivities.has(stat.slideId) ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </div>
                    </div>
                    
                    {/* Activity content */}
                    {expandedActivities.has(stat.slideId) && (
                      <div className="p-6 border-t border-slate-200">
                        <h3 className="text-xl font-bold text-slate-800 mb-6">
                          <MathText>{stat.question}</MathText>
                        </h3>
                        
                        {stat.activityType === 'abc' && stat.options && (
                          <div className="space-y-3">
                            {stat.options.map(option => {
                              const count = stat.answerCounts[option.id] || 0;
                              const percentage = stat.totalResponses > 0 
                                ? (count / stat.totalResponses) * 100 
                                : 0;
                              
                              return (
                                <div key={option.id} className="flex items-center gap-4">
                                  <span 
                                    style={{
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '9999px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 'bold',
                                      fontSize: '14px',
                                      backgroundColor: option.isCorrect ? '#10b981' : '#e2e8f0',
                                      color: option.isCorrect ? '#ffffff' : '#475569',
                                    }}
                                  >
                                    {option.label || option.id?.toUpperCase() || '?'}
                                  </span>
                                  <span className="flex-1 text-slate-700">
                                    <MathText>{option.content || ''}</MathText>
                                  </span>
                                  <div style={{ width: '256px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ flex: 1, height: '24px', backgroundColor: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
                                      <div 
                                        style={{ 
                                          width: `${percentage}%`,
                                          height: '100%',
                                          borderRadius: '9999px',
                                          backgroundColor: option.isCorrect ? '#10b981' : '#94a3b8',
                                          transition: 'all 0.3s'
                                        }}
                                      />
                                    </div>
                                    <span style={{ fontSize: '14px', fontWeight: 500, color: '#475569', width: '32px' }}>{count}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        
                        {stat.activityType === 'open' && (
                          <div className="space-y-2">
                            {Object.entries(stat.answerCounts).map(([answer, count]) => (
                              <div key={answer} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                <span className="text-slate-700">"{answer}"</span>
                                <span className="text-sm font-medium text-slate-600">{count}x</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* STUDENTI TAB */}
          {activeTab === 'studenti' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Přehled studentů</h2>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">Zobrazit</span>
                    <select className="px-3 py-2 rounded-lg border border-slate-200 text-sm">
                      <option>Všichni studenti</option>
                      <option>Úspěšní (80%+)</option>
                      <option>Neúspěšní (&lt;40%)</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" className="rounded" />
                    Zobrazovat pouze aktivity
                  </label>
                </div>
              </div>
              
              {/* Per-question student breakdown */}
              <div className="space-y-6">
                {questionStats.map((stat, qIndex) => (
                  <div key={stat.slideId} className="border border-slate-200 rounded-xl overflow-hidden">
                    {/* Question header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-slate-700 text-white flex items-center justify-center text-sm font-bold">
                          {qIndex + 1}
                        </span>
                        <span className="w-6 h-6 rounded-full bg-amber-400 text-white flex items-center justify-center text-xs">?</span>
                        <span className="text-sm font-medium text-slate-600">
                          Aktivita {stat.activityType?.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-6 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          Průměrný čas
                          <Clock className="w-4 h-4" />
                          {formatTime(stat.averageTime)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {stat.totalResponses}
                        </span>
                      </div>
                    </div>
                    
                    {/* Question */}
                    <div className="p-6 border-t border-slate-200">
                      <h3 className="text-xl font-bold text-slate-800 mb-6">
                        <MathText>{stat.question}</MathText>
                      </h3>
                      
                      {/* Student responses */}
                      <div className="space-y-2">
                        {sortedStudents.map((student, sIndex) => {
                          const response = student.responses.find(r => r.slideId === stat.slideId);
                          if (!response) return null;
                          
                          const option = stat.options?.find(o => o.id === response.answer);
                          
                          return (
                            <div 
                              key={student.id}
                              className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50"
                            >
                              <span className="text-sm font-medium text-indigo-600 w-6">{sIndex + 1}</span>
                              <span className="flex-1 text-slate-700">{student.name}</span>
                              <span 
                                className={`
                                  px-4 py-2 rounded-lg font-bold text-white text-sm
                                  ${response.isCorrect ? 'bg-emerald-400' : 'bg-red-400'}
                                `}
                              >
                                {option?.label || response.answer}
                              </span>
                              <span className="text-sm text-slate-500 w-16 text-right">
                                {formatTime(response.timeSpent || 0)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="flex justify-center gap-4 mt-6">
          <button className="px-6 py-3 rounded-xl bg-slate-700 text-white flex items-center gap-2 hover:bg-slate-800">
            <Printer className="w-5 h-5" />
            Tisknout
          </button>
          <button className="px-6 py-3 rounded-xl bg-slate-700 text-white flex items-center gap-2 hover:bg-slate-800">
            <FileText className="w-5 h-5" />
            Převést na pracovní list
          </button>
          <button className="px-6 py-3 rounded-xl border border-slate-300 bg-white text-slate-700 flex items-center gap-2 hover:bg-slate-50">
            <Share2 className="w-5 h-5" />
            Sdílet
          </button>
        </div>
      </div>
    </div>
  );
}

export default QuizResultsPage;

