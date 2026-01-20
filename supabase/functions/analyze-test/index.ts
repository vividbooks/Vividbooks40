/**
 * Analyze Test Edge Function
 * 
 * Uses OpenAI Vision API to analyze photos of handwritten tests
 * and extract answers with grading.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AnalyzeRequest {
  imageUrl: string; // Base64 data URL (data:image/...;base64,...)
  worksheetContent?: string; // JSON string with questions, correct answers, etc.
  studentName?: string; // Student name (optional - AI will try to detect)
  worksheetTitle?: string; // Worksheet title
  studentList?: string[]; // List of student names for matching
  expectedQuestions?: number; // Number of questions expected
}

interface QuestionAnswer {
  questionNumber: number;
  questionType: 'abc' | 'open'; // ABC = multiple choice, open = free text
  question?: string; // The question text
  answer: string; // For ABC: "A", "B", "C", "D". For open: full transcribed text
  correctAnswer?: string; // The correct answer
  isCorrect: boolean | null; // null if couldn't determine
  recognized: boolean; // false if AI couldn't read the answer
  points: number;
  maxPoints: number;
}

interface AnalyzeResponse {
  score: number;
  maxScore: number;
  answers: QuestionAnswer[]; // Detailed answers per question
  comment: string;
  detectedName?: string; // Name detected on the paper
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { imageUrl, worksheetContent, studentName, worksheetTitle, studentList, expectedQuestions }: AnalyzeRequest = await req.json()

    console.log('[analyze-test] Request received:', { 
      hasImage: !!imageUrl, 
      imageLength: imageUrl?.length,
      worksheetContentLength: worksheetContent?.length,
      studentName,
      worksheetTitle,
      studentListLength: studentList?.length,
      expectedQuestions
    })

    if (!imageUrl) {
      throw new Error('imageUrl is required')
    }

    // Try multiple possible env var names
    const openaiApiKey = Deno.env.get('open_ai_key2') || Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured (tried open_ai_key2 and OPENAI_API_KEY)')
    }
    console.log('[analyze-test] Using API key starting with:', openaiApiKey.substring(0, 10) + '...')

    // Build the prompt
    const studentListText = studentList?.length 
      ? `\nSeznam žáků ve třídě: ${studentList.join(', ')}\nPokus se najít jméno žáka na testu a spárovat ho s jedním ze seznamu.`
      : '';
    
    // Parse worksheet content if it's JSON
    let worksheetInfo = '';
    let questionsFromWorksheet: any[] = [];
    try {
      if (worksheetContent && worksheetContent.startsWith('{')) {
        const parsed = JSON.parse(worksheetContent);
        if (parsed.questions) {
          questionsFromWorksheet = parsed.questions;
          worksheetInfo = `\n\nSTRUKTURA TESTU (${parsed.totalQuestions} otázek):\n`;
          parsed.questions.forEach((q: any) => {
            worksheetInfo += `- Otázka ${q.number}: ${q.type === 'open' ? 'OTEVŘENÁ' : 'ABC'} (${q.maxPoints} b.) - ${q.question || 'bez textu'}`;
            if (q.correctAnswer) worksheetInfo += ` [Správná odpověď: ${q.correctAnswer}]`;
            worksheetInfo += '\n';
          });
        }
      } else {
        worksheetInfo = worksheetContent ? `\nKontext testu: ${worksheetContent}` : '';
      }
    } catch (e) {
      worksheetInfo = worksheetContent ? `\nKontext testu: ${worksheetContent}` : '';
    }
    
    const totalExpected = expectedQuestions || questionsFromWorksheet.length || 0;
    
    const systemPrompt = `Jsi AI asistent pro hodnocení školních testů. Analyzuj fotografii vyplněného testu.

${totalExpected > 0 ? `DŮLEŽITÉ: Test má přesně ${totalExpected} otázek! Musíš vrátit odpověď pro KAŽDOU z nich.` : ''}
${worksheetInfo}
${studentListText}
Test: ${worksheetTitle || 'Test'}

ÚKOLY:
1. Najdi jméno žáka na testu (obvykle nahoře)
2. Pro KAŽDOU otázku z testu:
   - Rozpoznej typ (abc = A/B/C/D, open = volná odpověď)
   - Pro ABC: zapiš písmeno které žák zaškrtl
   - Pro OPEN: PŘEPIŠ CELÝ ručně psaný text odpovědi
   - Pokud odpověď NEDOKÁŽEŠ přečíst, nastav "recognized": false a "answer": ""
   - Porovnej se správnou odpovědí a nastav isCorrect
3. Přiřaď body

Odpověz ve formátu JSON:
{
  "detectedName": "<jméno žáka nebo null>",
  "score": <získané body>,
  "maxScore": <maximální body>,
  "answers": [
    {
      "questionNumber": 1,
      "questionType": "abc",
      "question": "Text otázky",
      "answer": "B",
      "correctAnswer": "B",
      "isCorrect": true,
      "recognized": true,
      "points": 1,
      "maxPoints": 1
    },
    {
      "questionNumber": 4,
      "questionType": "open",
      "question": "Vysvětli nadnášení",
      "answer": "Nadnášení je způsobeno rozdílem hydrostatických tlaků...",
      "correctAnswer": null,
      "isCorrect": true,
      "recognized": true,
      "points": 2,
      "maxPoints": 2
    },
    {
      "questionNumber": 5,
      "questionType": "abc",
      "question": "...",
      "answer": "",
      "correctAnswer": "A",
      "isCorrect": null,
      "recognized": false,
      "points": 0,
      "maxPoints": 1
    }
  ],
  "comment": "<stručný komentář>"
}

KRITICKÉ:
- Vrať VŠECHNY otázky${totalExpected > 0 ? ` (${totalExpected})` : ''}, i ty které nedokážeš přečíst (s recognized: false)
- Pro otevřené otázky PŘEPIŠ celý text, ne jen "D" nebo podobně
- Odpověz POUZE validním JSON`

    console.log('[analyze-test] Calling OpenAI API...')

    // Call OpenAI Vision API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: systemPrompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl, // Already a data URL
                  detail: 'high', // Use high detail for better handwriting recognition
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.2,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[analyze-test] OpenAI API error:', response.status, errorText)
      throw new Error(`OpenAI API error: ${response.status} - ${errorText.substring(0, 200)}`)
    }

    const data = await response.json()
    console.log('[analyze-test] OpenAI response received')
    
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      console.error('[analyze-test] No content in response:', data)
      throw new Error('No response from OpenAI')
    }

    console.log('[analyze-test] Raw content:', content)

    // Parse the JSON response
    let result: AnalyzeResponse
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0])
        console.log('[analyze-test] Parsed result:', result)
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      console.error('[analyze-test] Failed to parse response:', content)
      // Return a default response if parsing fails
      result = {
        score: 5,
        maxScore: 10,
        answers: [],
        comment: 'AI analyzovala test. Zkontrolujte prosím výsledek.',
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[analyze-test] Error:', error.message || error)
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

