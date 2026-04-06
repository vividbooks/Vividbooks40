import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/teacher-preferences-repository', () => ({
  fetchTeacherClassPreferences: vi.fn(),
  upsertTeacherClassPreferences: vi.fn(),
}));

vi.mock('../compat/legacy-my-classes-storage', () => ({
  legacyReadLastTab: vi.fn(),
  legacyReadSelectedClassId: vi.fn(),
  legacyWriteLastTab: vi.fn(),
  legacyWriteSelectedClassId: vi.fn(),
}));

import {
  fetchTeacherClassPreferences,
  upsertTeacherClassPreferences,
} from '../repositories/teacher-preferences-repository';
import * as legacy from '../compat/legacy-my-classes-storage';
import { loadPreferences, persistPreferences } from './preferences-service';

describe('loadPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_FF_MOJE_TRIDA_REPO_ONLY', '');
    vi.stubEnv('VITE_FF_MOJE_TRIDA_LEGACY_FALLBACK', 'true');
    vi.mocked(legacy.legacyReadLastTab).mockReturnValue(null);
    vi.mocked(legacy.legacyReadSelectedClassId).mockReturnValue(null);
    vi.mocked(fetchTeacherClassPreferences).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('bez userId použije jen legacy klíče', async () => {
    vi.mocked(legacy.legacyReadLastTab).mockReturnValue('classes');
    vi.mocked(legacy.legacyReadSelectedClassId).mockReturnValue('class-x');

    const r = await loadPreferences(null);
    expect(r).toEqual({ lastTab: 'classes', selectedClassId: 'class-x' });
    expect(fetchTeacherClassPreferences).not.toHaveBeenCalled();
  });

  it('repoOnly + chybějící remote → výchozí tab a bez třídy', async () => {
    vi.stubEnv('VITE_FF_MOJE_TRIDA_REPO_ONLY', 'true');
    vi.mocked(legacy.legacyReadLastTab).mockReturnValue('classes');
    vi.mocked(fetchTeacherClassPreferences).mockResolvedValue(null);

    const r = await loadPreferences('00000000-0000-4000-8000-000000000001');
    expect(r).toEqual({ lastTab: 'results', selectedClassId: null });
  });

  it('repoOnly + remote řádek → hodnoty z DB', async () => {
    vi.stubEnv('VITE_FF_MOJE_TRIDA_REPO_ONLY', 'true');
    vi.mocked(fetchTeacherClassPreferences).mockResolvedValue({
      user_id: 'u',
      last_tab: 'individual',
      selected_class_id: '550e8400-e29b-41d4-a716-446655440000',
      quiz_setup_dismissed_sessions: null,
      updated_at: '2026-01-01T00:00:00Z',
    });

    const r = await loadPreferences('u');
    expect(r).toEqual({
      lastTab: 'individual',
      selectedClassId: '550e8400-e29b-41d4-a716-446655440000',
    });
  });

  it('bez repoOnly + remote null + legacyFallback → legacy', async () => {
    vi.stubEnv('VITE_FF_MOJE_TRIDA_REPO_ONLY', 'false');
    vi.stubEnv('VITE_FF_MOJE_TRIDA_LEGACY_FALLBACK', 'true');
    vi.mocked(fetchTeacherClassPreferences).mockResolvedValue(null);
    vi.mocked(legacy.legacyReadLastTab).mockReturnValue('individual');
    vi.mocked(legacy.legacyReadSelectedClassId).mockReturnValue('c2');

    const r = await loadPreferences('user-1');
    expect(r).toEqual({ lastTab: 'individual', selectedClassId: 'c2' });
  });
});

describe('persistPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_FF_MOJE_TRIDA_REPO_ONLY', '');
    vi.stubEnv('VITE_FF_MOJE_TRIDA_LEGACY_FALLBACK', 'true');
    vi.stubEnv('VITE_FF_MOJE_TRIDA_DUAL_WRITE', 'true');
    vi.mocked(fetchTeacherClassPreferences).mockResolvedValue({
      user_id: 'uid',
      last_tab: 'results',
      selected_class_id: null,
      quiz_setup_dismissed_sessions: { sess_a: true },
      updated_at: '2026-01-01T00:00:00Z',
    });
    vi.mocked(upsertTeacherClassPreferences).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('bez userId: dual-write do legacy, žádný upsert', async () => {
    await persistPreferences(null, { lastTab: 'classes', selectedClassId: 'class-x' });

    expect(legacy.legacyWriteLastTab).toHaveBeenCalledWith('classes');
    expect(legacy.legacyWriteSelectedClassId).toHaveBeenCalledWith('class-x');
    expect(fetchTeacherClassPreferences).not.toHaveBeenCalled();
    expect(upsertTeacherClassPreferences).not.toHaveBeenCalled();
  });

  it('bez userId a dualWrite vypnutý → nic neukládá', async () => {
    vi.stubEnv('VITE_FF_MOJE_TRIDA_DUAL_WRITE', 'false');

    await persistPreferences(null, { lastTab: 'classes', selectedClassId: 'x' });

    expect(legacy.legacyWriteLastTab).not.toHaveBeenCalled();
    expect(upsertTeacherClassPreferences).not.toHaveBeenCalled();
  });

  it('s userId předá quiz_setup_dismissed_sessions do upsert', async () => {
    await persistPreferences('uid', { lastTab: 'individual', selectedClassId: null });

    expect(fetchTeacherClassPreferences).toHaveBeenCalledWith('uid');
    expect(upsertTeacherClassPreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'uid',
        last_tab: 'individual',
        quiz_setup_dismissed_sessions: { sess_a: true },
      }),
    );
  });

  it('dualWrite vypnutý a upsert selže → zápis do legacy (fallback)', async () => {
    vi.stubEnv('VITE_FF_MOJE_TRIDA_DUAL_WRITE', 'false');
    vi.mocked(upsertTeacherClassPreferences).mockResolvedValue(false);

    await persistPreferences('uid', { lastTab: 'results', selectedClassId: 'c1' });

    expect(legacy.legacyWriteLastTab).toHaveBeenCalledWith('results');
    expect(legacy.legacyWriteSelectedClassId).toHaveBeenCalledWith('c1');
  });

  it('dualWrite vypnutý a upsert OK → legacy se nevolá', async () => {
    vi.stubEnv('VITE_FF_MOJE_TRIDA_DUAL_WRITE', 'false');
    vi.mocked(upsertTeacherClassPreferences).mockResolvedValue(true);

    await persistPreferences('uid', { lastTab: 'classes', selectedClassId: null });

    expect(legacy.legacyWriteLastTab).not.toHaveBeenCalled();
    expect(legacy.legacyWriteSelectedClassId).not.toHaveBeenCalled();
  });
});
