/**
 * Student Individual Work Component
 * 
 * Shows teachers what their students have worked on individually
 * (self-study mode results)
 */

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  User,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import { subscribeToClassroomWork } from '../../utils/student-work';
import { StudentWorkSession } from '../../types/quiz';
import * as storage from '../../utils/profile-storage';

interface BoardWorkData {
  boardTitle: string;
  students: { [studentId: string]: StudentWorkSession };
}

export function StudentIndividualWork() {
  const [workData, setWorkData] = useState<{ [boardId: string]: BoardWorkData }>({});
  const [loading, setLoading] = useState(true);
  const [expandedBoards, setExpandedBoards] = useState<Set<string>>(new Set());
  
  const profile = storage.getCurrentUserProfile();
  
  useEffect(() => {
    if (!profile?.userId) {
      setLoading(false);
      return;
    }
    
    const unsubscribe = subscribeToClassroomWork(profile.userId, (data) => {
      // Transform data to include board titles
      const transformed: { [boardId: string]: BoardWorkData } = {};
      
      Object.entries(data).forEach(([boardId, students]) => {
        const studentEntries = students as { [studentId: string]: StudentWorkSession };
        const firstStudent = Object.values(studentEntries)[0];
        transformed[boardId] = {
          boardTitle: firstStudent?.boardTitle || 'Neznámý board',
          students: studentEntries,
        };
      });
      
      setWorkData(transformed);
      setLoading(false);
    });
    
    return unsubscribe;
  }, [profile?.userId]);
  
  const toggleBoard = (boardId: string) => {
    setExpandedBoards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(boardId)) {
        newSet.delete(boardId);
      } else {
        newSet.add(boardId);
      }
      return newSet;
    });
  };
  
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('cs-CZ', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }
  
  const boardIds = Object.keys(workData);
  
  if (boardIds.length === 0) {
    return (
      <div className="text-center py-12">
        <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-medium text-slate-600 mb-2">Zatím žádná individuální práce</h3>
        <p className="text-slate-500 text-sm max-w-md mx-auto">
          Zde uvidíte výsledky studentů, kteří si sami otevřou vaše boardy k procvičování.
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <TrendingUp className="w-6 h-6 text-indigo-500" />
        <h2 className="text-xl font-bold text-slate-800">Individuální práce studentů</h2>
        <span className="text-sm text-slate-500">({boardIds.length} boardů)</span>
      </div>
      
      {boardIds.map((boardId) => {
        const board = workData[boardId];
        const studentIds = Object.keys(board.students);
        const isExpanded = expandedBoards.has(boardId);
        
        // Calculate aggregate stats
        const totalStudents = studentIds.length;
        const completedCount = studentIds.filter(
          id => board.students[id].status === 'completed'
        ).length;
        const avgScore = totalStudents > 0
          ? Math.round(
              studentIds.reduce((sum, id) => sum + (board.students[id].score || 0), 0) / totalStudents
            )
          : 0;
        
        return (
          <div key={boardId} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Board header */}
            <button
              onClick={() => toggleBoard(boardId)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                )}
                <BookOpen className="w-5 h-5 text-indigo-500" />
                <span className="font-medium text-slate-800">{board.boardTitle}</span>
              </div>
              
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-slate-500">
                  <User className="w-4 h-4" />
                  <span>{totalStudents} studentů</span>
                </div>
                <div className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle className="w-4 h-4" />
                  <span>{completedCount} dokončeno</span>
                </div>
                <div className="px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                  Ø {avgScore}%
                </div>
              </div>
            </button>
            
            {/* Student list */}
            {isExpanded && (
              <div className="border-t border-slate-100">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs text-slate-500 uppercase tracking-wide">
                      <th className="px-4 py-2">Student</th>
                      <th className="px-4 py-2">Datum</th>
                      <th className="px-4 py-2">Čas</th>
                      <th className="px-4 py-2">Výsledek</th>
                      <th className="px-4 py-2">Stav</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentIds.map((studentId) => {
                      const session = board.students[studentId];
                      return (
                        <tr key={studentId} className="border-t border-slate-50 hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                <span className="text-indigo-600 font-medium text-sm">
                                  {session.studentName?.charAt(0)?.toUpperCase() || '?'}
                                </span>
                              </div>
                              <span className="font-medium text-slate-700">{session.studentName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {formatDate(session.startedAt)}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {formatTime(session.totalTimeMs)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 text-emerald-600">
                                <CheckCircle className="w-4 h-4" />
                                <span>{session.correctCount}</span>
                              </div>
                              <span className="text-slate-300">/</span>
                              <div className="flex items-center gap-1 text-red-500">
                                <XCircle className="w-4 h-4" />
                                <span>{session.totalQuestions - session.correctCount}</span>
                              </div>
                              <span className="ml-2 px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-sm font-medium">
                                {session.score}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {session.status === 'completed' ? (
                              <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                                Dokončeno
                              </span>
                            ) : session.status === 'in_progress' ? (
                              <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                                Probíhá
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-medium">
                                Opuštěno
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

