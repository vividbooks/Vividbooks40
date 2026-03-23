/**
 * DatasetContextPanel
 *
 * Zobrazuje kontext zdrojového datasetu (z curriculum factory) přímo v Pro editoru.
 * Zobrazí: klíčová slova, fakta, timeline, osobnosti, obrázky.
 * Umožňuje přidat worksheet do RAG databáze.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../utils/supabase/client';
import { addWorksheetToRag } from '../../utils/worksheet-rag';
import { Worksheet } from '../../types/worksheet';
import { Database, BookOpen, Clock, User, Image, Star, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface DatasetContextPanelProps {
  worksheet: Worksheet | null;
}

interface DataSet {
  id: string;
  topic: string;
  subject_code: string;
  grade: number;
  content?: {
    keyTerms?: Array<{ term: string; definition: string }>;
    keyFacts?: string[];
    timeline?: Array<{ year?: string; date?: string; event?: string; description?: string }>;
    personalities?: Array<{ name: string; description: string }>;
  };
  media?: {
    images?: Array<{ url: string; title: string; description?: string }>;
    generatedIllustrations?: Array<{ url?: string; name?: string; title?: string }>;
  };
}

interface SectionState {
  terms: boolean;
  facts: boolean;
  timeline: boolean;
  personalities: boolean;
  images: boolean;
}

export function DatasetContextPanel({ worksheet }: DatasetContextPanelProps) {
  const [dataset, setDataset] = useState<DataSet | null>(null);
  const [loading, setLoading] = useState(false);
  const [addingToRag, setAddingToRag] = useState(false);
  const [open, setOpen] = useState<SectionState>({
    terms: true,
    facts: false,
    timeline: false,
    personalities: false,
    images: false,
  });

  const datasetId = worksheet?.metadata?.sourceDatasetId;

  useEffect(() => {
    if (!datasetId) return;
    setLoading(true);
    supabase
      .from('topic_data_sets')
      .select('id, topic, subject_code, grade, content, media')
      .eq('id', datasetId)
      .single()
      .then(({ data, error }) => {
        setLoading(false);
        if (error) {
          console.error('[DatasetPanel] Failed to load dataset:', error);
          return;
        }
        setDataset(data as DataSet);
      });
  }, [datasetId]);

  const toggleSection = useCallback((key: keyof SectionState) => {
    setOpen(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleAddToRag = useCallback(async () => {
    if (!worksheet || !dataset) return;

    setAddingToRag(true);
    try {
      const result = await addWorksheetToRag({
        worksheetId: worksheet.id,
        title: worksheet.title,
        subject: dataset.subject_code,
        grade: dataset.grade,
        topic: dataset.topic,
        blocksJson: worksheet.blocks,
        styleNotes: `Pracovní list na téma "${dataset.topic}" pro ${dataset.grade}. třídu. Obsahuje ${worksheet.blocks.length} bloků.`,
        qualityScore: 0.85,
      });

      if (result.success) {
        toast.success('Přidáno do RAG databáze!');
      } else {
        toast.error('Nepodařilo se přidat do RAG: ' + result.error);
      }
    } finally {
      setAddingToRag(false);
    }
  }, [worksheet, dataset]);

  if (!datasetId) {
    return (
      <div style={{ padding: '20px', color: '#64748b', fontSize: '13px', textAlign: 'center' }}>
        <Database size={32} style={{ margin: '0 auto 12px', color: '#334155' }} />
        <p style={{ fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>Žádný dataset</p>
        <p style={{ fontSize: '12px', lineHeight: 1.5 }}>
          Tento pracovní list není propojený s datasetem z Curriculum Factory.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
        <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
        <p style={{ fontSize: '13px' }}>Načítám dataset...</p>
      </div>
    );
  }

  if (!dataset) {
    return (
      <div style={{ padding: '20px', color: '#64748b', fontSize: '13px', textAlign: 'center' }}>
        Dataset nenalezen.
      </div>
    );
  }

  const keyTerms = dataset.content?.keyTerms ?? [];
  const keyFacts = dataset.content?.keyFacts ?? [];
  const timeline = dataset.content?.timeline ?? [];
  const personalities = dataset.content?.personalities ?? [];
  const images = [...(dataset.media?.images ?? []), ...(dataset.media?.generatedIllustrations ?? [])];

  const sectionStyle: React.CSSProperties = {
    borderBottom: '1px solid #1e293b',
  };

  const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    cursor: 'pointer',
    userSelect: 'none',
    color: '#cbd5e1',
    fontSize: '12px',
    fontWeight: 600,
    background: 'transparent',
    border: 'none',
    width: '100%',
    textAlign: 'left',
  };

  const itemStyle: React.CSSProperties = {
    padding: '6px 16px',
    fontSize: '12px',
    color: '#94a3b8',
    borderBottom: '1px solid #0f172a',
    lineHeight: 1.5,
  };

  const termStyle: React.CSSProperties = {
    color: '#60a5fa',
    fontWeight: 600,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Database size={14} style={{ color: '#818cf8' }} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0' }}>Dataset</span>
        </div>
        <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
          {dataset.topic} · {dataset.subject_code} · {dataset.grade}. třída
        </p>
      </div>

      {/* Sections */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* Klíčová slova */}
        {keyTerms.length > 0 && (
          <div style={sectionStyle}>
            <button style={sectionHeaderStyle} onClick={() => toggleSection('terms')}>
              <BookOpen size={13} style={{ color: '#60a5fa', flexShrink: 0 }} />
              Klíčová slova ({keyTerms.length})
              {open.terms ? <ChevronDown size={13} style={{ marginLeft: 'auto', color: '#475569' }} /> : <ChevronRight size={13} style={{ marginLeft: 'auto', color: '#475569' }} />}
            </button>
            {open.terms && keyTerms.map((t, i) => (
              <div key={i} style={itemStyle}>
                <span style={termStyle}>{t.term}</span>
                {t.definition && <span style={{ color: '#64748b' }}> — {t.definition}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Klíčová fakta */}
        {keyFacts.length > 0 && (
          <div style={sectionStyle}>
            <button style={sectionHeaderStyle} onClick={() => toggleSection('facts')}>
              <Star size={13} style={{ color: '#fbbf24', flexShrink: 0 }} />
              Klíčová fakta ({keyFacts.length})
              {open.facts ? <ChevronDown size={13} style={{ marginLeft: 'auto', color: '#475569' }} /> : <ChevronRight size={13} style={{ marginLeft: 'auto', color: '#475569' }} />}
            </button>
            {open.facts && keyFacts.map((f, i) => (
              <div key={i} style={itemStyle}>• {f}</div>
            ))}
          </div>
        )}

        {/* Časová osa */}
        {timeline.length > 0 && (
          <div style={sectionStyle}>
            <button style={sectionHeaderStyle} onClick={() => toggleSection('timeline')}>
              <Clock size={13} style={{ color: '#34d399', flexShrink: 0 }} />
              Časová osa ({timeline.length})
              {open.timeline ? <ChevronDown size={13} style={{ marginLeft: 'auto', color: '#475569' }} /> : <ChevronRight size={13} style={{ marginLeft: 'auto', color: '#475569' }} />}
            </button>
            {open.timeline && timeline.map((e, i) => (
              <div key={i} style={itemStyle}>
                <span style={{ color: '#34d399', fontWeight: 600 }}>{e.year || e.date}</span>
                {(e.event || e.description) && <span> — {e.event || e.description}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Osobnosti */}
        {personalities.length > 0 && (
          <div style={sectionStyle}>
            <button style={sectionHeaderStyle} onClick={() => toggleSection('personalities')}>
              <User size={13} style={{ color: '#f472b6', flexShrink: 0 }} />
              Osobnosti ({personalities.length})
              {open.personalities ? <ChevronDown size={13} style={{ marginLeft: 'auto', color: '#475569' }} /> : <ChevronRight size={13} style={{ marginLeft: 'auto', color: '#475569' }} />}
            </button>
            {open.personalities && personalities.map((p, i) => (
              <div key={i} style={itemStyle}>
                <span style={{ color: '#f472b6', fontWeight: 600 }}>{p.name}</span>
                {p.description && <span style={{ color: '#64748b' }}> — {p.description}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Obrázky */}
        {images.length > 0 && (
          <div style={sectionStyle}>
            <button style={sectionHeaderStyle} onClick={() => toggleSection('images')}>
              <Image size={13} style={{ color: '#a78bfa', flexShrink: 0 }} />
              Obrázky ({images.length})
              {open.images ? <ChevronDown size={13} style={{ marginLeft: 'auto', color: '#475569' }} /> : <ChevronRight size={13} style={{ marginLeft: 'auto', color: '#475569' }} />}
            </button>
            {open.images && images.map((img: any, i) => (
              <div key={i} style={{ padding: '8px 16px', borderBottom: '1px solid #0f172a' }}>
                {img.url && (
                  <img
                    src={img.url}
                    alt={img.title || img.name || ''}
                    style={{ width: '100%', borderRadius: 6, marginBottom: 4, maxHeight: 100, objectFit: 'cover' }}
                    loading="lazy"
                  />
                )}
                <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>{img.title || img.name || 'Obrázek'}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer — přidat do RAG */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #334155', flexShrink: 0 }}>
        <button
          onClick={handleAddToRag}
          disabled={addingToRag}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '8px 12px',
            backgroundColor: addingToRag ? '#475569' : '#4f46e5',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: '12px',
            fontWeight: 600,
            cursor: addingToRag ? 'not-allowed' : 'pointer',
          }}
        >
          {addingToRag ? (
            <><Loader2 size={13} className="animate-spin" /> Přidávám...</>
          ) : (
            <><Star size={13} /> Přidat do RAG databáze</>
          )}
        </button>
        <p style={{ fontSize: '10px', color: '#475569', marginTop: 6, textAlign: 'center', lineHeight: 1.4 }}>
          Kvalitní listy v RAG zlepšují AI generování budoucích pracovních listů.
        </p>
      </div>
    </div>
  );
}
