/**
 * Dev ladění vodících teček písanky — localStorage + JSON (později přenos do kódu / per písmeno).
 */

export const PISANKA_GUIDE_DOTS_DEV_CHANGED = 'vb-pisanka-guide-dots-dev-changed';

const STORAGE_KEY = 'vb-pisanka-guide-dots-dev';

/** Globální výchozí hodnoty (slider + JSON). */
export const GUIDE_DOTS_DEV_DEFAULT_GLOBAL = {
  /** Posun tečky po ose X (px), + vpravo */
  offsetXPx: 0,
  /** Posun tečky po ose Y (px), + dolů */
  offsetYPx: 0,
  /** Násobič rozestupu opakování (1 = po výchozím výpočtu vč. ×1,2) */
  stepMul: 1,
  /** Násobič nástřiku před první znak (1 = výchozí fs×0,09…) */
  leadInMul: 1,
} as const;

export type PisankaGuideDotsDevGlobal = typeof GUIDE_DOTS_DEV_DEFAULT_GLOBAL;

export type PisankaGuideDotsDevTweak = Partial<{
  offsetXPx: number;
  offsetYPx: number;
  stepMul: number;
  leadInMul: number;
}>;

export type PisankaGuideDotsDevState = {
  global: PisankaGuideDotsDevGlobal;
  /**
   * Úpravy podle prvního „viditelného“ znaku předpisu na řádku (klíč = ten znak, např. "C", "s").
   * Sloučí se přes global (přepíše jen uvedená pole).
   */
  byFirstChar?: Record<string, PisankaGuideDotsDevTweak>;
};

function deepMergeGlobal(base: PisankaGuideDotsDevGlobal, patch: PisankaGuideDotsDevTweak): PisankaGuideDotsDevGlobal {
  return {
    offsetXPx: patch.offsetXPx ?? base.offsetXPx,
    offsetYPx: patch.offsetYPx ?? base.offsetYPx,
    stepMul: patch.stepMul ?? base.stepMul,
    leadInMul: patch.leadInMul ?? base.leadInMul,
  };
}

export function defaultGuideDotsDevState(): PisankaGuideDotsDevState {
  return {
    global: { ...GUIDE_DOTS_DEV_DEFAULT_GLOBAL },
    byFirstChar: {},
  };
}

export function parseGuideDotsDevState(json: string): PisankaGuideDotsDevState | null {
  try {
    const raw = JSON.parse(json) as unknown;
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const o = raw as Record<string, unknown>;
    const g = o.global;
    if (g == null || typeof g !== 'object' || Array.isArray(g)) return null;
    const gg = g as Record<string, unknown>;
    const global: PisankaGuideDotsDevGlobal = {
      offsetXPx: typeof gg.offsetXPx === 'number' && Number.isFinite(gg.offsetXPx) ? gg.offsetXPx : 0,
      offsetYPx: typeof gg.offsetYPx === 'number' && Number.isFinite(gg.offsetYPx) ? gg.offsetYPx : 0,
      stepMul:
        typeof gg.stepMul === 'number' && Number.isFinite(gg.stepMul) && gg.stepMul > 0 ? gg.stepMul : 1,
      leadInMul:
        typeof gg.leadInMul === 'number' && Number.isFinite(gg.leadInMul) && gg.leadInMul >= 0
          ? gg.leadInMul
          : 1,
    };
    let byFirstChar: PisankaGuideDotsDevState['byFirstChar'];
    if (o.byFirstChar != null && typeof o.byFirstChar === 'object' && !Array.isArray(o.byFirstChar)) {
      byFirstChar = {};
      for (const [k, v] of Object.entries(o.byFirstChar as Record<string, unknown>)) {
        if (v == null || typeof v !== 'object' || Array.isArray(v)) continue;
        const t = v as Record<string, unknown>;
        const tweak: PisankaGuideDotsDevTweak = {};
        if (typeof t.offsetXPx === 'number' && Number.isFinite(t.offsetXPx)) tweak.offsetXPx = t.offsetXPx;
        if (typeof t.offsetYPx === 'number' && Number.isFinite(t.offsetYPx)) tweak.offsetYPx = t.offsetYPx;
        if (typeof t.stepMul === 'number' && Number.isFinite(t.stepMul) && t.stepMul > 0) tweak.stepMul = t.stepMul;
        if (typeof t.leadInMul === 'number' && Number.isFinite(t.leadInMul) && t.leadInMul >= 0) {
          tweak.leadInMul = t.leadInMul;
        }
        if (Object.keys(tweak).length) byFirstChar[k] = tweak;
      }
      if (Object.keys(byFirstChar).length === 0) byFirstChar = undefined;
    }
    return { global, byFirstChar };
  } catch {
    return null;
  }
}

export function stringifyGuideDotsDevState(state: PisankaGuideDotsDevState): string {
  return JSON.stringify(state, null, 2);
}

export function loadGuideDotsDevState(): PisankaGuideDotsDevState {
  if (typeof localStorage === 'undefined') return defaultGuideDotsDevState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultGuideDotsDevState();
    const parsed = parseGuideDotsDevState(raw);
    return parsed ?? defaultGuideDotsDevState();
  } catch {
    return defaultGuideDotsDevState();
  }
}

export function saveGuideDotsDevState(state: PisankaGuideDotsDevState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, stringifyGuideDotsDevState(state));
  } catch {
    /* ignore quota */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PISANKA_GUIDE_DOTS_DEV_CHANGED));
  }
}

/** První netisknutelný znak — klíč do byFirstChar. */
export function firstSignificantChar(text: string): string {
  const m = text.match(/\S/u);
  return m ? m[0] : '';
}

function tweakForChar(state: PisankaGuideDotsDevState, ch: string): PisankaGuideDotsDevTweak | undefined {
  if (!ch || !state.byFirstChar) return undefined;
  const b = state.byFirstChar;
  return b[ch] ?? b[ch.toUpperCase()] ?? b[ch.toLowerCase()];
}

/** Sloučené hodnoty pro jeden řádek písanky. */
export function resolveGuideDotsDevForRow(text: string, state: PisankaGuideDotsDevState): PisankaGuideDotsDevGlobal {
  const base = { ...GUIDE_DOTS_DEV_DEFAULT_GLOBAL, ...state.global };
  const ch = firstSignificantChar(text);
  const tw = tweakForChar(state, ch);
  if (!tw) return base;
  return deepMergeGlobal(base, tw);
}

/** Načte stav z localStorage (nebo výchozí) a vrátí resolved pro řádek. */
export function loadResolvedGuideDotsDevForRow(rowText: string): PisankaGuideDotsDevGlobal {
  return resolveGuideDotsDevForRow(rowText, loadGuideDotsDevState());
}
