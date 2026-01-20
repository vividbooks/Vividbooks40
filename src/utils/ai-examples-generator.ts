/**
 * AI Examples Generator
 * 
 * Generuje matematické příklady na základě vzorového příkladu pomocí Google Gemini
 */

import { MathExample, ExampleDifficulty } from '../types/worksheet';

interface GenerateExamplesOptions {
  count?: number;
  difficultyProgression?: boolean;
}

interface GenerateExamplesResult {
  topic: string;
  examples: MathExample[];
}

const SYSTEM_PROMPT = `Jsi expertní asistent pro tvorbu matematických příkladů pro české základní školy.

## KRITICKY DŮLEŽITÉ - HLOUBKOVÁ ANALÝZA VZORU:

Musíš VELMI DETAILNĚ analyzovat vzorový příklad a zachovat PŘESNĚ STEJNOU STRUKTURU:

### 1. ANALÝZA ČÍSEL:
- Jsou čísla celá nebo desetinná?
- Kolik desetinných míst mají? (0,4 vs 0,01 vs 0,001)
- Jaký je rozsah čísel? (jednotky, desítky, stovky?)
- Které číslo je desetinné - první nebo druhé operand?

### 2. ANALÝZA STRUKTURY:
Příklad "2 : 0,4 =" znamená:
- Operace: DĚLENÍ
- První operand: CELÉ ČÍSLO (malé, 1-10)
- Druhý operand: DESETINNÉ ČÍSLO (jedno desetinné místo)
- Struktura: celé_číslo ÷ desetinné_číslo

Příklad "1 : 0,01 =" znamená:
- Operace: DĚLENÍ
- První operand: CELÉ ČÍSLO (velmi malé, 1-5)
- Druhý operand: DESETINNÉ ČÍSLO (dvě desetinná místa, setiny)
- Struktura: celé_číslo ÷ setiny

### 3. PRAVIDLA PRO GENEROVÁNÍ:
- ZACHOVEJ PŘESNĚ STEJNOU STRUKTURU jako vzor!
- Pokud vzor má "celé : desetinné", generuj "celé : desetinné"
- Pokud vzor má desetinné číslo s 2 místy (0,01), generuj také 2 místa
- Pokud vzor má desetinné číslo s 1 místem (0,4), generuj také 1 místo
- NIKDY neměň strukturu (např. z "2 : 0,4" nedělej "12 : 4")

### 4. OBTÍŽNOST:
Pro "2 : 0,4 =" by obtížnost byla:
- easy: 2 : 0,2 = ; 4 : 0,4 = ; 1 : 0,5 = (jednoduchá čísla)
- medium: 3 : 0,6 = ; 5 : 0,25 = ; 4 : 0,8 = (složitější kombinace)  
- hard: 7 : 0,35 = ; 9 : 0,45 = ; 6 : 0,15 = (náročnější výpočet)

### 5. FORMÁT ODPOVĚDI (POUZE JSON):
{
  "topic": "Dělení celého čísla desetinným číslem",
  "analysis": {
    "operation": "dělení",
    "firstOperand": "celé číslo 1-10",
    "secondOperand": "desetinné číslo s 1-2 desetinnými místy",
    "structure": "celé ÷ desetinné"
  },
  "examples": [
    { "expression": "2 : 0,2 =", "answer": "10", "difficulty": "easy" }
  ]
}

KRITICKÉ: Vždy použij ČESKOU NOTACI pro desetinná čísla (čárka, ne tečka): 0,4 NE 0.4`;

/**
 * Generuje příklady na základě vzorového příkladu
 */
export async function generateExamplesFromSample(
  sampleExample: string,
  options: GenerateExamplesOptions = {}
): Promise<GenerateExamplesResult> {
  const { count = 15, difficultyProgression = true } = options;
  
  // Gemini API klíč z environment variables
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  const easyCount = Math.floor(count / 3);
  const mediumCount = Math.floor(count / 3);
  const hardCount = count - easyCount - mediumCount;

  const userPrompt = `VZOROVÝ PŘÍKLAD (analyzuj VELMI DETAILNĚ):
${sampleExample}

TVŮJ ÚKOL:
1. Analyzuj PŘESNOU STRUKTURU vzorového příkladu:
   - Jaká je operace? (+, -, ×, ÷, :)
   - Je první číslo celé nebo desetinné?
   - Je druhé číslo celé nebo desetinné?
   - Kolik desetinných míst mají desetinná čísla?
   - Jaký je rozsah čísel?

2. Vytvoř PŘESNĚ ${count} příkladů se STEJNOU STRUKTUROU:
   - Pokud vzor je "celé : desetinné" → generuj "celé : desetinné"
   - Pokud vzor má 0,XX (setiny) → generuj také setiny
   - Pokud vzor má 0,X (desetiny) → generuj také desetiny
   - NIKDY neměň strukturu na něco jiného!

3. Rozděl podle obtížnosti: easy (${easyCount}), medium (${mediumCount}), hard (${hardCount})
   ${difficultyProgression ? 'Seřaď od nejjednoduššího po nejtěžší.' : ''}
   
4. Obtížnost rozlišuj POUZE složitostí výpočtu, NE změnou struktury!

DŮLEŽITÉ: Použij českou notaci - desetinná čárka (0,4) NE tečka (0.4)!

Odpověz POUZE validním JSON objektem ve formátu:
{"topic": "popis tématu", "examples": [{"expression": "příklad", "answer": "odpověď", "difficulty": "easy|medium|hard"}]}`;

  try {
    console.log('Calling Gemini API for examples with gemini-2.5-flash...');
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }]
          }
        ],
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }]
        },
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.7,
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Gemini API error:', errorData);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    
    // Extrahovat JSON z odpovědi (může být obalený v markdown)
    let jsonStr = content;
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    } else {
      // Zkusit najít JSON objekt přímo
      const objMatch = content.match(/\{[\s\S]*\}/);
      if (objMatch) {
        jsonStr = objMatch[0];
      }
    }
    
    const parsed = JSON.parse(jsonStr);
    console.log('Gemini examples response received');

    const examples: MathExample[] = (parsed.examples || []).map((ex: any, index: number) => ({
      id: `ex-${Date.now()}-${index}`,
      expression: ex.expression || '',
      answer: ex.answer || '',
      difficulty: (ex.difficulty || 'medium') as ExampleDifficulty,
    }));

    return {
      topic: parsed.topic || 'Matematické příklady',
      examples,
    };
  } catch (error) {
    console.error('Failed to generate examples:', error);
    return generateMockExamples(sampleExample, count);
  }
}

/**
 * Generuje mock příklady pro demo bez API klíče
 */
function generateMockExamples(sampleExample: string, count: number): GenerateExamplesResult {
  let topic = 'Matematické příklady';
  let examples: MathExample[] = [];

  // Detect decimal numbers
  const hasDecimals = sampleExample.includes(',') || sampleExample.includes('.');
  const numbers = sampleExample.match(/\d+([,\.]\d+)?/g) || [];
  
  // Check structure: which operand is decimal
  const parts = sampleExample.split(/[+\-×*·÷/:]/);
  const firstIsDecimal = parts[0]?.includes(',') || parts[0]?.includes('.');
  const secondIsDecimal = parts[1]?.includes(',') || parts[1]?.includes('.');
  
  // Detect decimal places
  const decimalPlaces = sampleExample.match(/[,\.]\d+/g)?.map(d => d.length - 1) || [1];
  const maxDecimalPlaces = Math.max(...decimalPlaces);

  if (sampleExample.includes(':') || sampleExample.includes('÷') || sampleExample.includes('/')) {
    if (hasDecimals && secondIsDecimal) {
      topic = 'Dělení celého čísla desetinným číslem';
      examples = generateDivisionByDecimal(count, maxDecimalPlaces);
    } else if (hasDecimals) {
      topic = 'Dělení desetinných čísel';
      examples = generateDecimalDivision(count, maxDecimalPlaces);
    } else {
      topic = 'Dělení';
      examples = generateIntegerDivision(count);
    }
  } else if (sampleExample.includes('+')) {
    if (hasDecimals) {
      topic = 'Sčítání desetinných čísel';
      examples = generateDecimalAddition(count, maxDecimalPlaces);
    } else {
      topic = 'Sčítání';
      examples = generateIntegerAddition(count);
    }
  } else if (sampleExample.includes('-') || sampleExample.includes('−')) {
    if (hasDecimals) {
      topic = 'Odčítání desetinných čísel';
      examples = generateDecimalSubtraction(count, maxDecimalPlaces);
    } else {
      topic = 'Odčítání';
      examples = generateIntegerSubtraction(count);
    }
  } else if (sampleExample.includes('×') || sampleExample.includes('*') || sampleExample.includes('·')) {
    topic = 'Násobení';
    examples = generateMultiplication(count);
  } else {
    examples = generateIntegerAddition(count);
  }

  return { topic, examples };
}

function getDifficulties(count: number): ExampleDifficulty[] {
  const difficulties: ExampleDifficulty[] = [];
  const easyCount = Math.ceil(count / 3);
  const mediumCount = Math.ceil(count / 3);
  const hardCount = count - easyCount - mediumCount;
  
  for (let i = 0; i < easyCount; i++) difficulties.push('easy');
  for (let i = 0; i < mediumCount; i++) difficulties.push('medium');
  for (let i = 0; i < Math.max(0, hardCount); i++) difficulties.push('hard');
  
  return difficulties;
}

// Division of integer by decimal (e.g., 2 : 0,4 =)
function generateDivisionByDecimal(count: number, decimalPlaces: number): MathExample[] {
  const examples: MathExample[] = [];
  const difficulties = getDifficulties(count);
  
  for (let i = 0; i < count; i++) {
    const diff = difficulties[i % difficulties.length];
    let dividend: number;
    let divisor: number;
    
    if (decimalPlaces >= 2) {
      // Setiny (0,01 - 0,09)
      if (diff === 'easy') {
        dividend = Math.floor(Math.random() * 3) + 1; // 1-3
        divisor = (Math.floor(Math.random() * 5) + 1) / 100; // 0,01-0,05
      } else if (diff === 'medium') {
        dividend = Math.floor(Math.random() * 5) + 2; // 2-6
        divisor = (Math.floor(Math.random() * 9) + 1) / 100; // 0,01-0,09
      } else {
        dividend = Math.floor(Math.random() * 8) + 2; // 2-9
        divisor = (Math.floor(Math.random() * 20) + 5) / 100; // 0,05-0,24
      }
    } else {
      // Desetiny (0,1 - 0,9)
      if (diff === 'easy') {
        dividend = Math.floor(Math.random() * 5) + 1; // 1-5
        divisor = (Math.floor(Math.random() * 5) + 1) / 10; // 0,1-0,5
      } else if (diff === 'medium') {
        dividend = Math.floor(Math.random() * 7) + 2; // 2-8
        divisor = (Math.floor(Math.random() * 8) + 2) / 10; // 0,2-0,9
      } else {
        dividend = Math.floor(Math.random() * 9) + 1; // 1-9
        divisor = (Math.floor(Math.random() * 9) + 1) / 10; // 0,1-0,9
      }
    }
    
    const answer = Math.round((dividend / divisor) * 100) / 100;
    const divisorStr = divisor.toFixed(decimalPlaces).replace('.', ',');
    
    examples.push({
      id: `ex-${Date.now()}-${i}`,
      expression: `${dividend} : ${divisorStr} =`,
      answer: answer.toString().replace('.', ','),
      difficulty: diff,
    });
  }
  
  return examples;
}

function generateDecimalDivision(count: number, decimalPlaces: number): MathExample[] {
  const examples: MathExample[] = [];
  const difficulties = getDifficulties(count);
  
  for (let i = 0; i < count; i++) {
    const diff = difficulties[i % difficulties.length];
    const scale = Math.pow(10, decimalPlaces);
    let a: number, b: number;
    
    if (diff === 'easy') {
      a = Math.round((Math.random() * 2 + 0.5) * scale) / scale;
      b = Math.round((Math.random() * 0.5 + 0.1) * scale) / scale;
    } else if (diff === 'medium') {
      a = Math.round((Math.random() * 5 + 1) * scale) / scale;
      b = Math.round((Math.random() * 1 + 0.2) * scale) / scale;
    } else {
      a = Math.round((Math.random() * 10 + 2) * scale) / scale;
      b = Math.round((Math.random() * 2 + 0.3) * scale) / scale;
    }
    
    if (b === 0) b = 0.1;
    const answer = Math.round((a / b) * 100) / 100;
    
    examples.push({
      id: `ex-${Date.now()}-${i}`,
      expression: `${a.toFixed(decimalPlaces).replace('.', ',')} : ${b.toFixed(decimalPlaces).replace('.', ',')} =`,
      answer: answer.toString().replace('.', ','),
      difficulty: diff,
    });
  }
  
  return examples;
}

function generateIntegerDivision(count: number): MathExample[] {
  const examples: MathExample[] = [];
  const difficulties = getDifficulties(count);
  
  for (let i = 0; i < count; i++) {
    const diff = difficulties[i % difficulties.length];
    let divisor: number, quotient: number;
    
    if (diff === 'easy') {
      divisor = Math.floor(Math.random() * 5) + 2;
      quotient = Math.floor(Math.random() * 5) + 1;
    } else if (diff === 'medium') {
      divisor = Math.floor(Math.random() * 8) + 2;
      quotient = Math.floor(Math.random() * 8) + 2;
    } else {
      divisor = Math.floor(Math.random() * 10) + 3;
      quotient = Math.floor(Math.random() * 10) + 3;
    }
    
    const dividend = divisor * quotient;
    
    examples.push({
      id: `ex-${Date.now()}-${i}`,
      expression: `${dividend} : ${divisor} =`,
      answer: quotient.toString(),
      difficulty: diff,
    });
  }
  
  return examples;
}

function generateDecimalAddition(count: number, decimalPlaces: number): MathExample[] {
  const examples: MathExample[] = [];
  const difficulties = getDifficulties(count);
  const scale = Math.pow(10, decimalPlaces);
  
  for (let i = 0; i < count; i++) {
    const diff = difficulties[i % difficulties.length];
    let a: number, b: number;
    
    if (diff === 'easy') {
      a = Math.round((Math.random() * 1 + 0.1) * scale) / scale;
      b = Math.round((Math.random() * 1 + 0.1) * scale) / scale;
    } else if (diff === 'medium') {
      a = Math.round((Math.random() * 3 + 0.5) * scale) / scale;
      b = Math.round((Math.random() * 3 + 0.5) * scale) / scale;
    } else {
      a = Math.round((Math.random() * 8 + 1) * scale) / scale;
      b = Math.round((Math.random() * 8 + 1) * scale) / scale;
    }
    
    const answer = Math.round((a + b) * scale) / scale;
    
    examples.push({
      id: `ex-${Date.now()}-${i}`,
      expression: `${a.toFixed(decimalPlaces).replace('.', ',')} + ${b.toFixed(decimalPlaces).replace('.', ',')} =`,
      answer: answer.toFixed(decimalPlaces).replace('.', ','),
      difficulty: diff,
    });
  }
  
  return examples;
}

function generateDecimalSubtraction(count: number, decimalPlaces: number): MathExample[] {
  const examples: MathExample[] = [];
  const difficulties = getDifficulties(count);
  const scale = Math.pow(10, decimalPlaces);
  
  for (let i = 0; i < count; i++) {
    const diff = difficulties[i % difficulties.length];
    let a: number, b: number;
    
    if (diff === 'easy') {
      a = Math.round((Math.random() * 2 + 0.5) * scale) / scale;
      b = Math.round((Math.random() * 1 + 0.1) * scale) / scale;
    } else if (diff === 'medium') {
      a = Math.round((Math.random() * 5 + 1) * scale) / scale;
      b = Math.round((Math.random() * 3 + 0.3) * scale) / scale;
    } else {
      a = Math.round((Math.random() * 10 + 2) * scale) / scale;
      b = Math.round((Math.random() * 5 + 0.5) * scale) / scale;
    }
    
    if (a < b) [a, b] = [b, a];
    const answer = Math.round((a - b) * scale) / scale;
    
    examples.push({
      id: `ex-${Date.now()}-${i}`,
      expression: `${a.toFixed(decimalPlaces).replace('.', ',')} − ${b.toFixed(decimalPlaces).replace('.', ',')} =`,
      answer: answer.toFixed(decimalPlaces).replace('.', ','),
      difficulty: diff,
    });
  }
  
  return examples;
}

function generateIntegerAddition(count: number): MathExample[] {
  const examples: MathExample[] = [];
  const difficulties = getDifficulties(count);
  
  for (let i = 0; i < count; i++) {
    const diff = difficulties[i % difficulties.length];
    let a: number, b: number;
    
    if (diff === 'easy') {
      a = Math.floor(Math.random() * 5) + 1;
      b = Math.floor(Math.random() * 5) + 1;
    } else if (diff === 'medium') {
      a = Math.floor(Math.random() * 10) + 5;
      b = Math.floor(Math.random() * 10) + 5;
    } else {
      a = Math.floor(Math.random() * 50) + 10;
      b = Math.floor(Math.random() * 50) + 10;
    }
    
    examples.push({
      id: `ex-${Date.now()}-${i}`,
      expression: `${a} + ${b} =`,
      answer: (a + b).toString(),
      difficulty: diff,
    });
  }
  
  return examples;
}

function generateIntegerSubtraction(count: number): MathExample[] {
  const examples: MathExample[] = [];
  const difficulties = getDifficulties(count);
  
  for (let i = 0; i < count; i++) {
    const diff = difficulties[i % difficulties.length];
    let a: number, b: number;
    
    if (diff === 'easy') {
      a = Math.floor(Math.random() * 8) + 3;
      b = Math.floor(Math.random() * 3) + 1;
    } else if (diff === 'medium') {
      a = Math.floor(Math.random() * 20) + 10;
      b = Math.floor(Math.random() * 10) + 3;
    } else {
      a = Math.floor(Math.random() * 80) + 20;
      b = Math.floor(Math.random() * 30) + 10;
    }
    
    if (a < b) [a, b] = [b, a];
    
    examples.push({
      id: `ex-${Date.now()}-${i}`,
      expression: `${a} − ${b} =`,
      answer: (a - b).toString(),
      difficulty: diff,
    });
  }
  
  return examples;
}

function generateMultiplication(count: number): MathExample[] {
  const examples: MathExample[] = [];
  const difficulties = getDifficulties(count);
  
  for (let i = 0; i < count; i++) {
    const diff = difficulties[i % difficulties.length];
    let a: number, b: number;
    
    if (diff === 'easy') {
      a = Math.floor(Math.random() * 5) + 1;
      b = Math.floor(Math.random() * 5) + 1;
    } else if (diff === 'medium') {
      a = Math.floor(Math.random() * 8) + 2;
      b = Math.floor(Math.random() * 8) + 2;
    } else {
      a = Math.floor(Math.random() * 10) + 3;
      b = Math.floor(Math.random() * 10) + 3;
    }
    
    examples.push({
      id: `ex-${Date.now()}-${i}`,
      expression: `${a} × ${b} =`,
      answer: (a * b).toString(),
      difficulty: diff,
    });
  }
  
  return examples;
}
