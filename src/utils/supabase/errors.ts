/**
 * PostgREST vrací 400, když sloupec není v schema cache (nenasazená migrace).
 * Volitelně ověří, že se chyba týká konkrétního sloupce (podřetězec v message).
 */
export function isMissingPostgrestColumnError(
  err: unknown,
  columnName?: string,
): boolean {
  const o = err as { message?: string; code?: string } | null;
  const m = (o?.message ?? '').toLowerCase();
  const c = o?.code ?? '';
  if (c === '42703' || c === 'PGRST204') return true;
  if (m.includes('could not find') && m.includes('column')) {
    if (!columnName) return true;
    return m.includes(String(columnName).toLowerCase());
  }
  if (m.includes('schema cache') && columnName) {
    return m.includes(String(columnName).toLowerCase());
  }
  if (m.includes('does not exist') && m.includes('column')) {
    if (!columnName) return true;
    return m.includes(String(columnName).toLowerCase());
  }
  return false;
}

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
