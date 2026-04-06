import React, { useState, useRef, useEffect } from 'react';
import {
  FileText, Image as ImageIcon, X, Loader2,
  Database, Plus, Check, PenLine, Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../utils/supabase/client';
import type { DatasetFile, DesignSystemDataset } from '../../types/design-system';

// ─── Storage helpers ───────────────────────────────────────────────────────────

const STORAGE_KEY_PREFIX = 'vividbooks-dataset-';

function loadDataset(scopeId: string): DesignSystemDataset {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${scopeId}`);
    if (raw) return JSON.parse(raw) as DesignSystemDataset;
  } catch {}
  return { files: [] };
}

function saveDataset(scopeId: string, ds: DesignSystemDataset) {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${scopeId}`, JSON.stringify(ds));
  } catch {}
}

function formatSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Stejná paleta jako levý panel kapitol / Nastavení v WorkbookProLayout (#1e293b + karty #0f172a).
 * (Bundlovaný `index.css` bez řady Tailwind utilit.)
 */
const DATASET_PANEL_BG = '#1e293b';

const DATASET_STACKED_SURFACE: React.CSSProperties = {
  borderRadius: 24,
  border: '1px solid #334155',
  backgroundColor: '#0f172a',
  boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.04)',
};

const DATASET_STACKED_TEXTAREA: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  resize: 'vertical',
  borderRadius: 12,
  padding: '12px 14px',
  fontSize: 13,
  lineHeight: 1.65,
  color: '#f1f5f9',
  backgroundColor: DATASET_PANEL_BG,
  border: '1px solid #475569',
  outline: 'none',
  fontFamily: 'inherit',
};

// ─── Drop zone ─────────────────────────────────────────────────────────────────

function DropZone({
  label, accept, dragOver, onDragOver, onDragLeave, onDrop, onClick,
}: {
  label: string;
  accept: string;
  dragOver: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: (files: FileList) => void;
  onClick: () => void;
}) {
  return (
    <div
      onDragOver={e => { e.preventDefault(); onDragOver(); }}
      onDragLeave={onDragLeave}
      onDrop={e => { e.preventDefault(); onDrop(e.dataTransfer.files); }}
      onClick={onClick}
      style={{
        border: `2px dashed ${dragOver ? '#3B82F6' : '#334155'}`,
        borderRadius: '10px',
        padding: '20px 20px',
        display: 'flex', alignItems: 'center', gap: '14px',
        cursor: 'pointer',
        backgroundColor: dragOver ? 'rgba(59,130,246,0.08)' : 'rgba(15,23,42,0.6)',
        transition: 'all 0.15s',
      }}
    >
      <Upload size={20} style={{ color: dragOver ? '#3B82F6' : '#475569', flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: dragOver ? '#3B82F6' : '#e2e8f0', marginBottom: '2px' }}>{label}</div>
        <div style={{ fontSize: '11px', color: '#475569' }}>{accept}</div>
      </div>
    </div>
  );
}

// ─── Inline text editor ────────────────────────────────────────────────────────

function InlineTextEditor({ onSave, onCancel }: { onSave: (name: string, content: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  const canSave = content.trim().length > 0;
  const autoName = name.trim() || `Text ${new Date().toLocaleString('cs', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;

  return (
    <div style={{
      backgroundColor: '#1e293b', border: '1px solid #3B82F6',
      borderRadius: '12px', padding: '16px', marginBottom: '16px',
    }}>
      {/* Name input */}
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Název (volitelný)"
        style={{
          width: '100%', padding: '7px 10px', boxSizing: 'border-box',
          backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '7px',
          color: '#f1f5f9', fontSize: '12px', fontFamily: 'inherit',
          marginBottom: '10px',
        }}
      />
      {/* Content textarea */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Vlož nebo napiš text…"
        rows={8}
        style={{
          width: '100%', padding: '10px 12px', boxSizing: 'border-box',
          backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px',
          color: '#f1f5f9', fontSize: '13px', lineHeight: 1.7,
          resize: 'vertical', fontFamily: 'inherit', marginBottom: '12px',
        }}
      />
      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={onCancel}
          style={{ padding: '7px 14px', borderRadius: '7px', border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}>
          Zrušit
        </button>
        <button onClick={() => canSave && onSave(autoName, content.trim())} disabled={!canSave}
          style={{
            padding: '7px 16px', borderRadius: '7px', border: 'none',
            background: canSave ? '#3B82F6' : '#334155',
            color: canSave ? 'white' : '#475569', fontSize: '12px', fontWeight: 600,
            cursor: canSave ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
          <Check size={13} /> Uložit
        </button>
      </div>
    </div>
  );
}

// ─── Text file card ────────────────────────────────────────────────────────────

function TextFileCard({ file, onRemove }: { file: DatasetFile; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const isInline = !!file.content;

  return (
    <div style={{
      backgroundColor: '#1e293b', borderRadius: '10px', border: '1px solid #334155',
      overflow: 'hidden', marginBottom: '8px',
    }}>
      {/* Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px' }}>
        {isInline
          ? <PenLine size={15} style={{ color: '#10B981', flexShrink: 0 }} />
          : <FileText size={15} style={{ color: '#3B82F6', flexShrink: 0 }} />
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 500, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {file.name}
          </div>
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '1px' }}>
            {isInline
              ? `${file.content!.length} znaků`
              : formatSize(file.size)
            }
          </div>
        </div>
        {isInline && (
          <button onClick={() => setExpanded(v => !v)}
            style={{ fontSize: '11px', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
            {expanded ? 'Skrýt' : 'Zobrazit'}
          </button>
        )}
        {!isInline && (
          <a href={file.url} target="_blank" rel="noreferrer"
            style={{ fontSize: '11px', color: '#3B82F6', textDecoration: 'none', flexShrink: 0 }}>
            Otevřít
          </a>
        )}
        <button onClick={onRemove}
          style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex', flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
          onMouseLeave={e => (e.currentTarget.style.color = '#475569')}>
          <X size={14} />
        </button>
      </div>
      {/* Inline preview */}
      {isInline && expanded && (
        <div style={{
          borderTop: '1px solid #334155', padding: '12px 14px',
          fontSize: '12px', color: '#94a3b8', lineHeight: 1.7,
          maxHeight: '200px', overflowY: 'auto', whiteSpace: 'pre-wrap',
          backgroundColor: '#0f172a',
        }}>
          {file.content}
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

type Tab = 'text' | 'image';

export interface DatasetPanelProps {
  scopeId: string;
  initialDataset?: DesignSystemDataset;
  onDatasetChange?: (ds: DesignSystemDataset) => void;
  /** Sloupec karet v Nastavení knihy (bez vnitřního levého sidebaru) */
  layout?: 'default' | 'stacked';
}

export function DatasetPanel({ scopeId, initialDataset, onDatasetChange, layout = 'default' }: DatasetPanelProps) {
  const [dataset, setDatasetState] = useState<DesignSystemDataset>(() => {
    return initialDataset ?? loadDataset(scopeId);
  });
  const [activeTab, setActiveTab] = useState<Tab>('text');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState<'text' | 'image' | null>(null);
  const [showInlineEditor, setShowInlineEditor] = useState(false);
  const textInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialDataset) setDatasetState(initialDataset);
  }, [scopeId]);

  const setDataset = (ds: DesignSystemDataset) => {
    setDatasetState(ds);
    saveDataset(scopeId, ds);
    onDatasetChange?.(ds);
  };

  const uploadFile = async (file: File, kind: 'text' | 'image'): Promise<DatasetFile | null> => {
    const ext = file.name.split('.').pop() ?? 'bin';
    const path = `dataset/${kind}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await supabase.storage
      .from('teacher-files')
      .upload(path, file, { upsert: true });
    if (error || !data) { toast.error(`Chyba při nahrávání: ${file.name}`); return null; }
    const { data: urlData } = supabase.storage.from('teacher-files').getPublicUrl(data.path);
    return {
      id: `df-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      kind,
      url: urlData.publicUrl,
      size: file.size,
      mimeType: file.type,
      uploadedAt: new Date().toISOString(),
    };
  };

  const handleFiles = async (files: FileList | File[], kind: 'text' | 'image') => {
    setUploading(true);
    const arr = Array.from(files);
    const results: DatasetFile[] = [];
    for (const f of arr) {
      const r = await uploadFile(f, kind);
      if (r) results.push(r);
    }
    if (results.length) {
      setDataset({ ...dataset, files: [...dataset.files, ...results] });
      toast.success(`Nahráno ${results.length} soubor${results.length === 1 ? '' : 'ů'}`);
    }
    setUploading(false);
  };

  const handleSaveInlineText = (name: string, content: string) => {
    const entry: DatasetFile = {
      id: `df-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      kind: 'text',
      url: '',
      content,
      uploadedAt: new Date().toISOString(),
    };
    setDataset({ ...dataset, files: [...dataset.files, entry] });
    setShowInlineEditor(false);
    toast.success('Text uložen');
  };

  const removeFile = (id: string) =>
    setDataset({ ...dataset, files: dataset.files.filter(f => f.id !== id) });

  const textFiles = dataset.files.filter(f => f.kind === 'text');
  const imageFiles = dataset.files.filter(f => f.kind === 'image');

  const NAV: { id: Tab; label: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; count: number }[] = [
    { id: 'text',  label: 'Textové podklady', icon: FileText,   count: textFiles.length },
    { id: 'image', label: 'Obrázky',           icon: ImageIcon, count: imageFiles.length },
  ];

  const topicBlock = (
    <div
      className={layout === 'stacked' ? `p-6` : ''}
      style={
        layout === 'stacked'
          ? { ...DATASET_STACKED_SURFACE, padding: 24 }
          : { padding: '12px 14px', borderBottom: '1px solid #334155' }
      }
    >
      <div
        className="text-slate-400"
        style={{
          fontSize: layout === 'stacked' ? 11 : 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 8,
        }}
      >
        Téma pro AI
      </div>
      <textarea
        value={dataset.topic ?? ''}
        onChange={e => setDataset({ ...dataset, topic: e.target.value })}
        placeholder="Krátký popis — AI to dostane jako kontext při generování."
        rows={layout === 'stacked' ? 4 : 3}
        className={
          layout === 'stacked'
            ? 'w-full box-border placeholder:text-slate-600'
            : 'w-full box-border rounded-lg border border-slate-600 bg-slate-950/80 text-slate-100'
        }
        style={
          layout === 'stacked'
            ? { ...DATASET_STACKED_TEXTAREA }
            : {
                padding: '10px 12px',
                fontSize: 13,
                lineHeight: 1.6,
                resize: 'vertical',
                fontFamily: 'inherit',
                outline: 'none',
              }
        }
      />
    </div>
  );

  const tabSwitcher = (
    <div
      className={layout === 'stacked' ? 'flex gap-1 p-1.5' : ''}
      style={
        layout === 'stacked'
          ? { ...DATASET_STACKED_SURFACE, padding: 6 }
          : { padding: '8px 8px' }
      }
    >
      {NAV.map(item => {
        const isActive = activeTab === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={layout === 'stacked' ? 'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium' : ''}
            style={
              layout === 'default'
                ? {
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: 'none',
                    textAlign: 'left',
                    backgroundColor: isActive ? '#0f172a' : 'transparent',
                    marginBottom: 2,
                  }
                : {
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '10px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: 'none',
                    backgroundColor: isActive ? '#1e293b' : 'transparent',
                    color: isActive ? '#f1f5f9' : '#94a3b8',
                    transition: 'background-color 0.15s, color 0.15s',
                  }
            }
            onMouseEnter={
              layout === 'default'
                ? (e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = '#263348'; })
                : (e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(30, 41, 59, 0.55)'; })
            }
            onMouseLeave={
              layout === 'default'
                ? (e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; })
                : (e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; })
            }
          >
            <Icon size={16} style={{ color: isActive ? '#3B82F6' : '#64748b', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: isActive ? '#e2e8f0' : '#94a3b8', flex: layout === 'stacked' ? undefined : 1 }}>
              {item.label}
            </span>
            {item.count > 0 && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: isActive ? '#3B82F6' : '#475569',
                  backgroundColor: isActive ? 'rgba(59,130,246,0.15)' : '#0f172a',
                  padding: '1px 7px',
                  borderRadius: 10,
                }}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  const mainContent = (
    <div
      style={
        layout === 'stacked'
          ? {
              ...DATASET_STACKED_SURFACE,
              flex: 1,
              overflowY: 'auto',
              padding: '22px 24px',
            }
          : { flex: 1, overflowY: 'auto', padding: '28px 32px' }
      }
    >

        {/* Text tab */}
        {activeTab === 'text' && (
          <div>
            {/* Action bar */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              {/* Upload file */}
              <input
                ref={textInputRef} type="file"
                accept=".txt,.md,.pdf,.docx,.doc,.csv,.json"
                multiple style={{ display: 'none' }}
                onChange={e => e.target.files && handleFiles(e.target.files, 'text')}
              />
              <button
                onClick={() => textInputRef.current?.click()}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '11px 16px', borderRadius: '10px', cursor: 'pointer',
                  border: '1px solid #334155', backgroundColor: '#1e293b',
                  color: '#94a3b8', fontSize: '13px', fontWeight: 500,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#475569'; (e.currentTarget as HTMLElement).style.color = '#e2e8f0'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#334155'; (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
              >
                <Upload size={15} /> Nahrát soubor
              </button>

              {/* Paste / write inline */}
              <button
                onClick={() => { setShowInlineEditor(true); }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '11px 16px', borderRadius: '10px', cursor: 'pointer',
                  border: '1px solid #334155', backgroundColor: '#1e293b',
                  color: '#94a3b8', fontSize: '13px', fontWeight: 500,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#475569'; (e.currentTarget as HTMLElement).style.color = '#e2e8f0'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#334155'; (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
              >
                <PenLine size={15} /> Vložit text
              </button>
            </div>

            {/* Drop zone */}
            <div style={{ marginBottom: '20px' }}>
              <DropZone
                label="Nebo přetáhni soubory sem"
                accept="TXT · MD · PDF · DOCX · CSV · JSON"
                dragOver={dragOver === 'text'}
                onDragOver={() => setDragOver('text')}
                onDragLeave={() => setDragOver(null)}
                onDrop={files => handleFiles(files, 'text')}
                onClick={() => textInputRef.current?.click()}
              />
            </div>

            {/* Inline editor */}
            {showInlineEditor && (
              <InlineTextEditor
                onSave={handleSaveInlineText}
                onCancel={() => setShowInlineEditor(false)}
              />
            )}

            {/* File list */}
            {textFiles.length === 0 && !showInlineEditor ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569' }}>
                <FileText size={40} style={{ marginBottom: '12px', opacity: 0.2 }} />
                <div style={{ fontSize: '13px', color: '#64748b' }}>Zatím žádné textové podklady</div>
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>Nahraj soubory nebo vlož text přímo</div>
              </div>
            ) : (
              <div>
                {textFiles.map(f => (
                  <TextFileCard key={f.id} file={f} onRemove={() => removeFile(f.id)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Image tab */}
        {activeTab === 'image' && (
          <div>
            <input
              ref={imageInputRef} type="file"
              accept=".jpg,.jpeg,.png,.webp,.gif,.svg"
              multiple style={{ display: 'none' }}
              onChange={e => e.target.files && handleFiles(e.target.files, 'image')}
            />

            {/* Upload button */}
            <button
              onClick={() => imageInputRef.current?.click()}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '11px 16px', borderRadius: '10px', cursor: 'pointer',
                border: '1px solid #334155', backgroundColor: '#1e293b',
                color: '#94a3b8', fontSize: '13px', fontWeight: 500, marginBottom: '16px',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#475569'; (e.currentTarget as HTMLElement).style.color = '#e2e8f0'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#334155'; (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
            >
              <Upload size={15} /> Nahrát obrázky
            </button>

            {/* Drop zone */}
            <div style={{ marginBottom: '20px' }}>
              <DropZone
                label="Nebo přetáhni obrázky sem"
                accept="JPG · PNG · WEBP · GIF · SVG"
                dragOver={dragOver === 'image'}
                onDragOver={() => setDragOver('image')}
                onDragLeave={() => setDragOver(null)}
                onDrop={files => handleFiles(files, 'image')}
                onClick={() => imageInputRef.current?.click()}
              />
            </div>

            {imageFiles.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569' }}>
                <ImageIcon size={40} style={{ marginBottom: '12px', opacity: 0.2 }} />
                <div style={{ fontSize: '13px', color: '#64748b' }}>Zatím žádné obrázky</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
                {imageFiles.map(f => (
                  <div key={f.id} style={{
                    position: 'relative', borderRadius: '10px', overflow: 'hidden',
                    border: '1px solid #334155', backgroundColor: '#1e293b', aspectRatio: '1',
                  }}>
                    <img src={f.url} alt={f.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      padding: '4px 8px', backgroundColor: 'rgba(0,0,0,0.65)',
                      fontSize: '10px', color: '#e2e8f0',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{f.name}</div>
                    <button onClick={() => removeFile(f.id)}
                      style={{
                        position: 'absolute', top: '6px', right: '6px',
                        width: '22px', height: '22px', borderRadius: '50%',
                        backgroundColor: 'rgba(0,0,0,0.65)', border: 'none',
                        cursor: 'pointer', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
    </div>
  );

  if (layout === 'stacked') {
    return (
      <div className="flex w-full flex-col gap-5" style={{ colorScheme: 'dark' }}>
        <div className="flex flex-col gap-5 p-6" style={DATASET_STACKED_SURFACE}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5" style={{ color: '#f8fafc' }}>
              <Database size={18} className="shrink-0" style={{ color: '#818cf8' }} />
              <span className="text-sm font-semibold" style={{ fontSize: 15 }}>
                Data set knihy
              </span>
            </div>
            {uploading && (
              <Loader2 size={15} className="animate-spin" style={{ color: '#818cf8' }} />
            )}
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Téma pro AI
            </div>
            <textarea
              value={dataset.topic ?? ''}
              onChange={(e) => setDataset({ ...dataset, topic: e.target.value })}
              placeholder="Krátký popis — AI to dostane jako kontext při generování."
              rows={4}
              className="w-full placeholder:text-slate-600"
              style={DATASET_STACKED_TEXTAREA}
            />
          </div>
        </div>
        {tabSwitcher}
        {mainContent}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', backgroundColor: '#0d1526' }}>
      <aside
        style={{
          width: '300px',
          minWidth: '300px',
          backgroundColor: '#1e293b',
          borderRight: '1px solid #334155',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            padding: '16px 16px 12px',
            borderBottom: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Database size={16} style={{ color: '#3B82F6' }} />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>Data set</span>
          {uploading && <Loader2 size={13} className="animate-spin" style={{ color: '#3B82F6', marginLeft: 'auto' }} />}
        </div>
        {topicBlock}
        {tabSwitcher}
      </aside>
      {mainContent}
    </div>
  );
}
