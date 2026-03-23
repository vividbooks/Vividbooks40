/**
 * Basename pro React Router = stejný prefix jako Vite `base` / import.meta.env.BASE_URL.
 *
 * Na GitHub Pages je správná URL …/Vividbooks40/laiout/ (knihovna). Pokud někdo otevře jen …/laiout
 * (bez názvu repa), nepoužijeme basename, aby routy jako /laiout/ pořád fungovaly.
 */
export function getRouterBasename(): string {
  const configured = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
  if (typeof window === 'undefined') return configured;
  if (!configured) return '';
  const { pathname } = window.location;
  if (pathname === configured || pathname.startsWith(`${configured}/`)) {
    return configured;
  }
  return '';
}

/**
 * Plná URL pro Supabase OAuth `redirectTo`.
 * Musí vycházet z Vite `import.meta.env.BASE_URL` (build pro GH = `/Vividbooks40/`),
 * ne z dynamického getRouterBasename() — jinak na Pages vznikne `/auth/callback` bez prefixu,
 * redirect není v Supabase allow listu a Supabase pošle uživatele na Site URL (často localhost).
 */
export function getAuthCallbackRedirectUrl(): string {
  const raw = import.meta.env.BASE_URL ?? '/';
  const trimmed = raw.replace(/\/$/, '');
  const path = trimmed ? `${trimmed}/auth/callback` : '/auth/callback';
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
}
