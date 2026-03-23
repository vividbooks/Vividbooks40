/**
 * generate-worksheet-thumbnails
 *
 * Calls the `worksheet-thumbnails` Supabase Edge Function which uses
 * Browserless.io to render the print page and uploads per-page JPEG
 * screenshots to Supabase Storage.  Returns public URLs — no base64,
 * no localStorage bloat.
 */

import { supabase } from './supabase/client';
import { Worksheet } from '../types/worksheet';

export interface GenerateThumbnailsResult {
  thumbnailUrls: string[];
}

/**
 * Generate per-page thumbnail URLs for a worksheet via the edge function.
 * @param worksheet  The worksheet whose pages to screenshot.
 * @param pageCount  Number of rendered pages (from the live DOM).
 */
export async function generateWorksheetThumbnails(
  worksheet: Worksheet,
  pageCount: number,
): Promise<GenerateThumbnailsResult> {
  // Strip legacy header-footer blocks from the data sent to Browserless.
  // These blocks are rendered inside the content grid but should not appear
  // in thumbnails — the global PageHeader/PageFooter components handle that.
  // This must be done here (not just in PrintGridCanvas) because Browserless
  // loads the DEPLOYED app build, which may not yet have the PrintGridCanvas filter.
  const cleanWorksheet: Worksheet = {
    ...worksheet,
    blocks: worksheet.blocks.filter(b => b.type !== 'header-footer'),
  };

  // Use the Supabase client's functions.invoke — handles auth tokens automatically.
  const { data, error } = await supabase.functions.invoke<GenerateThumbnailsResult>(
    'worksheet-thumbnails',
    {
      body: {
        worksheetId: worksheet.id,
        worksheetData: cleanWorksheet as unknown as Record<string, unknown>,
        pageCount,
      },
    },
  );

  if (error) {
    throw new Error(`worksheet-thumbnails failed: ${error.message}`);
  }
  if (!data?.thumbnailUrls) {
    throw new Error('worksheet-thumbnails returned no thumbnailUrls');
  }

  return data;
}
