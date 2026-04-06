/**
 * Sdílená logika „řady layoutů“ (sloty → SVG náhled + bloky pracovního listu).
 * Použití: DesignSystemPanel, AI patch (design-system-agent), náhled na canvasu.
 */

import type {
  CustomLayout,
  DesignSystem,
  DesignSystemPageLayoutGroup,
  DesignSystemPageLayoutPreviewKind,
} from '../types/design-system';
import type { BlockVisualStyles, WorksheetBlock } from '../types/worksheet';

export type SeriesSlot = {
  type: string;
  span: number;
  level?: string;
  columns?: 1 | 2 | 3;
  galleryColumns?: number;
  galleryCount?: number;
  floatSide?: 'left' | 'right';
  floatSpanBlocks?: number;
  floatGridSpan?: number;
};

type TypoKey = 'h1' | 'h2' | 'h3' | 'body' | 'caption';

/** Kompaktní SVG náhled rozložení (stejná logika jako DesignSystemPanel). */
export function generateLayoutSvgFromSlots(slots: SeriesSlot[]): string {
  const W = 76;
  const H = 60;
  const PAD = 3;
  const GAP = 2;
  const COLORS: Record<string, string> = {
    heading: '#6366f1',
    paragraph: '#334155',
    image: '#0ea5e9',
    gallery: '#0284c7',
    infobox: '#059669',
  };
  const rects: string[] = [];
  const innerW = W - PAD * 2;
  const firstSlot = slots[0];
  const isFloat = !!firstSlot?.floatSide;

  if (isFloat) {
    const anchor = firstSlot;
    const mainSlots = slots.slice(1, 1 + (anchor.floatSpanBlocks ?? 2));
    const anchorW = Math.round((innerW * (anchor.floatGridSpan ?? 6)) / 12);
    const mainW = innerW - anchorW - GAP;
    const contentH = H - PAD * 2;
    const anchorColor = COLORS[anchor.type] || '#475569';
    const anchorX = anchor.floatSide === 'left' ? PAD : PAD + mainW + GAP;
    const mainX = anchor.floatSide === 'left' ? PAD + anchorW + GAP : PAD;
    rects.push(
      `<rect x="${anchorX}" y="${PAD}" width="${anchorW}" height="${contentH}" rx="2" fill="${anchorColor}" opacity="0.85"/>`,
    );
    if (anchor.type === 'image' || anchor.type === 'gallery') {
      if (anchor.type === 'gallery') {
        const imgH = (contentH - GAP) / 2;
        [0, imgH + GAP].forEach((dy) => {
          rects.push(
            `<rect x="${anchorX + 1}" y="${PAD + dy}" width="${anchorW - 2}" height="${imgH}" rx="2" fill="white" opacity="0.1"/>`,
          );
          const cx2 = anchorX + anchorW / 2;
          const cy2 = PAD + dy + imgH / 2;
          rects.push(`<circle cx="${cx2}" cy="${cy2 - 2}" r="2.5" fill="white" opacity="0.2"/>`);
        });
      } else {
        const cx = anchorX + anchorW / 2;
        const cy = PAD + contentH / 2;
        rects.push(`<circle cx="${cx}" cy="${cy - 4}" r="4" fill="white" opacity="0.25"/>`);
        rects.push(
          `<path d="M${anchorX + 2} ${PAD + contentH - 6} L${anchorX + anchorW * 0.35} ${PAD + contentH / 2 + 2} L${anchorX + anchorW * 0.65} ${PAD + contentH - 10} L${anchorX + anchorW - 2} ${PAD + contentH - 4}" fill="white" opacity="0.2"/>`,
        );
      }
    }
    const eachH =
      mainSlots.length > 0 ? (contentH - GAP * (mainSlots.length - 1)) / mainSlots.length : contentH;
    mainSlots.forEach((slot, i) => {
      const y = PAD + i * (eachH + GAP);
      const color = COLORS[slot.type] || '#475569';
      rects.push(
        `<rect x="${mainX}" y="${y}" width="${mainW}" height="${eachH}" rx="2" fill="${color}" opacity="${slot.type === 'heading' ? '0.9' : '0.6'}"/>`,
      );
      if (slot.type === 'heading')
        rects.push(
          `<rect x="${mainX + 2}" y="${y + eachH / 2 - 1}" width="${mainW * 0.6}" height="2" rx="1" fill="white" opacity="0.5"/>`,
        );
    });
  } else {
    const rows: SeriesSlot[][] = [];
    let currentRow: SeriesSlot[] = [];
    let rowSpan = 0;
    for (const slot of slots) {
      const span = slot.span || 12;
      if (rowSpan + span > 12 && currentRow.length > 0) {
        rows.push(currentRow);
        currentRow = [slot];
        rowSpan = span;
      } else {
        currentRow.push(slot);
        rowSpan += span;
      }
    }
    if (currentRow.length > 0) rows.push(currentRow);
    const rowH =
      rows.length > 0 ? (H - PAD * 2 - GAP * (rows.length - 1)) / rows.length : H - PAD * 2;
    rows.forEach((row, ri) => {
      const y = PAD + ri * (rowH + GAP);
      const totalSpan = row.reduce((s, sl) => s + (sl.span || 12), 0);
      let xCursor = PAD;
      row.forEach((slot) => {
        const slotW =
          Math.round((innerW * (slot.span || 12)) / totalSpan) - (row.length > 1 ? GAP / row.length : 0);
        const color = COLORS[slot.type] || '#475569';
        rects.push(
          `<rect x="${xCursor}" y="${y}" width="${slotW}" height="${rowH}" rx="2" fill="${color}" opacity="${slot.type === 'heading' ? '0.9' : '0.6'}"/>`,
        );
        if (slot.type === 'heading') {
          rects.push(
            `<rect x="${xCursor + 2}" y="${y + rowH / 2 - 1}" width="${slotW * 0.55}" height="2" rx="1" fill="white" opacity="0.5"/>`,
          );
        } else if (slot.type === 'gallery') {
          const cols = slot.galleryColumns ?? 2;
          const count = slot.galleryCount ?? cols;
          const gRows = Math.ceil(count / cols);
          const cellW = (slotW - (cols - 1) * 1.5) / cols;
          const cellH = (rowH - (gRows - 1) * 1.5) / gRows;
          for (let r = 0; r < gRows; r++)
            for (let c = 0; c < cols; c++) {
              if (r * cols + c >= count) break;
              const cx2 = xCursor + c * (cellW + 1.5);
              const cy2 = y + r * (cellH + 1.5);
              rects.push(
                `<rect x="${cx2}" y="${cy2}" width="${cellW}" height="${cellH}" rx="1.5" fill="white" opacity="0.12"/>`,
              );
              rects.push(
                `<circle cx="${cx2 + cellW / 2}" cy="${cy2 + cellH / 2 - 1}" r="${Math.min(cellW, cellH) * 0.18}" fill="white" opacity="0.2"/>`,
              );
            }
        } else if (slot.type === 'image') {
          const cx = xCursor + slotW / 2;
          const cy = y + rowH / 2;
          rects.push(`<circle cx="${cx}" cy="${cy - 3}" r="3" fill="white" opacity="0.25"/>`);
          rects.push(
            `<path d="M${xCursor + 2} ${y + rowH - 3} L${xCursor + slotW * 0.4} ${y + rowH / 2 + 2} L${xCursor + slotW - 2} ${y + rowH - 3}" fill="white" opacity="0.2"/>`,
          );
        } else {
          const cols = slot.columns ?? 1;
          const colW = (slotW - (cols - 1) * 2) / cols;
          for (let c = 0; c < cols; c++) {
            const cx = xCursor + c * (colW + 2);
            [0.2, 0.45, 0.7].forEach((frac) => {
              if (y + frac * rowH + 1 < y + rowH - 1)
                rects.push(
                  `<rect x="${cx + 1}" y="${y + frac * rowH}" width="${colW * 0.85}" height="1.5" rx="0.75" fill="white" opacity="0.2"/>`,
                );
            });
          }
        }
        xCursor += slotW + GAP;
      });
    });
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" rx="4" fill="#0f172a"/>${rects.join('')}</svg>`;
}

/** Sloty z uložených bloků (pro náhled po editaci v editoru). */
export function blocksToSeriesSlotsForPreview(blocks: any[]): SeriesSlot[] {
  if (!Array.isArray(blocks)) return [];
  return blocks.map((b) => {
    const c = b.content || {};
    const gal = c.gallery;
    const isGallery = b.type === 'image' && Array.isArray(gal) && gal.length > 1;
    const slot: SeriesSlot = {
      type: isGallery ? 'gallery' : String(b.type || 'paragraph'),
      span: typeof b.gridSpan === 'number' ? b.gridSpan : 12,
      level: c.level,
      columns: c.columns,
      floatSide: b.floatSide,
      floatSpanBlocks: b.floatSpanBlocks,
      floatGridSpan: b.floatGridSpan,
      galleryColumns: c.gridColumns,
      galleryCount: isGallery ? gal.length : undefined,
    };
    return slot;
  });
}

export function layoutPreviewSvgFromBlocks(blocks: any[]): string {
  const slots = blocksToSeriesSlotsForPreview(blocks);
  if (slots.length === 0) return '';
  return generateLayoutSvgFromSlots(slots);
}

/** Stejné jako dříve `makeLayoutBlocks` v DesignSystemPanel. */
export function worksheetBlocksFromLayoutSlots(
  slots: SeriesSlot[],
  typography?: DesignSystem['typography'],
): WorksheetBlock[] {
  let idCounter = 0;
  const nextId = () => `ds-layout-${++idCounter}`;

  const ov = (id: TypoKey) => typography?.styles?.[id] ?? {};
  const resolveFont = (id: TypoKey, isHeading: boolean) =>
    ov(id).fontFamily ||
    (isHeading ? `'${typography?.headingFont ?? 'Inter'}', serif` : `'${typography?.bodyFont ?? 'Inter'}', sans-serif`);

  const applyTypo = (slot: SeriesSlot, base: any): any => {
    if (!typography) return base;
    if (slot.type === 'heading') {
      const styleId = (slot.level as TypoKey) ?? 'h2';
      const o = ov(styleId);
      return {
        ...base,
        fontFamily: resolveFont(styleId, true),
        fontSize: o.fontSize,
        lineHeight: o.lineHeight,
        letterSpacing: o.letterSpacing,
        align: o.textAlign || base.align,
        isBold: o.isBold,
        isItalic: o.isItalic,
        isUnderline: o.isUnderline,
        textColor: o.textColor,
      };
    }
    if (slot.type === 'paragraph') {
      const o = ov('body');
      return {
        ...base,
        fontFamily: resolveFont('body', false),
        fontSize: o.fontSize,
        lineHeight: o.lineHeight || 1.5,
        letterSpacing: o.letterSpacing,
        align: o.textAlign || base.align,
        isBold: o.isBold,
        isItalic: o.isItalic,
        isUnderline: o.isUnderline,
        textColor: o.textColor,
      };
    }
    return base;
  };

  const makePlaceholderContent = (slot: SeriesSlot): any => {
    if (slot.type === 'heading')
      return applyTypo(slot, { text: 'Název kapitoly nebo sekce', level: slot.level || 'h2' });
    if (slot.type === 'infobox')
      return { title: 'Shrnutí', html: '<p>Klíčové pojmy a závěry sekce.</p>', variant: 'green' as const };
    if (slot.type === 'paragraph')
      return applyTypo(slot, {
        html: '<p>Sem vložte hlavní text sekce. Popište téma srozumitelně a přehledně. Příliš žluťoučký kůň úpěl ďábelské ódy.</p>',
      });
    if (slot.type === 'gallery')
      return {
        url: '',
        alt: '',
        caption: '',
        alignment: 'center' as const,
        size: 100,
        gallery: Array(slot.galleryCount ?? 2).fill(''),
        galleryLayout: 'grid' as const,
        gridColumns: slot.galleryColumns ?? 1,
      };
    return { url: '', alt: '', caption: '', size: 100, alignment: 'center' as const };
  };

  return slots.map((slot, i) => {
    const blockType = (slot.type === 'gallery' ? 'image' : slot.type) as any;
    const block: any = {
      id: nextId(),
      type: blockType,
      order: i,
      gridSpan: slot.span,
      width: slot.span < 12 ? 'half' : 'full',
      content: makePlaceholderContent(slot),
    };
    if (slot.floatSide) {
      block.floatSide = slot.floatSide;
      block.floatSpanBlocks = slot.floatSpanBlocks;
      block.floatGridSpan = slot.floatGridSpan;
    }
    if (slot.columns && blockType === 'paragraph') block.content = { ...block.content, columns: slot.columns };
    return block as WorksheetBlock;
  });
}

const PAGE_LAYOUT_GROUP_CUSTOM_PREFIX = 'page-layout-group-';

/** Stabilní id vlastního layoutu navázaného na položku `pageLayoutGroups[]`. */
export function pageLayoutGroupCustomLayoutId(groupId: string): string {
  return `${PAGE_LAYOUT_GROUP_CUSTOM_PREFIX}${groupId}`;
}

/**
 * Sloty odpovídající `previewKind` — stejná struktura jako náhled na canvasu (zjednodušeně na mřížku 12).
 */
export function seriesSlotsForPageLayoutPreviewKind(kind: DesignSystemPageLayoutPreviewKind): SeriesSlot[] {
  switch (kind) {
    case 'heading_row_infobox_image':
      return [
        { type: 'heading', span: 12, level: 'h2' },
        { type: 'infobox', span: 8 },
        { type: 'image', span: 4 },
      ];
    case 'wide_infobox_with_figure':
      return [
        { type: 'heading', span: 12, level: 'h3' },
        { type: 'paragraph', span: 7 },
        { type: 'image', span: 5 },
      ];
    case 'heading_body_full_width':
      return [
        { type: 'heading', span: 12, level: 'h2' },
        { type: 'paragraph', span: 12 },
      ];
    case 'full_width_text':
      return [{ type: 'paragraph', span: 12 }];
    case 'full_width_image':
      return [{ type: 'image', span: 12 }];
    case 'two_column_text':
      return [
        { type: 'heading', span: 12, level: 'h2' },
        { type: 'paragraph', span: 12, columns: 2 },
      ];
    case 'vertical_stack':
      return [
        { type: 'heading', span: 12, level: 'h2' },
        { type: 'image', span: 12 },
        { type: 'paragraph', span: 12 },
      ];
    default:
      return seriesSlotsForPageLayoutPreviewKind('heading_row_infobox_image');
  }
}

function pickDefaultVisualStyles(ds: DesignSystem): BlockVisualStyles | undefined {
  const dvs = ds.blockPreferences.defaultVisualStyles;
  if (!dvs || Object.keys(dvs).length === 0) return undefined;
  return { ...dvs };
}

/**
 * Bloky pro editor — odpovídají náhledu na plátně (stejné ukázkové texty, typografie z DS,
 * `defaultVisualStyles` na „rámečkový“ odstavce místo generického zeleného infoboxu).
 */
export function worksheetBlocksFromPageLayoutPreviewKind(
  ds: DesignSystem,
  kind: DesignSystemPageLayoutPreviewKind,
): WorksheetBlock[] {
  let idCounter = 0;
  const nextId = () => `ds-layout-${++idCounter}`;
  const typography = ds.typography;
  const dvs = pickDefaultVisualStyles(ds);

  const ov = (id: TypoKey) => typography?.styles?.[id] ?? {};
  const resolveFont = (id: TypoKey, isHeading: boolean) =>
    ov(id).fontFamily ||
    (isHeading
      ? `'${typography?.headingFont ?? 'Inter'}', serif`
      : `'${typography?.bodyFont ?? 'Inter'}', sans-serif`);

  const headingContent = (level: 'h1' | 'h2' | 'h3', text: string, align?: 'left' | 'center' | 'right') => {
    const styleId = level as TypoKey;
    const o = ov(styleId);
    return {
      text,
      level,
      fontFamily: resolveFont(styleId, true),
      fontSize: o.fontSize,
      lineHeight: o.lineHeight,
      letterSpacing: o.letterSpacing,
      align: align ?? (o.textAlign as 'left' | 'center' | 'right' | undefined) ?? 'left',
      isBold: o.isBold,
      isItalic: o.isItalic,
      isUnderline: o.isUnderline,
      textColor: o.textColor,
    };
  };

  const paragraphContent = (html: string, columns?: 1 | 2 | 3) => {
    const o = ov('body');
    const base = {
      html,
      fontFamily: resolveFont('body', false),
      fontSize: o.fontSize,
      lineHeight: o.lineHeight || 1.5,
      letterSpacing: o.letterSpacing,
      align: o.textAlign || 'left',
      isBold: o.isBold,
      isItalic: o.isItalic,
      isUnderline: o.isUnderline,
      textColor: o.textColor,
    };
    return columns ? { ...base, columns } : base;
  };

  const imageContent = (caption: string) => ({
    url: '',
    alt: '',
    caption,
    showCaption: true,
    size: 100,
    alignment: 'center' as const,
  });

  switch (kind) {
    case 'heading_row_infobox_image': {
      const boxHtml =
        '<p>Odstavec textu v rámečku podle pravidel u tohoto vzoru. Druhý odstavec ukazuje zalamování a odsazení vůči obrázku vpravo — typický úvodní blok kapitoly s ilustrací.</p>';
      return [
        {
          id: nextId(),
          type: 'heading' as const,
          order: 0,
          gridSpan: 12,
          width: 'full' as const,
          content: headingContent('h2', 'UKÁZKOVÝ NADPIS SEKCE'),
        },
        {
          id: nextId(),
          type: 'paragraph' as const,
          order: 1,
          gridSpan: 8,
          width: 'half' as const,
          visualStyles: dvs ? { ...dvs } : undefined,
          content: paragraphContent(boxHtml),
        },
        {
          id: nextId(),
          type: 'image' as const,
          order: 2,
          gridSpan: 4,
          width: 'half' as const,
          visualStyles: dvs?.borderRadius != null ? { borderRadius: dvs.borderRadius } : undefined,
          content: imageContent(
            'Popisek pod obrázkem — delší řádek, aby bylo vidět zarovnání a mezeru pod ilustrací.',
          ),
        },
      ];
    }
    case 'wide_infobox_with_figure': {
      const bodyHtml =
        '<p>Text uvnitř širokého bloku s odsazením od okrajů. Pokračování odstavce ukazuje delší výklad vedle menší figury — několik řádků, aby byl náhled výš a lépe odpovídal reálné stránce.</p>';
      return [
        {
          id: nextId(),
          type: 'heading' as const,
          order: 0,
          gridSpan: 12,
          width: 'full' as const,
          content: headingContent('h3', 'LIŠTA S NADPISEM UVNITŘ BLOKU', 'center'),
        },
        {
          id: nextId(),
          type: 'paragraph' as const,
          order: 1,
          gridSpan: 7,
          width: 'half' as const,
          visualStyles: dvs ? { ...dvs } : undefined,
          content: paragraphContent(bodyHtml),
        },
        {
          id: nextId(),
          type: 'image' as const,
          order: 2,
          gridSpan: 5,
          width: 'half' as const,
          visualStyles: dvs?.borderRadius != null ? { borderRadius: dvs.borderRadius } : undefined,
          content: { url: '', alt: '', caption: '', showCaption: false, size: 100, alignment: 'center' as const },
        },
      ];
    }
    case 'heading_body_full_width': {
      const bodyHtml =
        '<p>Souvislý výkladový text přes celou šířku textové oblasti — několik vět, bez obrázku vedle v jednom řádku. Druhý odstavec doplňuje kontext: běžné řádkování, mezery mezi odstavci a jak vypadá delší blok učebnicového textu. Třetí odstavec zarovnává náhled s reálnou výškou stránky.</p>';
      return [
        {
          id: nextId(),
          type: 'heading' as const,
          order: 0,
          gridSpan: 12,
          width: 'full' as const,
          content: headingContent('h2', 'Nadpis kapitoly nebo podsekce'),
        },
        {
          id: nextId(),
          type: 'paragraph' as const,
          order: 1,
          gridSpan: 12,
          width: 'full' as const,
          content: paragraphContent(bodyHtml),
        },
      ];
    }
    case 'full_width_text': {
      const bodyHtml =
        '<p>Čistý text přes šířku stránky — odstavce výkladu, příběhu nebo instrukcí, bez velkého nadpisu sekce nebo dominantního obrázku v rozložení. Druhý odstavec ukazuje, jak se text skládá při delším obsahu a jak působí prázdná mřížka kolem. Třetí odstavec a čtvrtý zarovnávají výšku náhledu s typickou stránkou plnou souvislého čtení.</p>';
      return [
        {
          id: nextId(),
          type: 'paragraph' as const,
          order: 0,
          gridSpan: 12,
          width: 'full' as const,
          content: paragraphContent(bodyHtml),
        },
      ];
    }
    case 'full_width_image': {
      return [
        {
          id: nextId(),
          type: 'image' as const,
          order: 0,
          gridSpan: 12,
          width: 'full' as const,
          visualStyles: dvs?.borderRadius != null ? { borderRadius: dvs.borderRadius } : undefined,
          content: imageContent(
            'Popisek pod dominantním obrázkem přes šířku — delší vysvětlení ilustrace, zdroje nebo kontextu k obrázku.',
          ),
        },
      ];
    }
    case 'two_column_text': {
      const bodyHtml = `<p>Levý sloupec souvislého textu — výklad pokračuje v druhé kolonce vedle. Doplňující věty ukazují zalamování a výšku sloupce při delším obsahu, aby byl náhled srovnatelný se skutečnou dvousloupcovou stránkou.</p><p>Pravý sloupec — druhá část odstavce nebo pokračování textu. Zde může být druhá myšlenka, příklad nebo poznámka pod čarou ve stejné výšce jako vlevo.</p>`;
      return [
        {
          id: nextId(),
          type: 'paragraph' as const,
          order: 0,
          gridSpan: 12,
          width: 'full' as const,
          content: paragraphContent(bodyHtml, 2),
        },
      ];
    }
    case 'vertical_stack': {
      const cap = 'Popisek k obrázku (2. blok) — delší vysvětlení nebo odkaz na zdroj pod ilustrací.';
      const bodyHtml =
        '<p>Textový blok pod obrázkem (3. blok) — pořadí a počet bloků popiš v pravidlech. Druhý odstavec ukazuje souvislý text až pod celým obrázkem; třetí odstavec simuluje delší závěr sekce nebo úkol pro žáka.</p>';
      return [
        {
          id: nextId(),
          type: 'heading' as const,
          order: 0,
          gridSpan: 12,
          width: 'full' as const,
          content: headingContent('h2', 'Nadpis (1. blok)'),
        },
        {
          id: nextId(),
          type: 'image' as const,
          order: 1,
          gridSpan: 12,
          width: 'full' as const,
          visualStyles: dvs?.borderRadius != null ? { borderRadius: dvs.borderRadius } : undefined,
          content: imageContent(cap),
        },
        {
          id: nextId(),
          type: 'paragraph' as const,
          order: 2,
          gridSpan: 12,
          width: 'full' as const,
          content: paragraphContent(bodyHtml),
        },
      ];
    }
    default:
      return worksheetBlocksFromPageLayoutPreviewKind(ds, 'heading_row_infobox_image');
  }
}

/**
 * Zajistí v `customLayouts` záznam pro skupinu layoutu (při prvním otevření z plátna).
 * Pokud už existuje, design systém nemění — zachová uživatelské úpravy.
 */
export function ensurePageLayoutGroupCustomLayout(
  ds: DesignSystem,
  group: DesignSystemPageLayoutGroup,
): DesignSystem {
  const layoutId = pageLayoutGroupCustomLayoutId(group.id);
  const has = ds.blockPreferences.customLayouts?.some((l) => l.id === layoutId);
  if (has) return ds;
  const kind = group.previewKind ?? 'heading_row_infobox_image';
  const blocks = worksheetBlocksFromPageLayoutPreviewKind(ds, kind);
  const newLayout: CustomLayout = {
    id: layoutId,
    name: group.title,
    blocks: blocks as any[],
  };
  return {
    ...ds,
    blockPreferences: {
      ...ds.blockPreferences,
      customLayouts: [...(ds.blockPreferences.customLayouts ?? []), newLayout],
    },
  };
}
