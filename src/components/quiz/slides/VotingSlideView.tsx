/**
 * Voting Slide View
 * 
 * Shows voting interface for students and results chart for teachers
 * Supports: single choice, multiple choice, scale (1-10), feedback (emoji/hearts)
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart2,
  PieChart,
  Check,
  Users,
  Eye,
  Loader2,
  Heart,
} from 'lucide-react';
import { VotingActivitySlide, VotingOption, VotingType } from '../../../types/quiz';

// Option colors for the chart
const OPTION_COLORS = [
  '#10b981', // emerald
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#ef4444', // red
  '#06b6d4', // cyan
  '#84cc16', // lime
];

// Scale colors (orange to purple/blue gradient)
const SCALE_COLORS = [
  '#f97316', '#f97316', '#c084fc', '#a855f7', '#8b5cf6',
  '#7c3aed', '#6366f1', '#4f46e5', '#4338ca', '#4f46e5',
];

interface VotingSlideViewProps {
  slide: VotingActivitySlide;
  isTeacher?: boolean;
  hasVoted?: boolean;
  myVote?: string[] | null;
  voteCounts?: Record<string, number>;
  totalVoters?: number;
  onVote?: (optionIds: string[]) => void;
  readOnly?: boolean;
}

// Calculate dynamic font size based on question length
function getQuestionFontSize(text: string): string {
  const length = text.length;
  if (length < 30) return '2.5rem';
  if (length < 60) return '2rem';
  if (length < 100) return '1.75rem';
  if (length < 150) return '1.5rem';
  return '1.25rem';
}

// Bar Chart Component
function BarChartView({ 
  options, 
  voteCounts, 
  totalVoters,
  isScale = false,
}: { 
  options: VotingOption[]; 
  voteCounts: Record<string, number>;
  totalVoters: number;
  isScale?: boolean;
}) {
  const maxVotes = Math.max(...Object.values(voteCounts), 1);
  
  if (isScale) {
    // Vertical bar chart for scale
    const chartHeight = 280;
    const minBarHeight = 8; // Minimum visible height for bars with 0 votes
    
    return (
      <div className="flex items-end justify-center gap-3 max-w-4xl mx-auto" style={{ height: `${chartHeight}px` }}>
        {options.map((option, index) => {
          const count = voteCounts[option.id] || 0;
          // Calculate bar height - only show real height if there are votes
          const barHeight = count > 0 && maxVotes > 0 
            ? Math.max((count / maxVotes) * (chartHeight - 60), 40) // At least 40px for bars with votes
            : minBarHeight; // Very small for 0 votes
          const color = option.color || SCALE_COLORS[index % SCALE_COLORS.length];
          
          return (
            <div key={option.id} className="flex flex-col items-center justify-end flex-1 max-w-20 h-full">
              {/* Vote count - only show if > 0 */}
              <span 
                className="text-lg font-bold mb-2 transition-all duration-300"
                style={{ 
                  color: count > 0 ? color : '#94a3b8',
                  opacity: count > 0 ? 1 : 0.5,
                }}
              >
                {count}
              </span>
              {/* Bar */}
              <div 
                className="w-full rounded-t-xl transition-all duration-500 ease-out"
                style={{ 
                  height: `${barHeight}px`,
                  backgroundColor: color,
                  opacity: count > 0 ? 1 : 0.3,
                }}
              />
              {/* Label */}
              <span 
                className="text-base font-bold mt-3" 
                style={{ color }}
              >
                {option.label}
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  
  // Horizontal bar chart (default)
  return (
    <div className="space-y-4 w-full max-w-2xl mx-auto">
      {options.map((option, index) => {
        const count = voteCounts[option.id] || 0;
        const percentage = totalVoters > 0 ? Math.round((count / totalVoters) * 100) : 0;
        const barWidth = maxVotes > 0 ? (count / maxVotes) * 100 : 0;
        const color = option.color || OPTION_COLORS[index % OPTION_COLORS.length];
        
        return (
          <div key={option.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {option.emoji || option.label}
                </div>
                <span className="font-medium text-[#4E5871]">{option.content || option.label}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <span className="font-bold text-lg" style={{ color }}>{count}</span>
                <span className="text-sm">({percentage}%)</span>
              </div>
            </div>
            <div className="h-8 bg-slate-100 rounded-lg overflow-hidden">
              <div 
                className="h-full rounded-lg transition-all duration-500 ease-out flex items-center justify-end pr-3"
                style={{ 
                  width: `${barWidth}%`,
                  backgroundColor: color,
                  minWidth: count > 0 ? '40px' : '0',
                }}
              >
                {count > 0 && (
                  <span className="text-white font-bold text-sm">{count}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Pie Chart Component
function PieChartView({ 
  options, 
  voteCounts, 
  totalVoters 
}: { 
  options: VotingOption[]; 
  voteCounts: Record<string, number>;
  totalVoters: number;
}) {
  // Calculate pie segments
  const segments = useMemo(() => {
    let currentAngle = 0;
    return options.map((option, index) => {
      const count = voteCounts[option.id] || 0;
      const percentage = totalVoters > 0 ? (count / totalVoters) * 100 : 0;
      const angle = (percentage / 100) * 360;
      const startAngle = currentAngle;
      currentAngle += angle;
      return {
        option,
        count,
        percentage: Math.round(percentage),
        startAngle,
        endAngle: currentAngle,
        color: option.color || OPTION_COLORS[index % OPTION_COLORS.length],
      };
    }).filter(s => s.count > 0);
  }, [options, voteCounts, totalVoters]);

  // Create SVG path for pie segment
  const createPieSegment = (startAngle: number, endAngle: number, color: string) => {
    const cx = 150;
    const cy = 150;
    const r = 140;
    
    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);
    
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
    
    return (
      <path
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
        fill={color}
        className="transition-all duration-500"
      />
    );
  };

  return (
    <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12">
      {/* Full Pie chart - large */}
      <div className="relative flex-shrink-0">
        <svg width="300" height="300" viewBox="0 0 300 300">
          {segments.length === 0 ? (
            <circle cx="150" cy="150" r="140" fill="#e2e8f0" />
          ) : segments.length === 1 ? (
            <circle cx="150" cy="150" r="140" fill={segments[0].color} />
          ) : (
            segments.map((segment, i) => (
              <g key={i}>
                {createPieSegment(segment.startAngle, segment.endAngle, segment.color)}
              </g>
            ))
          )}
        </svg>
      </div>
      
      {/* Legend */}
      <div className="space-y-3">
        {options.map((option, index) => {
          const count = voteCounts[option.id] || 0;
          const percentage = totalVoters > 0 ? Math.round((count / totalVoters) * 100) : 0;
          const color = option.color || OPTION_COLORS[index % OPTION_COLORS.length];
          
          return (
            <div key={option.id} className="flex items-center gap-3">
              <div 
                className="w-5 h-5 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="font-semibold text-[#4E5871] min-w-[100px]">
                {option.content || option.label}
              </span>
              <span className="text-slate-600 font-bold text-lg">
                {count}
              </span>
              <span className="text-slate-400">
                ({percentage}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Feedback Chart (visual emoji/hearts display)
function FeedbackChartView({ 
  options, 
  voteCounts, 
  totalVoters,
  feedbackStyle,
}: { 
  options: VotingOption[]; 
  voteCounts: Record<string, number>;
  totalVoters: number;
  feedbackStyle?: 'emoji' | 'hearts';
}) {
  const maxVotes = Math.max(...Object.values(voteCounts), 1);
  
  return (
    <div className="flex items-end justify-center gap-6 md:gap-10 max-w-4xl mx-auto py-8">
      {options.map((option, index) => {
        const count = voteCounts[option.id] || 0;
        // Scale from 0.5 to 1.2 based on position
        const baseScale = 0.5 + (index / (options.length - 1)) * 0.7;
        // Add extra scale for items with more votes
        const voteScale = count > 0 ? 1 + (count / maxVotes) * 0.2 : 1;
        const isFilled = count > 0;
        
        return (
          <div key={option.id} className="flex flex-col items-center">
            {/* Icon */}
            <div 
              className="transition-all duration-500"
              style={{ 
                transform: `scale(${baseScale * voteScale})`,
                opacity: isFilled ? 1 : 0.3,
              }}
            >
              {feedbackStyle === 'hearts' ? (
                <Heart 
                  style={{ 
                    width: '120px',
                    height: '120px',
                    fill: isFilled ? '#ef4444' : '#e2e8f0',
                    color: isFilled ? '#ef4444' : '#cbd5e1',
                    filter: isFilled ? 'drop-shadow(0 4px 12px rgba(239, 68, 68, 0.4))' : 'none',
                    transition: 'all 0.3s ease',
                  }}
                />
              ) : (
                <span 
                  style={{ 
                    fontSize: '100px',
                    lineHeight: 1,
                    filter: isFilled ? 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15))' : 'none',
                  }}
                >
                  {option.emoji || option.content}
                </span>
              )}
            </div>
            {/* Count */}
            <span 
              className="text-2xl font-bold mt-4 transition-all"
              style={{ 
                color: isFilled ? '#4E5871' : '#94a3b8',
              }}
            >
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Scale Voting UI (student view)
function ScaleVotingView({
  options,
  selectedOption,
  myVote,
  hasVoted,
  readOnly,
  onSelect,
  minLabel,
  maxLabel,
}: {
  options: VotingOption[];
  selectedOption: string | null;
  myVote: string[] | null;
  hasVoted: boolean;
  readOnly: boolean;
  onSelect: (optionId: string) => void;
  minLabel?: string;
  maxLabel?: string;
}) {
  return (
    <div className="max-w-3xl mx-auto">
      {/* Labels */}
      <div className="flex justify-between mb-4">
        <span className="text-lg font-bold text-orange-500">{minLabel || 'Min'}</span>
        <span className="text-lg font-bold text-indigo-500">{maxLabel || 'Max'}</span>
      </div>
      
      {/* Scale buttons */}
      <div className="flex gap-2">
        {options.map((option, index) => {
          const isSelected = selectedOption === option.id;
          const isMyVote = myVote?.includes(option.id);
          const color = option.color || SCALE_COLORS[index % SCALE_COLORS.length];
          
          return (
            <button
              key={option.id}
              onClick={() => onSelect(option.id)}
              disabled={hasVoted || readOnly}
              className="flex-1 aspect-square rounded-xl font-bold text-white text-xl transition-all hover:scale-105"
              style={{
                backgroundColor: color,
                opacity: hasVoted && !isMyVote ? 0.4 : 1,
                transform: isSelected || isMyVote ? 'scale(1.1)' : 'scale(1)',
                boxShadow: isSelected || isMyVote ? '0 0 0 3px white, 0 0 0 5px ' + color : 'none',
                cursor: hasVoted || readOnly ? 'default' : 'pointer',
              }}
            >
              {isSelected || isMyVote ? <Check className="w-6 h-6 mx-auto" /> : option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Feedback Voting UI (student view)
function FeedbackVotingView({
  options,
  selectedOption,
  myVote,
  hasVoted,
  readOnly,
  onSelect,
  feedbackStyle,
}: {
  options: VotingOption[];
  selectedOption: string | null;
  myVote: string[] | null;
  hasVoted: boolean;
  readOnly: boolean;
  onSelect: (optionId: string) => void;
  feedbackStyle?: 'emoji' | 'hearts';
}) {
  return (
    <div className="flex justify-center items-end gap-4 md:gap-8 max-w-4xl mx-auto py-8">
      {options.map((option, index) => {
        const isSelected = selectedOption === option.id;
        const isMyVote = myVote?.includes(option.id);
        // Scale from 0.5 to 1.2 based on position
        const baseScale = 0.5 + (index / (options.length - 1)) * 0.7;
        const activeScale = isSelected || isMyVote ? baseScale * 1.2 : baseScale;
        
        return (
          <button
            key={option.id}
            onClick={() => onSelect(option.id)}
            disabled={hasVoted || readOnly}
            className="flex flex-col items-center transition-all duration-300 hover:scale-110"
            style={{
              opacity: hasVoted && !isMyVote ? 0.3 : 1,
              cursor: hasVoted || readOnly ? 'default' : 'pointer',
            }}
          >
            <div 
              className="transition-all duration-300"
              style={{ 
                transform: `scale(${activeScale})`,
              }}
            >
              {feedbackStyle === 'hearts' ? (
                <Heart 
                  style={{ 
                    width: '120px',
                    height: '120px',
                    fill: isSelected || isMyVote ? '#ef4444' : '#e2e8f0',
                    color: isSelected || isMyVote ? '#ef4444' : '#cbd5e1',
                    filter: isSelected || isMyVote ? 'drop-shadow(0 4px 12px rgba(239, 68, 68, 0.4))' : 'none',
                    transition: 'all 0.3s ease',
                  }}
                />
              ) : (
                <span 
                  style={{ 
                    fontSize: '100px',
                    lineHeight: 1,
                    filter: isSelected || isMyVote ? 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.2))' : 'none',
                  }}
                >
                  {option.emoji || option.content}
                </span>
              )}
            </div>
            {(isSelected || isMyVote) && (
              <div className="mt-4 w-4 h-4 rounded-full bg-sky-500 shadow-lg" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// Main component
export function VotingSlideView({
  slide,
  isTeacher = false,
  hasVoted = false,
  myVote = null,
  voteCounts = {},
  totalVoters = 0,
  onVote,
  readOnly = false,
}: VotingSlideViewProps) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>(myVote || []);
  const [showResults, setShowResults] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Default votingType for backwards compatibility
  const votingType: VotingType = slide.votingType || (slide.allowMultiple ? 'multiple' : 'single');

  // Reset showResults only when slide changes (not when votes update)
  useEffect(() => {
    setShowResults(false);
    setIsSubmitting(false);
  }, [slide.id]);
  
  // Update selected options when myVote changes (but don't reset showResults)
  useEffect(() => {
    setSelectedOptions(myVote || []);
  }, [myVote]);

  const questionFontSize = getQuestionFontSize(slide.question || '');
  const canShowResults = hasVoted && slide.showResultsToStudents;
  const showChart = isTeacher || showResults;

  const handleOptionClick = (optionId: string) => {
    if (hasVoted || readOnly || isTeacher) return;
    
    if (votingType === 'multiple') {
      // Toggle selection for multiple choice
      setSelectedOptions(prev => 
        prev.includes(optionId) 
          ? prev.filter(id => id !== optionId)
          : [...prev, optionId]
      );
    } else {
      // Single selection for all other types
      setSelectedOptions([optionId]);
    }
  };

  const handleSubmitVote = async () => {
    if (selectedOptions.length === 0 || !onVote) return;
    
    setIsSubmitting(true);
    try {
      await onVote(selectedOptions);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render chart based on voting type
  const renderChart = () => {
    if (votingType === 'scale') {
      return (
        <div>
          {/* Scale labels */}
          <div className="flex justify-between max-w-3xl mx-auto mb-4">
            <span className="text-lg font-bold text-orange-500">{slide.scaleMinLabel || 'Min'}</span>
            <span className="text-lg font-bold text-indigo-500">{slide.scaleMaxLabel || 'Max'}</span>
          </div>
          <BarChartView options={slide.options} voteCounts={voteCounts} totalVoters={totalVoters} isScale />
        </div>
      );
    }
    
    if (votingType === 'feedback') {
      return <FeedbackChartView options={slide.options} voteCounts={voteCounts} totalVoters={totalVoters} feedbackStyle={slide.feedbackStyle} />;
    }
    
    if (votingType === 'multiple') {
      return <BarChartView options={slide.options} voteCounts={voteCounts} totalVoters={totalVoters} />;
    }
    
    // Single choice - pie chart
    return <PieChartView options={slide.options} voteCounts={voteCounts} totalVoters={totalVoters} />;
  };

  // Render voting UI based on voting type
  const renderVotingUI = () => {
    if (votingType === 'scale') {
      return (
        <ScaleVotingView
          options={slide.options}
          selectedOption={selectedOptions[0] || null}
          myVote={myVote}
          hasVoted={hasVoted}
          readOnly={readOnly}
          onSelect={handleOptionClick}
          minLabel={slide.scaleMinLabel}
          maxLabel={slide.scaleMaxLabel}
        />
      );
    }
    
    if (votingType === 'feedback') {
      return (
        <FeedbackVotingView
          options={slide.options}
          selectedOption={selectedOptions[0] || null}
          myVote={myVote}
          hasVoted={hasVoted}
          readOnly={readOnly}
          onSelect={handleOptionClick}
          feedbackStyle={slide.feedbackStyle}
        />
      );
    }
    
    // Standard options (single/multiple)
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 max-w-4xl mx-auto mb-8">
        {slide.options.map((option, index) => {
          const isSelected = selectedOptions.includes(option.id);
          const isMyVote = myVote?.includes(option.id);
          const color = option.color || OPTION_COLORS[index % OPTION_COLORS.length];
          
          return (
            <button
              key={option.id}
              onClick={() => handleOptionClick(option.id)}
              disabled={hasVoted || readOnly}
              className="p-3 lg:p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-3 lg:gap-4 hover:shadow-md"
              style={{
                borderColor: isSelected || isMyVote ? color : '#e2e8f0',
                backgroundColor: isSelected || isMyVote ? `${color}15` : '#ffffff',
                opacity: hasVoted && !isMyVote ? 0.5 : 1,
                cursor: hasVoted || readOnly ? 'default' : 'pointer',
              }}
            >
              <div 
                className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center font-bold text-white text-base lg:text-lg flex-shrink-0"
                style={{ backgroundColor: color }}
              >
                {isSelected || isMyVote ? (
                  <Check className="w-5 h-5" />
                ) : (
                  option.label
                )}
              </div>
              <span className="font-medium text-[#4E5871] text-base lg:text-lg">
                {option.content || option.label}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-50 via-white to-sky-50/30 rounded-3xl overflow-auto">
      <div 
        className="max-w-4xl mx-auto"
        style={{ padding: '48px 32px' }}
      >
        {/* Question */}
        <div className="text-center mb-8" style={{ paddingTop: '40px' }}>
          <h2 
            className="font-bold text-[#4E5871] leading-tight mb-4"
            style={{ fontSize: questionFontSize }}
          >
            {slide.question || 'Otázka...'}
          </h2>
          
          {/* Image if present */}
          {slide.media?.url && (
            <div className="flex justify-center mb-6">
              <img
                src={slide.media.url}
                alt="Obrázek k otázce"
                className="max-w-full max-h-64 rounded-2xl shadow-lg object-contain"
              />
            </div>
          )}
          
          {/* Stats for teacher */}
          {isTeacher && (
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm">
                <Users className="w-4 h-4 text-sky-500" />
                <span className="font-medium text-slate-600">{totalVoters} hlasů</span>
              </div>
            </div>
          )}
        </div>

        {/* Teacher View - Always show chart */}
        {isTeacher && (
          <div className="mb-8">
            {totalVoters === 0 ? (
              <div className="text-center py-12">
                <Loader2 className="w-12 h-12 mx-auto mb-4 text-sky-300 animate-spin" />
                <p className="text-lg text-slate-500">Čekáme na hlasy...</p>
                <p className="text-sm text-slate-400 mt-2">Výsledky se zobrazí automaticky</p>
              </div>
            ) : (
              <div className="py-4">
                {renderChart()}
              </div>
            )}
          </div>
        )}

        {/* Student View */}
        {!isTeacher && (
          <>
            {/* Show results if voted and allowed */}
            {showChart && canShowResults ? (
              <div className="mb-8 py-4">
                {renderChart()}
              </div>
            ) : (
              /* Voting UI */
              <div className="mb-8">
                {renderVotingUI()}
              </div>
            )}

            {/* Submit button or Show results button */}
            <div className="text-center">
              {!hasVoted && !readOnly && (
                <button
                  onClick={handleSubmitVote}
                  disabled={selectedOptions.length === 0 || isSubmitting}
                  className="px-8 py-4 rounded-xl font-bold text-lg text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  style={{
                    background: selectedOptions.length > 0 
                      ? 'linear-gradient(to right, #0ea5e9, #06b6d4)' 
                      : '#94a3b8',
                    boxShadow: selectedOptions.length > 0 
                      ? '0 10px 25px -5px rgba(14, 165, 233, 0.4)' 
                      : 'none',
                  }}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Odesílám...
                    </span>
                  ) : (
                    'Hlasovat'
                  )}
                </button>
              )}
              
              {hasVoted && slide.showResultsToStudents && !showResults && (
                <button
                  onClick={() => setShowResults(true)}
                  className="flex items-center gap-2 mx-auto px-6 py-3 rounded-xl font-medium text-sky-600 bg-sky-50 hover:bg-sky-100 transition-colors"
                >
                  <Eye className="w-5 h-5" />
                  Zobrazit výsledky
                </button>
              )}
              
              {hasVoted && !slide.showResultsToStudents && (
                <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-green-50 text-green-600">
                  <Check className="w-5 h-5" />
                  Tvůj hlas byl zaznamenán
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default VotingSlideView;
