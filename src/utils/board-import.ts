/**
 * Board Import Utility
 * 
 * Functions for importing boards from the legacy VividBoard API
 * and converting them to the new VividBoard format.
 */

import {
  Quiz,
  QuizSlide,
  createEmptyQuiz,
  createABCSlide,
  createOpenSlide,
  createExampleSlide,
  createInfoSlide,
} from '../types/quiz';
import { saveQuiz } from './quiz-storage';

// ============================================
// URL PARSING
// ============================================

/**
 * Extract board ID from various URL formats
 * Supports:
 * - UUID directly: 1734c4da-1234-5678-9abc-def012345678
 * - API URL: https://api.vividboard.cz/boards/UUID
 * - Share URL: https://vividboard.vividbooks.com/share/UUID
 * - Play URL: https://play.vividbooks.com/share/UUID
 */
export function extractBoardId(input: string): string | null {
  if (!input) return null;
  
  const trimmed = input.trim();
  
  // Check if it's already a UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return trimmed;
  }
  
  // Try to extract UUID from URL
  const uuidMatch = trimmed.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (uuidMatch) {
    return uuidMatch[1];
  }
  
  // Try to extract from path (last segment)
  try {
    const url = new URL(trimmed);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1];
    if (lastSegment && lastSegment.length > 10) {
      return lastSegment;
    }
  } catch {
    // Not a valid URL, try as path
    const segments = trimmed.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    if (lastSegment && lastSegment.length > 10) {
      return lastSegment;
    }
  }
  
  return null;
}

// ============================================
// LEGACY FORMAT TRANSFORMATION
// ============================================

/**
 * Strip HTML tags and clean up content
 */
function stripHtml(html: string): string {
  if (!html) return '';
  let text = html.replace(/<div class=['"]ql-editor['"]>/g, '');
  text = text.replace(/<\/div>/g, '');
  text = text.replace(/<[^>]*>?/gm, '');
  text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  return text.trim();
}

/**
 * Map legacy slides to new VividBoard format
 */
function mapLegacySlides(legacySlides: any[]): QuizSlide[] {
  const slides: QuizSlide[] = [];
  let slideOrder = 0;

  legacySlides.forEach((legacy) => {
    const id = `slide-imported-${Date.now()}-${slideOrder}`;

    // Handle the nested structure (data.content.pages)
    if (legacy.type === 'selector' && legacy.data?.pageContent?.data?.activity) {
      const activity = legacy.data.pageContent.data.activity;
      const activityKey = activity.key;
      const activityData = activity.data?.[activityKey];

      if (activityKey === 'abc' && activityData) {
        const abcSlide = createABCSlide(slideOrder++);
        abcSlide.id = id;
        
        const questionHtml = activityData.selector?.tabs?.text?.data || '';
        abcSlide.question = stripHtml(questionHtml);

        const buttons = activityData.selectorAnswers?.tabs?.buttons?.buttons || [];
        abcSlide.options = buttons.map((btn: any, i: number) => ({
          id: `opt-${i}-${Date.now()}`,
          label: String.fromCharCode(65 + i),
          content: stripHtml(btn.text || ''),
          isCorrect: !!btn.isValid
        }));
        
        slides.push(abcSlide);
        return;
      }
      
      if (activityKey === 'open' && activityData) {
        const openSlide = createOpenSlide(slideOrder++);
        openSlide.id = id;
        const questionHtml = activityData.selector?.tabs?.text?.data || '';
        openSlide.question = stripHtml(questionHtml);
        const answerHtml = activityData.selectorAnswers?.tabs?.text?.data || '';
        if (answerHtml) {
          openSlide.correctAnswers = [stripHtml(answerHtml)];
        }
        slides.push(openSlide);
        return;
      }
      
      // Handle 'input' activity type (similar to open, but with answer in different location)
      if (activityKey === 'input' && activityData) {
        const openSlide = createOpenSlide(slideOrder++);
        openSlide.id = id;
        
        // Question is in selector.tabs.text.data
        const questionHtml = activityData.selector?.tabs?.text?.data || '';
        openSlide.question = stripHtml(questionHtml);
        
        // Correct answer is in answer field
        const answerHtml = activityData.answer || '';
        if (answerHtml) {
          openSlide.correctAnswers = [stripHtml(answerHtml)];
        }
        
        slides.push(openSlide);
        return;
      }
      
      // Handle 'example' activity type (příklad - shows worked example)
      if (activityKey === 'example' && activityData) {
        const exampleSlide = createExampleSlide(slideOrder++);
        exampleSlide.id = id;
        
        // Question/problem text
        const questionHtml = activityData.selector?.tabs?.text?.data || '';
        exampleSlide.question = stripHtml(questionHtml);
        
        // Solution/answer
        const answerHtml = activityData.answer || activityData.selectorAnswers?.tabs?.text?.data || '';
        if (answerHtml) {
          exampleSlide.answer = stripHtml(answerHtml);
        }
        
        slides.push(exampleSlide);
        return;
      }
    }

    // Handle info_page with images
    if (legacy.type === 'selector' && legacy.data?.pageContent?.key === 'info_page') {
      const infoPageData = legacy.data.pageContent.data?.info_page?.data?.info;
      const notes = legacy.data.notes || {};
      
      if (infoPageData) {
        const infoSlide = createInfoSlide(slideOrder++);
        infoSlide.id = id;
        
        if (notes.chapter) {
          infoSlide.chapterName = notes.chapter;
        }
        if (notes.text) {
          infoSlide.note = stripHtml(notes.text);
        }
        
        const selectors = infoPageData.selectors || [];
        
        let imageSelector = selectors.find((s: any) => 
          s.activeTab === 'image' && s.tabs?.image?.images?.length > 0
        );
        
        if (!imageSelector) {
          imageSelector = selectors.find((s: any) => s.tabs?.image?.images?.length > 0);
        }
        
        if (imageSelector) {
          const tabs = imageSelector.tabs;
          const images = tabs.image.images;
          
          infoSlide.layout = {
            type: 'single',
            blocks: [{
              id: `block-${Date.now()}`,
              type: 'image',
              content: images[0].image || '',
              gallery: images.map((img: any) => img.image).filter(Boolean),
              galleryIndex: 0,
              galleryNavType: tabs.image.galleryMenu === 'solution' ? 'solution' : 
                              images.length > 1 ? 'dots-bottom' : undefined,
              imageFit: tabs.image.setup?.align === 'contain' ? 'contain' : 'cover',
              imageCaption: images[0].description || '',
              imageLink: images[0].link || '',
            }],
          };
          
          infoSlide.blockGap = 0;
          infoSlide.blockRadius = parseInt(tabs.image.setup?.borderRadius) || 10;
        } else {
          const textSelector = selectors.find((s: any) => s.tabs?.text?.data);
          
          if (textSelector && textSelector.tabs.text.data) {
            infoSlide.layout = {
              type: 'single',
              blocks: [{
                id: `block-${Date.now()}`,
                type: 'text',
                content: stripHtml(textSelector.tabs.text.data),
                textAlign: 'center',
                fontSize: 'large',
              }],
            };
          } else {
            infoSlide.title = notes.chapter || 'Importovaná stránka';
          }
        }
        
        slides.push(infoSlide);
        return;
      }
    }

    // Fallback for older flat structure
    if (['text', 'info'].includes(legacy.type)) {
      const infoSlide = createInfoSlide(slideOrder++);
      infoSlide.id = id;
      infoSlide.title = stripHtml(legacy.title || legacy.name || '');
      if (infoSlide.layout) {
        infoSlide.layout.blocks[0].content = stripHtml(legacy.title || legacy.name || '');
        infoSlide.layout.blocks[1].content = stripHtml(legacy.content || legacy.text || '');
      }
      slides.push(infoSlide);
    } else if (['abc', 'multi', 'multiple-choice'].includes(legacy.type)) {
      const abcSlide = createABCSlide(slideOrder++);
      abcSlide.id = id;
      abcSlide.question = stripHtml(legacy.question || legacy.text || '');
      const options = legacy.options || legacy.answers || [];
      if (options) {
        abcSlide.options = options.map((opt: any, i: number) => ({
          id: opt.id || `opt-${i}-${Date.now()}`,
          label: String.fromCharCode(65 + i),
          content: typeof opt === 'string' ? stripHtml(opt) : stripHtml(opt.text || opt.content || opt.answer || ''),
          isCorrect: Array.isArray(legacy.correct) 
            ? legacy.correct.includes(i) 
            : (opt.is_correct || opt.isCorrect || i === legacy.correct_index || i === legacy.correctIndex),
        }));
      }
      abcSlide.explanation = stripHtml(legacy.explanation || legacy.hint || legacy.transcript);
      slides.push(abcSlide);
    } else if (['open', 'question'].includes(legacy.type)) {
      const openSlide = createOpenSlide(slideOrder++);
      openSlide.id = id;
      openSlide.question = stripHtml(legacy.question || legacy.text || '');
      if (legacy.answer || legacy.correct_answer || legacy.correctAnswer) {
        openSlide.correctAnswers = [stripHtml(legacy.answer || legacy.correct_answer || legacy.correctAnswer)];
      }
      openSlide.explanation = stripHtml(legacy.explanation || legacy.hint || legacy.transcript);
      slides.push(openSlide);
    } else if (legacy.type === 'example') {
      const exampleSlide = createExampleSlide(slideOrder++);
      exampleSlide.id = id;
      exampleSlide.title = stripHtml(legacy.title || legacy.name || '');
      exampleSlide.problem = stripHtml(legacy.problem || legacy.content || legacy.text || '');
      if (legacy.steps) {
        exampleSlide.steps = legacy.steps.map((step: any, i: number) => ({
          id: `step-${i}-${Date.now()}`,
          content: typeof step === 'string' ? stripHtml(step) : stripHtml(step.content || step.text || ''),
        }));
      }
      exampleSlide.finalAnswer = stripHtml(legacy.finalAnswer || legacy.answer || '');
      slides.push(exampleSlide);
    } else if (legacy.type !== 'config' && legacy.type !== 'add') {
      const fallback = createInfoSlide(slideOrder++);
      fallback.id = id;
      fallback.title = stripHtml(legacy.title || legacy.name || legacy.type || 'Importovaný slide');
      if (fallback.layout) {
        fallback.layout.blocks[1].content = typeof legacy === 'string' ? legacy : JSON.stringify(legacy);
      }
      slides.push(fallback);
    }
  });
  
  return slides;
}

// ============================================
// BOARD IMPORT
// ============================================

export interface ImportedBoard {
  id: string;
  title: string;
  slides: QuizSlide[];
  slidesCount: number;
}

/**
 * Import a board from the legacy VividBoard API
 * @param urlOrId - Board ID (UUID) or URL containing the board ID
 * @param customTitle - Optional custom title for the imported board
 * @returns The imported board data, or null if import failed
 */
export async function importBoardFromLegacy(
  urlOrId: string,
  customTitle?: string
): Promise<ImportedBoard | null> {
  const boardId = extractBoardId(urlOrId);
  
  if (!boardId) {
    console.error('[BoardImport] Could not extract board ID from:', urlOrId);
    return null;
  }
  
  console.log('[BoardImport] Importing board:', boardId);
  
  try {
    // Use proxy to avoid CORS issues
    const proxyUrl = `https://njbtqmsxbyvpwigfceke.supabase.co/functions/v1/make-server-46c8107b/vividboard-proxy/${boardId}`;
    console.log('[BoardImport] Using proxy:', proxyUrl);
    
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      console.error('[BoardImport] API request failed:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (!data) {
      console.error('[BoardImport] No data received from API');
      return null;
    }
    
    // Extract slides from various possible formats
    const legacySlides = data.content?.pages || data.slides || data.questions || [];
    
    if (!Array.isArray(legacySlides) || legacySlides.length === 0) {
      console.warn('[BoardImport] No slides found in board data');
      // Return empty board with just metadata
      return {
        id: `imported-${boardId}`,
        title: customTitle || data.name || data.title || 'Importovaný board',
        slides: [],
        slidesCount: 0,
      };
    }
    
    // Transform legacy slides to new format
    const importedSlides = mapLegacySlides(legacySlides);
    
    console.log(`[BoardImport] Imported ${importedSlides.length} slides from board ${boardId}`);
    
    return {
      id: `imported-${boardId}`,
      title: customTitle || data.name || data.title || 'Importovaný board',
      slides: importedSlides,
      slidesCount: importedSlides.length,
    };
  } catch (error) {
    console.error('[BoardImport] Error importing board:', error);
    return null;
  }
}

/**
 * Import a board and save it to local storage
 * @param urlOrId - Board ID or URL
 * @param customTitle - Optional custom title
 * @param folderId - Optional folder ID to place the board in
 * @returns The saved Quiz object, or null if failed
 */
export async function importAndSaveBoard(
  urlOrId: string,
  customTitle?: string,
  folderId?: string
): Promise<Quiz | null> {
  const imported = await importBoardFromLegacy(urlOrId, customTitle);
  
  if (!imported) {
    return null;
  }
  
  // Create a new Quiz object
  const quiz = createEmptyQuiz(imported.id);
  quiz.title = imported.title;
  quiz.slides = imported.slides;
  quiz.createdAt = new Date().toISOString();
  quiz.updatedAt = new Date().toISOString();
  
  // Save to storage
  saveQuiz(quiz);
  
  console.log(`[BoardImport] Board saved: ${quiz.id} - ${quiz.title} (${quiz.slides.length} slides)`);
  
  return quiz;
}

/**
 * Check if a URL/ID points to a valid board that can be imported
 */
export function isImportableBoardUrl(input: string): boolean {
  if (!input) return false;
  
  // Check for UUID pattern
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.trim())) {
    return true;
  }
  
  // Check for known board URL patterns
  const lowerInput = input.toLowerCase();
  return lowerInput.includes('vividboard') || 
         lowerInput.includes('api.vividboard') ||
         /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(input);
}

