/** Čitelná zpráva z PostgREST / Supabase chyby (včetně RLS / rekurze z DB). */
export function formatSupabaseError(e: unknown): string {
  if (e == null) return 'Neznámá chyba';
  if (typeof e === 'string') return e;
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === 'object') {
    const o = e as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };
    const parts = [o.message, o.details, o.hint].filter(
      (x): x is string => typeof x === 'string' && x.length > 0,
    );
    if (parts.length) return parts.join(' — ');
  }
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
