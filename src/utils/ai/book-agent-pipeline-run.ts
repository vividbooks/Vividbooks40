/**
 * Spuštění jednoho kroku book agent pipeline přes `chatWithAIProxy` (Edge ai-chat).
 * Image modely se pro text přemapují na Gemini Flash.
 */

import { chatWithAIProxy, type ChatProxyMessage } from '../ai-chat-proxy';
import type { BookAgentDatasetOutputMode, BookAgentPipelineModelId } from '../../types/book-agent-pipeline';

const SYSTEM_BASE = `Jsi krok v pipeline přípravy učebnic (Curriculum Factory). Odpověz česky.
Výstup musí být pouze platný JSON (žádný markdown kolem, žádné \`\`\` bloky) — jeden JSON objekt nebo pole podle režimu níže.`;

const SYSTEM_SINGLE = `REŽIM JEDEN SOUBOR / JEDEN BLOK:
Vrať jeden ucelený JSON artefakt (jeden objekt nebo jedno pole), který popisuje výsledek kroku jako jeden dataset pro další agenta.`;

const SYSTEM_FOLDERS = `REŽIM SLOŽKY A SOUBORY (jako RVP Scout / Data Collector):
Výstup musí být jeden JSON objekt reprezentující více logických složek nebo kapitol.
Doporučená struktura (příklad — přizpůsob obsahu zadání):
{
  "ucebnice": {
    "nazev": "…",
    "rocnik": "…",
    "struktura": [
      {
        "slozka": "01_nazev_slozky",
        "soubor": "kapitola_01.json",
        "nazev": "Lidský název kapitoly",
        "podkapitoly": [ { "nazev": "…", "soubor": "…" } ]
      }
    ]
  }
}
Klíče můžeš pojmenovat konzistentně česky: slozka, soubor, nazev, podkapitoly, struktura.
Každá položka ve struktura nebo temata by měla mít lidský název (nazev) a kde dává smysl soubor/slozka pro další krok.
Pole podkapitoly slouží i k tomu, aby šlo v UI zobrazit počet vnořených položek.`;

export function resolveTextProxyModel(modelId: BookAgentPipelineModelId): {
  proxyModel: BookAgentPipelineModelId;
  usedImageFallback: boolean;
} {
  if (modelId === 'gemini-image-flash' || modelId === 'gemini-image-pro') {
    return { proxyModel: 'gemini-3-flash', usedImageFallback: true };
  }
  return { proxyModel: modelId, usedImageFallback: false };
}

function buildSystemPrompt(mode: BookAgentDatasetOutputMode): string {
  if (mode === 'folders') {
    return `${SYSTEM_BASE}\n\n${SYSTEM_FOLDERS}`;
  }
  return `${SYSTEM_BASE}\n\n${SYSTEM_SINGLE}`;
}

export async function runBookAgentPipelineStep(opts: {
  rolePrompt: string;
  modelId: BookAgentPipelineModelId;
  datasetOutputMode: BookAgentDatasetOutputMode;
  previousDatasetPreview?: string;
  /** Aktivní design systém knihy — barvy, fonty, tón ilustrací (volitelné). */
  designSystemContext?: string;
}): Promise<{ text: string; usedImageFallback: boolean }> {
  const { rolePrompt, modelId, previousDatasetPreview, datasetOutputMode, designSystemContext } = opts;
  const { proxyModel, usedImageFallback } = resolveTextProxyModel(modelId);

  const userChunks: string[] = [];
  if (designSystemContext?.trim()) {
    userChunks.push(
      `Styl knihy (z aktivního design systému — respektuj při struktuře a pojmenování kapitol; typografie se doplní v editoru):\n${designSystemContext.trim()}\n\n---\n`,
    );
  }
  if (previousDatasetPreview?.trim()) {
    userChunks.push(
      `Vstup z předchozího kroku (dataset):\n${previousDatasetPreview.trim()}\n\n---\n`,
    );
  }
  userChunks.push(`Úkol / role agenta:\n${rolePrompt.trim()}`);

  const messages: ChatProxyMessage[] = [
    { role: 'system', content: buildSystemPrompt(datasetOutputMode) },
    { role: 'user', content: userChunks.join('\n') },
  ];

  const thinking_level = proxyModel === 'gemini-3.1-pro' ? 'medium' : 'low';

  const text = await chatWithAIProxy(messages, proxyModel, {
    temperature: 0.45,
    max_tokens: 8192,
    thinking_level,
  });

  return { text: text.trim(), usedImageFallback };
}
