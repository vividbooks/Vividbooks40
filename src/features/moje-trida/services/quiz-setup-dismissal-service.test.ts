import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetUser = vi.fn();

vi.mock('../../../utils/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
    },
  },
}));

vi.mock('../../../utils/supabase/classes', () => ({
  isUsingSupabase: vi.fn(() => true),
}));

vi.mock('../repositories/teacher-preferences-repository', () => ({
  fetchTeacherClassPreferences: vi.fn(),
  upsertTeacherClassPreferences: vi.fn(),
}));

vi.mock('../integration/feature-flags', () => ({
  getMojeTridaFlags: vi.fn(),
}));

import { fetchTeacherClassPreferences, upsertTeacherClassPreferences } from '../repositories/teacher-preferences-repository';
import { getMojeTridaFlags } from '../integration/feature-flags';
import { isUsingSupabase } from '../../../utils/supabase/classes';
import { isQuizSetupDismissed, persistQuizSetupDismissal } from './quiz-setup-dismissal-service';

function mockLocalStorage(): Storage {
  const m: Record<string, string> = {};
  return {
    getItem: (k: string) => m[k] ?? null,
    setItem: (k: string, v: string) => {
      m[k] = v;
    },
    removeItem: (k: string) => {
      delete m[k];
    },
    clear: () => {
      Object.keys(m).forEach((k) => delete m[k]);
    },
    get length() {
      return Object.keys(m).length;
    },
    key: (i: number) => Object.keys(m)[i] ?? null,
  } as Storage;
}

const defaultFlags = {
  repoOnly: false,
  legacyFallback: true,
  dualWrite: true,
  classroomShareSupabase: false,
};

describe('isQuizSetupDismissed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.localStorage = mockLocalStorage();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    vi.mocked(getMojeTridaFlags).mockReturnValue({ ...defaultFlags });
    vi.mocked(fetchTeacherClassPreferences).mockResolvedValue(null);
    vi.mocked(isUsingSupabase).mockReturnValue(true);
  });

  it('true z localStorage (legacy fallback)', async () => {
    localStorage.setItem('quiz_setup_dismissed_abc', 'true');
    await expect(isQuizSetupDismissed('abc')).resolves.toBe(true);
    expect(fetchTeacherClassPreferences).not.toHaveBeenCalled();
  });

  it('true z DB když v prefs mapě', async () => {
    vi.mocked(fetchTeacherClassPreferences).mockResolvedValue({
      user_id: 'user-1',
      last_tab: null,
      selected_class_id: null,
      quiz_setup_dismissed_sessions: { sessX: true },
      updated_at: 'x',
    });
    await expect(isQuizSetupDismissed('sessX')).resolves.toBe(true);
  });

  it('repoOnly nečte localStorage', async () => {
    vi.mocked(getMojeTridaFlags).mockReturnValue({
      ...defaultFlags,
      repoOnly: true,
    });
    localStorage.setItem('quiz_setup_dismissed_abc', 'true');
    vi.mocked(fetchTeacherClassPreferences).mockResolvedValue({
      user_id: 'user-1',
      last_tab: null,
      selected_class_id: null,
      quiz_setup_dismissed_sessions: {},
      updated_at: 'x',
    });

    await expect(isQuizSetupDismissed('abc')).resolves.toBe(false);
  });

  it('bez Supabase a bez local klíče → false', async () => {
    vi.mocked(isUsingSupabase).mockReturnValue(false);
    await expect(isQuizSetupDismissed('missing')).resolves.toBe(false);
    expect(fetchTeacherClassPreferences).not.toHaveBeenCalled();
  });
});

describe('persistQuizSetupDismissal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.localStorage = mockLocalStorage();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    vi.mocked(getMojeTridaFlags).mockReturnValue({ ...defaultFlags });
    vi.mocked(fetchTeacherClassPreferences).mockResolvedValue({
      user_id: 'u1',
      last_tab: 'classes',
      selected_class_id: null,
      quiz_setup_dismissed_sessions: { old: true },
      updated_at: 'x',
    });
    vi.mocked(upsertTeacherClassPreferences).mockResolvedValue(true);
    vi.mocked(isUsingSupabase).mockReturnValue(true);
  });

  it('zapíše localStorage a sloučí dismissed do upsert', async () => {
    await persistQuizSetupDismissal('newSess');

    expect(localStorage.getItem('quiz_setup_dismissed_newSess')).toBe('true');
    expect(upsertTeacherClassPreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1',
        quiz_setup_dismissed_sessions: { old: true, newSess: true },
      }),
    );
  });

  it('repoOnly a dualWrite vypnutý → bez zápisu do localStorage', async () => {
    vi.mocked(getMojeTridaFlags).mockReturnValue({
      ...defaultFlags,
      repoOnly: true,
      dualWrite: false,
    });

    await persistQuizSetupDismissal('sid');

    expect(localStorage.getItem('quiz_setup_dismissed_sid')).toBeNull();
    expect(upsertTeacherClassPreferences).toHaveBeenCalled();
  });

  it('Supabase vypnutý → jen local, žádný upsert', async () => {
    vi.mocked(isUsingSupabase).mockReturnValue(false);

    await persistQuizSetupDismissal('x');

    expect(localStorage.getItem('quiz_setup_dismissed_x')).toBe('true');
    expect(upsertTeacherClassPreferences).not.toHaveBeenCalled();
  });
});
