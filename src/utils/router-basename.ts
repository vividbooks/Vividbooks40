/**
 * Basename pro React Router = stejný prefix jako Vite `base` / import.meta.env.BASE_URL.
 *
 * Na GitHub Pages je správná URL …/Vividbooks40/laiout. Pokud někdo otevře jen …/laiout
 * (bez názvu repa), nepoužijeme basename, aby routy jako /laiout pořád fungovaly.
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
