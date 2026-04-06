import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/class-repository', () => ({
  classRepository: { list: vi.fn() },
}));

vi.mock('../compat/legacy-my-classes-storage', () => ({
  legacyReadClassesCache: vi.fn(),
  legacyWriteClassesCache: vi.fn(),
}));

import { classRepository } from '../repositories/class-repository';
import * as legacy from '../compat/legacy-my-classes-storage';
import type { ClassSummary } from '../domain/types';
import { loadClassesOverview, refreshClassesCache } from './classes-overview-service';

const sampleClass: ClassSummary = {
  id: 'c1',
  name: '6.A',
  studentsCount: 5,
  createdAt: '2026-01-01T00:00:00Z',
};

describe('loadClassesOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_FF_MOJE_TRIDA_REPO_ONLY', '');
    vi.stubEnv('VITE_FF_MOJE_TRIDA_DUAL_WRITE', 'true');
    vi.mocked(legacy.legacyReadClassesCache).mockReturnValue(null);
    vi.mocked(classRepository.list).mockResolvedValue([sampleClass]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('useSupabaseData false → prázdný výsledek', async () => {
    const r = await loadClassesOverview({ useSupabaseData: false });
    expect(r).toEqual({ classes: [], fromCache: false });
    expect(classRepository.list).not.toHaveBeenCalled();
  });

  it('legacy cache hit (ne repoOnly) → data z cache, bez API', async () => {
    vi.mocked(legacy.legacyReadClassesCache).mockReturnValue({
      classes: [sampleClass],
      ageMs: 1000,
    });

    const r = await loadClassesOverview({ useSupabaseData: true });
    expect(r).toEqual({ classes: [sampleClass], fromCache: true });
    expect(classRepository.list).not.toHaveBeenCalled();
  });

  it('repoOnly → legacy cache se nepoužije', async () => {
    vi.stubEnv('VITE_FF_MOJE_TRIDA_REPO_ONLY', 'true');
    vi.mocked(legacy.legacyReadClassesCache).mockReturnValue({
      classes: [sampleClass],
      ageMs: 100,
    });

    const r = await loadClassesOverview({ useSupabaseData: true });
    expect(r.fromCache).toBe(false);
    expect(r.classes).toEqual([sampleClass]);
    expect(classRepository.list).toHaveBeenCalled();
  });

  it('forceNetwork → vždy API', async () => {
    vi.mocked(legacy.legacyReadClassesCache).mockReturnValue({
      classes: [sampleClass],
      ageMs: 100,
    });

    const r = await loadClassesOverview({ useSupabaseData: true, forceNetwork: true });
    expect(r.fromCache).toBe(false);
    expect(classRepository.list).toHaveBeenCalled();
  });

  it('po načtení z API zapíše cache při dualWrite / ne-repoOnly', async () => {
    await loadClassesOverview({ useSupabaseData: true });
    expect(legacy.legacyWriteClassesCache).toHaveBeenCalledWith([sampleClass]);
  });

  it('repoOnly + dualWrite vypnutý → nezapisuje legacy cache', async () => {
    vi.stubEnv('VITE_FF_MOJE_TRIDA_REPO_ONLY', 'true');
    vi.stubEnv('VITE_FF_MOJE_TRIDA_DUAL_WRITE', 'false');

    await loadClassesOverview({ useSupabaseData: true });

    expect(legacy.legacyWriteClassesCache).not.toHaveBeenCalled();
  });
});

describe('refreshClassesCache', () => {
  it('předá třídy do legacyWriteClassesCache', () => {
    refreshClassesCache([sampleClass]);
    expect(legacy.legacyWriteClassesCache).toHaveBeenCalledWith([sampleClass]);
  });
});
