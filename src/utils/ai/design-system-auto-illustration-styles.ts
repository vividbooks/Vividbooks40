/**
 * Automatické seskupení referenčních obrázků do ilustračních „stylů“ podle pixelů (screenshoty / výřezy).
 * Volá se z plátna po změně sady obrázků — uživatel netřídí ručně.
 */

import { chatWithAIProxy, type ChatMessageContentPart } from '../ai-chat-proxy';
import type { DatasetFile, DatasetIllustrationStyle } from '../../types/design-system';
import { extractJsonObjectFromModelText } from '../../types/design-system-agent';

const MAX_IMAGES = 12;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const TAG_SUGGESTIONS = [
  'postavy',
  'scéna',
  'schéma',
  'mapa',
  'fotografie',
  'kresba',
  'diagram',
  'layout_stránky',
] as const;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.byteLength; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]);
  }
  return btoa(binary);
}

async function fetchUrlAsImagePart(url: string): Promise<ChatMessageContentPart | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size > MAX_IMAGE_BYTES) return null;
    const mimeType = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/png';
    const buf = await blob.arrayBuffer();
    return { type: 'image', data: arrayBufferToBase64(buf), mimeType };
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT = `You group reference images for a Czech educational book design system (Vividbooks).

Return ONE JSON object only. No markdown.

Shape:
{
  "styles": [
    {
      "name": string (short Czech name for this visual style cluster, e.g. "Podobné letecké fotografie", "Kreslené postavy"),
      "imageIds": string[] (subset of the provided ids),
      "promptHint": string (REQUIRED for each style — English, detailed STYLE-ONLY art direction for THIS cluster)
    }
  ],
  "imageTags": {
    "<fileId>": string[] 
  }
}

promptHint — purpose: replicate HOW images in this cluster LOOK so new images on ANY subject can match the same visual language. MUST be detailed (roughly 6–15 sentences, at least ~800 characters when possible).

CRITICAL — describe ONLY transferable visual style. Do NOT:
- Describe what is shown in the references (no rivers, mountains, characters, maps, lesson topics, or narrative).
- List subject matter, metaphors, or “what the diagram explains”.
- Tell a story or prescribe scene content.

DO describe (as applicable):
- Medium and rendering (photo vs vector vs 3D vs watercolor vs ink; isometric vs flat; diagram vs painterly — as rendering choices, not topics).
- Line quality, stroke weight, edges, outlines or outline-free.
- Color system: palette, saturation, gradients, shadows, background treatment (e.g. white field vs paper texture).
- Lighting model (flat, soft, directional) and overall mood as a look, not a scene.
- Texture, brush feel, grain, cleanliness vs roughness; level of simplification vs detail.
- Typical layout *as a graphic habit* if relevant (e.g. centered icon, full-bleed photo) — not what the picture is “about”.
- Stylistic AVOID list (e.g. no photorealism if refs are flat) — still style-only.

If the refs are diagrams or maps, describe the diagrammatic *style* (line weight, labeling style if any, color coding) without naming geographic or scientific content.

Rules:
- Use ONLY the exact "id" values from the catalog. Every listed image id must appear in exactly ONE style's imageIds (partition).
- Cluster by shared illustration / photo / diagram LOOK (line quality, color, medium). Do NOT merge unrelated looks.
- The catalog never includes full-page layout screenshots — only illustration-focused references; ignore the idea of grouping “layout pages” here.
- imageTags: for EACH id, 1–4 tags. Prefer these tokens when they fit: ${TAG_SUGGESTIONS.join(', ')}. You may add short Czech tokens if needed (ASCII, no diacritics optional).
- If only one distinct style exists, return one style containing all ids.
- Minimum 1 style. Maximum 8 styles.`;

export type AssignIllustrationStylesResult =
  | {
      ok: true;
      styles: DatasetIllustrationStyle[];
      imageTags: Record<string, string[]>;
    }
  | { ok: false; message: string };

function normalizeTag(t: string): string {
  return t.trim().slice(0, 48);
}

export async function assignIllustrationStylesFromDatasetImages(options: {
  images: DatasetFile[];
}): Promise<AssignIllustrationStylesResult> {
  /** Screenshoty celých stránek (layout) patří jen k struktuře knihy — ne do kategorií ilustračního stylu. */
  const vision = options.images
    .filter(
      (f) => f.kind === 'image' && f.url?.startsWith('http') && f.referenceRole !== 'layout',
    )
    .slice(0, MAX_IMAGES);
  if (vision.length === 0) {
    return { ok: true, styles: [], imageTags: {} };
  }

  const validIds = new Set(vision.map((f) => f.id));

  const catalog = vision
    .map((f) => {
      const role =
        f.referenceRole === 'layout'
          ? ' [layout]'
          : f.referenceRole === 'illustration'
            ? ' [ilustrace]'
            : '';
      return `- id: "${f.id}" | name: ${f.name}${role}${f.referenceNote ? ` | note: ${f.referenceNote}` : ''}`;
    })
    .join('\n');

  const intro = `## Katalog (použij přesně hodnoty "id")

${catalog}

## Úkol

Seskupte obrázky podle vizuálního stylu. V \`promptHint\` u každého stylu popiš jen vizuální jazyk (replikace stylu), ne obsah obrázků. Vrať JSON podle systémového zadání.`;

  const parts: ChatMessageContentPart[] = [{ type: 'text', text: intro }];

  let loaded = 0;
  for (let i = 0; i < vision.length; i++) {
    const f = vision[i];
    const img = await fetchUrlAsImagePart(f.url);
    if (!img) continue;
    loaded++;
    parts.push({
      type: 'text',
      text: `\n[Image id=${f.id}]\n`,
    });
    parts.push(img);
  }

  const userContent: string | ChatMessageContentPart[] =
    loaded === 0
      ? `${intro}\n(Obrázky se nepodařilo načíst — vrať jeden styl se všemi id a prázdnými tagy.)`
      : parts;

  try {
    const raw = await chatWithAIProxy(
      [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userContent }],
      'gemini-3-flash',
      { temperature: 0.2, max_tokens: 16384, thinking_level: 'low' },
    );

    const json = extractJsonObjectFromModelText(raw);
    if (typeof json !== 'object' || json === null || Array.isArray(json)) {
      return { ok: false, message: 'AI nevrátila platný JSON se styly.' };
    }
    const o = json as Record<string, unknown>;
    const stylesRaw = o.styles;
    if (!Array.isArray(stylesRaw) || stylesRaw.length === 0) {
      return { ok: false, message: 'V odpovědi chybí pole styles.' };
    }

    const ts = Date.now();
    const styles: DatasetIllustrationStyle[] = [];
    const used = new Set<string>();

    for (let i = 0; i < Math.min(stylesRaw.length, 12); i++) {
      const row = stylesRaw[i];
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const name = typeof r.name === 'string' ? r.name.trim().slice(0, 120) : '';
      const ids = Array.isArray(r.imageIds) ? r.imageIds.filter((x): x is string => typeof x === 'string') : [];
      const promptHint =
        typeof r.promptHint === 'string' ? r.promptHint.trim().slice(0, 6000) : undefined;
      if (!name || ids.length === 0) continue;
      const imageIds: string[] = [];
      for (const id of ids) {
        if (!validIds.has(id) || used.has(id)) continue;
        used.add(id);
        imageIds.push(id);
      }
      if (imageIds.length === 0) continue;
      styles.push({
        id: `ds-istyle-${ts}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        promptHint:
          promptHint ||
          'Match the visual language of the references: medium, line quality, palette, lighting, and texture. Style replication only — no prescribed subject. Suitable for textbook imagery; no readable text in the image.',
        imageIds,
        source: 'auto',
      });
    }

    for (const id of validIds) {
      if (!used.has(id)) {
        const orphan = vision.find((f) => f.id === id);
        styles.push({
          id: `ds-istyle-${ts}-orph-${Math.random().toString(36).slice(2, 7)}`,
          name: orphan ? `Ostatní — ${orphan.name.slice(0, 40)}` : 'Ostatní',
          promptHint:
            'Match the single reference’s visual style only: medium, line work, color, lighting, and texture. Do not describe what is depicted. No readable text in the image.',
          imageIds: [id],
          source: 'auto',
        });
        used.add(id);
      }
    }

    const imageTags: Record<string, string[]> = {};
    const tagsRaw = o.imageTags;
    if (tagsRaw && typeof tagsRaw === 'object' && !Array.isArray(tagsRaw)) {
      for (const id of validIds) {
        const v = (tagsRaw as Record<string, unknown>)[id];
        if (!Array.isArray(v)) continue;
        const tags = v
          .filter((x): x is string => typeof x === 'string')
          .map(normalizeTag)
          .filter(Boolean)
          .slice(0, 6);
        if (tags.length) imageTags[id] = tags;
      }
    }

    if (styles.length === 0) {
      return { ok: false, message: 'Nepodařilo se sestavit žádný styl.' };
    }

    return { ok: true, styles, imageTags };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[design-system-auto-illustration-styles]', e);
    return { ok: false, message: msg || 'Seskupení stylů selhalo.' };
  }
}
