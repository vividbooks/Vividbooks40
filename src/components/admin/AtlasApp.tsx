/**
 * AtlasApp – interaktivní mapový průzkumník pro admin
 *
 * Funkce:
 *   - Fullscreen mapa (VividMap)
 *   - Levý panel: region, styl, vrstvy, WWF biomy, AI asistent
 *   - Klik na "Upravit v editoru" → MapEditorModal
 *   - Ukládání / načítání konfigurací map do localStorage
 */

import React, { useState, useCallback } from 'react';
import {
  Globe, Wand2, ChevronLeft, ChevronRight, ChevronDown,
  Save, FolderOpen, Plus, Trash2, Eye, Pencil,
  Map, Layers, Target, Zap, Clock,
} from 'lucide-react';
import { toast } from 'sonner';

import { QuizMap, HIST_EPOCHS } from '../shared/QuizMap';
import { MapEditorModal } from './MapEditorModal';
import type {
  SavedMap, MapRegionId, MapStyle, ThematicLayer,
} from '../../types/topic-dataset';

// ─── WWF biomy ────────────────────────────────────────────────────────────────
const WWF_BIOMES: { num: number; label: string; color: string; examples: string[] }[] = [
  { num: 1,  label: 'Tropické deštné pralesy',         color: '#2d6a4f', examples: ['Amazon', 'Congo', 'Borneo', 'Sumatra'] },
  { num: 2,  label: 'Tropické suché lesy',              color: '#95d5b2', examples: ['Caatinga', 'Chiquitano dry forests'] },
  { num: 3,  label: 'Tropické jehličnaté lesy',         color: '#52b788', examples: ['Mexican pine-oak forests'] },
  { num: 4,  label: 'Mírné listnaté a smíšené lesy',   color: '#40916c', examples: ['European temperate forests', 'Appalachian forests'] },
  { num: 5,  label: 'Mírné jehličnaté lesy',            color: '#1b4332', examples: ['Pacific temperate rainforests', 'Alps conifer forests'] },
  { num: 6,  label: 'Boreální lesy / Tajga',            color: '#081c15', examples: ['East Siberian taiga', 'Canadian boreal forests'] },
  { num: 7,  label: 'Tropické savany a louky',          color: '#e9c46a', examples: ['Serengeti', 'Cerrado', 'Miombo woodlands'] },
  { num: 8,  label: 'Mírné stepi a louky',              color: '#f4a261', examples: ['Kazakh steppe', 'Pampas', 'Great Plains'] },
  { num: 9,  label: 'Zaplavované louky',                color: '#219ebc', examples: ['Pantanal flooded savannas', 'Saharan flooded'] },
  { num: 10, label: 'Horské louky a keříky',            color: '#8ecae6', examples: ['Tibetan Plateau alpine', 'Andes'] },
  { num: 11, label: 'Tundra',                           color: '#caf0f8', examples: ['Arctic tundra', 'Beringia'] },
  { num: 12, label: 'Středomořský biom',                color: '#e76f51', examples: ['Mediterranean Basin', 'California', 'Chilean matorral'] },
  { num: 13, label: 'Pouště a xerofytní křoví',         color: '#f3d5b5', examples: ['Sahara', 'Arabian Desert', 'Gobi', 'Atacama'] },
  { num: 14, label: 'Mangrovníky',                      color: '#023e8a', examples: ['Sundarbans', 'Florida mangroves'] },
];

const REGION_LABELS: Record<MapRegionId, string> = {
  world: 'Svět', europe: 'Evropa', 'central-europe': 'Střední Evropa',
  mediterranean: 'Středomoří', 'middle-east': 'Střední Východ',
  africa: 'Afrika', asia: 'Asie', americas: 'Amerika',
  'czech-republic': 'Česká republika', italy: 'Itálie', greece: 'Řecko',
  france: 'Francie', germany: 'Německo', custom: 'Vlastní',
};

const STYLE_LABELS: Record<string, string> = {
  political:  '🗺️ Politická',
  physical:   '⛰️ Fyzická',
  blank:      '⬜ Slepá',
  blank_pure: '🔲 Čistá slepá',
  historical: '📜 Historická',
  satellite:  '🛰️ Satelitní',
  dark:       '🌑 Tmavá',
};

const STYLE_DESCS: Record<string, string> = {
  political:  'CartoDB – silnice, parky',
  physical:   'OpenTopoMap – terén, výšky',
  blank:      'ESRI Gray – jen pevnina/moře',
  blank_pure: 'GeoJSON – nulový detail',
  historical: 'CartoDB Voyager',
  satellite:  'Esri World Imagery',
  dark:       'CartoDB tmavá',
};


// ─── Výchozí prázdná mapa ─────────────────────────────────────────────────────
function createDefaultMap(): SavedMap {
  return {
    id: crypto.randomUUID(),
    title: 'Nová mapa',
    region: 'world',
    style: 'political',
    exerciseType: 'info',
    markers: [],
    highlights: [],
    routes: [],
    areas: [],
  };
}

// ─── LocalStorage helpers ─────────────────────────────────────────────────────
const LS_KEY = 'atlas-saved-maps';
function loadSavedMaps(): SavedMap[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function persistMaps(maps: SavedMap[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(maps));
}

// ─── Hlavní komponenta ────────────────────────────────────────────────────────
export function AtlasApp() {
  const [map, setMap] = useState<SavedMap>(createDefaultMap);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [savedMaps, setSavedMaps] = useState<SavedMap[]>(loadSavedMaps);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedBiomes, setSelectedBiomes] = useState<Set<number>>(new Set());

  const [quizMode, setQuizMode] = useState(false);
  const [quizHistYear, setQuizHistYear] = useState<string | undefined>(undefined);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    region: true, basemap: true, layers: true, biomes: false, ai: false, saved: false,
  });

  const patch = useCallback((p: Partial<SavedMap>) => setMap(prev => ({ ...prev, ...p })), []);

  // ── Přidat / odebrat WWF biom ──────────────────────────────────────────────
  const toggleBiome = (biomeNum: number) => {
    setSelectedBiomes(prev => {
      const next = new Set(prev);
      if (next.has(biomeNum)) {
        next.delete(biomeNum);
      } else {
        next.add(biomeNum);
      }

      // Rebuild thematicLayer z vybraných biomů
      if (next.size === 0) {
        setMap(m => ({ ...m, thematicLayer: undefined }));
        return next;
      }

      const categories = [...next].map(num => {
        const biome = WWF_BIOMES.find(b => b.num === num)!;
        return {
          color: biome.color,
          label: biome.label,
          // Feature names = číslo biomu jako string (filtrujeme přes BIOME field)
          featureNames: [String(num)],
        };
      });

      setMap(m => ({
        ...m,
        thematicLayer: {
          title: 'WWF Ekoregiony',
          dataset: 'wwf_ecoregions',
          categories,
        } as ThematicLayer,
        choropleth: undefined,
        areas: m.areas || [],
      }));

      return next;
    });
  };

  // ── AI generátor ──────────────────────────────────────────────────────────
  const handleAi = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const { chatWithAIProxy } = await import('../../utils/ai-chat-proxy');
      const prompt = `Jsi kartograf. Vygeneruj konfiguraci vzdělávací mapy na základě požadavku.

Požadavek: "${aiPrompt}"

Dostupné regiony: world, europe, central-europe, mediterranean, middle-east, africa, asia, americas, czech-republic
Dostupné styly: political, physical, blank, historical
Dostupné datasety: ne_regions (Natural Earth fyzické regiony), ne_glaciers, ne_marine, wwf_ecoregions (WWF ekoregiónů)

Vrať POUZE JSON:
{
  "title": "Název mapy",
  "region": "world",
  "style": "political",
  "thematicLayer": {
    "title": "...",
    "dataset": "ne_regions",
    "categories": [
      {"color": "#2d6a4f", "label": "...", "featureNames": ["Amazon basin", "..."]}
    ]
  },
  "markers": [
    {"id": "m1", "name": "...", "lat": 0, "lng": 0, "type": "city", "color": "#6366f1", "icon": "🏙️"}
  ]
}

Pokud thematicLayer není potřeba, vynech ho. Stejně pro markers.`;

      const resp = await chatWithAIProxy([{ role: 'user', content: prompt }], 'gemini-3-pro');
      const m = resp.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('Nenalezen JSON');
      let cleaned = m[0].replace(/,\s*([}\]])/g, '$1').replace(/\/\/[^\n]*/g, '');
      const parsed = JSON.parse(cleaned);

      setMap(prev => ({
        ...prev,
        id: prev.id,
        title: parsed.title || prev.title,
        region: parsed.region || prev.region,
        style: parsed.style || prev.style,
        thematicLayer: parsed.thematicLayer || undefined,
        markers: parsed.markers || prev.markers,
        choropleth: undefined,
        areas: prev.areas || [],
        highlights: prev.highlights || [],
        routes: prev.routes || [],
        exerciseType: 'info',
      }));

      // Sync selected biomes
      if (parsed.thematicLayer?.dataset === 'wwf_ecoregions') {
        const nums = new Set<number>(
          (parsed.thematicLayer.categories || [])
            .flatMap((c: any) => c.featureNames.map((n: string) => parseInt(n)).filter(Boolean))
        );
        setSelectedBiomes(nums);
      } else {
        setSelectedBiomes(new Set());
      }

      setAiPrompt('');
      toast.success('Mapa vygenerována');
    } catch (e) {
      toast.error('AI chyba: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setAiLoading(false);
    }
  };

  // ── Uložit mapu ───────────────────────────────────────────────────────────
  const saveMap = () => {
    const updated = savedMaps.filter(m => m.id !== map.id);
    const next = [{ ...map }, ...updated];
    setSavedMaps(next);
    persistMaps(next);
    toast.success(`Mapa "${map.title}" uložena`);
  };

  const deleteMap = (id: string) => {
    const next = savedMaps.filter(m => m.id !== id);
    setSavedMaps(next);
    persistMaps(next);
  };

  const newMap = () => {
    setMap(createDefaultMap());
    setSelectedBiomes(new Set());
  };

  // ─── Render helpers ──────────────────────────────────────────────────────
  const mapHeight = typeof window !== 'undefined' ? window.innerHeight : 700;

  const toggleSection = (id: string) =>
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));

  const SectionHeader = ({ id, label, icon, badge }: { id: string; label: string; icon: React.ReactNode; badge?: number }) => (
    <button
      onClick={() => toggleSection(id)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        padding: '9px 14px', border: 'none', background: 'transparent',
        cursor: 'pointer', borderBottom: openSections[id] ? '1px solid #e2e8f0' : 'none',
        color: '#0f172a',
      }}
    >
      <span style={{ color: '#6366f1', display: 'flex' }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 700, flex: 1, textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#374151' }}>{label}</span>
      {badge != null && badge > 0 && (
        <span style={{ fontSize: 9, fontWeight: 800, background: '#6366f1', color: 'white', borderRadius: 99, padding: '1px 6px' }}>{badge}</span>
      )}
      <ChevronDown size={13} style={{ color: '#94a3b8', transform: openSections[id] ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
    </button>
  );

  // Počet aktivních vrstev
  const activeLayerCount = [
    map.overlays?.showRivers, map.overlays?.showLakes, map.overlays?.showOceans,
    map.overlays?.showPhysical, map.overlays?.showClimate, map.overlays?.showBiomes,
    map.overlays?.showTectonics, map.overlays?.showVolcanoes, map.overlays?.showEarthquakes,
    map.overlays?.showCities, map.overlays?.showAirports, map.overlays?.showRailroads, map.overlays?.showTimezones,
  ].filter(Boolean).length;

  const LayerToggle = ({ label, active, onClick, color = '#6366f1', desc }: {
    label: string; active: boolean; onClick: () => void; color?: string; desc?: string;
  }) => (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px',
      cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
      background: active ? `${color}08` : 'transparent',
      transition: 'background .1s',
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: 4, flexShrink: 0,
        border: `2px solid ${active ? color : '#cbd5e1'}`,
        background: active ? color : 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all .12s',
      }}>
        {active && <div style={{ width: 6, height: 6, borderRadius: 1, background: 'white' }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? color : '#374151' }}>{label}</div>
        {desc && <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>{desc}</div>}
      </div>
    </div>
  );

  const toggleQuizLayer = (key: string, val?: boolean) =>
    patch({ overlays: { ...(map.overlays ?? {}), [key]: val !== undefined ? val : !(map.overlays as any)?.[key] } });

  return (
    <div style={{ height: '100vh', display: 'flex', background: '#f1f5f9', overflow: 'hidden' }}>

      {/* ════════════════════════════════════════════════════════════
          LEVÝ PANEL — hlavní ovládací centrum
      ════════════════════════════════════════════════════════════ */}
      <div style={{
        width: sidebarOpen ? 300 : 0,
        flexShrink: 0, flexGrow: 0,
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
        background: '#fff',
        borderRight: '1px solid #e2e8f0',
        display: 'flex', flexDirection: 'column',
        boxShadow: sidebarOpen ? '2px 0 12px rgba(0,0,0,0.06)' : 'none',
        zIndex: 10,
      }}>
        {sidebarOpen && (
          <>
            {/* ── Hlavička panelu ─────────────────────────────────── */}
            <div style={{
              padding: '14px 14px 12px',
              background: 'linear-gradient(135deg, #0f172a, #1e3a5f)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: 'linear-gradient(135deg, #3b82f6, #0ea5e9)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Globe size={15} color="white" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'white', lineHeight: 1 }}>Atlas Explorer</div>
                  <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>Mapový průzkumník</div>
                </div>
              </div>

              {/* Název mapy */}
              <input
                value={map.title}
                onChange={e => patch({ title: e.target.value })}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700,
                  color: 'white', marginBottom: 10,
                }}
                placeholder="Název mapy..."
              />

              {/* Akce */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={saveMap} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  padding: '6px', borderRadius: 7, background: '#22c55e', color: 'white',
                  border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                }}>
                  <Save size={12} /> Uložit
                </button>
                <button onClick={() => setEditModalOpen(true)} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  padding: '6px', borderRadius: 7, background: '#6366f1', color: 'white',
                  border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                }}>
                  <Pencil size={12} /> Editor
                </button>
                <button onClick={newMap} style={{
                  padding: '6px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.12)',
                  color: 'white', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer',
                }}>
                  <Plus size={13} />
                </button>
              </div>
            </div>

            {/* ── Přepínač módu ───────────────────────────────────── */}
            <div style={{
              display: 'flex', flexShrink: 0, borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc', padding: '8px 10px', gap: 6,
            }}>
              {([
                { id: false,  icon: <Map size={12}/>,    label: 'Vizualizace', desc: 'Tile mapa + vrstvy', color: '#0ea5e9' },
                { id: true,   icon: <Target size={12}/>, label: 'Kvíz',        desc: 'SVG mapa, klikání',  color: '#f59e0b' },
              ] as const).map(m => (
                <button key={String(m.id)} onClick={() => setQuizMode(m.id as boolean)}
                  style={{
                    flex: 1, padding: '7px 6px', borderRadius: 8, cursor: 'pointer', border: 'none',
                    background: quizMode === m.id ? `${m.color}18` : 'transparent',
                    outline: quizMode === m.id ? `2px solid ${m.color}` : '2px solid transparent',
                    transition: 'all .15s',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 2, color: quizMode === m.id ? m.color : '#64748b' }}>
                    {m.icon}
                    <span style={{ fontSize: 11, fontWeight: 800 }}>{m.label}</span>
                  </div>
                  <div style={{ fontSize: 9, color: '#94a3b8' }}>{m.desc}</div>
                </button>
              ))}
            </div>

            {/* ── Scrollovatelný obsah ─────────────────────────────── */}
            <div style={{ flex: 1, overflowY: 'auto' }}>

              {/* ── 1. REGION ──────────────────────────────────────── */}
              <SectionHeader id="region" label="Oblast / Region" icon={<Globe size={13}/>} />
              {openSections.region && (
                <div style={{ padding: '10px 14px 4px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {(Object.entries(REGION_LABELS) as [MapRegionId, string][]).map(([id, label]) => (
                    <button key={id} onClick={() => patch({ region: id })} style={{
                      padding: '4px 10px', borderRadius: 99, fontSize: 10, fontWeight: 600,
                      border: `1.5px solid ${map.region === id ? '#6366f1' : '#e2e8f0'}`,
                      background: map.region === id ? '#eef2ff' : '#f8fafc',
                      color: map.region === id ? '#4338ca' : '#475569',
                      cursor: 'pointer', transition: 'all .12s',
                    }}>{label}</button>
                  ))}
                </div>
              )}

              {/* ── 2. PODKLADOVÁ MAPA ─────────────────────────────── */}
              <SectionHeader id="basemap" label="Podkladová mapa" icon={<Layers size={13}/>} />
              {openSections.basemap && (
                <div style={{ paddingBottom: 8 }}>
                  {/* Moderní vs Historická */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '10px 14px 8px' }}>
                    {([
                      { id: 'blank_pure', label: '🔲 Moderní',    desc: 'SVG mapa dneška' },
                      { id: 'historical', label: '📜 Historická', desc: 'Historické státy' },
                    ] as const).map(s => {
                      const active = map.style === s.id;
                      return (
                        <button key={s.id} onClick={() => patch({ style: s.id })} style={{
                          padding: '9px 8px', borderRadius: 9, cursor: 'pointer',
                          border: `2px solid ${active ? '#6366f1' : '#e2e8f0'}`,
                          background: active ? '#eef2ff' : '#f8fafc',
                          textAlign: 'center', transition: 'all .14s',
                        }}>
                          <div style={{ fontSize: 18, marginBottom: 3 }}>{s.id === 'blank_pure' ? '🗺️' : '📜'}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: active ? '#4338ca' : '#374151' }}>{s.label.replace(/^[^ ]+ /, '')}</div>
                          <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>{s.desc}</div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Historický rok — výběr epochy + roku */}
                  {map.style === 'historical' && (
                    <div style={{ borderTop: '1px solid #f1f5f9' }}>
                      <div style={{ padding: '8px 14px 4px', fontSize: 9, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Clock size={10}/> Historické období
                      </div>
                      {/* Epoch tabs */}
                      <div style={{ display: 'flex', overflowX: 'auto', gap: 4, padding: '0 14px 6px', scrollbarWidth: 'none' }}>
                        {HIST_EPOCHS.map((ep, i) => {
                          const epochActive = ep.years.some(y => y.key === quizHistYear);
                          return (
                            <button key={i} onClick={() => {
                              const first = ep.years[0].key;
                              setQuizHistYear(first);
                            }} style={{
                              flexShrink: 0, padding: '3px 9px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                              border: `1.5px solid ${epochActive ? '#6366f1' : '#e2e8f0'}`,
                              background: epochActive ? '#eef2ff' : '#f8fafc',
                              color: epochActive ? '#4338ca' : '#64748b', cursor: 'pointer',
                            }}>{ep.label}</button>
                          );
                        })}
                      </div>
                      {/* Roky aktivní epochy */}
                      {(() => {
                        const activeEpoch = HIST_EPOCHS.find(ep => ep.years.some(y => y.key === quizHistYear)) ?? HIST_EPOCHS[0];
                        return (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '0 14px 10px' }}>
                            {activeEpoch.years.map(({ key, display }) => {
                              const active = quizHistYear === key;
                              return (
                                <button key={key} onClick={() => setQuizHistYear(key)} style={{
                                  padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: active ? 800 : 500,
                                  border: `1.5px solid ${active ? '#6366f1' : '#e2e8f0'}`,
                                  background: active ? '#6366f1' : '#f8fafc',
                                  color: active ? 'white' : '#374151', cursor: 'pointer',
                                  transition: 'all .1s',
                                }}>{display}</button>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* ── 3. DATOVÉ VRSTVY ───────────────────────────────── */}
              <SectionHeader id="layers" label="Datové vrstvy" icon={<Zap size={13}/>} badge={activeLayerCount} />
              {openSections.layers && (() => {
                const groups = [
                  { label: 'Hydrografie', color: '#0ea5e9', items: [
                    { key: 'showRivers',  label: '〰️ Řeky',          desc: 'Natural Earth 10m' },
                    { key: 'showLakes',   label: '💧 Jezera',         desc: 'Natural Earth 10m' },
                    { key: 'showOceans',  label: '🌊 Oceány a moře',  desc: 'NE marine polys' },
                  ]},
                  { label: 'Fyzická geografie', color: '#b8956a', items: [
                    { key: 'showPhysical',  label: '🏔️ Fyzické regiony',  desc: 'Pohoří, pouště, nížiny' },
                    { key: 'showClimate',   label: '🌡️ Klimatické pásy',  desc: 'Köppen-Geiger' },
                    { key: 'showBiomes',    label: '🌿 Biomy',            desc: 'Resolve Ecoregions 2017' },
                    { key: 'showTimezones', label: '🕐 Časové zóny',      desc: 'Natural Earth 10m' },
                  ]},
                  { label: 'Geologie', color: '#dc2626', items: [
                    { key: 'showTectonics',   label: '🌍 Tektonické desky', desc: 'Peter Bird PB2002' },
                    { key: 'showVolcanoes',   label: '🌋 Vulkány',          desc: 'Smithsonian GVP · 130 vulkánů' },
                    { key: 'showEarthquakes', label: '📡 Zemětřesení',      desc: 'USGS M5.5+ 2022–2024' },
                  ]},
                  { label: 'Lidská geografie', color: '#7c3aed', items: [
                    { key: 'showCities',    label: '🏙️ Města a sídla', desc: 'Natural Earth 10m' },
                    { key: 'showAirports',  label: '✈️ Letiště',        desc: 'Natural Earth 10m' },
                    { key: 'showRailroads', label: '🚂 Železnice',      desc: 'Natural Earth 10m' },
                  ]},
                ];

                return (
                  <div>
                    {!quizMode && (
                      <div style={{ padding: '7px 14px 2px', fontSize: 9, color: '#94a3b8', lineHeight: 1.5, borderBottom: '1px solid #f1f5f9' }}>
                        Vrstvy se zobrazí na <b>SVG mapě</b> — přepni na Kvíz mód pro jejich zobrazení.
                      </div>
                    )}
                    {groups.map(group => (
                      <div key={group.label}>
                        <div style={{ padding: '8px 14px 4px', fontSize: 9, fontWeight: 800, color: group.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {group.label}
                        </div>
                        {group.items.map(item => {
                          const active = (map.overlays as any)?.[item.key] ?? false;
                          return (
                            <LayerToggle key={item.key} label={item.label} desc={item.desc}
                              active={active} color={group.color}
                              onClick={() => toggleQuizLayer(item.key)} />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* ── 4. WWF BIOMY (jen vizualizace, tematická vrstva) ── */}
              <SectionHeader id="biomes" label="WWF Biomy" icon={<span style={{fontSize:12}}>🌿</span>} badge={selectedBiomes.size} />
              {openSections.biomes && (
                <div style={{ paddingBottom: 4 }}>
                  {selectedBiomes.size > 0 && (
                    <div style={{ padding: '6px 14px' }}>
                      <button onClick={() => { setSelectedBiomes(new Set()); patch({ thematicLayer: undefined }); }}
                        style={{ width: '100%', padding: '5px', borderRadius: 7, border: '1px solid #fca5a5',
                          background: '#fff1f2', color: '#dc2626', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                        Zrušit výběr ({selectedBiomes.size} biomů)
                      </button>
                    </div>
                  )}
                  {WWF_BIOMES.map(biome => {
                    const active = selectedBiomes.has(biome.num);
                    return (
                      <div key={biome.num} onClick={() => toggleBiome(biome.num)} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px',
                        cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                        background: active ? `${biome.color}10` : 'transparent',
                      }}>
                        <div style={{
                          width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                          background: active ? biome.color : 'white',
                          border: `2px solid ${active ? biome.color : '#cbd5e1'}`,
                        }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? biome.color : '#374151' }}>
                            {biome.label}
                          </div>
                          <div style={{ fontSize: 9, color: '#94a3b8' }}>{biome.examples.slice(0,2).join(', ')}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── 5. AI GENERÁTOR ────────────────────────────────── */}
              <SectionHeader id="ai" label="AI Generátor mapy" icon={<Wand2 size={13}/>} />
              {openSections.ai && (
                <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.5 }}>
                    Popiš co chceš zobrazit — AI vygeneruje celou konfiguraci.
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {['Světové pouště', 'Tropické pralesy', 'Středomořský biom', 'Boreální lesy', 'Horská pásma'].map(hint => (
                      <button key={hint} onClick={() => setAiPrompt(hint)} style={{
                        padding: '3px 8px', borderRadius: 99, fontSize: 10, fontWeight: 600,
                        border: '1px solid #c7d2fe', background: '#eef2ff', color: '#6366f1', cursor: 'pointer',
                      }}>{hint}</button>
                    ))}
                  </div>
                  <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAi(); }}
                    rows={3} style={{
                      width: '100%', boxSizing: 'border-box', padding: '7px 9px',
                      border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 11,
                      resize: 'vertical', color: '#0f172a', background: '#f8fafc',
                    }} placeholder="Např. Zobraz kde se vyskytují mangrovníky…" />
                  <button onClick={handleAi} disabled={aiLoading || !aiPrompt.trim()} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '8px', borderRadius: 8, border: 'none',
                    background: aiLoading ? '#a5b4fc' : '#6366f1', color: 'white',
                    fontSize: 12, fontWeight: 700, cursor: aiLoading || !aiPrompt.trim() ? 'not-allowed' : 'pointer',
                  }}>
                    <Wand2 size={13} />
                    {aiLoading ? 'Generuji…' : 'Vygenerovat (⌘↵)'}
                  </button>
                </div>
              )}

              {/* ── 6. ULOŽENÉ MAPY ────────────────────────────────── */}
              <SectionHeader id="saved" label="Uložené mapy" icon={<FolderOpen size={13}/>} badge={savedMaps.length} />
              {openSections.saved && (
                <div style={{ padding: '8px 14px' }}>
                  {savedMaps.length === 0 && (
                    <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: '12px 0' }}>Žádné uložené mapy</div>
                  )}
                  {savedMaps.map(saved => (
                    <div key={saved.id} style={{
                      border: `1.5px solid ${map.id === saved.id ? '#6366f1' : '#e2e8f0'}`,
                      borderRadius: 9, padding: '8px 10px', marginBottom: 6,
                      background: map.id === saved.id ? '#eef2ff' : '#f8fafc',
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 11, color: '#0f172a', marginBottom: 2 }}>{saved.title}</div>
                      <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 6 }}>
                        {REGION_LABELS[saved.region]} · {STYLE_LABELS[saved.style] || saved.style}
                      </div>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button onClick={() => { setMap(saved); setSelectedBiomes(new Set()); }} style={{
                          flex: 1, padding: '4px 6px', borderRadius: 6, fontSize: 10,
                          border: '1px solid #c7d2fe', background: '#eef2ff', color: '#6366f1',
                          cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        }}>
                          <Eye size={10} /> Načíst
                        </button>
                        <button onClick={() => deleteMap(saved.id)} style={{
                          padding: '4px 8px', borderRadius: 6, border: '1px solid #fca5a5',
                          background: '#fff1f2', color: '#dc2626', cursor: 'pointer',
                        }}><Trash2 size={10} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>{/* end scroll */}
          </>
        )}
      </div>

      {/* ── Collapse button ──────────────────────────────────────────────────── */}
      <button onClick={() => setSidebarOpen(o => !o)} style={{
        position: 'absolute', left: sidebarOpen ? 300 : 0, top: '50%',
        transform: 'translateY(-50%)', zIndex: 100,
        width: 18, height: 52, border: 'none', background: '#6366f1', color: 'white',
        cursor: 'pointer', borderRadius: '0 6px 6px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'left 0.22s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: '2px 0 8px rgba(99,102,241,0.35)',
      }}>
        {sidebarOpen ? <ChevronLeft size={11}/> : <ChevronRight size={11}/>}
      </button>

      {/* ════════════════════════════════════════════════════════════
          MAPA
      ════════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <QuizMap
          key={`atlas-${map.id}-${map.region}-${map.style}-${quizHistYear ?? 'none'}`}
          map={{ ...map, exerciseType: quizMode ? (map.exerciseType === 'info' ? 'identify' : map.exerciseType) : 'info' }}
          height={mapHeight}
          quizMode={quizMode}
          historicalYear={map.style === 'historical' ? quizHistYear : undefined}
          onHistoricalYearChange={setQuizHistYear}
          onAnswer={(correct, name) => {
            if (correct) toast.success(`✅ Správně! ${name}`);
            else toast.error(`❌ Špatně — ${name}`);
          }}
        />

        {/* Název mapy + info badge */}
        <div style={{
          position: 'absolute', bottom: 16, right: 16, zIndex: 500,
          background: 'rgba(15,23,42,0.78)', borderRadius: 10,
          padding: '7px 12px', fontSize: 10, color: '#cbd5e1',
          backdropFilter: 'blur(8px)', lineHeight: 1.7, pointerEvents: 'none',
          maxWidth: 220,
        }}>
          <div style={{ fontWeight: 800, color: 'white', fontSize: 11 }}>{map.title}</div>
          <div>{REGION_LABELS[map.region]} · {quizMode ? '🎯 Kvíz' : STYLE_LABELS[map.style] || map.style}</div>
          {map.thematicLayer && <div style={{ color: '#93c5fd' }}>📊 {map.thematicLayer.title}</div>}
          {activeLayerCount > 0 && <div style={{ color: '#86efac' }}>🔵 {activeLayerCount} aktivních vrstev</div>}
        </div>
      </div>

      {/* ── MapEditorModal ────────────────────────────────────────────────────── */}
      {editModalOpen && (
        <MapEditorModal
          map={map}
          dataSetTopic="Atlas Explorer"
          onSave={async (updated) => {
            setMap(updated);
            setEditModalOpen(false);
            toast.success('Mapa aktualizována');
          }}
          onClose={() => setEditModalOpen(false)}
        />
      )}
    </div>
  );
}
