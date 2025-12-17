/**
 * Class Results Grid Component
 * 
 * Displays a matrix of student results with columns for each assignment
 * Supports toggling individual work visibility and demo/Supabase data
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  BookOpen,
  ClipboardList,
  Eye,
  EyeOff,
  Database,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import {
  ClassGroup,
  Student,
  Assignment,
  StudentResult,
  getClassWithData,
  setDataSource,
  isUsingSupabase,
} from '../../utils/supabase/classes';

interface ClassResultsGridProps {
  classId: string;
  className: string;
  onBack?: () => void;
}

export function ClassResultsGrid({ classId, className, onBack }: ClassResultsGridProps) {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [results, setResults] = useState<{ [studentId: string]: { [assignmentId: string]: StudentResult } }>({});
  const [loading, setLoading] = useState(true);
  
  // Toggle states
  const [showIndividual, setShowIndividual] = useState(true);
  const [useSupabase, setUseSupabase] = useState(false);
  
  // Hover states for highlighting
  // hoveredRow: when hovering student name cell - highlights entire row
  // hoveredColumn: when hovering column header - highlights entire column  
  // hoveredCell: when hovering a single result cell - highlights only that cell
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ studentId: string; assignmentId: string } | null>(null);
  
  // Load data
  useEffect(() => {
    loadData();
  }, [classId, showIndividual, useSupabase]);
  
  const loadData = async () => {
    setLoading(true);
    setDataSource(useSupabase);
    
    const data = await getClassWithData(classId, showIndividual);
    
    if (data) {
      setStudents(data.students);
      setAssignments(data.assignments);
      setResults(data.results);
    }
    
    setLoading(false);
  };
  
  // Get score color based on value
  const getScoreColor = (score: number | null): string => {
    if (score === null || score === -1) return '#FFFFFF'; // White for no data or pending
    if (score >= 9) return '#6DE89B';
    if (score >= 8) return '#7ECD7E';
    if (score >= 7) return '#9FD99F';
    if (score >= 6) return '#C7B08A';
    if (score >= 5) return '#E8A07A';
    if (score >= 4) return '#E88A7A';
    if (score >= 3) return '#E87A7A';
    if (score >= 2) return '#E86A6A';
    return '#B84040';
  };
  
  // Get text color based on background
  const getTextColor = (score: number | null): string => {
    if (score === null) return '#9CA3AF';
    if (score === -1) return '#92400E';
    if (score <= 3) return '#FFFFFF';
    return '#1F2937';
  };
  
  // Format date
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return `${date.getDate()}.${date.getMonth() + 1}.`;
  };
  
  // Get assignment icon
  const getAssignmentIcon = (type: string): React.ReactNode => {
    switch (type) {
      case 'test':
        return (
          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
            <CheckCircle className="w-3 h-3" style={{ color: '#DC2626' }} />
          </div>
        );
      case 'practice':
        return (
          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: '#D1FAE5' }}>
            <BookOpen className="w-3 h-3" style={{ color: '#059669' }} />
          </div>
        );
      case 'individual':
        return (
          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: '#E0E7FF' }}>
            <ClipboardList className="w-3 h-3" style={{ color: '#4F46E5' }} />
          </div>
        );
      default:
        return null;
    }
  };
  
  // Calculate student average
  const calculateAverage = (studentId: string): number | null => {
    const studentResults = results[studentId];
    if (!studentResults) return null;
    
    const scores = Object.values(studentResults)
      .map(r => r.score)
      .filter((s): s is number => s !== null && s !== -1);
    
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  };
  
  // Filter assignments by type
  const filteredAssignments = showIndividual 
    ? assignments 
    : assignments.filter(a => a.type !== 'individual');
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Individual work toggle */}
          <button
            onClick={() => setShowIndividual(!showIndividual)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              showIndividual 
                ? 'bg-indigo-100 text-indigo-700' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {showIndividual ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            Individuální práce
          </button>
          
          {/* Data source toggle */}
          <button
            onClick={() => setUseSupabase(!useSupabase)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              useSupabase 
                ? 'bg-emerald-100 text-emerald-700' 
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {useSupabase ? <Database className="w-4 h-4" /> : <HardDrive className="w-4 h-4" />}
            {useSupabase ? 'Supabase' : 'Demo data'}
          </button>
        </div>
        
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Obnovit
        </button>
      </div>
      
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#FEE2E2' }}>
            <CheckCircle className="w-3 h-3 m-0.5" style={{ color: '#DC2626' }} />
          </div>
          <span>Test</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#D1FAE5' }}>
            <BookOpen className="w-3 h-3 m-0.5" style={{ color: '#059669' }} />
          </div>
          <span>Procvičování</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#E0E7FF' }}>
            <ClipboardList className="w-3 h-3 m-0.5" style={{ color: '#4F46E5' }} />
          </div>
          <span>Individuální</span>
        </div>
      </div>
      
      {/* Results Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderSpacing: '2px', borderCollapse: 'separate' }}>
            {/* Header */}
            <thead>
              {/* Date row */}
              <tr>
                <th className="sticky left-0 z-10 bg-white" style={{ minWidth: '200px' }}></th>
                {filteredAssignments.map((assignment) => {
                  const isIndividual = assignment.type === 'individual';
                  return (
                    <th 
                      key={`date-${assignment.id}`}
                      className={`py-2 text-xs font-normal text-slate-400 text-center ${
                        hoveredColumn === assignment.id ? 'bg-indigo-50' : ''
                      }`}
                      style={{ 
                        width: isIndividual ? '15px' : '120px',
                        minWidth: isIndividual ? '15px' : '120px',
                        maxWidth: isIndividual ? '15px' : '120px',
                        padding: '0',
                      }}
                    >
                      {isIndividual ? '' : formatDate(assignment.due_date)}
                    </th>
                  );
                })}
                <th className="px-4 py-2 text-xs font-normal text-slate-400 text-center" style={{ minWidth: '80px' }}>
                  Ø
                </th>
              </tr>
              
              {/* Assignment name row */}
              <tr>
                <th className="sticky left-0 z-10 bg-white px-4 py-2 text-left text-sm font-medium text-slate-700 border-b border-slate-200">
                  Student
                </th>
                {filteredAssignments.map((assignment) => {
                  const isIndividual = assignment.type === 'individual';
                  
                  // Handle click on column header - navigate to board
                  const handleColumnClick = () => {
                    if (!isIndividual && assignment.board_id) {
                      // Navigate to board results or board detail
                      // For demo, we'll navigate to quiz results with assignment id
                      navigate(`/quiz/results/${assignment.id}?type=class&classId=${classId}`);
                    }
                  };
                  
                  return (
                    <th 
                      key={`name-${assignment.id}`}
                      className={`py-2 border-b border-slate-200 ${!isIndividual ? 'cursor-pointer hover:bg-indigo-100' : ''} ${
                        hoveredColumn === assignment.id ? 'bg-indigo-50' : ''
                      }`}
                      style={{ 
                        width: isIndividual ? '15px' : '120px',
                        minWidth: isIndividual ? '15px' : '120px',
                        maxWidth: isIndividual ? '15px' : '120px',
                        padding: '0',
                      }}
                      onClick={handleColumnClick}
                      onMouseEnter={() => {
                        if (!isIndividual) {
                          setHoveredColumn(assignment.id);
                          setHoveredRow(null);
                          setHoveredCell(null);
                        }
                      }}
                      onMouseLeave={() => setHoveredColumn(null)}
                    >
                      {isIndividual ? (
                        // Narrow column for individual - empty header
                        <div style={{ width: '15px', height: '20px' }} title={assignment.title}></div>
                      ) : (
                        // Wide column for tests/practice - clickable
                        <div className="flex flex-col items-center gap-1 py-1">
                          {getAssignmentIcon(assignment.type)}
                          <span className="text-xs text-slate-600 truncate" style={{ maxWidth: '110px' }} title={assignment.title}>
                            {assignment.title.length > 14 ? `${assignment.title.slice(0, 14)}...` : assignment.title}
                          </span>
                        </div>
                      )}
                    </th>
                  );
                })}
                <th className="px-4 py-2 text-center text-xs font-medium text-slate-700 border-b border-slate-200">
                  Průměr
                </th>
              </tr>
            </thead>
            
            {/* Body */}
            <tbody>
              {students.map((student, studentIdx) => {
                const average = calculateAverage(student.id);
                const isHoveredRow = hoveredRow === student.id;
                
                return (
                  <tr 
                    key={student.id}
                  >
                    {/* Student name - hover highlights entire row */}
                    <td 
                      className="sticky left-0 z-10 cursor-pointer" 
                      style={{ 
                        backgroundColor: isHoveredRow ? '#EEF2FF' : '#FFFFFF', 
                        padding: '1px 16px',
                      }}
                      onMouseEnter={() => {
                        setHoveredRow(student.id);
                        setHoveredColumn(null);
                        setHoveredCell(null);
                      }}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: student.color }}
                        >
                          {student.initials}
                        </div>
                        <span className="text-sm font-medium text-slate-700">{student.name}</span>
                      </div>
                    </td>
                    
                    {/* Results */}
                    {filteredAssignments.map((assignment) => {
                      const result = results[student.id]?.[assignment.id];
                      const score = result?.score ?? null;
                      const bgColor = getScoreColor(score);
                      const textColor = getTextColor(score);
                      const isIndividual = assignment.type === 'individual';
                      const hasData = score !== null && score !== -1;
                      
                      // Determine if this cell should be highlighted
                      const isCellHovered = hoveredCell?.studentId === student.id && hoveredCell?.assignmentId === assignment.id;
                      const isRowHighlighted = hoveredRow === student.id;
                      const isColumnHighlighted = hoveredColumn === assignment.id;
                      
                      // Don't highlight empty cells (no data) when row/column is highlighted
                      const shouldShowRing = isCellHovered || 
                        (isRowHighlighted && hasData) || 
                        (isColumnHighlighted && hasData);
                      
                      // Background for entire td when row or column is highlighted (but not for empty cells)
                      const showBgHighlight = (isRowHighlighted || isColumnHighlighted) && !isCellHovered && hasData;
                      const tdBgColor = showBgHighlight ? 'rgba(99, 102, 241, 0.08)' : 'transparent';
                      
                      return (
                        <td 
                          key={`result-${student.id}-${assignment.id}`}
                          style={{ 
                            width: isIndividual ? '15px' : '120px',
                            minWidth: isIndividual ? '15px' : '120px',
                            maxWidth: isIndividual ? '15px' : '120px',
                            padding: '1px 0',
                            backgroundColor: tdBgColor,
                          }}
                          onMouseEnter={() => setHoveredCell({ studentId: student.id, assignmentId: assignment.id })}
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          {isIndividual ? (
                            // Narrow bar for individual work - no text
                            <div 
                              className={shouldShowRing ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}
                              style={{ 
                                width: '15px', 
                                height: '45px', 
                                backgroundColor: bgColor,
                                borderRadius: '8px',
                                margin: '0 auto',
                                border: !hasData ? '1px solid #E5E7EB' : 'none',
                              }}
                              title={!hasData ? 'Nehotovo' : `${score}/10`}
                            />
                          ) : (
                            // Wide cell for tests/practice
                            <div 
                              className={`
                                flex items-center justify-center text-sm font-medium
                                ${shouldShowRing ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}
                              `}
                              style={{ 
                                width: '120px', 
                                height: '45px', 
                                backgroundColor: bgColor, 
                                color: textColor,
                                borderRadius: '8px',
                                border: !hasData ? '1px solid #E5E7EB' : 'none',
                              }}
                            >
                              {!hasData ? '-' : `${score} / ${result?.max_score || 10}`}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    
                    {/* Average */}
                    <td className="px-2 text-center" style={{ padding: '1px 8px' }}>
                      <div 
                        className="flex items-center justify-center text-sm font-bold text-white"
                        style={{ 
                          width: '70px', 
                          height: '45px', 
                          backgroundColor: '#4A90E2',
                          borderRadius: '8px',
                          margin: '0 auto',
                        }}
                      >
                        {average !== null ? `${average}%` : '-'}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Stats summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-2xl font-bold text-slate-800">{students.length}</div>
          <div className="text-sm text-slate-500">Studentů</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-2xl font-bold text-slate-800">{filteredAssignments.filter(a => a.type === 'test').length}</div>
          <div className="text-sm text-slate-500">Testů</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-2xl font-bold text-slate-800">{filteredAssignments.filter(a => a.type === 'practice').length}</div>
          <div className="text-sm text-slate-500">Procvičování</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-2xl font-bold text-indigo-600">{filteredAssignments.filter(a => a.type === 'individual').length}</div>
          <div className="text-sm text-slate-500">Individuální</div>
        </div>
      </div>
    </div>
  );
}

