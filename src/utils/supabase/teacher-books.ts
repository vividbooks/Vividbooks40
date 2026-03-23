import { supabase } from './client';

export type TeacherBookRow = {
  id: string;
  teacher_id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  color: string;
  cover_url: string | null;
  total_pages?: number;
  created_at: string;
  updated_at: string;
};

export type TeacherBookWithMeta = TeacherBookRow & {
  chapter_count: number;
  is_shared: boolean;
};

/**
 * Knihy vlastní + knihy nasdílené aktuálnímu uživateli (RLS musí povolit SELECT).
 */
export async function fetchTeacherBooksForCurrentUser(userId: string): Promise<{
  books: TeacherBookWithMeta[];
  error: Error | null;
}> {
  try {
    const { data: own, error: ownErr } = await supabase
      .from('teacher_books')
      .select('*')
      .eq('teacher_id', userId)
      .order('updated_at', { ascending: false });

    if (ownErr) throw ownErr;

    // Sdílené knihy — při chybě (např. tabulka ještě nemigrovaná) pokračujeme jen s vlastními knihami
    let sharedIds: string[] = [];
    const { data: shareRows, error: shareErr } = await supabase
      .from('teacher_book_shares')
      .select('book_id')
      .eq('shared_with_user_id', userId);

    if (shareErr) {
      console.warn(
        '[teacher-books] teacher_book_shares — přeskakuji sdílené knihy:',
        shareErr.message ?? shareErr,
      );
    } else {
      sharedIds = [...new Set((shareRows ?? []).map(r => r.book_id).filter(Boolean))];
    }
    let shared: TeacherBookRow[] = [];

    if (sharedIds.length > 0) {
      const { data: sharedData, error: sharedFetchErr } = await supabase
        .from('teacher_books')
        .select('*')
        .in('id', sharedIds);

      if (sharedFetchErr) throw sharedFetchErr;
      shared = (sharedData ?? []) as TeacherBookRow[];
    }

    const ownIds = new Set((own ?? []).map(b => b.id));
    const sharedOnly = shared.filter(b => !ownIds.has(b.id));

    const merged: TeacherBookWithMeta[] = [
      ...(own ?? []).map(b => ({
        ...(b as TeacherBookRow),
        chapter_count: 0,
        is_shared: false,
      })),
      ...sharedOnly.map(b => ({
        ...b,
        chapter_count: 0,
        is_shared: true,
      })),
    ];

    merged.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    const allIds = merged.map(b => b.id);
    if (allIds.length > 0) {
      const { data: ws } = await supabase
        .from('teacher_worksheets')
        .select('book_id')
        .in('book_id', allIds);

      const counts: Record<string, number> = {};
      for (const row of ws ?? []) {
        if (row.book_id) counts[row.book_id] = (counts[row.book_id] ?? 0) + 1;
      }
      for (const b of merged) {
        b.chapter_count = counts[b.id] ?? 0;
      }
    }

    return { books: merged, error: null };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    return { books: [], error: err };
  }
}
