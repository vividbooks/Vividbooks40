/**
 * Feature flags — Moje třída / repository migration.
 * Nastavení přes VITE_* (Vite) nebo výchozí hodnoty pro postupný rollout.
 */

export type MojeTridaFeatureFlags = {
  /** Sdílení dokumentu ve třídě přes `live_sessions` (kind share) místo jen localStorage. */
  classroomShareSupabase: boolean;
  /** Číst jen z Supabase (bez localStorage fallback pro business data). */
  repoOnly: boolean;
  /** Zapisovat paralelně do Supabase i legacy úložiště (přechodné). */
  dualWrite: boolean;
  /** Povolit čtení starých klíčů při chybějícím řádku v DB. */
  legacyFallback: boolean;
};

function envBool(key: string, defaultValue: boolean): boolean {
  try {
    const env = import.meta.env as Record<string, string | undefined>;
    const v = env[key];
    if (v === undefined || v === '') return defaultValue;
    return v === '1' || v === 'true' || v === 'yes';
  } catch {
    return defaultValue;
  }
}

export function getMojeTridaFlags(): MojeTridaFeatureFlags {
  return {
    classroomShareSupabase: envBool('VITE_FF_CLASSROOM_SHARE_SUPABASE', false),
    repoOnly: envBool('VITE_FF_MOJE_TRIDA_REPO_ONLY', false),
    dualWrite: envBool('VITE_FF_MOJE_TRIDA_DUAL_WRITE', true),
    legacyFallback: envBool('VITE_FF_MOJE_TRIDA_LEGACY_FALLBACK', true),
  };
}
