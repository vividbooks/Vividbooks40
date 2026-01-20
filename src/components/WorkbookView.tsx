import React, { useState, useEffect, useRef } from 'react';
import { WorkbookData, WorkbookBonus } from './admin/WorkbookEditor';
import { 
  ArrowLeft, 
  ArrowRight, 
  BookOpen, 
  ShoppingCart,
  Gift
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useAnalytics } from '../hooks/useAnalytics';

interface WorkbookPage {
  id: string;
  label: string;
  slug?: string;
  pageNumber?: string;
}

interface WorkbookViewProps {
  title: string;
  data: WorkbookData;
  pages: WorkbookPage[];
  category: string;
  workbookSlug?: string;
}

export function WorkbookView({ title, data, pages, category, workbookSlug }: WorkbookViewProps) {
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();
  const [prevHovered, setPrevHovered] = useState(false);
  const [nextHovered, setNextHovered] = useState(false);
  
  // Track workbook opened (only once per workbook)
  const lastTrackedWorkbook = useRef<string | null>(null);
  useEffect(() => {
    const workbookKey = `${category}/${workbookSlug}`;
    if (workbookKey !== lastTrackedWorkbook.current) {
      lastTrackedWorkbook.current = workbookKey;
      trackEvent('workbook_opened', 'document', {
        title: title,
        category: category,
        workbookSlug: workbookSlug,
        pageCount: pages.length
      });
    }
  }, [title, category, workbookSlug, trackEvent]);
  
  // Get first page for navigation
  const firstPage = pages.length > 0 ? pages[0] : null;
  const firstPageNumber = firstPage?.pageNumber || '1';

  const handleGoToFirstPage = () => {
    if (firstPage?.slug) {
      // Build full path: workbookSlug + childSlug
      const fullPath = workbookSlug ? `${workbookSlug}/${firstPage.slug}` : firstPage.slug;
      navigate(`/docs/${category}/${fullPath}`);
    }
  };

  // Don't show right column if no author and no bonuses
  const showRightColumn = data.author || (data.bonuses && data.bonuses.length > 0);

  return (
    <div className="flex flex-col lg:flex-row min-h-[800px] bg-white rounded-[25px] overflow-hidden -ml-[20px] -mt-[20px] -mb-[30px]">
      {/* Left Column - Dark Preview Area */}
      <div className={`${showRightColumn ? 'lg:w-[55%]' : 'lg:w-full'} bg-[#4E5871] py-8 px-4 flex flex-col items-center relative text-white rounded-[25px]`}>
        
        {/* Back Button */}
        <button 
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 p-2.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors z-10"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {/* Header */}
        <h1 className="text-xl md:text-2xl font-semibold text-center mb-8 mt-[40px] font-['Fenomen_Sans'] max-w-md">
          {title}
        </h1>

        {/* Preview Container with Navigation */}
        <div className="flex items-center justify-center w-full gap-4 md:gap-8 relative flex-1">
          
          {/* Prev Arrow - Always disabled on cover page */}
          <button 
            disabled
            onMouseEnter={() => setPrevHovered(true)}
            onMouseLeave={() => setPrevHovered(false)}
            className="relative z-10 flex flex-col items-center justify-center transition-all duration-300 ease-out"
            style={{
              backgroundColor: '#64748B',
              borderRadius: '50px',
              width: '56px',
              height: '56px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              opacity: 0.5,
              cursor: 'not-allowed'
            }}
          >
            <ArrowLeft className="h-6 w-6 text-[#1E3A5F]" />
          </button>

          {/* Cover Image Preview */}
          <div className="relative shadow-2xl rounded-lg max-w-[280px] w-full aspect-[1/1.41] overflow-hidden">
            {data.coverImage ? (
              <ImageWithFallback 
                src={data.coverImage} 
                alt="Obálka pracovního sešitu"
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg">
                <BookOpen className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-sm">Náhled není k dispozici</p>
              </div>
            )}
          </div>

          {/* Next Arrow - Goes to first page */}
          <button 
            onClick={firstPage ? handleGoToFirstPage : undefined}
            disabled={!firstPage}
            onMouseEnter={() => setNextHovered(true)}
            onMouseLeave={() => setNextHovered(false)}
            className="relative z-10 flex flex-col items-center justify-center transition-all duration-300 ease-out"
            style={{
              backgroundColor: firstPage ? '#A5B4FC' : '#64748B',
              borderRadius: '50px',
              width: '56px',
              height: nextHovered && firstPage ? '120px' : '56px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              opacity: firstPage ? 1 : 0.5,
              cursor: firstPage ? 'pointer' : 'not-allowed'
            }}
          >
            {nextHovered && firstPage && (
              <span className="text-[#312E81] text-base font-bold mb-2 transition-opacity duration-200">
                {firstPageNumber}
              </span>
            )}
            <ArrowRight className="h-6 w-6 text-[#1E3A5F]" />
          </button>
        </div>

        {/* Purchase Button */}
        {data.purchaseUrl && (
          <a 
            href={data.purchaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 mb-4 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-3 transition-colors"
          >
            <ShoppingCart className="h-5 w-5" />
            Zakoupit pracovní sešit
          </a>
        )}
      </div>

      {/* Right Column - Author & Bonuses (only if content exists) */}
      {showRightColumn && (
        <div className="lg:w-[45%] p-8 bg-white flex flex-col gap-8 overflow-y-auto">
          
          {/* Author Section */}
          {data.author && (
            <div className="flex items-center gap-3 text-[#4E5871]">
              <span className="text-sm text-muted-foreground">Autor:</span>
              <span className="font-medium">{data.author}</span>
            </div>
          )}

          {/* Bonuses Section */}
          {data.bonuses && data.bonuses.length > 0 && (
            <div>
              <h3 className="text-[#4E5871] font-bold text-lg mb-4">Bonusy</h3>
              <div className="space-y-3">
                {data.bonuses.map((bonus) => (
                  <a
                    key={bonus.id}
                    href={bonus.link || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 rounded-xl bg-amber-50 hover:bg-amber-100 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center text-white shrink-0">
                      <Gift className="h-5 w-5" />
                    </div>
                    <span className="font-medium text-[#334155]">{bonus.title}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

