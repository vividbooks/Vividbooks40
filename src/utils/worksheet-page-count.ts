import type { Worksheet } from '../types/worksheet';

/**
 * Spolehlivý počet stran listu: metadata (uložené při save z editoru) nebo max pageIndex v blocích + 1.
 */
export function deriveWorksheetPageCount(ws: Pick<Worksheet, 'metadata' | 'blocks'> | null | undefined): number {
  if (!ws) return 1;
  const raw = ws.metadata?.pageCount;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.min(500, Math.round(raw));
  }
  if (typeof raw === 'string' && /^[0-9]+$/.test(raw)) {
    const n = parseInt(raw, 10);
    if (n > 0) return Math.min(500, n);
  }
  const blocks = ws.blocks;
  if (!Array.isArray(blocks) || blocks.length === 0) return 1;
  let maxIdx = 0;
  for (const b of blocks) {
    const pi = typeof b.pageIndex === 'number' && Number.isFinite(b.pageIndex) ? b.pageIndex : 0;
    if (pi > maxIdx) maxIdx = pi;
  }
  return Math.min(500, Math.max(1, maxIdx + 1));
}
