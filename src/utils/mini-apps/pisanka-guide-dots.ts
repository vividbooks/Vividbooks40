/**
 * Vodící tečky pro písanku: jedna tečka na začátek předpisu (výška podle prvního písmene),
 * opakování po řádku podle šířky celého napsaného textu.
 */

import type { PisankaGuideAnchor } from '../../types/worksheet';

export interface PisankaGuideUnit {
  text: string;
  /** Index v původním řetězci řádku (UTF-16) — první netisknutelná mezera přeskočena. */
  startIndex: number;
  anchor: PisankaGuideAnchor;
}

/** Odhad výšky začátku podle prvního znaku jednotky (česká psací návyková heuristika). */
export function guideAnchorForUnit(unit: string): PisankaGuideAnchor {
  const t = unit.trim();
  if (!t) return 'baseline';
  const c = t[0];
  if (/[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/.test(c)) return 'capTop';
  if (/[bdfhjkltť]/i.test(c)) return 'ascender';
  if (/[aácdeéěgiíoóqquúůyý]/i.test(c)) return 'bandTop';
  return 'baseline';
}

/**
 * Jedna „jednotka“ = celý viditelný předpis od prvního neprázdného znaku.
 * Výška tečky z prvního písmene; horizontální krok opakování řeší vrstva (šířka celého textu).
 */
export function buildGuideUnits(text: string): PisankaGuideUnit[] {
  if (!text.trim()) return [];
  let startIndex = -1;
  for (let i = 0; i < text.length; i++) {
    if (!/\s/.test(text[i])) {
      startIndex = i;
      break;
    }
  }
  if (startIndex < 0) return [];
  const slice = text.slice(startIndex);
  if (!slice.trim()) return [];
  return [
    {
      text: slice,
      startIndex,
      anchor: guideAnchorForUnit(slice),
    },
  ];
}
