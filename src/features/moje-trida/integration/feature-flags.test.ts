import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMojeTridaFlags } from './feature-flags';

describe('getMojeTridaFlags', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('výchozí hodnoty když proměnné chybí nebo jsou prázdné', () => {
    vi.stubEnv('VITE_FF_CLASSROOM_SHARE_SUPABASE', '');
    vi.stubEnv('VITE_FF_MOJE_TRIDA_REPO_ONLY', '');
    vi.stubEnv('VITE_FF_MOJE_TRIDA_DUAL_WRITE', '');
    vi.stubEnv('VITE_FF_MOJE_TRIDA_LEGACY_FALLBACK', '');

    const f = getMojeTridaFlags();
    expect(f.classroomShareSupabase).toBe(false);
    expect(f.repoOnly).toBe(false);
    expect(f.dualWrite).toBe(true);
    expect(f.legacyFallback).toBe(true);
  });

  it('akceptuje 1, true, yes', () => {
    vi.stubEnv('VITE_FF_CLASSROOM_SHARE_SUPABASE', 'yes');
    vi.stubEnv('VITE_FF_MOJE_TRIDA_REPO_ONLY', '1');
    vi.stubEnv('VITE_FF_MOJE_TRIDA_DUAL_WRITE', 'true');
    vi.stubEnv('VITE_FF_MOJE_TRIDA_LEGACY_FALLBACK', 'true');

    const f = getMojeTridaFlags();
    expect(f.classroomShareSupabase).toBe(true);
    expect(f.repoOnly).toBe(true);
    expect(f.dualWrite).toBe(true);
    expect(f.legacyFallback).toBe(true);
  });

  it('jakákoliv jiná hodnota než true/1/yes = false (kromě dualWrite s výchozí true)', () => {
    vi.stubEnv('VITE_FF_CLASSROOM_SHARE_SUPABASE', 'false');
    vi.stubEnv('VITE_FF_MOJE_TRIDA_REPO_ONLY', '0');
    vi.stubEnv('VITE_FF_MOJE_TRIDA_DUAL_WRITE', 'false');
    vi.stubEnv('VITE_FF_MOJE_TRIDA_LEGACY_FALLBACK', 'nope');

    const f = getMojeTridaFlags();
    expect(f.classroomShareSupabase).toBe(false);
    expect(f.repoOnly).toBe(false);
    expect(f.dualWrite).toBe(false);
    expect(f.legacyFallback).toBe(false);
  });
});
