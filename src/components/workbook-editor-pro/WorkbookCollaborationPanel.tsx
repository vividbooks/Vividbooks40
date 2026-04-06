/**
 * Komentáře u knihy + tým (@jméno, role). Bez kanban úkolů.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  MessageSquare,
  Plus,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Circle,
  PlayCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../utils/supabase/client';
import {
  type BookCommentMessageRow,
  type BookCommentThreadRow,
  type BookShareAccessRole,
  type BookShareRow,
  fetchBookCommentMessages,
  fetchBookCommentThreads,
  fetchBookTeam,
  createBookCommentThread,
  addBookCommentMessage,
  resolveBookCommentThread,
  updateBookCommentThreadAssignee,
  updateBookShareAccessRole,
  updateBookOwnerMentionSlug,
  updateBookShareMentionSlug,
  normalizeMentionSlug,
  findAssigneeFromMentionBody,
} from '../../utils/supabase/book-collaboration';
import { BookShareControls } from './BookShareControls';

const ROLE_LABEL: Record<'owner' | BookShareAccessRole, string> = {
  owner: 'Vlastník',
  editor: 'Editor',
  commenter: 'Komentátor',
};

const D = {
  bg: '#0d1117',
  surface: '#161b22',
  border: '#30363d',
  text: '#e6edf3',
  muted: '#8b949e',
  accent: '#5C5CFF',
} as const;

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('cs-CZ', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function renderCommentBody(text: string): ReactNode {
  const parts = text.split(/(@[a-z0-9_]+)/gi);
  return parts.map((part, i) => {
    if (/^@[a-z0-9_]+$/i.test(part)) {
      return (
        <span key={i} style={{ color: '#38bdf8', fontWeight: 600 }}>
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function WorkbookCollaborationPanel({ bookId }: { bookId: string }) {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [ownerMentionSlug, setOwnerMentionSlug] = useState<string | null>(null);
  const [ownerSlugDraft, setOwnerSlugDraft] = useState('');
  const [teamShares, setTeamShares] = useState<BookShareRow[]>([]);
  const [shareSlugDrafts, setShareSlugDrafts] = useState<Record<string, string>>({});

  const [threads, setThreads] = useState<BookCommentThreadRow[]>([]);
  const [messagesByThread, setMessagesByThread] = useState<Record<string, BookCommentMessageRow[]>>({});
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null);

  const [newThreadBody, setNewThreadBody] = useState('');
  const [newThreadAssignee, setNewThreadAssignee] = useState<string>('');
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [threadAssigneeDraft, setThreadAssigneeDraft] = useState<Record<string, string>>({});

  const isBookOwner = Boolean(userId && ownerUserId && userId === ownerUserId);

  const teamForMentions = useMemo(
    () =>
      [
        ...(ownerUserId
          ? [{ userId: ownerUserId, slug: ownerMentionSlug }]
          : []),
        ...teamShares.map((s) => ({ userId: s.shared_with_user_id, slug: s.mention_slug })),
      ],
    [ownerUserId, ownerMentionSlug, teamShares],
  );

  const loadAll = useCallback(async () => {
    if (!bookId) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      const [tThreads, team] = await Promise.all([
        fetchBookCommentThreads(bookId),
        fetchBookTeam(bookId),
      ]);
      setThreads(tThreads);
      setOwnerUserId(team.ownerUserId);
      setOwnerMentionSlug(team.ownerMentionSlug);
      setOwnerSlugDraft(team.ownerMentionSlug ?? '');
      setTeamShares(team.shares);
      const drafts: Record<string, string> = {};
      for (const s of team.shares) drafts[s.id] = s.mention_slug ?? '';
      setShareSlugDrafts(drafts);

      const msgs = await fetchBookCommentMessages(tThreads.map((x) => x.id));
      const map: Record<string, BookCommentMessageRow[]> = {};
      for (const m of msgs) {
        if (!map[m.thread_id]) map[m.thread_id] = [];
        map[m.thread_id].push(m);
      }
      setMessagesByThread(map);

      const assignDraft: Record<string, string> = {};
      for (const t of tThreads) assignDraft[t.id] = t.assigned_to_user_id ?? '';
      setThreadAssigneeDraft(assignDraft);

      if (team.schemaPartial) {
        toast.warning(
          'V databázi chybí část sloupců (@jména, přiřazení). Komentáře fungují; po nasazení migrace 20260325220000 (a role 20260325210000) doplníme zbytek.',
          { duration: 9000 },
        );
      }
    } catch (e) {
      console.error('[WorkbookCollaboration]', e);
      toast.error(
        'Nepodařilo se načíst komentáře. Ověř přihlášení a přístup ke knize; podrobnosti v konzoli (F12).',
      );
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const assigneeLabel = useCallback(
    (uid: string | null): string => {
      if (!uid) return '';
      if (ownerUserId && uid === ownerUserId && ownerMentionSlug) return `@${ownerMentionSlug}`;
      const sh = teamShares.find((s) => s.shared_with_user_id === uid);
      if (sh?.mention_slug) return `@${sh.mention_slug}`;
      return uid.slice(0, 8) + '…';
    },
    [ownerUserId, ownerMentionSlug, teamShares],
  );

  const handleSaveOwnerSlug = async () => {
    if (!bookId || !isBookOwner) return;
    const norm = ownerSlugDraft.trim() === '' ? null : normalizeMentionSlug(ownerSlugDraft);
    if (ownerSlugDraft.trim() !== '' && !norm) {
      toast.error('@jméno: jen malá písmena, čísla, podtržítko, 2–32 znaků.');
      return;
    }
    try {
      await updateBookOwnerMentionSlug(bookId, norm);
      setOwnerMentionSlug(norm);
      toast.success('Tvé @jméno uloženo');
    } catch (err) {
      console.error(err);
      toast.error('Uložení se nepodařilo (unikátní @ v rámci pozvaných?).');
    }
  };

  const handleSaveShareSlug = async (share: BookShareRow) => {
    if (!isBookOwner) return;
    const raw = shareSlugDrafts[share.id] ?? '';
    const norm = raw.trim() === '' ? null : normalizeMentionSlug(raw);
    if (raw.trim() !== '' && !norm) {
      toast.error('@jméno: jen malá písmena, čísla, podtržítko, 2–32 znaků.');
      return;
    }
    try {
      await updateBookShareMentionSlug(share.id, norm);
      setTeamShares((prev) => prev.map((s) => (s.id === share.id ? { ...s, mention_slug: norm } : s)));
      toast.success('@jméno uloženo');
    } catch (err) {
      console.error(err);
      toast.error('Uložení se nepodařilo (stejné @ u dvou lidí v jedné knize?).');
    }
  };

  const handleShareRoleChange = async (share: BookShareRow, role: BookShareAccessRole) => {
    if (!isBookOwner) return;
    try {
      await updateBookShareAccessRole(share.id, role);
      setTeamShares((prev) => prev.map((s) => (s.id === share.id ? { ...s, access_role: role } : s)));
      toast.success('Role uložena');
    } catch (err) {
      console.error(err);
      toast.error('Roli se nepodařilo změnit.');
    }
  };

  const handleNewThread = async () => {
    if (!bookId || !userId || !newThreadBody.trim()) return;
    const fromSelect = newThreadAssignee || null;
    const fromText = findAssigneeFromMentionBody(newThreadBody, teamForMentions);
    const assignedToUserId = fromSelect || fromText;
    try {
      const { thread, message } = await createBookCommentThread({
        bookId,
        userId,
        body: newThreadBody,
        targetType: 'book',
        assignedToUserId,
      });
      setThreads((prev) => [thread, ...prev]);
      setMessagesByThread((prev) => ({ ...prev, [thread.id]: [message] }));
      setThreadAssigneeDraft((p) => ({ ...p, [thread.id]: assignedToUserId ?? '' }));
      setNewThreadBody('');
      setNewThreadAssignee('');
      setExpandedThreadId(thread.id);
      toast.success('Komentář uložen');
    } catch (e) {
      console.error(e);
      toast.error('Komentář se nepodařilo uložit');
    }
  };

  const handleReply = async (threadId: string) => {
    const text = (replyDraft[threadId] ?? '').trim();
    if (!userId || !text) return;
    try {
      const msg = await addBookCommentMessage(threadId, userId, text);
      setMessagesByThread((prev) => ({
        ...prev,
        [threadId]: [...(prev[threadId] ?? []), msg],
      }));
      setReplyDraft((p) => ({ ...p, [threadId]: '' }));
    } catch (e) {
      console.error(e);
      toast.error('Odpověď se nepodařila odeslat');
    }
  };

  const handleResolve = async (thread: BookCommentThreadRow, resolved: boolean) => {
    if (!userId) return;
    try {
      await resolveBookCommentThread(thread.id, userId, resolved);
      setThreads((prev) =>
        prev.map((t) =>
          t.id === thread.id
            ? {
                ...t,
                status: resolved ? 'resolved' : 'open',
                resolved_at: resolved ? new Date().toISOString() : null,
                resolved_by: resolved ? userId : null,
              }
            : t,
        ),
      );
    } catch (e) {
      console.error(e);
      toast.error('Stav vlákna se nepodařilo změnit');
    }
  };

  const handleSaveThreadAssignee = async (thread: BookCommentThreadRow) => {
    const v = threadAssigneeDraft[thread.id] ?? '';
    const assigned = v === '' ? null : v;
    try {
      await updateBookCommentThreadAssignee(thread.id, assigned);
      setThreads((prev) =>
        prev.map((t) => (t.id === thread.id ? { ...t, assigned_to_user_id: assigned } : t)),
      );
      toast.success('Přiřazení uloženo');
    } catch (e) {
      console.error(e);
      toast.error('Přiřazení se nepodařilo uložit');
    }
  };

  const onPickNewAssignee = (uid: string) => {
    setNewThreadAssignee(uid);
    if (!uid) return;
    const slug =
      ownerUserId && uid === ownerUserId
        ? ownerMentionSlug
        : teamShares.find((s) => s.shared_with_user_id === uid)?.mention_slug;
    if (!slug) {
      toast.message('Tomuto členovi zatím chybí @jméno — doplní ho vlastník v panelu Tým.');
      return;
    }
    const prefix = `@${slug} `;
    if (!newThreadBody.toLowerCase().includes(`@${slug.toLowerCase()}`)) {
      setNewThreadBody((b) => (b.trim() ? `${prefix}${b}` : `${prefix}udělej prosím…`));
    }
  };

  if (!bookId) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm" style={{ color: D.muted }}>
        Chybí ID knihy.
      </div>
    );
  }

  const inputStyle: CSSProperties = {
    backgroundColor: D.surface,
    color: D.text,
    borderColor: D.border,
    borderWidth: 1,
    borderStyle: 'solid',
  };

  return (
    <div
      className="flex flex-1 flex-col min-h-0 overflow-hidden lg:flex-row"
      style={{ backgroundColor: D.bg, color: D.text, colorScheme: 'dark' }}
    >
      {/* Hlavní: komentáře */}
      <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
        <header
          className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-3"
          style={{ borderBottom: `1px solid ${D.border}` }}
        >
          <div className="flex items-center gap-2">
            <MessageSquare size={18} style={{ color: D.accent }} />
            <div>
              <h1 className="text-base font-semibold" style={{ color: D.text }}>
                Komentáře
              </h1>
              <p className="text-[11px] mt-0.5" style={{ color: D.muted }}>
                Piš <code className="text-sky-400/90">@jméno</code> (po nastavení v týmu) nebo vyber přiřazení.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium disabled:opacity-50"
            style={{ color: D.text, backgroundColor: '#21262d', border: `1px solid ${D.border}` }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Obnovit
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16" style={{ color: D.muted }}>
              <Loader2 size={28} className="animate-spin" />
              <span className="text-sm">Načítám…</span>
            </div>
          ) : (
            <div className="space-y-4 max-w-3xl">
              <div className="space-y-2">
                <label className="text-[11px] font-medium uppercase tracking-wide" style={{ color: D.muted }}>
                  Přiřadit komentář (volitelné)
                </label>
                <select
                  value={newThreadAssignee}
                  onChange={(e) => onPickNewAssignee(e.target.value)}
                  className="w-full max-w-md px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                >
                  <option value="">— bez přiřazení (jen text) —</option>
                  {ownerUserId && (
                    <option value={ownerUserId}>
                      Vlastník
                      {ownerMentionSlug ? ` (@${ownerMentionSlug})` : ' (doplň @jméno v týmu →)'}
                    </option>
                  )}
                  {teamShares.map((s) => (
                    <option key={s.id} value={s.shared_with_user_id}>
                      Pozvaný
                      {s.mention_slug ? ` (@${s.mention_slug})` : ` (${s.shared_with_user_id.slice(0, 8)}…)`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2 items-end">
                <textarea
                  value={newThreadBody}
                  onChange={(e) => setNewThreadBody(e.target.value)}
                  rows={3}
                  placeholder={'Např. @ondrej udělej prosím úpravu na str. 12…'}
                  className="flex-1 min-w-[200px] px-3 py-2 rounded-lg text-sm outline-none resize-y min-h-[88px]"
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => void handleNewThread()}
                  disabled={!userId || !newThreadBody.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-40 self-end"
                  style={{ backgroundColor: D.accent, color: '#fff' }}
                >
                  <Plus size={16} />
                  Odeslat
                </button>
              </div>

              {!userId && (
                <p className="text-xs" style={{ color: '#fbbf24' }}>
                  Pro komentáře se přihlas.
                </p>
              )}

              <div className="space-y-2 pt-2">
                {threads.length === 0 && (
                  <p className="text-sm py-8 text-center" style={{ color: D.muted }}>
                    Zatím žádné komentáře.
                  </p>
                )}
                {threads.map((thread) => {
                  const msgs = messagesByThread[thread.id] ?? [];
                  const open = expandedThreadId === thread.id;
                  return (
                    <div
                      key={thread.id}
                      className="rounded-xl overflow-hidden"
                      style={{
                        border: `1px solid ${thread.status === 'resolved' ? 'rgba(16,185,129,0.35)' : D.border}`,
                        backgroundColor: thread.status === 'resolved' ? 'rgba(6,78,59,0.2)' : D.surface,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedThreadId(open ? null : thread.id)}
                        className="w-full flex items-start gap-2 px-3 py-2.5 text-left"
                        style={{ background: 'transparent' }}
                      >
                        {thread.status === 'resolved' ? (
                          <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <Circle size={18} className="shrink-0 mt-0.5" style={{ color: D.muted }} />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs flex flex-wrap gap-x-2 gap-y-0.5" style={{ color: D.muted }}>
                            <span>{formatShortDate(thread.created_at)}</span>
                            {thread.assigned_to_user_id && (
                              <span style={{ color: '#38bdf8' }}>
                                Pro: {assigneeLabel(thread.assigned_to_user_id)}
                              </span>
                            )}
                          </div>
                          <div className="text-sm mt-0.5 line-clamp-2 text-left">
                            {renderCommentBody(msgs[0]?.body ?? '(prázdné)')}
                          </div>
                        </div>
                      </button>
                      {open && (
                        <div className="px-3 pb-3 pt-2 space-y-2" style={{ borderTop: `1px solid ${D.border}` }}>
                          <div className="flex flex-col sm:flex-row gap-2 sm:items-center pl-6">
                            <span className="text-[11px] shrink-0" style={{ color: D.muted }}>
                              Přiřazeno
                            </span>
                            <select
                              value={threadAssigneeDraft[thread.id] ?? ''}
                              onChange={(e) =>
                                setThreadAssigneeDraft((p) => ({
                                  ...p,
                                  [thread.id]: e.target.value,
                                }))
                              }
                              className="flex-1 px-2 py-1.5 rounded-md text-xs outline-none min-w-0"
                              style={inputStyle}
                            >
                              <option value="">— nikdo —</option>
                              {ownerUserId && <option value={ownerUserId}>Vlastník</option>}
                              {teamShares.map((s) => (
                                <option key={s.id} value={s.shared_with_user_id}>
                                  Pozvaný {s.mention_slug ? `(@${s.mention_slug})` : ''}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => void handleSaveThreadAssignee(thread)}
                              className="text-xs px-2 py-1.5 rounded-md shrink-0"
                              style={{ ...inputStyle, backgroundColor: '#21262d' }}
                            >
                              Uložit přiřazení
                            </button>
                          </div>
                          {msgs.map((m) => (
                            <div key={m.id} className="text-sm pl-6" style={{ borderLeft: `2px solid ${D.border}` }}>
                              <div className="text-[10px]" style={{ color: D.muted }}>
                                {formatShortDate(m.created_at)}
                              </div>
                              <div className="whitespace-pre-wrap" style={{ color: '#cbd5e1' }}>
                                {renderCommentBody(m.body)}
                              </div>
                            </div>
                          ))}
                          <div className="flex gap-2 pl-6">
                            <input
                              type="text"
                              value={replyDraft[thread.id] ?? ''}
                              onChange={(e) =>
                                setReplyDraft((p) => ({ ...p, [thread.id]: e.target.value }))
                              }
                              onKeyDown={(e) => e.key === 'Enter' && void handleReply(thread.id)}
                              placeholder="Odpovědět… (můžeš @jméno)"
                              className="flex-1 px-2 py-1.5 rounded-md text-xs outline-none"
                              style={inputStyle}
                            />
                            <button
                              type="button"
                              onClick={() => void handleReply(thread.id)}
                              className="px-2 py-1.5 rounded-md text-xs"
                              style={{ ...inputStyle, backgroundColor: '#21262d' }}
                            >
                              Odeslat
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2 pl-6 pt-1">
                            {thread.status === 'open' ? (
                              <button
                                type="button"
                                onClick={() => void handleResolve(thread, true)}
                                className="text-xs flex items-center gap-1 text-emerald-400 hover:underline"
                              >
                                <CheckCircle2 size={14} />
                                Vyřízeno
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => void handleResolve(thread, false)}
                                className="text-xs flex items-center gap-1 hover:underline"
                                style={{ color: D.muted }}
                              >
                                <PlayCircle size={14} />
                                Znovu otevřít
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tým: @jména + role */}
      <aside
        className="flex-shrink-0 flex flex-col border-t lg:border-t-0 lg:border-l min-h-0 overflow-hidden w-full lg:w-[300px]"
        style={{ borderColor: D.border, backgroundColor: '#0d1117' }}
      >
        <div className="px-3 py-2.5 text-xs font-bold uppercase tracking-wider" style={{ color: D.muted, borderBottom: `1px solid ${D.border}` }}>
          Tým a @jména
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
          <p style={{ color: D.muted, lineHeight: 1.45 }}>
            <strong style={{ color: D.text }}>@jméno</strong> je jen malá písmena, čísla a podtržítko (2–32).
            Vlastník je nastavuje u sebe i u pozvaných. V komentáři pak napíšeš např.{' '}
            <code style={{ color: '#38bdf8' }}>@ondrej udělej…</code>
          </p>

          <BookShareControls
            bookId={bookId}
            isOwner={isBookOwner}
            variant="collaboration"
            onInvited={() => void loadAll()}
          />

          {ownerUserId && (
            <div className="rounded-lg p-2.5 space-y-2" style={{ border: `1px solid ${D.border}`, backgroundColor: D.surface }}>
              <div className="flex justify-between items-center gap-2">
                <span style={{ color: D.text, fontWeight: 600 }}>Vlastník</span>
                <span style={{ color: '#a5b4fc' }}>{ROLE_LABEL.owner}</span>
              </div>
              <div style={{ color: D.muted, fontFamily: 'monospace', fontSize: 10 }}>{ownerUserId}</div>
              {isBookOwner ? (
                <div className="flex gap-1">
                  <input
                    value={ownerSlugDraft}
                    onChange={(e) => setOwnerSlugDraft(e.target.value)}
                    placeholder="např. ondrej"
                    className="flex-1 min-w-0 px-2 py-1 rounded outline-none"
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => void handleSaveOwnerSlug()}
                    className="px-2 py-1 rounded shrink-0"
                    style={{ backgroundColor: D.accent, color: '#fff' }}
                  >
                    Uložit
                  </button>
                </div>
              ) : (
                <div style={{ color: D.muted }}>
                  @jméno: {ownerMentionSlug ? <strong style={{ color: '#38bdf8' }}>@{ownerMentionSlug}</strong> : '—'}
                </div>
              )}
            </div>
          )}

          {teamShares.length === 0 && (
            <p style={{ color: D.muted }}>Zatím žádní pozvaní — použij pozvánku výše nebo v nastavení sešitu.</p>
          )}

          {teamShares.map((share) => (
            <div
              key={share.id}
              className="rounded-lg p-2.5 space-y-2"
              style={{ border: `1px solid ${D.border}`, backgroundColor: D.surface }}
            >
              <div style={{ color: D.muted, fontFamily: 'monospace', fontSize: 10 }}>
                {share.shared_with_user_id}
              </div>
              {isBookOwner ? (
                <>
                  <div className="flex gap-1">
                    <input
                      value={shareSlugDrafts[share.id] ?? ''}
                      onChange={(e) =>
                        setShareSlugDrafts((p) => ({ ...p, [share.id]: e.target.value }))
                      }
                      placeholder="@jméno"
                      className="flex-1 min-w-0 px-2 py-1 rounded outline-none"
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveShareSlug(share)}
                      className="px-2 py-1 rounded shrink-0"
                      style={{ backgroundColor: D.accent, color: '#fff' }}
                    >
                      Uložit
                    </button>
                  </div>
                  <select
                    value={share.access_role}
                    onChange={(e) =>
                      void handleShareRoleChange(share, e.target.value as BookShareAccessRole)
                    }
                    className="w-full px-2 py-1 rounded outline-none"
                    style={inputStyle}
                  >
                    <option value="editor">Editor</option>
                    <option value="commenter">Komentátor</option>
                  </select>
                </>
              ) : (
                <>
                  <div style={{ color: D.muted }}>
                    @jméno:{' '}
                    {share.mention_slug ? (
                      <strong style={{ color: '#38bdf8' }}>@{share.mention_slug}</strong>
                    ) : (
                      '—'
                    )}
                  </div>
                  <div style={{ color: D.muted }}>Role: {ROLE_LABEL[share.access_role]}</div>
                </>
              )}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
