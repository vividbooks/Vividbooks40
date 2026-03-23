const DATA_URL_PREFIXES = ['data:image/', 'data:application/json'];
const PROTOCOL_REGEX = /^[a-zA-Z][a-zA-Z\d+.-]*:/;
const BARE_WEB_URL_REGEX = /^(localhost(?::\d+)?|(?:[\w-]+\.)+[a-z]{2,})(?:[/?#].*)?$/i;

function isDataUrl(value: string) {
  return DATA_URL_PREFIXES.some((prefix) => value.startsWith(prefix));
}

export function normalizeLinkUrl(url?: string): string {
  const trimmed = url?.trim() || '';
  if (!trimmed) return '';
  if (isDataUrl(trimmed)) return trimmed;

  if (PROTOCOL_REGEX.test(trimmed)) {
    return trimmed.replace(/^http:\/\//i, 'https://');
  }

  if (BARE_WEB_URL_REGEX.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

export function isRenderableLinkUrl(url?: string): boolean {
  const normalized = normalizeLinkUrl(url);
  if (!normalized) return false;
  if (isDataUrl(normalized)) return true;

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
