/**
 * Podle textu zadání (brief) vybere z katalogu přednastavených ilustračních stylů 1–3 nejvhodnější.
 */

import { PRESET_ILLUSTRATION_STYLES } from '../../data/preset-illustration-styles';
import { chatWithAIProxy } from '../ai-chat-proxy';
import { extractJsonObjectFromModelText } from '../../types/design-system-agent';

const VALID_IDS = new Set(PRESET_ILLUSTRATION_STYLES.map((p) => p.id));

export type PresetStyleRecommendation = {
  presetId: string;
  reasonCz: string;
};

const MIN_PROMPT_CHARS = 15;

export async function recommendPresetIllustrationStylesFromPrompt(
  userPrompt: string,
): Promise<
  | { ok: true; recommendations: PresetStyleRecommendation[]; summaryCz: string }
  | { ok: false; message: string }
> {
  const trimmed = userPrompt.trim();
  if (trimmed.length < MIN_PROMPT_CHARS) {
    return { ok: false, message: `Napiš aspoň ${MIN_PROMPT_CHARS} znaků zadání.` };
  }

  const catalog = PRESET_ILLUSTRATION_STYLES.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
  }));

  const system = `You help Czech teachers choose illustration styles for school textbooks and workbooks.
Return ONE JSON object only. No markdown fences.

Shape:
{
  "recommendations": [ { "presetId": string, "reasonCz": string } ],
  "summaryCz": string
}

Rules:
- presetId MUST be exactly one of the catalog "id" values from the user message.
- Return 1 to 3 recommendations, best match first.
- reasonCz: one short sentence in Czech (why this style fits the brief).
- summaryCz: one sentence in Czech summarizing the top pick or the set.
- Match mood, subject (science, story, infographic), age level, and keywords in the brief to name + description.`;

  const user = `## Catalog (use presetId from "id" only)
${JSON.stringify(catalog)}

## Teacher prompt / brief
${trimmed}`;

  try {
    const raw = await chatWithAIProxy(
      [{ role: 'system', content: system }, { role: 'user', content: user }],
      'gemini-3-flash',
      { temperature: 0.25, max_tokens: 1200, thinking_level: 'low' },
    );
    const json = extractJsonObjectFromModelText(raw) as Record<string, unknown>;
    const recs = Array.isArray(json.recommendations) ? json.recommendations : [];
    const out: PresetStyleRecommendation[] = [];
    for (const r of recs) {
      if (!r || typeof r !== 'object') continue;
      const o = r as Record<string, unknown>;
      const presetId = typeof o.presetId === 'string' ? o.presetId.trim() : '';
      const reasonCz = typeof o.reasonCz === 'string' ? o.reasonCz.trim().slice(0, 400) : '';
      if (!VALID_IDS.has(presetId) || !reasonCz) continue;
      out.push({ presetId, reasonCz });
      if (out.length >= 3) break;
    }
    const summaryCz = typeof json.summaryCz === 'string' ? json.summaryCz.trim().slice(0, 500) : '';
    if (out.length === 0) {
      return {
        ok: false,
        message: 'AI nevrátila platné doporučení — zkus zadání upřesnit (předmět, věk žáků, zda infografika / příběh).',
      };
    }
    return { ok: true, recommendations: out, summaryCz };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg || 'Doporučení stylu selhalo.' };
  }
}
