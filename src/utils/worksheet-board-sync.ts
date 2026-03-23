/**
 * Worksheet Board Sync
 *
 * Manages the 1:1 link between a Worksheet and its dedicated Quiz/Board.
 * Call syncWorksheetToBoard() to create or refresh the linked board.
 * The board is identified by worksheet.linkedBoardId ↔ quiz.linkedWorksheetId.
 */

import { Worksheet } from '../types/worksheet';
import { Quiz } from '../types/quiz';
import { worksheetToBoard } from './content-converter';
import { saveQuiz, getQuiz } from './quiz-storage';
import { saveWorksheet } from './worksheet-storage';

export interface SyncResult {
  quiz: Quiz;
  /** True when a brand-new board was created; false when an existing one was updated */
  created: boolean;
  /** Maps each source block ID to the index of its first generated slide */
  blockIdToSlideIndex: Record<string, number>;
}

/**
 * Synchronises (or creates) the board that is linked to the given worksheet.
 *
 * The worksheetMap (page thumbnails + region overlays) is NOT regenerated here
 * because it requires live DOM captures. Pass a pre-built worksheetMap via
 * `worksheetMapData` to attach it to the board.
 *
 * @param worksheet        The source worksheet (will be mutated to set linkedBoardId and saved)
 * @param onSave           Callback to persist the updated worksheet in the calling component's state
 * @param worksheetMapData Optional pre-captured WorksheetMap to attach to the board
 * @param htmlCaptures     Optional pre-captured HTML strings for blocks in 'html' subQuestions mode
 */
export async function syncWorksheetToBoard(
  worksheet: Worksheet,
  onSave: (updated: Worksheet) => void,
  worksheetMapData?: Quiz['worksheetMap'],
  htmlCaptures?: Record<string, string>,
  skipBlockIds?: string[],
): Promise<SyncResult> {
  // Determine whether we're updating an existing board or creating a new one
  let existingQuiz: Quiz | null = null;
  if (worksheet.linkedBoardId) {
    existingQuiz = getQuiz(worksheet.linkedBoardId);
  }

  // Convert the worksheet blocks → slides, respecting per-block boardSettings and HTML captures
  const { quiz: freshQuiz, blockIdToSlideIndex } = worksheetToBoard(worksheet, {
    useBoardSettings: true,
    htmlCaptures: htmlCaptures ?? {},
    skipBlockIds: skipBlockIds ?? [],
  });

  let finalQuiz: Quiz;
  const created = !existingQuiz;

  if (existingQuiz) {
    // Preserve the existing board's identity and settings; only update content
    finalQuiz = {
      ...existingQuiz,
      title: `${worksheet.title} (Board)`,
      description: worksheet.description,
      subject: worksheet.metadata?.subject,
      grade: worksheet.metadata?.grade,
      slides: freshQuiz.slides,
      updatedAt: new Date().toISOString(),
      linkedWorksheetId: worksheet.id,
      worksheetMap: worksheetMapData ?? existingQuiz.worksheetMap,
    };
  } else {
    // Brand-new board
    finalQuiz = {
      ...freshQuiz,
      linkedWorksheetId: worksheet.id,
      worksheetMap: worksheetMapData,
    };
  }

  saveQuiz(finalQuiz);

  // Persist the back-link on the worksheet
  if (worksheet.linkedBoardId !== finalQuiz.id) {
    const updated: Worksheet = { ...worksheet, linkedBoardId: finalQuiz.id };
    saveWorksheet(updated);
    onSave(updated);
  }

  return { quiz: finalQuiz, created, blockIdToSlideIndex };
}
