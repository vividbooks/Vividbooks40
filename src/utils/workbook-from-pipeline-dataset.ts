/**
 * Převod JSON výstupu agenta (pipeline) na stránky knihy — nadpisy + odstavce v pracovních listech.
 */

import type { DesignSystem } from '../types/design-system';
import type { Worksheet } from '../types/worksheet';
import { createEmptyWorksheet, generateBlockId } from '../types/worksheet';
import { applyDesignSystemSnapshotToWorksheet } from './design-system-sync';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function splitParagraphs(text: string): string {
  const t = text.trim();
  if (!t) return '<p></p>';
  const parts = t.split(/\n\n+/).filter(Boolean);
  return parts.map((p) => `<p>${escapeHtml(p.trim())}</p>`).join('');
}

/** Textové pole často z agentů (kapitola / list); `popis_stylu` = výklad stylu i obsahu u DS pipeline */
function extractBody(obj: Record<string, unknown>): string {
  const keys = [
    'vyklad_rozsireny',
    'vyklad',
    'obsah',
    'text',
    'popis_stylu',
    'popis',
    'uvod',
    'shrnuti',
    'shrnutí',
    'lead',
    'anotace',
    'content',
  ];
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

/** Když list má jen metadata (nazev, soubor), vezmi souvislý text z nadřazené kapitoly */
function htmlForSubchapterLeaf(
  sub: Record<string, unknown>,
  parent: Record<string, unknown>,
  subTitle: string,
): string {
  const own = extractBody(sub);
  if (own) return splitParagraphs(own);

  const parentText = extractBody(parent);
  if (parentText) {
    const marker = subTitle ? `\n\n— ${subTitle}` : '';
    return splitParagraphs(`${parentText}${marker}`);
  }

  const soubor = typeof sub.soubor === 'string' ? sub.soubor.trim() : '';
  const msg = soubor
    ? `V tomto kroku dataset obsahuje jen plánovaný soubor «${soubor}», ne plný text vykladu. Doplň v dalším agentovi pole vyklad / obsah u podkapitoly, nebo text vlož ručně.`
    : 'V datasetu chybí souvislý text pro tuto podkapitolu. Rozšiř výstup agenta o pole vyklad, obsah nebo popis_stylu.';
  return splitParagraphs(msg);
}

export type PipelinePageUnit = { title: string; html: string };

function parseDatasetJson(raw: string): unknown | null {
  let s = raw.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/s, '').trim();
  }
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function flattenUnits(data: unknown): PipelinePageUnit[] {
  const out: PipelinePageUnit[] = [];

  if (data == null) return out;

  if (Array.isArray(data)) {
    for (const item of data) {
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        const title = String(o.nazev ?? o.name ?? o.titulek ?? 'Bez názvu').trim();
        const body = extractBody(o);
        if (body) {
          out.push({ title: title || 'Bez názvu', html: splitParagraphs(body) });
        } else {
          const soubor = typeof o.soubor === 'string' ? o.soubor.trim() : '';
          const hint = soubor
            ? `Dataset má u této položky jen strukturu (např. soubor «${soubor}»). Doplň text do vyklad / obsah / popis_stylu.`
            : 'Dataset neobsahuje textové pole (vyklad, obsah, popis_stylu). Uprav výstup agenta.';
          out.push({ title: title || 'Bez názvu', html: splitParagraphs(hint) });
        }
      }
    }
    return out;
  }

  if (typeof data === 'object') {
    const root = data as Record<string, unknown>;
    let struktura: unknown[] | null = null;
    if (root.ucebnice && typeof root.ucebnice === 'object') {
      const u = root.ucebnice as Record<string, unknown>;
      if (Array.isArray(u.struktura)) struktura = u.struktura;
    }
    if (!struktura && Array.isArray(root.struktura)) struktura = root.struktura;
    if (!struktura) {
      for (const key of ['temata', 'témata', 'topics', 'kapitoly', 'items']) {
        if (Array.isArray(root[key])) {
          struktura = root[key] as unknown[];
          break;
        }
      }
    }

    if (struktura && struktura.length > 0) {
      for (const item of struktura) {
        if (!item || typeof item !== 'object') continue;
        const o = item as Record<string, unknown>;
        const title = String(o.nazev ?? o.name ?? 'Kapitola').trim();
        const subs = o.podkapitoly;
        if (Array.isArray(subs) && subs.length > 0) {
          for (const sub of subs) {
            if (sub && typeof sub === 'object') {
              const so = sub as Record<string, unknown>;
              const st = String(so.nazev ?? so.name ?? 'Podkapitola').trim();
              const combinedTitle = `${title || 'Kapitola'} — ${st}`;
              out.push({
                title: combinedTitle,
                html: htmlForSubchapterLeaf(so, o, st),
              });
            }
          }
        } else {
          const body = extractBody(o);
          out.push({
            title: title || 'Bez názvu',
            html: body
              ? splitParagraphs(body)
              : splitParagraphs(
                  'Kapitola nemá vyplněný text (vyklad / obsah / popis_stylu). Uprav výstup agenta nebo použij strukturu s podkapitolami a textem u listů.',
                ),
          });
        }
      }
      return out;
    }

    const title = String(root.nazev ?? root.title ?? 'Obsah z pipeline').trim();
    const body = extractBody(root);
    if (body) {
      out.push({ title: title || 'Obsah z pipeline', html: splitParagraphs(body) });
    } else {
      out.push({
        title: title || 'Obsah z pipeline',
        html: splitParagraphs(
          'Kořenový JSON nemá pole struktura / temata s textem. Přidej do výstupu agenta vyklad, obsah nebo popis_stylu u kapitol, případně použij pole podkapitoly s vlastním textem.',
        ),
      });
    }
  }

  return out;
}

export function buildPageUnitsFromPipelineDataset(datasetJson: string):
  | { ok: true; units: PipelinePageUnit[] }
  | { ok: false; error: string } {
  const data = parseDatasetJson(datasetJson);
  if (data === null) {
    return { ok: false, error: 'Neplatný JSON — zkontroluj výstup agenta.' };
  }
  const units = flattenUnits(data);
  if (units.length === 0) {
    return { ok: false, error: 'V datasetu nejsou žádné kapitoly ani text k vložení do knihy.' };
  }
  return { ok: true, units };
}

export function createWorksheetFromPipelineUnit(
  unit: PipelinePageUnit,
  wsId: string,
  bookDesignSystem: DesignSystem | null,
): Worksheet {
  const base = createEmptyWorksheet(wsId);
  const withDs = bookDesignSystem ? applyDesignSystemSnapshotToWorksheet(base, bookDesignSystem) : base;
  const now = new Date().toISOString();
  const blocks = [
    {
      id: generateBlockId(),
      type: 'heading' as const,
      order: 0,
      width: 'full' as const,
      content: { text: unit.title, level: 'h1' as const, align: 'left' as const },
    },
    {
      id: generateBlockId(),
      type: 'paragraph' as const,
      order: 1,
      width: 'full' as const,
      content: { html: unit.html },
    },
  ];
  return {
    ...withDs,
    title: unit.title,
    blocks,
    updatedAt: now,
  };
}
