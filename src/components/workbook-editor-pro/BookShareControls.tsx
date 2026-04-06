/**
 * Pozvání ke knize: e-mail (účet ve Vividbooks) + jednorázový odkaz (?invite=).
 */

import { useState } from 'react';
import { Link2, Loader2, Mail, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { inviteTeacherToBookByEmail, createTeacherBookInviteLink } from '../../utils/supabase/book-sharing';

const D = {
  surface: '#161b22',
  border: '#30363d',
  text: '#e6edf3',
  muted: '#8b949e',
  accent: '#5C5CFF',
} as const;

type Variant = 'collaboration' | 'settings';

export function BookShareControls({
  bookId,
  isOwner,
  variant,
  onInvited,
}: {
  bookId: string;
  isOwner: boolean;
  variant: Variant;
  onInvited?: () => void;
}) {
  const [email, setEmail] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isSettings = variant === 'settings';

  /** V bundlovaném index.css často chybí `bg-[#…]` / `border-slate-*` — použijeme inline styly. */
  const boxClass = isSettings ? 'rounded-lg p-4 space-y-4' : 'rounded-lg p-2.5 space-y-3';
  const boxStyle = isSettings
    ? {
        border: '1px solid #475569',
        backgroundColor: '#1e293b',
        colorScheme: 'dark' as const,
      }
    : { border: `1px solid ${D.border}`, backgroundColor: D.surface };
  const labelClass = isSettings ? 'block text-xs font-medium uppercase tracking-wide text-slate-400' : 'text-[11px] font-medium uppercase tracking-wide';
  const labelStyle = isSettings ? undefined : { color: D.muted };
  const inputClass = isSettings
    ? 'w-full rounded-lg px-3 py-2 text-sm outline-none placeholder:text-slate-600'
    : 'w-full px-2 py-1.5 rounded text-sm outline-none';
  const inputStyle = isSettings
    ? {
        backgroundColor: '#0f172a',
        color: '#f1f5f9',
        border: '1px solid #334155',
      }
    : {
        backgroundColor: '#0d1117',
        color: D.text,
        border: `1px solid ${D.border}`,
      };

  const handleEmailInvite = async () => {
    if (!bookId || !isOwner) return;
    setEmailBusy(true);
    try {
      const r = await inviteTeacherToBookByEmail(bookId, email);
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success('Kniha byla nasdílena');
      setEmail('');
      onInvited?.();
    } finally {
      setEmailBusy(false);
    }
  };

  const handleGenerateLink = async () => {
    if (!bookId || !isOwner) return;
    setLinkBusy(true);
    try {
      const r = await createTeacherBookInviteLink(bookId, { expiresInDays: 7 });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      setInviteUrl(r.url);
      toast.success('Odkaz je připraven — zkopíruj ho a pošli kolegovi.');
    } finally {
      setLinkBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success('Zkopírováno');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Kopírování se nepodařilo');
    }
  };

  if (!bookId) return null;

  if (!isOwner) {
    return (
      <div className={boxClass} style={boxStyle}>
        <p className={isSettings ? 'text-sm text-slate-400' : 'text-xs'} style={isSettings ? undefined : { color: D.muted, lineHeight: 1.45 }}>
          Sdílení a pozvánky může spravovat jen <strong style={{ color: isSettings ? '#e2e8f0' : D.text }}>vlastník knihy</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className={boxClass} style={boxStyle}>
      <div className="flex items-center gap-2" style={isSettings ? { color: '#e2e8f0' } : { color: D.text }}>
        <Mail size={isSettings ? 18 : 15} style={{ color: isSettings ? '#94a3b8' : D.muted }} />
        <span className={isSettings ? 'text-sm font-semibold' : 'text-xs font-bold'}>Pozvat e-mailem</span>
      </div>
      <p className={isSettings ? 'text-xs text-slate-400' : 'text-[11px]'} style={isSettings ? undefined : { color: D.muted, lineHeight: 1.45 }}>
        E-mail musí patřit účtu ve Vividbooks (stejně jako u přihlášení). Pozvaný uvidí knihu v Laiout.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          autoComplete="email"
          placeholder="např. kolega@skola.cz"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`flex-1 min-w-0 ${inputClass}`}
          style={inputStyle}
          disabled={emailBusy}
        />
        <button
          type="button"
          onClick={() => void handleEmailInvite()}
          disabled={emailBusy || !email.trim()}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-40 shrink-0"
          style={{
            backgroundColor: D.accent,
            color: '#fff',
          }}
        >
          {emailBusy ? <Loader2 size={16} className="animate-spin" /> : null}
          Pozvat
        </button>
      </div>

      <div
        className={isSettings ? 'border-t pt-4 space-y-2' : 'border-t pt-3 space-y-2'}
        style={
          isSettings
            ? { borderTop: '1px solid rgba(71, 85, 105, 0.85)' }
            : { borderColor: D.border }
        }
      >
        <div className="flex items-center gap-2" style={isSettings ? { color: '#e2e8f0' } : { color: D.text }}>
          <Link2 size={isSettings ? 18 : 15} style={{ color: isSettings ? '#94a3b8' : D.muted }} />
          <span className={isSettings ? 'text-sm font-semibold' : 'text-xs font-bold'}>Sdílecí odkaz</span>
        </div>
        <p className={isSettings ? 'text-xs text-slate-400' : 'text-[11px]'} style={isSettings ? undefined : { color: D.muted, lineHeight: 1.45 }}>
          Odkaz platí 7 dní a lze ho použít opakovaně (do limitu). Kolega se musí přihlásit — pak se kniha přidá automaticky.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleGenerateLink()}
            disabled={linkBusy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{
              backgroundColor: isSettings ? '#334155' : '#21262d',
              color: '#fff',
              border: isSettings ? '1px solid #475569' : `1px solid ${D.border}`,
            }}
          >
            {linkBusy ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
            Vygenerovat odkaz
          </button>
        </div>
        {inviteUrl ? (
          <div className="space-y-2">
            <label className={labelClass} style={labelStyle}>
              Odkaz ke zkopírování
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                readOnly
                value={inviteUrl}
                className={`flex-1 min-w-0 font-mono text-[11px] sm:text-xs ${inputClass}`}
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium shrink-0"
                style={{ backgroundColor: D.accent, color: '#fff' }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Hotovo' : 'Kopírovat'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
