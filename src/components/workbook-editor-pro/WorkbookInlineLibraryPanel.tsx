/**
 * Vnořená knihovna v editoru knihy — po kliknutí na logo Laiout.
 * Dvousloupcová scrollovatelná mřížka knih (místo přepínače módů).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, Search, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../utils/supabase/client';
import { fetchTeacherBooksForCurrentUser } from '../../utils/supabase/teacher-books';
import type { TeacherBookWithMeta } from '../../utils/supabase/teacher-books';
import { LAIOUT_BOOKSHELF_PATH, laioutBookEditorPath } from '../../utils/laiout-routes';

const PANEL_W = 368;
const C = {
  bg: '#0f172a',
  surface: '#1e293b',
  border: '#334155',
  text: '#f1f5f9',
  muted: '#64748b',
  accent: '#3b82f6',
};

function chapterCountLabel(n: number): string {
  if (n <= 0) return '0 kapitol';
  if (n === 1) return '1 kapitola';
  if (n >= 2 && n <= 4) return `${n} kapitoly`;
  return `${n} kapitol`;
}

export interface WorkbookInlineLibraryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Aktuálně otevřená kniha (zvýraznění v mřížce) */
  currentBookId?: string;
}

export function WorkbookInlineLibraryPanel({
  isOpen,
  onClose,
  currentBookId,
}: WorkbookInlineLibraryPanelProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [books, setBooks] = useState<TeacherBookWithMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  /** Stabilní ref — rodič často předává inline onClose → bez ref by se loadBooks měnil každý render a effect knihy načítal dokola. */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const loadBooks = useCallback(async () => {
    setLoading(true);
    try {
      let user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        const { data: { session } } = await supabase.auth.getSession();
        user = session?.user ?? null;
      }
      if (!user) {
        const next = `${location.pathname}${location.search}`;
        navigate(`/teacher/login?next=${encodeURIComponent(next)}`);
        onCloseRef.current();
        return;
      }
      const { books: list, error } = await fetchTeacherBooksForCurrentUser(user.id);
      if (error) {
        console.error('[WorkbookInlineLibrary] fetchTeacherBooksForCurrentUser:', error);
        toast.error('Nepodařilo se načíst knihy');
        setBooks([]);
        return;
      }
      setBooks(list);
    } catch (e) {
      console.error('[WorkbookInlineLibrary]', e);
      toast.error('Nepodařilo se načíst knihy');
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, [navigate, location.pathname, location.search]);

  useEffect(() => {
    if (isOpen) {
      void loadBooks();
    }
  }, [isOpen, loadBooks]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const filtered = books.filter(
    (b) =>
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      (b.subject ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const openBook = (bookId: string) => {
    onClose();
    if (bookId === currentBookId) return;
    navigate(laioutBookEditorPath(bookId));
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop — klik zavře */}
      <button
        type="button"
        aria-label="Zavřít knihovnu"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          left: PANEL_W,
          zIndex: 199,
          border: 'none',
          padding: 0,
          margin: 0,
          background: 'rgba(15, 23, 42, 0.45)',
          cursor: 'default',
        }}
      />

      <aside
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: PANEL_W,
          height: '100vh',
          zIndex: 200,
          backgroundColor: C.bg,
          borderRight: `1px solid ${C.border}`,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '8px 0 32px rgba(0,0,0,0.35)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 20px 14px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: C.text, letterSpacing: '-0.03em' }}>
                laiout
              </div>
              <div style={{ fontSize: '11px', color: C.muted, marginTop: 4, lineHeight: 1.45 }}>
                Knihovna
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: 8,
                borderRadius: 8,
                border: 'none',
                background: C.surface,
                color: C.muted,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Zavřít"
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ position: 'relative', marginTop: 14 }}>
            <Search
              size={14}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.muted }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hledat…"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 10px 8px 32px',
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                background: C.surface,
                color: C.text,
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              navigate(LAIOUT_BOOKSHELF_PATH);
            }}
            style={{
              marginTop: 12,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 10,
              border: `1px dashed ${C.border}`,
              background: 'transparent',
              color: C.accent,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Plus size={16} />
            Nová kniha (celá knihovna)
          </button>
        </div>

        {/* Scroll — dvě sloupce */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 14px 20px',
            minHeight: 0,
          }}
        >
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32, color: C.muted, fontSize: 13 }}>
              <Loader2 size={18} className="animate-spin" />
              Načítám…
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '28px 12px', color: C.muted, fontSize: 13, lineHeight: 1.5 }}>
              {search ? 'Žádná kniha neshoduje hledání.' : 'Zatím nemáte žádné knihy.'}
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                alignItems: 'start',
              }}
            >
              {filtered.map((book) => {
                const isCurrent = book.id === currentBookId;
                const chapters = book.chapter_count ?? 0;
                const baseBg = book.cover_url
                  ? `linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.12) 35%, rgba(0,0,0,0.15) 65%, rgba(0,0,0,0.5) 100%), url(${book.cover_url})`
                  : `linear-gradient(165deg, ${book.color} 0%, ${book.color}cc 45%, ${book.color}99 100%)`;
                return (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => openBook(book.id)}
                    title={book.title}
                    style={{
                      position: 'relative',
                      width: '100%',
                      aspectRatio: '210 / 297',
                      maxHeight: 220,
                      margin: '0 auto',
                      padding: 0,
                      border: isCurrent ? `3px solid ${C.accent}` : `1px solid rgba(0,0,0,0.35)`,
                      borderRadius: 6,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      backgroundColor: book.color,
                      backgroundImage: baseBg,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      boxShadow: isCurrent
                        ? `0 0 0 2px ${C.accent}55, 0 10px 28px rgba(0,0,0,0.45)`
                        : '0 8px 22px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12)',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                    }}
                  >
                    {/* jemný „hřbet“ knihy */}
                    <div
                      aria-hidden
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 5,
                        background: 'linear-gradient(90deg, rgba(0,0,0,0.2), transparent)',
                        pointerEvents: 'none',
                        zIndex: 1,
                      }}
                    />

                    {book.is_shared && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 6,
                          right: 6,
                          zIndex: 2,
                          fontSize: 9,
                          fontWeight: 600,
                          color: '#e9d5ff',
                          background: 'rgba(88, 28, 135, 0.75)',
                          padding: '3px 6px',
                          borderRadius: 4,
                          letterSpacing: '0.02em',
                        }}
                      >
                        Sdíleno
                      </div>
                    )}

                    <div
                      style={{
                        position: 'relative',
                        zIndex: 1,
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '10px 10px 8px 12px',
                        boxSizing: 'border-box',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: '"Cooper Light", Georgia, serif',
                          fontWeight: 300,
                          fontSize: 13,
                          lineHeight: 1.2,
                          color: '#fff',
                          textAlign: 'center',
                          textShadow: '0 1px 3px rgba(0,0,0,0.55), 0 0 12px rgba(0,0,0,0.25)',
                          display: '-webkit-box',
                          WebkitLineClamp: 4,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          wordBreak: 'break-word',
                          hyphens: 'auto',
                          flex: 1,
                          paddingTop: 4,
                        }}
                      >
                        {book.title}
                      </div>
                    </div>

                    <div
                      style={{
                        position: 'absolute',
                        right: 8,
                        bottom: 7,
                        zIndex: 2,
                        fontSize: 10,
                        fontWeight: 500,
                        letterSpacing: '0.02em',
                        color: 'rgba(255,255,255,0.92)',
                        textShadow: '0 1px 2px rgba(0,0,0,0.65)',
                        pointerEvents: 'none',
                      }}
                    >
                      {chapterCountLabel(chapters)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
