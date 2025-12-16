import React, { useState } from 'react';
import { WorksheetData } from '../types/worksheet';
import { 
  ArrowLeft, 
  ArrowRight, 
  BookOpen, 
  Printer, 
  CheckCircle, 
  FileText, 
  Share2, 
  GraduationCap,
  Play,
  Gamepad2,
  Book,
  Download,
  Mail,
  MoreHorizontal
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface WorksheetViewProps {
  title: string;
  data: WorksheetData;
  onPrev?: () => void;
  onNext?: () => void;
  prevPageNumber?: string;
  nextPageNumber?: string;
  showNavigation?: boolean;
  slideDirection?: 'left' | 'right' | null;
}

export function WorksheetView({ title, data, onPrev, onNext, prevPageNumber, nextPageNumber, showNavigation = false, slideDirection }: WorksheetViewProps) {
  const [prevHovered, setPrevHovered] = useState(false);
  const [nextHovered, setNextHovered] = useState(false);
  
  // Always animate on mount when showNavigation is true (we're in a workbook)
  // Use slideDirection if provided, otherwise default to right
  const animationClass = showNavigation ? 'worksheet-fade-in' : '';
    
  return (
    <div className="flex flex-col lg:flex-row min-h-[800px] bg-white rounded-[25px] overflow-hidden -ml-[20px] -mt-[20px] -mb-[30px]">
      {/* Left Column - Dark Preview Area */}
      <div className="lg:w-[55%] bg-[#4E5871] py-2 px-4 flex flex-col items-center relative text-white rounded-[25px]">
        
        {/* Header */}
        <h1 className="text-lg font-semibold text-center mb-8 mt-[40px] font-['Fenomen_Sans']">
          {title}
        </h1>

        {/* Open Chapter Button */}
        <a 
          href={data.interactiveUrl || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className={`bg-[#7EE7C8] text-slate-800 px-6 py-3 rounded-lg font-medium flex items-center gap-3 mb-12 hover:opacity-90 transition-opacity shadow-sm ${!data.interactiveUrl && 'opacity-50 cursor-not-allowed pointer-events-none'}`}
        >
          <BookOpen className="h-5 w-5" />
          Otevřít kapitolu
        </a>

        {/* Preview Container with Navigation */}
        <div className="flex items-center justify-center w-full gap-4 md:gap-8 relative flex-1">
          
          {/* Prev Arrow with expandable pill - only show if in workbook */}
          {showNavigation && (
            <button 
              onClick={onPrev}
              disabled={!onPrev}
              onMouseEnter={() => setPrevHovered(true)}
              onMouseLeave={() => setPrevHovered(false)}
              className="relative z-10 flex flex-col items-center justify-center transition-all duration-300 ease-out"
              style={{
                backgroundColor: onPrev ? '#A5B4FC' : '#64748B',
                borderRadius: '50px',
                width: '56px',
                height: prevHovered && onPrev ? '120px' : '56px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                opacity: onPrev ? 1 : 0.5,
                cursor: onPrev ? 'pointer' : 'not-allowed'
              }}
            >
              {prevHovered && onPrev && prevPageNumber && (
                <span className="text-[#312E81] text-base font-bold mb-2 transition-opacity duration-200">
                  {prevPageNumber}
                </span>
              )}
              <ArrowLeft className="h-6 w-6 text-[#1E293B]" strokeWidth={2.5} />
            </button>
          )}

          {/* Worksheet Image Preview */}
          <div 
            key={title}
            className={`relative bg-white p-1 shadow-2xl rounded max-w-[280px] w-full aspect-[1/1.41] ${animationClass}`}
          >
             {data.previewUrl ? (
               <ImageWithFallback 
                 src={data.previewUrl} 
                 alt="Náhled pracovního listu"
                 className="w-full h-full object-cover rounded-sm"
               />
             ) : (
               <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50">
                 <FileText className="h-16 w-16 mb-4 opacity-20" />
                 <p className="text-sm">Náhled není k dispozici</p>
               </div>
             )}
          </div>

          {/* Next Arrow with expandable pill - only show if in workbook */}
          {showNavigation && (
            <button 
              onClick={onNext}
              disabled={!onNext}
              onMouseEnter={() => setNextHovered(true)}
              onMouseLeave={() => setNextHovered(false)}
              className="relative z-10 flex flex-col items-center justify-center transition-all duration-300 ease-out"
              style={{
                backgroundColor: onNext ? '#A5B4FC' : '#64748B',
                borderRadius: '50px',
                width: '56px',
                height: nextHovered && onNext ? '120px' : '56px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                opacity: onNext ? 1 : 0.5,
                cursor: onNext ? 'pointer' : 'not-allowed'
              }}
            >
              {nextHovered && onNext && nextPageNumber && (
                <span className="text-[#312E81] text-base font-bold mb-2 transition-opacity duration-200">
                  {nextPageNumber}
                </span>
              )}
              <ArrowRight className="h-6 w-6 text-[#1E293B]" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {/* Right Column - Actions & Content */}
      <div className="lg:w-[45%] p-8 bg-white flex flex-col gap-8 overflow-y-auto">
        
        {/* Action Buttons Grid */}
        <div>
          <h3 className="text-[#4E5871] font-bold text-lg mb-4">Další možnosti:</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {data.pdfUrl && (
              <a 
                href={data.pdfUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 rounded-lg transition-colors bg-[#4F46E5] text-white hover:bg-[#4338CA]"
              >
                <Printer className="h-6 w-6" />
                <span className="font-medium">Otevřít PDF</span>
              </a>
            )}

            {data.solutionPdfUrl && (
              <a 
                href={data.solutionPdfUrl}
                target="_blank"
                rel="noopener noreferrer" 
                className="flex items-center gap-3 p-4 rounded-lg transition-colors bg-[#E2E8F0] text-[#475569] hover:bg-[#CBD5E1]"
              >
                <CheckCircle className="h-6 w-6" />
                <span className="font-medium">Řešení PDF</span>
              </a>
            )}

            {data.textbookUrl && (
              <a 
                 href={data.textbookUrl}
                 target="_blank"
                 rel="noopener noreferrer"
                 className="flex items-center gap-3 p-4 rounded-lg transition-colors bg-[#E2E8F0] text-[#475569] hover:bg-[#CBD5E1]"
              >
                <Book className="h-6 w-6" />
                <span className="font-medium">Učební text</span>
              </a>
            )}

            {data.methodologyUrl && (
              <a 
                 href={data.methodologyUrl}
                 target="_blank"
                 rel="noopener noreferrer"
                 className="flex items-center gap-3 p-4 rounded-lg transition-colors bg-[#E2E8F0] text-[#475569] hover:bg-[#CBD5E1]"
              >
                <GraduationCap className="h-6 w-6" />
                <span className="font-medium">Metodika</span>
              </a>
            )}
          </div>

          {/* Share Bar */}
          <div className="flex items-center gap-4 text-[#64748B]">
            <button className="flex items-center gap-2 hover:text-[#475569]">
              <Share2 className="h-5 w-5" />
              <span className="font-medium">Sdílet</span>
            </button>
            <div className="h-4 w-px bg-gray-300"></div>
            <div className="flex items-center gap-3">
               {/* Placeholder icons for social share */}
               <div className="w-6 h-6 rounded bg-gray-200 flex items-center justify-center text-xs">✉️</div>
               <div className="w-6 h-6 rounded bg-indigo-100 flex items-center justify-center text-xs text-indigo-700">T</div>
               <div className="w-6 h-6 rounded bg-green-100 flex items-center justify-center text-xs text-green-700">C</div>
               <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center text-xs text-blue-700">f</div>
            </div>
          </div>
        </div>

        {/* Practice Section */}
        {data.exercises.length > 0 && (
          <div>
            <h3 className="text-[#4E5871] font-bold text-lg mb-4">Procvičování</h3>
            <div className="space-y-3">
              {data.exercises.map((item) => (
                <a 
                  key={item.id}
                  href={item.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-4 p-3 rounded-xl transition-colors group ${
                    item.level === 1 ? 'bg-amber-50 hover:bg-amber-100' :
                    item.level === 2 ? 'bg-cyan-50 hover:bg-cyan-100' :
                    'bg-rose-50 hover:bg-rose-100'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                     item.level === 1 ? 'bg-[#00C29A] text-white' : // Green play button from design
                     item.level === 2 ? 'bg-[#00C29A] text-white' :
                     'bg-[#00C29A] text-white'
                  }`}>
                    <Play className="h-5 w-5 fill-current" />
                  </div>
                  
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ${
                    item.level === 1 ? 'bg-[#FCD34D] text-[#92400E]' :
                    item.level === 2 ? 'bg-[#67E8F9] text-[#155E75]' :
                    'bg-[#FDA4AF] text-[#9F1239]'
                  }`}>
                    {item.level}
                  </div>

                  <span className="font-medium text-[#334155]">{item.label}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Minigames Section */}
        {data.minigames.length > 0 && (
          <div>
            <h3 className="text-[#4E5871] font-bold text-lg mb-4">Procvičovací minihry</h3>
            <div className="space-y-3">
               {data.minigames.map((item) => (
                 <a
                   key={item.id}
                   href={item.url || '#'}
                   target="_blank"
                   rel="noopener noreferrer"
                   className="flex items-center gap-4 p-4 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] transition-colors"
                 >
                    <div className="w-10 h-10 rounded-full bg-[#4F46E5] flex items-center justify-center text-white shrink-0">
                      <Gamepad2 className="h-5 w-5" />
                    </div>
                    <span className="font-medium text-[#334155]">{item.label}</span>
                 </a>
               ))}
            </div>
          </div>
        )}
        
        {/* Tests Section */}
        {data.tests.length > 0 && (
          <div>
            <h3 className="text-[#4E5871] font-bold text-lg mb-4">Testy</h3>
             <div className="space-y-3">
               {data.tests.map((item) => (
                 <a
                   key={item.id}
                   href={item.url || '#'}
                   target="_blank"
                   rel="noopener noreferrer"
                   className="flex items-center gap-4 p-4 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] transition-colors"
                 >
                    <span className="font-medium text-[#334155]">{item.label}</span>
                 </a>
               ))}
            </div>
          </div>
        )}

        {/* Exams/Bonus Section (Example for generic links) */}
        {(data.exams.length > 0 || data.bonuses.length > 0) && (
           <div>
             <h3 className="text-[#4E5871] font-bold text-lg mb-4">Bonusy</h3>
             <div className="space-y-3">
                {[...data.exams, ...data.bonuses].map((item) => (
                  <a
                   key={item.id}
                   href={item.url || '#'}
                   target="_blank"
                   rel="noopener noreferrer"
                   className="flex items-center gap-4 p-4 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] transition-colors"
                 >
                    <span className="font-medium text-[#334155]">{item.label}</span>
                 </a>
                ))}
             </div>
           </div>
        )}

      </div>
    </div>
  );
}
