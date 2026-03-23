import React, { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, BookOpen, MoreHorizontal, Pencil, Trash2, Clock, Layers, Search, X, Download, Upload, Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../utils/supabase/client';
import {
  buildLaioutBookJsonFileForBook,
  importLaioutBookJsonIntoBook,
  BookJsonImportError,
} from '../../utils/workbook/workbook-json-db';
import { sanitizeFilenamePart } from '../../utils/workbook/workbook-json-io';
import { fetchTeacherBooksForCurrentUser } from '../../utils/supabase/teacher-books';
import { laioutBookEditorPath } from '../../utils/laiout-routes';
import { LaioutBrandLogo } from './LaioutBrandLogo';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeacherBook {
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  color: string;
  cover_url: string | null;
  total_pages?: number;
  created_at: string;
  updated_at: string;
  chapter_count?: number;
  page_count?: number;
  /** Nasdílená kniha (nejsem vlastník) — jen čtení v editoru podle RLS */
  is_shared?: boolean;
}

// ── Palette ───────────────────────────────────────────────────────────────────

const BOOK_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444',
  '#F97316', '#EAB308', '#22C55E', '#14B8A6',
  '#06B6D4', '#6366F1', '#A855F7', '#F43F5E',
];

const C = {
  bg: '#0d1526',
  surface: '#131f35',
  card: '#1a2744',
  cardHover: '#1f3059',
  border: '#1e3a5f',
  text: '#e2e8f0',
  muted: '#64748b',
  accent: '#3B82F6',
};

// ── Book Card ─────────────────────────────────────────────────────────────────

function BookCard({
  book,
  onOpen,
  onRename,
  onDelete,
  onShare,
  onDownloadJson,
  onImportJson,
  jsonBusy,
  canManage,
}: {
  book: TeacherBook;
  onOpen: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onShare: (id: string) => void;
  onDownloadJson: () => void;
  onImportJson: () => void;
  jsonBusy: boolean;
  canManage: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(book.title);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  useEffect(() => {
    if (isRenaming) {
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [isRenaming]);

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== book.title) {
      onRename(book.id, trimmed);
    } else {
      setRenameValue(book.title);
    }
    setIsRenaming(false);
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Právě teď';
    if (m < 60) return `Před ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `Před ${h} h`;
    const d = Math.floor(h / 24);
    if (d === 1) return 'Včera';
    if (d < 7) return `Před ${d} dny`;
    return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
  };

  return (
    <div
      onClick={isRenaming || menuOpen ? undefined : onOpen}
      style={{
        background: C.card,
        borderRadius: '14px',
        overflow: 'hidden',
        border: `1px solid ${C.border}`,
        cursor: isRenaming ? 'default' : 'pointer',
        transition: 'transform 120ms ease, box-shadow 120ms ease, background 120ms ease',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 12px 40px rgba(0,0,0,0.45)`;
        (e.currentTarget as HTMLDivElement).style.background = C.cardHover;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLDivElement).style.background = C.card;
      }}
    >
      {/* Cover */}
      <div style={{
        height: '160px',
        background: book.cover_url
          ? `url(${book.cover_url}) center/cover`
          : `linear-gradient(135deg, ${book.color}dd, ${book.color}88)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        position: 'relative',
      }}>
        {!book.cover_url && (
          <BookOpen size={48} color="rgba(255,255,255,0.35)" strokeWidth={1.5} />
        )}

        {/* Chapter badge */}
        {book.is_shared && (
          <div style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(6px)',
            borderRadius: '20px',
            padding: '3px 10px',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.9)',
            fontWeight: 600,
          }}>
            Sdíleno
          </div>
        )}

        {(book.chapter_count ?? 0) > 0 && (
          <div style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(6px)',
            borderRadius: '20px',
            padding: '3px 10px',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.85)',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            <Layers size={11} />
            {book.chapter_count} {book.chapter_count === 1 ? 'kapitola' : (book.chapter_count! < 5 ? 'kapitoly' : 'kapitol')}
          </div>
        )}

        {/* Menu button */}
        {canManage && (
        <div
          ref={menuRef}
          style={{ position: 'absolute', top: '8px', right: '8px' }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => setMenuOpen(v => !v)}
            style={{
              background: menuOpen ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.35)',
              backdropFilter: 'blur(6px)',
              border: 'none',
              borderRadius: '8px',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#fff',
              transition: 'background 120ms',
            }}
          >
            <MoreHorizontal size={16} />
          </button>

          {menuOpen && (
            <div style={{
              position: 'absolute',
              top: '36px',
              right: 0,
              background: '#1e293b',
              border: `1px solid ${C.border}`,
              borderRadius: '10px',
              overflow: 'hidden',
              minWidth: '150px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              zIndex: 10,
            }}>
              <button
                onClick={() => { setMenuOpen(false); onShare(book.id); }}
                style={{ width: '100%', padding: '9px 14px', background: 'none', border: 'none', color: C.text, textAlign: 'left', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#334155')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <Share2 size={13} /> Sdílet…
              </button>
              <button
                onClick={() => { setMenuOpen(false); setIsRenaming(true); }}
                style={{ width: '100%', padding: '9px 14px', background: 'none', border: 'none', color: C.text, textAlign: 'left', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#334155')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <Pencil size={13} /> Přejmenovat
              </button>
              <button
                onClick={() => { setMenuOpen(false); onDelete(book.id); }}
                style={{ width: '100%', padding: '9px 14px', background: 'none', border: 'none', color: '#f87171', textAlign: 'left', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#3b1e1e')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <Trash2 size={13} /> Smazat knihu
              </button>
              <button
                type="button"
                disabled={jsonBusy}
                onClick={() => { setMenuOpen(false); onDownloadJson(); }}
                style={{ width: '100%', padding: '9px 14px', background: 'none', border: 'none', color: C.text, textAlign: 'left', cursor: jsonBusy ? 'wait' : 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', opacity: jsonBusy ? 0.6 : 1 }}
                onMouseEnter={e => (e.currentTarget.style.background = '#334155')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                {jsonBusy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                Stáhnout JSON
              </button>
              <button
                type="button"
                disabled={jsonBusy}
                onClick={() => { setMenuOpen(false); onImportJson(); }}
                style={{ width: '100%', padding: '9px 14px', background: 'none', border: 'none', color: C.text, textAlign: 'left', cursor: jsonBusy ? 'wait' : 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', opacity: jsonBusy ? 0.6 : 1 }}
                onMouseEnter={e => (e.currentTarget.style.background = '#334155')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <Upload size={13} /> Nahrát JSON
              </button>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {isRenaming ? (
          <input
            ref={inputRef}
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') { setRenameValue(book.title); setIsRenaming(false); }
            }}
            style={{
              background: '#0d1a2d',
              border: `1px solid ${C.accent}`,
              borderRadius: '6px',
              color: C.text,
              fontSize: '14px',
              fontWeight: 600,
              padding: '4px 8px',
              width: '100%',
              outline: 'none',
            }}
          />
        ) : (
          <div style={{
            fontSize: '14px',
            fontWeight: 600,
            color: C.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {book.title}
          </div>
        )}

        {(book.subject || book.grade) && (
          <div style={{ fontSize: '12px', color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {[book.subject, book.grade].filter(Boolean).join(' · ')}
          </div>
        )}

        <div style={{ fontSize: '11px', color: '#475569', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Clock size={11} />
          {timeAgo(book.updated_at)}
        </div>
      </div>
    </div>
  );
}

// ── Page count presets ────────────────────────────────────────────────────────

const PAGE_PRESETS = [
  { label: '48', value: 48 },
  { label: '64', value: 64 },
  { label: '80', value: 80 },
  { label: '96', value: 96 },
  { label: '128', value: 128 },
  { label: '160', value: 160 },
];

// ── New Book Dialog ───────────────────────────────────────────────────────────

function NewBookDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (title: string, color: string, subject: string, totalPages: number) => Promise<void>;
}) {
  const [title, setTitle] = useState('Nová kniha');
  const [subject, setSubject] = useState('');
  const [color, setColor] = useState(BOOK_COLORS[0]);
  const [totalPages, setTotalPages] = useState(96);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => { titleRef.current?.select(); }, 50);
  }, []);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onCreate(title.trim(), color, subject.trim(), totalPages);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1a2744',
          border: `1px solid ${C.border}`,
          borderRadius: '18px',
          padding: '28px 32px',
          width: '420px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 700, color: C.text }}>
          Nová kniha
        </h2>

        {/* Color preview */}
        <div style={{
          height: '80px',
          borderRadius: '10px',
          background: `linear-gradient(135deg, ${color}dd, ${color}66)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
        }}>
          <BookOpen size={32} color="rgba(255,255,255,0.4)" strokeWidth={1.5} />
        </div>

        {/* Color picker */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {BOOK_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{
                width: '26px', height: '26px', borderRadius: '50%',
                background: c, border: color === c ? '2px solid white' : '2px solid transparent',
                cursor: 'pointer', outline: 'none',
                boxShadow: color === c ? `0 0 0 2px ${c}` : 'none',
                transition: 'transform 80ms',
                transform: color === c ? 'scale(1.2)' : 'scale(1)',
              }}
            />
          ))}
        </div>

        {/* Title input */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', color: C.muted, display: 'block', marginBottom: '6px', fontWeight: 500 }}>
            Název knihy
          </label>
          <input
            ref={titleRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') onClose(); }}
            placeholder="Název knihy"
            style={{
              width: '100%',
              background: '#0d1a2d',
              border: `1px solid ${C.border}`,
              borderRadius: '8px',
              color: C.text,
              fontSize: '15px',
              padding: '10px 12px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Subject input */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', color: C.muted, display: 'block', marginBottom: '6px', fontWeight: 500 }}>
            Předmět (volitelné)
          </label>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') onClose(); }}
            placeholder="např. Matematika, Přírodopis…"
            style={{
              width: '100%',
              background: '#0d1a2d',
              border: `1px solid ${C.border}`,
              borderRadius: '8px',
              color: C.text,
              fontSize: '14px',
              padding: '10px 12px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Total pages */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '12px', color: C.muted, display: 'block', marginBottom: '8px', fontWeight: 500 }}>
            Počet stran
          </label>
          {/* Preset buttons */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
            {PAGE_PRESETS.map(p => (
              <button
                key={p.value}
                onClick={() => setTotalPages(p.value)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '7px',
                  border: totalPages === p.value ? `2px solid ${C.accent}` : `1px solid ${C.border}`,
                  background: totalPages === p.value ? `${C.accent}22` : '#0d1a2d',
                  color: totalPages === p.value ? C.accent : C.muted,
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 80ms',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          {/* Custom value */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="number"
              value={totalPages}
              min={4}
              max={500}
              step={4}
              onChange={e => setTotalPages(Math.max(4, Math.min(500, parseInt(e.target.value) || 4)))}
              style={{
                width: '90px',
                background: '#0d1a2d',
                border: `1px solid ${C.border}`,
                borderRadius: '8px',
                color: C.text,
                fontSize: '14px',
                padding: '8px 10px',
                outline: 'none',
              }}
            />
            <span style={{ fontSize: '13px', color: C.muted }}>vlastní počet</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              border: `1px solid ${C.border}`,
              background: 'transparent',
              color: C.muted,
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Zrušit
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !title.trim()}
            style={{
              padding: '9px 20px',
              borderRadius: '8px',
              border: 'none',
              background: color,
              color: '#fff',
              cursor: saving || !title.trim() ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Vytváří se…' : 'Vytvořit'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Share book dialog ─────────────────────────────────────────────────────────

function ShareBookDialog({
  bookTitle,
  onClose,
  onConfirm,
}: {
  bookTitle: string;
  onClose: () => void;
  onConfirm: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const submit = async () => {
    const trimmed = email.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onConfirm(trimmed);
      onClose();
    } catch {
      /* toast v rodiči */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 220,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1a2744',
          border: `1px solid ${C.border}`,
          borderRadius: '18px',
          padding: '28px 32px',
          width: '420px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: C.text }}>
          Sdílet knihu
        </h2>
        <p style={{ margin: '0 0 18px', fontSize: '13px', color: C.muted, lineHeight: 1.45 }}>
          „{bookTitle}“ — zadejte e-mail učitele registrovaného ve Vividbooks (stejný jako u Google přihlášení).
        </p>
        <input
          ref={inputRef}
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') void submit();
            if (e.key === 'Escape') onClose();
          }}
          placeholder="ucitel@skola.cz"
          style={{
            width: '100%',
            background: '#0d1a2d',
            border: `1px solid ${C.border}`,
            borderRadius: '8px',
            color: C.text,
            fontSize: '14px',
            padding: '10px 12px',
            outline: 'none',
            boxSizing: 'border-box',
            marginBottom: '20px',
          }}
        />
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              border: `1px solid ${C.border}`,
              background: 'transparent',
              color: C.muted,
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Zrušit
          </button>
          <button
            type="button"
            disabled={busy || !email.trim()}
            onClick={() => void submit()}
            style={{
              padding: '9px 20px',
              borderRadius: '8px',
              border: 'none',
              background: C.accent,
              color: '#fff',
              cursor: busy || !email.trim() ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              opacity: busy ? 0.75 : 1,
            }}
          >
            {busy ? 'Sdílím…' : 'Sdílet'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main BookshelfPage ────────────────────────────────────────────────────────

export function BookshelfPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [books, setBooks] = useState<TeacherBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [shareBookId, setShareBookId] = useState<string | null>(null);
  const [jsonBusyBookId, setJsonBusyBookId] = useState<string | null>(null);
  const importJsonBookIdRef = useRef<string | null>(null);
  const importJsonInputRef = useRef<HTMLInputElement>(null);

  // ── Load books ──────────────────────────────────────────────────────────────
  const loadBooks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const next = `${location.pathname}${location.search}`;
        navigate(`/teacher/login?next=${encodeURIComponent(next)}`);
        return;
      }

      const { books: list, error } = await fetchTeacherBooksForCurrentUser(user.id);
      if (error) throw error;

      setBooks(
        list.map(b => ({
          id: b.id,
          title: b.title,
          subject: b.subject,
          grade: b.grade,
          color: b.color,
          cover_url: b.cover_url,
          total_pages: b.total_pages,
          created_at: b.created_at,
          updated_at: b.updated_at,
          chapter_count: b.chapter_count,
          is_shared: b.is_shared,
        })),
      );
    } catch (e) {
      console.error('[Bookshelf] load error', e);
      toast.error('Nepodařilo se načíst knihy');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBooks(); }, []);

  // ── Create book ─────────────────────────────────────────────────────────────
  const handleCreate = async (title: string, color: string, subject: string, totalPages: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload: Record<string, unknown> = {
      teacher_id: user.id,
      title,
      color,
      subject: subject || null,
      total_pages: Math.max(1, Math.min(500, Math.round(totalPages))),
    };

    let { data, error } = await supabase.from('teacher_books').insert(payload).select().single();

    // Starší DB bez sloupce total_pages — zkusit znovu bez něj (kniha vznikne s výchozí 0 stran)
    if (error?.message?.includes('total_pages') || error?.code === 'PGRST204') {
      const { total_pages: _t, ...withoutPages } = payload;
      const retry = await supabase.from('teacher_books').insert(withoutPages).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) {
      console.error('[Bookshelf] create book', error);
      const hint = error?.message
        ? `${error.message}${error?.hint ? ` (${error.hint})` : ''}`
        : 'Neznámá chyba';
      toast.error(`Nepodařilo se vytvořit knihu: ${hint}`);
      return;
    }

    setShowNew(false);
    navigate(laioutBookEditorPath(data.id));
  };

  const shareTargetBook = shareBookId ? books.find(b => b.id === shareBookId) : null;

  const handleShareConfirm = async (email: string) => {
    if (!shareBookId) return;
    const { data: targetUserId, error: rpcErr } = await supabase.rpc('lookup_user_id_for_book_share', {
      target_email: email,
    });
    if (rpcErr) {
      console.error('[Bookshelf] share rpc', rpcErr);
      toast.error('Nepodařilo se vyhledat uživatele');
      throw new Error(rpcErr.message);
    }
    if (!targetUserId) {
      toast.error('Uživatele s tímto e-mailem jsme nenašli (musí mít účet ve Vividbooks).');
      throw new Error('not found');
    }
    const { error: insErr } = await supabase.from('teacher_book_shares').insert({
      book_id: shareBookId,
      shared_with_user_id: targetUserId,
    });
    if (insErr) {
      if (insErr.code === '23505') {
        toast.error('Tato kniha je s tímto uživatelem už sdílená.');
      } else {
        console.error('[Bookshelf] share insert', insErr);
        toast.error('Sdílení se nepodařilo: ' + insErr.message);
      }
      throw new Error(insErr.message);
    }
    toast.success('Kniha byla nasdílena');
    setShareBookId(null);
    await loadBooks();
  };

  // ── Rename book ─────────────────────────────────────────────────────────────
  const handleRename = async (id: string, newTitle: string) => {
    const b = books.find(x => x.id === id);
    if (b?.is_shared) {
      toast.error('Sdílenou knihu nemůžete přejmenovat');
      return;
    }
    setBooks(prev => prev.map(b => b.id === id ? { ...b, title: newTitle } : b));
    const { error } = await supabase
      .from('teacher_books')
      .update({ title: newTitle })
      .eq('id', id);
    if (error) {
      toast.error('Nepodařilo se přejmenovat');
      loadBooks();
    }
  };

  // ── Delete book ─────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    const b = books.find(x => x.id === id);
    if (b?.is_shared) {
      toast.error('Sdílenou knihu nemůžete smazat');
      setConfirmDelete(null);
      return;
    }
    setBooks(prev => prev.filter(b => b.id !== id));
    setConfirmDelete(null);
    const { error } = await supabase.from('teacher_books').delete().eq('id', id);
    if (error) {
      toast.error('Nepodařilo se smazat knihu');
      loadBooks();
    } else {
      toast.success('Kniha smazána');
    }
  };

  const handleDownloadBookJson = async (bookId: string, bookTitle: string) => {
    const b = books.find(x => x.id === bookId);
    if (b?.is_shared) {
      toast.error('U sdílené knihy nelze stáhnout JSON z této nabídky');
      return;
    }
    setJsonBusyBookId(bookId);
    try {
      const payload = await buildLaioutBookJsonFileForBook(bookId);
      if (!payload) {
        toast.error('Nepodařilo se načíst knihu');
        return;
      }
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sanitizeFilenamePart(bookTitle || 'kniha')}.laiout-book.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Kniha stažena jako JSON');
    } catch (e) {
      console.error('[Bookshelf] export JSON', e);
      toast.error('Export se nepodařil');
    } finally {
      setJsonBusyBookId(null);
    }
  };

  const pickImportJson = (bookId: string) => {
    const b = books.find(x => x.id === bookId);
    if (b?.is_shared) {
      toast.error('Do sdílené knihy nelze nahrát JSON');
      return;
    }
    importJsonBookIdRef.current = bookId;
    importJsonInputRef.current?.click();
  };

  const handleImportJsonFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const bookId = importJsonBookIdRef.current;
    importJsonBookIdRef.current = null;
    if (!file || !bookId) return;

    const ok = window.confirm(
      'Nahrát knihu z JSON přepíše kapitoly a listy v této knize. Pokračovat?',
    );
    if (!ok) return;

    setJsonBusyBookId(bookId);
    try {
      const text = await file.text();
      await importLaioutBookJsonIntoBook(bookId, text);
      try {
        sessionStorage.removeItem(`wb-meta-${bookId}`);
        sessionStorage.removeItem(`wb-full-${bookId}`);
      } catch {
        /* ignore */
      }
      await loadBooks();
      toast.success('Kniha byla importována z JSON');
    } catch (err) {
      if (err instanceof BookJsonImportError) {
        const msg =
          err.code === 'PARSE'
            ? 'Soubor není platný JSON'
            : err.code === 'INVALID'
              ? 'Neplatný formát (očekáván export z Laiout)'
              : err.code === 'INCOMPLETE'
                ? 'V JSON chybí obsah některých listů'
                : err.code === 'AUTH'
                  ? 'Nejste přihlášeni'
                  : 'Import se nepodařil';
        toast.error(msg);
      } else {
        console.error('[Bookshelf] import JSON', err);
        toast.error('Import se nepodařil');
      }
    } finally {
      setJsonBusyBookId(null);
    }
  };

  const filtered = books.filter(b =>
    b.title.toLowerCase().includes(search.toLowerCase()) ||
    (b.subject ?? '').toLowerCase().includes(search.toLowerCase())
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <input
        ref={importJsonInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={handleImportJsonFile}
      />

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: `${C.bg}ee`,
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${C.border}`,
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        height: '60px',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginRight: '16px' }}>
          <LaioutBrandLogo size={28} />
          <span style={{ fontSize: '16px', fontWeight: 700, color: C.text, letterSpacing: '-0.3px' }}>
            Laiout
          </span>
        </div>

        <div style={{ width: '1px', height: '24px', background: C.border }} />

        <span style={{ fontSize: '14px', color: C.muted, fontWeight: 500 }}>Moje knihy</span>

        {/* Search */}
        <div style={{ flex: 1, maxWidth: '320px', marginLeft: 'auto', position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Hledat knihy…"
            style={{
              width: '100%',
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: '8px',
              color: C.text,
              fontSize: '13px',
              padding: '7px 10px 7px 30px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* New book button */}
        <button
          onClick={() => setShowNew(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            padding: '8px 16px',
            background: C.accent,
            border: 'none',
            borderRadius: '9px',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'opacity 120ms',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <Plus size={16} />
          Nová kniha
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '40px 32px', maxWidth: '1200px', margin: '0 auto' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: C.muted, fontSize: '14px', gap: '10px' }}>
            <div style={{
              width: '20px', height: '20px', border: `2px solid ${C.border}`, borderTopColor: C.accent,
              borderRadius: '50%', animation: 'spin 0.8s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            Načítám knihy…
          </div>
        ) : filtered.length === 0 && !search ? (
          // Empty state
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '20px', textAlign: 'center' }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '20px',
              background: `linear-gradient(135deg, #1e3a5f, #1a2744)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1px solid ${C.border}`,
            }}>
              <BookOpen size={36} color={C.muted} strokeWidth={1.5} />
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>
                Zatím žádné knihy
              </div>
              <div style={{ fontSize: '14px', color: C.muted, maxWidth: '280px' }}>
                Vytvořte svou první knihu a začněte tvořit obsah kapitolu po kapitole.
              </div>
            </div>
            <button
              onClick={() => setShowNew(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '11px 22px', background: C.accent, border: 'none',
                borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: 600,
                cursor: 'pointer', transition: 'opacity 120ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <Plus size={18} />
              Vytvořit první knihu
            </button>
          </div>
        ) : (
          <>
            {search && (
              <div style={{ fontSize: '13px', color: C.muted, marginBottom: '20px' }}>
                {filtered.length} {filtered.length === 1 ? 'výsledek' : 'výsledky'} pro „{search}"
              </div>
            )}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '20px',
            }}>
              {filtered.map(book => (
                <BookCard
                  key={book.id}
                  book={book}
                  canManage={!book.is_shared}
                  onOpen={() => navigate(laioutBookEditorPath(book.id))}
                  onRename={handleRename}
                  onDelete={id => setConfirmDelete(id)}
                  onShare={id => setShareBookId(id)}
                  jsonBusy={jsonBusyBookId === book.id}
                  onDownloadJson={() => void handleDownloadBookJson(book.id, book.title)}
                  onImportJson={() => pickImportJson(book.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* New book dialog */}
      {showNew && (
        <NewBookDialog
          onClose={() => setShowNew(false)}
          onCreate={handleCreate}
        />
      )}

      {shareTargetBook && (
        <ShareBookDialog
          bookTitle={shareTargetBook.title}
          onClose={() => setShareBookId(null)}
          onConfirm={handleShareConfirm}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div
          onClick={() => setConfirmDelete(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#1a2744', border: `1px solid ${C.border}`,
              borderRadius: '16px', padding: '28px 32px', width: '360px',
              boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ fontSize: '17px', fontWeight: 700, color: C.text, marginBottom: '10px' }}>
              Smazat knihu?
            </div>
            <div style={{ fontSize: '13px', color: C.muted, marginBottom: '24px', lineHeight: 1.5 }}>
              Tato akce je nevratná. Všechny kapitoly přiřazené k této knize zůstanou zachovány, ale ztratí propojení s knihou.
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{ padding: '9px 18px', borderRadius: '8px', border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: '14px' }}
              >
                Zrušit
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
              >
                Smazat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
