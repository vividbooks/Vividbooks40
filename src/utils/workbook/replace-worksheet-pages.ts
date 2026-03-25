import type { Workbook, WorkbookPage } from '../../types/workbook';

/**
 * Upraví počet stránek jedné kapitoly (worksheetu) v přehledu knih a přečísluje stránky.
 */
export function replaceWorksheetPageSpan(
  workbook: Workbook,
  worksheetId: string,
  newPageCount: number,
): Workbook {
  const count = Math.max(1, Math.min(500, Math.round(newPageCount)));
  const start = workbook.pages.findIndex((p) => p.worksheetId === worksheetId);
  if (start < 0) return workbook;

  let runStart = start;
  while (runStart > 0 && workbook.pages[runStart - 1].worksheetId === worksheetId) {
    runStart--;
  }
  let runEnd = runStart;
  while (runEnd < workbook.pages.length && workbook.pages[runEnd].worksheetId === worksheetId) {
    runEnd++;
  }
  const oldLen = runEnd - runStart;
  if (oldLen === count) return workbook;

  const chapter = workbook.chapters.find((c) => c.id === `chapter-${worksheetId}`);
  const chapterId = chapter?.id ?? `chapter-${worksheetId}`;

  const newSpan: WorkbookPage[] = [];
  for (let p = 0; p < count; p++) {
    newSpan.push({
      id: `page-${worksheetId}-${p}`,
      pageNumber: 0,
      worksheetId,
      worksheetPageIndex: p,
      startsChapterId: p === 0 ? chapterId : undefined,
    });
  }

  const nextPages = [...workbook.pages.slice(0, runStart), ...newSpan, ...workbook.pages.slice(runEnd)];
  nextPages.forEach((pg, i) => {
    pg.pageNumber = i + 1;
  });

  const contentPages = nextPages.length;
  const prevLimit = workbook.settings.pageLimit;
  const pageLimit = Math.max(prevLimit != null && prevLimit >= 1 ? prevLimit : 1, contentPages, 1);

  return {
    ...workbook,
    pages: nextPages,
    settings: {
      ...workbook.settings,
      pageLimit,
    },
  };
}
