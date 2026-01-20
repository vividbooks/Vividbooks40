/**
 * ImageSelectionStep - Component for selecting images to include in worksheet
 * 
 * Shows a grid of available images from:
 * - Lottie animation screenshots
 * - Unsplash search results
 * - Images extracted from the source lesson
 */

import { useState, useEffect } from 'react';
import { Check, Loader2, ImageIcon, Sparkles, BookOpen, Film, Search } from 'lucide-react';
import { Button } from '../ui/button';
import { ExtractedImage } from '../../utils/extract-images';
import { UnsplashImage, searchImagesForWorksheet, extractSearchKeywords, translateKeywords, searchUnsplashImages } from '../../utils/unsplash-search';
import { generateLottieScreenshot } from '../../utils/lottie-screenshot';

/**
 * Generate contextual description for animation screenshot
 * Based on the topic and content, creates meaningful captions
 */
function generateAnimationCaption(
  animationName: string,
  index: number,
  total: number,
  progressPercent: number,
  topic?: string,
  content?: string
): string {
  // Extract key concepts from topic and content
  const fullText = [topic, content?.substring(0, 500)].filter(Boolean).join(' ').toLowerCase();
  
  // Detect topic and generate appropriate captions
  const topicCaptions = detectTopicCaptions(fullText);
  
  if (topicCaptions.length > 0) {
    // Use topic-specific caption based on position
    const captionIndex = Math.min(index, topicCaptions.length - 1);
    return topicCaptions[captionIndex];
  }
  
  // Fallback to generic but still descriptive captions
  return getGenericCaption(index, total, topic || 'téma');
}

/**
 * Detect topic from content and return appropriate captions
 */
function detectTopicCaptions(text: string): string[] {
  // Atom / Hmota
  if (text.includes('atom') || text.includes('hmota') || text.includes('částic')) {
    return [
      'Ilustrace hmoty a její základní struktury',
      'Znázornění atomů, ze kterých je vše složeno',
      'Pohled na mikroskopickou stavbu látek',
      'Struktura atomu a jeho složení',
      'Atomy jako základní stavební kameny hmoty',
    ];
  }
  
  // Molekuly
  if (text.includes('molekul') || text.includes('sloučenin') || text.includes('vazb')) {
    return [
      'Vizualizace molekulární struktury',
      'Jak se atomy spojují do molekul',
      'Chemické vazby mezi atomy',
      'Prostorové uspořádání molekul',
      'Výsledná molekulární struktura',
    ];
  }
  
  // Skupenství
  if (text.includes('skupenství') || text.includes('pevn') || text.includes('kapaln') || text.includes('plyn')) {
    return [
      'Uspořádání částic v pevné látce',
      'Přechod mezi skupenstvími',
      'Pohyb částic při změně teploty',
      'Rozdíly mezi pevným, kapalným a plynným skupenstvím',
      'Znázornění chování částic v různých skupenstvích',
    ];
  }
  
  // Síla / Pohyb
  if (text.includes('síla') || text.includes('pohyb') || text.includes('rychlost')) {
    return [
      'Znázornění působení síly na těleso',
      'Jak síla ovlivňuje pohyb',
      'Směr a velikost působící síly',
      'Výsledek působení síly',
      'Změna pohybu vlivem síly',
    ];
  }
  
  // Energie
  if (text.includes('energi') || text.includes('teplo') || text.includes('práce')) {
    return [
      'Vizualizace přenosu energie',
      'Přeměna jedné formy energie v jinou',
      'Tok energie v systému',
      'Zachování energie při přeměnách',
      'Výsledný stav po přeměně energie',
    ];
  }
  
  // Elektřina
  if (text.includes('elektř') || text.includes('proud') || text.includes('napětí') || text.includes('obvod')) {
    return [
      'Elektrický obvod a jeho součásti',
      'Tok elektrického proudu',
      'Znázornění elektrického napětí',
      'Propojení prvků v obvodu',
      'Funkce elektrického obvodu',
    ];
  }
  
  // Světlo / Optika
  if (text.includes('světl') || text.includes('paprs') || text.includes('odraz') || text.includes('lom')) {
    return [
      'Šíření světelných paprsků',
      'Interakce světla s povrchem',
      'Chování světla při průchodu prostředím',
      'Optické jevy v praxi',
      'Výsledný optický efekt',
    ];
  }
  
  // Buňka / Biologie
  if (text.includes('buňk') || text.includes('orgán') || text.includes('tkan')) {
    return [
      'Struktura živé buňky',
      'Vnitřní uspořádání buňky',
      'Jednotlivé organely a jejich funkce',
      'Procesy probíhající v buňce',
      'Buňka jako základní jednotka života',
    ];
  }
  
  // Voda / Koloběh
  if (text.includes('voda') || text.includes('koloběh') || text.includes('vypařování')) {
    return [
      'Koloběh vody v přírodě',
      'Vypařování a vznik vodní páry',
      'Kondenzace a vznik srážek',
      'Cesta vody krajinou',
      'Uzavření vodního cyklu',
    ];
  }
  
  // Země / Geologie
  if (text.includes('země') || text.includes('vrstva') || text.includes('hora') || text.includes('sopka')) {
    return [
      'Struktura zemského tělesa',
      'Geologické vrstvy Země',
      'Procesy formující zemský povrch',
      'Pohyb tektonických desek',
      'Výsledný tvar krajiny',
    ];
  }
  
  return []; // No specific topic detected
}

/**
 * Generic but descriptive captions as fallback
 */
function getGenericCaption(index: number, total: number, topic: string): string {
  const cleanTopic = topic.replace(/nový pracovní list/gi, '').trim() || 'téma';
  
  if (total === 1) {
    return `Ilustrace k tématu: ${cleanTopic}`;
  }
  
  const captions = [
    `Úvodní vizualizace k tématu ${cleanTopic}`,
    `Grafické znázornění probíraného konceptu`,
    `Ilustrace klíčového principu`,
    `Vizuální vysvětlení tématu`,
    `Závěrečné shrnutí v obraze`,
  ];
  
  return captions[Math.min(index, captions.length - 1)];
}

export interface ImageOption {
  id: string;
  url: string;
  alt: string;
  caption?: string;
  source: 'lottie' | 'unsplash' | 'lesson';
  author?: string;
}

interface ImageSelectionStepProps {
  /** Topic/title for Unsplash search */
  topic: string;
  /** Content text for better search */
  content?: string;
  /** Images extracted from lesson HTML */
  lessonImages: ExtractedImage[];
  /** Called when user confirms selection */
  onConfirm: (selectedImages: ImageOption[]) => void;
  /** Called when user skips image selection */
  onSkip: () => void;
}

export function ImageSelectionStep({
  topic,
  content,
  lessonImages,
  onConfirm,
  onSkip,
}: ImageSelectionStepProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [lottieImages, setLottieImages] = useState<ImageOption[]>([]);
  const [unsplashImages, setUnsplashImages] = useState<ImageOption[]>([]);
  const [extractedImages, setExtractedImages] = useState<ImageOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingProgress, setLoadingProgress] = useState({ lottie: false, unsplash: false, extracted: false });
  
  // Search keywords state
  const [searchKeywords, setSearchKeywords] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);

  // Load all images on mount
  useEffect(() => {
    console.log('[ImageSelection] Starting with:', {
      topic,
      contentLength: content?.length,
      lessonImagesCount: lessonImages.length,
      lessonImages: lessonImages.map(img => ({ url: img.url?.substring(0, 50), type: img.type, alt: img.alt }))
    });
    loadAllImages();
  }, [topic, content, lessonImages]);

  const loadAllImages = async () => {
    setIsLoading(true);
    
    // Process in parallel
    await Promise.all([
      loadLottieScreenshots(),
      loadUnsplashImages(),
      loadExtractedImages(),
    ]);
    
    setIsLoading(false);
  };

  const loadLottieScreenshots = async () => {
    setLoadingProgress(prev => ({ ...prev, lottie: true }));
    
    const lottieItems = lessonImages.filter(img => img.type === 'lottie' && img.url);
    console.log('[ImageSelection] Found Lottie items:', lottieItems.length, lottieItems.map(l => l.url));
    
    const screenshots: ImageOption[] = [];
    
    // For each Lottie, take multiple screenshots (every ~2 seconds)
    for (const item of lottieItems) {
      try {
        console.log('[ImageSelection] Generating Lottie screenshots:', item.url);
        
        // First, get animation info to calculate frames
        const response = await fetch(item.url);
        if (!response.ok) continue;
        const lottieData = await response.json();
        
        // Calculate frame rate and total duration
        const frameRate = lottieData.fr || 30; // frames per second
        const totalFrames = (lottieData.op || 60) - (lottieData.ip || 0);
        const durationSeconds = totalFrames / frameRate;
        
        // Take screenshot every 2 seconds, max 5 per animation
        const interval = 2; // seconds
        const screenshotCount = Math.min(5, Math.max(1, Math.floor(durationSeconds / interval) + 1));
        
        console.log('[ImageSelection] Lottie duration:', durationSeconds, 's, taking', screenshotCount, 'screenshots');
        
        // Get animation name/description for caption generation
        const animationName = item.alt || item.caption || lottieData.nm || 'Animace';
        
        for (let i = 0; i < screenshotCount; i++) {
          const framePercent = screenshotCount === 1 ? 0.5 : i / (screenshotCount - 1);
          const targetFrame = Math.floor(framePercent * totalFrames);
          
          // Generate intelligent caption based on position in animation and content
          const caption = generateAnimationCaption(animationName, i, screenshotCount, framePercent, topic, content);
          
          try {
            const { generateScreenshotFromData } = await import('../../utils/lottie-screenshot');
            const screenshotUrl = await generateScreenshotFromData(lottieData, {
              frame: targetFrame,
              width: 600,
            });
            
            screenshots.push({
              id: `lottie-${screenshots.length}`,
              url: screenshotUrl,
              alt: `${animationName} - ${caption}`,
              caption: caption,
              source: 'lottie',
            });
          } catch (err) {
            console.warn('[ImageSelection] Failed to generate frame', i, err);
          }
        }
        
        console.log('[ImageSelection] Generated', screenshotCount, 'screenshots for this Lottie');
      } catch (error) {
        console.warn('[ImageSelection] Failed to process Lottie:', error);
      }
      
      // Limit total screenshots to 10
      if (screenshots.length >= 10) break;
    }
    
    console.log('[ImageSelection] Total Lottie screenshots generated:', screenshots.length);
    setLottieImages(screenshots);
    setLoadingProgress(prev => ({ ...prev, lottie: false }));
  };

  const loadUnsplashImages = async () => {
    setLoadingProgress(prev => ({ ...prev, unsplash: true }));
    
    try {
      console.log('[ImageSelection] === UNSPLASH SEARCH START ===');
      console.log('[ImageSelection] Searching images for topic:', topic);
      console.log('[ImageSelection] Content length:', content?.length || 0);
      console.log('[ImageSelection] Content preview:', content?.substring(0, 200));
      
      // Extract keywords from content to show in the input
      const fullText = [topic, content?.substring(0, 1500)].filter(Boolean).join(' ');
      const keywords = extractSearchKeywords(fullText, 5);
      const translated = translateKeywords(keywords);
      const keywordString = translated.slice(0, 3).join(', ');
      setSearchKeywords(keywordString);
      
      console.log('[ImageSelection] Keywords for search:', keywordString);
      
      const images = await searchImagesForWorksheet(topic, undefined, content);
      console.log('[ImageSelection] === UNSPLASH SEARCH RESULT ===');
      console.log('[ImageSelection] Image search returned:', images.length, 'images');
      console.log('[ImageSelection] First image:', images[0]);
      const options: ImageOption[] = images.slice(0, 5).map((img, index) => ({
        id: `unsplash-${index}`,
        url: img.url,
        alt: img.alt,
        caption: `Foto: ${img.author}`,
        source: 'unsplash' as const,
        author: img.author,
      }));
      console.log('[ImageSelection] Setting', options.length, 'Unsplash images to state');
      setUnsplashImages(options);
    } catch (error) {
      console.error('[ImageSelection] === UNSPLASH SEARCH FAILED ===', error);
    }
    
    setLoadingProgress(prev => ({ ...prev, unsplash: false }));
  };
  
  // Search with custom keywords
  const searchWithCustomKeywords = async () => {
    if (!searchKeywords.trim()) return;
    
    setIsSearching(true);
    
    try {
      console.log('[ImageSelection] Custom search:', searchKeywords);
      const result = await searchUnsplashImages(searchKeywords.trim(), { perPage: 5 });
      const options: ImageOption[] = result.images.slice(0, 5).map((img, index) => ({
        id: `unsplash-${index}-${Date.now()}`,
        url: img.url,
        alt: img.alt,
        caption: `Foto: ${img.author}`,
        source: 'unsplash' as const,
        author: img.author,
      }));
      setUnsplashImages(options);
    } catch (error) {
      console.warn('[ImageSelection] Custom search failed:', error);
    }
    
    setIsSearching(false);
  };

  const loadExtractedImages = async () => {
    setLoadingProgress(prev => ({ ...prev, extracted: true }));
    
    // Get regular images from lesson (not Lottie)
    const regularImages = lessonImages.filter(img => img.type === 'image' && img.url);
    console.log('[ImageSelection] Found lesson images:', regularImages.length, regularImages.map(i => i.url?.substring(0, 50)));
    
    const options: ImageOption[] = regularImages.slice(0, 6).map((img, index) => ({
      id: `lesson-${index}`,
      url: img.url,
      alt: img.alt || 'Obrázek z lekce',
      caption: img.caption,
      source: 'lesson' as const,
    }));
    
    console.log('[ImageSelection] Lesson image options:', options.length);
    setExtractedImages(options);
    setLoadingProgress(prev => ({ ...prev, extracted: false }));
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const allImages = [...lottieImages, ...unsplashImages, ...extractedImages];
    const selected = allImages.filter(img => selectedIds.has(img.id));
    onConfirm(selected);
  };

  const allImages = [...lottieImages, ...unsplashImages, ...extractedImages];
  const hasAnyImages = allImages.length > 0;

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-white p-6">
        <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
        <p className="text-slate-600 font-medium mb-2">Hledám obrázky...</p>
        <div className="text-xs text-slate-400 space-y-1">
          {loadingProgress.lottie && <p>• Generuji screenshoty z animací...</p>}
          {loadingProgress.unsplash && <p>• Hledám na Unsplash...</p>}
          {loadingProgress.extracted && <p>• Načítám obrázky z lekce...</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Header - fixed at top */}
      <div className="shrink-0 py-6 px-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex flex-col items-center text-center">
          {/* Icon with proper fill */}
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg mb-4"
            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' }}
          >
            <ImageIcon className="h-8 w-8 text-white" strokeWidth={2} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">
            Chcete přidat obrázky?
          </h2>
          <p className="text-slate-600 text-lg mb-4">
            Toto jsem pro vás našel ✨
          </p>
          
          {/* Action buttons under heading */}
          <div className="flex gap-3 w-full max-w-xs">
            <Button
              variant="outline"
              onClick={onSkip}
              className="flex-1"
            >
              Přeskočit
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
              className="flex-1 gap-2 text-white"
              style={{ backgroundColor: selectedIds.size > 0 ? '#2563eb' : '#94a3b8' }}
            >
              <Check className="h-4 w-4" />
              Vložit ({selectedIds.size})
            </Button>
          </div>
        </div>
      </div>

      {/* Image grid - scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {!hasAnyImages && unsplashImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <ImageIcon className="h-12 w-12 mb-3" />
            <p>Nenalezeny žádné obrázky</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* ===== SECTION 1: Obrázky z našich lekcí ===== */}
            {(lottieImages.length > 0 || extractedImages.length > 0) && (
              <div>
                <h3 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-green-600" />
                  Obrázky z našich lekcí
                </h3>
                
                {/* Lottie Screenshots */}
                {lottieImages.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                      <Film className="h-3 w-3" />
                      Z animací ({lottieImages.length})
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {lottieImages.map(img => (
                        <ImageCard
                          key={img.id}
                          image={img}
                          isSelected={selectedIds.has(img.id)}
                          onToggle={() => toggleSelection(img.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Extracted lesson images */}
                {extractedImages.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-2">
                      Další obrázky ({extractedImages.length})
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {extractedImages.map(img => (
                        <ImageCard
                          key={img.id}
                          image={img}
                          isSelected={selectedIds.has(img.id)}
                          onToggle={() => toggleSelection(img.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===== SECTION 2: Vyhledané obrázky ===== */}
            <div>
              <h3 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                A nebo jsem pro tebe vyhledal
              </h3>
              
              {/* Search input */}
              <div className="mb-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchKeywords}
                    onChange={(e) => setSearchKeywords(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchWithCustomKeywords()}
                    placeholder="Klíčová slova pro vyhledávání..."
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={searchWithCustomKeywords}
                    disabled={isSearching || !searchKeywords.trim()}
                    className="px-4 py-2 rounded-lg text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                    style={{ backgroundColor: '#2563eb' }}
                  >
                    {isSearching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    Hledat
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Upravte klíčová slova a stiskněte Enter nebo tlačítko Hledat
                </p>
              </div>
              
              {/* Unsplash results */}
              {unsplashImages.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {unsplashImages.map(img => (
                    <ImageCard
                      key={img.id}
                      image={img}
                      isSelected={selectedIds.has(img.id)}
                      onToggle={() => toggleSelection(img.id)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">
                  Zadejte klíčová slova a vyhledejte obrázky
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Single image card with selection
 */
function ImageCard({
  image,
  isSelected,
  onToggle,
}: {
  image: ImageOption;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Source badge text
  const sourceLabel = {
    lottie: 'Animace',
    unsplash: 'Unsplash',
    lesson: 'Lekce',
  }[image.source];

  if (hasError) {
    return (
      <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center">
        <ImageIcon className="h-8 w-8 text-slate-300" />
      </div>
    );
  }

  return (
    <div
      onClick={onToggle}
      className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-200'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Image */}
      <div className="aspect-video bg-slate-100 relative">
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
          </div>
        )}
        <img
          src={image.url}
          alt={image.alt}
          className={`w-full h-full object-cover transition-opacity ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
        />
      </div>

      {/* Selection checkbox */}
      <div
        className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
          isSelected
            ? 'bg-blue-500 border-blue-500'
            : 'bg-white/80 border-slate-300'
        }`}
      >
        {isSelected && <Check className="h-4 w-4 text-white" />}
      </div>

      {/* Caption */}
      <div className="p-2 bg-white">
        <div className="flex items-center gap-1 mb-0.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
            {sourceLabel}
          </span>
        </div>
        {image.caption && (
          <p className="text-xs text-slate-600 truncate">{image.caption}</p>
        )}
      </div>
    </div>
  );
}









