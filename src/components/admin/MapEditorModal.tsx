/**
 * MapEditorModal – editor mapy pro učitele v Curriculum Factory
 *
 * Layout:
 *   Levý panel (360px)  – nastavení, AI asistent, markery, vrstvy
 *   Pravý panel (flex-1) – živý náhled VividMap
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  X, Save, ChevronDown, ChevronRight, Plus, Trash2,
  Wand2, Settings, MapPin, Layers, Sparkles, Globe,
} from 'lucide-react';
import { toast } from 'sonner';

import { VividMap, MARKER_ICONS, HIGHLIGHT_COLORS } from '../shared/VividMap';
import type {
  SavedMap, MapMarker, MapArea, MapChoropleth, ThematicLayer,
  MapRegionId, MapStyle, MapExerciseType, ThematicCategory, ChoroplethCategory,
} from '../../types/topic-dataset';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REGION_LABELS: Record<string, string> = {
  'world': 'Svět', 'europe': 'Evropa', 'central-europe': 'Střední Evropa',
  'mediterranean': 'Středomoří', 'middle-east': 'Střední Východ', 'africa': 'Afrika',
  'asia': 'Asie', 'americas': 'Amerika', 'czech-republic': 'Česká republika',
  'italy': 'Itálie', 'greece': 'Řecko', 'france': 'Francie', 'germany': 'Německo',
  'custom': 'Vlastní',
};

// Map type configuration — each type defines its data source and available toggles.
// RULE: never mix overlays from different tile providers → avoids border misalignment.
const MAP_TYPE_CONFIG: Record<MapStyle, {
  label: string;
  icon: string;
  source: string;        // data source shown in UI
  description: string;
  // Which overlay toggles make sense for this type (keys match SavedMap.overlays fields)
  toggles: Array<{
    key: 'showBorders' | 'showRivers' | 'showTerrain' | 'labelMode';
    label: string;
    value?: string;      // for labelMode: which mode to activate
    defaultOn: boolean;
  }>;
}> = {
  blank_pure: {
    label: 'Slepá mapa',
    icon: '⬜',
    source: 'Natural Earth GeoJSON',
    description: '100% vektorová — státní hranice jsou vždy přesné',
    toggles: [
      { key: 'showBorders', label: 'Státní hranice', defaultOn: true },
      { key: 'showRivers',  label: 'Řeky', defaultOn: false },
      { key: 'labelMode',   label: 'Hlavní města', value: 'capitals', defaultOn: false },
      { key: 'labelMode',   label: 'Názvy států',  value: 'countries', defaultOn: false },
    ],
  },
  political: {
    label: 'Politická',
    icon: '🗺️',
    source: 'CartoDB Positron',
    description: 'Čisté politické hranice a popisky',
    toggles: [
      { key: 'labelMode',  label: 'Popisky měst a zemí', value: 'countries', defaultOn: true },
      { key: 'showRivers', label: 'Řeky (Natural Earth)', defaultOn: false },
    ],
  },
  physical: {
    label: 'Fyzická / Terén',
    icon: '⛰️',
    source: 'OpenTopoMap',
    description: 'Výškopis, terén a topografie',
    toggles: [
      { key: 'showTerrain', label: 'Stínování reliéfu', defaultOn: true },
      { key: 'showRivers',  label: 'Řeky', defaultOn: false },
    ],
  },
  historical: {
    label: 'Historická',
    icon: '📜',
    source: 'CartoDB Voyager',
    description: 'Teplý tón vhodný pro historické mapy',
    toggles: [
      { key: 'labelMode', label: 'Popisky zemí', value: 'countries', defaultOn: false },
    ],
  },
  satellite: {
    label: 'Satelit',
    icon: '🛰️',
    source: 'Esri World Imagery',
    description: 'Reálné satelitní snímky',
    toggles: [
      { key: 'labelMode', label: 'Popisky měst', value: 'cities', defaultOn: false },
    ],
  },
  dark: {
    label: 'Tmavá',
    icon: '🌙',
    source: 'CartoDB Dark Matter',
    description: 'Tmavý styl pro prezentace',
    toggles: [
      { key: 'labelMode', label: 'Popisky zemí', value: 'countries', defaultOn: false },
    ],
  },
  blank: {
    label: 'Světlá slepá (Esri)',
    icon: '🔲',
    source: 'Esri Canvas',
    description: 'Šedý podklad od Esri (bez GeoJSON vrstev)',
    toggles: [
      { key: 'labelMode', label: 'Popisky zemí', value: 'countries', defaultOn: false },
    ],
  },
};

const EXERCISE_LABELS: Record<MapExerciseType, string> = {
  identify: '🎯 Kvíz – identifikace', label: '✍️ Označování',
  color: '🎨 Barvení', info: '🗺️ Informativní', route: '🛤️ Trasa',
};

const MARKER_TYPES = ['city', 'battle', 'landmark', 'capital', 'river', 'mountain', 'custom'] as const;

const THEMATIC_NE_REGIONS = [
  'Sahara', 'Gobi Desert', 'Kalahari Desert', 'Namib', 'Nubian Desert', 'Libyan Desert',
  'Thar Desert', 'Syrian Desert', "Rub' al Khali", 'Sahel', 'Indo-Gangetic Plain',
  'North China Plain', 'Kazakh Steppe', 'North European Plain', 'Great Plains',
  'Gran Chaco', 'Pampas', 'Himalayas', 'Alps', 'Andes', 'Rocky Mountains',
  'Ural Mountains', 'Caucasus Mountains', 'Tian Shan', 'Tibetan Plateau',
  'Brazilian Highlands', 'Deccan Plateau', 'Amazon basin', 'Congo basin',
  'Siberia', 'Mesopotamia', 'Patagonia', 'Arabian Peninsula', 'Indian subcontinent',
  'Nile Delta', 'Ganges Delta', 'Pantanal', 'Barren Grounds',
];

// ─── OSM polygon fetch (Nominatim) ───────────────────────────────────────────

/** Subsample polygon to at most maxPoints while keeping first+last point */
function simplifyPolygon(coords: [number, number][], maxPoints = 1500): [number, number][] {
  if (coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / maxPoints);
  const simplified = coords.filter((_, i) => i % step === 0);
  const first = simplified[0], last = simplified[simplified.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) simplified.push(first);
  return simplified;
}

/**
 * Query Nominatim for a named geographic region.
 * Returns an array of polygon rings (MultiPolygon → multiple rings, each is a separate area).
 * Returns null if not found.
 */
async function fetchOSMPolygons(name: string): Promise<[number, number][][] | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&polygon_geojson=1&limit=5`;
    const res = await fetch(url, { headers: { 'User-Agent': 'VividBooks Educational Platform' } });
    if (!res.ok) return null;
    const items: any[] = await res.json();

    for (const item of items) {
      const geo = item.geojson;
      if (!geo) continue;

      if (geo.type === 'Polygon') {
        const ring: [number, number][] = geo.coordinates[0];
        if (ring.length > 10) return [simplifyPolygon(ring)];
      } else if (geo.type === 'MultiPolygon') {
        // Vrátíme VŠECHNY outer rings jako samostatné polygony (Sahara = desítky částí)
        const rings: [number, number][][] = geo.coordinates
          .map((poly: any) => poly[0] as [number, number][])
          .filter((r: [number, number][]) => r.length > 10)
          .map((r: [number, number][]) => simplifyPolygon(r));
        if (rings.length > 0) return rings;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Zpětná kompatibilita pro enhanceAreaWithOSM (vrátí jen jeden ring)
async function fetchOSMPolygon(name: string): Promise<[number, number][] | null> {
  const rings = await fetchOSMPolygons(name);
  if (!rings) return null;
  // Vrať největší ring
  return rings.reduce((a, b) => a.length >= b.length ? a : b);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseJsonSafe(text: string): any | null {
  const m = text.match(/\{[\s\S]*\}/) || text.match(/\[[\s\S]*\]/);
  if (!m) return null;
  let s = m[0].replace(/,\s*([}\]])/g, '$1').replace(/\/\/[^\n]*/g, '');
  try { return JSON.parse(s); } catch { return null; }
}

// ─── Accordion Section ────────────────────────────────────────────────────────

interface SectionProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}
function Section({ title, icon, open, onToggle, children }: SectionProps) {
  return (
    <div style={{ borderBottom: '1px solid #e2e8f0' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#0f172a',
        }}
      >
        <span style={{ color: '#6366f1' }}>{icon}</span>
        <span style={{ flex: 1 }}>{title}</span>
        {open ? <ChevronDown size={14} color="#94a3b8" /> : <ChevronRight size={14} color="#94a3b8" />}
      </button>
      {open && (
        <div style={{ padding: '0 16px 14px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface MapEditorModalProps {
  map: SavedMap;
  dataSetTopic: string;
  onSave: (updated: SavedMap) => Promise<void>;
  onClose: () => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MapEditorModal({ map, dataSetTopic, onSave, onClose }: MapEditorModalProps) {
  const [editedMap, setEditedMap] = useState<SavedMap>(() => ({
    ...map,
    markers: map.markers ? [...map.markers] : [],
    highlights: map.highlights ? [...map.highlights] : [],
    routes: map.routes ? [...map.routes] : [],
    areas: map.areas ? [...map.areas] : [],
  }));
  const [openSection, setOpenSection] = useState<string>('basic');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [aiLog, setAiLog] = useState<string[]>([]);
  const [osmLoadingIdx, setOsmLoadingIdx] = useState<number | null>(null);
  const [osmThematicLoading, setOsmThematicLoading] = useState<number | null>(null); // category index
  const [osmThematicProgress, setOsmThematicProgress] = useState<string>('');
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const patch = useCallback((p: Partial<SavedMap>) => setEditedMap(prev => ({ ...prev, ...p })), []);

  const toggleSection = (id: string) => setOpenSection(prev => prev === id ? '' : id);

  // ── Uložit ────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaveLoading(true);
    try {
      await onSave(editedMap);
    } finally {
      setSaveLoading(false);
    }
  };

  // ── AI Asistent – 2 agenti ─────────────────────────────────────────────────

  const handleAiRefine = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiLog([]);
    const log = (msg: string) => setAiLog(prev => [...prev, msg]);

    try {
      const { chatWithAIProxy } = await import('../../utils/ai-chat-proxy');

      const ctx = `Téma datasetu: "${dataSetTopic}"
Název mapy: "${editedMap.title}"
Region: ${editedMap.region}
Styl: ${editedMap.style}
Typ cvičení: ${editedMap.exerciseType}
Aktuální markery (${editedMap.markers.length}): ${JSON.stringify(editedMap.markers.map(m => ({ id: m.id, name: m.name, lat: m.lat, lng: m.lng, type: m.type })))}`;

      // Agent A – markery
      const promptA = `Jsi kartograf. Uprav body zájmu na vzdělávací mapě na základě požadavku učitele.
${ctx}

Požadavek učitele: "${aiPrompt.trim()}"

Pokud je požadavek o markerech (přidání, odebrání, zpřesnění souřadnic), vrať upravenou sadu.
Pokud požadavek markerů netýká, vrať stávající sadu beze změn.

Vrať POUZE JSON:
{"action":"merge","markers":[{"id":"m1","name":"Název","lat":0.0,"lng":0.0,"type":"city","color":"#6366f1","icon":"🏛️","description":"popis","year":"rok"}]}

"merge" = přidej/uprav stávající markery zachováním zbytku
"replace" = nahraď celý seznam`;

      // Agent B – tematická vrstva
      const currentLayer = editedMap.thematicLayer
        ? `thematicLayer: ${JSON.stringify(editedMap.thematicLayer)}`
        : editedMap.choropleth
          ? `choropleth: ${JSON.stringify(editedMap.choropleth)}`
          : editedMap.areas?.length
            ? `areas (${editedMap.areas.length} polygonů)`
            : 'žádná vrstva';

      const promptB = `Jsi kartograf. Uprav tematickou vrstvu vzdělávací mapy na základě požadavku učitele.
${ctx}
Aktuální vrstva: ${currentLayer}

Požadavek učitele: "${aiPrompt.trim()}"

Dostupné NAME_EN (ne_regions): ${THEMATIC_NE_REGIONS.join(', ')}

Vrať POUZE JSON – vyber JEDNU možnost:
{"type":"thematicLayer","data":{"title":"...","dataset":"ne_regions","categories":[{"color":"#...","label":"...","featureNames":["..."]}]}}
nebo {"type":"choropleth","data":{"title":"...","type":"category","categories":[{"id":"c1","label":"...","color":"#...","isoCodes":["DEU"]}]}}
nebo {"type":"areas","data":[{"id":"a1","name":"...","color":"#...","opacity":0.4,"label":"...","era":"...","coords":[[lng,lat],...(min 30 bodů pro každý polygon, sleduj reálný tvar oblasti)]}]}
nebo {"type":"keep","data":null}`;

      log('⏳ Agent A (markery) + Agent B (vrstva) paralelně...');
      const [respA, respB] = await Promise.all([
        chatWithAIProxy([{ role: 'user', content: promptA }], 'gemini-3-flash'),
        chatWithAIProxy([{ role: 'user', content: promptB }], 'gemini-3-pro'),
      ]);

      log(`✅ Agent A: ${respA.length} zn | Agent B: ${respB.length} zn`);

      // Merge markerů
      const parsedA = parseJsonSafe(respA);
      let newMarkers = editedMap.markers;
      if (parsedA?.markers && Array.isArray(parsedA.markers)) {
        if (parsedA.action === 'replace') {
          newMarkers = parsedA.markers;
          log(`✅ Markery nahrazeny (${newMarkers.length})`);
        } else {
          // merge – aktualizuj existující, přidej nové
          const existing = new Map(editedMap.markers.map(m => [m.id, m]));
          parsedA.markers.forEach((m: MapMarker) => existing.set(m.id, m));
          newMarkers = [...existing.values()];
          log(`✅ Markery sloučeny (${newMarkers.length})`);
        }
      }

      // Merge vrstvy
      const parsedB = parseJsonSafe(respB);
      let layerPatch: Partial<SavedMap> = {};
      if (parsedB?.type === 'thematicLayer' && parsedB.data) {
        layerPatch = { thematicLayer: parsedB.data, choropleth: undefined, areas: [] };
        log(`✅ Tematická vrstva aktualizována (${parsedB.data.categories?.length} kategorií)`);
      } else if (parsedB?.type === 'choropleth' && parsedB.data) {
        layerPatch = { choropleth: parsedB.data, thematicLayer: undefined, areas: [] };
        log(`✅ Choropleth aktualizován`);
      } else if (parsedB?.type === 'areas' && Array.isArray(parsedB.data)) {
        layerPatch = { areas: parsedB.data, thematicLayer: undefined, choropleth: undefined };
        log(`✅ Oblasti aktualizovány (${parsedB.data.length})`);
      } else {
        log('ℹ️ Vrstva beze změny');
      }

      setEditedMap(prev => ({ ...prev, markers: newMarkers, ...layerPatch }));
      setAiPrompt('');
      toast.success('Mapa aktualizována');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`❌ Chyba: ${msg.slice(0, 120)}`);
      toast.error('Chyba při úpravě mapy');
    } finally {
      setAiLoading(false);
    }
  };

  // ── Marker helpers ─────────────────────────────────────────────────────────

  const updateMarker = (i: number, patch: Partial<MapMarker>) => {
    const arr = [...editedMap.markers];
    arr[i] = { ...arr[i], ...patch };
    setEditedMap(prev => ({ ...prev, markers: arr }));
  };

  const deleteMarker = (i: number) => {
    setEditedMap(prev => ({ ...prev, markers: prev.markers.filter((_, j) => j !== i) }));
  };

  const addMarker = () => {
    const newM: MapMarker = {
      id: crypto.randomUUID(),
      name: 'Nový bod',
      lat: 45, lng: 12,
      type: 'custom',
      color: HIGHLIGHT_COLORS[editedMap.markers.length % HIGHLIGHT_COLORS.length],
      icon: '📍',
    };
    setEditedMap(prev => ({ ...prev, markers: [...prev.markers, newM] }));
  };

  // ── Thematic layer helpers ─────────────────────────────────────────────────

  const updateThematicCat = (i: number, catPatch: Partial<ThematicCategory>) => {
    if (!editedMap.thematicLayer) return;
    const cats = [...editedMap.thematicLayer.categories];
    cats[i] = { ...cats[i], ...catPatch };
    setEditedMap(prev => ({ ...prev, thematicLayer: { ...prev.thematicLayer!, categories: cats } }));
  };

  const addThematicCat = () => {
    const base: ThematicCategory = {
      color: HIGHLIGHT_COLORS[(editedMap.thematicLayer?.categories.length || 0) % HIGHLIGHT_COLORS.length],
      label: 'Nová kategorie',
      featureNames: [],
    };
    setEditedMap(prev => ({
      ...prev,
      thematicLayer: prev.thematicLayer
        ? { ...prev.thematicLayer, categories: [...prev.thematicLayer.categories, base] }
        : { title: 'Tematická vrstva', dataset: 'ne_regions', categories: [base] },
    }));
  };

  // ── Choropleth helpers ─────────────────────────────────────────────────────

  const updateChoroplethCat = (i: number, p: Partial<ChoroplethCategory>) => {
    if (!editedMap.choropleth) return;
    const cats = [...editedMap.choropleth.categories];
    cats[i] = { ...cats[i], ...p };
    setEditedMap(prev => ({ ...prev, choropleth: { ...prev.choropleth!, categories: cats } }));
  };

  // ── Area helpers ───────────────────────────────────────────────────────────

  const updateArea = (i: number, p: Partial<MapArea>) => {
    const arr = [...(editedMap.areas || [])];
    arr[i] = { ...arr[i], ...p };
    setEditedMap(prev => ({ ...prev, areas: arr }));
  };

  const deleteArea = (i: number) => {
    setEditedMap(prev => ({ ...prev, areas: (prev.areas || []).filter((_, j) => j !== i) }));
  };

  // ── OSM polygon enhance ────────────────────────────────────────────────────
  const enhanceAreaWithOSM = async (i: number) => {
    const area = (editedMap.areas || [])[i];
    if (!area) return;
    setOsmLoadingIdx(i);
    try {
      const coords = await fetchOSMPolygon(area.label || area.name);
      if (!coords) {
        toast.error(`Oblast "${area.label || area.name}" nenalezena v OpenStreetMap`);
        return;
      }
      const arr = [...(editedMap.areas || [])];
      arr[i] = { ...arr[i], coords };
      setEditedMap(prev => ({ ...prev, areas: arr }));
      toast.success(`Hranice zpřesněny z OSM (${coords.length} bodů)`);
    } catch {
      toast.error('Chyba při stahování z OpenStreetMap');
    } finally {
      setOsmLoadingIdx(null);
    }
  };

  // ── OSM zpřesnění pro kategorii tematické vrstvy ──────────────────────────
  // Stáhne reálné polygony z OSM pro každý featureName v kategorii,
  // přidá je jako oblasti (areas) a odebere kategorii z thematicLayer.
  const enhanceThematicCatWithOSM = async (catIdx: number) => {
    if (!editedMap.thematicLayer) return;
    const cat = editedMap.thematicLayer.categories[catIdx];
    if (!cat || cat.featureNames.length === 0) return;

    setOsmThematicLoading(catIdx);
    setOsmThematicProgress(`0 / ${cat.featureNames.length}`);

    const newAreas: MapArea[] = [];
    const foundNames: string[] = [];
    const notFoundNames: string[] = [];

    for (let fi = 0; fi < cat.featureNames.length; fi++) {
      const name = cat.featureNames[fi];
      setOsmThematicProgress(`${fi + 1} / ${cat.featureNames.length}: ${name}…`);
      try {
        const rings = await fetchOSMPolygons(name);
        if (rings && rings.length > 0) {
          // MultiPolygon → každý ring jako separátní oblast (Sahara = desítky částí)
          rings.forEach((coords, ri) => {
            newAreas.push({
              id: crypto.randomUUID(),
              name: rings.length > 1 ? `${name} (${ri + 1})` : name,
              label: name,
              color: cat.color,
              opacity: 0.62,
              coords,
            });
          });
          foundNames.push(name);
        } else {
          notFoundNames.push(name);
        }
      } catch {
        notFoundNames.push(name);
      }
      // Nominatim rate limit: 1 req/sec
      if (fi < cat.featureNames.length - 1) await new Promise(r => setTimeout(r, 1100));
    }

    setEditedMap(prev => {
      if (!prev.thematicLayer) return prev;
      const cats = prev.thematicLayer.categories.map((c, i) => {
        if (i !== catIdx) return c;
        // Pokud se podařilo najít jen část — ponech nenalezené v thematic layeru
        if (notFoundNames.length > 0 && foundNames.length > 0) {
          return { ...c, featureNames: notFoundNames };
        }
        // Všechny nalezeny → null (odebrat)
        return null;
      }).filter(Boolean) as typeof prev.thematicLayer.categories;

      return {
        ...prev,
        areas: [...(prev.areas || []), ...newAreas],
        thematicLayer: cats.length > 0
          ? { ...prev.thematicLayer, categories: cats }
          : undefined,
      };
    });

    setOsmThematicLoading(null);
    setOsmThematicProgress('');

    if (foundNames.length === 0) {
      toast.error(`OSM nenašel žádnou oblast. Zkus anglické názvy (Sahara Desert, Gobi Desert…)`);
    } else if (notFoundNames.length > 0) {
      toast.success(`${foundNames.length} oblastí zpřesněno. Nenalezeno: ${notFoundNames.join(', ')}`);
    } else {
      toast.success(`Všechny oblasti zpřesněny z OSM (${foundNames.length})`);
    }
  };

  // ── Layer type badge ───────────────────────────────────────────────────────
  const layerType = editedMap.thematicLayer ? 'thematic' : editedMap.choropleth ? 'choropleth' : (editedMap.areas?.length ? 'areas' : 'none');
  const layerBadgeColor: Record<string, string> = {
    thematic: '#0ea5e9', choropleth: '#6366f1', areas: '#f59e0b', none: '#94a3b8',
  };
  const layerBadgeLabel: Record<string, string> = {
    thematic: 'Tematická vrstva', choropleth: 'Choropleth', areas: 'Vlastní oblasti', none: 'Žádná vrstva',
  };

  // ── Map key for forcing re-render when layers change ──────────────────────
  const mapKey = `${editedMap.id}-${editedMap.style}-${editedMap.region}-${layerType}-${editedMap.markers.length}`;

  // ── Input style ───────────────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    width: '100%', padding: '5px 8px', border: '1px solid #e2e8f0',
    borderRadius: 6, fontSize: 11, color: '#0f172a', background: '#fff',
    boxSizing: 'border-box',
  };
  const sel: React.CSSProperties = { ...inp, cursor: 'pointer' };
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: 10, fontWeight: 700, color: '#64748b',
    textTransform: 'uppercase', marginBottom: 3, marginTop: 8,
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'stretch',
        backdropFilter: 'blur(6px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          display: 'flex', flex: 1, margin: 20, borderRadius: 18, overflow: 'hidden',
          background: '#f8fafc', boxShadow: '0 25px 80px rgba(0,0,0,0.45)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ══ Left sidebar ═══════════════════════════════════════════════════ */}
        <div style={{
          width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column',
          background: '#fff', borderRight: '1px solid #e2e8f0', overflowY: 'auto',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>✏️ Editor mapy</div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{dataSetTopic}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={handleSave}
                disabled={saveLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 14px', borderRadius: 8,
                  background: saveLoading ? '#a5b4fc' : '#6366f1',
                  color: '#fff', border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 700,
                }}
              >
                <Save size={13} />
                {saveLoading ? 'Ukládám...' : 'Uložit'}
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: '6px 10px', borderRadius: 8,
                  border: '1px solid #e2e8f0', background: 'white',
                  color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center',
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* ── 1. Základní nastavení ─────────────────────────────────── */}
          <Section id="basic" title="Základní nastavení" icon={<Settings size={14} />}
            open={openSection === 'basic'} onToggle={() => toggleSection('basic')}>
            <label style={lbl}>Název mapy</label>
            <input style={inp} value={editedMap.title}
              onChange={e => patch({ title: e.target.value })} />

            <label style={lbl}>Zadání / popis pro žáky</label>
            <textarea style={{ ...inp, resize: 'vertical' }} rows={3}
              value={editedMap.description || ''}
              onChange={e => patch({ description: e.target.value })}
              placeholder="Např. Označ na mapě hlavní řeky Afriky" />

            <label style={lbl}>Region</label>
            <select style={sel} value={editedMap.region}
              onChange={e => patch({ region: e.target.value as MapRegionId })}>
              {Object.entries(REGION_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>

            {/* ── Typ mapy (vizuální výběr) ───────────────────────── */}
            <label style={lbl}>Typ mapy</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {(Object.entries(MAP_TYPE_CONFIG) as [MapStyle, typeof MAP_TYPE_CONFIG[MapStyle]][]).map(([styleKey, cfg]) => {
                const isActive = editedMap.style === styleKey;
                return (
                  <button
                    key={styleKey}
                    onClick={() => {
                      if (editedMap.style === styleKey) return;
                      // When switching type, reset overlays to defaults for that type
                      const newOverlays: SavedMap['overlays'] = {};
                      cfg.toggles.forEach(t => {
                        if (!t.defaultOn) return;
                        if (t.key === 'showBorders')  newOverlays.showBorders = true;
                        if (t.key === 'showRivers')   newOverlays.showRivers  = true;
                        if (t.key === 'showTerrain')  newOverlays.showTerrain = true;
                        if (t.key === 'labelMode' && t.value) newOverlays.labelMode = t.value as any;
                      });
                      patch({ style: styleKey, overlays: newOverlays });
                    }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                      gap: 2, padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                      textAlign: 'left',
                      border: isActive ? '2px solid #6366f1' : '1px solid #e2e8f0',
                      background: isActive ? '#eef2ff' : '#f8fafc',
                      transition: 'all .15s',
                    }}
                  >
                    <span style={{ fontSize: 16, lineHeight: 1 }}>{cfg.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? '#4338ca' : '#0f172a', lineHeight: 1.2, marginTop: 2 }}>
                      {cfg.label}
                    </span>
                    <span style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.3 }}>{cfg.source}</span>
                  </button>
                );
              })}
            </div>

            {/* ── Přepínače pro aktuální typ mapy ────────────────────── */}
            {(() => {
              const cfg = MAP_TYPE_CONFIG[editedMap.style];
              if (!cfg?.toggles.length) return null;
              const ovl = editedMap.overlays ?? {};
              const isOn = (t: typeof cfg.toggles[0]) => {
                if (t.key === 'showBorders') return !!ovl.showBorders;
                if (t.key === 'showRivers')  return !!ovl.showRivers;
                if (t.key === 'showTerrain') return !!ovl.showTerrain;
                if (t.key === 'labelMode')   return ovl.labelMode === t.value;
                return false;
              };
              const toggle = (t: typeof cfg.toggles[0]) => {
                const next = { ...ovl };
                if (t.key === 'showBorders') next.showBorders = !ovl.showBorders;
                else if (t.key === 'showRivers')  next.showRivers  = !ovl.showRivers;
                else if (t.key === 'showTerrain') next.showTerrain = !ovl.showTerrain;
                else if (t.key === 'labelMode') {
                  next.labelMode = ovl.labelMode === t.value ? 'none' : t.value as any;
                }
                patch({ overlays: next });
              };
              return (
                <div style={{ marginTop: 8 }}>
                  <div style={{ ...lbl, marginTop: 0 }}>Vrstvy — {cfg.label}</div>
                  <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 6, lineHeight: 1.4 }}>
                    {cfg.description}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {cfg.toggles.map((t, idx) => {
                      const on = isOn(t);
                      return (
                        <button
                          key={idx}
                          onClick={() => toggle(t)}
                          style={{
                            padding: '4px 10px', borderRadius: 99, fontSize: 10, fontWeight: 600,
                            border: on ? '1.5px solid #6366f1' : '1px solid #e2e8f0',
                            background: on ? '#eef2ff' : '#f8fafc',
                            color: on ? '#4338ca' : '#64748b',
                            cursor: 'pointer',
                          }}
                        >
                          {on ? '✓ ' : ''}{t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <label style={lbl}>Typ cvičení</label>
            <select style={sel} value={editedMap.exerciseType}
              onChange={e => patch({ exerciseType: e.target.value as MapExerciseType })}>
              {(Object.entries(EXERCISE_LABELS) as [MapExerciseType, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Section>

          {/* ── 2. AI Asistent ────────────────────────────────────────── */}
          <Section id="ai" title="AI Asistent" icon={<Sparkles size={14} />}
            open={openSection === 'ai'} onToggle={() => toggleSection('ai')}>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8, lineHeight: 1.5 }}>
              Popište co chcete upravit. AI aktualizuje markery i tematické vrstvy.
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 6 }}>
              {['Přidej hlavní města', 'Zpřesni hranice pouští', 'Obarvi EU modře'].map(hint => (
                <button key={hint}
                  onClick={() => setAiPrompt(hint)}
                  style={{
                    fontSize: 9, padding: '3px 7px', borderRadius: 99,
                    border: '1px solid #c7d2fe', background: '#eef2ff',
                    color: '#6366f1', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>
                  {hint}
                </button>
              ))}
            </div>
            <textarea
              ref={promptRef}
              style={{ ...inp, resize: 'vertical', minHeight: 64 }}
              rows={3}
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAiRefine(); }}
              placeholder="Zpřesni okolí Sahary, přidej hlavní města, obarvi země EU modře..."
            />
            <button
              onClick={handleAiRefine}
              disabled={aiLoading || !aiPrompt.trim()}
              style={{
                marginTop: 6, width: '100%', padding: '7px',
                borderRadius: 8, border: 'none', cursor: aiLoading || !aiPrompt.trim() ? 'not-allowed' : 'pointer',
                background: aiLoading ? '#a5b4fc' : '#6366f1',
                color: '#fff', fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Wand2 size={13} />
              {aiLoading ? 'Upravuji mapu...' : 'Upravit mapu (⌘↵)'}
            </button>
            {aiLog.length > 0 && (
              <div style={{
                marginTop: 8, background: '#f8fafc', borderRadius: 6,
                padding: '6px 8px', fontSize: 9.5, color: '#64748b', lineHeight: 1.7,
                border: '1px solid #e2e8f0',
              }}>
                {aiLog.map((l, i) => <div key={i}>{l}</div>)}
              </div>
            )}
          </Section>

          {/* ── 3. Markery ────────────────────────────────────────────── */}
          <Section id="markers" title={`Markery (${editedMap.markers.length})`} icon={<MapPin size={14} />}
            open={openSection === 'markers'} onToggle={() => toggleSection('markers')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {editedMap.markers.map((m, i) => (
                <div key={m.id} style={{
                  border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px',
                  background: '#f8fafc',
                }}>
                  {/* Row 1: icon + name + delete */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 5 }}>
                    <select
                      value={m.icon || '📍'}
                      onChange={e => updateMarker(i, { icon: e.target.value })}
                      style={{ fontSize: 15, border: 'none', background: 'none', cursor: 'pointer', padding: 0, width: 28 }}
                    >
                      {['🏛️','⚔️','🏙️','⭐','🌊','⛰️','📍','🏺','🛡️','⛪','🌳','🏰'].map(e => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                    <input
                      style={{ ...inp, flex: 1, fontWeight: 600 }}
                      value={m.name}
                      onChange={e => updateMarker(i, { name: e.target.value })}
                      placeholder="Název bodu"
                    />
                    <input
                      type="color"
                      value={m.color || '#6366f1'}
                      onChange={e => updateMarker(i, { color: e.target.value })}
                      style={{ width: 26, height: 26, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 1 }}
                      title="Barva markeru"
                    />
                    <button onClick={() => deleteMarker(i)}
                      style={{ padding: 4, borderRadius: 6, border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', cursor: 'pointer' }}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                  {/* Row 2: lat / lng / type */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 1 }}>Zeměšíř (lat)</div>
                      <input type="number" step={0.1} style={inp} value={m.lat}
                        onChange={e => updateMarker(i, { lat: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 1 }}>Zemědelka (lng)</div>
                      <input type="number" step={0.1} style={inp} value={m.lng}
                        onChange={e => updateMarker(i, { lng: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 1 }}>Typ</div>
                      <select style={sel} value={m.type}
                        onChange={e => updateMarker(i, { type: e.target.value as MapMarker['type'] })}>
                        {MARKER_TYPES.map(t => (
                          <option key={t} value={t}>{MARKER_ICONS[t]} {t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {/* Row 3: description + year */}
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    <div style={{ flex: 2 }}>
                      <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 1 }}>Popis</div>
                      <input style={inp} value={m.description || ''}
                        onChange={e => updateMarker(i, { description: e.target.value })}
                        placeholder="Krátký popis..." />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 1 }}>Rok</div>
                      <input style={inp} value={m.year || ''}
                        onChange={e => updateMarker(i, { year: e.target.value })}
                        placeholder="753 př.n.l." />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={addMarker}
                style={{
                  padding: '7px', borderRadius: 8, border: '1px dashed #c7d2fe',
                  background: '#eef2ff', color: '#6366f1', fontSize: 11,
                  fontWeight: 700, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', gap: 5,
                }}>
                <Plus size={12} /> Přidat bod
              </button>
            </div>
          </Section>

          {/* ── 4. Tematické vrstvy ───────────────────────────────────── */}
          <Section id="layers" title="Tematické vrstvy" icon={<Layers size={14} />}
            open={openSection === 'layers'} onToggle={() => toggleSection('layers')}>

            {/* Current layer type badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 10px',
                borderRadius: 99, background: `${layerBadgeColor[layerType]}20`,
                color: layerBadgeColor[layerType], border: `1px solid ${layerBadgeColor[layerType]}40`,
              }}>
                {layerBadgeLabel[layerType]}
              </span>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>použij AI asistenta pro změnu typu</div>
            </div>

            {/* Thematic layer editor */}
            {editedMap.thematicLayer && (
              <div>
                <label style={lbl}>Název vrstvy</label>
                <input style={inp} value={editedMap.thematicLayer.title}
                  onChange={e => setEditedMap(prev => ({
                    ...prev, thematicLayer: { ...prev.thematicLayer!, title: e.target.value },
                  }))} />
                <label style={{ ...lbl, marginTop: 8 }}>Datový zdroj</label>
                <select
                  style={{ ...inp, marginBottom: 4 }}
                  value={editedMap.thematicLayer.dataset}
                  onChange={e => setEditedMap(prev => ({
                    ...prev, thematicLayer: { ...prev.thematicLayer!, dataset: e.target.value },
                  }))}>
                  <option value="ne_regions">Natural Earth 10m – fyzické regiony (pouště, pohoří…)</option>
                  <option value="ne_glaciers">Natural Earth 10m – ledovce a zaledněné oblasti</option>
                  <option value="ne_marine">Natural Earth 10m – mořské oblasti</option>
                  <option value="wwf_ecoregions">WWF Ecoregions – 867 ekoregiónů, 14 biomů ✅</option>
                </select>
                {editedMap.thematicLayer.dataset === 'wwf_ecoregions' && (
                  <div style={{ fontSize: 10, color: '#166534', background: '#dcfce7', borderRadius: 6, padding: '5px 8px', marginBottom: 6, lineHeight: 1.4 }}>
                    ✅ WWF Ecoregions jsou nahrány. Použij názvy ekoregiónů (ECO_NAME), např. "Saharan halophytics", nebo kód (eco_code), např. "PA1309".
                  </div>
                )}
                <label style={{ ...lbl, marginTop: 6 }}>Kategorie</label>
                {/* Dataset-specific hint for feature names */}
                <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 6, lineHeight: 1.4 }}>
                  {editedMap.thematicLayer.dataset === 'wwf_ecoregions'
                    ? 'Názvy ekoregiónů (ECO_NAME) nebo biomů (BIOME_NAME), např. "Saharan halophytics", "Deserts & Xeric Shrublands"'
                    : 'Názvy regionů (NAME_EN z Natural Earth), např. "Sahara", "Himalayas", "Amazon basin"'}
                </div>
                {editedMap.thematicLayer.categories.map((cat, ci) => (
                  <div key={ci} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, marginBottom: 6, background: '#f8fafc' }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                      <input type="color" value={cat.color}
                        onChange={e => updateThematicCat(ci, { color: e.target.value })}
                        style={{ width: 26, height: 26, border: 'none', borderRadius: 4, cursor: 'pointer' }} />
                      <input style={{ ...inp, flex: 1, fontWeight: 600 }}
                        value={cat.label}
                        onChange={e => updateThematicCat(ci, { label: e.target.value })}
                        placeholder="Název kategorie" />
                      <button
                        onClick={() => {
                          const cats = editedMap.thematicLayer!.categories.filter((_, j) => j !== ci);
                          setEditedMap(prev => ({ ...prev, thematicLayer: { ...prev.thematicLayer!, categories: cats } }));
                        }}
                        style={{ padding: 4, border: '1px solid #fca5a5', borderRadius: 6, background: '#fff', color: '#dc2626', cursor: 'pointer' }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                    <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 3 }}>Regiony (NAME_EN, oddělené čárkou)</div>
                    <input style={inp}
                      value={cat.featureNames.join(', ')}
                      onChange={e => updateThematicCat(ci, {
                        featureNames: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                      })}
                      placeholder="Sahara, Gobi Desert, Namib..." />
                    {/* OSM button per thematic category */}
                    {cat.featureNames.length > 0 && (() => {
                      const isCatLoading = osmThematicLoading === ci;
                      return (
                        <button
                          onClick={() => enhanceThematicCatWithOSM(ci)}
                          disabled={isCatLoading || osmThematicLoading !== null}
                          title="Stáhnout přesné hranice z OpenStreetMap a převést na oblasti"
                          style={{
                            marginTop: 6, display: 'flex', alignItems: 'center', gap: 4,
                            padding: '4px 8px', border: '1px solid #a78bfa', borderRadius: 6,
                            background: isCatLoading ? '#ede9fe' : '#f5f3ff', color: '#7c3aed',
                            fontSize: 10, fontWeight: 700, cursor: isCatLoading ? 'wait' : 'pointer',
                            opacity: (osmThematicLoading !== null && !isCatLoading) ? 0.5 : 1,
                          }}>
                          {isCatLoading ? <span>⏳ {osmThematicProgress}</span> : <><Globe size={10} /> OSM zpřesnit ({cat.featureNames.length} oblastí)</>}
                        </button>
                      );
                    })()}
                  </div>
                ))}
                <div style={{ fontSize: 10, color: '#7c3aed', marginBottom: 6, background: '#f5f3ff', borderRadius: 6, padding: '5px 8px', lineHeight: 1.4 }}>
                  💡 Tlačítko <b>OSM zpřesnit</b> stáhne reálné polygony z OpenStreetMap pro každý region. Kategorie se pak převede na oblasti s přesnou geografií.
                </div>
                <button onClick={addThematicCat}
                  style={{ width: '100%', padding: '6px', borderRadius: 8, border: '1px dashed #bae6fd', background: '#f0f9ff', color: '#0369a1', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  + Přidat kategorii
                </button>
              </div>
            )}

            {/* Choropleth editor */}
            {editedMap.choropleth && (
              <div>
                <label style={lbl}>Název vrstvy</label>
                <input style={inp} value={editedMap.choropleth.title || ''}
                  onChange={e => setEditedMap(prev => ({
                    ...prev, choropleth: { ...prev.choropleth!, title: e.target.value },
                  }))} />
                <label style={{ ...lbl, marginTop: 10 }}>Kategorie</label>
                {editedMap.choropleth.categories.map((cat, ci) => (
                  <div key={ci} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, marginBottom: 6, background: '#f8fafc' }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                      <input type="color" value={cat.color}
                        onChange={e => updateChoroplethCat(ci, { color: e.target.value })}
                        style={{ width: 26, height: 26, border: 'none', borderRadius: 4, cursor: 'pointer' }} />
                      <input style={{ ...inp, flex: 1, fontWeight: 600 }}
                        value={cat.label}
                        onChange={e => updateChoroplethCat(ci, { label: e.target.value })}
                        placeholder="Název kategorie" />
                      <button
                        onClick={() => {
                          const cats = editedMap.choropleth!.categories.filter((_, j) => j !== ci);
                          setEditedMap(prev => ({ ...prev, choropleth: { ...prev.choropleth!, categories: cats } }));
                        }}
                        style={{ padding: 4, border: '1px solid #fca5a5', borderRadius: 6, background: '#fff', color: '#dc2626', cursor: 'pointer' }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                    <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 3 }}>ISO A3 kódy (oddělené čárkou)</div>
                    <input style={inp}
                      value={(cat.isoCodes || []).join(', ')}
                      onChange={e => updateChoroplethCat(ci, {
                        isoCodes: e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
                      })}
                      placeholder="DEU, AUT, CHE..." />
                  </div>
                ))}
                <button
                  onClick={() => {
                    const newCat: ChoroplethCategory = {
                      id: crypto.randomUUID(),
                      label: 'Nová kategorie',
                      color: HIGHLIGHT_COLORS[(editedMap.choropleth?.categories.length || 0) % HIGHLIGHT_COLORS.length],
                      isoCodes: [],
                    };
                    setEditedMap(prev => ({ ...prev, choropleth: { ...prev.choropleth!, categories: [...prev.choropleth!.categories, newCat] } }));
                  }}
                  style={{ width: '100%', padding: '6px', borderRadius: 8, border: '1px dashed #bae6fd', background: '#f0f9ff', color: '#0369a1', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  + Přidat kategorii
                </button>
              </div>
            )}

            {/* Areas editor */}
            {(editedMap.areas?.length ?? 0) > 0 && (
              <div>
                <label style={lbl}>Vlastní oblasti ({editedMap.areas!.length})</label>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8, lineHeight: 1.5 }}>
                  Hranice generuje AI (hrubé polygony). Tlačítko{' '}
                  <span style={{ fontWeight: 700, color: '#0369a1' }}>🌍 OSM</span>{' '}
                  stáhne přesné hranice z OpenStreetMap.
                </div>
                {editedMap.areas!.map((area, ai) => {
                  const pointCount = area.coords?.length ?? 0;
                  const isOsmLoading = osmLoadingIdx === ai;
                  const quality = pointCount < 20 ? 'low' : pointCount < 100 ? 'medium' : 'high';
                  const qualityColor = quality === 'low' ? '#ef4444' : quality === 'medium' ? '#f59e0b' : '#22c55e';
                  return (
                    <div key={area.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, marginBottom: 6, background: '#f8fafc' }}>
                      {/* Row 1: color + name + osm + delete */}
                      <div style={{ display: 'flex', gap: 6, marginBottom: 5, alignItems: 'center' }}>
                        <input type="color" value={area.color}
                          onChange={e => updateArea(ai, { color: e.target.value })}
                          style={{ width: 26, height: 26, border: 'none', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }} />
                        <input style={{ ...inp, flex: 1, fontWeight: 600 }}
                          value={area.label || area.name}
                          onChange={e => updateArea(ai, { label: e.target.value, name: e.target.value })}
                          placeholder="Název oblasti" />
                        <button
                          onClick={() => enhanceAreaWithOSM(ai)}
                          disabled={isOsmLoading}
                          title="Stáhnout přesné hranice z OpenStreetMap"
                          style={{
                            padding: '4px 7px', border: '1px solid #bae6fd', borderRadius: 6,
                            background: isOsmLoading ? '#f0f9ff' : '#e0f2fe',
                            color: '#0369a1', cursor: isOsmLoading ? 'wait' : 'pointer',
                            fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0,
                          }}>
                          {isOsmLoading ? '⏳' : <Globe size={11} />}
                          OSM
                        </button>
                        <button onClick={() => deleteArea(ai)}
                          style={{ padding: 4, border: '1px solid #fca5a5', borderRadius: 6, background: '#fff', color: '#dc2626', cursor: 'pointer', flexShrink: 0 }}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                      {/* Point count badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                        <span style={{
                          fontSize: 9, padding: '1px 7px', borderRadius: 99,
                          background: `${qualityColor}18`, color: qualityColor,
                          border: `1px solid ${qualityColor}40`, fontWeight: 700,
                        }}>
                          {pointCount} bodů · {quality === 'low' ? 'hrubé rozlišení' : quality === 'medium' ? 'střední' : 'detailní'}
                        </span>
                        {quality === 'low' && (
                          <span style={{ fontSize: 9, color: '#94a3b8' }}>→ klikni OSM pro zpřesnění</span>
                        )}
                      </div>
                      {/* Opacity + era */}
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 2 }}>Průhlednost</div>
                          <input type="range" min={0.1} max={0.9} step={0.05}
                            value={area.opacity ?? 0.4}
                            onChange={e => updateArea(ai, { opacity: parseFloat(e.target.value) })}
                            style={{ width: '100%' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 2 }}>Éra / rok</div>
                          <input style={inp} value={area.era || ''}
                            onChange={e => updateArea(ai, { era: e.target.value })}
                            placeholder="500 př.n.l." />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {layerType === 'none' && (
              <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: '12px 0', lineHeight: 1.6 }}>
                Žádná tematická vrstva.<br />
                Použijte AI Asistenta pro přidání vrstvy.
              </div>
            )}
          </Section>
        </div>

        {/* ══ Right panel – live map ══════════════════════════════════════════ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Map header */}
          <div style={{
            padding: '14px 20px', borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>
                🗺️ {editedMap.title}
              </div>
              {editedMap.description && (
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, maxWidth: 600 }}>
                  {editedMap.description}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <span style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 99,
                background: '#e0f2fe', color: '#0369a1', fontWeight: 600,
              }}>
                {REGION_LABELS[editedMap.region] || editedMap.region}
              </span>
              <span style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 99,
                background: '#ede9fe', color: '#6d28d9', fontWeight: 600,
              }}>
                {STYLE_LABELS[editedMap.style] || editedMap.style}
              </span>
              <span style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 99,
                background: '#f0fdf4', color: '#16a34a', fontWeight: 600,
              }}>
                {editedMap.markers.length} bodů
              </span>
            </div>
          </div>

          {/* Map canvas – overlays jsou součástí editedMap.overlays */}
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            <VividMap
              key={mapKey}
              map={editedMap}
              height={window.innerHeight - 130}
              overlays={editedMap.overlays}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
