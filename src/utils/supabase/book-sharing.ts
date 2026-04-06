import { supabase } from './client';
import { laioutBookEditorPath } from '../laiout-routes';

function randomInviteTokenHex(): string {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Plná URL otevře knihu a po přihlášení přidá sdílení přes `?invite=`. */
export function buildTeacherBookInviteUrl(bookId: string, token: string): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '');
  const rel = laioutBookEditorPath(bookId);
  const path = `${base}${rel}`;
  const u = new URL(path, window.location.origin);
  u.searchParams.set('invite', token);
  return u.toString();
}

export async function inviteTeacherToBookByEmail(
  bookId: string,
  email: string,
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const trimmed = email.trim();
  if (!trimmed) {
    return { ok: false, code: 'not_found', message: 'Zadej e-mail.' };
  }

  const { data: targetUserId, error: rpcErr } = await supabase.rpc('lookup_user_id_for_book_share', {
    target_email: trimmed,
  });

  if (rpcErr) {
    console.error('[book-sharing] lookup_user_id_for_book_share', rpcErr);
    return { ok: false, code: 'rpc', message: 'Nepodařilo se vyhledat uživatele.' };
  }

  if (!targetUserId) {
    return {
      ok: false,
      code: 'not_found',
      message: 'Uživatele s tímto e-mailem jsme nenašli (musí mít účet ve Vividbooks).',
    };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id === targetUserId) {
    return { ok: false, code: 'self', message: 'Nemůžeš sdílet knihu sama sobě.' };
  }

  const { error: insErr } = await supabase.from('teacher_book_shares').insert({
    book_id: bookId,
    shared_with_user_id: targetUserId,
  });

  if (insErr) {
    if (insErr.code === '23505') {
      return { ok: false, code: 'duplicate', message: 'S tímto uživatelem je kniha už sdílená.' };
    }
    console.error('[book-sharing] teacher_book_shares insert', insErr);
    return { ok: false, code: 'insert', message: insErr.message || 'Sdílení se nepodařilo.' };
  }

  return { ok: true };
}

export async function createTeacherBookInviteLink(
  bookId: string,
  options?: { expiresInDays?: number },
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: 'Nejsi přihlášená.' };
  }

  const days = Math.min(90, Math.max(1, options?.expiresInDays ?? 7));
  const expires = new Date();
  expires.setDate(expires.getDate() + days);
  const token = randomInviteTokenHex();

  const { error } = await supabase.from('teacher_book_invite_tokens').insert({
    book_id: bookId,
    token,
    created_by: user.id,
    expires_at: expires.toISOString(),
  });

  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('teacher_book_invite_tokens')) {
      return {
        ok: false,
        message:
          'Odkazy na pozvání nejsou v databázi — nasaď migraci 20260325230000_teacher_book_invite_tokens.sql.',
      };
    }
    console.error('[book-sharing] invite token insert', error);
    return { ok: false, message: error.message || 'Odkaz se nepodařilo vytvořit.' };
  }

  return { ok: true, url: buildTeacherBookInviteUrl(bookId, token) };
}

export type AcceptTeacherBookInviteResult =
  | { ok: true; bookId?: string; note?: string }
  | { ok: false; error: string; message: string };

export async function acceptTeacherBookInvite(token: string): Promise<AcceptTeacherBookInviteResult> {
  const { data, error } = await supabase.rpc('accept_teacher_book_invite', { p_token: token });

  if (error) {
    console.error('[book-sharing] accept_teacher_book_invite', error);
    return {
      ok: false,
      error: 'rpc',
      message: error.message || 'Pozvání se nepodařilo zpracovat.',
    };
  }

  const row = data as { ok?: boolean; error?: string; book_id?: string; note?: string } | null;
  if (!row || typeof row !== 'object') {
    return { ok: false, error: 'unknown', message: 'Neočekávaná odpověď serveru.' };
  }

  if (row.ok === true) {
    return { ok: true, bookId: row.book_id, note: row.note };
  }

  const err = row.error ?? 'unknown';
  const messages: Record<string, string> = {
    not_authenticated: 'Nejsi přihlášená.',
    invalid_token: 'Odkaz je neplatný.',
    not_found: 'Odkaz už neplatí nebo byl smazán.',
    expired: 'Platnost odkazu vypršela.',
    exhausted: 'Odkaz byl už příliš mnohokrát použit — vygeneruj nový.',
  };

  return {
    ok: false,
    error: err,
    message: messages[err] ?? 'Odkaz se nepodařilo použít.',
  };
}
