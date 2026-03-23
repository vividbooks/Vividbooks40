import React, { useState, useEffect } from 'react';
import Lottie from 'lottie-react';
import { QRCodeSVG } from 'qrcode.react';
import { ChevronLeft, ChevronRight, ExternalLink, Globe, Volume2, Square } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useDeviceDetect } from '../../hooks/useDeviceDetect';
import { InfoSlide, SlideBlock, getTemplateById } from '../../types/quiz';
import { MathText } from '../math/MathText';
import { GalleryGridPreview, isGalleryGrid } from './GalleryGridPreview';
import { ScaledHtmlBlock } from './ScaledHtmlBlock';
import { VividMap } from '../shared/VividMap';
import type { SavedMap } from '../../types/topic-dataset';
import { speakText, stopSpeech, pauseSpeech, resumeSpeech, rewindSpeech, isSpeaking, isTTSPaused } from '../../utils/sounds';
import { isRenderableLinkUrl, normalizeLinkUrl } from '../../utils/link-url';

/** Spinner icon used while Google TTS is loading */
const SpinnerIcon = () => (
  <span style={{
    display: 'block',
    width: 16,
    height: 16,
    borderRadius: '50%',
    border: '2.5px solid rgba(255,255,255,0.35)',
    borderTopColor: '#fff',
    animation: 'spin 0.7s linear infinite',
  }} />
);

/**
 * Floating TTS control bar shown in the bottom-right corner of a block.
 *
 * States:
 *   idle    → single round 🔊 button
 *   loading → single round spinner (click to cancel)
 *   playing → pill bar: ⏪5s | ⏸ | ⏹
 *   paused  → pill bar: ⏪5s | ▶ | ⏹
 */
function TTSButton({ block }: { block: SlideBlock }) {
  const [state, setState] = React.useState<'idle' | 'loading' | 'playing' | 'paused'>('idle');

  // Detect external stop (slide change, etc.)
  React.useEffect(() => {
    if (state === 'playing' && !isSpeaking() && !isTTSPaused()) setState('idle');
  });

  const handlePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = block.ttsText || block.content || '';
    setState('loading');
    try {
      await speakText(text, block.ttsLang || 'cs-CZ', () => setState('idle'));
      setState('playing');
    } catch {
      setState('idle');
    }
  };

  const handlePauseResume = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (state === 'playing') {
      pauseSpeech();
      setState('paused');
    } else if (state === 'paused') {
      resumeSpeech();
      setState('playing');
    }
  };

  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    stopSpeech();
    setState('idle');
  };

  const handleRewind = (e: React.MouseEvent) => {
    e.stopPropagation();
    rewindSpeech(5);
  };

  const handleCancelLoad = (e: React.MouseEvent) => {
    e.stopPropagation();
    stopSpeech();
    setState('idle');
  };

  // ── Idle: single round button ─────────────────────────────────────────────
  if (state === 'idle') {
    return (
      <button
        onClick={handlePlay}
        title="Přečíst nahlas"
        style={{
          position: 'absolute', bottom: 8, right: 8, zIndex: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 34, height: 34, borderRadius: '50%', border: 'none',
          cursor: 'pointer', background: 'rgba(255,255,255,0.92)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.18)', color: '#6366f1',
          transition: 'transform 0.1s, box-shadow 0.1s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
      >
        <Volume2 size={16} />
      </button>
    );
  }

  // ── Loading: spinner, click to cancel ────────────────────────────────────
  if (state === 'loading') {
    return (
      <button
        onClick={handleCancelLoad}
        title="Zrušit"
        style={{
          position: 'absolute', bottom: 8, right: 8, zIndex: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 34, height: 34, borderRadius: '50%', border: 'none',
          cursor: 'wait', background: '#6366f1',
          boxShadow: '0 2px 8px rgba(99,102,241,0.4)', color: '#fff',
        }}
      >
        <SpinnerIcon />
      </button>
    );
  }

  // ── Playing / Paused: pill control bar ───────────────────────────────────
  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, borderRadius: '50%', border: 'none',
    cursor: 'pointer', background: 'rgba(255,255,255,0.15)',
    color: '#fff', transition: 'background 0.12s, transform 0.1s',
    flexShrink: 0,
  };

  return (
    <div
      style={{
        position: 'absolute', bottom: 8, right: 8, zIndex: 20,
        display: 'flex', alignItems: 'center', gap: 4,
        background: '#6366f1',
        borderRadius: 20,
        padding: '3px 6px',
        boxShadow: '0 2px 10px rgba(99,102,241,0.45)',
      }}
    >
      {/* Rewind 5s */}
      <button
        onClick={handleRewind}
        title="Zpět o 5s"
        style={btnBase}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.25)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)'; }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <text x="8.5" y="15.5" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none" fontFamily="sans-serif">5</text>
        </svg>
      </button>

      {/* Pause / Resume */}
      <button
        onClick={handlePauseResume}
        title={state === 'playing' ? 'Pauza' : 'Přehrát'}
        style={btnBase}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.25)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)'; }}
      >
        {state === 'playing' ? (
          // Pause icon
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="4" height="18" rx="1"/><rect x="15" y="3" width="4" height="18" rx="1"/></svg>
        ) : (
          // Play icon
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        )}
      </button>

      {/* Stop */}
      <button
        onClick={handleStop}
        title="Zastavit"
        style={btnBase}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.25)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)'; }}
      >
        <Square size={12} fill="currentColor" />
      </button>
    </div>
  );
}

export function LottieBlockPreview({ 
  url, 
  loop = true, 
  autoplay = true 
}: { 
  url: string; 
  loop?: boolean; 
  autoplay?: boolean;
}) {
  const [animationData, setAnimationData] = React.useState<any>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    if (!url) return;
    
    fetch(url)
      .then(res => res.json())
      .then(data => setAnimationData(data))
      .catch(() => setError(true));
  }, [url]);

  if (error || !animationData) {
    return (
      <div className="h-full w-full flex items-center justify-center text-slate-400">
        {error ? 'Chyba načítání animace' : 'Načítání...'}
      </div>
    );
  }

  return (
    <Lottie
      animationData={animationData}
      loop={loop !== false}
      autoplay={autoplay !== false}
      style={{ width: '100%', height: '100%' }}
    />
  );
}

const TABLE_COLORS: Record<string, { header: string; border: string }> = {
  blue:   { header: '#dbeafe', border: '#3b82f6' },
  green:  { header: '#dcfce7', border: '#22c55e' },
  purple: { header: '#f3e8ff', border: '#a855f7' },
  yellow: { header: '#fef3c7', border: '#f59e0b' },
  red:    { header: '#fee2e2', border: '#ef4444' },
  pink:   { header: '#fce7f3', border: '#ec4899' },
  cyan:   { header: '#cffafe', border: '#06b6d4' },
};

/** Renders a table block to fill the full slide block area in preview/playback. */
function ReadOnlyTableBlock({ data, bgStyle }: { data: { html: string; hasBorder?: boolean; hasRoundedCorners?: boolean; colorStyle?: string }; bgStyle?: React.CSSProperties }) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const table = ref.current?.querySelector('table') as HTMLElement | null;
    if (!table) return;
    if (!(data.hasBorder ?? true)) table.classList.add('no-border');
    if (!(data.hasRoundedCorners ?? true)) table.classList.add('no-rounded');
    const colors = TABLE_COLORS[data.colorStyle ?? ''];
    if (colors) {
      table.style.setProperty('--table-header-bg', colors.header);
      table.style.setProperty('--table-border-color', colors.border);
    }
    // Stretch to fill container — keep border-collapse: separate (set in CSS) so border-radius works
    table.style.width = '100%';
    table.style.height = '100%';
  }, [data]);

  return (
    <div style={{ width: '100%', height: '100%', padding: 12, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', ...bgStyle }}>
      <div
        ref={ref}
        className="worksheet-table-container tiptap-editor"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', borderRadius: 12 }}
        dangerouslySetInnerHTML={{ __html: data.html }}
      />
    </div>
  );
}

const CHART_PALETTE = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e', '#a78bfa', '#34d399', '#fb923c'];
const CHART_CAT_COLORS: Record<string, string> = { válka: '#ef4444', politika: '#6366f1', kultura: '#f59e0b', ekonomika: '#10b981', věda: '#22d3ee', náboženství: '#a78bfa' };

function VividMapPreview({ map }: { map: SavedMap }) {
  const [quizDone, setQuizDone] = React.useState(false);
  const [score, setScore] = React.useState({ correct: 0, total: 0 });

  const handleAnswer = (correct: boolean) => {
    setScore(prev => ({
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1,
    }));
    if (map.exerciseType !== 'info') {
      const total = (map.correctAnswers?.length || map.markers?.length || 1);
      if (score.total + 1 >= total) setQuizDone(true);
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <VividMap
        map={map}
        height={320}
        quizMode={map.exerciseType === 'identify'}
        onAnswer={handleAnswer}
      />
      {quizDone && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.9)', borderRadius: 12, flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 32 }}>{score.correct === score.total ? '🎉' : '📍'}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{score.correct} / {score.total} správně</div>
          <button onClick={() => { setQuizDone(false); setScore({ correct: 0, total: 0 }); }} style={{ padding: '8px 20px', borderRadius: 99, border: 'none', background: '#6366f1', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
            🔄 Zkusit znovu
          </button>
        </div>
      )}
    </div>
  );
}

function ChartBlock({ block, blockRadius, bgStyle }: { block: any; blockRadius?: number; bgStyle?: React.CSSProperties }) {
  const [showTable, setShowTable] = React.useState(false);
  const cols: string[] = block.chartColumns ?? ['Kategorie', 'Hodnota'];
  const rows: string[][] = block.chartRows ?? [];
  const dataKeys = cols.slice(1);
  const data = rows.map((row: string[]) => {
    const obj: any = { name: row[0] || '' };
    dataKeys.forEach((k: string, i: number) => { obj[k] = parseFloat(row[i + 1]) || 0; });
    return obj;
  });
  const tt = { borderRadius: 10, fontSize: 12, border: '1px solid #e2e8f0', background: '#fff' };
  const type: string = block.chartType ?? 'bar';
  const title: string = block.chartTitle ?? '';

  const chartEl = (
    <ResponsiveContainer width="100%" height="100%">
      {type === 'pie' ? (
        <PieChart>
          <Pie data={data.map((d: any) => ({ name: d.name, value: d[dataKeys[0]] || 0 }))} cx="50%" cy="50%" outerRadius="70%" innerRadius="30%" paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
            {data.map((_: any, i: number) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
          </Pie>
          <Tooltip contentStyle={tt} />
        </PieChart>
      ) : type === 'line' ? (
        <LineChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={tt} />
          {dataKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {dataKeys.map((k: string, i: number) => <Line key={k} type="monotone" dataKey={k} stroke={CHART_PALETTE[i]} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />)}
        </LineChart>
      ) : type === 'area' ? (
        <AreaChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
          <defs>{dataKeys.map((k: string, i: number) => <linearGradient key={k} id={`cg${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={CHART_PALETTE[i]} stopOpacity={0.35} /><stop offset="95%" stopColor={CHART_PALETTE[i]} stopOpacity={0} /></linearGradient>)}</defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={tt} />
          {dataKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {dataKeys.map((k: string, i: number) => <Area key={k} type="monotone" dataKey={k} stroke={CHART_PALETTE[i]} strokeWidth={2.5} fill={`url(#cg${i})`} />)}
        </AreaChart>
      ) : type === 'radar' ? (
        <RadarChart data={data}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} />
          {dataKeys.map((k: string, i: number) => <Radar key={k} dataKey={k} stroke={CHART_PALETTE[i]} fill={CHART_PALETTE[i]} fillOpacity={0.28} />)}
          {dataKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          <Tooltip contentStyle={tt} />
        </RadarChart>
      ) : (
        <BarChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 10 }} barCategoryGap="8%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={tt} />
          {dataKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {dataKeys.map((k: string, i: number) => (
            <Bar key={k} dataKey={k} fill={CHART_PALETTE[i]} radius={[6, 6, 0, 0]}>
              {dataKeys.length === 1 && data.map((_: any, idx: number) => <Cell key={idx} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />)}
            </Bar>
          ))}
        </BarChart>
      )}
    </ResponsiveContainer>
  );

  const timelineEl = (
    <div style={{ overflowY: 'auto', height: '100%', paddingLeft: 28, paddingRight: 16, paddingTop: 8, position: 'relative' }}>
      <div style={{ position: 'absolute', left: 12, top: 0, bottom: 0, width: 4, background: 'linear-gradient(to bottom,#6366f1,#22d3ee)', borderRadius: 99 }} />
      {rows.map((row: string[], i: number) => {
        const catKey = (row[2] || '').toLowerCase();
        const color = CHART_CAT_COLORS[catKey] || CHART_PALETTE[i % CHART_PALETTE.length];
        return (
          <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 14, position: 'relative' }}>
            <div style={{ position: 'absolute', left: -24, top: 6, width: 14, height: 14, borderRadius: '50%', backgroundColor: color, border: '3px solid white', boxShadow: `0 0 0 2px ${color}` }} />
            <div style={{ background: 'white', borderRadius: 10, padding: '8px 12px', border: `1px solid ${color}33`, borderLeft: `4px solid ${color}`, flex: 1, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color, marginBottom: 2 }}>{row[0]}</div>
              <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.4 }}>{row[1]}</div>
              {row[2] && <div style={{ marginTop: 4, fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{row[2]}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', borderRadius: blockRadius, overflow: 'hidden', ...bgStyle, background: bgStyle?.background ?? '#fff', cursor: 'pointer', position: 'relative' }}
      onClick={() => setShowTable(v => !v)}
      title="Klikni pro tabulku dat"
    >
      {/* Toggle hint */}
      <div style={{ position: 'absolute', top: 6, right: 8, fontSize: 10, color: '#94a3b8', zIndex: 10, pointerEvents: 'none' }}>
        {showTable ? '📊 graf' : '📋 data'}
      </div>

      {title && !showTable && (
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 14, color: '#0f172a', padding: '10px 12px 0' }}>{title}</div>
      )}

      {showTable ? (
        <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
          {title && <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 10 }}>{title}</div>}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>{cols.map((col: string, i: number) => (
                <th key={i} style={{ background: '#6366f1', color: '#fff', padding: '6px 10px', textAlign: 'left', fontWeight: 600, borderRadius: i === 0 ? '6px 0 0 6px' : i === cols.length - 1 ? '0 6px 6px 0' : undefined }}>{col}</th>
              ))}</tr>
            </thead>
            <tbody>
              {rows.map((row: string[], ri: number) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? '#f8fafc' : 'white' }}>
                  {row.map((cell: string, ci: number) => (
                    <td key={ci} style={{ padding: '5px 10px', color: '#334155', borderBottom: '1px solid #f1f5f9', fontWeight: ci === 0 ? 600 : 400 }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, padding: type === 'timeline' ? 0 : '8px 12px 12px' }}>
          {type === 'timeline' ? timelineEl : chartEl}
        </div>
      )}
    </div>
  );
}

function StyledGalleryGrid({ block }: { block: any }) {
  const images: string[] = block.gallery?.length > 0 ? block.gallery : (block.content ? [block.content] : []);
  return (
    <GalleryGridPreview
      images={images}
      captions={block.galleryCaptions}
      shape={block.galleryItemShape}
      borderRadius={block.galleryBorderRadius}
      strokeColor={block.galleryStrokeColor}
      strokeWidth={block.galleryStrokeWidth}
      rotate={block.galleryRotate}
      rotateMax={block.galleryRotateMax}
      labelType={block.galleryLabelType}
      labelColor={block.galleryLabelColor}
      cols={block.galleryGridColumns}
      itemHeight={block.galleryContainerHeight}
      fillHeight={true}
      caption={block.imageCaption}
    />
  );
}

// Image block with gallery support for preview
function ImageBlockPreview({ block, borderRadius }: { block: any; borderRadius: number }) {
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showSolution, setShowSolution] = useState(false);

  // Grid mode: explicit flag OR worksheet-origin props present
  if (isGalleryGrid(block) && block.gallery && block.gallery.length > 0) {
    return <StyledGalleryGrid block={block} />;
  }

  const hasGallery = block.gallery && block.gallery.length > 1;
  const imageScale = block.imageScale || 100;
  // If scale > 100%, use cover mode (crop), otherwise contain
  const imageFit = imageScale > 100 ? 'cover' : (block.imageFit || 'contain');
  const navType = block.galleryNavType || 'dots-bottom';
  // Per-image caption: prefer galleryCaptions[idx], fall back to block.imageCaption
  const galleryCaptionsArr = block.galleryCaptions as string[] | undefined;
  const currentCaption = galleryCaptionsArr?.[galleryIndex] || block.imageCaption || '';
  
  // Image position for object-position (0-100, default 50 = center)
  const posX = block.imagePositionX ?? 50;
  const posY = block.imagePositionY ?? 50;

  // Get current image
  const currentImage = hasGallery
    ? (navType === 'solution' ? (showSolution ? block.gallery[1] : block.gallery[0]) : block.gallery[galleryIndex])
    : block.content;

  const goNext = () => {
    if (hasGallery) {
      setGalleryIndex((prev) => (prev + 1) % block.gallery.length);
    }
  };

  const goPrev = () => {
    if (hasGallery) {
      setGalleryIndex((prev) => (prev - 1 + block.gallery.length) % block.gallery.length);
    }
  };

  if (!currentImage) return null;

  const renderNavigation = () => {
    if (!hasGallery) return null;

    switch (navType) {
      case 'dots-bottom':
        return (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 bg-black/30 px-3 py-2 rounded-full">
            {block.gallery.map((_: string, idx: number) => (
              <button
                key={idx}
                onClick={() => setGalleryIndex(idx)}
                className={`w-3 h-3 rounded-full transition-all ${
                  idx === galleryIndex ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        );

      case 'dots-side':
        return (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 bg-black/30 px-2 py-3 rounded-full">
            {block.gallery.map((_: string, idx: number) => (
              <button
                key={idx}
                onClick={() => setGalleryIndex(idx)}
                className={`w-3 h-3 rounded-full transition-all ${
                  idx === galleryIndex ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        );

      case 'arrows':
        return (
          <>
            <button
              onClick={goPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full shadow-lg"
              style={{ backgroundColor: 'rgba(0,0,0,0.5)', color: 'white' }}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={goNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full shadow-lg"
              style={{ backgroundColor: 'rgba(0,0,0,0.5)', color: 'white' }}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        );

      case 'solution':
        return (
          <button
            onClick={() => setShowSolution(!showSolution)}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 px-5 py-2 rounded-full font-medium text-sm transition-all flex items-center gap-2 shadow-lg z-30"
            style={{
              backgroundColor: showSolution ? '#334155' : '#4f46e5',
              color: 'white',
            }}
          >
            {showSolution ? 'Skrýt řešení' : 'Zobrazit řešení'}
          </button>
        );

      default:
        return null;
    }
  };

  const imageContent = (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{ borderRadius }}>
      {imageFit === 'cover' ? (
        <img
          src={currentImage}
          alt={block.imageCaption || ''}
          className="w-full h-full"
          style={{
            objectFit: 'cover',
            objectPosition: `${posX}% ${posY}%`,
            transform: imageScale > 100 ? `scale(${imageScale / 100})` : undefined,
          }}
        />
      ) : (
        <img
          src={currentImage}
          alt={block.imageCaption || ''}
          className="transition-transform max-w-full max-h-full"
          style={{
            width: `${imageScale}%`,
            height: 'auto',
            maxHeight: '100%',
            objectFit: 'contain',
            borderRadius: Math.max(0, borderRadius - 4),
          }}
        />
      )}
      {renderNavigation()}
      {currentCaption && (
        <div className={`absolute ${hasGallery ? 'bottom-14' : 'bottom-0'} left-0 right-0 bg-black/50 text-white text-sm px-3 py-2 text-center`}>
          {currentCaption}
        </div>
      )}
    </div>
  );

  if (block.imageLink) {
    return (
      <a href={block.imageLink} target="_blank" rel="noopener noreferrer" className="h-full w-full block">
        {imageContent}
      </a>
    );
  }

  return imageContent;
}

// Block-based layout renderer for new info slides
export function BlockLayoutView({ slide }: { slide: InfoSlide }) {
  const layout = slide.layout!;
  const blocks = layout.blocks;
  const titleHeight = layout.titleHeight || 15;
  const columnRatios = layout.columnRatios || [50, 50];
  const splitRatio = layout.splitRatio || 50;

  // Device detection - better than just screen width
  const { isMobile: isMobileDevice, isTablet } = useDeviceDetect();
  const isMobile = isMobileDevice || isTablet;

  // Get template settings
  const template = slide.templateId ? getTemplateById(slide.templateId) : undefined;
  const blockGap = slide.blockGap ?? template?.defaultGap ?? 11;
  const blockRadius = slide.blockRadius ?? template?.defaultRadius ?? 8;
  const blockColors = template?.blockColors || [];
  const fontFamily = template?.font ? (template.font.includes(' ') ? `"${template.font}", sans-serif` : `${template.font}, sans-serif`) : 'inherit';

  // Get background style for slide
  const getSlideBackgroundStyle = (): React.CSSProperties => {
    if (!slide.slideBackground) return {};
    const bg = slide.slideBackground;
    if (bg.type === 'color' && bg.color) {
      return {
        backgroundColor: bg.color === 'transparent' ? 'transparent' : bg.color,
        ...(bg.strokeColor && (bg.strokeWidth ?? 0) > 0 ? { border: `${bg.strokeWidth}px solid ${bg.strokeColor}` } : {}),
      };
    }
    if (bg.type === 'image' && bg.imageUrl) {
      return {
        backgroundImage: `url(${bg.imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        ...(bg.strokeColor && (bg.strokeWidth ?? 0) > 0 ? { border: `${bg.strokeWidth}px solid ${bg.strokeColor}` } : {}),
      };
    }
    return {};
  };

  // Render a single block with template styling
  const renderBlock = (block: typeof blocks[0], blockIndex: number) => {
    const bgStyle: React.CSSProperties = {
      // Per-block override takes priority over slide-level radius
      borderRadius: (block as any).blockBorderRadius ?? blockRadius,
    };

    // Left border — explicit blockBorderLeft OR headingStyle left-border
    const hStyle = (block as any).headingStyle as string | undefined;
    const hColor = (block as any).headingStyleColor as string | undefined;
    if (hStyle === 'left-border') {
      bgStyle.borderLeft = `6px solid ${hColor || '#3b82f6'}`;
      bgStyle.paddingLeft = '12px';
    } else if ((block as any).blockBorderLeft) {
      bgStyle.borderLeft = (block as any).blockBorderLeft;
      bgStyle.paddingLeft = '12px';
    }
    
    // Use block background if set, otherwise template color
    if (block.background?.type === 'color' && block.background.color) {
      bgStyle.backgroundColor = block.background.color === 'transparent' ? 'transparent' : block.background.color;
    } else if (block.background?.type === 'image' && block.background.imageUrl) {
      bgStyle.backgroundImage = `url(${block.background.imageUrl})`;
      bgStyle.backgroundSize = 'cover';
      bgStyle.backgroundPosition = 'center';
    } else if (blockColors[blockIndex % blockColors.length]) {
      bgStyle.backgroundColor = blockColors[blockIndex % blockColors.length];
    }

    if (block.background?.strokeColor && (block.background.strokeWidth ?? 0) > 0) {
      bgStyle.border = `${block.background.strokeWidth}px solid ${block.background.strokeColor}`;
    }

    const textAlignClass = block.textAlign === 'center' ? 'text-center' : block.textAlign === 'right' ? 'text-right' : 'text-left';
    const verticalAlignClass = block.verticalAlign === 'middle' ? 'justify-center' : block.verticalAlign === 'bottom' ? 'justify-end' : 'justify-start';
    // Use cqw (container query width) for consistent sizing relative to container
    const fontSize = block.fontSize === 'xxlarge' ? 'clamp(64px, 9cqw, 120px)' :
                     block.fontSize === 'xlarge' ? 'clamp(48px, 6.5cqw, 80px)' : 
                     block.fontSize === 'large' ? 'clamp(32px, 4.5cqw, 54px)' : 
                     block.fontSize === 'small' ? 'clamp(16px, 2.2cqw, 24px)' :
                     block.fontSize === 'xsmall' ? 'clamp(12px, 1.5cqw, 16px)' : 'clamp(22px, 3cqw, 36px)';
    
    const blockFontFamilyMap: Record<string, string> = {
      fenomen: '"Fenomen Sans", ui-sans-serif, system-ui, sans-serif',
      cooper: '"Cooper Light", serif',
      space: '"Space Grotesk", sans-serif',
      sora: '"Sora", sans-serif',
      playfair: '"Playfair Display", serif',
      itim: '"Itim", cursive',
      sacramento: '"Sacramento", cursive',
      lora: '"Lora", serif',
      oswald: '"Oswald", sans-serif',
      visby: '"Visby Round", ui-sans-serif, sans-serif',
      vividscript: '"Vividbooks Script", cursive',
    };
    // Get the font family - use block's fontFamily if set, otherwise default to fenomen
    const actualFontFamily = block.fontFamily && blockFontFamilyMap[block.fontFamily] 
      ? blockFontFamilyMap[block.fontFamily] 
      : blockFontFamilyMap.fenomen;
    
    // Cooper Light must never be rendered as bold (it's a display font, only light weight exists)
    const isCooper = block.fontFamily === 'cooper';
    const fontWeightClass = (!isCooper && block.fontWeight === 'bold') ? 'font-bold' : 'font-normal';
    const fontStyleClass = block.fontStyle === 'italic' ? 'italic' : '';
    const textDecorationClass = block.textDecoration === 'underline' ? 'underline' : '';

    if (block.type === 'image' && (isRenderableLinkUrl(block.content) || (block.gallery && block.gallery.length > 0))) {
      return (
        <div className="h-full w-full overflow-hidden relative" style={bgStyle}>
          <ImageBlockPreview block={block} borderRadius={Math.max(0, blockRadius - 4)} />
          {block.ttsEnabled && <TTSButton block={block} />}
        </div>
      );
    }

    if (block.type === 'lottie' && isRenderableLinkUrl(block.lottieUrl || block.content)) {
      return (
        <div className="h-full w-full overflow-hidden relative" style={bgStyle}>
          <LottieBlockPreview url={block.lottieUrl || block.content} loop={block.lottieLoop} autoplay={block.lottieAutoplay} />
        </div>
      );
    }

    // Backward compat: old blocks saved with type='html' before the linkMode refactor
    if ((block as any).type === 'html') {
      return (
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: blockRadius, ...bgStyle }}>
          {block.content ? (
            <ScaledHtmlBlock html={block.content} mode="contain" padding={20} />
          ) : null}
        </div>
      );
    }

    // Table block — fills the full slide block area in preview/playback
    if (block.type === 'table') {
      const data = block.tableData ?? { html: '' };
      return <ReadOnlyTableBlock data={data} bgStyle={bgStyle} />;
    }

    // Chart block — interactive chart with data table on click
    if (block.type === 'chart') {
      return <ChartBlock block={block} blockRadius={blockRadius} bgStyle={bgStyle} />;
    }

    // Map block — interactive map
    if (block.type === 'map' && block.mapData) {
      return (
        <div style={{ width: '100%', height: '100%', borderRadius: blockRadius, overflow: 'hidden', ...bgStyle }}>
          <VividMapPreview map={block.mapData} />
        </div>
      );
    }

    // Backward compat: old blocks saved with type='html' (before linkMode refactor)
    if ((block as any).type === 'html') {
      return (
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: blockRadius, ...bgStyle }}>
          {block.content ? (
            <ScaledHtmlBlock html={block.content} mode="contain" padding={20} />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">HTML blok</div>
          )}
        </div>
      );
    }

    if (block.type === 'link' && (block.linkMode === 'html' || block.linkMode === 'svg' || isRenderableLinkUrl(block.content))) {
      const mode = block.linkMode || 'button';
      const url = normalizeLinkUrl(block.content);

      // HTML (1:1) embed — scale captured worksheet HTML to fill the slide
      if (mode === 'html') {
        return (
          <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: blockRadius, ...bgStyle }}>
            {url ? (
              <ScaledHtmlBlock html={url} mode="contain" padding={20} />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">HTML blok</div>
            )}
          </div>
        );
      }

      // SVG / Figma embed — renders inline SVG filling the block
      if (mode === 'svg') {
        return (
          <div
            style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: blockRadius, display: 'flex', alignItems: 'center', justifyContent: 'center', ...bgStyle }}
          >
            {url ? (
              <div
                style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                dangerouslySetInnerHTML={{ __html: url }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">SVG blok</div>
            )}
          </div>
        );
      }

      // Wrap video/embed/preview in a relative container to ensure absolute children stay within bounds
      const RelativeWrapper = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
        <div className={`relative h-full w-full overflow-hidden ${className}`} style={{ ...bgStyle, borderRadius: blockRadius }}>
          {children}
        </div>
      );

      switch (mode) {
        case 'qr':
          return (
            <div className="h-full w-full flex items-center justify-center p-4" style={bgStyle}>
              <div 
                className="w-full h-full max-w-full max-h-full flex items-center justify-center bg-white shadow-sm border border-slate-100 p-4 overflow-hidden"
                style={{ borderRadius: blockRadius }}
              >
                <QRCodeSVG 
                  value={url} 
                  size={1000}
                  style={{ width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%' }}
                  level="H" 
                  includeMargin={true} 
                />
              </div>
            </div>
          );

        case 'video':
          const getYoutubeId = (url: string) => {
            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
            const match = url.match(regExp);
            return (match && match[2].length === 11) ? match[2] : null;
          };
          const videoId = getYoutubeId(url);
          if (videoId) {
            return (
              <RelativeWrapper className="bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=0`}
                  className="absolute inset-0 w-full h-full border-none"
                  title="YouTube video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </RelativeWrapper>
            );
          }
          break;

        case 'embed':
          return (
            <RelativeWrapper className="bg-slate-50">
              <iframe
                src={url}
                className="absolute inset-0 w-full h-full border-none"
                title="Embedded content"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </RelativeWrapper>
          );

        case 'preview':
          return (
            <RelativeWrapper className="bg-white">
              <div 
                className="h-full w-full flex flex-col cursor-pointer group shadow-sm hover:shadow-md transition-shadow" 
                onClick={() => window.open(url, '_blank')}
              >
                {block.linkThumbnail ? (
                  <div className="flex-1 min-h-0 bg-slate-100 overflow-hidden">
                    <img src={block.linkThumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 flex items-center justify-center bg-slate-50">
                    <Globe className="w-12 h-12 text-slate-200" />
                  </div>
                )}
                <div className="p-4 flex flex-col gap-1 shrink-0">
                  <h4 className="font-bold text-slate-800 truncate line-clamp-1">
                    {block.linkTitle || 'Náhled odkazu'}
                  </h4>
                  {block.linkDescription && (
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {block.linkDescription}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-1.5 text-blue-600 font-medium text-[10px] uppercase tracking-wider">
                    <ExternalLink className="w-3 h-3" />
                    <span>Otevřít stránku</span>
                  </div>
                </div>
              </div>
            </RelativeWrapper>
          );

        case 'button':
        default:
      return (
        <div className="h-full flex items-center justify-center p-4" style={bgStyle}>
              <button
                onClick={() => window.open(url, '_blank')}
                className="group flex flex-col items-center gap-3 p-6 rounded-2xl transition-all hover:scale-105 active:scale-95 text-white"
                style={{
                  backgroundColor: slide.templateId ? getTemplateById(slide.templateId)?.colors.primary : '#4f46e5',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                }}
              >
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center transition-colors group-hover:bg-white/30">
                  <ExternalLink className="w-6 h-6" />
                </div>
                <span className="text-lg font-bold tracking-tight">
                  {block.linkTitle || 'Přejít na odkaz'}
                </span>
              </button>
        </div>
      );
      }
    }

    // Text block
    const textStyle: React.CSSProperties = {
      fontSize,
      fontFamily: actualFontFamily,
      color: block.textColor || '#1e293b',
    };
    
    // Background: use highlight if set, otherwise block background
    const blockBgColor = block.highlightColor && block.highlightColor !== 'transparent' 
      ? block.highlightColor 
      : bgStyle.backgroundColor;
    
    // For 'fit' mode, calculate font size based on container (desktop only)
    const TextContent = ({ theFontFamily }: { theFontFamily: string }) => {
      const containerRef = React.useRef<HTMLDivElement>(null);
      const [fitFontSize, setFitFontSize] = React.useState<number | null>(null);
      const [isFitMeasured, setIsFitMeasured] = React.useState(false);

      const calculateFitSize = React.useCallback(() => {
        // On mobile, don't calculate - use large readable sizes
        if (isMobile) {
          setIsFitMeasured(true);
          return;
        }
        
        // Default to 'fit' if not explicitly set to 'scroll'
        const isFitMode = block.textOverflow === 'fit' || block.textOverflow === undefined;
        if (!isFitMode || !containerRef.current || !block.content) {
          setIsFitMeasured(true);
          return;
        }
        
        const container = containerRef.current;
        // Use dynamic textPadding (default 20px on each side)
        const padding = (block.textPadding ?? 20) * 2;
        const targetHeight = (container.clientHeight - padding) * 0.85; // 85% of available height
        const containerWidth = container.clientWidth - padding - 2; // extra 2px buffer for rounding

        if (targetHeight <= 0 || containerWidth <= 0) return;

        // Can go up to 200px for short text in large blocks
        let minSize = 8;
        let maxSize = 200;
        
        const measureEl = document.createElement('div');
        measureEl.style.cssText = `
          position: absolute;
          visibility: hidden;
          white-space: pre-wrap;
          overflow-wrap: normal;
          word-break: normal;
          hyphens: none;
          width: ${containerWidth}px;
          font-family: ${theFontFamily};
          font-weight: ${block.fontWeight === 'bold' ? 'bold' : 'normal'};
          font-style: ${block.fontStyle === 'italic' ? 'italic' : 'normal'};
          line-height: ${block.lineHeight ?? 1.5};
          letter-spacing: ${block.letterSpacing ?? 0}px;
          box-sizing: border-box;
        `;
        // Strip HTML tags so only visible text affects measurement
        measureEl.textContent = block.content.replace(/<[^>]+>/g, '');
        document.body.appendChild(measureEl);

        let optimalSize = minSize;
        while (minSize <= maxSize) {
          const midSize = Math.floor((minSize + maxSize) / 2);
          measureEl.style.fontSize = `${midSize}px`;
          
          // Check both height AND width (for single words that might be too wide)
          const fitsHeight = measureEl.scrollHeight <= targetHeight;
          const fitsWidth = measureEl.scrollWidth <= containerWidth;
          
          if (fitsHeight && fitsWidth) {
            optimalSize = midSize;
            minSize = midSize + 1;
          } else {
            maxSize = midSize - 1;
          }
        }

        document.body.removeChild(measureEl);
        setFitFontSize(optimalSize);
        setIsFitMeasured(true);
      }, [isMobile, theFontFamily, block.content, block.textOverflow, block.textPadding, block.lineHeight, block.letterSpacing]);

      // Initial calculation and recalculate on any relevant change
      // Wrap in fonts.ready so we always measure with the actual loaded font (not fallback)
      React.useLayoutEffect(() => {
        if (isMobile) {
          setIsFitMeasured(true);
          return;
        }
        setIsFitMeasured(false);
        calculateFitSize();
      }, [calculateFitSize, block.content, block.textPadding, block.lineHeight, block.letterSpacing, isMobile]);

      React.useEffect(() => {
        if (isMobile) return;
        setIsFitMeasured(false);
        document.fonts.ready.then(() => calculateFitSize());
      }, [calculateFitSize, block.content, block.textPadding, block.lineHeight, block.letterSpacing, isMobile]);

      // ResizeObserver for real-time updates (desktop only)
      React.useEffect(() => {
        if (isMobile) return;
        const isFitMode = block.textOverflow === 'fit' || block.textOverflow === undefined;
        if (!isFitMode || !containerRef.current) return;

        const resizeObserver = new ResizeObserver(() => {
          calculateFitSize();
        });

        resizeObserver.observe(containerRef.current);

        return () => {
          resizeObserver.disconnect();
        };
      }, [calculateFitSize, isMobile, block.textPadding]);

      // On mobile: use large readable font sizes for 'fit' mode
      // On desktop: use fit calculation or scroll based on setting
      const isFitMode = block.textOverflow === 'fit' || block.textOverflow === undefined;
      const hasScroll = isMobile || block.textOverflow === 'scroll';
      
      // Mobile font sizes - LARGE and readable for 'fit' mode (auto)
      // These scale based on content length for better readability
      const contentLength = block.content?.length || 0;
      const getMobileFitSize = () => {
        if (contentLength < 20) return '72px';  // Very short text - huge
        if (contentLength < 50) return '56px';  // Short text - large
        if (contentLength < 100) return '42px'; // Medium text
        if (contentLength < 200) return '32px'; // Longer text
        return '24px'; // Long text
      };
      
      const mobileFontSize = isFitMode 
        ? getMobileFitSize()
        : (block.fontSize === 'xxlarge' ? '64px' :
           block.fontSize === 'xlarge' ? '48px' : 
           block.fontSize === 'large' ? '32px' : 
           block.fontSize === 'small' ? '16px' :
           block.fontSize === 'xsmall' ? '12px' : '24px');
      
      const finalFontSize = isMobile 
        ? mobileFontSize 
        : (isFitMode && fitFontSize ? `${fitFontSize}px` : textStyle.fontSize);
      const contentVisibilityStyle: React.CSSProperties =
        !isMobile && isFitMode && !isFitMeasured
          ? { opacity: 0, pointerEvents: 'none' }
          : { opacity: 1 };
      
      return (
        <div 
          ref={containerRef}
          className={`w-full flex flex-col ${textAlignClass} ${verticalAlignClass} ${fontWeightClass} ${fontStyleClass} ${textDecorationClass}`} 
          style={{
            ...bgStyle,
            backgroundColor: blockBgColor,
            fontSize: finalFontSize,
            color: textStyle.color,
            fontFamily: theFontFamily,
            whiteSpace: 'pre-wrap',
            // break-word: normal wrapping at spaces; only splits a word as last resort (e.g. URLs)
            // Avoids both mid-word breaks (anywhere) and horizontal overflow clipping (normal)
            overflowWrap: 'break-word',
            wordBreak: 'normal',
            hyphens: 'none',
            lineHeight: block.lineHeight ?? 1.5,
            letterSpacing: `${block.letterSpacing ?? 0}px`,
            // On mobile: cap padding at 16px to prevent text overflow
            padding: isMobile 
              ? `${Math.min(block.textPadding ?? 20, 16)}px` 
              : `${block.textPadding ?? 20}px`,
            // On mobile: flex-grow to fill parent (for vertical alignment)
            // On desktop: fixed height with scroll or fit
            height: isMobile ? '100%' : '100%',
            flex: isMobile ? 1 : undefined,
            minHeight: isMobile ? 'auto' : undefined,
            // Pill style needs visible overflow so the rounded box isn't clipped
            overflowY: (hStyle === 'pill') ? 'visible' : (isMobile ? 'visible' : (hasScroll ? 'auto' : 'hidden')),
            overflowX: hStyle === 'pill' ? 'visible' : 'hidden',
            // Always show scrollbar when scrollable
            scrollbarWidth: hasScroll && !isMobile ? 'thin' : undefined,
            scrollbarColor: hasScroll && !isMobile ? '#cbd5e1 transparent' : undefined,
          }}
        >
          {(block as any).contentFormat === 'html' ? (
            <div
              style={{ width: '100%', overflowWrap: 'break-word', wordBreak: 'normal', fontFamily: theFontFamily, ...contentVisibilityStyle }}
              dangerouslySetInnerHTML={{ __html: block.content || '' }}
            />
          ) : hStyle === 'pill' ? (
            <div style={{ width: '100%', textAlign: block.textAlign || 'center', fontFamily: theFontFamily, overflow: 'visible', ...contentVisibilityStyle }}>
              <span style={{
                display: 'inline-block',
                backgroundColor: hColor || '#e0f2fe',
                padding: '6px 20px',
                borderRadius: '10px',
              }}>
                <MathText style={{ fontFamily: theFontFamily }}>{block.content}</MathText>
              </span>
            </div>
          ) : (
            <div style={contentVisibilityStyle}>
              <MathText style={{ fontFamily: theFontFamily }}>{block.content}</MathText>
            </div>
          )}
        </div>
      );
    };

    if (block.ttsEnabled) {
      return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <TextContent theFontFamily={actualFontFamily} key={`text-${blockIndex}-${block.fontFamily || 'fenomen'}`} />
          <TTSButton block={block} />
        </div>
      );
    }
    return <TextContent theFontFamily={actualFontFamily} key={`text-${blockIndex}-${block.fontFamily || 'fenomen'}`} />;
  };

  // DESKTOP LAYOUT - exact proportions from editor
  const renderDesktopLayout = () => {
    const gapStyle = { gap: blockGap };
    const halfGap = blockGap / 2;
    const twoThirdsGap = blockGap * 2 / 3;
    
    switch (layout.type) {
      case 'single':
        return (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>{renderBlock(blocks[0], 0)}</div>
          </div>
        );

      case 'title-content':
        return (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', ...gapStyle }}>
            <div style={{ flex: `0 0 calc(${titleHeight}% - ${halfGap}px)`, minHeight: 60 }}>{renderBlock(blocks[0], 0)}</div>
            <div style={{ flex: 1, minHeight: 0 }}>{renderBlock(blocks[1], 1)}</div>
          </div>
        );

      case 'title-2cols':
        return (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', ...gapStyle }}>
            <div style={{ flex: `0 0 calc(${titleHeight}% - ${halfGap}px)`, minHeight: 60 }}>{renderBlock(blocks[0], 0)}</div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'row', minHeight: 0, ...gapStyle }}>
              <div style={{ flex: `0 0 calc(${columnRatios[0]}% - ${halfGap}px)`, minHeight: 0, minWidth: 0 }}>{renderBlock(blocks[1], 1)}</div>
              <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>{renderBlock(blocks[2], 2)}</div>
            </div>
          </div>
        );

      case 'title-3cols':
        return (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', ...gapStyle }}>
            <div style={{ flex: `0 0 calc(${titleHeight}% - ${halfGap}px)`, minHeight: 60 }}>{renderBlock(blocks[0], 0)}</div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'row', minHeight: 0, ...gapStyle }}>
              <div style={{ flex: `0 0 calc(${columnRatios[0]}% - ${twoThirdsGap}px)`, minHeight: 0, minWidth: 0 }}>{renderBlock(blocks[1], 1)}</div>
              <div style={{ flex: `0 0 calc(${columnRatios[1]}% - ${twoThirdsGap}px)`, minHeight: 0, minWidth: 0 }}>{renderBlock(blocks[2], 2)}</div>
              <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>{renderBlock(blocks[3], 3)}</div>
            </div>
          </div>
        );

      case '2cols':
        return (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'row', ...gapStyle }}>
            <div style={{ flex: `0 0 calc(${columnRatios[0]}% - ${halfGap}px)`, minHeight: 0, minWidth: 0 }}>{renderBlock(blocks[0], 0)}</div>
            <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>{renderBlock(blocks[1], 1)}</div>
          </div>
        );

      case '3cols':
        return (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'row', ...gapStyle }}>
            <div style={{ flex: `0 0 calc(${columnRatios[0]}% - ${twoThirdsGap}px)`, minHeight: 0, minWidth: 0 }}>{renderBlock(blocks[0], 0)}</div>
            <div style={{ flex: `0 0 calc(${columnRatios[1]}% - ${twoThirdsGap}px)`, minHeight: 0, minWidth: 0 }}>{renderBlock(blocks[1], 1)}</div>
            <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>{renderBlock(blocks[2], 2)}</div>
          </div>
        );

      case 'left-large-right-split':
        return (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'row', ...gapStyle }}>
            <div style={{ flex: `0 0 calc(${columnRatios[0]}% - ${halfGap}px)`, minHeight: 0, minWidth: 0 }}>{renderBlock(blocks[0], 0)}</div>
            <div style={{ flex: `0 0 calc(${columnRatios[1]}% - ${halfGap}px)`, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, ...gapStyle }}>
              <div style={{ flex: `0 0 calc(${splitRatio}% - ${halfGap}px)`, minHeight: 0 }}>{renderBlock(blocks[1], 1)}</div>
              <div style={{ flex: 1, minHeight: 0 }}>{renderBlock(blocks[2], 2)}</div>
            </div>
          </div>
        );

      case 'right-large-left-split':
        return (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'row', ...gapStyle }}>
            <div style={{ flex: `0 0 calc(${columnRatios[0]}% - ${halfGap}px)`, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, ...gapStyle }}>
              <div style={{ flex: `0 0 calc(${splitRatio}% - ${halfGap}px)`, minHeight: 0 }}>{renderBlock(blocks[0], 0)}</div>
              <div style={{ flex: 1, minHeight: 0 }}>{renderBlock(blocks[1], 1)}</div>
            </div>
            <div style={{ flex: `0 0 calc(${columnRatios[1]}% - ${halfGap}px)`, minHeight: 0, minWidth: 0 }}>{renderBlock(blocks[2], 2)}</div>
          </div>
        );

      default:
        return null;
    }
  };

  // MOBILE LAYOUT - simple vertical stack, scrollable
  // Special case: single block with image should be vertically centered
  const renderMobileLayout = () => {
    // Check if this is a single block with an image - if so, center it vertically
    const isSingleImageBlock = blocks.length === 1 && (blocks[0].type === 'image' || blocks[0].type === 'lottie');
    
    if (isSingleImageBlock) {
      const block = blocks[0];
      const imageScale = block.imageScale || 100;
      const imageFit = imageScale > 100 ? 'cover' : (block.imageFit || 'contain');
      const posX = block.imagePositionX ?? 50;
      const posY = block.imagePositionY ?? 50;
      const hasGallery = block.gallery && block.gallery.length > 1;
      const currentImage = (hasGallery && block.gallery) ? block.gallery[0] : block.content;
      
      // Full height centered layout for single image/lottie - minimal padding for max image size
      return (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          width: '100%',
          padding: 8, // Minimal padding for largest possible image
        }}>
          {block.type === 'image' ? (
            <img
              src={currentImage}
              alt={block.imageCaption || ''}
              style={{
                maxWidth: '100%',
                maxHeight: 'calc(100vh - 200px)',
                objectFit: imageFit as any,
                objectPosition: imageFit === 'cover' ? `${posX}% ${posY}%` : undefined,
                borderRadius: blockRadius,
              }}
            />
          ) : (
            <div style={{ 
              width: '100%', 
              maxWidth: '400px',
              aspectRatio: '1',
            }}>
              <LottieBlockPreview 
                url={block.lottieUrl || block.content} 
                loop={block.lottieLoop} 
                autoplay={block.lottieAutoplay} 
              />
            </div>
          )}
          {block.imageCaption && (
            <div className="mt-3 text-center text-sm text-slate-600 px-4">
              {block.imageCaption}
            </div>
          )}
        </div>
      );
    }
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: blockGap }}>
        {blocks.map((block, index) => {
          // For text blocks with vertical alignment, use minHeight to allow alignment to work
          const hasVerticalAlign = block.type === 'text' && block.verticalAlign && block.verticalAlign !== 'top';
          const textMinHeight = hasVerticalAlign ? 300 : 60;
          
          // For link blocks with embed/video/preview mode, need explicit height for iframe
          // Use most of viewport height for better mobile experience
          const isEmbedLink = block.type === 'link' && ['embed', 'video', 'preview', 'html'].includes(block.linkMode || '');
          const linkHeight = isEmbedLink ? 'calc(100vh - 120px)' : 'auto';
          
          // Determine block height
          let blockHeight: number | string = 'auto';
          if (block.type === 'image' || block.type === 'lottie') {
            blockHeight = 250;
          } else if (isEmbedLink) {
            blockHeight = linkHeight;
          }
          
          return (
            <div 
              key={index} 
              style={{ 
                height: blockHeight,
                minHeight: block.type === 'text' ? textMinHeight : undefined,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {renderBlock(block, index)}
            </div>
          );
        })}
      </div>
    );
  };

  // Desktop: full height with aspect ratio, Mobile: auto height scrollable
  if (isMobile) {
    // Check if this is a single block with an image - if so, we need full height for centering
    const isSingleImageBlock = blocks.length === 1 && (blocks[0].type === 'image' || blocks[0].type === 'lottie');
    
    if (isSingleImageBlock) {
      // For single image blocks, use flex to fill entire available space
      return (
        <div 
          style={{ 
            ...getSlideBackgroundStyle(), 
            fontFamily,
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: '100%',
          }}
        >
          {renderMobileLayout()}
        </div>
      );
    }
    
    return (
      <div 
        style={{ 
          ...getSlideBackgroundStyle(), 
          padding: blockGap > 0 ? blockGap : 0,
          fontFamily,
        }}
      >
        {renderMobileLayout()}
      </div>
    );
  }

  return (
    <div 
      style={{ 
        ...getSlideBackgroundStyle(), 
        padding: blockGap > 0 ? blockGap : 0,
        fontFamily,
        containerType: 'inline-size',
        height: '100%',
      }}
    >
      {renderDesktopLayout()}
    </div>
  );
}
