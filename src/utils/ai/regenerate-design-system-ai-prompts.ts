/**
 * Přegenerování aiPrompts (imageStyle, negativePrompt, characterStyle) z referenčních obrázků + katalogu.
 */

import { chatWithAIProxy, type ChatMessageContentPart } from '../ai-chat-proxy';
import type { DatasetFile, DesignSystemAIPrompts } from '../../types/design-system';
import { extractJsonObjectFromModelText } from '../../types/design-system-agent';

const MAX_IMAGES = 6;
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

const SYSTEM_PROMPT = `You refine illustration prompts for educational textbook visuals (Vividbooks, often Czech context).

Return ONE JSON object only. No markdown fences, no commentary.

Shape:
{
  "imageStyle": string (detailed English art direction: medium, line weight, color, lighting, mood — suitable for image generation models),
  "negativePrompt": string (comma-separated things to avoid),
  "characterStyle": string (recurring character / figure design, proportions, expression)
}

Use the attached reference images and the catalog lines. Entries tagged [layout] are page/screenshot structure; prioritize [ilustrace] and uncategorized images for imageStyle and characterStyle when both exist. If previous drafts are included, improve or replace them consistently with what you see.`;

export type RegenerateAiPromptsResult =
  | { ok: true; prompts: DesignSystemAIPrompts }
  | { ok: false; message: string };

export async function regenerateDesignSystemAiPromptsFromReferences(options: {
  current: DesignSystemAIPrompts;
  images: DatasetFile[];
}): Promise<RegenerateAiPromptsResult> {
  const vision = options.images.filter((f) => f.kind === 'image' && f.url?.startsWith('http')).slice(0, MAX_IMAGES);
  if (vision.length === 0) {
    return { ok: false, message: 'Nejsou žádné referenční obrázky (nahraj je v panelu vpravo nebo v této kartě).' };
  }

  const catalog = vision
    .map((f, i) => {
      const role =
        f.referenceRole === 'layout'
          ? ' [layout]'
          : f.referenceRole === 'illustration'
            ? ' [ilustrace]'
            : '';
      return `${i + 1}. ${f.name}${role}${f.referenceNote ? ` — ${f.referenceNote}` : ''}`;
    })
    .join('\n');

  const prior = `## Předchozí návrhy (vylepši nebo nahraď konzistentně s obrázky)

imageStyle:
${options.current.imageStyle || '(prázdné)'}

negativePrompt:
${options.current.negativePrompt || '(prázdné)'}

characterStyle:
${options.current.characterStyle || '(prázdné)'}

## Katalog referencí

${catalog}
`;

  const parts: ChatMessageContentPart[] = [{ type: 'text', text: prior }];

  let loaded = 0;
  for (let i = 0; i < vision.length; i++) {
    const f = vision[i];
    const img = await fetchUrlAsImagePart(f.url);
    if (!img) continue;
    loaded++;
    parts.push({ type: 'text', text: `\n[Reference ${i + 1}${f.referenceNote ? `: ${f.referenceNote}` : ''}]\n` });
    parts.push(img);
  }

  const userContent: string | ChatMessageContentPart[] =
    loaded === 0 ? `${prior}\n(Obrázky se nepodařilo načíst z URL — uprav prompty jen z textu a katalogu.)` : parts;

  try {
    const raw = await chatWithAIProxy(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      'gemini-3-flash',
      { temperature: 0.35, max_tokens: 4096, thinking_level: 'low' },
    );

    const json = extractJsonObjectFromModelText(raw);
    if (typeof json !== 'object' || json === null || Array.isArray(json)) {
      return { ok: false, message: 'AI nevrátila platný JSON s prompty.' };
    }
    const o = json as Record<string, unknown>;
    const imageStyle = typeof o.imageStyle === 'string' ? o.imageStyle.trim() : '';
    const negativePrompt = typeof o.negativePrompt === 'string' ? o.negativePrompt.trim() : '';
    const characterStyle = typeof o.characterStyle === 'string' ? o.characterStyle.trim() : '';

    if (!imageStyle) {
      return { ok: false, message: 'V odpovědi chybí neprázdný imageStyle.' };
    }

    return {
      ok: true,
      prompts: {
        ...options.current,
        imageStyle,
        negativePrompt: negativePrompt || options.current.negativePrompt || '',
        characterStyle: characterStyle || options.current.characterStyle || '',
      },
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[regenerate-design-system-ai-prompts]', e);
    return { ok: false, message: msg || 'Generování promptů selhalo.' };
  }
}
