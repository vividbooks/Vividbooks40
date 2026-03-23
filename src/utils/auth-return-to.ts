const STORAGE_KEY = 'vividbooks-auth-return-to';

export function setAuthReturnTo(path: string): void {
  if (!path.startsWith('/') || path.startsWith('//')) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, path);
  } catch {
    /* ignore */
  }
}

export function peekAuthReturnTo(): string | null {
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    if (v && v.startsWith('/') && !v.startsWith('//')) return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function consumeAuthReturnTo(): string | null {
  const v = peekAuthReturnTo();
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return v;
}

export function authReturnToFromSearchParams(search: string): string | null {
  try {
    const next = new URLSearchParams(search).get('next');
    if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  } catch {
    /* ignore */
  }
  return null;
}
