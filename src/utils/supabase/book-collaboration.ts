/**
 * Komentáře u knihy (teacher_books) + tým / @jména / role.
 * Přístup: vlastník nebo teacher_book_shares (RLS).
 */

import { supabase } from './client';

export type BookCommentThreadStatus = 'open' | 'resolved';
export type BookCommentTargetType = 'book' | 'worksheet' | 'block';
export type BookShareAccessRole = 'editor' | 'commenter';

export interface BookCommentThreadRow {
  id: string;
  book_id: string;
  target_type: BookCommentTargetType;
  worksheet_id: string | null;
  block_id: string | null;
  anchor: Record<string, unknown> | null;
  status: BookCommentThreadStatus;
  assigned_to_user_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface BookCommentMessageRow {
  id: string;
  thread_id: string;
  author_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
}

export interface BookShareRow {
  id: string;
  book_id: string;
  shared_with_user_id: string;
  access_role: BookShareAccessRole;
  mention_slug: string | null;
  created_at: string;
}

export interface BookTeamFetch {
  ownerUserId: string | null;
  ownerMentionSlug: string | null;
  shares: BookShareRow[];
  /** true = v DB chybí novější sloupce (migrace ještě nejsou); základní data se načetla. */
  schemaPartial?: boolean;
}

/** Zobrazení jména podle auth user_id (teachers.user_id + relace pro „já“). */
export interface TeacherUserDisplay {
  displayName: string;
  email: string | null;
}

/**
 * Načte jméno/e-mail z `teachers` pro dané auth UUID.
 * U přihlášeného uživatele doplní metadata z relace, pokud v teachers chybí řádek.
 */
export async function fetchTeacherDisplaysByUserIds(
  userIds: string[],
): Promise<Map<string, TeacherUserDisplay>> {
  const map = new Map<string, TeacherUserDisplay>();
  const unique = [...new Set(userIds.filter((x) => typeof x === 'string' && x.trim() !== ''))];
  if (unique.length === 0) return map;

  const { data: rows, error } = await supabase
    .from('teachers')
    .select('user_id, name, email')
    .in('user_id', unique);

  if (!error && rows) {
    for (const row of rows) {
      const uid = row.user_id as string | null | undefined;
      if (!uid) continue;
      const name = String(row.name ?? '').trim();
      const email = row.email != null ? String(row.email).trim() : null;
      const displayName = name || (email ? email.split('@')[0]! : '') || 'Učitel';
      map.set(uid, { displayName, email });
    }
  }

  const { data: auth } = await supabase.auth.getUser();
  const u = auth.user;
  if (u?.id && unique.includes(u.id)) {
    const meta = u.user_metadata as { name?: string; full_name?: string } | undefined;
    const fromMeta = (meta?.name || meta?.full_name || '').trim();
    const email = u.email ?? null;
    const localPart = email?.split('@')[0]?.trim() ?? '';
    const fallbackName = fromMeta || localPart || 'Já';
    const prev = map.get(u.id);
    if (!prev) {
      map.set(u.id, { displayName: fallbackName, email });
    } else {
      const weak = !prev.displayName || prev.displayName === 'Učitel';
      map.set(u.id, {
        displayName: weak && fallbackName ? fallbackName : prev.displayName,
        email: prev.email ?? email,
      });
    }
  }

  return map;
}

/** Iniciály z celého jména — ne z UUID (první dva znaky UUID bývají číslice). */
export function initialsFromDisplayName(displayName: string, fallbackUserId?: string): string {
  const s = displayName.trim();
  if (s.length >= 2) {
    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0]![0];
      const b = parts[parts.length - 1]![0];
      if (a && b) return (a + b).toUpperCase();
    }
    return s.slice(0, 2).toUpperCase();
  }
  if (fallbackUserId) {
    const hex = fallbackUserId.replace(/-/g, '');
    if (hex.length >= 2) return hex.slice(-2).toUpperCase();
  }
  return '—';
}

function isMissingColumnError(err: { message?: string; code?: string } | null): boolean {
  const m = (err?.message ?? '').toLowerCase();
  const c = err?.code ?? '';
  if (c === '42703') return true;
  if (m.includes('does not exist')) return true;
  if (m.includes('could not find') && m.includes('column')) return true;
  if (m.includes('column') && (m.includes('unknown') || m.includes('not found'))) return true;
  return false;
}

/** Malá písmena, čísla, podtržítko, 2–32 znaků; prázdný řetězec → null */
export function normalizeMentionSlug(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (s.length < 2 || s.length > 32) return null;
  return s;
}

export async function fetchBookCommentThreads(bookId: string): Promise<BookCommentThreadRow[]> {
  const { data, error } = await supabase
    .from('teacher_book_comment_threads')
    .select('*')
    .eq('book_id', bookId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    assigned_to_user_id: (row.assigned_to_user_id as string | null) ?? null,
  })) as BookCommentThreadRow[];
}

export async function fetchBookCommentMessages(threadIds: string[]): Promise<BookCommentMessageRow[]> {
  if (threadIds.length === 0) return [];
  const { data, error } = await supabase
    .from('teacher_book_comment_messages')
    .select('*')
    .in('thread_id', threadIds)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as BookCommentMessageRow[];
}

export async function createBookCommentThread(params: {
  bookId: string;
  userId: string;
  body: string;
  targetType?: BookCommentTargetType;
  worksheetId?: string | null;
  blockId?: string | null;
  anchor?: Record<string, unknown> | null;
  assignedToUserId?: string | null;
}): Promise<{ thread: BookCommentThreadRow; message: BookCommentMessageRow }> {
  const baseInsert: Record<string, unknown> = {
    book_id: params.bookId,
    target_type: params.targetType ?? 'book',
    worksheet_id: params.worksheetId ?? null,
    block_id: params.blockId ?? null,
    anchor: params.anchor ?? null,
    status: 'open',
    created_by: params.userId,
  };
  if (params.assignedToUserId) {
    baseInsert.assigned_to_user_id = params.assignedToUserId;
  }

  let threadRes = await supabase.from('teacher_book_comment_threads').insert(baseInsert).select().single();
  if (threadRes.error && isMissingColumnError(threadRes.error) && 'assigned_to_user_id' in baseInsert) {
    delete baseInsert.assigned_to_user_id;
    threadRes = await supabase.from('teacher_book_comment_threads').insert(baseInsert).select().single();
  }
  const { data: thread, error: tErr } = threadRes;
  if (tErr) throw tErr;

  const { data: message, error: mErr } = await supabase
    .from('teacher_book_comment_messages')
    .insert({
      thread_id: thread.id,
      author_id: params.userId,
      body: params.body.trim(),
    })
    .select()
    .single();
  if (mErr) throw mErr;

  return { thread: thread as BookCommentThreadRow, message: message as BookCommentMessageRow };
}

export async function addBookCommentMessage(threadId: string, userId: string, body: string): Promise<BookCommentMessageRow> {
  const { data, error } = await supabase
    .from('teacher_book_comment_messages')
    .insert({ thread_id: threadId, author_id: userId, body: body.trim() })
    .select()
    .single();
  if (error) throw error;
  return data as BookCommentMessageRow;
}

export async function resolveBookCommentThread(
  threadId: string,
  userId: string,
  resolved: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('teacher_book_comment_threads')
    .update({
      status: resolved ? 'resolved' : 'open',
      resolved_at: resolved ? new Date().toISOString() : null,
      resolved_by: resolved ? userId : null,
    })
    .eq('id', threadId);
  if (error) throw error;
}

export async function updateBookCommentThreadAssignee(
  threadId: string,
  assignedToUserId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('teacher_book_comment_threads')
    .update({ assigned_to_user_id: assignedToUserId })
    .eq('id', threadId);
  if (error && isMissingColumnError(error)) {
    throw new Error('Sloupec assigned_to_user_id v databázi chybí — spusť migraci 20260325220000.');
  }
  if (error) throw error;
}

export async function fetchBookTeam(bookId: string): Promise<BookTeamFetch> {
  let schemaPartial = false;

  let book = await supabase
    .from('teacher_books')
    .select('teacher_id, owner_mention_slug')
    .eq('id', bookId)
    .maybeSingle();

  if (book.error && isMissingColumnError(book.error)) {
    schemaPartial = true;
    book = await supabase.from('teacher_books').select('teacher_id').eq('id', bookId).maybeSingle();
  }
  if (book.error) throw book.error;

  const ownerUserId = (book.data?.teacher_id as string | undefined) ?? null;
  const rawSlug = (book.data as Record<string, unknown> | null)?.owner_mention_slug;
  const ownerMentionSlug = typeof rawSlug === 'string' ? rawSlug : null;

  const shareSelectAttempts = [
    'id, book_id, shared_with_user_id, created_at, access_role, mention_slug',
    'id, book_id, shared_with_user_id, created_at, access_role',
    'id, book_id, shared_with_user_id, created_at',
  ] as const;

  let s = await supabase
    .from('teacher_book_shares')
    .select(shareSelectAttempts[0])
    .eq('book_id', bookId)
    .order('created_at', { ascending: true });

  for (let i = 1; i < shareSelectAttempts.length && s.error && isMissingColumnError(s.error); i++) {
    schemaPartial = true;
    const sel = shareSelectAttempts[i];
    const next = await supabase
      .from('teacher_book_shares')
      .select(sel)
      .eq('book_id', bookId)
      .order('created_at', { ascending: true });
    s = next as typeof s;
  }
  if (s.error) throw s.error;

  const shareRows = (s.data ?? []) as Record<string, unknown>[];
  const shares: BookShareRow[] = shareRows.map((r) => {
    const ar = r.access_role as string | undefined;
    const access_role: BookShareAccessRole =
      ar === 'commenter' || ar === 'editor' ? ar : 'editor';
    return {
      id: r.id as string,
      book_id: r.book_id as string,
      shared_with_user_id: r.shared_with_user_id as string,
      access_role,
      mention_slug: (r.mention_slug as string | null) ?? null,
      created_at: r.created_at as string,
    };
  });

  return {
    ownerUserId,
    ownerMentionSlug,
    shares,
    schemaPartial,
  };
}

export async function updateBookShareAccessRole(
  shareId: string,
  accessRole: BookShareAccessRole,
): Promise<void> {
  const { error } = await supabase
    .from('teacher_book_shares')
    .update({ access_role: accessRole })
    .eq('id', shareId);
  if (error && isMissingColumnError(error)) {
    throw new Error('Sloupec access_role u sdílení chybí — spusť migraci 20260325210000_teacher_book_shares_access_role.sql.');
  }
  if (error) throw error;
}

export async function updateBookOwnerMentionSlug(bookId: string, slug: string | null): Promise<void> {
  const { error } = await supabase
    .from('teacher_books')
    .update({ owner_mention_slug: slug })
    .eq('id', bookId);
  if (error && isMissingColumnError(error)) {
    throw new Error('Sloupec owner_mention_slug v databázi chybí — spusť migraci 20260325220000.');
  }
  if (error) throw error;
}

export async function updateBookShareMentionSlug(shareId: string, slug: string | null): Promise<void> {
  const { error } = await supabase
    .from('teacher_book_shares')
    .update({ mention_slug: slug })
    .eq('id', shareId);
  if (error && isMissingColumnError(error)) {
    throw new Error('Sloupec mention_slug v databázi chybí — spusť migraci 20260325220000.');
  }
  if (error) throw error;
}

/** Najde první @slug v textu, který odpovídá členu týmu (včetně vlastníka). */
export function findAssigneeFromMentionBody(
  body: string,
  team: { userId: string; slug: string | null }[],
): string | null {
  const re = /@([a-z0-9_]{2,32})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const slug = m[1].toLowerCase();
    const hit = team.find((t) => t.slug && t.slug.toLowerCase() === slug);
    if (hit) return hit.userId;
  }
  return null;
}
