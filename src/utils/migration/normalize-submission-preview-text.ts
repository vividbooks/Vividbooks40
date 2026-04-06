/** Max délka plain text náhledu u odevzdání (DB `text_preview`). */
export const TEXT_PREVIEW_MAX = 20_000;

/**
 * HTML → zhuštěný plain text (pro učitelský náhled, bez ukládání base64).
 */
export function normalizeSubmissionPreviewPlainText(raw: string): string {
  const stripped = raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.slice(0, TEXT_PREVIEW_MAX);
}
