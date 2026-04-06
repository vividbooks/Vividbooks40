/**
 * Krátký text pro book agent pipeline — barvy, typografie, tón ilustrací.
 */

import type { DesignSystem } from '../types/design-system';
import { flattenDesignSystemSwatchesForPicker } from '../types/design-system';

export function buildDesignSystemPipelineContext(ds: DesignSystem | null | undefined): string {
  if (!ds) return '';
  const lines: string[] = [];
  lines.push(`Aktivní design systém knihy: «${ds.name}».`);
  const swatches = flattenDesignSystemSwatchesForPicker(ds.colors);
  if (swatches.length > 0) {
    lines.push(`Paleta (hex): ${swatches.slice(0, 16).map((s) => s.value).join(', ')}`);
  }
  if (ds.typography?.headingFont) {
    lines.push(`Font nadpisů: ${ds.typography.headingFont}`);
  }
  if (ds.typography?.bodyFont) {
    lines.push(`Font běžného textu: ${ds.typography.bodyFont}`);
  }
  if (ds.pageDefaults?.pageBackgroundColor) {
    lines.push(`Pozadí stránky: ${ds.pageDefaults.pageBackgroundColor}`);
  }
  const img = ds.aiPrompts?.imageStyle?.trim();
  if (img) {
    const clip = img.length > 600 ? `${img.slice(0, 600)}…` : img;
    lines.push(`Ilustrace / obrázky (stručně): ${clip}`);
  }
  lines.push(
    'Obsah a tón textu mají stylisticky ladit s tímto designem (věková skupina, nálada) — neuváděj konkrétní CSS, stačí srozumitelný popis u kapitol.',
  );
  return lines.join('\n');
}
