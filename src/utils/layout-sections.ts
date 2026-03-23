import { createEmptyBlock } from '../types/worksheet';
import type { LayoutSectionBlock, LayoutSectionContent, WorksheetBlock } from '../types/worksheet';

export type LayoutSectionColumnId = 'col-1' | 'col-2' | 'col-3';

export const DEFAULT_LAYOUT_SECTION_CONTENT: LayoutSectionContent = {
  columns: 2,
  layoutStyle: 'equal',
  columnRatios: [50, 50],
  columnGap: 16,
  minHeight: 180,
};

function roundRatio(value: number): number {
  return Math.round(value * 10) / 10;
}

export function getDefaultLayoutSectionRatios(
  columns: 2 | 3,
  layoutStyle: LayoutSectionContent['layoutStyle'] = 'equal',
): number[] {
  if (columns === 3) return [34, 33, 33];
  if (layoutStyle === 'sidebar-left') return [65, 35];
  if (layoutStyle === 'sidebar-right') return [35, 65];
  return [50, 50];
}

export function normalizeLayoutSectionRatios(
  columns: 2 | 3,
  ratios?: number[] | null,
  layoutStyle: LayoutSectionContent['layoutStyle'] = 'equal',
): number[] {
  const defaults = getDefaultLayoutSectionRatios(columns, layoutStyle);
  const minRatio = columns === 3 ? 15 : 25;
  const source = Array.isArray(ratios) && ratios.length >= columns ? ratios.slice(0, columns) : defaults;
  const clamped = source.map((value, index) => (
    Number.isFinite(value) ? Math.max(minRatio, Number(value)) : defaults[index]
  ));
  const total = clamped.reduce((sum, value) => sum + value, 0) || defaults.reduce((sum, value) => sum + value, 0);
  const normalized = clamped.map((value) => roundRatio((value / total) * 100));
  const diff = roundRatio(100 - normalized.reduce((sum, value) => sum + value, 0));
  normalized[normalized.length - 1] = roundRatio(normalized[normalized.length - 1] + diff);
  return normalized;
}

export function isLayoutSectionBlock(block: WorksheetBlock): block is LayoutSectionBlock {
  return block.type === 'layout-section';
}

export function normalizeLayoutSectionContent(content?: Partial<LayoutSectionContent> | null): LayoutSectionContent {
  const columns = content?.columns === 3 ? 3 : 2;
  const layoutStyle = content?.layoutStyle ?? 'equal';
  return {
    columns,
    layoutStyle,
    columnRatios: normalizeLayoutSectionRatios(columns, content?.columnRatios, layoutStyle),
    columnGap: typeof content?.columnGap === 'number' ? content.columnGap : DEFAULT_LAYOUT_SECTION_CONTENT.columnGap,
    minHeight: typeof content?.minHeight === 'number' ? content.minHeight : DEFAULT_LAYOUT_SECTION_CONTENT.minHeight,
  };
}

export function getLayoutSectionColumnIds(columns: 2 | 3): LayoutSectionColumnId[] {
  return columns === 3 ? ['col-1', 'col-2', 'col-3'] : ['col-1', 'col-2'];
}

export function getLayoutSectionLabel(content?: Partial<LayoutSectionContent> | null): string {
  const normalized = normalizeLayoutSectionContent(content);
  return normalized.columns === 3 ? 'Layout 3 sloupce' : 'Layout 2 sloupce';
}

export function normalizeLayoutSectionBlocks(blocks: WorksheetBlock[]): WorksheetBlock[] {
  const sectionMap = new Map<string, LayoutSectionContent>();

  const sanitized = blocks.map((block) => {
    if (isLayoutSectionBlock(block)) {
      const content = normalizeLayoutSectionContent(block.content);
      sectionMap.set(block.id, content);
      return {
        ...block,
        content,
        layoutSectionId: undefined,
        layoutColumnId: undefined,
        layoutOrder: undefined,
      } as WorksheetBlock;
    }

    return block;
  });

  const counters = new Map<string, number>();

  return sanitized.map((block) => {
    if (isLayoutSectionBlock(block)) return block;

    if (!block.layoutSectionId) {
      return {
        ...block,
        layoutSectionId: undefined,
        layoutColumnId: undefined,
        layoutOrder: undefined,
      };
    }

    const section = sectionMap.get(block.layoutSectionId);
    if (!section) {
      return {
        ...block,
        layoutSectionId: undefined,
        layoutColumnId: undefined,
        layoutOrder: undefined,
      };
    }

    const validColumnIds = getLayoutSectionColumnIds(section.columns);
    const layoutColumnId = validColumnIds.includes(block.layoutColumnId as LayoutSectionColumnId)
      ? (block.layoutColumnId as LayoutSectionColumnId)
      : validColumnIds[0];

    const counterKey = `${block.layoutSectionId}:${layoutColumnId}`;
    const layoutOrder = counters.get(counterKey) ?? 0;
    counters.set(counterKey, layoutOrder + 1);

    return {
      ...block,
      layoutSectionId: block.layoutSectionId,
      layoutColumnId,
      layoutOrder,
    };
  });
}

export function getLayoutSectionChildren(blocks: WorksheetBlock[], layoutSectionId: string): WorksheetBlock[] {
  return blocks
    .filter((block) => block.layoutSectionId === layoutSectionId)
    .sort((a, b) => {
      const orderDiff = (a.layoutOrder ?? 0) - (b.layoutOrder ?? 0);
      return orderDiff !== 0 ? orderDiff : a.order - b.order;
    });
}

export function getLayoutSectionColumnBlocks(
  blocks: WorksheetBlock[],
  layoutSectionId: string,
  columnId: LayoutSectionColumnId,
): WorksheetBlock[] {
  return getLayoutSectionChildren(blocks, layoutSectionId).filter((block) => block.layoutColumnId === columnId);
}

function clearLegacyLayoutProps(block: WorksheetBlock): WorksheetBlock {
  return {
    ...block,
    floatSide: undefined,
    floatSpanBlocks: undefined,
    floatGridSpan: undefined,
    floatWidthPercent: undefined,
  };
}

function getBlockGridSpan(block: WorksheetBlock, fullGridSpan: number): number {
  if (typeof block.gridSpan === 'number' && Number.isFinite(block.gridSpan)) {
    return Math.max(1, Math.min(fullGridSpan, Math.round(block.gridSpan)));
  }
  if (block.width === 'half') {
    return Math.max(1, Math.round(fullGridSpan / 2));
  }
  return fullGridSpan;
}

function buildLayoutSectionGroup(options: {
    fullGridSpan: number;
    columns: 2 | 3;
    columnRatios: number[];
    columnsBlocks: WorksheetBlock[][];
  }): WorksheetBlock[] {
  const layoutSection = createEmptyBlock('layout-section', 0) as LayoutSectionBlock;
  const columnIds = getLayoutSectionColumnIds(options.columns);
  const sectionId = layoutSection.id;

  const sectionBlock: WorksheetBlock = {
    ...layoutSection,
    gridSpan: options.fullGridSpan,
    content: {
      ...layoutSection.content,
      columns: options.columns,
      layoutStyle: 'custom',
      columnRatios: normalizeLayoutSectionRatios(options.columns, options.columnRatios, 'custom'),
    },
  };

  const childBlocks = options.columnsBlocks.flatMap((columnBlocks, columnIndex) => (
    columnBlocks.map((block, itemIndex) => ({
      ...clearLegacyLayoutProps(block),
      layoutSectionId: sectionId,
      layoutColumnId: columnIds[columnIndex],
      layoutOrder: itemIndex,
      gridSpan: options.fullGridSpan,
      width: 'full' as const,
    }))
  ));

  return [sectionBlock, ...childBlocks];
}

export function convertLegacyLayoutsToLayoutSections(
  blocks: WorksheetBlock[],
  fullGridSpan = 12,
): WorksheetBlock[] {
  const source = normalizeLayoutSectionBlocks(blocks);
  const nextBlocks: WorksheetBlock[] = [];

  let index = 0;
  while (index < source.length) {
    const current = source[index];

    if (isLayoutSectionBlock(current) || current.layoutSectionId) {
      nextBlocks.push(clearLegacyLayoutProps(current));
      index += 1;
      continue;
    }

    if (current.floatSide && (current.floatSpanBlocks ?? 0) > 0) {
      const siblingCount = Math.max(1, current.floatSpanBlocks ?? 0);
      const siblingBlocks: WorksheetBlock[] = [];

      for (let offset = 1; offset <= siblingCount && index + offset < source.length; offset += 1) {
        const sibling = source[index + offset];
        if (isLayoutSectionBlock(sibling) || sibling.layoutSectionId) break;
        siblingBlocks.push(sibling);
      }

      if (siblingBlocks.length > 0) {
        const anchorSpan = Math.max(1, Math.min(fullGridSpan - 1, current.floatGridSpan ?? getBlockGridSpan(current, fullGridSpan)));
        const otherSpan = Math.max(1, fullGridSpan - anchorSpan);
        const columnRatios = [anchorSpan, otherSpan];
        const columnsBlocks = current.floatSide === 'left'
          ? [[current], siblingBlocks]
          : [siblingBlocks, [current]];
        nextBlocks.push(
          ...buildLayoutSectionGroup({
            fullGridSpan,
            columns: 2,
            columnRatios,
            columnsBlocks,
          }),
        );
        index += siblingBlocks.length + 1;
        continue;
      }
    }

    const currentSpan = getBlockGridSpan(current, fullGridSpan);
    if (currentSpan < fullGridSpan) {
      const rowBlocks: WorksheetBlock[] = [current];
      let rowSpan = currentSpan;
      let cursor = index + 1;

      while (cursor < source.length && rowBlocks.length < 3) {
        const candidate = source[cursor];
        if (isLayoutSectionBlock(candidate) || candidate.layoutSectionId || candidate.floatSide) break;
        const candidateSpan = getBlockGridSpan(candidate, fullGridSpan);
        if (candidateSpan >= fullGridSpan || rowSpan + candidateSpan > fullGridSpan) break;
        rowBlocks.push(candidate);
        rowSpan += candidateSpan;
        cursor += 1;
        if (rowSpan >= fullGridSpan) break;
      }

      if (rowBlocks.length >= 2 && rowSpan === fullGridSpan) {
        const columns = rowBlocks.length === 3 ? 3 : 2;
        nextBlocks.push(
          ...buildLayoutSectionGroup({
            fullGridSpan,
            columns,
            columnRatios: rowBlocks.map((block) => getBlockGridSpan(block, fullGridSpan)),
            columnsBlocks: rowBlocks.map((block) => [block]),
          }),
        );
        index += rowBlocks.length;
        continue;
      }
    }

    nextBlocks.push(clearLegacyLayoutProps(current));
    index += 1;
  }

  return normalizeLayoutSectionBlocks(
    nextBlocks.map((block, order) => ({
      ...block,
      order,
    })),
  );
}
