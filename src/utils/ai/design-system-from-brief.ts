/**
 * Textový brief a/nebo referenční obrázky (Storage URL, včetně screenshotu stránky) → Gemini vision → patch → uložení.
 *
 * Pipeline:
 * - **Krok 0:** výřezy ilustrací z nahraných layout stránek (jen při spuštění generování, ne při uploadu).
 * - **Krok 1:** `gemini-3-flash` — záměr publikace — běží **paralelně** s krokem 0 (jen text + názvy souborů, ne pixely výřezů).
 * - **Krok 2:** `gemini-3.1-pro` — multimodální patch — až **po** dokončení kroku 0 (potřebuje finální sadu obrázků včetně výřezů).
 *   Do uživatelské zprávy se doplní výstup agenta záměru; po validaci se `generationBlockTypes` **sloučí** do patch.
 * - **Krok 2b:** `gemini-3.1-pro` — jen u layout referencí (ne ilustrační výřezy): patch na `pageDefaults`, typografii (včetně \`textColor\` pro h1–caption), `defaultVisualStyles`, aby tokeny seděly na pixely stránky.
 * - Rozklad `suggestedLayouts` → `customLayouts` dělá TS v `buildDesignSystemForSave`.
 * - **UI:** `onPipelineEvent` — bobánky v `DesignSystemAgentLogPanel`.
 * - Přehled: `docs/design-system-ai-pipeline.md`
 */

import { chatWithAIProxy, type ChatMessageContentPart, type ChatProxyMessage } from '../ai-chat-proxy';
import { saveDesignSystem } from '../supabase/design-system-storage';
import {
  GENERATION_BLOCK_TYPE_OPTIONS,
  createEmptyDesignSystem,
  type BlockType,
  type DesignSystem,
  type DesignSystemDataset,
  type DatasetFile,
  type IllustrationStyleProposal,
} from '../../types/design-system';
import {
  extractJsonObjectFromModelText,
  sanitizeDesignSystemAgentPatch,
  buildDesignSystemForSave,
  applyDesignSystemAgentPatch,
  type DesignSystemAgentPatch,
} from '../../types/design-system-agent';
import type { DesignSystemPipelineEvent } from './design-system-pipeline-types';
import {
  expandDatasetWithLayoutIllustrationCrops,
  DESIGN_SYSTEM_MAX_REFERENCE_IMAGES,
} from './design-system-reference-upload-analyze';

const MAX_VISION_IMAGES = 6;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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

const SYSTEM_PROMPT = `You are a design-token generator for educational book worksheets (Vividbooks).

The user message may include reference images (pixels) plus a short text catalog describing each image (subject, shot type, use case). Infer palette, density, and illustration/photo style from those images when present, and align colors, typography, and especially aiPrompts.imageStyle with what you see. Treat catalog lines as authoritative metadata about what each reference represents.

When images look like full pages, slides, or UI mockups (screenshots), treat them as the primary source: identify dominant and accent colors (guess hex from large regions), typography hierarchy (relative scale, weight, serif vs sans mood), margins and background, recurring layout patterns, and illustration vs photo vs flat vector style. Decompose into the same JSON token structure; use suggestedLayouts to approximate visible column/image/text structure where reasonable.

Catalog lines may include [role: layout …] vs [role: illustration …]. Layout screenshots drive page structure, palette, typography, suggestedLayouts. Illustration-tagged images (including auto-crops) drive aiPrompts.imageStyle and characterStyle. If both exist, do not let a small decorative figure on the layout screenshot override imageStyle when dedicated illustration references are present.

**Text-only brief — no reference images attached (user message has no layout/illustration screenshots):**
- There are **no pixels** to sample. **Omit** \`referenceAssetBindings\` (do not include the key or use an empty array).
- You MUST still output a **complete, coherent** design: \`colors\` (**exactly two** groups: \`primary\` „Primární barvy“ + \`muted\` „Tlumené barvy“ — see Allowed keys), \`typography\` (including \`styles\` with **distinct** \`textColor\` for h1–h3 vs body vs caption — choose hues that fit the **subject, age group, and tone** in the brief, e.g. warm/friendly for younger readers, restrained academic blues/greys for secondary science), \`pageDefaults\`, \`defaultVisualStyles\`, \`aiPrompts\`, \`suggestedLayouts\`, and Czech \`visualStyleNotes\` **without** [n] catalog citations (refer to „podle zadání“ / topic).
- You MUST output \`blockPreferences.pageLayoutGroups\`: **1–4** objects with \`previewKind\`, \`title\`, and Czech \`rules\` describing **typical page compositions** for this **publication type**. Use the **„Předchozí krok — záměr publikace“** block when present — especially **\`printForm\`** (childrens_story vs educational_school vs workbook_practice). **Never** default to the same two patterns (\`heading_row_infobox_image\` + \`wide_infobox_with_figure\`) for unrelated genres: for **childrens_story** prioritize illustration-led spreads (\`full_width_image\`, \`vertical_stack\`, \`full_width_text\`, \`heading_body_full_width\`) and **avoid** making the page look like a school textbook unless the brief asks for lesson boxes. If the intent block is **missing**, infer „dětská kniha / první čtení / pohádka“ from the brief and apply **childrens_story** layout rules. Mention in the first rule line that patterns are **conceptual (návrh podle typu tiskoviny, bez referenční stránky)**. **Omit** \`sourceCatalogIndices\` on each item.

**printForm vs. layout vocabulary (when intent block includes \`printForm\` — follow it strictly):**
- \`childrens_story\`: playful spreads, large art, breathing room — **not** the default textbook infobox row + wide lesson panel combo.
- \`educational_school\`: structured lesson pages — \`heading_row_infobox_image\`, \`wide_infobox_with_figure\`, \`two_column_text\` are appropriate.
- \`workbook_practice\`: tasks, lines, stacks — favor \`vertical_stack\` and exercise-oriented rules.

**Reference → tokens traceability (REQUIRED when the user message includes a numbered Reference images catalog with ≥1 image):**
- You MUST output \`blockPreferences.referenceAssetBindings\` (same key allowed at JSON root as \`referenceAssetBindings\` — both are accepted) as a non-empty array. Each item: \`{ "catalogIndex": number, "informs": string[], "rationale": string }\`.
  - \`catalogIndex\`: 1-based index matching the numbered lines in the Reference images catalog (1 = first image in the list).
  - \`informs\`: subset of EXACTLY these English tokens (use only these strings): "page_background", "page_grid", "typography", "color_palette", "content_block_chrome", "figure_and_caption", "illustration_style", "layout_templates". Map each reference to every design aspect it informed (a single image may have multiple informs).
  - \`rationale\`: one short sentence in Czech: what you took from that file for those aspects.
- You MUST also output \`blockPreferences.visualStyleNotes\` (or root \`visualStyleNotes\`) with the five optional string fields \`pageBackground\`, \`paragraphText\`, \`contentBlocks\`, \`embeddedImage\`, \`padding\` — Czech prose. **If** reference images exist: each non-empty field MUST cite catalog indices in brackets, e.g. „Z [1] …“. **If** there are no images: Czech prose only, no [n] indices.
- Your numeric tokens (\`pageDefaults\`, \`colors\`, \`typography\`, \`defaultVisualStyles\`, \`suggestedLayouts\`, \`aiPrompts\`) must be consistent with these bindings: do not claim a look that is not supported by the cited references.

**Skupiny layoutů na stránce (REQUIRED in both cases: (a) layout screenshots in catalog, OR (b) text-only brief — see „Text-only brief“ above):**
- Output \`blockPreferences.pageLayoutGroups\` (root \`pageLayoutGroups\` is also accepted): an array of **1–8** objects: \`{ "title": string, "rules": string[], "previewKind": string, "sourceCatalogIndices"?: number[], "id"?: string }\`.
- **With reference pages:** each object is one **recurring structural pattern** visible on the screenshots — include distinct layout types (full-width text, full-bleed image, two-column body, stacked blocks, infobox rows, etc.). One page may yield **multiple** groups.
- **Text-only:** fewer items (1–4) are enough; infer from bookKind + topic (see top of this prompt).
- \`title\`: short **descriptive** Czech name (what this pattern is for — e.g. „Čistý výkladový text“, „Celostránkový pás s fotkou“).
- \`rules\` (REQUIRED, **3–10** strings): **faithful, concrete** Czech rules — each string one aspect. Always clarify: **order** of blocks (shora dolů / zleva doprava), **approximate width** (e.g. 8/12 + 4/12, full width), **what building blocks** a future content AI should use (nadpis, odstavec, obrázek, infobox, popisek, odpovědní linky…), **typography role** (H2 modrý, kurzíva popisku), **chrome** (rámeček, zaoblení). These rules are the **blueprint** for assembling page content — be specific, not generic.
- \`previewKind\` (REQUIRED): exactly **one** of these English tokens (pick the **closest** structural match):
  - \`heading_row_infobox_image\` — nadpis sekce **nad** řádkem; pod ním **jeden řádek** ~⅔ text/infobox + ~⅓ obrázek s popiskem.
  - \`wide_infobox_with_figure\` — **jeden široký** panel; často **vnitřní lišta** s nadpisem; **text + figura** vedle sebe **uvnitř** panelu.
  - \`heading_body_full_width\` — **nadpis** a pod ním **souvislý text přes šířku** (bez obrázku vedle v jednom řádku).
  - \`full_width_text\` — **jen odstavce přes šířku** (výklad bez dominantního nadpisu sekce nebo velkého obrázku v rozvržení).
  - \`full_width_image\` — **dominantní obrázek / fotka přes šířku** (pás, hero, téměř celá stránka) + typicky popisek.
  - \`two_column_text\` — **dva sloupce** souvislého textu (novinová sazba).
  - \`vertical_stack\` — bloky **striktně pod sebou** v konkrétním pořadí (např. nadpis → obrázek → text); **v rules** vypiš pořadí bloků čísly.
- \`sourceCatalogIndices\`: optional 1-based catalog indices of screenshots that best exemplify this pattern.

**Pixel fidelity when layout screenshots are attached (CRITICAL):**
- If any reference shows a full page, slide, or mockup with visible paper, body text, panels, or colored boxes, sample \`pageDefaults.pageBackgroundColor\`, \`typography.styles.body\` (textColor, fontSize, fontWeight), \`typography.styles.caption\`, and \`blockPreferences.defaultVisualStyles\` from those pixels. Do **not** leave generic placeholders (e.g. pure \`#ffffff\` paper, neutral grey body, default “soft yellow” infobox) unless the reference genuinely looks like that.
- Colored sidebars, tinted paper, dark-on-light or light-on-dark schemes, and real infobox/chip colors on the page must be reflected in tokens — not overwritten by stock defaults.

**Typography ink colors (CRITICAL when layout pages show text):**
- Set \`textColor\` (hex) separately for **each** level you can infer: \`styles.h1\`/\`h2\`/\`h3\` (section/chapter titles), \`styles.body\` (main paragraphs), \`styles.caption\` (labels under figures). On real textbooks, **headings are often a distinct color** (e.g. navy or brand blue) while **body** is dark grey — do **not** use one default grey for everything.
- If captions appear **italic** on the page, set \`styles.caption.isItalic\`: true and a \`textColor\` that matches the caption ink (often slightly lighter grey than body).
- Prefer sampling from **legible text regions** on the screenshot; output \`#RRGGBB\` only.

Return ONE JSON object only. No markdown fences, no commentary before or after the JSON.

Allowed keys (all optional, but provide enough to be useful — at least name + colors + typography + aiPrompts.imageStyle).
Always include suggestedLayouts with 4–8 entries when the user describes a book or worksheet style (stored as page layout templates):
- name: string (short title, Czech if the user wrote Czech)
- description: string
- thumbnail_color: "#RRGGBB"
- colors: **exactly two** groups (no third group — do not use secondary/neutral/accent as separate groups):
  1) \`{ "id": "primary", "name": "Primární barvy", "swatches": [...] }\` — **saturated** brand and accent tones (dominant hues, illustration/UI „loud“ colors).
  2) \`{ "id": "muted", "name": "Tlumené barvy", "swatches": [...] }\` — **muted** tones: paper/off-white, text greys, soft borders, desaturated supporting tints.
  At least **8** swatches total across both groups. Hex only.
- typography: { "headingFont": "Poppins", "bodyFont": "Inter", "baseFontSize": "small"|"normal"|"large",
    "styles"?: { "h1"|"h2"|"h3"|"body"|"caption": { "fontSize"?: number, "textColor"?: "#hex", "fontWeight"?: number, "isItalic"?: boolean } } }
  Fonts: common Google font family names only (single word or known pair like "Source Sans 3"). **Always set distinct \`textColor\` for headings vs body vs caption** when references show different inks **or** when inventing a palette for a text-only brief (genre-appropriate, not identical hex for all levels).
- pageDefaults: { "pageFormat": "a4"|"b5"|"a5", "pageBackgroundColor": "#hex", "gridColumns": 1|2|3|6|12, "gridGap": "none"|"small"|"medium"|"large" }
  Set "pageBackgroundColor" deliberately when references or brief imply it (warm paper e.g. #FFFBF5, cool off-white #F8FAFC, very light tint from palette). Use #ffffff when neutral. This replaces manual canvas controls — you decide from context.
- aiPrompts: { "imageStyle": string (detailed art direction for textbook illustrations), "negativePrompt"?: string, "characterStyle"?: string }
- **illustrationStyleProposals** (root key, optional but STRONGLY recommended when the publication uses illustrations): array of **3–6** objects — **distinct alternative** English image-generation prompts the teacher can pick from in the UI and attach as illustration styles. Each: \`{ "id"?: string, "name": string (short Czech label), "promptHint": string (English, concrete art direction: technique, line, color, abstraction level), "negativePromptHint"?: string (English), "rationale"?: string (Czech — when to choose this variant) }\`. Variants must **differ visibly** (e.g. soft watercolor vs flat geometric vs textured collage). The main \`aiPrompts.imageStyle\` can summarize the default; proposals offer **alternatives**. Omit only if the brief explicitly excludes illustrations.
- blockPreferences: {
    "preferred": string[] (subset you recommend starring in the editor — only types also listed in generationBlockTypes),
    "generationBlockTypes": string[] — REQUIRED: full list of block types this publication may use. Choose based on the brief:
      • Narrative textbook / story book / reading book: OMIT worksheet-style activities — do NOT include multiple-choice, fill-blank, free-answer, connect-pairs, image-hotspots, video-quiz, examples (math drills). Include heading, paragraph, infobox, image, table, chart, layout-section, spacer, header-footer, qr-code; include free-canvas only if the brief asks for drawing/creative canvas.
      • Workbook / pracovní list / test / exercises: include activity types as appropriate (multiple-choice, fill-blank, free-answer, examples, connect-pairs, etc.).
    Same token names as preferred: heading, paragraph, infobox, image, table, multiple-choice, fill-blank, free-answer, connect-pairs, image-hotspots, examples, spacer, qr-code, free-canvas, chart, layout-section, header-footer, video-quiz
    "defaultVisualStyles"?: object — when the brief fits (workbook cards, soft frames, highlighted lesson blocks), set default CSS-like look for NEW content blocks after teachers apply this design system (not layout-section, header-footer, spacer). Omit for a flat neutral look.
      Optional keys (hex with #): "backgroundColor", "borderColor"; numbers: "borderWidth" 0–16, "borderRadius" 0–64; "borderStyle": "solid"|"dashed"|"dotted"; "shadow": "none"|"small"|"medium"|"large"; "displayPreset": "normal"|"infobox"|"highlight"|"custom"
    "visualStyleNotes"?: { "pageBackground"?: string, "paragraphText"?: string, "contentBlocks"?: string, "embeddedImage"?: string, "padding"?: string } — Czech; cite [catalogIndex] only when reference images exist
    "referenceAssetBindings"?: [ { "catalogIndex": number, "informs": string[], "rationale": string } ] — REQUIRED only when reference images exist (see traceability); omit when text-only
    "pageLayoutGroups"?: [ { "title": string, "rules": string[], "previewKind": "heading_row_infobox_image"|"wide_infobox_with_figure"|"heading_body_full_width"|"full_width_text"|"full_width_image"|"two_column_text"|"vertical_stack", "sourceCatalogIndices"?: number[], "id"?: string } ] — REQUIRED: with screenshots **or** text-only brief; each item MUST set \`previewKind\` (see „Skupiny layoutů na stránce“)
  }
- suggestedLayouts: array of 4–8 page layout templates suitable for this brief (required for worksheet-style briefs). Each item:
  { "group": "column"|"half"|"twothirds", "name": string (short Czech), "description": string (one line — when to use),
    "slots": [ { "type": MUST be exactly one of: "heading"|"paragraph"|"image"|"infobox"|"gallery" (not "text" or "body"), "span": 1–12,
      "level"?: "h1"|"h2"|"h3" (for heading),
      "columns"?: 1|2|3 (paragraph multi-column),
      "galleryColumns"?, "galleryCount"? (for gallery),
      "floatSide"?: "left"|"right", "floatSpanBlocks"?, "floatGridSpan"? (side image/gallery + text stack)
    } ] }
  Rules: 12-column grid per row; sum of spans in one row must not exceed 12. Prefer varied groups (intro pages, text+image, infobox summaries, gallery spreads).

Do NOT include: id, teacher_id, created_at, updated_at. You MAY include root-level \`illustrationStyleProposals\` (see above) — it is merged into the saved dataset by the app, not part of the strict patch schema.`;

/** Minimální textový brief (znaky) pokud nejsou obrázky. */
export const DESIGN_SYSTEM_BRIEF_MIN_CHARS = 8;

const SCREENSHOT_FIRST_INSTRUCTIONS = `Your main task is visual analysis of the attached image(s). They may be textbook pages, worksheets, slides, posters, or app/book mockups.

1) Colors: sample dominant background, text, accents, borders — output **exactly two** groups: \`primary\` / „Primární barvy“ (saturated) and \`muted\` / „Tlumené barvy“ (greys, paper, soft chrome). At least 8 swatches total. Hex only.
2) Typography: infer heading vs body relationship (scale, weight, sans/serif feel). Pick Google Font families that best match the mood if an exact match is unknown. **Per-level ink:** set \`typography.styles.h2\` or \`h3\` \`textColor\` for blue/dark section titles, \`styles.body.textColor\` for paragraph grey, \`styles.caption\` + \`isItalic\` if captions are italic — do not use one generic grey for all.
3) Page feel: pageBackgroundColor, grid density, spacing mood (tight vs airy).
4) Imagery: describe illustration/photo/flat/icon style for aiPrompts.imageStyle and optional negativePrompt.
5) Name: derive a short Czech-friendly system name from visible title, subject, or overall mood if no title is readable.
6) suggestedLayouts: propose 4–8 layouts inspired by structures you see (multi-column text, image+text, infobox-like panels, etc.).
7) **referenceAssetBindings** + **visualStyleNotes**: REQUIRED — map each numbered catalog image to the design aspects it drove (\`informs\` tokens) and fill Czech \`visualStyleNotes\` with explicit [n] citations (same rules as main system prompt).
8) **Match pixels on layout pages:** \`pageBackgroundColor\`, body/caption text colors, and default block chrome (infobox panels) must follow what you see on the screenshot — avoid generic defaults that ignore obvious tints, contrasts, and panel colors.
9) **pageLayoutGroups:** when you have full-page or layout screenshots, output 1–8 \`blockPreferences.pageLayoutGroups\` (see main system prompt): **previewKind** + **detailed Czech rules** (building blocks, order, proportions) + titles. Include plain full-width text, full-width image, two-column text, stacks, etc. when visible.

Return the same single JSON object schema as for a text-only brief.`;

function countHttpImagesInDataset(dataset: DesignSystemDataset | undefined): number {
  return (dataset?.files ?? []).filter((f) => f.kind === 'image' && f.url?.startsWith('http')).length;
}

function visionCatalogLine(f: DatasetFile, index: number): string {
  const roleHint =
    f.referenceRole === 'layout'
      ? ' [role: layout screenshot — page structure, colors, typography; not sole art-style source]'
      : f.referenceRole === 'illustration'
        ? ' [role: illustration — art style for aiPrompts / characters]'
        : '';
  const note = f.referenceNote ? ` — ${f.referenceNote}` : ' — (no catalog note)';
  return `${index + 1}. ${f.name}${roleHint}${note}`;
}

export type GenerateDesignSystemFromBriefResult =
  | { ok: true; designSystem: DesignSystem }
  | { ok: false; message: string };

export type GenerateDesignSystemFromBriefOptions = {
  /** Uloží se beze změny spolu s výstupem AI (URL obrázků, textové soubory, topic). */
  dataset?: DesignSystemDataset;
  /** Průběh multi-kroků (bobánky v UI). */
  onPipelineEvent?: (e: DesignSystemPipelineEvent) => void;
};

const ALLOWED_GEN_BLOCK = new Set<BlockType>(GENERATION_BLOCK_TYPE_OPTIONS.map((o) => o.type));

const PIPELINE_CROPS = 'crops';
const PIPELINE_PREPARE = 'prepare';
const PIPELINE_INTENT = 'intent';
const PIPELINE_DESIGN = 'design';
const PIPELINE_REFINE = 'refine';
const PIPELINE_SAVE = 'save';

const MAX_LAYOUT_REFINE_IMAGES = 3;

const REFINE_LAYOUT_VISUAL_SYSTEM = `You align design tokens with PIXELS from textbook/worksheet page screenshots.

You receive (1) current JSON for pageDefaults, typography (body/caption styles), blockPreferences.defaultVisualStyles / visualStyleNotes, and (2) attached layout images (full pages or layout screenshots; not small illustration crops).

Return ONE JSON object only. Allowed OPTIONAL top-level keys ONLY:
- pageDefaults (partial): pageBackgroundColor, pageFormat, gridColumns, gridGap
- typography (partial): headingFont, bodyFont, baseFontSize, styles (only h1–h3, body, caption sub-keys you change)
- blockPreferences (partial): defaultVisualStyles, visualStyleNotes

Rules:
- Change only what the screenshots contradict or improve; omit keys that are already correct.
- Never emit generic #ffffff or stock infobox yellow if the page clearly shows different paper tint, text color, or panel colors — sample plausible hex from large regions.
- **Typography colors (highest priority):** Visually compare **section titles / chapter headings** vs **running body paragraphs** vs **figure captions** on the screenshot. They are often **different hex colors** (e.g. headings = brand blue #2B4492, body = dark grey #2D3436 or #455A64, captions = softer grey, sometimes italic). For each role, set \`typography.styles.h1\`/\`h2\`/\`h3\`/\`body\`/\`caption\` with accurate \`textColor\` (#RRGGBB) sampled from **actual letter pixels** on the page (not guessed from memory). If caption text is italic on the page, set \`caption\` → \`isItalic\`: true. Do **not** copy one grey onto headings that are clearly blue or colored on the reference.
- Do NOT output: name, colors, aiPrompts, suggestedLayouts, generationBlockTypes, referenceAssetBindings, or unrelated keys.

No markdown fences, no commentary outside JSON.`;

function layoutReferenceImageFilesForRefinement(dataset: DesignSystemDataset): DatasetFile[] {
  return (dataset.files ?? [])
    .filter((f) => f.kind === 'image' && f.url?.startsWith('http') && f.referenceRole !== 'illustration')
    .slice(0, MAX_LAYOUT_REFINE_IMAGES);
}

/** Po sanitizaci hlavního agenta — nechat jen tokeny, které má krok 2b měnit (ne generationBlockTypes atd.). */
function pickVisualRefinementPatch(patch: DesignSystemAgentPatch): DesignSystemAgentPatch {
  const out: DesignSystemAgentPatch = {};
  if (patch.pageDefaults && Object.keys(patch.pageDefaults).length > 0) {
    out.pageDefaults = patch.pageDefaults;
  }
  if (patch.typography && Object.keys(patch.typography).length > 0) {
    out.typography = patch.typography;
  }
  const dvs = patch.blockPreferences?.defaultVisualStyles;
  const vsn = patch.blockPreferences?.visualStyleNotes;
  if ((dvs && Object.keys(dvs).length > 0) || (vsn && Object.keys(vsn).length > 0)) {
    out.blockPreferences = {};
    if (dvs && Object.keys(dvs).length > 0) {
      out.blockPreferences.defaultVisualStyles = dvs;
    }
    if (vsn && Object.keys(vsn).length > 0) {
      out.blockPreferences.visualStyleNotes = vsn;
    }
  }
  return out;
}

function visualRefinementPatchIsEmpty(p: DesignSystemAgentPatch): boolean {
  if (p.pageDefaults && Object.keys(p.pageDefaults).length > 0) return false;
  if (p.typography && Object.keys(p.typography).length > 0) return false;
  const dvs = p.blockPreferences?.defaultVisualStyles;
  const vsn = p.blockPreferences?.visualStyleNotes;
  if (dvs && Object.keys(dvs).length > 0) return false;
  if (vsn && Object.keys(vsn).length > 0) return false;
  return true;
}

function snapshotTokensForLayoutRefinement(ds: DesignSystem): string {
  return JSON.stringify(
    {
      pageDefaults: ds.pageDefaults,
      typography: {
        headingFont: ds.typography.headingFont,
        bodyFont: ds.typography.bodyFont,
        baseFontSize: ds.typography.baseFontSize,
        styles: {
          body: ds.typography.styles?.body,
          caption: ds.typography.styles?.caption,
          h1: ds.typography.styles?.h1,
          h2: ds.typography.styles?.h2,
          h3: ds.typography.styles?.h3,
        },
      },
      blockPreferences: {
        defaultVisualStyles: ds.blockPreferences.defaultVisualStyles,
        visualStyleNotes: ds.blockPreferences.visualStyleNotes,
      },
    },
    null,
    0,
  );
}

async function refineVisualTokensFromLayoutScreenshots(
  mergedAfterMainAgent: DesignSystem,
  dataset: DesignSystemDataset,
  onPipelineEvent: GenerateDesignSystemFromBriefOptions['onPipelineEvent'],
): Promise<DesignSystemAgentPatch | null> {
  const files = layoutReferenceImageFilesForRefinement(dataset);
  if (files.length === 0) return null;

  emitPipeline(
    onPipelineEvent,
    PIPELINE_REFINE,
    'Doladění vizuálních tokenů podle layout screenshotů…',
    'running',
  );

  const parts: ChatMessageContentPart[] = [
    {
      type: 'text',
      text: `Current tokens (JSON):\n${snapshotTokensForLayoutRefinement(mergedAfterMainAgent)}\n\nAdjust using the attached layout page image(s). Return only the JSON patch.`,
    },
  ];

  let loaded = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const img = f.url ? await fetchUrlAsImagePart(f.url) : null;
    if (!img) continue;
    loaded++;
    parts.push({
      type: 'text',
      text: `\n[Layout reference ${i + 1}${f.referenceNote ? `: ${f.referenceNote}` : ''}]\n`,
    });
    parts.push(img);
  }

  if (loaded === 0) {
    emitPipeline(
      onPipelineEvent,
      PIPELINE_REFINE,
      'Doladění vizuálních tokenů podle layout screenshotů…',
      'done',
      'Obrázky se nepodařilo načíst — přeskočeno',
    );
    return null;
  }

  try {
    const raw = await chatWithAIProxy(
      [{ role: 'system', content: REFINE_LAYOUT_VISUAL_SYSTEM }, { role: 'user', content: parts }],
      'gemini-3.1-pro',
      { temperature: 0.15, max_tokens: 6144, thinking_level: 'low' },
    );
    let json: unknown;
    try {
      json = extractJsonObjectFromModelText(raw);
    } catch {
      emitPipeline(
        onPipelineEvent,
        PIPELINE_REFINE,
        'Doladění vizuálních tokenů podle layout screenshotů…',
        'done',
        'Odpověď nešla parsovat — přeskočeno',
      );
      return null;
    }
    let sanitized: DesignSystemAgentPatch;
    try {
      sanitized = sanitizeDesignSystemAgentPatch(json);
    } catch {
      emitPipeline(
        onPipelineEvent,
        PIPELINE_REFINE,
        'Doladění vizuálních tokenů podle layout screenshotů…',
        'done',
        'Nepoužitelný patch — přeskočeno',
      );
      return null;
    }
    const patch = pickVisualRefinementPatch(sanitized);
    if (visualRefinementPatchIsEmpty(patch)) {
      emitPipeline(
        onPipelineEvent,
        PIPELINE_REFINE,
        'Doladění vizuálních tokenů podle layout screenshotů…',
        'done',
        'Beze změny',
      );
      return null;
    }
    emitPipeline(
      onPipelineEvent,
      PIPELINE_REFINE,
      'Doladění vizuálních tokenů podle layout screenshotů…',
      'done',
    );
    return patch;
  } catch (e: unknown) {
    const dm = e instanceof Error ? e.message : String(e);
    emitPipeline(
      onPipelineEvent,
      PIPELINE_REFINE,
      'Doladění vizuálních tokenů podle layout screenshotů…',
      'error',
      dm.slice(0, 120),
    );
    return null;
  }
}

function emitPipeline(
  onPipelineEvent: GenerateDesignSystemFromBriefOptions['onPipelineEvent'],
  stepId: string,
  label: string,
  status: DesignSystemPipelineEvent['status'],
  detail?: string,
) {
  onPipelineEvent?.({ stepId, label, status, detail });
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

/** Z kořenového JSON od hlavního agenta — neprochází sanitizeDesignSystemAgentPatch. */
function extractIllustrationStyleProposals(raw: unknown): IllustrationStyleProposal[] | undefined {
  if (!isRecord(raw)) return undefined;
  const arr = raw.illustrationStyleProposals;
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  const out: IllustrationStyleProposal[] = [];
  let nonce = 0;
  for (const item of arr.slice(0, 8)) {
    if (!isRecord(item)) continue;
    const name = typeof item.name === 'string' ? item.name.trim().slice(0, 120) : '';
    const promptHint = typeof item.promptHint === 'string' ? item.promptHint.trim().slice(0, 8000) : '';
    if (!name || !promptHint) continue;
    const id =
      typeof item.id === 'string' && item.id.trim()
        ? item.id.trim().slice(0, 80)
        : `ill-prop-${Date.now()}-${nonce++}`;
    const negativePromptHint =
      typeof item.negativePromptHint === 'string' ? item.negativePromptHint.trim().slice(0, 2000) : undefined;
    const rationale = typeof item.rationale === 'string' ? item.rationale.trim().slice(0, 800) : undefined;
    out.push({
      id,
      name,
      promptHint,
      ...(negativePromptHint ? { negativePromptHint } : {}),
      ...(rationale ? { rationale } : {}),
    });
  }
  return out.length ? out : undefined;
}

/** Formát tiskoviny — řídí návrh skupin layoutů (ne jen bookKind). */
export type PublicationPrintForm =
  | 'childrens_story'
  | 'educational_school'
  | 'workbook_practice'
  | 'general_mixed';

/** První krok: typ knihy + formát tiskoviny + doporučené typy bloků (bez pixelů — rychlý Flash). */
const PUBLICATION_INTENT_SYSTEM = `Jsi specialista na české učebnice, dětské knihy a pracovní sešity (Vividbooks).

Vrať POUZE jeden JSON objekt, bez markdownu.

{
  "bookKind": "textbook" | "worksheet" | "mixed",
  "printForm": "childrens_story" | "educational_school" | "workbook_practice" | "general_mixed",
  "generationBlockTypes": string[],
  "rationale": string
}

- bookKind: textbook = výklad/čtení; worksheet = cvičení; mixed = obojí.
- **printForm** (povinné) — odvozuj ze zadání (slova, účel, cílovka):
  - **childrens_story**: pohádka, leporelo, kniha pro děti, první čtení, veselá/ilustrovaná beletrie pro malé čtenáře, obrázková kniha — NENÍ školní učebnice.
  - **educational_school**: učebnice, skripta, výkladové materiály pro školu, předmětové texty.
  - **workbook_practice**: pracovní sešit, pracovní listy, testy, pracovní díly.
  - **general_mixed**: když to nejde jednoznačně zařadit.

generationBlockTypes: vyber podmnožinu z těchto tokenů (anglicky, přesně):
heading, paragraph, infobox, image, table, multiple-choice, fill-blank, free-answer, connect-pairs, image-hotspots, examples, spacer, qr-code, free-canvas, chart, layout-section, header-footer, video-quiz

Minimálně 8 typů. Přizpůsob bookKind i printForm (u childrens_story nevyžaduj aktivity jako u pracovního sešitu). rationale: jedna věta česky.`;

export type PublicationIntentResult = {
  bookKind: 'textbook' | 'worksheet' | 'mixed';
  printForm: PublicationPrintForm;
  generationBlockTypes: BlockType[];
  rationale: string;
};

/** Když model vrátí general_mixed, zkusíme z textu poznat dětskou knihu / pracovní sešit. */
function inferPrintFormFromBrief(trimmed: string): PublicationPrintForm {
  const t = trimmed.toLowerCase();
  if (
    /dětsk|dět(í|i)\b|první čtení|pohád|leporel|obrázkov|básnič|vesel(á|ou) knih|říkadl|malí čtenář|čtenářsk/i.test(
      t,
    ) ||
    /\b(children'?s book|picture book|first reader|bedtime story)\b/i.test(trimmed)
  ) {
    return 'childrens_story';
  }
  if (/pracovní sešit|pracovní list|test|cvičení|úloh|pracovní mater/i.test(t)) {
    return 'workbook_practice';
  }
  if (/učebnic|školní|výklad|předmět|učivo|studijn/i.test(t)) {
    return 'educational_school';
  }
  return 'general_mixed';
}

function sanitizeIntentBlockTypes(raw: unknown): BlockType[] {
  if (!Array.isArray(raw)) return [];
  const out: BlockType[] = [];
  for (const t of raw) {
    if (typeof t !== 'string') continue;
    if (!ALLOWED_GEN_BLOCK.has(t as BlockType)) continue;
    if (!out.includes(t as BlockType)) out.push(t as BlockType);
  }
  return out.slice(0, 32);
}

function buildIntentUserText(trimmed: string, dataset: DesignSystemDataset): string {
  const imgs = (dataset.files ?? []).filter((f) => f.kind === 'image');
  const catalog =
    imgs.length === 0
      ? '(žádné referenční obrázky v katalogu)'
      : imgs
          .map((f, i) => {
            const role = f.referenceRole ? ` [${f.referenceRole}]` : '';
            const note = f.referenceNote ? ` — ${f.referenceNote}` : '';
            return `${i + 1}. ${f.name}${note}${role}`;
          })
          .join('\n');
  return `## Textové zadání\n${trimmed.slice(0, 8000)}\n\n## Katalog nahraných referencí (jen názvy, bez obrázků)\n${catalog}\n\nRozhodni záměr publikace a vrať JSON.`;
}

async function runPublicationIntentAgent(
  trimmed: string,
  dataset: DesignSystemDataset,
  onPipelineEvent: GenerateDesignSystemFromBriefOptions['onPipelineEvent'],
): Promise<PublicationIntentResult | null> {
  emitPipeline(
    onPipelineEvent,
    PIPELINE_INTENT,
    'Agent: Záměr publikace (typ knihy, formát tiskoviny, bloky)',
    'running',
  );
  try {
    const raw = await chatWithAIProxy(
      [
        { role: 'system', content: PUBLICATION_INTENT_SYSTEM },
        { role: 'user', content: buildIntentUserText(trimmed, dataset) },
      ],
      'gemini-3-flash',
      { temperature: 0.2, max_tokens: 2048, thinking_level: 'low' },
    );
    const json = extractJsonObjectFromModelText(raw);
    if (typeof json !== 'object' || json === null) throw new Error('intent json');
    const o = json as Record<string, unknown>;
    const bk = o.bookKind;
    const bookKind: PublicationIntentResult['bookKind'] =
      bk === 'worksheet' || bk === 'mixed' || bk === 'textbook' ? bk : 'mixed';
    const rawPf = o.printForm;
    let printForm: PublicationPrintForm =
      rawPf === 'childrens_story' ||
      rawPf === 'educational_school' ||
      rawPf === 'workbook_practice' ||
      rawPf === 'general_mixed'
        ? rawPf
        : 'general_mixed';
    if (printForm === 'general_mixed') {
      const inferred = inferPrintFormFromBrief(trimmed);
      if (inferred !== 'general_mixed') printForm = inferred;
    }
    const generationBlockTypes = sanitizeIntentBlockTypes(o.generationBlockTypes);
    const rationale = typeof o.rationale === 'string' ? o.rationale.slice(0, 500) : '';
    if (generationBlockTypes.length < 4) {
      emitPipeline(
        onPipelineEvent,
        PIPELINE_INTENT,
        'Agent: Záměr publikace (typ knihy, formát tiskoviny, bloky)',
        'done',
        'Výstup neúplný — použije se hlavní agent bez vynucení bloků.',
      );
      return null;
    }
    emitPipeline(
      onPipelineEvent,
      PIPELINE_INTENT,
      'Agent: Záměr publikace (typ knihy, formát tiskoviny, bloky)',
      'done',
      rationale || undefined,
    );
    return { bookKind, printForm, generationBlockTypes, rationale };
  } catch {
    emitPipeline(
      onPipelineEvent,
      PIPELINE_INTENT,
      'Agent: Záměr publikace (typ knihy, formát tiskoviny, bloky)',
      'done',
      'Krok přeskočen — pokračuje hlavní agent',
    );
    return null;
  }
}

const PRINT_FORM_LABEL_CS: Record<PublicationPrintForm, string> = {
  childrens_story: 'dětská beletrie / první čtení / obrázková kniha (ne učebnice)',
  educational_school: 'školská učebnice / výklad',
  workbook_practice: 'pracovní sešit / listy / testy',
  general_mixed: 'obecné / smíšené',
};

function appendIntentToDesignContext(baseText: string, intent: PublicationIntentResult | null): string {
  if (!intent) return baseText;
  const blockLine = intent.generationBlockTypes.join(', ');
  const pf = intent.printForm ?? 'general_mixed';
  const pfLabel = PRINT_FORM_LABEL_CS[pf] ?? pf;
  return `${baseText}

## Předchozí krok — záměr publikace (dodrž u blockPreferences.generationBlockTypes a **pageLayoutGroups**)
- bookKind: ${intent.bookKind}
- **printForm** (formát tiskoviny): \`${pf}\` — ${pfLabel}
- Doporučené typy bloků: ${blockLine}
- Odůvodnění: ${intent.rationale || '—'}

### Povinné chování pro \`blockPreferences.pageLayoutGroups\` podle printForm
- Pokud **printForm** je \`childrens_story\`: skupiny layoutů musí odpovídat **knížce pro děti** — velké ilustrace, vzduch, příběhová stránka. **Upřednostni** \`previewKind\`: \`full_width_image\`, \`vertical_stack\`, \`full_width_text\`, \`heading_body_full_width\`. **Nepoužívej** jako hlavní dva vzory stejnou kombinaci jako u učebnice: nezačínej vždy \`heading_row_infobox_image\` + \`wide_infobox_with_figure\` — ty jsou typické pro **educational_school**. Infoboxové řádky ⅔+⅓ dej jen pokud to zadání výslovně neodporuje dětské knize.
- Pokud **printForm** je \`educational_school\`: \`heading_row_infobox_image\`, \`wide_infobox_with_figure\`, \`two_column_text\` jsou žádoucí kde to sedí s výkladem.
- Pokud **printForm** je \`workbook_practice\`: častěji \`vertical_stack\`, úlohové bloky; stránky s cvičeními.
- Pokud **printForm** je \`general_mixed\`: vyvaž podle briefu.

Bez referenčních obrázků: barvy a typografie musí sedět s **printForm** (např. u childrens_story veselejší paleta, větší kontrast pro čtení, ne šedá učebnicová šablona).
`;
}

type BuiltUserContent = {
  content: ChatProxyMessage['content'];
  visionLoaded: number;
  visionAttempted: number;
};

async function buildUserContent(trimmed: string, dataset: DesignSystemDataset | undefined): Promise<BuiltUserContent> {
  const imageFiles = (dataset?.files ?? []).filter((f) => f.kind === 'image' && f.url?.startsWith('http'));
  const visionFiles = imageFiles.slice(0, MAX_VISION_IMAGES);

  if (visionFiles.length === 0) {
    return {
      content: `## Text-only design brief (no reference images)

Follow the system instructions for **text-only** runs: output full tokens including \`pageLayoutGroups\` (1–4 conceptual patterns for this book type), \`colors\` (**exactly** \`primary\` + \`muted\` groups), \`typography.styles\` with distinct \`textColor\` per level, \`visualStyleNotes\` in Czech without [n] indices, and omit \`referenceAssetBindings\`. Use the **„Předchozí krok — záměr publikace“** section when it is appended below.

---

### Brief

${trimmed.slice(0, 8000)}`,
      visionLoaded: 0,
      visionAttempted: 0,
    };
  }

  const catalogLines = visionFiles.map((f, i) => visionCatalogLine(f, i)).join('\n');

  const screenshotFirst = trimmed.length < DESIGN_SYSTEM_BRIEF_MIN_CHARS;
  const userNotes =
    trimmed.trim().length > 0
      ? trimmed.length < DESIGN_SYSTEM_BRIEF_MIN_CHARS
        ? `(Short user note: ${trimmed.slice(0, 500)})`
        : ''
      : '';

  const introText = screenshotFirst
    ? `Create a design system from the attached image(s).

${SCREENSHOT_FIRST_INSTRUCTIONS}

${userNotes ? `${userNotes}\n\n` : ''}## Reference image catalog (order matches attached images)

${catalogLines}

Use pixels from the attachments as the ground truth. If a catalog line describes the image role (e.g. „screenshot stránky“), follow it.
`
    : `Create a design system for this brief.

## Textový brief

${trimmed.slice(0, 8000)}

## Katalog referenčních obrázků (pořadí odpovídá přiloženým obrázkům)

${catalogLines}

Use the attached reference images: match palette, line quality, and mood. Apply catalog notes so different references can describe different roles (e.g. character vs texture vs layout). Merge into one coherent aiPrompts.imageStyle and a **two-group** \`colors\` array (\`primary\` „Primární barvy“ + \`muted\` „Tlumené barvy“) as required by the system prompt.

`;

  const visionParts: ChatMessageContentPart[] = [{ type: 'text', text: introText }];

  let loaded = 0;
  for (let i = 0; i < visionFiles.length; i++) {
    const f = visionFiles[i];
    const img = await fetchUrlAsImagePart(f.url);
    if (!img) continue;
    loaded++;
    visionParts.push({
      type: 'text',
      text: `\n[Reference ${i + 1}${f.referenceNote ? `: ${f.referenceNote}` : ''}]\n`,
    });
    visionParts.push(img);
  }

  if (loaded === 0) {
    return {
      content: `${introText}\n(Reference images could not be loaded from storage — proceed from text and catalog labels only.)`,
      visionLoaded: 0,
      visionAttempted: visionFiles.length,
    };
  }

  return { content: visionParts, visionLoaded: loaded, visionAttempted: visionFiles.length };
}

function applyIntentToUserContent(
  built: BuiltUserContent,
  intent: PublicationIntentResult | null,
): BuiltUserContent {
  if (!intent) return built;
  if (typeof built.content === 'string') {
    return { ...built, content: appendIntentToDesignContext(built.content, intent) };
  }
  const parts = built.content as ChatMessageContentPart[];
  if (parts.length === 0) return built;
  const first = parts[0];
  if (first.type === 'text' && first.text) {
    const copy = [...parts] as ChatMessageContentPart[];
    copy[0] = { type: 'text', text: appendIntentToDesignContext(first.text, intent) };
    return { ...built, content: copy };
  }
  return {
    ...built,
    content: [{ type: 'text', text: appendIntentToDesignContext('', intent) }, ...parts],
  };
}

/**
 * Zavolá AI (agent záměru publikace → hlavní agent design tokenů), parsuje patch, uloží do design_systems.
 * Dataset (referenční obrázky + textové soubory) se předá v `options` a uloží beze změny vedle výstupu z modelu.
 */
export async function generateAndSaveDesignSystemFromBrief(
  brief: string,
  existing: DesignSystem | null,
  options?: GenerateDesignSystemFromBriefOptions,
): Promise<GenerateDesignSystemFromBriefResult> {
  const trimmed = brief.trim();
  const baseDataset: DesignSystemDataset = options?.dataset ?? existing?.dataset ?? { files: [] };
  let workingDataset: DesignSystemDataset = {
    ...baseDataset,
    generationBrief: trimmed,
  };
  const hasHttpImages = countHttpImagesInDataset(workingDataset) > 0;
  const onPipelineEvent = options?.onPipelineEvent;

  if (trimmed.length < DESIGN_SYSTEM_BRIEF_MIN_CHARS && !hasHttpImages) {
    return {
      ok: false,
      message: 'Napiš aspoň pár slov o stylu, nebo nahraj screenshot stránky (obrázek).',
    };
  }

  try {
    emitPipeline(
      onPipelineEvent,
      PIPELINE_CROPS,
      'Výřezy ilustrací ze stránek (při generování)',
      'running',
    );
    /** Paralelně s ořezy: Flash agent jen z textu + katalogu jmen (bez výřezů v seznamu — stačí pro typ knihy). */
    const datasetPreCrops = workingDataset;
    const intentPromise = runPublicationIntentAgent(trimmed, datasetPreCrops, onPipelineEvent);
    try {
      workingDataset = await expandDatasetWithLayoutIllustrationCrops(workingDataset, {
        maxTotalImages: DESIGN_SYSTEM_MAX_REFERENCE_IMAGES,
      });
    } catch (cropErr: unknown) {
      const cropMsg = cropErr instanceof Error ? cropErr.message : String(cropErr);
      emitPipeline(
        onPipelineEvent,
        PIPELINE_CROPS,
        'Výřezy ilustrací ze stránek (při generování)',
        'error',
        cropMsg.slice(0, 120),
      );
      await intentPromise.catch(() => undefined);
      throw cropErr;
    }
    emitPipeline(
      onPipelineEvent,
      PIPELINE_CROPS,
      'Výřezy ilustrací ze stránek (při generování)',
      'done',
    );
    const intent = await intentPromise;

    emitPipeline(onPipelineEvent, PIPELINE_PREPARE, 'Připravuji vstup (text, katalog referencí)…', 'running');
    const built = await buildUserContent(trimmed, workingDataset);
    emitPipeline(onPipelineEvent, PIPELINE_PREPARE, 'Připravuji vstup (text, katalog referencí)…', 'done');

    if (trimmed.length < DESIGN_SYSTEM_BRIEF_MIN_CHARS && built.visionAttempted > 0 && built.visionLoaded === 0) {
      return {
        ok: false,
        message: 'Obrázky se nepodařilo načíst pro AI — zkontroluj přihlášení / síť, nebo doplň textový popis.',
      };
    }

    const withIntent = applyIntentToUserContent(built, intent);

    let raw: string;
    try {
      emitPipeline(
        onPipelineEvent,
        PIPELINE_DESIGN,
        'Agent: Design tokenů (barvy, typografie, layouty…)',
        'running',
      );
      raw = await chatWithAIProxy(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: withIntent.content },
        ],
        'gemini-3.1-pro',
        { temperature: 0.35, max_tokens: 8192, thinking_level: 'low' },
      );
      emitPipeline(
        onPipelineEvent,
        PIPELINE_DESIGN,
        'Agent: Design tokenů (barvy, typografie, layouty…)',
        'done',
      );
    } catch (designErr: unknown) {
      const dm = designErr instanceof Error ? designErr.message : String(designErr);
      emitPipeline(
        onPipelineEvent,
        PIPELINE_DESIGN,
        'Agent: Design tokenů (barvy, typografie, layouty…)',
        'error',
        dm.slice(0, 120),
      );
      throw designErr;
    }

    const json = extractJsonObjectFromModelText(raw);
    const illustrationProposals = extractIllustrationStyleProposals(json);
    workingDataset = { ...workingDataset };
    if (illustrationProposals?.length) {
      workingDataset.illustrationStyleProposals = illustrationProposals;
    } else {
      delete workingDataset.illustrationStyleProposals;
    }
    let patch = sanitizeDesignSystemAgentPatch(json);
    if (intent?.generationBlockTypes?.length) {
      patch = {
        ...patch,
        blockPreferences: {
          ...patch.blockPreferences,
          generationBlockTypes: intent.generationBlockTypes,
          preferred:
            patch.blockPreferences?.preferred && patch.blockPreferences.preferred.length > 0
              ? patch.blockPreferences.preferred
              : intent.generationBlockTypes.slice(0, 8),
        },
      };
    }

    const baseDs: DesignSystem =
      existing ??
      ({
        ...createEmptyDesignSystem(patch.name || 'Design systém'),
        id: '__new__',
        teacher_id: '__pending__',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as DesignSystem);

    let mergedDs = applyDesignSystemAgentPatch(baseDs, patch);
    const refinePatch = await refineVisualTokensFromLayoutScreenshots(mergedDs, workingDataset, onPipelineEvent);
    if (refinePatch) {
      mergedDs = applyDesignSystemAgentPatch(mergedDs, refinePatch);
    }

    if (baseDataset.referenceImageIds !== undefined) {
      const imgIds = (workingDataset.files ?? [])
        .filter((f) => f.kind === 'image')
        .map((f) => f.id);
      workingDataset = {
        ...workingDataset,
        referenceImageIds: [...new Set([...baseDataset.referenceImageIds, ...imgIds])],
      };
    }

    const payload = buildDesignSystemForSave(patch, existing, { preMergedDesignSystem: mergedDs });

    emitPipeline(onPipelineEvent, PIPELINE_SAVE, 'Ukládám do knihovny…', 'running');
    const saved = await saveDesignSystem({
      ...payload,
      dataset: workingDataset,
    });
    emitPipeline(onPipelineEvent, PIPELINE_SAVE, 'Ukládám do knihovny…', 'done');

    if (!saved) {
      emitPipeline(onPipelineEvent, PIPELINE_SAVE, 'Ukládám do knihovny…', 'error', 'Uložení selhalo');
      return { ok: false, message: 'Uložení se nezdařilo — jsi přihlášený jako učitel?' };
    }
    return { ok: true, designSystem: saved };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[design-system-from-brief]', e);
    return { ok: false, message: msg || 'Generování selhalo.' };
  }
}
