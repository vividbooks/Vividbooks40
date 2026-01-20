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
  MoreHorizontal,
  Plus,
  Sparkles,
  X,
  FileEdit
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ImageWithFallback } from './figma/ImageWithFallback';

// Helper to check if URL is a board:// URL or contains a board UUID, and extract board ID
const extractBoardId = (url: string): string | null => {
  if (!url) return null;
  
  // Direct board:// URL
  if (url.startsWith('board://')) {
    return url.replace('board://', '');
  }
  
  // Check for VividBoard URLs that contain UUIDs
  // Patterns: 
  // - https://app.vividboard.cz/setup/{UUID}
  // - https://vividboard.vividbooks.com/share/{UUID}
  // - https://api.vividboard.cz/boards/{UUID}
  const uuidPattern = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
  const isVividboardUrl = url.includes('vividboard');
  
  if (isVividboardUrl) {
    const match = url.match(uuidPattern);
    if (match) {
      // Check if we have this board imported (with imported- prefix)
      const importedId = `imported-${match[1]}`;
      // Return the imported ID which is what we use in our system
      return importedId;
    }
  }
  
  return null;
};

interface WorksheetViewProps {
  title: string;
  data: WorksheetData;
  onPrev?: () => void;
  onNext?: () => void;
  prevPageNumber?: string;
  nextPageNumber?: string;
  showNavigation?: boolean;
  slideDirection?: 'left' | 'right' | null;
  /** AI transcript of PDF for creating Vividboard */
  pdfTranscript?: string;
}

export function WorksheetView({ title, data, onPrev, onNext, prevPageNumber, nextPageNumber, showNavigation = false, slideDirection, pdfTranscript }: WorksheetViewProps) {
  const navigate = useNavigate();
  const [prevHovered, setPrevHovered] = useState(false);
  const [nextHovered, setNextHovered] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  
  // Handler for clicking on items that might be board:// URLs
  const handleItemClick = (url: string, e: React.MouseEvent) => {
    const boardId = extractBoardId(url);
    if (boardId) {
      e.preventDefault();
      navigate(`/quiz/view/${boardId}`);
    }
    // If not a board URL, let the default <a> behavior handle it
  };
  
  // Always animate on mount when showNavigation is true (we're in a workbook)
  // Use slideDirection if provided, otherwise default to right
  const animationClass = showNavigation ? 'worksheet-fade-in' : '';
    
  return (
    <div className="flex flex-col lg:flex-row min-h-[800px] bg-white rounded-[25px] overflow-hidden -ml-[20px] -mt-[20px] -mb-[30px]">
      {/* Left Column - Dark Preview Area - Sticky */}
      <div className="lg:w-[55%] bg-[#4E5871] py-2 px-4 flex flex-col items-center relative text-white rounded-[25px] lg:sticky lg:top-0 lg:self-start lg:h-screen">
        
        {/* Header and Button - Fixed at top */}
        <div className="absolute top-0 left-0 right-0 flex flex-col items-center px-4 z-20">
          <h1 className="text-lg font-semibold text-center mb-4 mt-[40px] font-['Fenomen_Sans']">
            {title}
          </h1>

          <a 
            href={extractBoardId(data.interactiveUrl || '') ? '#' : (data.interactiveUrl || '#')}
            target={extractBoardId(data.interactiveUrl || '') ? undefined : "_blank"}
            rel={extractBoardId(data.interactiveUrl || '') ? undefined : "noopener noreferrer"}
            onClick={(e) => handleItemClick(data.interactiveUrl || '', e)}
            className={`bg-[#7EE7C8] text-slate-800 px-6 py-3 rounded-lg font-medium flex items-center gap-3 hover:opacity-90 transition-opacity shadow-sm cursor-pointer ${!data.interactiveUrl && 'opacity-50 cursor-not-allowed pointer-events-none'}`}
          >
            <BookOpen className="h-5 w-5" />
            Otevřít kapitolu
          </a>
        </div>

        {/* Preview Container with Navigation - Positioned at 250px from top */}
        <div className="flex items-center justify-center w-full gap-4 md:gap-8 relative z-10" style={{ marginTop: '250px' }}>
          
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
             {(data.previewImageUrl || data.previewUrl) ? (
               <ImageWithFallback 
                 src={data.previewImageUrl || data.previewUrl || ''} 
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

            {/* Interactive Worksheet - Primary action if available */}
            {data.interactiveWorksheets && data.interactiveWorksheets.length > 0 && (
              <a 
                href={extractBoardId(data.interactiveWorksheets[0].url || '') ? '#' : (data.interactiveWorksheets[0].url || '#')}
                target={extractBoardId(data.interactiveWorksheets[0].url || '') ? undefined : "_blank"}
                rel={extractBoardId(data.interactiveWorksheets[0].url || '') ? undefined : "noopener noreferrer"}
                onClick={(e) => handleItemClick(data.interactiveWorksheets[0].url || '', e)}
                className="flex items-center gap-3 p-4 rounded-lg transition-colors bg-[#10B981] text-white hover:bg-[#059669] cursor-pointer"
              >
                <Play className="h-6 w-6" />
                <span className="font-medium">Interaktivní verze</span>
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

        {/* Additional Interactive Worksheets (if more than 1) */}
        {data.interactiveWorksheets && data.interactiveWorksheets.length > 1 && (
          <div>
            <h3 className="text-[#4E5871] font-bold text-lg mb-4">Interaktivní verze</h3>
            <div className="space-y-3">
              {data.interactiveWorksheets.map((item) => (
                <a
                  key={item.id}
                  href={extractBoardId(item.url || '') ? '#' : (item.url || '#')}
                  target={extractBoardId(item.url || '') ? undefined : "_blank"}
                  rel={extractBoardId(item.url || '') ? undefined : "noopener noreferrer"}
                  onClick={(e) => handleItemClick(item.url || '', e)}
                  className="flex items-center gap-4 p-4 rounded-xl bg-[#D1FAE5] hover:bg-[#A7F3D0] transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-[#10B981] flex items-center justify-center text-white shrink-0">
                    <Play className="h-5 w-5 fill-current" />
                  </div>
                  <span className="font-medium text-[#334155]">{item.label}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Interactive Solutions */}
        {data.interactiveSolutions && data.interactiveSolutions.length > 0 && (
          <div>
            <h3 className="text-[#4E5871] font-bold text-lg mb-4">Interaktivní řešení</h3>
            <div className="space-y-3">
              {data.interactiveSolutions.map((item) => (
                <a
                  key={item.id}
                  href={extractBoardId(item.url || '') ? '#' : (item.url || '#')}
                  target={extractBoardId(item.url || '') ? undefined : "_blank"}
                  rel={extractBoardId(item.url || '') ? undefined : "noopener noreferrer"}
                  onClick={(e) => handleItemClick(item.url || '', e)}
                  className="flex items-center gap-4 p-4 rounded-xl bg-[#DBEAFE] hover:bg-[#BFDBFE] transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-[#3B82F6] flex items-center justify-center text-white shrink-0">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <span className="font-medium text-[#334155]">{item.label}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Practice Section */}
        {data.exercises && data.exercises.length > 0 && (
          <div>
            <h3 className="text-[#4E5871] font-bold text-lg mb-4">Procvičování</h3>
            <div className="space-y-3">
              {data.exercises.map((item) => (
                <a 
                  key={item.id}
                  href={extractBoardId(item.url || '') ? '#' : (item.url || '#')}
                  target={extractBoardId(item.url || '') ? undefined : "_blank"}
                  rel={extractBoardId(item.url || '') ? undefined : "noopener noreferrer"}
                  onClick={(e) => handleItemClick(item.url || '', e)}
                  className={`flex items-center gap-4 p-3 rounded-xl transition-colors group cursor-pointer ${
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
        {data.minigames && data.minigames.length > 0 && (
          <div>
            <h3 className="text-[#4E5871] font-bold text-lg mb-4">Procvičovací minihry</h3>
            <div className="space-y-3">
               {data.minigames.map((item) => (
                 <a
                   key={item.id}
                   href={extractBoardId(item.url || '') ? '#' : (item.url || '#')}
                   target={extractBoardId(item.url || '') ? undefined : "_blank"}
                   rel={extractBoardId(item.url || '') ? undefined : "noopener noreferrer"}
                   onClick={(e) => handleItemClick(item.url || '', e)}
                   className="flex items-center gap-4 p-4 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] transition-colors cursor-pointer"
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
        {data.tests && data.tests.length > 0 && (
          <div>
            <h3 className="text-[#4E5871] font-bold text-lg mb-4">Testy</h3>
             <div className="space-y-3">
               {data.tests.map((item) => (
                 <a
                   key={item.id}
                   href={extractBoardId(item.url || '') ? '#' : (item.url || '#')}
                   target={extractBoardId(item.url || '') ? undefined : "_blank"}
                   rel={extractBoardId(item.url || '') ? undefined : "noopener noreferrer"}
                   onClick={(e) => handleItemClick(item.url || '', e)}
                   className="flex items-center gap-4 p-4 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] transition-colors cursor-pointer"
                 >
                    <span className="font-medium text-[#334155]">{item.label}</span>
                 </a>
               ))}
            </div>
          </div>
        )}

        {/* Exams Section (Písemky) */}
        {data.exams && data.exams.length > 0 && (
           <div>
             <h3 className="text-[#4E5871] font-bold text-lg mb-4">Písemky</h3>
             <div className="space-y-3">
                {data.exams.map((item) => (
                  <a
                   key={item.id}
                   href={extractBoardId(item.url || '') ? '#' : (item.url || '#')}
                   target={extractBoardId(item.url || '') ? undefined : "_blank"}
                   rel={extractBoardId(item.url || '') ? undefined : "noopener noreferrer"}
                   onClick={(e) => handleItemClick(item.url || '', e)}
                   className="flex items-center gap-4 p-4 rounded-xl bg-[#FEF3C7] hover:bg-[#FDE68A] transition-colors cursor-pointer"
                 >
                    <FileText className="h-5 w-5 text-[#92400E]" />
                    <span className="font-medium text-[#334155]">{item.label}</span>
                 </a>
                ))}
             </div>
           </div>
        )}

        {/* Bonuses Section (Bonusy a přílohy) */}
        {data.bonuses && data.bonuses.length > 0 && (
           <div>
             <h3 className="text-[#4E5871] font-bold text-lg mb-4">Bonusy a přílohy</h3>
             <div className="space-y-3">
                {data.bonuses.map((item) => (
                  <a
                   key={item.id}
                   href={extractBoardId(item.url || '') ? '#' : (item.url || '#')}
                   target={extractBoardId(item.url || '') ? undefined : "_blank"}
                   rel={extractBoardId(item.url || '') ? undefined : "noopener noreferrer"}
                   onClick={(e) => handleItemClick(item.url || '', e)}
                   className="flex items-center gap-4 p-4 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] transition-colors cursor-pointer"
                 >
                    <Download className="h-5 w-5 text-[#475569]" />
                    <span className="font-medium text-[#334155]">{item.label}</span>
                 </a>
                ))}
             </div>
           </div>
        )}

        {/* Create New Section */}
        <div className="pt-4 border-t border-slate-200">
          <button
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: '#f59e0b',
              color: 'white',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#d97706'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f59e0b'}
          >
            <Sparkles className="h-4 w-4" style={{ fill: 'white' }} />
            <span>Vytvořit další...</span>
          </button>
        </div>

      </div>

      {/* Create Dialog Popup */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreateDialog(false)}>
          <div 
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[#4E5871]">Vytvořit z podkladů</h2>
              <button 
                onClick={() => setShowCreateDialog(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-slate-600 mb-6">
              Použij tento pracovní list jako podklad pro vytvoření nového obsahu.
            </p>

            <div className="space-y-3">
              {/* Interaktivní Vividboard */}
              <button
                onClick={() => {
                  setShowCreateDialog(false);
                  // Store worksheet context for AI panel (include transcript if available)
                  const pdfData = {
                    title: `${title} - Vividboard`,
                    pdfUrl: data.pdfUrl || data.solutionPdfUrl,
                    transcript: pdfTranscript || '', // Pass the PDF transcript for AI
                    sourceTitle: title,
                    sourceType: 'worksheet'
                  };
                  console.log('[WorksheetView] Storing pdfData for Vividboard:', { 
                    title: pdfData.title, 
                    hasTranscript: !!pdfTranscript, 
                    transcriptLength: pdfTranscript?.length || 0 
                  });
                  sessionStorage.setItem('vividboard_from_pdf', JSON.stringify(pdfData));
                  // Navigate to new board with AI panel open
                  const newBoardId = Date.now();
                  navigate(`/quiz/edit/${newBoardId}?fromWorksheet=true&openAI=true`);
                }}
                className="w-full flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 hover:border-emerald-400 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow" style={{ backgroundColor: '#10b981' }}>
                  <Sparkles className="w-6 h-6" style={{ color: 'white', fill: 'white' }} />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-slate-800">Interaktivní Vividboard</div>
                  <div className="text-sm text-slate-500">Vytvoř kvízy a aktivity pomocí AI</div>
                </div>
              </button>

              {/* Tištěný pracovní list */}
              <button
                onClick={() => {
                  setShowCreateDialog(false);
                  // Store worksheet context for editor
                  const worksheetContext = {
                    title: `${title} - Pracovní list`,
                    pdfUrl: data.pdfUrl || data.solutionPdfUrl,
                    sourceTitle: title,
                    sourceType: 'worksheet'
                  };
                  sessionStorage.setItem('worksheet_editor_context', JSON.stringify(worksheetContext));
                  // Navigate to worksheet editor
                  const newId = `new-${Date.now()}`;
                  navigate(`/library/my-content/worksheet-editor/${newId}?fromWorksheet=true`);
                }}
                className="w-full flex items-center gap-4 p-4 rounded-xl bg-slate-50 border-2 border-slate-200 hover:border-slate-400 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow" style={{ backgroundColor: '#64748b' }}>
                  <FileEdit className="w-6 h-6" style={{ color: 'white' }} />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-slate-800">Tištěný pracovní list</div>
                  <div className="text-sm text-slate-500">Vytvoř PDF k tisku</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
