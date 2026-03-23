/**
 * VividMap – mapová komponenta postavená na React Leaflet
 *
 * Tile layers:
 *   political  → CartoDB Positron (čisté hranice, popisky)
 *   physical   → OpenTopoMap (terén, výškopis)
 *   blank      → CartoDB bez popisků
 *   historical → CartoDB Voyager (teplý tón)
 *
 * Datové vrstvy:
 *   Choropleth  → Natural Earth 50m countries (má ISO_A3, žádný numeric-lookup hack)
 *   Custom areas → přímý GeoJSON (Leaflet zvládá velké polygony nativně)
 *   Rivers      → Natural Earth 10m, filtrováno dle scalerank + zoom
 *   Markers     → DivIcon s emoji, popup při kliknutí
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Marker,
  Popup,
  Polyline,
  useMap,
  useMapEvent,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// SVG renderer pro interaktivní vrstvy (hover events) — Canvas tyto eventy nepodporuje
const SVG_RENDERER = L.svg();

import type {
  SavedMap, MapMarker, MapHighlight, MapArea,
  MapChoropleth, ChoroplethCategory, MapRegionId,
  ThematicLayer, ThematicCategory,
} from '../../types/topic-dataset';

// ─── GeoJSON sources (deklaruj PŘED použitím) ─────────────────────────────────
const COUNTRIES_URL = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_admin_0_countries.geojson';
const RIVERS_URL    = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_10m_rivers_lake_centerlines.geojson';
const NE_LAND_URL   = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_land.geojson';
const NE_PLACES_URL = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_populated_places.geojson';
const NE_DATASETS: Record<string, string> = {
  'ne_regions':     'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_10m_geography_regions_polys.geojson',
  'ne_glaciers':    'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_10m_glaciated_areas.geojson',
  'ne_marine':      'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_10m_geography_marine_polys.geojson',
  'wwf_ecoregions': 'https://njbtqmsxbyvpwigfceke.supabase.co/storage/v1/object/public/geodata/wwf-ecoregions.geojson',
};

// ─── Tile layers ──────────────────────────────────────────────────────────────
const TILES: Record<string, { url: string; attr: string; maxZoom?: number; noTile?: boolean }> = {
  political:  { url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',  attr: '© OSM © CARTO' },
  physical:   { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',                     attr: '© OpenTopoMap', maxZoom: 17 },
  blank:      { url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', attr: '© Esri' },
  blank_pure: { url: '', attr: '', noTile: true },
  historical: { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', attr: '© CARTO' },
  satellite:  { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: '© Esri' },
  dark:       { url: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',   attr: '© CARTO' },
};

// Label-only overlay tiles (průhledné)
const LABEL_TILES = {
  light:   'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
  dark:    'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
};

// Hillshade
const HILLSHADE_URL = 'https://services.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}';

// ─── Modul-level cache (jednou fetchnuto = cachováno po celou session) ─────────
const geoCache = new Map<string, any>();
async function fetchGeo(url: string): Promise<any> {
  if (geoCache.has(url)) return geoCache.get(url);
  const r = await fetch(url);
  // Supabase Storage někdy vrátí 5xx (disk IO limit) ale data jsou platná –
  // zkusíme parsovat JSON bez ohledu na status
  let data: any;
  try {
    data = await r.json();
  } catch {
    throw new Error(`Fetch ${url} → ${r.status} (invalid JSON)`);
  }
  if (!data || !data.type) throw new Error(`Fetch ${url} → invalid GeoJSON`);
  geoCache.set(url, data);
  return data;
}

// ─── Region konfigurace (Leaflet zoom ≠ react-simple-maps zoom) ──────────────
const REGION_CONFIG: Record<MapRegionId, { center: [number, number]; zoom: number }> = {
  'world':          { center: [20,   0   ], zoom: 2 },
  'europe':         { center: [52,  15   ], zoom: 4 },
  'central-europe': { center: [50,  16   ], zoom: 5 },
  'mediterranean':  { center: [38,  18   ], zoom: 4 },
  'middle-east':    { center: [30,  40   ], zoom: 4 },
  'africa':         { center: [ 5,  20   ], zoom: 3 },
  'asia':           { center: [40,  90   ], zoom: 3 },
  'americas':       { center: [10, -75   ], zoom: 3 },
  'czech-republic': { center: [49.8, 15.5], zoom: 7 },
  'italy':          { center: [42,  12.5 ], zoom: 5 },
  'greece':         { center: [39,  22   ], zoom: 6 },
  'france':         { center: [47,   2   ], zoom: 5 },
  'germany':        { center: [51,  10   ], zoom: 6 },
  'custom':         { center: [52,  15   ], zoom: 4 },
};

// Scalerank → max rank dle Leaflet zoom
function maxRiverRank(z: number): number {
  if (z <= 2) return 1;
  if (z <= 3) return 3;
  if (z <= 4) return 5;
  if (z <= 6) return 7;
  if (z <= 9) return 9;
  return 12;
}

// ─── Konstanty ────────────────────────────────────────────────────────────────
export const HIGHLIGHT_COLORS = [
  '#6366f1','#f59e0b','#10b981','#f43f5e','#22d3ee','#a78bfa',
  '#34d399','#fb923c','#e11d48','#0ea5e9','#84cc16','#f97316',
  '#8b5cf6','#06b6d4','#14b8a6','#ec4899',
];

export const MARKER_ICONS: Record<MapMarker['type'], string> = {
  city: '🏙️', battle: '⚔️', landmark: '🏛️', capital: '⭐',
  river: '🌊', mountain: '⛰️', custom: '📍',
};

// ─── DivIcon pro emoji markery ────────────────────────────────────────────────
function createMarkerIcon(emoji: string, color: string, answered?: boolean, correct?: boolean) {
  const bg = answered ? (correct ? '#22c55e' : '#ef4444') : color;
  const html = `
    <div style="
      width:36px;height:36px;border-radius:50%;
      background:${bg}22;border:2.5px solid ${bg};
      display:flex;align-items:center;justify-content:center;
      font-size:18px;box-shadow:0 2px 8px ${bg}44;
      cursor:pointer;transition:transform .15s;
    ">${emoji}</div>`;
  return L.divIcon({ html, iconSize: [36, 36], iconAnchor: [18, 18], className: '' });
}

// ─── FitBounds – auto-zoom na markery ─────────────────────────────────────────
function FitBounds({ markers }: { markers: MapMarker[] }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length < 2) return;
    const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng] as [number, number]));
    map.fitBounds(bounds.pad(0.35), { animate: false, maxZoom: 12 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

// ─── ZoomTracker – hlídá zoom a spouští callback ──────────────────────────────
function ZoomTracker({ onZoom }: { onZoom: (z: number) => void }) {
  useMapEvent('zoomend', e => onZoom((e.target as L.Map).getZoom()));
  return null;
}

// ─── ChoroplethLayer – barví státy dle ISO A3 ────────────────────────────────
interface ChoroplethLayerProps {
  choroplethByIso: Record<string, ChoroplethCategory>;
  highlightByIso:  Record<string, MapHighlight>;
  cacheKey: string;
}
function ChoroplethLayer({ choroplethByIso, highlightByIso, cacheKey }: ChoroplethLayerProps) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetchGeo(COUNTRIES_URL).then(setData).catch(() => {}); }, []);
  if (!data) return null;
  return (
    <GeoJSON
      key={cacheKey}
      data={data}
      style={(feature) => {
        const iso = (feature?.properties?.ISO_A3 || feature?.properties?.iso_a3 || '').toUpperCase();
        const cat  = choroplethByIso[iso];
        const hl   = highlightByIso[iso];
        if (!cat && !hl) return { fillOpacity: 0, weight: 0 };
        return {
          fillColor:   cat?.color || hl?.color,
          fillOpacity: cat ? 0.75 : 0.55,
          weight:      0.5,
          color:       '#fff',
          opacity:     0.4,
        };
      }}
    />
  );
}

// ─── RiversLayer – přítoky dle scalerank × zoom ───────────────────────────────
function RiversLayer({ riverColor }: { riverColor: string }) {
  const map = useMap();
  const [data,   setData]   = useState<any>(null);
  const [zoomBracket, setZB] = useState<number>(() => {
    try { return Math.floor(map.getZoom()); } catch { return 2; }
  });

  useEffect(() => { fetchGeo(RIVERS_URL).then(setData).catch(() => {}); }, []);
  useEffect(() => {
    const onZoom = () => {
      const z = Math.floor(map.getZoom());
      setZB(prev => prev !== z ? z : prev);
    };
    map.on('zoomend', onZoom);
    return () => { map.off('zoomend', onZoom); };
  }, [map]);

  if (!data) return null;
  const maxRank = maxRiverRank(zoomBracket);

  return (
    <GeoJSON
      key={`rivers-${zoomBracket}`}
      data={data}
      filter={(f: any) => {
        if (f.properties?.featurecla === 'Lake') return false;
        return (f.properties?.scalerank ?? 9) <= maxRank;
      }}
      style={(f: any) => {
        const rank = f?.properties?.scalerank ?? 5;
        const importance = Math.max(0, 1 - rank / 12);
        return {
          color:   riverColor,
          weight:  0.5 + importance * 2,
          opacity: 0.55 + importance * 0.35,
        };
      }}
    />
  );
}

// ─── ThematicLayerRenderer – reálné geographic region polygony ──────────────
// Jedna GeoJSON vrstva pro všechny kategorie = rychlejší rendering (Canvas).
function ThematicLayerRenderer({ layer }: { layer: ThematicLayer }) {
  const [geoData, setGeoData] = useState<any>(null);
  const datasetUrl = NE_DATASETS[layer.dataset] ?? layer.dataset;

  useEffect(() => {
    if (!datasetUrl) return;
    fetchGeo(datasetUrl).then(setGeoData).catch(() => {});
  }, [datasetUrl]);

  const isWWF = datasetUrl.includes('wwf-ecoregions');

  // Sestav index: featureIdx → {color, catLabel}
  const colorIndex = useMemo(() => {
    if (!geoData) return null;
    const idx = new Map<number, { color: string; catLabel: string; featureName: string }>();
    layer.categories.forEach(cat => {
      const nameSet = new Set(cat.featureNames.map(n => n.toLowerCase()));
      if (!nameSet.size) return;
      geoData.features.forEach((f: any, i: number) => {
        if (idx.has(i)) return;
        let match = false;
        if (isWWF) {
          const biome = String(f.properties?.BIOME ?? '');
          const eco   = (f.properties?.ECO_NAME || '').toLowerCase();
          const code  = (f.properties?.eco_code  || '').toLowerCase();
          match = nameSet.has(biome) || nameSet.has(eco) || nameSet.has(code);
        } else {
          const en  = (f.properties?.NAME_EN  || '').toLowerCase();
          const nm  = (f.properties?.NAME     || '').toLowerCase();
          const alt = (f.properties?.NAMEALT  || '').toLowerCase();
          match = nameSet.has(en) || nameSet.has(nm) || nameSet.has(alt);
        }
        if (match) {
          const featureName = isWWF
            ? (f.properties?.ECO_NAME || '')
            : (f.properties?.NAME_EN || f.properties?.NAME || '');
          idx.set(i, { color: cat.color, catLabel: cat.label, featureName });
        }
      });
    });
    return idx;
  }, [geoData, layer, isWWF]);

  if (!geoData || !colorIndex || colorIndex.size === 0) return null;

  // Jedna FeatureCollection – jen matching features
  const features = geoData.features.filter((_: any, i: number) => colorIndex.has(i));
  if (!features.length) return null;

  return (
    <GeoJSON
      key={`thematic-${layer.dataset}-${layer.categories.length}-${colorIndex.size}`}
      data={{ type: 'FeatureCollection', features } as any}
      style={(feature: any) => {
        const i = geoData.features.indexOf(feature);
        const entry = colorIndex.get(i);
        if (!entry) return { fillOpacity: 0, weight: 0, stroke: false };
        return {
          fillColor:   entry.color,
          fillOpacity: 0.65,
          weight:      0.8,
          color:       entry.color,
          opacity:     0.85,
        };
      }}
      onEachFeature={(feature: any, leafLayer: any) => {
        const i = geoData.features.indexOf(feature);
        const entry = colorIndex.get(i);
        if (!entry) return;
        leafLayer.bindTooltip(
          `<strong>${entry.catLabel}</strong>${entry.featureName ? `<br/><small>${entry.featureName}</small>` : ''}`,
          { sticky: true, className: 'vivid-area-tooltip' }
        );
      }}
    />
  );
}

// ─── AreasLayer – vlastní polygony (sféra vlivu, historické hranice…) ─────────
// Každý polygon renderujeme separátně = spolehlivé individuální styly
function AreasLayer({ areas }: { areas: MapArea[] }) {
  if (!areas.length) return null;

  return (
    <>
      {areas.map(area => {
        // GeoJSON Polygon: coordinates = [ [ [lng, lat], ... ] ]
        const geojsonFeature = {
          type:       'Feature'  as const,
          properties: area,
          geometry: {
            type:        'Polygon' as const,
            coordinates: [[
              ...area.coords.map(([lng, lat]) => [lng, lat] as [number, number]),
              area.coords[0] as [number, number],   // uzavřít polygon
            ]],
          },
        };

        return (
          <GeoJSON
            key={area.id}
            data={geojsonFeature as any}
            style={() => ({
              fillColor:   area.color,
              fillOpacity: Math.max(area.opacity ?? 0.5, 0.45),
              weight:      2.5,
              color:       area.color,
              opacity:     0.9,
            })}
            onEachFeature={(_feat, layer: any) => {
              const label = area.label || area.name;
              if (label) {
                layer.bindTooltip(
                  `<strong>${label}</strong>${area.era ? ` <small>(${area.era})</small>` : ''}`,
                  { permanent: true, direction: 'center', className: 'vivid-area-tooltip' }
                );
              }
            }}
          />
        );
      })}
    </>
  );
}

// ─── LabelsLayer – popisky měst/hlavních měst/států ─────────────────────────
// 'countries' = tile overlay (všechny státy + velká sídla, zoom-dependent)
// 'capitals'  = GeoJSON DivIcon markery pro hlavní města
// 'cities'    = tile overlay (standardní hustota)
// 'all'       = tile overlay hustší + GeoJSON hlavní města
function LabelsLayer({ mode, dark }: { mode: LabelMode; dark: boolean }) {
  const tileUrl = dark ? LABEL_TILES.dark : LABEL_TILES.light;

  // GeoJSON hlavní města (ne_50m_populated_places)
  const [places, setPlaces] = useState<any>(null);
  const needGeoJSON = mode === 'capitals' || mode === 'all';
  useEffect(() => {
    if (needGeoJSON) fetchGeo(NE_PLACES_URL).then(setPlaces).catch(() => {});
  }, [needGeoJSON]);

  // Styl DivIcon pro popisek sídla
  const labelIcon = useCallback((name: string, isCapital: boolean) => {
    const color = dark ? '#e2e8f0' : '#1e293b';
    const shadow = dark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)';
    return L.divIcon({
      html: `<div style="
        font-size: ${isCapital ? 11 : 9.5}px;
        font-weight: ${isCapital ? 800 : 600};
        color: ${color};
        text-shadow: 0 0 4px ${shadow}, 0 0 4px ${shadow};
        white-space: nowrap;
        pointer-events: none;
        font-family: system-ui, sans-serif;
        letter-spacing: ${isCapital ? 0.3 : 0}px;
      ">${isCapital ? '★ ' : ''}${name}</div>`,
      className: '',
      iconAnchor: [0, 0],
    });
  }, [dark]);

  return (
    <>
      {/* Tile overlay – countries/cities/all */}
      {(mode === 'countries' || mode === 'cities' || mode === 'all') && (
        <TileLayer
          url={tileUrl}
          attribution='© <a href="https://carto.com">CARTO</a>'
          opacity={mode === 'countries' ? 0.5 : 1}
          maxZoom={19}
        />
      )}

      {/* GeoJSON popisky – capitals/all */}
      {needGeoJSON && places && (() => {
        const features = places.features.filter((f: any) => {
          const cls = f.properties?.FEATURECLA || '';
          return cls.includes('capital') || cls === 'Admin-0 capital';
        });
        return features.map((f: any) => {
          const [lng, lat] = f.geometry.coordinates;
          const name = f.properties?.NAME || '';
          const isCapital = (f.properties?.FEATURECLA || '').includes('Admin-0');
          if (!name) return null;
          return (
            <Marker
              key={`lbl-${name}`}
              position={[lat, lng]}
              icon={labelIcon(name, isCapital)}
              interactive={false}
            />
          );
        });
      })()}
    </>
  );
}

// ─── PureLandLayer – pro blank_pure: pevnina bez tile, s hover zvýrazněním ────
function PureLandLayer() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetchGeo(COUNTRIES_URL).then(setData).catch(() => {}); }, []);
  if (!data) return null;

  const onEachFeature = (_: any, layer: any) => {
    const name = layer.feature?.properties?.NAME || layer.feature?.properties?.NAME_EN || '';
    const formal = layer.feature?.properties?.FORMAL_EN || '';

    layer.on({
      mouseover(e: any) {
        e.target.setStyle({ fillColor: '#c8b9a2', fillOpacity: 1 });
        e.target.bringToFront();
        if (name) {
          layer.bindTooltip(
            `<strong>${name}</strong>${formal && formal !== name ? `<br/><span style="font-size:10px;color:#64748b">${formal}</span>` : ''}`,
            { sticky: true, className: 'vivid-country-tooltip' }
          ).openTooltip();
        }
      },
      mouseout(e: any) {
        e.target.setStyle({ fillColor: '#eee8dc', fillOpacity: 1 });
        layer.closeTooltip();
      },
    });
  };

  return (
    <GeoJSON
      key="pure-land"
      data={data}
      renderer={SVG_RENDERER}
      style={() => ({
        fillColor:   '#eee8dc',
        fillOpacity: 1,
        weight:      0.6,
        color:       '#b5a898',
        opacity:     0.9,
      })}
      onEachFeature={onEachFeature}
    />
  );
}

// ─── CountryHoverLayer – průhledná interaktivní vrstva pro tile mapy ──────────
// Na tile mapách (political, physical…) jsou hranice v dlaždicích — hover stát
// ale chceme pořád, takže přidáme průhlednou GeoJSON vrstvu jen pro interakci.
function CountryHoverLayer() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetchGeo(COUNTRIES_URL).then(setData).catch(() => {}); }, []);
  if (!data) return null;

  const onEachFeature = (_: any, layer: any) => {
    const name = layer.feature?.properties?.NAME || layer.feature?.properties?.NAME_EN || '';
    const formal = layer.feature?.properties?.FORMAL_EN || '';

    layer.on({
      mouseover(e: any) {
        e.target.setStyle({ fillColor: '#6366f1', fillOpacity: 0.15, weight: 1.5, color: '#6366f1', opacity: 0.6 });
        e.target.bringToFront();
        if (name) {
          layer.bindTooltip(
            `<strong>${name}</strong>${formal && formal !== name ? `<br/><span style="font-size:10px;color:#64748b">${formal}</span>` : ''}`,
            { sticky: true, className: 'vivid-country-tooltip' }
          ).openTooltip();
        }
      },
      mouseout(e: any) {
        e.target.setStyle({ fillOpacity: 0, weight: 0 });
        layer.closeTooltip();
      },
    });
  };

  return (
    <GeoJSON
      key="hover-layer"
      data={data}
      renderer={SVG_RENDERER}
      style={() => ({ fillOpacity: 0, weight: 0, stroke: false })}
      onEachFeature={onEachFeature}
    />
  );
}

// ─── CountryBordersLayer ──────────────────────────────────────────────────────
function CountryBordersLayer({ color = '#64748b', opacity = 0.5, weight = 0.7 }: {
  color?: string; opacity?: number; weight?: number;
}) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetchGeo(COUNTRIES_URL).then(setData).catch(() => {}); }, []);
  if (!data) return null;
  return (
    <GeoJSON
      key="borders"
      data={data}
      style={() => ({ fillOpacity: 0, weight, color, opacity, stroke: true })}
    />
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
export type LabelMode = 'none' | 'countries' | 'capitals' | 'cities' | 'all';

export interface MapOverlays {
  showBorders?: boolean;
  labelMode?: LabelMode;
  showTerrain?: boolean;
  showRivers?: boolean;
  borderColor?: string;
  borderOpacity?: number;
}

interface VividMapProps {
  map: SavedMap;
  editable?: boolean;
  onUpdate?: (updated: SavedMap) => void;
  height?: number;
  quizMode?: boolean;
  overlays?: MapOverlays;
  onAnswer?: (correct: boolean, markerName: string) => void;
}

// ─── Hlavní VividMap komponenta ───────────────────────────────────────────────
export function VividMap({ map, height = 400, quizMode = false, onAnswer, overlays: overlaysProp }: VividMapProps) {
  // overlays prop wins over map.overlays (backwards compat for callers that pass overlays directly)
  const overlays: MapOverlays = overlaysProp ?? map.overlays ?? {};
  const [clickedMarker, setClickedMarker] = useState<MapMarker | null>(null);
  const [quizAnswered,  setQuizAnswered]  = useState<Set<string>>(new Set());
  const [quizCorrect,   setQuizCorrect]   = useState<Set<string>>(new Set());

  const regionCfg  = REGION_CONFIG[map.region] ?? REGION_CONFIG['europe'];
  const tile       = TILES[map.style] ?? TILES.political;
  const riverColor = map.style === 'physical' ? '#38bdf8' : map.style === 'historical' ? '#60aee0' : '#5eabf0';
  const isDark     = map.style === 'dark' || map.style === 'satellite';

  // Choropleth: ISO → kategorie
  const choroplethByIso = useMemo(() => {
    const m: Record<string, ChoroplethCategory> = {};
    (map.choropleth?.categories || []).forEach(cat =>
      (cat.isoCodes || []).forEach(iso => { m[iso.toUpperCase()] = cat; })
    );
    return m;
  }, [map.choropleth]);

  // Highlights: ISO → highlight
  const highlightByIso = useMemo(() => {
    const m: Record<string, MapHighlight> = {};
    (map.highlights || []).forEach(h => { if (h.isoCode) m[h.isoCode.toUpperCase()] = h; });
    return m;
  }, [map.highlights]);

  const hasChoropleth   = Object.keys(choroplethByIso).length > 0;
  const hasHighlights   = Object.keys(highlightByIso).length > 0;
  const needCountryLayer = hasChoropleth || hasHighlights;

  const choroplethKey = `${JSON.stringify(map.choropleth)}-${JSON.stringify(map.highlights)}`;

  const handleMarkerClick = (marker: MapMarker) => {
    if (quizMode) {
      const correct = map.correctAnswers?.includes(marker.id) ?? true;
      setQuizAnswered(prev => new Set(prev).add(marker.id));
      if (correct) setQuizCorrect(prev => new Set(prev).add(marker.id));
      onAnswer?.(correct, marker.name);
    } else {
      setClickedMarker(prev => prev?.id === marker.id ? null : marker);
    }
  };

  // Legenda
  const legendItems = useMemo(() => {
    const items: { color: string; label: string; era?: string }[] = [];
    if (hasChoropleth && map.choropleth) {
      map.choropleth.categories.forEach(cat => items.push({ color: cat.color, label: cat.label }));
    }
    // Tematická vrstva
    if (map.thematicLayer) {
      map.thematicLayer.categories.forEach(cat => items.push({ color: cat.color, label: cat.label }));
    }
    (map.highlights || []).forEach(h => items.push({ color: h.color, label: h.label || h.name, era: h.era }));
    (map.areas     || []).forEach(a => items.push({ color: a.color, label: a.label || a.name,  era: a.era  }));
    return items;
  }, [map.choropleth, map.thematicLayer, map.highlights, map.areas, hasChoropleth]);

  const markers = map.markers || [];
  const autoFit = markers.length >= 2;

  return (
    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', height, border: '1px solid #e2e8f0' }}>
      {/* Název mapy */}
      {map.title && (
        <div style={{
          position: 'absolute', top: 10, left: 10, zIndex: 1000,
          fontSize: 13, fontWeight: 800, color: '#0f172a',
          background: 'rgba(255,255,255,0.95)', padding: '4px 12px',
          borderRadius: 8, boxShadow: '0 1px 8px rgba(0,0,0,0.1)',
          backdropFilter: 'blur(4px)', pointerEvents: 'none', maxWidth: '60%',
        }}>
          {map.title}
        </div>
      )}

      {/* Badge cvičení */}
      {map.exerciseType !== 'info' && (
        <div style={{
          position: 'absolute', top: 10, right: 10, zIndex: 1000,
          fontSize: 11, fontWeight: 700, color: 'white',
          background: '#6366f1', padding: '3px 10px',
          borderRadius: 99, boxShadow: '0 1px 4px rgba(99,102,241,0.4)',
          pointerEvents: 'none',
        }}>
          {map.exerciseType === 'identify' ? '🎯 Kvíz' :
           map.exerciseType === 'label'    ? '✍️ Označování' :
           map.exerciseType === 'color'    ? '🎨 Barvení' : '🗺️ Trasa'}
        </div>
      )}

      <MapContainer
        center={regionCfg.center}
        zoom={regionCfg.zoom}
        style={{
          height,
          width: '100%',
          // blank_pure = ocean-modrý CSS background, žádná tile
          background: tile.noTile ? '#c8dff0' : undefined,
        }}
        zoomControl={true}
        scrollWheelZoom={true}
        preferCanvas={true}
        key={`${map.id}-${map.region}`}
      >
        {/* Base tile layer – vynechej pro blank_pure */}
        {!tile.noTile && (
          <TileLayer url={tile.url} attribution={tile.attr} maxZoom={tile.maxZoom ?? 19} />
        )}

        {/* blank_pure: GeoJSON pevnina místo tile — vše z Natural Earth → dokonalý soulad */}
        {tile.noTile && <PureLandLayer />}

        {/* Hover vrstva pro tile mapy — průhledná, jen pro interakci (hover + tooltip) */}
        {!tile.noTile && <CountryHoverLayer />}

        {/* Hillshade / reliéf overlay */}
        {overlays.showTerrain && (
          <TileLayer
            url={HILLSHADE_URL}
            attribution='© <a href="https://www.esri.com">Esri</a>'
            opacity={0.45}
            maxZoom={19}
          />
        )}

        {/* Auto-fit na markery */}
        {autoFit && <FitBounds markers={markers} />}

        {/* Choropleth + highlights */}
        {needCountryLayer && (
          <ChoroplethLayer
            choroplethByIso={choroplethByIso}
            highlightByIso={highlightByIso}
            cacheKey={choroplethKey}
          />
        )}

        {/* Státní hranice overlay (Natural Earth GeoJSON)
            Pro blank_pure: zapni defaultně (pokud overlays.showBorders není explicitně false)
            Pro ostatní styly: zapni jen pokud overlays.showBorders === true
            Míchat NE hranice přes tile poskytovatele způsobuje nesoulad! */}
        {(map.style === 'blank_pure'
          ? overlays.showBorders !== false   // default ON pro blank_pure
          : overlays.showBorders === true    // default OFF pro tile mapy
        ) && (
          <CountryBordersLayer
            color={overlays.borderColor || (isDark ? '#94a3b8' : '#475569')}
            opacity={overlays.borderOpacity ?? (isDark ? 0.6 : 0.45)}
            weight={isDark ? 0.8 : 0.6}
          />
        )}

        {/* Tematická vrstva (reálné NE regiony / WWF) */}
        {map.thematicLayer && <ThematicLayerRenderer layer={map.thematicLayer} />}

        {/* Vlastní oblasti (polygony) */}
        {(map.areas?.length ?? 0) > 0 && <AreasLayer areas={map.areas!} />}

        {/* Řeky */}
        {(overlays.showRivers !== undefined
          ? overlays.showRivers
          : (map.style === 'physical' || map.style === 'historical')
        ) && <RiversLayer riverColor={riverColor} />}

        {/* Popisky – tile overlay nebo GeoJSON vrstva */}
        {overlays.labelMode && overlays.labelMode !== 'none' && (
          <LabelsLayer mode={overlays.labelMode} dark={isDark} />
        )}

        {/* Trasy */}
        {(map.routes || []).map(route =>
          route.points.length >= 2 ? (
            <Polyline
              key={route.id}
              positions={route.points.map(([lng, lat]) => [lat, lng] as [number, number])}
              color={route.color}
              weight={3}
              dashArray={route.style === 'dashed' ? '8 6' : route.style === 'dotted' ? '2 6' : undefined}
            />
          ) : null
        )}

        {/* Markery */}
        {markers.map(marker => {
          const answered = quizAnswered.has(marker.id);
          const correct  = quizCorrect.has(marker.id);
          const color    = marker.color || '#6366f1';
          const emoji    = marker.icon || MARKER_ICONS[marker.type] || '📍';
          const icon     = createMarkerIcon(emoji, color, answered ? true : undefined, correct);
          const isOpen   = clickedMarker?.id === marker.id;

          return (
            <Marker
              key={marker.id}
              position={[marker.lat, marker.lng]}
              icon={icon}
              eventHandlers={{ click: () => handleMarkerClick(marker) }}
            >
              {(marker.description || marker.year) && !quizMode && (
                <Popup autoPan={false}>
                  <div style={{ minWidth: 160, maxWidth: 220, fontSize: 12 }}>
                    <strong style={{ color, fontSize: 13 }}>{marker.name}</strong>
                    {marker.year && <span style={{ color: '#94a3b8', marginLeft: 6 }}>({marker.year})</span>}
                    {marker.description && <p style={{ margin: '6px 0 0', lineHeight: 1.5, color: '#334155' }}>{marker.description}</p>}
                  </div>
                </Popup>
              )}
            </Marker>
          );
        })}

        {/* Popis cvičení */}
        {map.description && map.exerciseType !== 'info' && (
          <div style={{ display: 'none' }} />
        )}
      </MapContainer>

      {/* Legenda (mimo MapContainer kvůli z-indexu) */}
      {legendItems.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 28, left: 10, zIndex: 1000,
          background: 'rgba(255,255,255,0.97)', borderRadius: 10,
          padding: '8px 12px', fontSize: 11,
          boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
          maxHeight: height * 0.45, overflowY: 'auto', maxWidth: 230,
          backdropFilter: 'blur(6px)', pointerEvents: 'none',
        }}>
          {map.choropleth?.title && (
            <div style={{ fontWeight: 800, fontSize: 11.5, color: '#0f172a', marginBottom: 6, borderBottom: '1px solid #f1f5f9', paddingBottom: 4 }}>
              {map.choropleth.title}
            </div>
          )}
          {legendItems.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              <div style={{ width: 13, height: 13, borderRadius: 3, background: item.color, flexShrink: 0, border: `1px solid ${item.color}99` }} />
              <span style={{ color: '#334155', fontWeight: 500, lineHeight: 1.35 }}>{item.label}</span>
              {item.era && <span style={{ color: '#94a3b8', fontSize: 9 }}>({item.era})</span>}
            </div>
          ))}
        </div>
      )}

      {/* Zadání cvičení */}
      {map.description && map.exerciseType !== 'info' && (
        <div style={{
          position: 'absolute', bottom: 28, right: 10, zIndex: 1000,
          background: 'rgba(99,102,241,0.08)', border: '1px solid #c7d2fe',
          borderRadius: 8, padding: '6px 12px', fontSize: 11,
          color: '#4338ca', maxWidth: 200, pointerEvents: 'none',
          backdropFilter: 'blur(4px)',
        }}>
          {map.description}
        </div>
      )}

      {/* Atribuce river data */}
      <div style={{ position: 'absolute', bottom: 4, left: 55, zIndex: 999, fontSize: 8, color: 'rgba(100,116,139,0.5)', pointerEvents: 'none' }}>
        Rivers © Natural Earth (CC0)
      </div>
    </div>
  );
}

// ─── Tooltip CSS pro oblasti ──────────────────────────────────────────────────
// Injektujeme do dokumentu jednou
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    .vivid-area-tooltip {
      background: rgba(255,255,255,0.95) !important;
      border: none !important;
      border-radius: 6px !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.12) !important;
      padding: 4px 8px !important;
      pointer-events: none !important;
    }
    .vivid-area-tooltip::before { display: none !important; }
  `;
  if (!document.head.querySelector('[data-vivid-map-styles]')) {
    style.setAttribute('data-vivid-map-styles', '1');
    document.head.appendChild(style);
  }
}

// ─── MapDataEditor ─────────────────────────────────────────────────────────────
interface MapDataEditorProps {
  map: SavedMap;
  onUpdate: (updated: SavedMap) => void;
}

export function MapDataEditor({ map, onUpdate }: MapDataEditorProps) {
  const set = (patch: Partial<SavedMap>) => onUpdate({ ...map, ...patch });

  return (
    <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Název mapy</label>
        <input value={map.title} onChange={e => set({ title: e.target.value })}
          style={{ width: '100%', padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }} />
      </div>
      <div>
        <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Zadání cvičení</label>
        <textarea value={map.description || ''} onChange={e => set({ description: e.target.value })} rows={2}
          style={{ width: '100%', padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, resize: 'vertical' }}
          placeholder="Např. Označ na mapě hlavní město Francie" />
      </div>
      <div>
        <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
          Body zájmu ({(map.markers || []).length})
        </label>
        {(map.markers || []).map((m, i) => (
          <div key={m.id} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{MARKER_ICONS[m.type]}</span>
            <input value={m.name} onChange={e => { const arr = [...map.markers]; arr[i] = { ...m, name: e.target.value }; set({ markers: arr }); }}
              style={{ flex: 1, padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11, fontWeight: 600 }} />
            <input type="number" value={m.lat} step={0.1}
              onChange={e => { const arr = [...map.markers]; arr[i] = { ...m, lat: parseFloat(e.target.value) }; set({ markers: arr }); }}
              style={{ width: 60, padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 10 }} title="lat" />
            <input type="number" value={m.lng} step={0.1}
              onChange={e => { const arr = [...map.markers]; arr[i] = { ...m, lng: parseFloat(e.target.value) }; set({ markers: arr }); }}
              style={{ width: 60, padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 10 }} title="lng" />
            <button onClick={() => set({ markers: map.markers.filter((_, j) => j !== i) })}
              style={{ padding: '4px 6px', borderRadius: 6, border: 'none', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}>✕</button>
          </div>
        ))}
        <button
          onClick={() => set({ markers: [...(map.markers || []), { id: crypto.randomUUID(), name: 'Nový bod', lat: 45, lng: 12, type: 'custom' as const, color: HIGHLIGHT_COLORS[(map.markers || []).length % HIGHLIGHT_COLORS.length] }] })}
          style={{ width: '100%', padding: '5px', borderRadius: 6, border: '1px dashed #c7d2fe', background: 'white', color: '#6366f1', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
          + Přidat bod
        </button>
      </div>
    </div>
  );
}
