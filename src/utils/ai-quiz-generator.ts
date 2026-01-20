/**
 * AI Quiz Generator
 * 
 * Generates quizzes/boards from document content using AI
 * Supports all VividBoard slide types including boards, voting, fill-blanks, etc.
 */

import { 
  Quiz, 
  QuizSlide, 
  ABCActivitySlide, 
  OpenActivitySlide, 
  InfoSlide, 
  TrueFalseActivitySlide, 
  ExampleActivitySlide,
  BoardActivitySlide,
  VotingActivitySlide,
  FillBlanksActivitySlide,
  ConnectPairsActivitySlide,
  QuizSettings,
  VotingType,
  BoardType,
} from '../types/quiz';
import { chatWithAIProxy, shouldUseProxy } from './ai-chat-proxy';
import { QuizType, getQuizPromptModifier } from '../components/quiz/QuizTypeSelector';

// ============================================
// TYPES
// ============================================

interface GenerateQuizRequest {
  documentContent: string;
  documentTitle: string;
  quizType: QuizType;
  subject?: string;
  grade?: number;
  /** Media from the document (images, animations) that can be used in slides */
  documentMedia?: { type: 'image' | 'lottie'; url: string; caption?: string }[];
}

interface GenerateQuizResponse {
  quiz?: Quiz;
  error?: string;
  message?: string;
}

// ============================================
// SYSTEM PROMPT
// ============================================

const SYSTEM_PROMPT = `Jsi expert na tvorbu vzdělávacích kvízů a interaktivních aktivit. Tvým úkolem je vytvořit kvalitní board/kvíz na základě poskytnutého dokumentu.

VÝSTUPNÍ FORMÁT (JSON):
Vrať POUZE platný JSON objekt s následující strukturou. Používej správné typy slidů podle zadání.

{
  "title": "Název",
  "slides": [
    // Info slide - informační obsah
    {
      "type": "info",
      "title": "Nadpis",
      "content": "<p>HTML obsah</p>",
      "note": "Poznámka pro učitele - cíle, popisky z dokumentu",
      "mediaUrl": "URL obrázku pokud je k dispozici",
      "lottieUrl": "URL animace pokud je k dispozici (preferuj před obrázkem!)"
    },
    
    // ABC otázka - výběr odpovědi
    {
      "type": "abc",
      "question": "Otázka?",
      "options": [
        { "label": "A", "content": "Odpověď A", "isCorrect": false },
        { "label": "B", "content": "Odpověď B", "isCorrect": true },
        { "label": "C", "content": "Odpověď C", "isCorrect": false },
        { "label": "D", "content": "Odpověď D", "isCorrect": false }
      ],
      "explanation": "Vysvětlení správné odpovědi",
      "points": 1
    },
    
    // Open otázka - otevřená odpověď
    {
      "type": "open",
      "question": "Otevřená otázka?",
      "correctAnswers": ["možná odpověď 1", "možná odpověď 2"],
      "explanation": "Vysvětlení",
      "points": 1
    },
    
    // Example - příklad s postupným řešením
    {
      "type": "example",
      "title": "Příklad",
      "problem": "Zadání příkladu",
      "steps": [
        { "content": "Krok 1: ..." },
        { "content": "Krok 2: ..." }
      ],
      "finalAnswer": "Výsledek"
    },
    
    // Board - nástěnka pro diskuzi
    {
      "type": "board",
      "boardType": "text",  // "text" | "pros-cons"
      "question": "Co si myslíte o...?",
      "allowMedia": false,
      "leftColumnLabel": "Pro",  // pouze pro pros-cons
      "rightColumnLabel": "Proti"  // pouze pro pros-cons
    },
    
    // Voting - hlasování
    {
      "type": "voting",
      "votingType": "single",  // "single" | "multiple" | "scale" | "feedback"
      "question": "Hlasování...",
      "options": [
        { "label": "A", "content": "Možnost 1" },
        { "label": "B", "content": "Možnost 2" },
        { "label": "C", "content": "Možnost 3" }
      ],
      "showResultsToStudents": true,
      // Pro scale (1-10):
      "scaleMinLabel": "Určitě ne",
      "scaleMaxLabel": "Určitě ano"
    },
    
    // Fill-blanks - doplňování slov (drag & drop)
    {
      "type": "fill-blanks",
      "instruction": "Doplň chybějící slova:",
      "sentences": [
        {
          "text": "Voda se skládá z [blank1] a [blank2].",
          "blanks": [
            { "id": "blank1", "text": "vodíku" },
            { "id": "blank2", "text": "kyslíku" }
          ]
        }
      ],
      "distractors": ["dusíku", "uhlíku"]
    },
    
    // Connect-pairs - spojovačka
    {
      "type": "connect-pairs",
      "instruction": "Spoj správné dvojice:",
      "pairs": [
        { "left": "H2O", "right": "Voda" },
        { "left": "NaCl", "right": "Sůl" },
        { "left": "CO2", "right": "Oxid uhličitý" }
      ]
    }
  ]
}

PRAVIDLA:
1. Pro TEST/PÍSEMKU používej hlavně: "info", "abc", "open", "example"
2. Pro AKTIVITU DO HODINY používej pestrou směs: "board", "voting", "fill-blanks", "connect-pairs", "abc"
3. Pro ABC vždy 3-4 možnosti, PRÁVĚ JEDNA správná
4. Otázky pokrývají hlavní body dokumentu
5. Vrať POUZE JSON, žádný markdown ani další text
6. Pro AKTIVITU vždy zakonči feedback hlasováním (votingType: "feedback")
7. Obsah může obsahovat HTML (<p>, <strong>, <em>, <ul>, <li>)`;

// ============================================
// GENERATOR FUNCTION
// ============================================

export async function generateQuizFromDocument(request: GenerateQuizRequest): Promise<GenerateQuizResponse> {
  const { documentContent, documentTitle, quizType, subject, grade, documentMedia } = request;

  // Get type-specific prompt modifier
  const promptModifier = getQuizPromptModifier(quizType);

  // Build media info if available
  let mediaInfo = '';
  if (documentMedia && documentMedia.length > 0) {
    const images = documentMedia.filter(m => m.type === 'image');
    const animations = documentMedia.filter(m => m.type === 'lottie');
    
    mediaInfo = `\n\nDOSTUPNÁ MÉDIA Z DOKUMENTU:`;
    
    if (animations.length > 0) {
      mediaInfo += `\n\n🎬 ANIMACE (Lottie) - VŽDY VLOŽ ANIMACE DO SLIDŮ:
${animations.map((m, i) => `${i + 1}. ${m.url}${m.caption ? ` - ${m.caption}` : ''}`).join('\n')}

Pro vložení ANIMACE do info slidu použij:
{
  "type": "info",
  "title": "...",
  "content": "<p>...</p>",
  "lottieUrl": "URL_ANIMACE"
}`;
    }
    
    if (images.length > 0) {
      mediaInfo += `\n\n🖼️ OBRÁZKY:
${images.map((m, i) => `${i + 1}. ${m.url}${m.caption ? ` - ${m.caption}` : ''}`).join('\n')}

Pro vložení obrázku: "mediaUrl": "URL"`;
    }
    
    mediaInfo += `\n\nDŮLEŽITÉ: Pokud jsou dostupné animace, vlož je do relevantních info slidů pomocí "lottieUrl"!`;
  }

  // Build the user message
  const userMessage = `${promptModifier}

DOKUMENT: "${documentTitle}"
${subject ? `PŘEDMĚT: ${subject}` : ''}
${grade ? `ROČNÍK: ${grade}` : ''}
${mediaInfo}

OBSAH DOKUMENTU:
${documentContent.substring(0, 15000)}

Vygeneruj ${quizType === 'aktivita' ? 'interaktivní aktivitu' : quizType} podle instrukcí výše. Vrať POUZE JSON.`;

  try {
    console.log('Generating quiz with AI...');
    
    let responseText: string;
    
    if (shouldUseProxy()) {
      // Use Supabase Edge Function proxy
      responseText = await chatWithAIProxy(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        'gemini-2.5-flash',
        { temperature: 0.7, max_tokens: 8192 }
      );
    } else {
      // Fallback to direct API (needs local key)
      const geminiKey = getGeminiApiKey();
      if (!geminiKey) {
        throw new Error('Gemini API klíč není nastaven');
      }
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\n${userMessage}` }] }],
          generationConfig: { maxOutputTokens: 8192, temperature: 0.7 }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Gemini API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    console.log('AI response received, parsing...');

    // Parse the JSON response
    const quiz = parseQuizResponse(responseText, documentTitle, quizType);

    return {
      quiz,
      message: `Kvíz "${quiz.title}" vytvořen s ${quiz.slides.length} slidy.`
    };

  } catch (error: any) {
    console.error('Quiz generation error:', error);
    return {
      error: error.message || 'Neznámá chyba při generování kvízu',
      message: 'Omlouváme se, při generování kvízu došlo k chybě.'
    };
  }
}

// ============================================
// RESPONSE PARSER
// ============================================

function parseQuizResponse(responseText: string, documentTitle: string, quizType: QuizType): Quiz {
  // Try to extract JSON from the response
  let jsonText = responseText.trim();
  
  // Remove markdown code blocks if present
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.slice(7);
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.slice(3);
  }
  if (jsonText.endsWith('```')) {
    jsonText = jsonText.slice(0, -3);
  }
  jsonText = jsonText.trim();

  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    console.error('Failed to parse JSON:', jsonText.substring(0, 500));
    throw new Error('AI vrátilo neplatný JSON. Zkuste to znovu.');
  }

  // Transform slides to proper format
  const slides: QuizSlide[] = [];
  let order = 0;

  const generateId = () => `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  for (const slide of (parsed.slides || [])) {
    const id = generateId();
    
    switch (slide.type) {
      case 'info': {
        const infoSlide: InfoSlide = {
          id,
          type: 'info',
          order: order++,
          title: slide.title || '',
          content: slide.content || '',
        };
        // Add teacher note if present (for goals, descriptions from document)
        if (slide.note) {
          infoSlide.note = slide.note;
        }
        // Add lottie animation if present (priority over images)
        if (slide.lottieUrl) {
          infoSlide.media = {
            type: 'lottie',
            url: slide.lottieUrl,
            caption: slide.media?.caption,
          };
        }
        // Add image media if present (and no lottie)
        else if (slide.mediaUrl || slide.media?.url) {
          infoSlide.media = {
            type: slide.media?.type || 'image',
            url: slide.mediaUrl || slide.media?.url,
            caption: slide.media?.caption,
          };
        }
        slides.push(infoSlide);
        break;
      }

      case 'abc': {
        const abcSlide: ABCActivitySlide = {
          id,
          type: 'activity',
          activityType: 'abc',
          order: order++,
          question: slide.question || '',
          options: (slide.options || []).map((opt: any, idx: number) => ({
            id: String.fromCharCode(97 + idx),
            label: opt.label || String.fromCharCode(65 + idx),
            content: opt.content || '',
            isCorrect: opt.isCorrect || false,
          })),
          explanation: slide.explanation || '',
          points: slide.points || 1,
        };
        if (slide.media?.url) {
          abcSlide.media = { type: slide.media.type || 'image', url: slide.media.url };
        }
        slides.push(abcSlide);
        break;
      }

      case 'open': {
        slides.push({
          id,
          type: 'activity',
          activityType: 'open',
          order: order++,
          question: slide.question || '',
          correctAnswers: slide.correctAnswers || [],
          caseSensitive: false,
          explanation: slide.explanation || '',
          points: slide.points || 1,
        } as OpenActivitySlide);
        break;
      }

      case 'true-false': {
        slides.push({
          id,
          type: 'activity',
          activityType: 'true-false',
          order: order++,
          statement: slide.statement || slide.question || '',
          isTrue: slide.isTrue ?? true,
          explanation: slide.explanation || '',
          points: slide.points || 1,
        } as TrueFalseActivitySlide);
        break;
      }

      case 'example': {
        slides.push({
          id,
          type: 'activity',
          activityType: 'example',
          order: order++,
          title: slide.title || 'Příklad',
          problem: slide.problem || '',
          steps: (slide.steps || []).map((step: any, idx: number) => ({
            id: `step-${idx}`,
            content: step.content || step || '',
            hint: step.hint,
          })),
          finalAnswer: slide.finalAnswer || '',
        } as ExampleActivitySlide);
        break;
      }

      case 'board': {
        const boardSlide: BoardActivitySlide = {
          id,
          type: 'activity',
          activityType: 'board',
          order: order++,
          boardType: (slide.boardType as BoardType) || 'text',
          question: slide.question || '',
          allowMedia: slide.allowMedia || false,
          allowAnonymous: slide.allowAnonymous || false,
          posts: [],
        };
        if (slide.boardType === 'pros-cons') {
          boardSlide.leftColumnLabel = slide.leftColumnLabel || 'Pro';
          boardSlide.rightColumnLabel = slide.rightColumnLabel || 'Proti';
        }
        if (slide.questionImage || slide.media?.url) {
          boardSlide.questionImage = slide.questionImage || slide.media?.url;
        }
        slides.push(boardSlide);
        break;
      }

      case 'voting': {
        const votingType = (slide.votingType as VotingType) || 'single';
        let options = slide.options || [];
        
        // Generate scale options if votingType is scale
        if (votingType === 'scale' && (!options || options.length === 0)) {
          const min = slide.scaleMin || 1;
          const max = slide.scaleMax || 10;
          options = Array.from({ length: max - min + 1 }, (_, i) => ({
            id: `scale-${min + i}`,
            label: String(min + i),
            content: String(min + i),
          }));
        }
        
        // Generate feedback options if votingType is feedback
        if (votingType === 'feedback' && (!options || options.length === 0)) {
          options = [
            { id: 'feedback-1', label: '1', content: '😢', emoji: '😢' },
            { id: 'feedback-2', label: '2', content: '😟', emoji: '😟' },
            { id: 'feedback-3', label: '3', content: '😐', emoji: '😐' },
            { id: 'feedback-4', label: '4', content: '😊', emoji: '😊' },
            { id: 'feedback-5', label: '5', content: '🥳', emoji: '🥳' },
          ];
        }

        const votingSlide: VotingActivitySlide = {
          id,
          type: 'activity',
          activityType: 'voting',
          votingType,
          order: order++,
          question: slide.question || '',
          options: options.map((opt: any, idx: number) => ({
            id: opt.id || `opt-${idx}`,
            label: opt.label || String.fromCharCode(65 + idx),
            content: opt.content || '',
            emoji: opt.emoji,
          })),
          allowMultiple: votingType === 'multiple',
          showResultsToStudents: slide.showResultsToStudents !== false,
          scaleMin: slide.scaleMin || 1,
          scaleMax: slide.scaleMax || 10,
          scaleMinLabel: slide.scaleMinLabel || 'Určitě ne',
          scaleMaxLabel: slide.scaleMaxLabel || 'Určitě ano',
          feedbackStyle: slide.feedbackStyle || 'emoji',
        };
        if (slide.media?.url) {
          votingSlide.media = { type: slide.media.type || 'image', url: slide.media.url };
        }
        slides.push(votingSlide);
        break;
      }

      case 'fill-blanks': {
        slides.push({
          id,
          type: 'activity',
          activityType: 'fill-blanks',
          order: order++,
          instruction: slide.instruction || 'Doplň chybějící slova',
          sentences: (slide.sentences || []).map((s: any, sIdx: number) => ({
            id: `sentence-${sIdx}`,
            text: s.text || '',
            blanks: (s.blanks || []).map((b: any) => ({
              id: b.id || `blank-${Math.random().toString(36).substr(2, 5)}`,
              text: b.text || '',
              position: b.position || 0,
            })),
          })),
          distractors: slide.distractors || [],
          countAsMultiple: true,
          shuffleOptions: true,
        } as FillBlanksActivitySlide);
        break;
      }

      case 'connect-pairs': {
        slides.push({
          id,
          type: 'activity',
          activityType: 'connect-pairs',
          order: order++,
          instruction: slide.instruction || 'Spoj správné dvojice',
          pairs: (slide.pairs || []).map((p: any, pIdx: number) => ({
            id: `pair-${pIdx}`,
            left: {
              id: `left-${pIdx}`,
              type: 'text' as const,
              content: typeof p.left === 'string' ? p.left : p.left?.content || '',
            },
            right: {
              id: `right-${pIdx}`,
              type: 'text' as const,
              content: typeof p.right === 'string' ? p.right : p.right?.content || '',
            },
          })),
          countAsMultiple: true,
          shuffleSides: true,
        } as ConnectPairsActivitySlide);
        break;
      }

      default:
        console.warn(`Unknown slide type: ${slide.type}`);
    }
  }

  // Create the quiz object
  const quizId = `quiz-${Date.now()}`;
  const typeNames: Record<QuizType, string> = {
    'aktivita': 'Aktivita',
    'test': 'Test',
    'pisemka': 'Písemka',
  };

  const settings: QuizSettings = {
    showProgress: true,
    showScore: true,
    allowSkip: quizType === 'aktivita',
    allowBack: quizType !== 'test',
    shuffleQuestions: quizType === 'test',
    shuffleOptions: quizType === 'test',
    showExplanations: quizType === 'aktivita' ? 'immediately' : 'after-submit',
  };

  return {
    id: quizId,
    title: parsed.title || `${typeNames[quizType]}: ${documentTitle}`,
    description: `Vygenerováno z dokumentu "${documentTitle}"`,
    slides,
    settings,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ============================================
// HELPERS
// ============================================

function getGeminiApiKey(): string {
  if (typeof window !== 'undefined') {
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) return storedKey;
  }
  return import.meta.env.VITE_GEMINI_API_KEY || '';
}


