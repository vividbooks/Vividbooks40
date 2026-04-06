import type { DatasetFile } from '../../types/design-system';

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

/**
 * Heuristický výběr referenčních obrázků podle textu promptu a katalogových poznámek (`referenceNote`).
 * Když nic nesedí, vrátí prvních `maxPick` obrázků (pořadí v datasetu).
 *
 * Použití: např. `generateImageWithImagen(prompt, { referenceImageUrl: urls[0] })` nebo postupně více variant.
 */
export function selectReferenceImageUrlsForPrompt(
  prompt: string,
  files: DatasetFile[],
  maxPick = 4,
): string[] {
  const images = files.filter((f) => f.kind === 'image' && f.url?.startsWith('http'));
  if (images.length === 0) return [];

  const pTokens = tokenize(prompt);
  if (pTokens.size === 0) return images.slice(0, maxPick).map((f) => f.url);

  const scored = images.map((f) => {
    const note = `${f.referenceNote ?? ''} ${f.name ?? ''}`;
    const nTokens = tokenize(note);
    let score = 0;
    for (const t of nTokens) {
      if (pTokens.has(t)) score += 2;
    }
    const low = note.toLowerCase();
    for (const pt of pTokens) {
      if (low.includes(pt)) score += 1;
    }
    if (f.referenceRole === 'illustration') score += 6;
    if (f.referenceRole === 'layout') score -= 3;
    return { url: f.url, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const anyHit = scored.some((s) => s.score > 0);
  const ordered = anyHit ? scored.filter((s) => s.score > 0) : scored;
  return ordered.slice(0, maxPick).map((s) => s.url);
}
