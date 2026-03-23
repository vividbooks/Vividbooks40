import { chatWithAIProxy } from '../ai-chat-proxy';

export interface TranslatableImage {
  title: string;
  description?: string;
  [key: string]: any;
}

/**
 * Přeloží title a description obrázků z webu do češtiny pomocí Gemini Flash.
 */
export async function translateImageCaptions<T extends TranslatableImage>(images: T[]): Promise<T[]> {
  if (images.length === 0) {
    console.log('[translateImageCaptions] Žádné obrázky k překladu.');
    return images;
  }

  console.log(`[translateImageCaptions] Překládám popisky ${images.length} obrázků...`);

  const toTranslate = images.map((img, i) => ({
    i,
    title: img.title,
    description: img.description || '',
  }));

  const prompt = `Přelož následující popisky obrázků do češtiny. Zachovej věcnost a stručnost. Odpověz POUZE jako JSON pole ve formátu:
[{"i": 0, "title": "...", "description": "..."}]

Popisky k překladu:
${JSON.stringify(toTranslate, null, 2)}`;

  try {
    console.log('[translateImageCaptions] Volám Gemini Flash...');
    const raw = await chatWithAIProxy(
      [{ role: 'user', content: prompt }],
      'gemini-3-flash',
      { max_tokens: 4096 }
    );

    console.log('[translateImageCaptions] Odpověď přijata, parsuju JSON...');
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('[translateImageCaptions] Nenalezen JSON v odpovědi, vracím originály.');
      return images;
    }

    const translated: { i: number; title: string; description: string }[] = JSON.parse(jsonMatch[0]);
    const result = [...images];
    for (const t of translated) {
      if (t.i >= 0 && t.i < result.length) {
        result[t.i] = {
          ...result[t.i],
          title: t.title || result[t.i].title,
          description: t.description || result[t.i].description,
        };
      }
    }
    console.log(`[translateImageCaptions] ✅ Přeloženo ${translated.length} popisků.`);
    return result;
  } catch (e) {
    console.error('[translateImageCaptions] Chyba překladu:', e);
    return images;
  }
}
