/**
 * Material Generators from DataSet
 * 
 * NOVÝ PŘÍSTUP: Generuje TEXT místo JSON, pak parsuje lokálně.
 * To je spolehlivější a méně náchylné na chyby.
 */

import { TopicDataSet, ValidatedImage, IllustrationPrompt } from '../../types/topic-dataset';
import { Quiz, QuizSlide, createABCSlide, createInfoSlide, createOpenSlide, createVotingSlide, createBoardSlide, createConnectPairsSlide, createFillBlanksSlide } from '../../types/quiz';
import { Worksheet, WorksheetBlock, generateBlockId } from '../../types/worksheet';
import { saveQuiz, syncQuizDirectToSupabase } from '../quiz-storage';
import { saveWorksheet } from '../worksheet-storage';
import { saveDocument, syncDocumentDirectToSupabase } from '../document-storage';
import { chatWithAIProxy } from '../ai-chat-proxy';

// =====================================================
// MAIN EXPORT
// =====================================================

export interface GenerateResult {
  success: boolean;
  id?: string;
  error?: string;
  preview?: string; // Textový náhled vygenerovaného obsahu
}

export async function generateFromDataSet(
  dataSet: TopicDataSet,
  materialType: string
): Promise<GenerateResult> {
  console.log(`[Generator] Generating ${materialType} from DataSet:`, dataSet.topic);
  
  switch (materialType) {
    case 'text':
      return generateText(dataSet);
    case 'board-easy':
      return generateBoard(dataSet, 'easy');
    case 'board-hard':
      return generateBoard(dataSet, 'hard');
    case 'worksheet':
      return generateWorksheet(dataSet);
    case 'test':
      return generateTest(dataSet);
    case 'lesson':
      return generateLesson(dataSet);
    case 'lessons':
      return generateMultipleLessons(dataSet);
    case 'methodology':
      return generateMethodology(dataSet);
    default:
      return { success: false, error: `Neznámý typ materiálu: ${materialType}` };
  }
}

// =====================================================
// POMOCNÉ FUNKCE
// =====================================================

function buildContext(dataSet: TopicDataSet): string {
  const parts: string[] = [];
  
  // RVP očekávané výstupy (pokud existují)
  if (dataSet.rvp?.expectedOutcomes?.length > 0) {
    parts.push(`🎯 OČEKÁVANÉ VÝSTUPY RVP:`);
    dataSet.rvp.expectedOutcomes.forEach(o => {
      parts.push(`• ${o}`);
    });
    parts.push('');
  }
  
  // Klíčové kompetence RVP
  const competencies = (dataSet.rvp as any)?.competencies;
  if (competencies?.length > 0) {
    parts.push(`🔑 KLÍČOVÉ KOMPETENCE:`);
    competencies.forEach((c: string) => {
      parts.push(`• ${c}`);
    });
    parts.push('');
  }
  
  // Klíčové pojmy
  if (dataSet.content?.keyTerms?.length > 0) {
    parts.push(`📖 KLÍČOVÉ POJMY:`);
    dataSet.content.keyTerms.forEach(t => {
      parts.push(`• ${t.term} — ${t.definition}`);
    });
    parts.push('');
  }
  
  // Klíčová fakta
  if (dataSet.content?.keyFacts?.length > 0) {
    parts.push(`✓ KLÍČOVÁ FAKTA:`);
    dataSet.content.keyFacts.forEach(f => {
      parts.push(`• ${f}`);
    });
    parts.push('');
  }
  
  // Časová osa
  if (dataSet.content?.timeline && dataSet.content.timeline.length > 0) {
    parts.push(`📅 ČASOVÁ OSA:`);
    dataSet.content.timeline.forEach((e: any) => {
      parts.push(`• ${e.year || e.date || ''}: ${e.event || e.description || ''}`);
    });
    parts.push('');
  }
  
  // Osobnosti
  if (dataSet.content?.personalities && dataSet.content.personalities.length > 0) {
    parts.push(`👤 OSOBNOSTI:`);
    dataSet.content.personalities.forEach((p: any) => {
      parts.push(`• ${p.name} — ${p.description}`);
    });
    parts.push('');
  }
  
  // Obrázky a ilustrace
  const images = dataSet.media?.images || [];
  const illustrations = dataSet.media?.generatedIllustrations || [];
  
  if (images.length > 0 || illustrations.length > 0) {
    parts.push(`🖼️ DOSTUPNÉ VIZUÁLY:`);
    images.forEach((img, i) => {
      parts.push(`  - Obrázek: "${img.title}"`);
    });
    illustrations.forEach((ill, i) => {
      parts.push(`  - Ilustrace: "${ill.name}"`);
    });
  }
  
  // User feedback for regeneration
  if ((dataSet.content as any)?.userFeedback) {
    parts.push('');
    parts.push(`⚠️ DŮLEŽITÉ POKYNY OD UŽIVATELE (musíš je respektovat!):`);
    parts.push((dataSet.content as any).userFeedback);
    parts.push('');
  }

  return parts.join('\n');
}

// Načíst uložený feedback pro daný typ generátoru
function getFeedbackForType(type: string): string {
  try {
    const saved = localStorage.getItem('generator_feedback');
    console.log('[Feedback] Raw localStorage:', saved);
    if (!saved) {
      console.log('[Feedback] No feedback found in localStorage');
      return '';
    }
    
    const feedbackHistory = JSON.parse(saved);
    console.log('[Feedback] Parsed history:', feedbackHistory);
    const feedbackList = feedbackHistory[type] || [];
    console.log(`[Feedback] For type "${type}":`, feedbackList);
    
    if (feedbackList.length === 0) {
      console.log('[Feedback] No feedback for this type');
      return '';
    }
    
    const result = `\n\nDŮLEŽITÉ POKYNY OD UŽIVATELE (musíš je respektovat!):\n${feedbackList.map((f: string) => `- ${f}`).join('\n')}`;
    console.log('[Feedback] Adding to prompt:', result);
    return result;
  } catch (e) {
    console.error('[Feedback] Error:', e);
    return '';
  }
}

function getImage(dataSet: TopicDataSet, index: number = 0): string | undefined {
  const images = dataSet.media?.images || [];
  if (images.length === 0) return undefined;
  return images[index % images.length]?.url;
}

/**
 * Robustní normalizace AI výstupu na náš formát bloků
 */
function normalizeWorksheetResponse(text: string): string {
  const output: string[] = [];
  const lines = text.split('\n');
  
  let i = 0;
  let hasHeader = false;
  
  // Přidej HEADER na začátek
  output.push('HEADER:');
  output.push('');
  hasHeader = true;
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Prázdný řádek - přeskočit
    if (!line) {
      i++;
      continue;
    }
    
    // Už má správný formát - ponechat
    if (/^(HEADER|FOOTER|HEADING|PARAGRAPH|INFOBOX|OBRÁZEK|IMAGE|MULTIPLE-CHOICE|FILL-BLANK|FREE-ANSWER|CONNECT-PAIRS|TABLE):/i.test(line)) {
      // Přeskočit HEADER pokud už máme
      if (line.toUpperCase().startsWith('HEADER:') && hasHeader) {
        i++;
        continue;
      }
      output.push('');
      output.push(line);
      i++;
      continue;
    }
    
    // # Nadpis -> HEADING:
    if (line.startsWith('#')) {
      const headingText = line.replace(/^#+\s*/, '').trim();
      output.push('');
      output.push(`HEADING: ${headingText}`);
      i++;
      continue;
    }
    
    // ❓ Otázka -> MULTIPLE-CHOICE:
    if (line.startsWith('❓') || /^[0-9]+\.\s*❓/.test(line)) {
      const question = line.replace(/^[0-9]*\.?\s*❓\s*/, '').trim();
      output.push('');
      output.push('MULTIPLE-CHOICE:');
      output.push(question);
      i++;
      
      // Načíst možnosti A) B) C) D)
      while (i < lines.length) {
        const optLine = lines[i].trim();
        if (/^[A-D]\)/.test(optLine)) {
          output.push(optLine);
          i++;
        } else {
          break;
        }
      }
      continue;
    }
    
    // 📝 Doplň -> FILL-BLANK:
    if (line.startsWith('📝') || line.toLowerCase().includes('doplň:')) {
      let fillText = line.replace(/^[0-9]*\.?\s*📝\s*(Doplň:?\s*)?/i, '').trim();
      fillText = fillText.replace(/^Doplň:?\s*/i, '').trim();
      
      // Pokud obsahuje ___ a =, je to kompletní
      if (fillText.includes('___') && fillText.includes('=')) {
        output.push('');
        output.push('FILL-BLANK:');
        output.push(fillText);
      } else if (fillText.includes('___')) {
        // Bez odpovědi - zkusíme najít odpověď v závorce
        const match = fillText.match(/\(([^)]+)\)/);
        if (match) {
          const answer = match[1];
          fillText = fillText.replace(/\([^)]+\)/, '');
          output.push('');
          output.push('FILL-BLANK:');
          output.push(`${fillText.trim()} = ${answer}`);
        } else {
          output.push('');
          output.push('FILL-BLANK:');
          output.push(`${fillText} = ???`);
        }
      } else {
        // Text obsahuje mezeru na doplnění v závorkách?
        output.push('');
        output.push('FILL-BLANK:');
        output.push(fillText.includes('=') ? fillText : `${fillText} = ???`);
      }
      i++;
      continue;
    }
    
    // ✍️ Otázka -> FREE-ANSWER:
    if (line.startsWith('✍️')) {
      const question = line.replace(/^[0-9]*\.?\s*✍️\s*/, '').trim();
      output.push('');
      output.push('FREE-ANSWER:');
      output.push(question);
      i++;
      continue;
    }
    
    // **Pojem:** Definice -> INFOBOX:
    if (line.startsWith('**') && line.includes(':**')) {
      const infoText = line.replace(/\*\*/g, '').replace(/:/, ' - ');
      output.push('');
      output.push('INFOBOX:');
      output.push(infoText);
      i++;
      continue;
    }
    
    // Zpětná vazba -> FOOTER:
    if (line.toLowerCase().includes('zpětná vazba') || line.includes('😊') || line.includes('😐') || line.includes('☹️')) {
      output.push('');
      output.push('FOOTER:');
      output.push(line);
      i++;
      // Načíst další řádky patřící k footeru
      while (i < lines.length) {
        const nextLine = lines[i].trim();
        if (!nextLine) break;
        output.push(nextLine);
        i++;
      }
      continue;
    }
    
    // Jméno/Třída/Známka -> přeskočit (už máme HEADER)
    if (line.toLowerCase().includes('jméno') && line.includes('třída')) {
      i++;
      continue;
    }
    
    // Pojem: Definice (na samostatném řádku, krátký) -> INFOBOX:
    if (/^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž\s]+:/.test(line) && line.length < 150 && !line.toLowerCase().includes('poznámky')) {
      output.push('');
      output.push('INFOBOX:');
      output.push(line.replace(':', ' -'));
      i++;
      continue;
    }
    
    // Dlouhý text (>80 znaků) -> PARAGRAPH:
    if (line.length > 80) {
      output.push('');
      output.push('PARAGRAPH:');
      output.push(line);
      i++;
      
      // Přidat následující řádky dokud nenarazíme na nový blok
      while (i < lines.length) {
        const nextLine = lines[i].trim();
        if (!nextLine) break;
        if (/^(#|❓|📝|✍️|\*\*|[A-D]\)|HEADER|FOOTER|HEADING|PARAGRAPH)/i.test(nextLine)) break;
        if (nextLine.length < 30) break; // Krátký řádek = konec odstavce
        output.push(nextLine);
        i++;
      }
      continue;
    }
    
    // Krátký text - přeskočit nebo přidat k předchozímu
    i++;
  }
  
  // Přidej FOOTER na konec
  output.push('');
  output.push('FOOTER:');
  
  return output.join('\n');
}

// =====================================================
// BOARD GENERATOR - Textový přístup
// =====================================================

async function generateBoard(dataSet: TopicDataSet, difficulty: 'easy' | 'hard'): Promise<GenerateResult> {
  console.log(`[Generator] Generating board (${difficulty})...`);
  
  const context = buildContext(dataSet);
  const questionCount = difficulty === 'easy' ? 5 : 6;
  
  const feedback = getFeedbackForType(difficulty === 'easy' ? 'board-easy' : 'board-hard');
  
  // Připravit seznamy obrázků a ilustrací
  const images = dataSet.media?.images || [];
  const illustrations = dataSet.media?.generatedIllustrations || [];
  
  let mediaSection = '';
  if (images.length > 0) {
    mediaSection += `\n🖼️ DOSTUPNÉ OBRÁZKY:\n${images.map((img, i) => `  ${i + 1}. "${img.title}"`).join('\n')}`;
  }
  if (illustrations.length > 0) {
    mediaSection += `\n🎨 DOSTUPNÉ ILUSTRACE:\n${illustrations.map((ill, i) => `  ${i + 1}. "${ill.name}"`).join('\n')}`;
  }
  
  console.log(`[Generator] Board media: ${images.length} images, ${illustrations.length} illustrations`);
  
  // Pokud je feedback, přidej ho jako prioritní instrukce
  const prompt = `Vytvoř interaktivní procvičování k tématu "${dataSet.topic}" pro ${dataSet.grade}. třídu.
Obtížnost: ${difficulty === 'easy' ? 'lehká' : 'těžší'}

${context}
${feedback ? feedback : ''}
${mediaSection}

===== STRUKTURA PROCVIČOVÁNÍ =====
Vygeneruj mix aktivit v tomto pořadí:
1. ${questionCount - 2}x ABC OTÁZKA (většina)
2. 1x SPOJOVAČKA (propojování dvojic)
3. 1x DOPLŇOVAČKA (doplnění slov do mezer)

===== FORMÁTY =====

ABC OTÁZKA:
OTÁZKA: Text otázky?
A) možnost
B) správná odpověď *
C) možnost
D) možnost

ABC OTÁZKA S OBRÁZKEM (použij název z 🖼️ OBRÁZKY nebo 🎨 ILUSTRACE):
OTÁZKA: Co je na tomto obrázku?
OBRÁZEK: Řecká helma hoplíta
A) Špatná odpověď
B) Správná odpověď *
C) Špatná odpověď
D) Špatná odpověď

SPOJOVAČKA (4 dvojice):
SPOJOVAČKA: Spoj správné dvojice
Pojem1 | Význam1
Pojem2 | Význam2
Pojem3 | Význam3
Pojem4 | Význam4

DOPLŇOVAČKA (2-3 věty):
DOPLŇOVAČKA: Doplň chybějící slova
Text věty s ___ mezerou. = správná odpověď
Další věta s ___. = odpověď

===== PRAVIDLA PRO OBRÁZKY =====
- K 1-2 ABC otázkám přidej obrázek - použij PŘESNÝ název ze seznamu výše
- Můžeš použít obrázky (🖼️) i ilustrace (🎨)
- Min. 1 otázka typu "Co je na obrázku?" nebo "Co vidíš na ilustraci?"

ZAČNI GENEROVAT:`;

  console.log('[Generator] Board prompt:', prompt);

  try {
    const response = await chatWithAIProxy(
      [{ role: 'user', content: prompt }],
      'gemini-3.0-flash',
      { temperature: 0.7, max_tokens: 4096 }
    );
    
    // Parsovat textovou odpověď na slidy
    const slides = parseTextToSlides(response, dataSet, difficulty);
    
    if (slides.length === 0) {
      throw new Error('Nepodařilo se parsovat otázky z odpovědi');
    }
    
    const quizId = `quiz-${Date.now()}`;
    
    const quiz: Quiz = {
      id: quizId,
      title: `${dataSet.topic} - ${difficulty === 'easy' ? 'Lehké' : 'Těžké'} procvičování`,
      slides,
      settings: {
        showPoints: true,
        allowBack: true,
        shuffleSlides: false,
        shuffleOptions: difficulty === 'hard',
        timeLimit: null,
        passingScore: 60,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Uložit - localStorage může selhat, proto přímý sync do Supabase
    try {
      saveQuiz(quiz);
    } catch (e) {
      console.warn(`[Generator] localStorage failed for board ${quizId}:`, e);
    }
    
    // Přímý sync do Supabase (nezávisí na localStorage)
    const synced = await syncQuizDirectToSupabase(quiz);
    if (!synced) {
      console.warn(`[Generator] Supabase sync failed for board ${quizId}`);
    }
    
    // Vytvořit textový náhled
    const preview = slides.map((slide, i) => {
      const s = slide as any;
      
      // ABC otázka
      if (s.activityType === 'abc' && s.question && s.options) {
        const imageUrl = s.media?.url;
        const imageText = imageUrl ? `\n🖼️ Obrázek: ${imageUrl.split('/').pop()?.split('?')[0] || 'přiložen'}` : '';
        const optionsText = s.options.map((o: any) => 
          `${o.label}) ${o.content}${o.isCorrect ? ' ✓' : ''}`
        ).join('\n');
        return `**ABC otázka ${i + 1}:** ${s.question}${imageText}\n${optionsText}`;
      }
      
      // Spojovačka
      if (s.activityType === 'connect-pairs' && s.pairs) {
        const pairsText = s.pairs.map((p: any) => 
          `${p.left?.content || ''} ↔ ${p.right?.content || ''}`
        ).join('\n');
        return `**🔗 Spojovačka:** ${s.instruction || 'Spoj dvojice'}\n${pairsText}`;
      }
      
      // Doplňovačka
      if (s.activityType === 'fill-blanks' && s.sentences) {
        const sentencesText = s.sentences.map((sent: any) => {
          const answer = sent.blanks?.[0]?.text || '';
          return `${sent.text?.replace(/\[.*?\]/g, '___')} = ${answer}`;
        }).join('\n');
        return `**✏️ Doplňovačka:** ${s.instruction || 'Doplň slova'}\n${sentencesText}`;
      }
      
      return '';
    }).filter(Boolean).join('\n\n');
    
    console.log('[Generator] Board saved:', quizId, 'with', slides.length, 'slides');
    return { success: true, id: quizId, preview };
  } catch (err) {
    console.error('[Generator] Board error:', err);
    return { success: false, error: String(err) };
  }
}

function parseTextToSlides(text: string, dataSet: TopicDataSet, difficulty: string): QuizSlide[] {
  const slides: QuizSlide[] = [];
  
  // Rozdělit na bloky podle typu aktivity
  const blocks = text.split(/(?=OTÁZKA:|SPOJOVAČKA:|DOPLŇOVAČKA:)/i).filter(block => block.trim());
  
  blocks.forEach((block) => {
    const lines = block.trim().split('\n').filter(line => line.trim());
    if (lines.length < 2) return;
    
    const firstLine = lines[0].trim();
    
    // === SPOJOVAČKA ===
    if (firstLine.match(/^SPOJOVAČKA:/i)) {
      const instruction = firstLine.replace(/^SPOJOVAČKA:\s*/i, '').trim() || 'Spoj správné dvojice';
      const pairs: { id: string; left: { id: string; type: 'text'; content: string }; right: { id: string; type: 'text'; content: string } }[] = [];
      
      lines.slice(1).forEach((line, i) => {
        const pairMatch = line.match(/^(.+?)\s*\|\s*(.+)$/);
        if (pairMatch) {
          pairs.push({
            id: `pair-${i + 1}`,
            left: { id: `left-${i + 1}`, type: 'text', content: pairMatch[1].trim() },
            right: { id: `right-${i + 1}`, type: 'text', content: pairMatch[2].trim() },
          });
        }
      });
      
      if (pairs.length >= 2) {
        slides.push({
          ...createConnectPairsSlide(slides.length),
          instruction,
          pairs,
        });
        console.log('[Parser] ✅ Created connect-pairs slide with', pairs.length, 'pairs');
      }
      return;
    }
    
    // === DOPLŇOVAČKA ===
    if (firstLine.match(/^DOPLŇOVAČKA:/i)) {
      const instruction = firstLine.replace(/^DOPLŇOVAČKA:\s*/i, '').trim() || 'Doplň chybějící slova';
      const sentences: { id: string; text: string; blanks: { id: string; text: string; position: number }[] }[] = [];
      
      lines.slice(1).forEach((line, i) => {
        // Formát: "Věta s ___ mezerou. = odpověď"
        const sentenceMatch = line.match(/^(.+?___.*?)\s*=\s*(.+)$/);
        if (sentenceMatch) {
          const originalText = sentenceMatch[1].trim();
          const answer = sentenceMatch[2].trim();
          const blankId = `blank-${i + 1}`;
          
          // Najít pozici ___
          const position = originalText.indexOf('___');
          
          // Nahradit ___ za [blank_id]
          const textWithBlanks = originalText.replace(/___/, `[${blankId}]`);
          
          sentences.push({
            id: `sentence-${i + 1}`,
            text: textWithBlanks,
            blanks: [{ id: blankId, text: answer, position }],
          });
        }
      });
      
      if (sentences.length >= 1) {
        slides.push({
          ...createFillBlanksSlide(slides.length),
          instruction,
          sentences,
          distractors: [],
        });
        console.log('[Parser] ✅ Created fill-blanks slide with', sentences.length, 'sentences');
      }
      return;
    }
    
    // === ABC OTÁZKA ===
    if (firstLine.match(/^OTÁZKA:/i)) {
      const questionText = firstLine.replace(/^OTÁZKA:\s*/i, '').trim();
      let questionImage: string | undefined = undefined;
      const options: { id: string; label: string; content: string; isCorrect: boolean }[] = [];
      
      // Hledat obrázek nebo ilustraci v bloku
      for (const line of lines) {
        const imageMatch = line.match(/^OBRÁZEK:\s*(.+)/i);
        if (imageMatch) {
          const imageName = imageMatch[1].trim().toLowerCase();
          
          // Hledat v obrázcích
          const foundImage = dataSet.media?.images?.find(img => {
            const imgTitle = (img.title || '').toLowerCase();
            return imgTitle === imageName ||
                   imgTitle.includes(imageName) ||
                   imageName.includes(imgTitle) ||
                   imgTitle.replace(/[^a-z0-9]/g, '').includes(imageName.replace(/[^a-z0-9]/g, '')) ||
                   imageName.replace(/[^a-z0-9]/g, '').includes(imgTitle.replace(/[^a-z0-9]/g, ''));
          });
          
          if (foundImage?.url) {
            questionImage = foundImage.url;
            console.log('[Parser] ✅ Found image:', imageName);
          } else {
            // Hledat v ilustracích
            const foundIll = dataSet.media?.generatedIllustrations?.find(ill => {
              const illName = (ill.name || '').toLowerCase();
              return illName === imageName ||
                     illName.includes(imageName) ||
                     imageName.includes(illName) ||
                     illName.replace(/[^a-z0-9]/g, '').includes(imageName.replace(/[^a-z0-9]/g, '')) ||
                     imageName.replace(/[^a-z0-9]/g, '').includes(illName.replace(/[^a-z0-9]/g, ''));
            });
            
            if (foundIll?.url) {
              questionImage = foundIll.url;
              console.log('[Parser] ✅ Found illustration:', imageName, '->', foundIll.name);
            }
          }
        }
      }
      
      // Parsovat možnosti A) B) C) D)
      lines.forEach((line) => {
        const match = line.match(/^([A-D])\)\s*(.+)/i);
        if (match) {
          const label = match[1].toUpperCase();
          let content = match[2].trim();
          const isCorrect = content.endsWith('*');
          if (isCorrect) {
            content = content.slice(0, -1).trim();
          }
          options.push({
            id: label.toLowerCase(),
            label,
            content,
            isCorrect,
          });
        }
      });
      
      // Pokud nejsou žádné správné odpovědi, označit první jako správnou
      if (options.length > 0 && !options.some(o => o.isCorrect)) {
        options[0].isCorrect = true;
      }
      
      if (options.length >= 2) {
        slides.push({
          ...createABCSlide(slides.length),
          question: questionText,
          options,
          points: difficulty === 'easy' ? 1 : 2,
          ...(questionImage ? { media: { type: 'image' as const, url: questionImage } } : {}),
        });
        console.log('[Parser] ✅ Created ABC slide:', questionText.substring(0, 30));
      }
    }
  });
  
  return slides;
}

// =====================================================
// WORKSHEET GENERATOR - Textový přístup
// =====================================================

async function generateWorksheet(dataSet: TopicDataSet): Promise<GenerateResult> {
  console.log('[Generator] Generating worksheet...');
  
  const context = buildContext(dataSet);
  console.log('[Generator] Context generated:', context);
  
  const feedback = getFeedbackForType('worksheet');
  console.log('[Generator] Feedback:', feedback);
  
  const prompt = `PROMPT PRO VYTVOŘENÍ TEXTOVÉHO PRACOVNÍHO LISTU

Vytvořte komplexní textový pracovní list podle vstupních informací v přesném formátu pro parser.

VSTUPNÍ INFORMACE:
📌 TÉMA: ${dataSet.topic}
🎓 ROČNÍK: ${dataSet.grade}. třída
📚 PŘEDMĚT: ${dataSet.subjectCode || 'Dějepis'}

${context}

---

KRITICKÁ PRAVIDLA PRO FORMÁT

ZÁKLADNÍ SYNTAXE (POVINNÁ!)
Každý blok má tento formát:
TYP_BLOKU:
obsah na dalších řádcích

DŮLEŽITÉ:
- Typ bloku VŽDY VELKÝMI PÍSMENY následovaný dvojtečkou
- Obsah VŽDY na NOVÝCH ŘÁDCÍCH (nikdy ne na stejném řádku jako typ)
- HALF LAYOUT se píše za dvojtečku: PARAGRAPH: HALF LAYOUT
- Prázdný řádek mezi bloky pro čitelnost

TYPY BLOKŮ A JEJICH FORMÁT:

HEADER:
Jméno: ________________ Třída: ________ Známka: ________

HEADING-H1:
Hlavní nadpis pracovního listu (pouze jeden, na začátku)

HEADING:
Název sekce nebo podkapitoly (H2)

PARAGRAPH:
Text odstavce s vysvětlením tématu. Může mít více vět.

PARAGRAPH: HALF LAYOUT
Text, který bude vedle obrázku.

INFOBOX:
Důležitá informace nebo zvýraznění klíčového faktu.

INFOBOX: HALF LAYOUT
Informace vedle obrázku.

OBRÁZEK: Přesný název obrázku ze seznamu

TABLE:
Sloupec 1 | Sloupec 2 | Sloupec 3
Hodnota 1 | Hodnota 2 | Hodnota 3

MULTIPLE-CHOICE:
Znění otázky?
A) nesprávná možnost
B) správná odpověď *
C) nesprávná možnost
D) nesprávná možnost
(Správná odpověď končí hvězdičkou *)

FILL-BLANK:
Text s ___ mezerou pro doplnění. = správná odpověď
(Formát: text s ___ = odpověď)

FREE-ANSWER:
Otevřená otázka pro žáka, na kterou napíše vlastní odpověď?

CONNECT-PAIRS:
Pojem 1 | Definice 1
Pojem 2 | Definice 2
Pojem 3 | Definice 3
Pojem 4 | Definice 4
(Formát: pojem | definice)

FOOTER:
Zpětná vazba: 😊 😐 ☹️
Poznámky učitele: _______________________

POŽADAVKY NA OBSAH:
✅ 6-10 sekcí s logickou návazností (učební linka)
✅ Minimálně 3 různé typy aktivit rozložené rovnoměrně
✅ Pokryj všechny klíčové pojmy ze vstupních informací
✅ Zahrň osobnosti a časovou osu (pokud jsou ve vstupu)
✅ Header na začátku + Footer na konci
✅ NEPOUŽÍVEJ obrázky (OBRÁZEK:) - pracovní list je pouze textový

STRUKTURA PRACOVNÍHO LISTU:

1. HEADER (jméno, třída, známka)

2. HEADING-H1 (název tématu)

3. ÚVODNÍ TEXT (1-2 obsáhlé odstavce)
   - Shrň celé téma v 8-12 větách
   - Zahrň všechny klíčové pojmy a fakta
   - Zmiň důležité osobnosti a události
   - Tento text slouží jako podklad pro aktivity

4. AKTIVITY (zbytek pracovního listu)
   - 8-12 různých aktivit
   - Střídej typy: MULTIPLE-CHOICE, FILL-BLANK, CONNECT-PAIRS, FREE-ANSWER
   - NEPOUŽÍVEJ HEADING před aktivitami - typ aktivity je dostatečný
   - Aktivity ověřují pochopení úvodního textu

5. FOOTER (zpětná vazba)

PŘÍKLAD SPRÁVNÉHO FORMÁTU:

HEADER:
Jméno: ________________ Třída: ________ Známka: ________

HEADING-H1:
Starověké Řecko

PARAGRAPH:
Starověké Řecko se rozkládalo na Balkánském poloostrově a mnoha ostrovech. Řekové byli vynikající mořeplavci a obchodníci. Nežili v jednom velkém státě, ale v samostatných městských státech zvaných polis. Dva nejmocnější byly Athény (centrum umění a demokracie) a Sparta (vojenský stát). V Athénách vznikla demokracie – vláda lidu. Řekové věřili v mnoho bohů, kteří sídlili na hoře Olymp. Nejvyšší byl Zeus. Na jeho počest se konaly olympijské hry. Řekové vymysleli divadlo a položili základy evropské kultury. Mezi slavné osobnosti patří filosof Sókratés, básník Homér a vojevůdce Alexandr Veliký.

MULTIPLE-CHOICE:
Jak se nazývaly řecké městské státy?
A) Kolonie
B) Polis *
C) Provincie
D) Království

FILL-BLANK:
Vláda lidu se nazývá ___ a vznikla v Athénách. = demokracie
Nejvyšší řecký bůh se jmenoval ___. = Zeus
Sportovní hry na počest Dia se nazývaly ___. = olympijské hry

CONNECT-PAIRS:
Athény | demokracie a umění
Sparta | vojenský stát
Sókratés | filosof
Homér | básník

MULTIPLE-CHOICE:
Kdo nikdy neprohrál bitvu a rozšířil řeckou kulturu až do Indie?
A) Periklés
B) Homér
C) Alexandr Veliký *
D) Zeus

FREE-ANSWER:
Co z odkazu starověkého Řecka používáme dodnes? Uveď alespoň dva příklady.

FOOTER:
Zpětná vazba: 😊 😐 ☹️

PRAVIDLA PRO OTÁZKY:
- NIKDY nedávej otázku přímo na informaci, která je v textu TĚSNĚ PŘED ní
- Otázky ověřují pochopení, ne mechanické opakování
- Otázky dávej na konec sekce nebo na začátek další sekce
- Otázka může odkazovat na informace z PŘEDCHOZÍCH sekcí (opakování)

Špatně:
PARAGRAPH: Řecko leží na Balkánském poloostrově.
MULTIPLE-CHOICE: Kde leží Řecko? ❌

Správně:
PARAGRAPH: Řecko leží na Balkánském poloostrově.
PARAGRAPH: Bylo rozděleno na městské státy...
MULTIPLE-CHOICE: Co bylo typické pro organizaci Řecka? ✓

CHECKLIST:
✅ Typy bloků VELKÝMI PÍSMENY s dvojtečkou
✅ Obsah na nových řádcích
✅ HEADING-H1: pouze jeden (hlavní nadpis na začátku)
✅ HEADING: pro všechny ostatní podnadpisy (H2)
✅ Multiple-choice: * u správné odpovědi
✅ Fill-blank: ___ = odpověď
✅ Connect-pairs: pojem | definice
✅ NEPOUŽÍVEJ obrázky - pracovní list je textový
✅ Sekce čísluj a dodržuj logickou návaznost
✅ Otázky NIKDY přímo na předchozí text

${feedback}`;
  
  const systemPrompt = `Jsi přísný generátor pracovních listů. MUSÍŠ dodržet PŘESNÝ formát výstupu.

ABSOLUTNÍ PRAVIDLA:
1. KAŽDÝ blok MUSÍ začínat klíčovým slovem VELKÝMI PÍSMENY následovaným dvojtečkou
2. NIKDY nepiš prostý text bez označení typu bloku
3. NIKDY nepoužívej Markdown formátování (žádné #, **, _)
4. Začni VŽDY s "HEADER:" jako první řádek

POVOLENÉ TYPY BLOKŮ (použij PŘESNĚ takto):
HEADER:
HEADING:
PARAGRAPH:
PARAGRAPH: HALF LAYOUT
INFOBOX:
INFOBOX: HALF LAYOUT
OBRÁZEK: [název]
TABLE:
MULTIPLE-CHOICE:
FILL-BLANK:
FREE-ANSWER:
CONNECT-PAIRS:
FOOTER:

PŘÍKLAD SPRÁVNÉHO VÝSTUPU:
HEADER:
Jméno: ___ Třída: ___ Známka: ___

HEADING:
Název sekce

PARAGRAPH:
Text odstavce.

MULTIPLE-CHOICE:
Otázka?
A) možnost
B) správná *
C) možnost

FOOTER:
Zpětná vazba: 😊 😐 ☹️

ZAČNI ODPOVĚĎ PŘESNĚ TAKTO: "HEADER:"
`;

  console.log('[Generator] Worksheet prompt:', prompt);

  console.log('[Generator] Full prompt being sent:', prompt.substring(0, 500) + '...');
  
  try {
    const response = await chatWithAIProxy(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      'gemini-3.0-flash',
      { temperature: 0.5, max_tokens: 8192 }
    );
    
    console.log('[Generator] Raw worksheet response:', response);
    
    // Pokud AI vrátilo správný formát (začíná HEADER:), nepoužívat normalizaci
    const startsWithHeader = response.trim().startsWith('HEADER:');
    const finalResponse = startsWithHeader ? response : normalizeWorksheetResponse(response);
    console.log('[Generator] Using normalization:', !startsWithHeader);
    console.log('[Generator] Final response:', finalResponse.substring(0, 500) + '...');
    
    const blocks = parseTextToWorksheetBlocks(finalResponse, dataSet);
    
    const worksheetId = `worksheet-${Date.now()}`;
    
    const worksheet: Worksheet = {
      id: worksheetId,
      title: `${dataSet.topic} - Pracovní list`,
      blocks,
      settings: {
        showAnswerKey: true,
        pageSize: 'A4',
        margins: 'normal',
      },
      metadata: {
        subject: dataSet.subjectCode,
        grade: dataSet.grade,
        topic: dataSet.topic,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    saveWorksheet(worksheet);
    
    // Zobrazit PŘESNĚ to co vrátilo AI
    const preview = response;
    
    console.log('[Generator] Worksheet saved:', worksheetId);
    return { success: true, id: worksheetId, preview };
  } catch (err) {
    console.error('[Generator] Worksheet error:', err);
    return { success: false, error: String(err) };
  }
}

function parseTextToWorksheetBlocks(text: string, dataSet: TopicDataSet): WorksheetBlock[] {
  const blocks: WorksheetBlock[] = [];
  let order = 0;
  
  console.log('[Worksheet Parser] Input text length:', text?.length || 0);
  console.log('[Worksheet Parser] First 500 chars:', text?.substring(0, 500));
  
  if (!text || text.trim().length < 50) {
    console.error('[Worksheet Parser] Text is empty or too short!');
    // Vrátit fallback bloky
    return [{
      id: generateBlockId(),
      type: 'heading',
      order: 0,
      width: 'full',
      content: { text: `${dataSet.topic} - Pracovní list`, level: 'h1' },
    }, {
      id: generateBlockId(),
      type: 'paragraph',
      order: 1,
      width: 'full',
      content: { html: '<p>Generování pracovního listu selhalo. Zkuste to prosím znovu.</p>' },
    }];
  }
  
  // Rozdělíme text podle typů bloků
  const lines = text.split('\n');
  let currentType = '';
  let currentContent: string[] = [];
  let isHalfLayout = false;
  
  const processBlock = () => {
    if (!currentType || currentContent.length === 0) return;
    
    const content = currentContent.join('\n').trim();
    const width = isHalfLayout ? 'half' : 'full';
    
    switch (currentType.toUpperCase()) {
      case 'HEADER':
        blocks.push({
          id: generateBlockId(),
          type: 'header-footer',
          order: order++,
          width: 'full',
          content: {
            variant: 'header',
            columns: 1,
            showName: true,
            showSurname: true,
            showClass: true,
            showGrade: true,
          },
        });
        break;
        
      case 'FOOTER':
        blocks.push({
          id: generateBlockId(),
          type: 'header-footer',
          order: order++,
          width: 'full',
          content: {
            variant: 'footer',
            columns: 1,
            showFeedback: true,
            feedbackType: 'smileys',
            feedbackCount: 3,
            feedbackText: 'Zpětná vazba:',
          },
        });
        break;
        
      case 'HEADING-H1':
        blocks.push({
          id: generateBlockId(),
          type: 'heading',
          order: order++,
          width: 'full',
          content: { text: content, level: 'h1' },
        });
        break;
        
      case 'HEADING':
        blocks.push({
          id: generateBlockId(),
          type: 'heading',
          order: order++,
          width: 'full',
          content: { text: content, level: 'h2' },
        });
        break;
        
      case 'PARAGRAPH':
        blocks.push({
          id: generateBlockId(),
          type: 'paragraph',
          order: order++,
          width,
          widthPercent: isHalfLayout ? 50 : undefined,
          content: { html: `<p>${content}</p>` },
        });
        break;
        
      case 'INFOBOX':
        blocks.push({
          id: generateBlockId(),
          type: 'paragraph',
          order: order++,
          width,
          widthPercent: isHalfLayout ? 50 : undefined,
          content: { html: `<p>${content}</p>` },
          visualStyles: {
            displayPreset: 'infobox',
            backgroundColor: '#dbeafe',
            borderColor: '#3b82f6',
            borderRadius: 12,
          },
        });
        break;
        
      case 'OBRÁZEK':
      case 'IMAGE':
        // Najdi obrázek v datasetu
        const imgName = content.replace(/- HALF LAYOUT/i, '').trim();
        const img = dataSet.media?.images?.find(i => 
          i.title.toLowerCase().includes(imgName.toLowerCase()) ||
          imgName.toLowerCase().includes(i.title.toLowerCase())
        );
        blocks.push({
          id: generateBlockId(),
          type: 'image',
          order: order++,
          width: 'half',
          widthPercent: 50,
          content: {
            url: img?.url || '',
            alt: imgName,
            caption: imgName,
            size: 100,
            alignment: 'center',
          },
        });
        break;
        
      case 'MULTIPLE-CHOICE':
        const mcLines = content.split('\n').filter(l => l.trim());
        const question = mcLines[0]?.trim() || '';
        const options: any[] = [];
        const correctAnswers: string[] = [];
        
        mcLines.slice(1).forEach((line, i) => {
          const match = line.match(/^([A-D])\)\s*(.+)/i);
          if (match) {
            let optText = match[2].trim();
            const isCorrect = optText.endsWith('*');
            if (isCorrect) {
              optText = optText.slice(0, -1).trim();
            }
            const optId = `opt-${i}`;
            options.push({ id: optId, text: optText });
            if (isCorrect) correctAnswers.push(optId);
          }
        });
        
        if (question && options.length > 0) {
          blocks.push({
            id: generateBlockId(),
            type: 'multiple-choice',
            order: order++,
            width: 'full',
            content: {
              question,
              options,
              correctAnswers: correctAnswers.length > 0 ? correctAnswers : ['opt-0'],
              allowMultiple: false,
            },
          });
        }
        break;
        
      case 'FILL-BLANK':
        // Parsuj fill-blank: text s ___ = odpověď
        const fbMatch = content.match(/(.+?)=\s*(.+)/);
        if (fbMatch) {
          const textPart = fbMatch[1].trim();
          const answer = fbMatch[2].trim();
          // Rozděl text podle ___
          const parts = textPart.split(/___+/);
          const segments: any[] = [];
          parts.forEach((part, i) => {
            if (part) segments.push({ type: 'text', content: part });
            if (i < parts.length - 1) {
              segments.push({ type: 'blank', id: `blank-${order}-${i}`, correctAnswer: answer, acceptedAnswers: [answer] });
            }
          });
          blocks.push({
            id: generateBlockId(),
            type: 'fill-blank',
            order: order++,
            width: 'full',
            content: { instruction: '', segments },
          });
        }
        break;
        
      case 'FREE-ANSWER':
        blocks.push({
          id: generateBlockId(),
          type: 'free-answer',
          order: order++,
          width: 'full',
          content: { question: content, lines: 3 },
        });
        break;
        
      case 'CONNECT-PAIRS':
        const pairs: any[] = [];
        content.split('\n').forEach((line, i) => {
          const pairMatch = line.match(/(.+?)\s*\|\s*(.+)/);
          if (pairMatch) {
            pairs.push({
              id: `pair-${i}`,
              left: { id: `left-${i}`, type: 'text', content: pairMatch[1].trim() },
              right: { id: `right-${i}`, type: 'text', content: pairMatch[2].trim() },
            });
          }
        });
        if (pairs.length > 0) {
          blocks.push({
            id: generateBlockId(),
            type: 'connect-pairs',
            order: order++,
            width: 'full',
            content: { instruction: 'Spoj správné dvojice', pairs, shuffleSides: true },
          });
        }
        break;
    }
    
    currentContent = [];
    isHalfLayout = false;
  };
  
  // Parsuj řádek po řádku
  for (const line of lines) {
    // Detekuj typ bloku
    const typeMatch = line.match(/^(HEADER|FOOTER|HEADING-H1|HEADING|PARAGRAPH|INFOBOX|OBRÁZEK|IMAGE|MULTIPLE-CHOICE|FILL-BLANK|FREE-ANSWER|CONNECT-PAIRS|TABLE):\s*(.*)/i);
    
    if (typeMatch) {
      // Zpracuj předchozí blok
      processBlock();
      
      // Nový blok
      currentType = typeMatch[1];
      const rest = typeMatch[2]?.trim() || '';
      isHalfLayout = rest.toUpperCase().includes('HALF LAYOUT') || line.toUpperCase().includes('HALF LAYOUT');
      const cleanRest = rest.replace(/- HALF LAYOUT/i, '').replace(/HALF LAYOUT/i, '').trim();
      if (cleanRest) currentContent.push(cleanRest);
    } else if (line.trim() && currentType) {
      // Pokračování obsahu
      currentContent.push(line.trim());
    }
  }
  
  // Zpracuj poslední blok
  processBlock();
  
  // Pokud nejsou žádné bloky, přidej výchozí
  if (blocks.length === 0) {
    console.warn('[Worksheet Parser] No blocks parsed! Adding fallback.');
    blocks.push({
      id: generateBlockId(),
      type: 'heading',
      order: order++,
      width: 'full',
      content: { text: `${dataSet.topic} - Pracovní list`, level: 'h1' },
    });
  }
  
  console.log('[Worksheet Parser] Generated', blocks.length, 'blocks');
  console.log('[Worksheet Parser] Block types:', blocks.map(b => b.type).join(', '));
  
  return blocks;
}

// =====================================================
// TEXT GENERATOR
// =====================================================

async function generateText(dataSet: TopicDataSet): Promise<GenerateResult> {
  console.log('[Generator] Generating text...');
  
  const context = buildContext(dataSet);
  
  const feedback = getFeedbackForType('text');
  
  // Připravit seznam obrázků pro prompt - FILTROVAT VYLOUČENÉ a SEŘADIT PRIORITNÍ NA ZAČÁTEK
  const sortByPriority = (a: any, b: any) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0);
  
  const availableWebImages = (dataSet.media?.images || [])
    .filter((img: any) => !img.excluded)
    .sort(sortByPriority);
  const availableIllustrations = (dataSet.media?.generatedIllustrations || [])
    .filter((ill: any) => !ill.excluded)
    .sort(sortByPriority);
  const availablePhotos = (dataSet.media?.generatedPhotos || [])
    .filter((photo: any) => !photo.excluded)
    .sort(sortByPriority);
  
  // Prioritní položky označit hvězdičkou
  const formatItem = (item: any, nameKey: string) => {
    const name = item[nameKey] || 'Bez názvu';
    return item.priority ? `⭐ "${name}" (PRIORITNÍ - POUŽIJ!)` : `"${name}"`;
  };
  
  const imageList = availableWebImages.length > 0 
    ? `\n🖼️ DOSTUPNÉ OBRÁZKY Z WEBU (vyber 2-3 relevantní):\n${availableWebImages.map((img: any, i: number) => `  ${i + 1}. ${formatItem(img, 'title')}`).join('\n')}`
    : '';
    
  const illustrationList = availableIllustrations.length > 0
    ? `\n🎨 DOSTUPNÉ ILUSTRACE (preferuj tyto! vyber 3-4):\n${availableIllustrations.map((ill: any, i: number) => `  ${i + 1}. ${formatItem(ill, 'name')}`).join('\n')}`
    : '';
    
  const photoList = availablePhotos.length > 0
    ? `\n📷 DOSTUPNÉ FOTKY (vyber 1-2 relevantní):\n${availablePhotos.map((photo: any, i: number) => `  ${i + 1}. ${formatItem(photo, 'name')}`).join('\n')}`
    : '';
  
  const prompt = `Napiš PODROBNÝ výukový text k tématu "${dataSet.topic}" pro ${dataSet.grade}. třídu ZŠ.

${context}${feedback}${illustrationList}${photoList}${imageList}

FORMÁT TEXTU (NEZAČÍNEJ H1 nadpisem - ten je automaticky z názvu dokumentu):

## Podnadpis sekce 1
IlustraceH2: Název ilustrace ze seznamu (PREFERUJ - pro vygenerované ikony/ilustrace)
FotkaH2: Název fotky ze seznamu (pro vygenerované fotografie)
ObrázekH2: Název obrázku ze seznamu (pro fotky z webu - POUZE pokud nejsou lepší ilustrace/fotky)
Text odstavce (3-5 vět s konkrétními fakty a příklady)...

INFOBOX modrý: Věděli jste?
Zajímavost nebo překvapivý fakt.

## Podnadpis sekce 2
ObrázekH2: Název jiného obrázku
Další text odstavce s detaily...

## ... další sekce ...

## 📚 Důležité pojmy
- **Pojem 1** – stručná definice
- **Pojem 2** – stručná definice
- **Pojem 3** – stručná definice
(5-8 klíčových pojmů k tématu)

## 📅 Důležitá data
- **Rok/období** – co se stalo
- **Rok/období** – co se stalo
(3-5 důležitých dat, pokud jsou k tématu relevantní)

## 👤 Důležité osobnosti
- **Jméno** – kdo to byl a proč je důležitý (1 věta)
- **Jméno** – kdo to byl a proč je důležitý (1 věta)
(2-4 osobnosti, pokud jsou k tématu relevantní)

PRAVIDLA:
- 500-800 slov celkem (PODROBNĚJI!)
- 5-7 hlavních sekcí + 3 závěrečné sekce (pojmy, data, osobnosti)
- PREFERUJ ILUSTRACE (50%), pak FOTKY (30%), pak OBRÁZKY Z WEBU (20%)!
- IlustraceH2: [přesný název z 🎨 DOSTUPNÉ ILUSTRACE] - PŘEDNOSTNĚ POD H2 nadpis
- FotkaH2: [přesný název z 📷 DOSTUPNÉ FOTKY] - pro AI fotografie
- ObrázekH2: [přesný název z 🖼️ DOSTUPNÉ OBRÁZKY Z WEBU] - pouze jako doplněk
- U většiny H2 použij ilustraci nebo fotku, obrázky z webu jen výjimečně
- INFOBOX modrý: pro zajímavosti, "věděli jste?" (info)
- INFOBOX zelený: pro tipy a rady (tip)
- INFOBOX oranžový: pro upozornění (warning)
- INFOBOX fialový: pro shrnutí (summary)
- Srozumitelný jazyk pro ${dataSet.grade}. třídu
- Každý obrázek/ilustraci použij MAX 1x
- INFOBOX musí mít nadpis a text na dalším řádku
- VŽDY přidej závěrečné sekce: Důležité pojmy, Důležitá data, Důležité osobnosti`;

  try {
    const response = await chatWithAIProxy(
      [{ role: 'user', content: prompt }],
      'gemini-3.0-flash',
      { temperature: 0.7, max_tokens: 4096 }
    );
    
    console.log('[Generator] Raw text response:', response.substring(0, 500));
    
    // Extrahovat přiřazení obrázků k H2 nadpisům (nový formát: ObrázekH2: Název)
    const sectionImages: { heading: string; imageUrl: string; imageTitle: string }[] = [];
    const lines = response.split('\n');
    let currentH2 = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Najít H2 nadpis
      const h2Match = line.match(/^##\s*(.+)/);
      if (h2Match) {
        currentH2 = h2Match[1].trim();
      }
      
      // Najít ObrázekH2:, FotkaH2:, IlustraceH2: pod nadpisem
      const imgMatch = line.match(/^ObrázekH2:\s*(.+)/i);
      const illMatch = line.match(/^IlustraceH2:\s*(.+)/i);
      const photoMatch = line.match(/^FotkaH2:\s*(.+)/i);
      
      if (imgMatch && currentH2) {
        const imageName = imgMatch[1].trim().toLowerCase();
        // Filtrovat vyloučené obrázky
        const foundImage = dataSet.media?.images?.filter((img: any) => !img.excluded)?.find((img: any) => {
          const imgTitle = (img.title || '').toLowerCase();
          return imgTitle === imageName ||
                 imgTitle.includes(imageName) ||
                 imageName.includes(imgTitle) ||
                 imgTitle.replace(/[^a-z0-9]/g, '').includes(imageName.replace(/[^a-z0-9]/g, ''));
        });
        
        if (foundImage?.url) {
          sectionImages.push({
            heading: currentH2,
            imageUrl: foundImage.url,
            imageTitle: foundImage.title,
          });
          console.log('[Generator] Found image for H2:', currentH2, '->', foundImage.title);
        }
      } else if (illMatch && currentH2) {
        const illName = illMatch[1].trim().toLowerCase();
        // Filtrovat vyloučené ilustrace
        const foundIll = dataSet.media?.generatedIllustrations?.filter((ill: any) => !ill.excluded)?.find((ill: any) => {
          const name = (ill.name || '').toLowerCase();
          return name === illName ||
                 name.includes(illName) ||
                 illName.includes(name) ||
                 name.replace(/[^a-z0-9]/g, '').includes(illName.replace(/[^a-z0-9]/g, ''));
        });
        
        if (foundIll?.url) {
          sectionImages.push({
            heading: currentH2,
            imageUrl: foundIll.url,
            imageTitle: foundIll.name,
          });
          console.log('[Generator] Found illustration for H2:', currentH2, '->', foundIll.name);
        }
      } else if (photoMatch && currentH2) {
        const photoName = photoMatch[1].trim().toLowerCase();
        // Filtrovat vyloučené fotky
        const foundPhoto = dataSet.media?.generatedPhotos?.filter((photo: any) => !photo.excluded)?.find((photo: any) => {
          const name = (photo.name || '').toLowerCase();
          return name === photoName ||
                 name.includes(photoName) ||
                 photoName.includes(name) ||
                 name.replace(/[^a-z0-9]/g, '').includes(photoName.replace(/[^a-z0-9]/g, ''));
        });
        
        if (foundPhoto?.url) {
          sectionImages.push({
            heading: currentH2,
            imageUrl: foundPhoto.url,
            imageTitle: foundPhoto.name,
          });
          console.log('[Generator] Found photo for H2:', currentH2, '->', foundPhoto.name);
        }
      }
    }
    
    // Odstranit řádky s ObrázekH2:, IlustraceH2:, FotkaH2: z textu (obrázky jsou v sidebaru a galerii)
    let cleanedResponse = response.replace(/^ObrázekH2:.*$/gm, '');
    cleanedResponse = cleanedResponse.replace(/^IlustraceH2:.*$/gm, '');
    cleanedResponse = cleanedResponse.replace(/^FotkaH2:.*$/gm, '');
    
    // Odstranit H1 nadpis (název je v title dokumentu)
    cleanedResponse = cleanedResponse.replace(/^#\s+.+$/gm, '');
    
    // Převést INFOBOX na HTML callout (formát pro TipTap editor)
    // Mapování barev na typy callout
    const calloutTypeMap: Record<string, string> = {
      'modrý': 'info',
      'červený': 'danger',
      'zelený': 'tip',
      'oranžový': 'warning',
      'fialový': 'summary',
    };
    
    cleanedResponse = cleanedResponse.replace(
      /INFOBOX (modrý|červený|zelený|oranžový|fialový):\s*(.+?)(?:\n([^\n#]*))?(?=\n\n|\n##|$)/gim,
      (match, color, title, content) => {
        const calloutType = calloutTypeMap[color.toLowerCase()] || 'info';
        const contentText = content ? content.trim() : '';
        return `\n<div data-type="callout" data-callout-type="${calloutType}" class="callout callout-${calloutType}"><p><strong>${title.trim()}</strong></p>${contentText ? `<p>${contentText}</p>` : ''}</div>\n`;
      }
    );
    
    // Převést Markdown na HTML
    let html = markdownToHtml(cleanedResponse);
    
    // Přidat VŠECHNY obrázky, ilustrace a fotky do galerie na konec (s fullscreen možností)
    // Filtrovat vyloučené a seřadit prioritní na začátek
    const sortByPriorityGallery = (a: any, b: any) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0);
    
    const allImages = (dataSet.media?.images || [])
      .filter((img: any) => !img.excluded)
      .sort(sortByPriorityGallery);
    const allIllustrations = (dataSet.media?.generatedIllustrations || [])
      .filter((ill: any) => !ill.excluded)
      .sort(sortByPriorityGallery);
    const allPhotos = (dataSet.media?.generatedPhotos || [])
      .filter((photo: any) => !photo.excluded)
      .sort(sortByPriorityGallery);
    
    console.log('[Generator] Adding gallery with', allImages.length, 'web images,', allIllustrations.length, 'illustrations, and', allPhotos.length, 'photos');
    
    if (allImages.length > 0 || allIllustrations.length > 0 || allPhotos.length > 0) {
      html += '\n<h2>🖼️ Galerie</h2>\n';
      html += '<div class="image-gallery" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 16px;">';
      
      // Přidat všechny ilustrace PRVNÍ (prioritní)
      for (const ill of allIllustrations) {
        html += `<figure data-gallery-image data-image-url="${ill.url}" data-image-title="🎨 ${ill.name}" style="margin: 0; text-align: center; cursor: pointer;">`;
        html += `<img src="${ill.url}" alt="${ill.name}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />`;
        html += `<figcaption style="font-size: 12px; color: #666; margin-top: 4px;">🎨 ${ill.name}</figcaption>`;
        html += `</figure>`;
        
        if (!sectionImages.find(si => si.imageUrl === ill.url)) {
          sectionImages.push({
            heading: '🖼️ Galerie',
            imageUrl: ill.url,
            imageTitle: ill.name,
          });
        }
      }
      
      // Přidat všechny AI fotky DRUHÉ
      for (const photo of allPhotos) {
        html += `<figure data-gallery-image data-image-url="${photo.url}" data-image-title="📷 ${photo.name}" style="margin: 0; text-align: center; cursor: pointer;">`;
        html += `<img src="${photo.url}" alt="${photo.name}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />`;
        html += `<figcaption style="font-size: 12px; color: #666; margin-top: 4px;">📷 ${photo.name}</figcaption>`;
        html += `</figure>`;
        
        if (!sectionImages.find(si => si.imageUrl === photo.url)) {
          sectionImages.push({
            heading: '🖼️ Galerie',
            imageUrl: photo.url,
            imageTitle: photo.name,
          });
        }
      }
      
      // Přidat obrázky z webu POSLEDNÍ
      for (const img of allImages) {
        html += `<figure data-gallery-image data-image-url="${img.url}" data-image-title="🌐 ${img.title}" style="margin: 0; text-align: center; cursor: pointer;">`;
        html += `<img src="${img.url}" alt="${img.title}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />`;
        html += `<figcaption style="font-size: 12px; color: #666; margin-top: 4px;">🌐 ${img.title}</figcaption>`;
        html += `</figure>`;
        
        if (!sectionImages.find(si => si.imageUrl === img.url)) {
          sectionImages.push({
            heading: '🖼️ Galerie',
            imageUrl: img.url,
            imageTitle: img.title,
          });
        }
      }
      
      html += '</div>';
      
      // Jednoduchý CSS bez náročných transform efektů
      html += `<style>.image-gallery figure:hover { opacity: 0.9; }</style>`;
    }
    
    const docId = dataSet.id + '-text';
    
    // Vytvořit náhled pro okamžité zobrazení v DataSetu
    const newMaterial = {
      type: 'text',
      id: docId,
      title: dataSet.topic + ' - Učební text',
      status: 'draft',
      createdAt: new Date().toISOString()
    };
    
    const docData = {
      id: docId,
      title: dataSet.topic,
      content: html,
      documentType: 'lesson',
      sectionImages,
    };
    
    // Uložit pomocí standardní saveDocument funkce (stejně jako boardy používají saveQuiz)
    console.log('[Generator] 💾 Saving document:', { id: docId, title: docData.title, contentLength: docData.content?.length });
    
    try {
      // 1. Uložit do localStorage pro okamžitý přístup
      saveDocument(
        {
          id: docId,
          title: dataSet.topic,
          name: dataSet.topic,
          type: 'document',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        docData // content s sectionImages
      );
      
      console.log(`[Generator] ✅ Document saved to localStorage: ${docId}`);
      
      // 2. KRITICKÉ: Synchronně uložit do Supabase (nepoléhat na queue!)
      const syncResult = await syncDocumentDirectToSupabase({
        id: docId,
        title: dataSet.topic,
        content: html,
        documentType: 'lesson',
        sectionImages: sectionImages,
      });
      
      if (syncResult) {
        console.log(`[Generator] ✅ Document synced to Supabase: ${docId}`);
    } else {
        console.warn(`[Generator] ⚠️ Supabase sync failed for ${docId}, will retry via queue`);
      }
      
      // Ověřit localStorage
      const verification = localStorage.getItem(`vivid-doc-${docId}`);
      console.log('[Generator] 💾 localStorage verification:', verification ? 'SUCCESS' : 'FAILED');
    } catch (e) {
      console.error(`[Generator] ❌ saveDocument failed for ${docId}:`, e);
      
      // Fallback: přímé uložení do localStorage
      try {
        localStorage.setItem(`vivid-doc-${docId}`, JSON.stringify(docData));
        console.log(`[Generator] ✅ Fallback localStorage save OK for ${docId}`);
      } catch (e2) {
        console.error(`[Generator] ❌ Fallback also failed:`, e2);
      }
    }
    
    console.log('[Generator] Text saved with', sectionImages.length, 'sectionImages (including gallery)');
    
    // Vytvořit textový náhled - zachovat strukturu
    const preview = response
      .replace(/^ObrázekH2:\s*(.+)$/gm, '🖼️ [$1]')
      .replace(/INFOBOX (modrý|červený):\s*/gi, '📦 INFOBOX: ');
    
    console.log('[Generator] Text saved:', docId);
    return { success: true, id: docId, preview };
  } catch (err) {
    console.error('[Generator] Text error:', err);
    return { success: false, error: String(err) };
  }
}

function markdownToHtml(markdown: string): string {
  return markdown
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p><p>')
    // Nepřevádět řádky které už jsou HTML (začínají na <)
    .replace(/^(?!<[a-z])(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '')
    // Odstranit prázdné <p> tagy okolo figure a div elementů
    .replace(/<p>(<figure.*?<\/figure>)<\/p>/gs, '$1')
    .replace(/<p>(<div.*?<\/div>)<\/p>/gs, '$1');
}

// =====================================================
// TEST GENERATOR
// =====================================================

async function generateTest(dataSet: TopicDataSet): Promise<GenerateResult> {
  console.log('[Generator] Generating test...');
  
  const context = buildContext(dataSet);
  
  const feedback = getFeedbackForType('test');
  
  // Připravit seznamy obrázků a ilustrací
  const images = dataSet.media?.images || [];
  const illustrations = dataSet.media?.generatedIllustrations || [];
  
  let mediaSection = '';
  if (images.length > 0) {
    mediaSection += `\n🖼️ DOSTUPNÉ OBRÁZKY:\n${images.map((img, i) => `  ${i + 1}. "${img.title}"`).join('\n')}`;
  }
  if (illustrations.length > 0) {
    mediaSection += `\n🎨 DOSTUPNÉ ILUSTRACE:\n${illustrations.map((ill, i) => `  ${i + 1}. "${ill.name}"`).join('\n')}`;
  }
  
  console.log(`[Generator] Test media: ${images.length} images, ${illustrations.length} illustrations`);
  
  // Pokud je feedback, použij ho jako hlavní instrukci
  const defaultInstructions = feedback 
    ? '' // Nechť feedback určí typ otázek
    : `\nVytvoř:
- 3 ABC otázky
- 2 otevřené otázky`;
  
  const prompt = `Vytvoř písemku k tématu "${dataSet.topic}" pro ${dataSet.grade}. třídu.

${context}
${feedback ? feedback : ''}
${mediaSection}
${defaultInstructions}

Formát odpovědi:
Pro ABC otázku:
OTÁZKA X (ABC):
[text otázky]
OBRÁZEK: [název obrázku/ilustrace ze seznamu - volitelné]
A) [možnost]
B) [možnost *pokud správná]
C) [možnost]

Pro ABC otázku s obrázkem (Co je na obrázku?):
OTÁZKA X (ABC):
Co je na tomto obrázku?
OBRÁZEK: Řecká helma hoplíta
A) Špatná odpověď
B) Správná odpověď *
C) Špatná odpověď
D) Špatná odpověď

Pro otevřenou otázku:
OTÁZKA X (OTEVŘENÁ):
[otázka vyžadující zamyšlení a vlastní odpověď]

PRAVIDLA PRO OBRÁZKY:
- Používej PŘESNÉ názvy obrázků (🖼️) nebo ilustrací (🎨) ze seznamu výše
- Přidej obrázek/ilustraci k 1-2 ABC otázkám
- Minimálně 1 otázka by měla být typu "Co je na tomto obrázku?" nebo "Co vidíš na ilustraci?"
- U otevřených otázek obrázky nepoužívej`;

  console.log('[Generator] Test prompt:', prompt);

  try {
    const response = await chatWithAIProxy(
      [{ role: 'user', content: prompt }],
      'gemini-3.0-flash',
      { temperature: 0.7, max_tokens: 2048 }
    );
    
    const slides = parseTextToTestSlides(response, dataSet);
    
    const quizId = `test-${Date.now()}`;
    
    const quiz: Quiz = {
      id: quizId,
      title: `Písemka: ${dataSet.topic}`,
      slides,
      settings: {
        showPoints: true,
        allowBack: false,
        shuffleSlides: false,
        shuffleOptions: true,
        timeLimit: 30,
        passingScore: 50,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Uložit - localStorage může selhat, proto přímý sync do Supabase
    try {
      saveQuiz(quiz);
    } catch (e) {
      console.warn(`[Generator] localStorage failed for test ${quizId}:`, e);
    }
    
    // Přímý sync do Supabase
    const synced = await syncQuizDirectToSupabase(quiz);
    if (!synced) {
      console.warn(`[Generator] Supabase sync failed for test ${quizId}`);
    }
    
    // Vytvořit textový náhled
    const preview = slides.slice(1).map((slide, i) => {
      const s = slide as any;
      const imageUrl = s.media?.url;
      const imageText = imageUrl ? `\n🖼️ Obrázek: ${imageUrl.split('/').pop()?.split('?')[0] || 'přiložen'}` : '';
      
      if (s.question && s.options) {
        const optionsText = s.options.map((o: any) => 
          `${o.label}) ${o.content}${o.isCorrect ? ' ✓' : ''}`
        ).join('\n');
        return `**Otázka ${i + 1}:** ${s.question}${imageText}\n${optionsText}`;
      } else if (s.question) {
        return `**Otázka ${i + 1} (otevřená):** ${s.question}`;
      }
      return '';
    }).filter(Boolean).join('\n\n');
    
    console.log('[Generator] Test saved:', quizId);
    return { success: true, id: quizId, preview };
  } catch (err) {
    console.error('[Generator] Test error:', err);
    return { success: false, error: String(err) };
  }
}

function parseTextToTestSlides(text: string, dataSet: TopicDataSet): QuizSlide[] {
  const slides: QuizSlide[] = [];
  
  // Header slide
  slides.push({
    ...createInfoSlide(0, 'title-content'),
    title: `✏️ Písemka: ${dataSet.topic}`,
    content: `<p><strong>Jméno:</strong> _________________</p><p><strong>Třída:</strong> ${dataSet.grade}._____</p>`,
  } as any);
  
  // Parsovat otázky
  const questionBlocks = text.split(/OTÁZKA\s*\d+/i).filter(block => block.trim());
  
  questionBlocks.forEach((block, index) => {
    const lines = block.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) return;
    
    const firstLine = lines[0].toLowerCase();
    
    // Hledat obrázek nebo ilustraci v bloku
    let questionImage: string | undefined = undefined;
    for (const line of lines) {
      const imageMatch = line.match(/^OBRÁZEK:\s*(.+)/i);
      if (imageMatch) {
        const imageName = imageMatch[1].trim().toLowerCase();
        
        // Hledat v obrázcích
        const foundImage = dataSet.media?.images?.find(img => {
          const imgTitle = (img.title || '').toLowerCase();
          return imgTitle === imageName ||
                 imgTitle.includes(imageName) ||
                 imageName.includes(imgTitle) ||
                 imgTitle.replace(/[^a-z0-9]/g, '').includes(imageName.replace(/[^a-z0-9]/g, '')) ||
                 imageName.replace(/[^a-z0-9]/g, '').includes(imgTitle.replace(/[^a-z0-9]/g, ''));
        });
        
        if (foundImage?.url) {
          questionImage = foundImage.url;
          console.log('[Parser] ✅ Test found image:', imageName);
        } else {
          // Hledat v ilustracích
          const foundIll = dataSet.media?.generatedIllustrations?.find(ill => {
            const illName = (ill.name || '').toLowerCase();
            return illName === imageName ||
                   illName.includes(imageName) ||
                   imageName.includes(illName) ||
                   illName.replace(/[^a-z0-9]/g, '').includes(imageName.replace(/[^a-z0-9]/g, '')) ||
                   imageName.replace(/[^a-z0-9]/g, '').includes(illName.replace(/[^a-z0-9]/g, ''));
          });
          
          if (foundIll?.url) {
            questionImage = foundIll.url;
            console.log('[Parser] ✅ Test found illustration:', imageName, '->', foundIll.name);
          }
        }
      }
    }
    
    if (firstLine.includes('abc') || firstLine.includes('vyber')) {
      // ABC otázka
      const questionText = lines[1]?.trim() || '';
      const options: { id: string; label: string; content: string; isCorrect: boolean }[] = [];
      
      lines.slice(2).forEach((line) => {
        const match = line.match(/^([A-D])\)\s*(.+)/i);
        if (match) {
          let content = match[2].trim();
          const isCorrect = content.endsWith('*');
          if (isCorrect) content = content.slice(0, -1).trim();
          options.push({
            id: match[1].toLowerCase(),
            label: match[1].toUpperCase(),
            content,
            isCorrect,
          });
        }
      });
      
      if (!options.some(o => o.isCorrect) && options.length > 0) {
        options[0].isCorrect = true;
      }
      
      if (questionText && options.length >= 2) {
        slides.push({
          ...createABCSlide(slides.length),
          question: questionText,
          options,
          points: 1,
          // Přidat obrázek pokud byl nalezen
          ...(questionImage ? { media: { type: 'image' as const, url: questionImage } } : {}),
        });
      }
    } else if (firstLine.includes('otevřen') || firstLine.includes('odpověz')) {
      // Otevřená otázka
      const questionText = lines[1]?.trim() || lines[0].replace(/\([^)]+\)/g, '').trim();
      if (questionText) {
        slides.push({
          ...createOpenSlide(slides.length),
          question: questionText,
          correctAnswers: [],
          points: 3,
        });
      }
    }
  });
  
  return slides;
}

// =====================================================
// LESSON GENERATOR - E-U-R
// =====================================================

async function generateLesson(dataSet: TopicDataSet): Promise<GenerateResult> {
  console.log('[Generator] Generating E-U-R lesson...');
  
  const context = buildContext(dataSet);
  
  const feedback = getFeedbackForType('lesson');
  
  // Připravit seznamy obrázků a ilustrací - více vizuálů
  const images = dataSet.media?.images || [];
  const illustrations = dataSet.media?.generatedIllustrations || [];
  const allVisuals = [
    ...images.slice(0, 8).map(i => `🖼️ "${i.title}"`),
    ...illustrations.slice(0, 5).map(i => `🎨 "${i.name}"`)
  ];
  
  // Extrahovat klíčové pojmy pro návrh metodického tématu
  const keyTermsList = dataSet.content?.keyTerms?.slice(0, 5).map(t => t.term).join(', ') || '';
  const factsList = dataSet.content?.keyFacts?.slice(0, 3).join('; ') || '';
  
  const prompt = `Vytvoř BADATELSKOU E-U-R lekci o tématu "${dataSet.topic}" pro ${dataSet.grade}. třídu.

PRVNÍ KROK - VYBER JEDNO SILNÉ METODICKÉ TÉMA:
Na základě kontextu níže vyber JEDNO konkrétní metodické/badatelské téma, které:
- Je relevantní k "${dataSet.topic}" (NE obecné téma jako "demokracie" pokud to není přímo součást látky!)
- Umožňuje badatelský přístup (žáci mohou něco objevit, zjistit, přijít na to)
- Je zajímavé a provokuje k diskuzi
- Vychází z konkrétních pojmů/faktů: ${keyTermsList}

KONTEXT:
${context}${feedback}

POVINNÁ STRUKTURA (10 slidů):

INFO: 🎯 [Název lekce vycházející z vybraného metodického tématu]
OBRÁZEK: [vyber z dostupných vizuálů]
[1-2 motivační věty - proč je TOTO téma zajímavé pro žáky]

HLASOVÁNÍ: [Provokativní otázka kde žáci TIPUJÍ odpověď - musí se vztahovat k metodickému tématu]

NÁSTĚNKA: [Brainstorming otázka k metodickému tématu]

INFO: 📚 [Nadpis první části - souvisí s metodickým tématem]
OBRÁZEK: [vyber z dostupných vizuálů]
[2-3 věty s klíčovými informacemi]

ABC: [Otázka ověřující porozumění]
OBRÁZEK: [volitelně - pro vizuální otázku]
A) [možnost]
B) [správná odpověď] *
C) [možnost]
D) [možnost]

NÁSTĚNKA: [Diskuzní otázka k tématu]

INFO: 💡 [Zajímavost nebo překvapivý fakt]
OBRÁZEK: [vyber z dostupných vizuálů]
[2-3 věty]

HLASOVÁNÍ: [Názorová otázka]
MOŽNOSTI: Určitě ano | Spíše ano | Spíše ne | Určitě ne

ABC: [Další otázka]
OBRÁZEK: [vyber z dostupných vizuálů]
A) [možnost]
B) [možnost]
C) [správná odpověď] *
D) [možnost]

NÁSTĚNKA: [Reflexe - co jsme zjistili?]

INFO: ✅ Shrnutí
OBRÁZEK: [volitelně]
[3 klíčové body]

DOSTUPNÉ VIZUÁLY (použij 5-7 z nich!):
${allVisuals.join('\n')}

PRAVIDLA:
- Každý slide MUSÍ začínat: INFO: nebo HLASOVÁNÍ: nebo NÁSTĚNKA: nebo ABC:
- OBRÁZEK: přidej ke 4-5 slidům (INFO i ABC) - použij PŘESNÝ název z výše!
- Lekce musí být o konkrétním tématu "${dataSet.topic}", NE o obecných pojmech!
- Metodické téma vyber na základě faktů: ${factsList}
- MOŽNOSTI: jen u HLASOVÁNÍ kde chceš vlastní odpovědi
- ABC musí mít 4 možnosti, správná má * na konci`;

  try {
    const response = await chatWithAIProxy(
      [{ role: 'user', content: prompt }],
      'gemini-3.0-flash',
      { temperature: 0.7, max_tokens: 2048 }
    );
    
    const slides = parseTextToLessonSlides(response, dataSet);
    
    const quizId = `lesson-${Date.now()}`;
    
    const quiz: Quiz = {
      id: quizId,
      title: `Lekce: ${dataSet.topic}`,
      slides,
      settings: {
        showPoints: false,
        allowBack: true,
        shuffleSlides: false,
        shuffleOptions: false,
        timeLimit: null,
        passingScore: null,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Uložit - localStorage může selhat, proto přímý sync do Supabase
    try {
      saveQuiz(quiz);
    } catch (e) {
      console.warn(`[Generator] localStorage failed for lesson ${quizId}:`, e);
    }
    
    // Přímý sync do Supabase
    const synced = await syncQuizDirectToSupabase(quiz);
    if (!synced) {
      console.warn(`[Generator] Supabase sync failed for lesson ${quizId}`);
    }
    
    // Vytvořit textový náhled
    const preview = slides.map((slide, i) => {
      const s = slide as any;
      const phaseLabel = i < 3 ? '🔵 EVOKACE' : (i < slides.length - 2 ? '🟢 UVĚDOMĚNÍ' : '🟣 REFLEXE');
      
      if (s.type === 'info') {
        const hasImage = s.layout?.blocks?.some((b: any) => b.type === 'image');
        const imgIcon = hasImage ? ' 🖼️' : '';
        const bgIcon = s.background ? ' 🎨' : '';
        return `${phaseLabel} | 📚 **${s.title || 'Info'}**${imgIcon}${bgIcon}\n${s.content?.replace(/<[^>]+>/g, '') || ''}`;
      } else if (s.activityType === 'voting') {
        return `${phaseLabel} | 📊 **Hlasování:** ${s.question}\n${s.options?.map((o: any) => `   ${o.label}) ${o.content}`).join('\n') || ''}`;
      } else if (s.activityType === 'board') {
        const imgIcon = s.questionImage ? ' 🖼️' : '';
        return `${phaseLabel} | 💬 **Nástěnka:**${imgIcon} ${s.question}`;
      } else if (s.activityType === 'abc') {
        const imgIcon = s.media?.url ? ' 🖼️' : '';
        return `${phaseLabel} | ❓ **ABC:**${imgIcon} ${s.question}\n${s.options?.map((o: any) => `   ${o.label}) ${o.content}${o.isCorrect ? ' ✓' : ''}`).join('\n') || ''}`;
      } else if (s.question) {
        return `${phaseLabel} | 💬 ${s.question}`;
      }
      return '';
    }).filter(Boolean).join('\n\n');
    
    console.log('[Generator] Lesson saved:', quizId);
    return { success: true, id: quizId, preview };
  } catch (err) {
    console.error('[Generator] Lesson error:', err);
    return { success: false, error: String(err) };
  }
}

function parseTextToLessonSlides(text: string, dataSet: TopicDataSet): QuizSlide[] {
  const slides: QuizSlide[] = [];
  
  // Předčistit text - odstranit SLIDE markery, markdown, HTML tagy
  let cleanedText = text
    // Odstranit SLIDE markery ve všech formátech
    .replace(/\*\*SLIDE\s*\d+[^*]*\*\*/gi, '\n')
    .replace(/SLIDE\s*\d+[:\-–]\s*[^\n]*/gi, '\n')
    // Odstranit markdown bold/italic
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    // Odstranit HTML tagy
    .replace(/<\/?p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    // Odstranit separátory
    .replace(/---+/g, '\n')
    // Odstranit emoji před OBRÁZEK
    .replace(/🎨\s*OBRÁZEK:/gi, 'OBRÁZEK:')
    .replace(/🖼️\s*OBRÁZEK:/gi, 'OBRÁZEK:')
    // Vyčistit prázdné řádky
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  console.log('[Lesson Parser] Cleaned text preview:', cleanedText.substring(0, 300));
  
  // Rozdělit na bloky – delší varianty první (NÁSTĚNKA PRO A PROTI před NÁSTĚNKA, HLASOVÁNÍ OD-DO před HLASOVÁNÍ)
  const blockPattern = /(?=^INFO:|^NÁSTĚNKA PRO A PROTI:|^NÁSTĚNKA ÚKOL:|^NÁSTĚNKA:|^HLASOVÁNÍ OD-DO:|^HLASOVÁNÍ ZPĚTNÁ VAZBA:|^HLASOVÁNÍ:|^ABC:|^KVÍZ-VÝBĚR:|^KVÍZ:)/mi;
  const blocks = cleanedText.split(blockPattern).filter(block => block.trim());
  
  console.log('[Lesson Parser] Found', blocks.length, 'blocks');
  
  // Mapování barev pozadí
  const backgroundColors: Record<string, string> = {
    'blue': '#E3F2FD',
    'green': '#E8F5E9',
    'purple': '#F3E5F5',
    'orange': '#FFF3E0',
    'pink': '#FCE4EC',
    'yellow': '#FFFDE7',
  };
  
  blocks.forEach((block) => {
    const lines = block.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) return;
    
    const firstLine = lines[0].trim();
    
    // Extrahovat metadata z bloku
    let imageUrl: string | undefined;
    let bgColor: string | undefined;
    let customOptions: string[] = [];
    
    for (const line of lines) {
      // Obrázek nebo ilustrace
      const imgMatch = line.match(/^OBRÁZEK:\s*(.+)/i);
      if (imgMatch) {
        const imageName = imgMatch[1].trim().toLowerCase();
        
        // Hledat v obrázcích
        const foundImage = dataSet.media?.images?.find(img => {
          const imgTitle = (img.title || '').toLowerCase();
          return imgTitle.includes(imageName) || imageName.includes(imgTitle) ||
                 imgTitle.replace(/[^a-z0-9]/g, '').includes(imageName.replace(/[^a-z0-9]/g, ''));
        });
        
        if (foundImage?.url) {
          imageUrl = foundImage.url;
        } else {
          // Hledat v ilustracích
          const foundIll = dataSet.media?.generatedIllustrations?.find(ill => {
            const illName = (ill.name || '').toLowerCase();
            return illName.includes(imageName) || imageName.includes(illName) ||
                   illName.replace(/[^a-z0-9]/g, '').includes(imageName.replace(/[^a-z0-9]/g, ''));
          });
          
          if (foundIll?.url) {
            imageUrl = foundIll.url;
            console.log('[Parser] ✅ Lesson found illustration:', imageName, '->', foundIll.name);
          }
        }
      }
      
      // Pozadí
      const bgMatch = line.match(/^POZADÍ:\s*(.+)/i);
      if (bgMatch) {
        const colorName = bgMatch[1].trim().toLowerCase();
        bgColor = backgroundColors[colorName] || colorName;
      }
      
      // Vlastní možnosti pro hlasování
      const optMatch = line.match(/^MOŽNOSTI:\s*(.+)/i);
      if (optMatch) {
        customOptions = optMatch[1].split('|').map(o => o.trim());
      }
    }
    
    // === INFO ===
    if (firstLine.match(/^INFO:/i)) {
      const title = firstLine.replace(/^INFO:\s*/i, '').trim();
      let content = '';
      
      for (let j = 1; j < lines.length; j++) {
        if (!lines[j].match(/^(OBRÁZEK|POZADÍ|MOŽNOSTI):/i)) {
          content += lines[j].trim() + ' ';
        }
      }
      
      console.log('[Lesson Parser] Creating INFO slide:', title, imageUrl ? '(with image)' : '');
      
      // Vytvořit slide - s 2 sloupci pokud je obrázek
      const layoutType = imageUrl ? 'title-2cols' : 'title-content';
      const slide: any = createInfoSlide(slides.length, layoutType as any);
      
      // Nastavit title a content do bloků
      if (slide.layout?.blocks) {
        // Blok 0 = title
        if (slide.layout.blocks[0]) {
          slide.layout.blocks[0].content = title || dataSet.topic;
        }
        // Blok 1 = content (text)
        if (slide.layout.blocks[1]) {
          slide.layout.blocks[1].content = content.trim();
        }
        // Blok 2 = obrázek (pokud je 2 sloupce)
        if (imageUrl && slide.layout.blocks[2]) {
          slide.layout.blocks[2].type = 'image';
          slide.layout.blocks[2].content = imageUrl;
        }
      }
      
      slide.title = title || dataSet.topic;
      slide.content = content.trim();
      
      if (bgColor) {
        slide.background = { type: 'color', value: bgColor };
      }
      
      slides.push(slide);
      return;
    }
    
    // === HLASOVÁNÍ ZPĚTNÁ VAZBA === (na konec lekce)
    if (firstLine.match(/^HLASOVÁNÍ ZPĚTNÁ VAZBA:/i)) {
      const question = firstLine.replace(/^HLASOVÁNÍ ZPĚTNÁ VAZBA:\s*/i, '').trim();
      console.log('[Lesson Parser] Creating VOTING feedback slide:', question);
      slides.push({
        ...createVotingSlide(slides.length, 'feedback'),
        question: question || 'Jak se vám v této lekci dařilo?',
        showResultsToStudents: true,
        feedbackStyle: 'emoji',
      } as any);
      return;
    }
    
    // === HLASOVÁNÍ OD-DO === (škála)
    if (firstLine.match(/^HLASOVÁNÍ OD-DO:/i)) {
      const question = firstLine.replace(/^HLASOVÁNÍ OD-DO:\s*/i, '').trim();
      let scaleMinLabel = 'Určitě ne';
      let scaleMaxLabel = 'Určitě ano';
      for (const line of lines.slice(1)) {
        const odMatch = line.match(/^Od:\s*(.+)/i);
        const doMatch = line.match(/^Do:\s*(.+)/i);
        if (odMatch) scaleMinLabel = odMatch[1].trim();
        if (doMatch) scaleMaxLabel = doMatch[1].trim();
      }
      console.log('[Lesson Parser] Creating VOTING scale slide:', question);
      const scaleSlide = createVotingSlide(slides.length, 'scale');
      slides.push({
        ...scaleSlide,
        question: question || 'Jak byste ohodnotili?',
        scaleMinLabel,
        scaleMaxLabel,
        showResultsToStudents: true,
      } as any);
      return;
    }
    
    // === HLASOVÁNÍ === (klasické A/B/C – možnosti musí odpovídat otázce!)
    if (firstLine.match(/^HLASOVÁNÍ:/i)) {
      const question = firstLine.replace(/^HLASOVÁNÍ:\s*/i, '').trim();
      // Parsovat možnosti z řádků A) B) C) D) (stejně jako u KVÍZ)
      const votingOptions: { id: string; label: string; content: string }[] = [];
      for (const line of lines) {
        const match = line.match(/^([A-D])\)\s*(.+)/i);
        if (match) {
          const content = match[2].trim().replace(/\*/g, '').trim();
          votingOptions.push({
            id: match[1].toLowerCase(),
            label: match[1].toUpperCase(),
            content,
          });
        }
      }
      const options =
        votingOptions.length >= 2
          ? votingOptions
          : customOptions.length >= 2
            ? customOptions.map((opt, i) => ({
                id: String.fromCharCode(97 + i),
                label: String.fromCharCode(65 + i),
                content: opt,
              }))
            : [
                { id: 'a', label: 'A', content: 'Ano' },
                { id: 'b', label: 'B', content: 'Ne' },
                { id: 'c', label: 'C', content: 'Nevím' },
              ];
      console.log('[Lesson Parser] Creating VOTING slide:', question, 'options:', options.length);
      slides.push({
        ...createVotingSlide(slides.length, 'single'),
        question,
        options,
        showResultsToStudents: true,
      } as any);
      return;
    }
    
    // === NÁSTĚNKA PRO A PROTI ===
    if (firstLine.match(/^NÁSTĚNKA PRO A PROTI:/i)) {
      const question = firstLine.replace(/^NÁSTĚNKA PRO A PROTI:\s*/i, '').trim();
      console.log('[Lesson Parser] Creating BOARD pros-cons slide:', question);
      slides.push({
        ...createBoardSlide(slides.length),
        question: question || 'Argumenty pro a proti',
        boardType: 'pros-cons',
        leftColumnLabel: 'Pro',
        rightColumnLabel: 'Proti',
        allowMedia: true,
        allowAnonymous: false,
      } as any);
      return;
    }
    
    // === NÁSTĚNKA ÚKOL === (krátký úkol, společná prezentace)
    if (firstLine.match(/^NÁSTĚNKA ÚKOL:/i)) {
      const question = firstLine.replace(/^NÁSTĚNKA ÚKOL:\s*/i, '').trim();
      console.log('[Lesson Parser] Creating BOARD presentation slide:', question);
      slides.push({
        ...createBoardSlide(slides.length),
        question: question || 'Krátký úkol – výsledky na nástěnku',
        boardType: 'presentation',
        allowMedia: true,
        allowAnonymous: false,
      } as any);
      return;
    }
    
    // === NÁSTĚNKA === (diskuze / brainstorming)
    if (firstLine.match(/^NÁSTĚNKA:/i)) {
      const question = firstLine.replace(/^NÁSTĚNKA:\s*/i, '').trim();
      console.log('[Lesson Parser] Creating BOARD slide:', question);
      
      slides.push({
        ...createBoardSlide(slides.length),
        question,
        boardType: 'text',
        allowMedia: true,
        allowAnonymous: false,
      } as any);
      return;
    }
    
    // === ABC / KVÍZ-VÝBĚR / KVÍZ ===
    if (firstLine.match(/^(ABC|KVÍZ-VÝBĚR|KVÍZ):/i)) {
      const question = firstLine.replace(/^(ABC|KVÍZ-VÝBĚR|KVÍZ):\s*/i, '').trim();
      console.log('[Lesson Parser] Creating ABC/KVÍZ slide:', question);
      const options: { id: string; label: string; content: string; isCorrect: boolean }[] = [];
      
      for (const line of lines) {
        const match = line.match(/^([A-D])\)\s*(.+)/i);
        if (match) {
          let content = match[2].trim();
          // Správná odpověď: hvězdička * NEBO text (správně), (správná), - správně, correct
          const hasStar = content.endsWith('*') || content.includes('*');
          const hasCorrectLabel = /\s*\(správn[áeě]\)|\s*-\s*správn[áeě]|\s*\(correct\)/i.test(content) || /správná odpověď/i.test(content);
          const isCorrect = hasStar || hasCorrectLabel;
          content = content
            .replace(/\*/g, '')
            .replace(/\s*\(správn[áeě]\)/gi, '')
            .replace(/\s*-\s*správn[áeě]/gi, '')
            .replace(/\s*\(correct\)/gi, '')
            .replace(/správná odpověď/gi, '')
            .trim();
          options.push({
            id: match[1].toLowerCase(),
            label: match[1].toUpperCase(),
            content,
            isCorrect,
          });
        }
      }
      
      // Pokud žádná možnost není označená jako správná, neoznačuj automaticky A – nech žádnou (nebo poslední s isCorrect)
      const anyCorrect = options.some(o => o.isCorrect);
      if (!anyCorrect && options.length > 0) {
        // Žádný fallback na A – necháme všechny false (v UI se pak může zobrazit jako bez správné odpovědi),
        // nebo můžeme označit prostřední jako „pravděpodobně“ – raději neoznačovat, aby bylo vidět, že AI neoznačila.
        // Pro zobrazení v kvízu musí být právě jedna true: některé systémy to vyžadují. Označíme první jen jako last resort.
        options[0].isCorrect = true;
        console.warn('[Lesson Parser] ABC: žádná správná odpověď označená (* nebo správně), použita A jako fallback');
      }
      // Pokud je označených víc než jedna, nech jen první označenou
      const correctCount = options.filter(o => o.isCorrect).length;
      if (correctCount > 1) {
        let first = true;
        for (const o of options) {
          if (o.isCorrect) {
            if (!first) o.isCorrect = false;
            first = false;
          }
        }
      }
      
      if (question && options.length >= 2) {
        slides.push({
          ...createABCSlide(slides.length),
          question,
          options,
          points: 1,
          ...(imageUrl ? { media: { type: 'image' as const, url: imageUrl } } : {}),
        });
      }
    }
  });
  
  // Pokud nejsou žádné slidy, vytvořit základní E-U-R strukturu
  if (slides.length === 0) {
    // Evokace - úvodní slide
    const introSlide: any = createInfoSlide(0, 'title-content');
    if (introSlide.layout?.blocks) {
      introSlide.layout.blocks[0].content = `🎯 ${dataSet.topic}`;
      introSlide.layout.blocks[1].content = `<p>Vítejte v badatelské lekci! Dnes společně objevíme téma: ${dataSet.topic}.</p>`;
    }
    introSlide.title = `🎯 ${dataSet.topic}`;
    introSlide.content = `<p>Vítejte v badatelské lekci! Dnes společně objevíme téma: ${dataSet.topic}.</p>`;
    slides.push(introSlide);
    
    // Evokace - hlasování
    slides.push({
      ...createVotingSlide(1, 'single'),
      question: `Co už víte o tématu ${dataSet.topic}?`,
      options: [
        { id: 'a', label: 'A', content: 'Hodně toho vím' },
        { id: 'b', label: 'B', content: 'Něco vím' },
        { id: 'c', label: 'C', content: 'Skoro nic' },
      ],
      showResults: true,
    } as any);
    
    // Evokace - nástěnka
    slides.push({
      ...createBoardSlide(2),
      question: `Co vás napadá, když se řekne "${dataSet.topic}"? 🤔`,
      boardType: 'text',
      allowMedia: true,
    } as any);
    
    // Uvědomění - klíčové informace
    if (dataSet.content?.keyFacts?.[0]) {
      const infoSlide: any = createInfoSlide(3, 'title-content');
      if (infoSlide.layout?.blocks) {
        infoSlide.layout.blocks[0].content = `📚 Klíčové informace`;
        infoSlide.layout.blocks[1].content = `<p>${dataSet.content.keyFacts.slice(0, 3).join(' ')}</p>`;
      }
      infoSlide.title = `📚 Klíčové informace`;
      infoSlide.content = `<p>${dataSet.content.keyFacts.slice(0, 3).join(' ')}</p>`;
      infoSlide.background = { type: 'color', value: '#E3F2FD' };
      slides.push(infoSlide);
    }
    
    // Reflexe - nástěnka
    slides.push({
      ...createBoardSlide(slides.length),
      question: `Co nového jste se dnes dozvěděli? Co vás překvapilo?`,
      boardType: 'text',
      allowMedia: false,
    } as any);
    
    // Reflexe - shrnutí
    const summarySlide: any = createInfoSlide(slides.length, 'title-content');
    if (summarySlide.layout?.blocks) {
      summarySlide.layout.blocks[0].content = '✅ Shrnutí';
      summarySlide.layout.blocks[1].content = `<p>Dnes jsme společně prozkoumali téma ${dataSet.topic}. Skvělá práce!</p>`;
    }
    summarySlide.title = '✅ Shrnutí';
    summarySlide.content = `<p>Dnes jsme společně prozkoumali téma ${dataSet.topic}. Skvělá práce!</p>`;
    slides.push(summarySlide);
  }
  
  return slides;
}

// =====================================================
// MULTIPLE LESSONS GENERATOR - Více lekcí na podtémata
// =====================================================

async function generateMultipleLessons(dataSet: TopicDataSet): Promise<GenerateResult> {
  console.log('[Generator] Generating multiple E-U-R lessons...');
  
  const context = buildContext(dataSet);
  const content = dataSet.content as any;
  const userTopics: string[] = content?.lessonTopics || [];
  const userBrief: string = (content?.lessonBrief || '').trim();

  let subtopics: string[] = [];

  // Režim podle zadání autora: jedna lekce na vybraná témata + popis
  if (userTopics.length > 0 || userBrief) {
    const singleTopic = userTopics.length > 0 ? userTopics[0] : dataSet.topic;
    subtopics = [singleTopic];
    console.log('[Generator] User-directed lesson, topic:', singleTopic, 'brief:', userBrief ? 'yes' : 'no');
  }

  // Když nemáme zadání od autora, AI navrhne podtémata
  if (subtopics.length === 0) {
    const subtopicsPrompt = `Pro téma "${dataSet.topic}" (${dataSet.grade}. třída) navrhni 2-3 konkrétní PODTÉMATA vhodná pro badatelské lekce.

KONTEXT:
${context}

Každé podtéma by mělo:
- Být specifické a zajímavé
- Umožňovat badatelský přístup
- Mít potenciál pro diskuzi a objevování

PŘÍKLADY pro "${dataSet.topic}":
${dataSet.topic.toLowerCase().includes('egypt') ? `
- "Společnost starověkého Egypta a podobnost s dnešní dobou"
- "Hieroglyfy - jejich význam a rozluštění"  
- "Nil a význam řek pro vznik civilizací"` : `
- První specifické podtéma související s ${dataSet.topic}
- Druhé specifické podtéma
- Třetí specifické podtéma`}

Vrať POUZE JSON pole s 2-3 podtématy:
["Podtéma 1", "Podtéma 2", "Podtéma 3"]`;

    try {
      const response = await chatWithAIProxy(
        [{ role: 'user', content: subtopicsPrompt }],
        'gemini-3.0-flash',
        { temperature: 0.7, max_tokens: 500 }
      );
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        subtopics = JSON.parse(jsonMatch[0]);
      }
    } catch (err) {
      console.error('[Generator] Failed to get subtopics:', err);
      subtopics = [dataSet.topic];
    }
    if (subtopics.length === 0) {
      subtopics = [dataSet.topic];
    }
  }

  console.log('[Generator] Subtopics:', subtopics);
  
  // 2. Pro každé podtéma vygenerovat lekci
  const lessons: any[] = [];
  const images = dataSet.media?.images || [];
  const illustrations = dataSet.media?.generatedIllustrations || [];
  
  for (let i = 0; i < subtopics.length; i++) {
    const subtopic = subtopics[i];
    console.log(`[Generator] Generating lesson ${i + 1}/${subtopics.length}: ${subtopic}`);
    
    // Rozdělit vizuály mezi lekce
    const startIdx = Math.floor(i * images.length / subtopics.length);
    const endIdx = Math.floor((i + 1) * images.length / subtopics.length);
    const lessonImages = images.slice(startIdx, endIdx);
    const lessonIllustrations = illustrations.slice(
      Math.floor(i * illustrations.length / subtopics.length),
      Math.floor((i + 1) * illustrations.length / subtopics.length)
    );
    
    const allVisuals = [
      ...lessonImages.map(img => `🖼️ "${img.title}"`),
      ...lessonIllustrations.map(ill => `🎨 "${ill.name}"`)
    ];
    
    const lessonPrompt = `Vytvoř BADATELSKOU E-U-R lekci na podtéma: "${subtopic}"
(Součást většího tématu: ${dataSet.topic}, ${dataSet.grade}. třída)

${userBrief ? `\n⚠️ ZADÁNÍ AUTORA (dodržuj přesně!):\n${userBrief}\n\n` : ''}

KONTEXT:
${context}

${allVisuals.length > 0 ? `🖼️ DOSTUPNÉ VIZUÁLY (použij 3-5):\n${allVisuals.join('\n')}` : ''}

STRUKTURA LEKCE (E-U-R metoda – důsledně dodržuj):
1. EVOKACE (5–7 min): Aktivace předchozích znalostí, provokativní otázka. Použij NÁSTĚNKU (brainstorming) a/nebo HLASOVÁNÍ (tipování).
2. UVĚDOMĚNÍ (20–25 min): Hlavní badatelská aktivita, práce s materiály. Střídej INFO (výklad), KVÍZ (ověření), NÁSTĚNKU (diskuze, krátké úkoly, pro a proti) a HLASOVÁNÍ (názor, škála od–do).
3. REFLEXE (8–10 min): Shrnutí, diskuze, propojení s dneškem. NÁSTĚNKA (co jsme zjistili), na závěr HLASOVÁNÍ ZPĚTNÁ VAZBA (jak se vám dařilo).

PRAVIDLA:
- Více diskuzních a samostatných aktivit: nástěnky (diskuze, krátké úkoly, pro a proti), hlasování v různých typech.
- Rozmanitost: použij alespoň 2× NÁSTĚNKA (různé typy), 2× HLASOVÁNÍ (různé typy), 1–2× KVÍZ, zbytek INFO. Celkem 10–14 slidů.
- Na konec lekce vždy zařaď HLASOVÁNÍ ZPĚTNÁ VAZBA (zpětná vazba žáků).

DOSTUPNÉ TYPY SLIDŮ (piš přesně tyto značky):

INFO: Nadpis
Obsah jako prostý text. Bez markdown, bez HTML.
OBRÁZEK: název obrázku

KVÍZ: Otázka?
A) Odpověď 1
B) Odpověď 2 *
C) Odpověď 3
(Správná odpověď = ta s hvězdičkou * na konci. Může být A, B, C nebo D – vždy označ skutečně správnou!)

NÁSTĚNKA: Otázka k diskuzi? (brainstorming, žáci píší nápady)

NÁSTĚNKA PRO A PROTI: Otázka k argumentaci?
(žáci píší argumenty do sloupců Pro / Proti)

NÁSTĚNKA ÚKOL: Krátký úkol – např. Připravte jeden slide na téma X. Společná prezentace.
(úkol pro skupiny, výsledek na nástěnku)

HLASOVÁNÍ: Názorová otázka? (VŽDY napiš konkrétní možnosti A) B) C) odpovídající otázce – nikdy ne Ano/Ne/Nevím!)
A) Konkrétní odpověď 1
B) Konkrétní odpověď 2
C) Konkrétní odpověď 3

HLASOVÁNÍ OD-DO: Otázka se škálou?
Od: Určitě ne
Do: Určitě ano

HLASOVÁNÍ ZPĚTNÁ VAZBA: Jak se vám v této lekci dařilo?
(použij na konec lekce – emoji reakce)

DŮLEŽITÉ:
- Každý slide začíná typem (INFO / KVÍZ / NÁSTĚNKA / … / HLASOVÁNÍ / …). Žádné "SLIDE 1:", markdown ani HTML.
- U HLASOVÁNÍ (ne OD-DO, ne ZPĚTNÁ VAZBA) vždy napiš A) B) C) s konkrétními možnostmi. Nikdy Ano/Ne/Nevím.
- U KVÍZ: Správná odpověď musí být označená hvězdičkou * na konci řádku. Správná může být kterákoli z A/B/C/D – podle skutečnosti, ne vždy A!
- Střídej výklad (INFO) s interaktivními slidy. E-U-R fáze dodržuj v pořadí.`;

    try {
      const response = await chatWithAIProxy(
        [{ role: 'user', content: lessonPrompt }],
        'gemini-3.0-flash',
        { temperature: 0.7, max_tokens: 3000 }
      );
      
      // Parse response do slidů
      const slides = parseTextToLessonSlides(response, {
        ...dataSet,
        media: {
          ...dataSet.media,
          images: lessonImages,
          generatedIllustrations: lessonIllustrations
        }
      });
      
      if (slides.length > 0) {
        lessons.push({
          subtopic,
          slides,
          rawResponse: response
        });
      }
    } catch (err) {
      console.error(`[Generator] Failed to generate lesson for ${subtopic}:`, err);
    }
  }
  
  if (lessons.length === 0) {
    return { success: false, error: 'Nepodařilo se vygenerovat žádnou lekci' };
  }
  
  // 3. Uložit všechny lekce pomocí saveQuiz (do IndexedDB/Supabase)
  const savedIds: string[] = [];
  
  for (const lesson of lessons) {
    const quizId = `lesson-${dataSet.id}-${crypto.randomUUID().slice(0, 8)}`;
    
    const quiz: Quiz = {
      id: quizId,
      title: `Interaktivní lekce: ${lesson.subtopic}`,
      slides: lesson.slides,
      settings: {
        showProgress: true,
        showScore: true,
        allowSkip: true,
        allowBack: true,
        shuffleQuestions: false,
        shuffleOptions: false,
        showExplanations: 'immediately',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Přímý sync do Supabase (localStorage má quota limit)
    // saveQuiz může selhat, proto ukládáme přímo do Supabase
    try {
      saveQuiz(quiz); // Pokus o localStorage (může selhat)
    } catch (e) {
      console.warn(`[Generator] localStorage failed for ${quizId}:`, e);
    }
    
    // Přímý sync do Supabase s quiz objektem (nezávisí na localStorage)
    const synced = await syncQuizDirectToSupabase(quiz);
    if (synced) {
      console.log(`[Generator] ✅ Lesson synced to Supabase: ${quizId}`);
      savedIds.push(quizId);
    } else {
      console.error(`[Generator] ❌ Failed to sync lesson to Supabase: ${quizId}`);
    }
    
    console.log(`[Generator] Lesson saved: ${quizId} - ${lesson.subtopic}`);
  }
  
  // Vrátit info o všech lekcích
  const preview = lessons.map((l, i) => `${i + 1}. ${l.subtopic} (${l.slides.length} slidů)`).join('\n');
  
  // Přeskočit localStorage (quota exceeded) - data jsou v Supabase
  console.log('[Generator] Lessons saved to Supabase:', savedIds);
  
  return { 
    success: true, 
    id: savedIds[0], // První jako hlavní
    preview: `Vytvořeno ${lessons.length} lekcí:\n${preview}`
  };
}

// =====================================================
// METHODOLOGY GENERATOR - Metodická inspirace
// =====================================================

async function generateMethodology(dataSet: TopicDataSet): Promise<GenerateResult> {
  console.log('[Generator] Generating methodology...');
  
  const feedback = getFeedbackForType('methodology');
  
  // Připravit strukturovaná data z datasetu
  const rvpOutputs = dataSet.rvp?.expectedOutcomes?.join('\n- ') || 'Nejsou specifikovány';
  const keyTermsList = dataSet.content?.keyTerms?.map(t => `**${t.term}** – ${t.definition}`).join('\n') || '';
  const keyFactsList = dataSet.content?.keyFacts?.join('\n- ') || '';
  const personalitiesList = dataSet.content?.personalities?.map((p: any) => `**${p.name}** – ${p.description}`).join('\n') || '';
  const timelineList = dataSet.content?.timeline?.map((e: any) => `**${e.year || e.date}** – ${e.event || e.description}`).join('\n') || '';
  
  const prompt = `Napiš METODICKOU INSPIRACI pro učitele k tématu "${dataSet.topic}" pro ${dataSet.grade}. třídu.

${feedback}

Toto je přehled pro učitele - jak téma uchopit, na co se zaměřit, jaké aktivity zařadit.

POVINNÁ STRUKTURA:

## 📋 Anotace tématu
Stručný přehled tématu (3-4 věty). Proč je téma důležité? Jak se pojí s dalším učivem?

## 🎯 Očekávané výstupy dle RVP
${rvpOutputs ? `Relevantní výstupy z RVP:\n- ${rvpOutputs}` : 'Formuluj 3-4 konkrétní výstupy, co žáci budou umět.'}

## 📚 Klíčové pojmy
${keyTermsList || 'Vypiš 5-8 klíčových pojmů s definicemi.'}

## 📖 Faktografický přehled
Základní fakta k tématu, která by měl učitel znát:
${keyFactsList ? `- ${keyFactsList}` : '- Vypiš 8-10 klíčových faktů'}

${personalitiesList ? `### Významné osobnosti\n${personalitiesList}\n` : ''}
${timelineList ? `### Časová osa\n${timelineList}\n` : ''}

## 🎓 Didaktické poznámky
INFOBOX zelený: Jak téma uchopit
Napiš 2-3 věty o tom, jak téma představit žákům zajímavě.

INFOBOX oranžový: Na co si dát pozor
Uveď typické miskoncepce nebo obtížná místa.

## 💡 Náměty na aktivity
Navrhni 3-4 konkrétní aktivity:
1. **Evokace** – aktivita na začátek hodiny
2. **Hlavní aktivita** – práce s učivem
3. **Reflexe** – závěrečná aktivita
4. **Rozšíření** – pro rychlejší žáky

## 🔗 Mezipředmětové vztahy
Jak téma souvisí s jinými předměty (zeměpis, výtvarná výchova, český jazyk...)?

## 📎 Materiály Vividbooks
K tomuto tématu máte k dispozici tyto materiály:
- 📖 **Učební text** – Výkladový text pro žáky s obrázky a infoboxy
- 🎮 **Procvičování (lehké)** – Interaktivní kvíz pro slabší žáky
- 🎯 **Procvičování (těžké)** – Náročnější kvíz pro pokročilé
- 📝 **Pracovní list** – Tisknutelný pracovní list s aktivitami
- ✏️ **Písemka** – Test pro ověření znalostí
- 🎓 **Lekce E-U-R** – Kompletní interaktivní lekce podle metody E-U-R

Všechny materiály najdete v knihovně Vividbooks pod tématem "${dataSet.topic}".

PRAVIDLA:
- Piš profesionálně, ale přístupně
- INFOBOX zelený/oranžový pro zvýraznění tipů a upozornění
- Využij data z podkladů (pojmy, fakta, osobnosti, časová osa)
- Zaměř se na praktické využití v hodině`;

  try {
    const response = await chatWithAIProxy(
      [{ role: 'user', content: prompt }],
      'gemini-3.0-flash',
      { temperature: 0.7, max_tokens: 3000 }
    );
    
    console.log('[Generator] Methodology raw response:', response.substring(0, 500));
    
    // Převést INFOBOX na HTML callout
    const calloutTypeMap: Record<string, string> = {
      'modrý': 'info',
      'červený': 'danger',
      'zelený': 'tip',
      'oranžový': 'warning',
      'fialový': 'summary',
    };
    
    let processedResponse = response.replace(
      /INFOBOX (modrý|červený|zelený|oranžový|fialový):\s*(.+?)(?:\n([^\n#]*))?(?=\n\n|\n##|$)/gim,
      (match, color, title, content) => {
        const calloutType = calloutTypeMap[color.toLowerCase()] || 'info';
        const contentText = content ? content.trim() : '';
        return `\n<div data-type="callout" data-callout-type="${calloutType}" class="callout callout-${calloutType}"><p><strong>${title.trim()}</strong></p>${contentText ? `<p>${contentText}</p>` : ''}</div>\n`;
      }
    );
    
    // Převést Markdown na HTML
    const html = markdownToHtml(processedResponse);
    
    const docId = crypto.randomUUID();
    
    const docData = {
      id: docId,
      title: `${dataSet.topic} – Metodická inspirace`,
      content: html,
      documentType: 'methodology',
      sectionImages: [],
    };
    
    // Uložit - localStorage může selhat, proto přímý sync do Supabase
    try {
      localStorage.setItem(`vivid-doc-${docId}`, JSON.stringify(docData));
    } catch (e) {
      console.warn(`[Generator] localStorage failed for methodology ${docId}:`, e);
    }
    
    // Přímý sync do Supabase
    const synced = await syncDocumentDirectToSupabase(docData);
    if (!synced) {
      console.warn(`[Generator] Supabase sync failed for methodology ${docId}`);
    }
    
    // Náhled
    const preview = processedResponse
      .replace(/INFOBOX (modrý|červený|zelený|oranžový):\s*/gi, '📦 ')
      .replace(/<[^>]+>/g, '');
    
    console.log('[Generator] Methodology saved:', docId);
    return { success: true, id: docId, preview };
  } catch (err) {
    console.error('[Generator] Methodology error:', err);
    return { success: false, error: String(err) };
  }
}

// =====================================================
// ILLUSTRATION PROMPT GENERATOR
// =====================================================

// Styl pro všechny ilustrace - Ligne Claire (Tintin style)
const ILLUSTRATION_STYLE = `Create educational illustration in Ligne Claire style (like Tintin comics):

LINE ART:
- Dead line technique - consistent line weight, no pressure variation
- Clean, technical, organized appearance
- Every object clearly outlined with black or dark gray contour
- Closed shapes with clear boundaries

COLORS & SHADING:
- Limited pastel palette with vibrant, professional colors
- Flat design - no gradients, large areas of single color
- Minimal hard-edged shadows only (sharply defined darker blocks, no blur)
- Often no shading at all for clarity

COMPOSITION:
- Stylized anatomy - simplified features but proportional
- Static, calm poses - frontal or slight profile view
- Icon/infographic feel
- Pure white background (negative space)
- Clean, clear, aesthetically pleasing

TECHNICAL:
- 800x800 pixels
- No text in image
- Educational and professional look
- Suitable for school materials`;

// =====================================================
// PHOTO GENERATION (Fotorealistické fotky + historická selfie)
// =====================================================

const PHOTO_STYLE = `CRITICAL: Generate a REAL PHOTOGRAPH, NOT an illustration or cartoon.
Technical requirements:
- Photorealistic 8K photograph with natural lighting
- Shot on professional DSLR camera (Canon EOS R5 or Sony A7R IV)
- Sharp focus, realistic skin pores, hair strands, fabric textures
- Natural color grading, no artistic filters
- Documentary/National Geographic style photography
- Realistic shadows, depth of field, lens characteristics
FORBIDDEN: illustration, drawing, cartoon, anime, digital art, painting, vector art, Ligne Claire`;

const SELFIE_STYLE = `Generate a GROUP SELFIE photograph from the camera's point of view.
COMPOSITION:
- Camera POV: We ARE the camera/phone - looking directly at the group
- 3-5 historical people gathered together, smiling at the camera
- Close-up framing: faces fill most of the frame
- Slight wide-angle distortion typical of phone selfies
- Some people slightly cut off at edges (natural selfie cropping)
- One person's arm may be partially visible at bottom edge (holding the invisible camera)

STYLE:
- Photorealistic, natural lighting, candid feel
- Happy expressions, looking directly at camera
- Authentic historical clothing and environment visible behind them
- NO phone or device visible anywhere in the image

FORBIDDEN: visible phone, visible camera, illustration, cartoon, third-person view`;

export interface PhotoPrompt {
  id: string;
  name: string;
  category: 'selfie' | 'scene' | 'portrait' | 'artifact' | 'location';
  keywords: string[];
  description: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  generatedUrl?: string;
}

export async function generatePhotoPrompts(dataSet: TopicDataSet): Promise<PhotoPrompt[]> {
  console.log('[Generator] Generating photo prompts for:', dataSet.topic);
  
  const keyTerms = dataSet.content?.keyTerms?.map(t => t.term).join(', ') || '';
  const personalities = dataSet.content?.personalities?.map((p: any) => p.name).join(', ') || '';
  const keyFacts = dataSet.content?.keyFacts?.slice(0, 5).join('; ') || '';
  
  const prompt = `Pro vzdělávací materiály k tématu "${dataSet.topic}" (${dataSet.grade}. třída) navrhni 5-8 fotorealistických fotografií.

KONTEXT TÉMATU:
- Klíčové pojmy: ${keyTerms}
- Osobnosti: ${personalities}
- Fakta: ${keyFacts}

DŮLEŽITÉ: PRVNÍ FOTKA MUSÍ BÝT "HISTORICKÉ SELFIE"!
= Fotorealistická fotka kde si typický člověk z té doby dělá selfie mobilem.
= Ukazuje autentické oblečení, účes, prostředí té doby.
= Je to vtipný anachronismus ale vzdělávací - žáci uvidí jak lidé vypadali.

Pro každou fotku uveď:
FOTKA: [název česky]
KATEGORIE: [selfie/scene/portrait/artifact/location]
KLÍČOVÁ SLOVA: [3-5 slov česky]
POPIS: [detailní popis česky - co přesně má být na fotce, jaké detaily]

TYPY FOTOGRAFIÍ:
1. **Selfie** (selfie) - POVINNÉ! Člověk z doby si dělá selfie telefonem
2. **Scéna** (scene) - autentická scéna z každodenního života
3. **Portrét** (portrait) - fotorealistický portrét osobnosti nebo typické osoby
4. **Artefakt** (artifact) - detailní fotka historického předmětu
5. **Místo** (location) - rekonstrukce historického místa/architektury

PŘÍKLAD PRO STAROVĚKÝ EGYPT:
FOTKA: Selfie egyptského písaře
KATEGORIE: selfie
KLÍČOVÁ SLOVA: písař, papyrus, hieroglyfy, bílá suknice
POPIS: Mladý egyptský písař si dělá selfie. Má oholenou hlavu, na sobě bílou lněnou suknici. V pozadí je vidět chrám s hieroglyfy. Drží smartphone a usmívá se do kamery.

FOTKA: Denní trh v Memphisu
KATEGORIE: scene
KLÍČOVÁ SLOVA: trh, obchodníci, ovoce, Nil
POPIS: Rušný trh ve starověkém egyptském městě. Obchodníci prodávají ovoce a látky. V pozadí palmy a pohled na Nil.

Navrhni 5-8 fotek (první MUSÍ být selfie):`;

  try {
    const response = await chatWithAIProxy(
      [{ role: 'user', content: prompt }],
      'gemini-3.0-flash',
      { temperature: 0.8, max_tokens: 2048 }
    );
    
    console.log('[Generator] Photo prompts raw:', response.substring(0, 300));
    
    const prompts: PhotoPrompt[] = [];
    const blocks = response.split(/(?=FOTKA:)/gi).filter(b => b.trim());
    
    for (const block of blocks) {
      const nameMatch = block.match(/FOTKA:\s*(.+)/i);
      const categoryMatch = block.match(/KATEGORIE:\s*(.+)/i);
      const keywordsMatch = block.match(/KLÍČOVÁ SLOVA:\s*(.+)/i);
      const descMatch = block.match(/POPIS:\s*(.+?)(?=(?:FOTKA:|$))/is);
      
      if (nameMatch && descMatch) {
        const categoryRaw = categoryMatch?.[1]?.trim().toLowerCase() || 'scene';
        const category = ['selfie', 'scene', 'portrait', 'artifact', 'location'].includes(categoryRaw) 
          ? categoryRaw as PhotoPrompt['category']
          : 'scene';
          
        prompts.push({
          id: crypto.randomUUID(),
          name: nameMatch[1].trim(),
          category,
          keywords: keywordsMatch?.[1]?.split(',').map(k => k.trim()) || [],
          description: descMatch[1].trim(),
          status: 'pending',
        });
      }
    }
    
    console.log('[Generator] Generated photo prompts:', prompts.length);
    return prompts;
    
  } catch (err) {
    console.error('[Generator] Photo prompts error:', err);
    return [];
  }
}

export async function generatePhoto(prompt: PhotoPrompt, dataSet: TopicDataSet): Promise<string | null> {
  console.log('[Generator] Generating photo:', prompt.name);
  
  const { generateImageWithImagen } = await import('../ai-chat-proxy');
  
  // Vybrat správný styl podle kategorie
  const stylePrompt = prompt.category === 'selfie' ? SELFIE_STYLE : PHOTO_STYLE;
  
  // DŮLEŽITÉ: Použít POUZE styl pro fotky, nepoužívat ILLUSTRATION_STYLE
  const fullPrompt = `${stylePrompt}

SUBJECT: ${prompt.name}
CONTEXT: ${dataSet.topic}
SCENE: ${prompt.description}
DETAILS: ${prompt.keywords.join(', ')}

OUTPUT: Ultra-realistic 8K photograph, documentary style. NO illustration, NO cartoon, NO digital art.`;

  try {
    const result = await generateImageWithImagen(fullPrompt, {
      aspectRatio: '1:1',
      numberOfImages: 1,
      dataSetId: dataSet.id,
      illustrationName: `📷 ${prompt.name}`
    });
    
    if (result.success && (result.url || result.images?.[0]?.base64)) {
      let rawImageUrl = result.url || `data:${result.images?.[0]?.mimeType || 'image/png'};base64,${result.images?.[0]?.base64}`;
      
      // Upload do Storage místo ukládání base64 do DB
      const { processImageUrl } = await import('../supabase/upload-image');
      const imageUrl = await processImageUrl(rawImageUrl, `${dataSet.id}-${prompt.id}`, 'photos');
      
      // Kontrola - pokud upload selhal, nevrátit nic
      if (!imageUrl) {
        console.error('[Generator] Photo upload to storage failed');
        return null;
      }
      
      console.log('[Generator] Photo generated successfully:', imageUrl.substring(0, 100) + '...');
      return imageUrl;
    } else {
      console.error('[Generator] Photo generation failed:', result.error || 'No image data returned');
      return null;
    }
  } catch (err) {
    console.error('[Generator] Photo generation error:', err);
    return null;
  }
}

// =====================================================
// ILLUSTRATION PROMPTS
// =====================================================

export async function generateIllustrationPrompts(dataSet: TopicDataSet): Promise<IllustrationPrompt[]> {
  console.log('[Generator] Generating illustration prompts for:', dataSet.topic);
  
  // Připravit kontext z datasetu
  const keyTerms = dataSet.content?.keyTerms?.map(t => t.term).join(', ') || '';
  const personalities = dataSet.content?.personalities?.map((p: any) => p.name).join(', ') || '';
  const keyFacts = dataSet.content?.keyFacts?.slice(0, 5).join('; ') || '';
  
  const prompt = `Pro vzdělávací materiály k tématu "${dataSet.topic}" (${dataSet.grade}. třída) navrhni 8-12 ilustrací.

KONTEXT TÉMATU:
- Klíčové pojmy: ${keyTerms}
- Osobnosti: ${personalities}
- Fakta: ${keyFacts}

Pro každou ilustraci uveď:
ILUSTRACE: [název česky]
KATEGORIE: [icon/portrait/object/scene/map]
KLÍČOVÁ SLOVA: [3-5 slov česky]
POPIS: [detailní popis česky - 2-3 věty]

TYPY ILUSTRACÍ:
1. **Ikony** (icon) - jednoduché symboly: helma, štít, váza, sloup, mince
2. **Portréty** (portrait) - stylizované postavy: filosof, válečník, panovník
3. **Objekty** (object) - artefakty: zbraně, nástroje, šperky, architektura
4. **Scény** (scene) - situace: bitva, agora, obchod, škola
5. **Mapy** (map) - stylizované mapy území

PŘÍKLAD:
ILUSTRACE: Řecká helma hoplíta
KATEGORIE: icon
KLÍČOVÁ SLOVA: helma, hoplít, válečník, bronz
POPIS: Bronzová korintská přilba řeckého hoplíty zobrazená z boku, s červeným chocholem z koňských žíní, čistá minimalistická ilustrace.

Navrhni ilustrace pokrývající různé aspekty tématu. Soustřeď se na vizuálně zajímavé a edukativně hodnotné náměty. Vše piš v češtině.`;

  try {
    const response = await chatWithAIProxy(
      [{ role: 'user', content: prompt }],
      'gemini-3.0-flash',
      { temperature: 0.8, max_tokens: 2500 }
    );
    
    console.log('[Generator] Illustration prompts raw:', response.substring(0, 500));
    
    // Parsovat odpověď
    const prompts: IllustrationPrompt[] = [];
    const blocks = response.split(/ILUSTRACE:/i).slice(1);
    
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      const name = lines[0]?.trim() || '';
      
      const categoryMatch = block.match(/KATEGORIE:\s*(\w+)/i);
      const keywordsMatch = block.match(/KLÍČOVÁ SLOVA:\s*(.+)/i);
      const descMatch = block.match(/POPIS:\s*(.+)/is);
      
      if (name && descMatch) {
        const category = (categoryMatch?.[1]?.toLowerCase() || 'icon') as IllustrationPrompt['category'];
        const keywords = keywordsMatch?.[1]?.split(',').map(k => k.trim()) || [];
        const description = descMatch[1]?.split('\n')[0]?.trim() || '';
        
        // Sestavit plný prompt s naším stylem
        const fullPrompt = `${description}

Style requirements:
${ILLUSTRATION_STYLE}`;
        
        prompts.push({
          id: crypto.randomUUID(),
          name,
          prompt: fullPrompt,
          category,
          keywords,
          status: 'pending',
        });
      }
    }
    
    console.log('[Generator] Generated prompts:', prompts.length);
    return prompts;
    
  } catch (err) {
    console.error('[Generator] Illustration prompts error:', err);
    return [];
  }
}

// Funkce pro generování jedné ilustrace (připraveno pro napojení na Imagen/DALL-E)
export async function generateIllustration(
  promptData: IllustrationPrompt,
  apiType: 'imagen' | 'dalle' = 'imagen'
): Promise<{ success: boolean; url?: string; error?: string }> {
  console.log('[Generator] Generating illustration:', promptData.name);
  
  // TODO: Napojit na skutečné API (Imagen 3, DALL-E, atd.)
  // Pro teď vrátíme placeholder
  
  try {
    // Simulace - v budoucnu nahradit skutečným API voláním
    // const response = await fetch('https://api.imagen.google.com/generate', {
    //   method: 'POST',
    //   headers: { 'Authorization': `Bearer ${API_KEY}` },
    //   body: JSON.stringify({ prompt: promptData.prompt, style: 'illustration' })
    // });
    
    return {
      success: false,
      error: 'Image generation API not yet connected. Prompts are ready for manual generation.',
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
