/**
 * textbook-layouts.ts
 *
 * Celostránkové šablony pro stránky učebnice.
 * Každý layout definuje přesnou sekvenci slotů (bloků) — AI jen vyplňuje obsah,
 * struktura stránky je garantovaná a vždy odpovídá vybranému layoutu.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type SlotType =
  | 'heading-h1' | 'heading'
  | 'paragraph' | 'image' | 'infobox' | 'table'
  | 'connect-pairs' | 'fill-blank' | 'free-answer' | 'multiple-choice';

export interface TemplateSlot {
  id: number;
  type: SlotType;
  width: 'full' | 'half';
  role: string;           // hint pro AI — popis co má vygenerovat
  fixed?: boolean;        // header/footer — AI nevyplňuje, generuje se automaticky
  imageSlot?: boolean;    // AI napíše URL nebo popis obrázku (ze sady datasetu)
}

export interface TextbookLayout {
  id: string;
  name: string;
  description: string;
  category: 'intro' | 'text' | 'visual' | 'exercise' | 'summary';
  template: TemplateSlot[];
  svgPreview: string;     // generuje se automaticky z template
}

// ── SVG Generator ──────────────────────────────────────────────────────────

const SVG_W = 120;
const SVG_H = 170;
const SVG_PAD = 5;
const SVG_IW = SVG_W - 2 * SVG_PAD;  // 110px inner width
const SVG_IH = SVG_H - 2 * SVG_PAD;  // 160px inner height
const SVG_RGAP = 2;   // gap between rows
const SVG_CGAP = 3;   // gap between half-width columns

// Výchozí výška každého bloku (před škálováním)
const DEFAULT_H: Record<SlotType, number> = {
  'heading-h1':    15,
  'heading':       10,
  'paragraph':     28,
  'image':         38,
  'infobox':       20,
  'table':         30,
  'connect-pairs': 32,
  'fill-blank':    14,
  'free-answer':   18,
  'multiple-choice': 24,
};

// Barvy pro každý typ bloku
const SLOT_COLOR: Record<SlotType, string> = {
  'heading-h1':       '#6366f1',
  'heading':          '#818cf8',
  'paragraph':        '#dde6f0',
  'image':            '#94a3b8',
  'infobox':          '#fde68a',
  'table':            '#ddd6fe',
  'connect-pairs':    '#bbf7d0',
  'fill-blank':       '#d1fae5',
  'free-answer':      '#c7f0d8',
  'multiple-choice':  '#a7f3d0',
};

// Zkrácené popisky pro SVG (musí se vejít do malého obdélníku)
const SLOT_LABEL: Record<SlotType, string> = {
  'heading-h1':       'H1 Nadpis',
  'heading':          'H2 Nadpis',
  'paragraph':        'Odstavec',
  'image':            '📷 Obrázek',
  'infobox':          '💡 Infobox',
  'table':            'Tabulka',
  'connect-pairs':    '🔗 Spojovačka',
  'fill-blank':       '✏️ Doplň',
  'free-answer':      '📝 Otázka',
  'multiple-choice':  '☑ Test',
};

function svgRect(x: number, y: number, w: number, h: number, fill: string, label: string): string {
  const fs = Math.max(4.5, Math.min(6.5, h * 0.38));
  const showLabel = h >= 7 && w >= 18;
  const textEl = showLabel
    ? `<text x="${(x + w / 2).toFixed(1)}" y="${(y + h / 2).toFixed(1)}" ` +
      `font-size="${fs.toFixed(1)}" fill="#374151" text-anchor="middle" ` +
      `dominant-baseline="middle" font-family="sans-serif">${label}</text>`
    : '';
  return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}" rx="2"/>${textEl}`;
}

/**
 * Vygeneruje SVG náhled celé stránky ze seznamu slotů.
 * Bloky jsou proporcionálně škálovány, aby vyplnily canvas 120×170.
 * Sousední half-width sloty se zobrazí vedle sebe (side-by-side).
 */
function buildPageSvg(template: TemplateSlot[]): string {
  interface Row { slots: TemplateSlot[]; rawH: number; }
  const rows: Row[] = [];

  let i = 0;
  while (i < template.length) {
    const s = template[i];
    if (
      s.width === 'half' &&
      i + 1 < template.length &&
      template[i + 1].width === 'half'
    ) {
      const rawH = Math.max(DEFAULT_H[s.type], DEFAULT_H[template[i + 1].type]);
      rows.push({ slots: [s, template[i + 1]], rawH });
      i += 2;
    } else {
      rows.push({ slots: [s], rawH: DEFAULT_H[s.type] });
      i++;
    }
  }

  const totalGaps = (rows.length - 1) * SVG_RGAP;
  const totalRawH = rows.reduce((sum, r) => sum + r.rawH, 0);
  const scale = (SVG_IH - totalGaps) / Math.max(totalRawH, 1);

  const HL = Math.floor((SVG_IW - SVG_CGAP) / 2);
  const HR = SVG_IW - HL - SVG_CGAP;

  const rects: string[] = [];
  let y = SVG_PAD;

  for (const row of rows) {
    const h = Math.max(3, Math.round(row.rawH * scale));
    if (row.slots.length === 1) {
      const sl = row.slots[0];
      rects.push(svgRect(SVG_PAD, y, SVG_IW, h, SLOT_COLOR[sl.type], SLOT_LABEL[sl.type]));
    } else {
      const [s0, s1] = row.slots;
      rects.push(svgRect(SVG_PAD, y, HL, h, SLOT_COLOR[s0.type], SLOT_LABEL[s0.type]));
      rects.push(svgRect(SVG_PAD + HL + SVG_CGAP, y, HR, h, SLOT_COLOR[s1.type], SLOT_LABEL[s1.type]));
    }
    y += h + SVG_RGAP;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_W} ${SVG_H}" width="${SVG_W}" height="${SVG_H}">` +
    `<rect width="${SVG_W}" height="${SVG_H}" fill="white" rx="5" stroke="#e2e8f0" stroke-width="1"/>` +
    rects.join('') +
    `</svg>`
  );
}

// ── Template slot shorthand ────────────────────────────────────────────────

function t(
  id: number,
  type: SlotType,
  width: 'full' | 'half',
  role: string,
  opts: Partial<Pick<TemplateSlot, 'fixed' | 'imageSlot'>> = {}
): TemplateSlot {
  return { id, type, width, role, ...opts };
}

// ── Layout šablony ─────────────────────────────────────────────────────────

export const TEXTBOOK_LAYOUTS: TextbookLayout[] = [

  // ── A. KLASICKÁ STRÁNKA UČEBNICE ──────────────────────────────────────────
  // Jako na přiloženém screenshotu: H1+obrázek, odstavec, nadpis+infobox, text+obrázek
  {
    id: 'classic-page',
    name: 'Klasická stránka',
    description: 'H1 nadpis vedle obrázku, text se střídá s obrázky a infoboxem, spojovačka na závěr.',
    category: 'visual',
    template: [
      t(1,  'heading-h1',   'half', 'hlavní nadpis tématu (2-5 slov)'),
      t(2,  'image',        'half', 'hlavní obrázek tématu',                   { imageSlot: true }),
      t(3,  'paragraph',    'full', 'úvodní odstavec 8-10 vět, přehled tématu'),
      t(4,  'heading',      'half', 'nadpis první sekce'),
      t(5,  'infobox',      'half', 'Věděl jsi, že...? 3-4 věty zajímavost'),
      t(6,  'paragraph',    'half', 'text první sekce 5-7 vět'),
      t(7,  'image',        'half', 'obrázek k první sekci',                   { imageSlot: true }),
      t(8,  'heading',      'full', 'nadpis druhé sekce'),
      t(9,  'paragraph',    'half', 'text druhé sekce 5-7 vět'),
      t(10, 'image',        'half', 'obrázek k druhé sekci',                   { imageSlot: true }),
      t(11, 'infobox',      'full', 'shrnutí — klíčové poznatky formou odrážek'),
      t(12, 'connect-pairs','full', 'cvičení: přiřaď pojmy k definicím, 4-5 párů'),
    ],
    svgPreview: '',
  },

  // ── B. VÝKLADOVÁ STRÁNKA ──────────────────────────────────────────────────
  // Velký hero obrázek, bohatý výklad, slovníček
  {
    id: 'expository-page',
    name: 'Výkladová stránka',
    description: 'Velký hero obrázek, hlavní nadpis, bohatý výklad s obrázky, slovníček pojmů na závěr.',
    category: 'text',
    template: [
      t(1,  'image',     'full', 'hero obrázek přes celou šíři',                 { imageSlot: true }),
      t(2,  'heading-h1','full', 'hlavní nadpis tématu'),
      t(3,  'paragraph', 'full', 'úvodní odstavec 10-12 vět, přehled celého tématu'),
      t(4,  'heading',   'full', 'nadpis první výkladové sekce'),
      t(5,  'paragraph', 'half', 'text výkladové sekce 5-7 vět'),
      t(6,  'image',     'half', 'obrázek k výkladové sekci',                    { imageSlot: true }),
      t(7,  'paragraph', 'full', 'pokračování výkladu 5-7 vět, detaily a příklady'),
      t(8,  'heading',   'full', 'Slovníček pojmů'),
      t(9,  'table',     'full', 'tabulka: Pojem | Vysvětlení, 5-7 řádků'),
      t(10, 'infobox',   'full', 'závěrečný infobox: shrnutí nebo zajímavost'),
    ],
    svgPreview: '',
  },

  // ── C. CVIČEBNÍ STRÁNKA ───────────────────────────────────────────────────
  // Krátký úvod + různé typy cvičení
  {
    id: 'exercise-page',
    name: 'Cvičební stránka',
    description: 'Krátký úvod, pak různé typy cvičení: spojovačka, doplňovačka, otevřené otázky, test.',
    category: 'exercise',
    template: [
      t(1,  'heading-h1',      'full', 'název pracovního listu'),
      t(2,  'paragraph',       'full', 'krátký úvod 3-4 věty, motivace a cíl'),
      t(3,  'heading',         'full', 'Cvičení 1: Přiřazování — název cvičení'),
      t(4,  'connect-pairs',   'full', '4-5 párů: Pojem | Definice'),
      t(5,  'heading',         'full', 'Cvičení 2: Doplňovačka — název cvičení'),
      t(6,  'fill-blank',      'full', 'věta s ___ mezerou = správná odpověď'),
      t(7,  'fill-blank',      'full', 'věta s ___ mezerou = správná odpověď'),
      t(8,  'fill-blank',      'full', 'věta s ___ mezerou = správná odpověď'),
      t(9,  'heading',         'full', 'Cvičení 3: Zamysli se'),
      t(10, 'free-answer',     'full', 'první otevřená otázka k přemýšlení'),
      t(11, 'free-answer',     'full', 'druhá otevřená otázka k přemýšlení'),
      t(12, 'heading',         'full', 'Cvičení 4: Otestuj se'),
      t(13, 'multiple-choice', 'full', 'otázka, A) možnost B) možnost* C) možnost D) možnost'),
      t(14, 'multiple-choice', 'full', 'druhá otázka s 4 možnostmi'),
    ],
    svgPreview: '',
  },

  // ── D. HERO INTRO STRÁNKA ─────────────────────────────────────────────────
  // Otevírací stránka: velký obrázek + nadpis + úvod
  {
    id: 'hero-intro-page',
    name: 'Hero intro',
    description: 'Otevírací stránka tématu: velký hero obrázek, hlavní nadpis, úvod, první sekce.',
    category: 'intro',
    template: [
      t(1,  'image',     'full', 'velký hero obrázek tématu',      { imageSlot: true }),
      t(2,  'heading-h1','full', 'hlavní nadpis tématu'),
      t(3,  'paragraph', 'full', 'úvodní odstavec 8-10 vět, nadchne čtenáře'),
      t(4,  'heading',   'half', 'nadpis sekce'),
      t(5,  'infobox',   'half', 'Věděl jsi, že...? 3 věty zajímavost'),
      t(6,  'paragraph', 'half', 'text sekce 5-7 vět'),
      t(7,  'image',     'half', 'obrázek k sekci',                { imageSlot: true }),
      t(8,  'infobox',   'full', 'shrnutí nebo výzva: co nás čeká dál'),
    ],
    svgPreview: '',
  },

  // ── E. SLOVNÍČEK A SHRNUTÍ ────────────────────────────────────────────────
  // Pojmy, opakování, tabulka
  {
    id: 'vocabulary-summary-page',
    name: 'Slovníček a shrnutí',
    description: 'Stránka opakování: tabulka pojmů, klíčové poznatky, doplňovačky na procvičení.',
    category: 'summary',
    template: [
      t(1,  'heading-h1','full', 'název opakování nebo slovníčku'),
      t(2,  'paragraph', 'half', 'úvod k opakování 4-5 vět'),
      t(3,  'image',     'half', 'obrázek k tématu',                        { imageSlot: true }),
      t(4,  'heading',   'full', 'Slovníček pojmů'),
      t(5,  'table',     'full', 'tabulka: Pojem | Vysvětlení, 6-8 řádků'),
      t(6,  'heading',   'full', 'Co jsme se naučili'),
      t(7,  'infobox',   'full', 'klíčové poznatky formou odrážek, 5-7 bodů'),
      t(8,  'heading',   'full', 'Ověř si znalosti'),
      t(9,  'fill-blank','full', 'věta s ___ mezerou = správná odpověď'),
      t(10, 'fill-blank','full', 'věta s ___ mezerou = správná odpověď'),
      t(11, 'fill-blank','full', 'věta s ___ mezerou = správná odpověď'),
    ],
    svgPreview: '',
  },

];

// Vygeneruj SVG náhledy pro všechny layouty
TEXTBOOK_LAYOUTS.forEach(layout => {
  layout.svgPreview = buildPageSvg(layout.template);
});

// ── Prompt helpers ─────────────────────────────────────────────────────────

/**
 * Vygeneruje popis slotů pro Agent 2 (template-fill mode).
 * Formát: [SLOT N: TYP — role]
 */
export function buildSlotPrompt(template: TemplateSlot[]): string {
  const lines: string[] = [
    'Vyplň obsah do PŘESNĚ těchto slotů. Nepřidávej ani neodebírej sloty. Nezměň pořadí.',
    '',
    'SLOTY:',
  ];

  for (const slot of template) {
    if (slot.fixed) continue;
    const typeLabel = slot.type.toUpperCase();
    const widthNote = slot.width === 'half' ? ' (POLOVINA ŠÍŘE)' : '';
    const imgNote = slot.imageSlot ? ' [napiš URL nebo název obrázku z datasetu]' : '';
    lines.push(`[SLOT ${slot.id}: ${typeLabel}${widthNote} — ${slot.role}${imgNote}]`);
  }

  lines.push('');
  lines.push('VÝSTUPNÍ FORMÁT — každý slot musí začínat přesně takto:');
  lines.push('[SLOT N]');
  lines.push('obsah tohoto slotu...');
  lines.push('');
  lines.push('POZNÁMKY:');
  lines.push('- Páry POLOVINA ŠÍŘE jsou automaticky zobrazeny vedle sebe — pište obsah do každého slotu zvlášť');
  lines.push('- FILL-BLANK: formát: "věta s ___ mezerou = správná odpověď"');
  lines.push('- CONNECT-PAIRS: formát: "Pojem | Definice" (každý pár na nový řádek)');
  lines.push('- TABLE: formát: "Záhlaví A | Záhlaví B\\nHodnota 1 | Hodnota 2" (každý řádek na nový řádek)');
  lines.push('- MULTIPLE-CHOICE: formát: "Otázka?\\nA) možnost\\nB) správná odpověď *\\nC) možnost\\nD) možnost"');
  lines.push('- IMAGE: napiš URL ze sady datasetu nebo popis obrázku');

  return lines.join('\n');
}

/**
 * Backward-compatible helper pro starý Agent 2 prompt formát.
 */
export function layoutsToAgent2Prompt(layouts: TextbookLayout[]): string {
  const lines: string[] = [];
  let blockNum = 1;
  layouts.forEach((layout, li) => {
    lines.push(`\n[SEKCE ${li + 1}: ${layout.name.toUpperCase()}]`);
    layout.template.forEach(slot => {
      if (!slot.fixed) {
        const hint = slot.role ? ` (${slot.role})` : '';
        lines.push(`${blockNum++}. ${slot.type.toUpperCase()}${hint} [šíře=${slot.width}]`);
      }
    });
  });
  return lines.join('\n');
}

export type LayoutId = typeof TEXTBOOK_LAYOUTS[number]['id'];
