/**
 * AI Quiz Generator
 * 
 * Generates quizzes/boards from document content using AI
 */

import { Quiz, QuizSlide, ABCActivitySlide, OpenActivitySlide, InfoSlide, TrueFalseActivitySlide, QuizSettings } from '../types/quiz';
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
}

interface GenerateQuizResponse {
  quiz?: Quiz;
  error?: string;
  message?: string;
}

// ============================================
// SYSTEM PROMPT
// ============================================

const SYSTEM_PROMPT = `Jsi expert na tvorbu vzdělávacích kvízů a testů. Tvým úkolem je vytvořit kvalitní kvíz na základě poskytnutého dokumentu.

VÝSTUPNÍ FORMÁT (JSON):
Vrať POUZE platný JSON objekt s následující strukturou:

{
  "title": "Název kvízu",
  "slides": [
    {
      "type": "info",
      "title": "Úvodní slide",
      "content": "<p>HTML obsah</p>"
    },
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
    {
      "type": "open",
      "question": "Otevřená otázka?",
      "correctAnswers": ["možná odpověď 1", "možná odpověď 2"],
      "explanation": "Vysvětlení",
      "points": 2
    },
    {
      "type": "true-false",
      "statement": "Tvrzení k posouzení",
      "isTrue": true,
      "explanation": "Vysvětlení",
      "points": 1
    }
  ]
}

PRAVIDLA:
1. Používej POUZE typy: "info", "abc", "open", "true-false"
2. Pro ABC vždy 4 možnosti (A, B, C, D), jedna správná
3. Každá otázka má explanation (vysvětlení pro žáka)
4. Otázky by měly pokrývat hlavní body dokumentu
5. Vrať POUZE JSON, žádný markdown ani další text
6. Obsah může obsahovat základní HTML (<p>, <strong>, <em>, <ul>, <li>)`;

// ============================================
// GENERATOR FUNCTION
// ============================================

export async function generateQuizFromDocument(request: GenerateQuizRequest): Promise<GenerateQuizResponse> {
  const { documentContent, documentTitle, quizType, subject, grade } = request;

  // Get type-specific prompt modifier
  const promptModifier = getQuizPromptModifier(quizType);

  // Build the user message
  const userMessage = `${promptModifier}

DOKUMENT: "${documentTitle}"
${subject ? `PŘEDMĚT: ${subject}` : ''}
${grade ? `ROČNÍK: ${grade}` : ''}

OBSAH DOKUMENTU:
${documentContent.substring(0, 15000)}

Vygeneruj kvíz podle instrukcí výše. Vrať POUZE JSON.`;

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

  for (const slide of (parsed.slides || [])) {
    const id = `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    if (slide.type === 'info') {
      slides.push({
        id,
        type: 'info',
        order: order++,
        title: slide.title || '',
        content: slide.content || '',
      } as InfoSlide);
    } else if (slide.type === 'abc') {
      slides.push({
        id,
        type: 'activity',
        activityType: 'abc',
        order: order++,
        question: slide.question || '',
        options: (slide.options || []).map((opt: any, idx: number) => ({
          id: String.fromCharCode(97 + idx), // a, b, c, d
          label: opt.label || String.fromCharCode(65 + idx), // A, B, C, D
          content: opt.content || '',
          isCorrect: opt.isCorrect || false,
        })),
        explanation: slide.explanation || '',
        points: slide.points || 1,
      } as ABCActivitySlide);
    } else if (slide.type === 'open') {
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
    } else if (slide.type === 'true-false') {
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
    }
  }

  // Create the quiz object
  const quizId = `quiz-${Date.now()}`;
  const typeNames: Record<QuizType, string> = {
    'prezentace': 'Aktivita',
    'test': 'Test',
    'pisemka': 'Písemka',
  };

  const settings: QuizSettings = {
    showProgress: true,
    showScore: true,
    allowSkip: quizType === 'prezentace',
    allowBack: quizType !== 'test',
    shuffleQuestions: quizType === 'test',
    shuffleOptions: quizType === 'test',
    showExplanations: quizType === 'prezentace' ? 'immediately' : 'after-submit',
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


