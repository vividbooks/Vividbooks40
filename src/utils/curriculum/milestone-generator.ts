/**
 * Milestone Generator – generuje uzlové body (uzavření tematického celku)
 *
 * Každá ze tří sekcí (test, písemka, hodnocení) se generuje zvlášť
 * → kratší prompty, spolehlivější JSON parsing.
 */

import { chatWithAIProxy } from '../ai-chat-proxy';
import {
  MilestoneData,
  MilestoneTest,
  MilestonePisemka,
  MilestoneHodnoceni,
} from '../../types/topic-dataset';

export interface MilestoneGeneratorParams {
  topicGroupName: string;
  coveredTopics: string[];
  coveredWeekNumbers: number[];
  rvpOutcomes: string[];
  subjectName: string;
  grade: number;
  keyTerms?: { term: string; definition: string }[];
  keyFacts?: string[];
}

export interface GeneratedMilestoneContent {
  test: MilestoneTest;
  pisemka: MilestonePisemka;
  hodnoceni: MilestoneHodnoceni;
}

const SCHOOL_TYPES = ['ZŠ standardní', 'Gymnázium', 'ZŠ praktická/speciální'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildContext(params: MilestoneGeneratorParams): string {
  const terms = (params.keyTerms || []).slice(0, 25).map(t => `${t.term}: ${t.definition}`).join('; ');
  const facts = (params.keyFacts || []).slice(0, 15).join('; ');
  const outcomes = params.rvpOutcomes.slice(0, 6).join('; ');
  return [
    `Předmět: ${params.subjectName}, ${params.grade}. třída`,
    `Tematický celek: "${params.topicGroupName}"`,
    `Témata: ${params.coveredTopics.slice(0, 8).join(', ')}`,
    outcomes ? `RVP výstupy: ${outcomes}` : '',
    terms ? `Klíčové pojmy: ${terms}` : '',
    facts ? `Hlavní fakta: ${facts}` : '',
  ].filter(Boolean).join('\n');
}

/** Najde první balanced JSON objekt nebo pole v textu (ignoruje text okolo). */
function extractFirstJsonBlock(text: string): string | null {
  const objStart = text.indexOf('{');
  const arrStart = text.indexOf('[');
  let start = -1;
  let open: string, close: string;

  if (objStart === -1 && arrStart === -1) return null;
  if (objStart === -1) { start = arrStart; open = '['; close = ']'; }
  else if (arrStart === -1) { start = objStart; open = '{'; close = '}'; }
  else if (arrStart < objStart) { start = arrStart; open = '['; close = ']'; }
  else { start = objStart; open = '{'; close = '}'; }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === open) depth++;
    if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function parseJsonSafe(text: string): any {
  console.log('[MilestoneParser] Raw AI response (first 500 chars):', text.slice(0, 500));
  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  const stripped = text.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1').trim();
  // Extrahuj první balanced JSON blok (ne greedy regex)
  const block = extractFirstJsonBlock(stripped);
  if (!block) throw new Error('No JSON found');
  console.log('[MilestoneParser] Extracted block (first 200 chars):', block.slice(0, 200));
  const cleaned = block
    .replace(/,\s*([}\]])/g, '$1')   // trailing commas
    .replace(/\/\/[^\n]*/g, '')       // // comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // /* comments */
    .replace(/:\s*undefined/g, ': null')
    .replace(/[\u0000-\u001F\u007F]/g, ' '); // control chars
  return JSON.parse(cleaned);
}

// ── Test generator ────────────────────────────────────────────────────────────

async function generateTest(params: MilestoneGeneratorParams, model: string): Promise<MilestoneTest> {
  const ctx = buildContext(params);
  const prompt = `${ctx}

Vygeneruj souhrnný test. Vrať POUZE JSON bez markdown, bez komentářů:
{"title":"Souhrnný test – ${params.topicGroupName}","totalPoints":16,"timeMinutes":30,"questions":[
{"id":"q1","type":"multiple-choice","text":"<otázka>","points":1,"options":["A) <možnost>","B) <možnost>","C) <možnost>","D) <možnost>"],"correctAnswer":"A) <správná>"},
{"id":"q2","type":"multiple-choice","text":"<otázka>","points":1,"options":["A) <možnost>","B) <možnost>","C) <možnost>","D) <možnost>"],"correctAnswer":"B) <správná>"},
{"id":"q3","type":"multiple-choice","text":"<otázka>","points":1,"options":["A) <možnost>","B) <možnost>","C) <možnost>","D) <možnost>"],"correctAnswer":"C) <správná>"},
{"id":"q4","type":"multiple-choice","text":"<otázka>","points":1,"options":["A) <možnost>","B) <možnost>","C) <možnost>","D) <možnost>"],"correctAnswer":"D) <správná>"},
{"id":"q5","type":"multiple-choice","text":"<otázka>","points":1,"options":["A) <možnost>","B) <možnost>","C) <možnost>","D) <možnost>"],"correctAnswer":"A) <správná>"},
{"id":"q6","type":"true-false","text":"<tvrzení>","points":1,"correctAnswer":"true"},
{"id":"q7","type":"true-false","text":"<tvrzení>","points":1,"correctAnswer":"false"},
{"id":"q8","type":"open","text":"<otázka>","points":2,"correctAnswer":"<vzorová odpověď>"},
{"id":"q9","type":"open","text":"<otázka>","points":2,"correctAnswer":"<vzorová odpověď>"},
{"id":"q10","type":"open","text":"<otázka>","points":2,"correctAnswer":"<vzorová odpověď>"},
{"id":"q11","type":"fill-blank","text":"<věta s ___ mezerou>","points":1,"correctAnswer":"<slovo>"},
{"id":"q12","type":"fill-blank","text":"<věta s ___ mezerou>","points":1,"correctAnswer":"<slovo>"},
{"id":"q13","type":"matching","text":"Přiřaď pojmy:","points":3,"matchPairs":[{"left":"<pojem>","right":"<definice>"},{"left":"<pojem>","right":"<definice>"},{"left":"<pojem>","right":"<definice>"}]}
]}

Vyplň místo <...> skutečnými otázkami z probíraných témat. POUZE JSON, nic jiného.`;

  const resp = await chatWithAIProxy([{ role: 'user', content: prompt }], model as any, { max_tokens: 4096 });
  const parsed = parseJsonSafe(resp);
  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) throw new Error('Invalid test');
  return parsed as MilestoneTest;
}

// ── Písemka generator ─────────────────────────────────────────────────────────

async function generatePisemka(params: MilestoneGeneratorParams, model: string): Promise<MilestonePisemka> {
  const ctx = buildContext(params);
  const prompt = `${ctx}

Vygeneruj souhrnnou písemku (psané úlohy) pro uzavření tohoto tematického celku.
Vrať POUZE JSON (bez markdown), přesně v tomto formátu:
{
  "title": "Souhrnná písemka – ${params.topicGroupName}",
  "totalPoints": 20,
  "timeMinutes": 45,
  "tasks": [
    {"id":"t1","title":"<název>","instruction":"<podrobný pokyn pro žáka>","points":5,"hint":"<nápověda>"},
    {"id":"t2","title":"<název>","instruction":"<pokyn>","points":8},
    {"id":"t3","title":"<název>","instruction":"<pokyn>","points":7}
  ]
}

Požadavky: 3–4 úlohy různé náročnosti (popis, analýza, porovnání, esej).
Úlohy musí vycházet z probíraných témat. Všechny texty ČESKY. POUZE JSON.`;

  const resp = await chatWithAIProxy([{ role: 'user', content: prompt }], model as any, { max_tokens: 4096 });
  const parsed = parseJsonSafe(resp);
  if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) throw new Error('Invalid pisemka');
  return parsed as MilestonePisemka;
}

// ── Hodnocení generator ───────────────────────────────────────────────────────

async function generateHodnoceni(params: MilestoneGeneratorParams, model: string): Promise<MilestoneHodnoceni> {
  const ctx = buildContext(params);
  const prompt = `${ctx}

Vygeneruj hodnoticí dokument. POUZE JSON, žádný text navíc:
{"outcomes":["<výstup 1>","<výstup 2>","<výstup 3>"],"levels":[{"schoolType":"ZŠ standardní","grades":[{"grade":1,"label":"Výborný","criteria":["<kritérium A>","<kritérium B>"]},{"grade":2,"label":"Chvalitebný","criteria":["<kritérium>"]},{"grade":3,"label":"Dobrý","criteria":["<kritérium>"]},{"grade":4,"label":"Dostatečný","criteria":["<kritérium>"]},{"grade":5,"label":"Nedostatečný","criteria":["<kritérium>"]}]},{"schoolType":"Gymnázium","grades":[{"grade":1,"label":"Výborný","criteria":["<analytické kritérium>","<srovnávací kritérium>"]},{"grade":2,"label":"Chvalitebný","criteria":["<kritérium>"]},{"grade":3,"label":"Dobrý","criteria":["<kritérium>"]},{"grade":4,"label":"Dostatečný","criteria":["<kritérium>"]},{"grade":5,"label":"Nedostatečný","criteria":["<kritérium>"]}]},{"schoolType":"ZŠ praktická/speciální","grades":[{"grade":1,"label":"Výborný","criteria":["<jednoduché kritérium>","<kritérium>"]},{"grade":2,"label":"Chvalitebný","criteria":["<kritérium>"]},{"grade":3,"label":"Dobrý","criteria":["<kritérium>"]},{"grade":4,"label":"Dostatečný","criteria":["<kritérium>"]},{"grade":5,"label":"Nedostatečný","criteria":["<kritérium>"]}]}]}

Pravidla: Kritéria konkrétní a měřitelná. Gymnázium=hlubší analýza. ZŠ praktická=základní pojmy. Texty ČESKY. POUZE JSON.`;

  const resp = await chatWithAIProxy([{ role: 'user', content: prompt }], model as any, { max_tokens: 4096 });
  const parsed = parseJsonSafe(resp);
  if (!Array.isArray(parsed.levels) || parsed.levels.length === 0) throw new Error('Invalid hodnoceni');
  return parsed as MilestoneHodnoceni;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Vygeneruje test, písemku a hodnocení ve třech oddělených voláních.
 * Pro každou sekci zkusí Pro, pak Flash.
 */
export async function generateMilestoneContent(
  params: MilestoneGeneratorParams
): Promise<GeneratedMilestoneContent> {
  const models = ['gemini-3-pro', 'gemini-3-flash'] as const;

  async function trySection<T>(fn: (model: string) => Promise<T>, name: string): Promise<T> {
    for (const model of models) {
      try {
        return await fn(model);
      } catch (err) {
        console.warn(`[Milestone] ${name} failed on ${model}:`, err);
        if (model === 'gemini-3-flash') throw new Error(`${name}: ${err}`);
      }
    }
    throw new Error(`${name}: all models failed`);
  }

  // Sekvenční volání – spolehlivější než paralelní (rate limit, parsing)
  const test = await trySection(m => generateTest(params, m), 'Test');
  const pisemka = await trySection(m => generatePisemka(params, m), 'Písemka');
  const hodnoceni = await trySection(m => generateHodnoceni(params, m), 'Hodnocení');

  return { test, pisemka, hodnoceni };
}

/**
 * Sestaví kompletní MilestoneData objekt pro uložení do DB.
 * Generuje sekce paralelně.
 */
export async function buildMilestoneData(
  params: MilestoneGeneratorParams,
  onProgress?: (msg: string) => void
): Promise<MilestoneData> {
  onProgress?.(`  🏁 Generuji uzlový bod pro "${params.topicGroupName}"...`);

  let test: MilestoneTest | undefined;
  let pisemka: MilestonePisemka | undefined;
  let hodnoceni: MilestoneHodnoceni | undefined;

  try {
    const content = await generateMilestoneContent(params);
    test = content.test;
    pisemka = content.pisemka;
    hodnoceni = content.hodnoceni;
    onProgress?.(`  ✅ Vygenerováno: ${test.questions.length} otázek, ${pisemka.tasks.length} úloh, ${SCHOOL_TYPES.length} typy škol`);
  } catch (err) {
    onProgress?.(`  ⚠️ Generování selhalo, uložen prázdný: ${err}`);
  }

  return {
    topicGroupName: params.topicGroupName,
    coveredWeekNumbers: params.coveredWeekNumbers,
    coveredTopics: params.coveredTopics,
    test,
    pisemka,
    hodnoceni,
  };
}

/**
 * Vytvoří název uzlového bodu z názvu tematického celku.
 */
export function formatMilestoneTopicName(thematicArea: string): string {
  return `Uzavření: ${thematicArea}`;
}
