import { describe, expect, it } from 'vitest';
import {
  normalizeSubmissionPreviewPlainText,
  TEXT_PREVIEW_MAX,
} from './normalize-submission-preview-text';

describe('normalizeSubmissionPreviewPlainText', () => {
  it('odstraní HTML tagy', () => {
    expect(normalizeSubmissionPreviewPlainText('<p>Ahoj</p> <b>světe</b>')).toBe('Ahoj světe');
  });

  it('prázdný vstup', () => {
    expect(normalizeSubmissionPreviewPlainText('   ')).toBe('');
  });

  it('zkrátí na TEXT_PREVIEW_MAX', () => {
    const long = 'x'.repeat(TEXT_PREVIEW_MAX + 500);
    const out = normalizeSubmissionPreviewPlainText(long);
    expect(out.length).toBe(TEXT_PREVIEW_MAX);
  });
});
