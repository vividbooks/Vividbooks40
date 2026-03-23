/**
 * VizApp – Vega-Lite vizualizér pro admin
 *
 * Funkce:
 *   - AI generuje Vega-Lite v6 specifikace (grafy + mapy)
 *   - Náhled v reálném čase přes vega-embed
 *   - Ukládání vizualizací do localStorage
 *   - Export PNG
 *   - Typy: bar, line, area, pie, scatter, heatmap, timeline, choropleth mapa světa / Evropy
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BarChart2, TrendingUp, PieChart, ScatterChart,
  Globe, Map, Save, Trash2, Download, Wand2, Plus, ChevronRight,
  ChevronDown, Eye, Code2, Loader2, RefreshCw, LayoutGrid, Palette,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Typy ─────────────────────────────────────────────────────────────────────

type ChartTypeId =
  | 'bar' | 'bar-h' | 'line' | 'area' | 'pie'
  | 'scatter' | 'heatmap' | 'timeline'
  | 'map-world' | 'map-europe';

interface SavedViz {
  id: string;
  title: string;
  chartType: ChartTypeId;
  spec: object;
  topic: string;
  createdAt: string;
}

// ─── Konstanty ────────────────────────────────────────────────────────────────

const CHART_TYPES: {
  id: ChartTypeId; label: string; emoji: string; group: string; desc: string;
}[] = [
  { id: 'bar',      label: 'Sloupcový',           emoji: '📊', group: 'Grafy',  desc: 'Porovnání kategorií' },
  { id: 'bar-h',    label: 'Vodorovný sloupcový', emoji: '📉', group: 'Grafy',  desc: 'Žebříčky, pořadí' },
  { id: 'line',     label: 'Spojnicový',           emoji: '📈', group: 'Grafy',  desc: 'Vývoj v čase' },
  { id: 'area',     label: 'Plošný',              emoji: '🌊', group: 'Grafy',  desc: 'Kumulativní trendy' },
  { id: 'pie',      label: 'Koláčový',            emoji: '🥧', group: 'Grafy',  desc: 'Podíly celku' },
  { id: 'scatter',  label: 'Bodový',              emoji: '🔵', group: 'Grafy',  desc: 'Korelace dvou hodnot' },
  { id: 'heatmap',  label: 'Heatmapa',            emoji: '🔥', group: 'Grafy',  desc: 'Matice hodnot barvou' },
  { id: 'timeline', label: 'Časová osa',          emoji: '⏳', group: 'Grafy',  desc: 'Chronologické události' },
  { id: 'map-world',   label: 'Mapa světa',    emoji: '🌍', group: 'Mapy', desc: 'Choropleth – státy světa' },
  { id: 'map-europe',  label: 'Mapa Evropy',   emoji: '🗺️', group: 'Mapy', desc: 'Choropleth – státy Evropy' },
];

const COLOR_SCHEMES: { id: string; label: string }[] = [
  { id: 'blues',     label: '🔵 Modrá' },
  { id: 'greens',    label: '🟢 Zelená' },
  { id: 'oranges',   label: '🟠 Oranžová' },
  { id: 'reds',      label: '🔴 Červená' },
  { id: 'purples',   label: '🟣 Fialová' },
  { id: 'tableau10', label: '🎨 Tableau 10' },
  { id: 'set2',      label: '🌈 Pastelová' },
];

const LS_KEY = 'vividbooks-saved-vizs';

function loadSaved(): SavedViz[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function persistSaved(vizs: SavedViz[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(vizs));
}

// ─── VegaChart sub-komponenta ─────────────────────────────────────────────────

function VegaChart({
  spec,
  onViewReady,
}: {
  spec: object | null;
  onViewReady?: (view: any) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !spec) return;
    let cancelled = false;

    (async () => {
      try {
        const { default: embed } = await import('vega-embed');
        if (cancelled || !containerRef.current) return;

        // Cleanup předchozí instance
        resultRef.current?.finalize();
        resultRef.current = null;

        const result = await embed(containerRef.current, spec as any, {
          actions: { export: true, source: false, compiled: false, editor: false },
          renderer: 'canvas',
          theme: 'vox',
        });

        if (cancelled) {
          result.finalize();
          return;
        }
        resultRef.current = result;
        onViewReady?.(result.view);
      } catch (err) {
        console.error('[VizApp] vega-embed error:', err);
      }
    })();

    return () => {
      cancelled = true;
      resultRef.current?.finalize();
      resultRef.current = null;
    };
  }, [spec]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!spec) return null;
  return <div ref={containerRef} className="vega-embed-container" />;
}

// ─── Spec buildery pro mapy ───────────────────────────────────────────────────

const WORLD_TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Kategorická schémata jsou nevhodná pro choropleth – přemapujeme je na sekvenční
const MAP_SCHEME_MAP: Record<string, string> = {
  tableau10: 'oranges',
  set2: 'greens',
  set1: 'reds',
  set3: 'purples',
  category10: 'blues',
  category20: 'blues',
  accent: 'teals',
  dark2: 'greys',
};

function toMapScheme(scheme: string): string {
  return MAP_SCHEME_MAP[scheme] ?? scheme;
}

function buildWorldMapSpec(
  title: string,
  valueTitle: string,
  countries: { id: number; name: string; value: number }[],
  scheme: string,
  projection: object = { type: 'naturalEarth1' },
  size: { width: number; height: number } = { width: 600, height: 380 },
) {
  const mapScheme = toMapScheme(scheme);
  const vals = countries.map(c => c.value).filter(v => typeof v === 'number' && !isNaN(v));
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);

  // Jednoduchá (ne-layer) struktura – identická s preview spec patternem
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    title: { text: title, fontSize: 15, fontWeight: 700, color: '#0f172a' },
    width: size.width,
    height: size.height,
    projection,
    data: {
      url: WORLD_TOPO_URL,
      format: { type: 'topojson', feature: 'countries' },
    },
    transform: [
      {
        lookup: 'id',
        from: { data: { values: countries }, key: 'id', fields: ['value', 'name'] },
      },
    ],
    mark: { type: 'geoshape', stroke: 'white', strokeWidth: 0.5 },
    encoding: {
      color: {
        condition: {
          test: 'datum.value !== null && datum.value !== undefined',
          field: 'value',
          type: 'quantitative',
          scale: { scheme: mapScheme, domain: [minVal, maxVal] },
          title: valueTitle,
        },
        value: '#e2e8f0',
      },
      tooltip: [
        { field: 'name', title: 'Stát' },
        { field: 'value', title: valueTitle, format: '.2f' },
      ],
    },
    config: { background: '#dbeafe', view: { stroke: null } },
  };
}

function buildEuropeMapSpec(
  title: string,
  valueTitle: string,
  countries: { id: number; name: string; value: number }[],
  scheme: string,
) {
  return buildWorldMapSpec(
    title, valueTitle, countries, scheme,
    { type: 'mercator', center: [13, 52], scale: 560 },
    { width: 580, height: 420 },
  );
}

// ─── Preview specs (okamžitý náhled při výběru typu) ─────────────────────────

const PREVIEW_SPECS: Record<ChartTypeId, object> = {
  bar: {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    title: { text: 'Rozloha kontinentů', fontSize: 14, fontWeight: 700, color: '#0f172a' },
    width: 500, height: 320,
    mark: { type: 'bar', cornerRadiusTopLeft: 4, cornerRadiusTopRight: 4 },
    data: { values: [
      { kontinent: 'Asie', rozloha: 44614 }, { kontinent: 'Afrika', rozloha: 30365 },
      { kontinent: 'Amerika', rozloha: 42330 }, { kontinent: 'Antarktida', rozloha: 13720 },
      { kontinent: 'Evropa', rozloha: 10530 }, { kontinent: 'Austrálie', rozloha: 7688 },
    ]},
    encoding: {
      x: { field: 'kontinent', type: 'nominal', title: 'Kontinent', axis: { labelAngle: 0 } },
      y: { field: 'rozloha', type: 'quantitative', title: 'Rozloha (tis. km²)' },
      color: { field: 'kontinent', type: 'nominal', scale: { scheme: 'tableau10' }, legend: null },
      tooltip: [{ field: 'kontinent', title: 'Kontinent' }, { field: 'rozloha', title: 'tis. km²', format: ',' }],
    },
    config: { font: 'system-ui', background: '#f8fafc', view: { stroke: null } },
  },

  'bar-h': {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    title: { text: 'Délka největších řek světa', fontSize: 14, fontWeight: 700, color: '#0f172a' },
    width: 500, height: 320,
    mark: { type: 'bar', cornerRadiusTopRight: 4, cornerRadiusBottomRight: 4 },
    data: { values: [
      { reka: 'Nil', delka: 6650 }, { reka: 'Amazonka', delka: 6400 },
      { reka: 'Jang-c-tiang', delka: 6300 }, { reka: 'Mississippi', delka: 6275 },
      { reka: 'Jenisej', delka: 5539 }, { reka: 'Žlutá řeka', delka: 5464 },
    ]},
    encoding: {
      y: { field: 'reka', type: 'nominal', title: 'Řeka', sort: '-x' },
      x: { field: 'delka', type: 'quantitative', title: 'Délka (km)' },
      color: { field: 'delka', type: 'quantitative', scale: { scheme: 'blues' }, legend: null },
      tooltip: [{ field: 'reka', title: 'Řeka' }, { field: 'delka', title: 'Délka (km)', format: ',' }],
    },
    config: { font: 'system-ui', background: '#f8fafc', view: { stroke: null } },
  },

  line: {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    title: { text: 'Vývoj populace světa (1950–2024)', fontSize: 14, fontWeight: 700, color: '#0f172a' },
    width: 500, height: 300,
    mark: { type: 'line', point: true, strokeWidth: 2.5 },
    data: { values: [
      { rok: 1950, populace: 2.5 }, { rok: 1960, populace: 3.0 }, { rok: 1970, populace: 3.7 },
      { rok: 1980, populace: 4.4 }, { rok: 1990, populace: 5.3 }, { rok: 2000, populace: 6.1 },
      { rok: 2010, populace: 6.9 }, { rok: 2020, populace: 7.8 }, { rok: 2024, populace: 8.1 },
    ]},
    encoding: {
      x: { field: 'rok', type: 'quantitative', title: 'Rok', axis: { format: 'd' } },
      y: { field: 'populace', type: 'quantitative', title: 'Populace (mld.)' },
      color: { value: '#6366f1' },
      tooltip: [{ field: 'rok', title: 'Rok', format: 'd' }, { field: 'populace', title: 'mld. obyvatel' }],
    },
    config: { font: 'system-ui', background: '#f8fafc', view: { stroke: null } },
  },

  area: {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    title: { text: 'Energetický mix ČR (2023)', fontSize: 14, fontWeight: 700, color: '#0f172a' },
    width: 500, height: 300,
    mark: { type: 'area', opacity: 0.85 },
    data: { values: [
      { zdroj: 'Jaderná', rok: 2000, podil: 18 }, { zdroj: 'Uhelná', rok: 2000, podil: 55 },
      { zdroj: 'Obnovitelné', rok: 2000, podil: 4 }, { zdroj: 'Plynová', rok: 2000, podil: 8 },
      { zdroj: 'Jaderná', rok: 2010, podil: 22 }, { zdroj: 'Uhelná', rok: 2010, podil: 48 },
      { zdroj: 'Obnovitelné', rok: 2010, podil: 9 }, { zdroj: 'Plynová', rok: 2010, podil: 7 },
      { zdroj: 'Jaderná', rok: 2023, podil: 36 }, { zdroj: 'Uhelná', rok: 2023, podil: 33 },
      { zdroj: 'Obnovitelné', rok: 2023, podil: 18 }, { zdroj: 'Plynová', rok: 2023, podil: 6 },
    ]},
    encoding: {
      x: { field: 'rok', type: 'ordinal', title: 'Rok' },
      y: { field: 'podil', type: 'quantitative', title: 'Podíl (%)', stack: 'normalize', axis: { format: '%' } },
      color: { field: 'zdroj', type: 'nominal', scale: { scheme: 'tableau10' }, title: 'Zdroj' },
      tooltip: [{ field: 'zdroj', title: 'Zdroj' }, { field: 'podil', title: '%' }],
    },
    config: { font: 'system-ui', background: '#f8fafc', view: { stroke: null } },
  },

  pie: {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    title: { text: 'Složení zemské atmosféry', fontSize: 14, fontWeight: 700, color: '#0f172a' },
    width: 300, height: 300,
    mark: { type: 'arc', innerRadius: 60, outerRadius: 140 },
    data: { values: [
      { plyn: 'Dusík (N₂)', podil: 78.09 }, { plyn: 'Kyslík (O₂)', podil: 20.95 },
      { plyn: 'Argon (Ar)', podil: 0.93 }, { plyn: 'CO₂ a ostatní', podil: 0.03 },
    ]},
    encoding: {
      theta: { field: 'podil', type: 'quantitative' },
      color: { field: 'plyn', type: 'nominal', scale: { scheme: 'blues' }, title: 'Plyn' },
      tooltip: [{ field: 'plyn', title: 'Plyn' }, { field: 'podil', title: '%' }],
    },
    config: { font: 'system-ui', background: '#f8fafc' },
  },

  scatter: {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    title: { text: 'HDP vs. střední délka života (2023)', fontSize: 14, fontWeight: 700, color: '#0f172a' },
    width: 500, height: 320,
    mark: { type: 'point', filled: true, size: 120, opacity: 0.8 },
    data: { values: [
      { zeme: 'ČR', hdp: 26800, zivot: 78.7, region: 'Evropa' },
      { zeme: 'Německo', hdp: 54300, zivot: 81.1, region: 'Evropa' },
      { zeme: 'USA', hdp: 76000, zivot: 77.5, region: 'Amerika' },
      { zeme: 'Japonsko', hdp: 33800, zivot: 84.3, region: 'Asie' },
      { zeme: 'Indie', hdp: 2600, zivot: 70.8, region: 'Asie' },
      { zeme: 'Brazílie', hdp: 9900, zivot: 75.5, region: 'Amerika' },
      { zeme: 'Nigérie', hdp: 2100, zivot: 55.7, region: 'Afrika' },
      { zeme: 'Norsko', hdp: 89000, zivot: 83.2, region: 'Evropa' },
      { zeme: 'Čína', hdp: 12700, zivot: 78.2, region: 'Asie' },
    ]},
    encoding: {
      x: { field: 'hdp', type: 'quantitative', title: 'HDP na obyvatele (USD)', axis: { format: ',' } },
      y: { field: 'zivot', type: 'quantitative', title: 'Střední délka života (roky)', scale: { zero: false } },
      color: { field: 'region', type: 'nominal', scale: { scheme: 'tableau10' }, title: 'Region' },
      tooltip: [{ field: 'zeme', title: 'Země' }, { field: 'hdp', title: 'HDP (USD)', format: ',' }, { field: 'zivot', title: 'Délka života' }],
    },
    config: { font: 'system-ui', background: '#f8fafc', view: { stroke: null } },
  },

  heatmap: {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    title: { text: 'Průměrná teplota Prahy (°C) dle měsíce a roku', fontSize: 14, fontWeight: 700, color: '#0f172a' },
    width: 500, height: 280,
    mark: 'rect',
    data: { values: [
      { rok: '2020', mesic: 'Leden', teplota: 1.2 }, { rok: '2020', mesic: 'Duben', teplota: 10.5 },
      { rok: '2020', mesic: 'Červenec', teplota: 22.8 }, { rok: '2020', mesic: 'Říjen', teplota: 11.3 },
      { rok: '2021', mesic: 'Leden', teplota: -0.5 }, { rok: '2021', mesic: 'Duben', teplota: 9.1 },
      { rok: '2021', mesic: 'Červenec', teplota: 21.4 }, { rok: '2021', mesic: 'Říjen', teplota: 10.8 },
      { rok: '2022', mesic: 'Leden', teplota: 2.8 }, { rok: '2022', mesic: 'Duben', teplota: 12.3 },
      { rok: '2022', mesic: 'Červenec', teplota: 24.1 }, { rok: '2022', mesic: 'Říjen', teplota: 13.2 },
      { rok: '2023', mesic: 'Leden', teplota: 3.5 }, { rok: '2023', mesic: 'Duben', teplota: 11.8 },
      { rok: '2023', mesic: 'Červenec', teplota: 25.3 }, { rok: '2023', mesic: 'Říjen', teplota: 14.1 },
    ]},
    encoding: {
      x: { field: 'rok', type: 'ordinal', title: 'Rok' },
      y: { field: 'mesic', type: 'ordinal', title: 'Měsíc', sort: ['Leden', 'Duben', 'Červenec', 'Říjen'] },
      color: { field: 'teplota', type: 'quantitative', scale: { scheme: 'redyellowblue', reverse: true }, title: '°C' },
      tooltip: [{ field: 'rok', title: 'Rok' }, { field: 'mesic', title: 'Měsíc' }, { field: 'teplota', title: '°C' }],
    },
    config: { font: 'system-ui', background: '#f8fafc', view: { stroke: null } },
  },

  timeline: {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    title: { text: 'Klíčové události starověkého Říma', fontSize: 14, fontWeight: 700, color: '#0f172a' },
    width: 520, height: 340,
    mark: { type: 'bar', cornerRadiusTopRight: 4, cornerRadiusBottomRight: 4 },
    data: { values: [
      { udalost: 'Založení Říma', start: -753, konec: -750, kategorie: 'politika' },
      { udalost: 'Republika', start: -509, konec: -27, kategorie: 'politika' },
      { udalost: 'Punské války', start: -264, konec: -146, kategorie: 'válka' },
      { udalost: 'Gaius Julius Caesar', start: -100, konec: -44, kategorie: 'kultura' },
      { udalost: 'Římské císařství', start: -27, konec: 476, kategorie: 'politika' },
      { udalost: 'Pax Romana', start: -27, konec: 180, kategorie: 'kultura' },
    ]},
    encoding: {
      y: { field: 'udalost', type: 'nominal', title: null, sort: null },
      x: { field: 'start', type: 'quantitative', title: 'Rok (př. n. l. / n. l.)' },
      x2: { field: 'konec' },
      color: { field: 'kategorie', type: 'nominal', scale: { scheme: 'tableau10' }, title: 'Kategorie' },
      tooltip: [{ field: 'udalost', title: 'Událost' }, { field: 'start', title: 'Od' }, { field: 'konec', title: 'Do' }],
    },
    config: { font: 'system-ui', background: '#f8fafc', view: { stroke: null } },
  },

  'map-world': {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    title: { text: 'Mapa světa – zadej téma a klikni Generovat', fontSize: 13, fontWeight: 600, color: '#64748b' },
    width: 600, height: 380,
    projection: { type: 'naturalEarth1' },
    data: {
      url: 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json',
      format: { type: 'topojson', feature: 'countries' },
    },
    mark: { type: 'geoshape', fill: '#cbd5e1', stroke: 'white', strokeWidth: 0.5 },
    config: { background: '#dbeafe', view: { stroke: null } },
  },

  'map-europe': {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    title: { text: 'Mapa Evropy – zadej téma a klikni Generovat', fontSize: 13, fontWeight: 600, color: '#64748b' },
    width: 580, height: 420,
    projection: { type: 'mercator', center: [13, 52], scale: 560 },
    data: {
      url: 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json',
      format: { type: 'topojson', feature: 'countries' },
    },
    mark: { type: 'geoshape', fill: '#cbd5e1', stroke: 'white', strokeWidth: 0.7 },
    config: { background: '#dbeafe', view: { stroke: null } },
  },
};

// ─── AI prompt buildery ───────────────────────────────────────────────────────

// ─── World Bank reálná data ───────────────────────────────────────────────────

interface WBRow {
  country: string;
  iso3: string;
  value: number;
  year: string;
}

/** AI identifikuje relevantní World Bank indikátor, pak ho stáhne */
async function fetchWorldBankForTopic(
  topic: string,
  focus: string,
  timePeriod: string,
): Promise<{ rows: WBRow[]; label: string; indicator: string } | null> {
  const { chatWithAIProxy } = await import('../../utils/ai-chat-proxy');

  // Krok 1: AI identifikuje indikátor
  const identPrompt = `Téma grafu: "${topic}"${focus ? `, úhel: "${focus}"` : ''}.
Najdi JEDEN nejrelevantnější World Bank Open Data indikátor.
Vrať POUZE JSON: {"indicator": "KÓD", "description": "Krátký popis česky (max 40 znaků)"}
Pokud žádný neexistuje: {"indicator": null}
Příklady: populace=SP.POP.TOTL, HDP=NY.GDP.MKTP.CD, alkohol=SH.ALC.PCAP.LI, naděje dožití=SP.DYN.LE00.IN, nezaměstnanost=SL.UEM.TOTL.ZS, CO2=EN.ATM.CO2E.PC`;

  const identResp = await chatWithAIProxy(
    [{ role: 'user', content: identPrompt }],
    'gemini-3-flash',
    { max_tokens: 120 },
  );
  const identified = extractJSON(identResp);
  if (!identified?.indicator) return null;

  // Krok 2: Stáhnout data z World Bank API
  const dateParam = timePeriod && timePeriod !== 'any'
    ? `&date=${timePeriod.replace('–', ':').replace('-', ':')}`
    : '';
  const url = `https://api.worldbank.org/v2/country/all/indicator/${identified.indicator}?format=json&mrv=1${dateParam}&per_page=300`;

  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const rawRows: any[] = json[1] ?? [];

  const rows: WBRow[] = rawRows
    .filter(r => r.value !== null && r.value !== undefined && r.countryiso3code?.length === 3)
    .map(r => ({
      country: r.country.value,
      iso3: r.countryiso3code,
      value: Number(r.value),
      year: r.date,
    }))
    .sort((a, b) => b.value - a.value);

  if (rows.length === 0) return null;
  return { rows, label: identified.description, indicator: identified.indicator };
}

// ─── Prompty ──────────────────────────────────────────────────────────────────

function buildChartPrompt(
  chartType: ChartTypeId,
  topic: string,
  scheme: string,
  focus?: string,
  timePeriod?: string,
  realDataRows?: WBRow[],
): string {
  const typeName = CHART_TYPES.find(c => c.id === chartType)?.label ?? chartType;
  const focusLine = focus?.trim() ? `- Úhel pohledu / co ukázat: "${focus}"` : '';
  const timeLine = timePeriod && timePeriod !== 'any'
    ? `- Časové období: ${timePeriod}`
    : '';

  // Sekce s reálnými daty – pokud jsou k dispozici
  const dataSection = realDataRows && realDataRows.length > 0
    ? `\n\n⚠️ REÁLNÁ DATA Z WORLD BANK – POUŽIJ PŘESNĚ TATO ČÍSLA (nevymýšlej si hodnoty!):
${JSON.stringify(realDataRows.slice(0, 60), null, 2)}
Pole "country" = název státu, "value" = hodnota, "year" = rok, "iso3" = ISO kód.
Použij tato přesná čísla. Vyber nejvýznamnější záznamy pro daný typ grafu.`
    : '';

  if (chartType === 'timeline') {
    return `Jsi historik a pedagog. Vygeneruj Vega-Lite v6 specifikaci pro HORIZONTÁLNÍ GANTT / časovou osu na téma: "${topic}".
${focusLine}${timeLine ? '\n' + timeLine : ''}

Požadavky:
- "$schema": "https://vega.github.io/schema/vega-lite/v6.json"
- "width": 560, "height": 380
- Inline data (values, NE url)
- Horizontální bar chart kde osa Y = události, osa X = roky/data
- Použij "mark": "bar" s orientací horizontal
- 6–12 klíčových událostí chronologicky
- Česky: title, axis labels, tooltip
- Barvy dle kategorie: "color": {"field": "kategorie", "scale": {"scheme": "${scheme}"}}
- Data: [{"událost":"...", "start": rok_číslo, "konec": rok_číslo, "kategorie": "..."}]
- "config": {"font": "system-ui"}
${dataSection}
Vrať POUZE validní Vega-Lite JSON spec.`;
  }

  if (chartType === 'heatmap') {
    return `Jsi expert na datové vizualizace. Vygeneruj Vega-Lite v6 specifikaci pro HEATMAPU na vzdělávací téma: "${topic}".
${focusLine}${timeLine ? '\n' + timeLine : ''}

Požadavky:
- "$schema": "https://vega.github.io/schema/vega-lite/v6.json"
- "mark": "rect"
- "width": 520, "height": 360
- Inline data
- Osa X a Y = kategorie (string), barva = hodnota (quantitative)
- "scale": {"scheme": "${scheme}"}
- Česky: title, axis titles, tooltip
- 4–6 kategorií na každé ose, reálná data
- "config": {"font": "system-ui"}
${dataSection}
Vrať POUZE validní Vega-Lite JSON spec.`;
  }

  if (chartType === 'scatter') {
    return `Vygeneruj Vega-Lite v6 specifikaci pro BODOVÝ (scatter) GRAF na vzdělávací téma: "${topic}".
${focusLine}${timeLine ? '\n' + timeLine : ''}

Požadavky:
- "$schema": "https://vega.github.io/schema/vega-lite/v6.json"
- "mark": {"type": "point", "filled": true, "size": 120, "opacity": 0.8}
- "width": 520, "height": 360
- Inline data
- Osa X a Y = dvě různé kvantitativní proměnné
- "color": {"field": "kategorie"} nebo třetí proměnná pro barvu
- Česky: title, axis titles, tooltip
- 15–25 datových bodů s reálnými hodnotami
- "config": {"font": "system-ui"}
${dataSection}
Vrať POUZE validní Vega-Lite JSON spec.`;
  }

  return `Jsi expert na datové vizualizace pro vzdělávání (ZŠ/SŠ).
Vygeneruj Vega-Lite v6 specifikaci pro typ "${typeName}" na vzdělávací téma: "${topic}".
${focusLine}${timeLine ? '\n' + timeLine : ''}

Požadavky:
- "$schema": "https://vega.github.io/schema/vega-lite/v6.json"
- "width": 520, "height": 360
- Inline data (values array, NE url)
- Česky: title, axis titles, tooltip field titles
- Barevné schéma: "${scheme}"
- "config": {"font": "system-ui"}
${chartType === 'bar-h' ? '- "mark": {"type": "bar"} s "encoding": {"x": quantitative, "y": nominal} (horizontální!)' : ''}
${chartType === 'pie' ? '- "mark": {"type": "arc"}, použij "theta" a "color" encoding' : ''}
${chartType === 'area' ? '- "mark": "area", "encoding": {"x": temporal nebo ordinal, "y": quantitative}' : ''}
${dataSection}
Vrať POUZE validní JSON Vega-Lite v6 spec.`;
}

function buildMapPrompt(
  chartType: 'map-world' | 'map-europe',
  topic: string,
  realDataRows?: WBRow[],
): string {
  const isEurope = chartType === 'map-europe';
  const region = isEurope ? 'evropských států' : 'světových států';
  const examples = isEurope
    ? '{"id": 203, "name": "Česká republika", "value": 10.8}, {"id": 276, "name": "Německo", "value": 84.5}'
    : '{"id": 356, "name": "Indie", "value": 1428}, {"id": 840, "name": "USA", "value": 335}';
  const countRange = isEurope ? '25–35' : '30–50';

  const realDataSection = realDataRows && realDataRows.length > 0
    ? `\n\n⚠️ REÁLNÁ DATA Z WORLD BANK – POUŽIJ PŘESNĚ TATO ČÍSLA:
${JSON.stringify(realDataRows.slice(0, 80), null, 2)}
Pro každý záznam najdi správné numerické ISO kód (id) a použij přesnou hodnotu (value). Nevymýšlej si čísla.`
    : '';

  return `Jsi zeměpisný pedagog. Pro vzdělávací téma "${topic}" vygeneruj data pro choropleth mapu ${region}.

Vrať POUZE JSON v tomto formátu:
{
  "title": "Název mapy (česky)",
  "valueTitle": "Název hodnoty s jednotkou (např. Počet obyvatel v mil.)",
  "countries": [
    ${examples},
    ...
  ]
}

Pravidla:
- Zahrň ${countRange} ${isEurope ? 'evropských' : 'nejvýznamnějších'} států
- Použij ISO 3166-1 NUMERIC kódy (celá čísla bez uvozovek, bez nul na začátku!)
  Příklady EU: CZ=203, DE=276, FR=250, GB=826, IT=380, PL=616, ES=724,
  AT=40, NL=528, BE=56, SE=752, NO=578, CH=756, DK=208, FI=246,
  HU=348, RO=642, BG=100, SK=703, HR=191, SI=705, EE=233, LV=428, LT=440,
  LU=442, IE=372, PT=620, GR=300, CY=196, MT=470,
  Ostatní: RU=643, UA=804, TR=792, US=840, CN=156, IN=356, JP=392, BR=76, AU=36, CA=124
- Hodnoty musí být srovnatelné (stejná jednotka)
${realDataRows?.length ? '- Použij přesně čísla z dat níže, NEVYMÝŠLEJ hodnoty' : '- Reálná přesná čísla (ne vymyšlená)'}
${realDataSection}
Vrať POUZE validní JSON.`;
}

// ─── Robustní JSON extractor ──────────────────────────────────────────────────
// Zvládá markdown code bloky, greedy regex, vnořené objekty
function extractJSON(text: string): any {
  // 1) Odstraň markdown code bloky
  const cleaned = text.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();

  // 2) Zkus přímý parse
  try { return JSON.parse(cleaned); } catch { /* pokračuj */ }

  // 3) Najdi první { a spočítej závorky
  const start = cleaned.indexOf('{');
  if (start === -1) throw new Error('Žádný JSON objekt nenalezen');

  let depth = 0, end = -1;
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === '{') depth++;
    else if (cleaned[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end === -1) throw new Error('Neuzavřený JSON objekt');
  return JSON.parse(cleaned.slice(start, end));
}

// ─── World Bank Live Data ─────────────────────────────────────────────────────

interface WBIndicator {
  code: string;
  label: string;
  unit: string;
  emoji: string;
  subjects: string[];
  topN?: number; // kolik zemí zobrazit (default 30)
}

const WB_INDICATORS: WBIndicator[] = [
  // Ekonomika
  { code: 'NY.GDP.PCAP.CD',   label: 'HDP na obyvatele',          unit: 'USD',   emoji: '💵', subjects: ['zeměpis', 'ekonomika'] },
  { code: 'NY.GDP.MKTP.CD',   label: 'Celkové HDP',               unit: 'USD',   emoji: '💰', subjects: ['ekonomika', 'zeměpis'] },
  { code: 'FP.CPI.TOTL.ZG',   label: 'Inflace',                   unit: '%',     emoji: '📈', subjects: ['ekonomika', 'matematika'] },
  { code: 'SL.UEM.TOTL.ZS',   label: 'Nezaměstnanost',            unit: '%',     emoji: '👷', subjects: ['ekonomika', 'zeměpis'] },
  // Populace & společnost
  { code: 'SP.POP.TOTL',      label: 'Počet obyvatel',            unit: 'osob',  emoji: '👥', subjects: ['zeměpis', 'demografie'] },
  { code: 'SP.URB.TOTL.IN.ZS',label: 'Urbanizace',                unit: '%',     emoji: '🏙️', subjects: ['zeměpis', 'sociologie'] },
  { code: 'SP.DYN.LE00.IN',   label: 'Střední délka života',      unit: 'roky',  emoji: '❤️', subjects: ['přírodopis', 'zeměpis'] },
  { code: 'SP.DYN.TFRT.IN',   label: 'Porodnost',                 unit: 'děti/ž.',emoji:'👶', subjects: ['zeměpis', 'demografie'] },
  { code: 'SH.DYN.MORT',      label: 'Dětská úmrtnost',           unit: '/1000', emoji: '🏥', subjects: ['přírodopis', 'zeměpis'] },
  // Vzdělávání
  { code: 'SE.ADT.LITR.ZS',   label: 'Gramotnost dospělých',      unit: '%',     emoji: '📚', subjects: ['zeměpis', 'vzdělávání'] },
  { code: 'SE.XPD.TOTL.GD.ZS',label: 'Výdaje na vzdělávání',     unit: '% HDP', emoji: '🎓', subjects: ['vzdělávání', 'ekonomika'] },
  // Životní prostředí
  { code: 'EN.ATM.CO2E.PC',   label: 'Emise CO₂ na obyvatele',   unit: 't',     emoji: '🌿', subjects: ['ekologie', 'přírodopis'] },
  { code: 'EG.FEC.RNEW.ZS',   label: 'Obnovitelné zdroje energie',unit: '%',     emoji: '☀️', subjects: ['ekologie', 'fyzika'] },
  { code: 'AG.LND.FRST.ZS',   label: 'Zalesněnost území',         unit: '%',     emoji: '🌲', subjects: ['přírodopis', 'ekologie'] },
  { code: 'ER.H2O.FWTL.ZS',   label: 'Odběr sladké vody',        unit: '%',     emoji: '💧', subjects: ['přírodopis', 'zeměpis'] },
  // Infrastruktura & technologie
  { code: 'EG.USE.ELEC.KH.PC',label: 'Spotřeba elektřiny',        unit: 'kWh/os.',emoji:'⚡', subjects: ['fyzika', 'ekonomika'] },
  { code: 'IT.NET.USER.ZS',   label: 'Uživatelé internetu',       unit: '%',     emoji: '🌐', subjects: ['informatika', 'zeměpis'] },
  { code: 'IS.ROD.TOTL.KM',   label: 'Délka silniční sítě',      unit: 'km',    emoji: '🛣️', subjects: ['zeměpis', 'ekonomika'] },
];

const WB_API = 'https://api.worldbank.org/v2/country/all/indicator';

async function fetchWBIndicator(
  indicatorCode: string,
  topN = 30,
): Promise<{ country: string; iso3: string; value: number; year: string }[]> {
  const url = `${WB_API}/${indicatorCode}?format=json&mrv=1&per_page=300`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`WB API error: ${resp.status}`);
  const json = await resp.json();
  const items: any[] = json[1] ?? [];
  return items
    .filter(d => d.value !== null && d.countryiso3code?.length === 3)
    .map(d => ({ country: d.country.value, iso3: d.countryiso3code, value: d.value, year: d.date }))
    .sort((a, b) => b.value - a.value)
    .slice(0, topN);
}

function buildWBSpec(
  data: { country: string; value: number; year: string }[],
  indicator: WBIndicator,
): object {
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    title: {
      text: `${indicator.label} – top ${data.length} zemí (${data[0]?.year ?? ''})`,
      fontSize: 14, fontWeight: 700, color: '#0f172a',
      subtitle: `Zdroj: World Bank | ${indicator.unit}`,
      subtitleColor: '#64748b', subtitleFontSize: 11,
    },
    width: 490, height: Math.min(600, data.length * 18 + 60),
    mark: { type: 'bar', cornerRadiusTopRight: 3, cornerRadiusBottomRight: 3 },
    data: { values: data },
    encoding: {
      y: { field: 'country', type: 'nominal', title: null, sort: '-x' },
      x: { field: 'value', type: 'quantitative', title: `${indicator.label} (${indicator.unit})`, axis: { format: '~s' } },
      color: {
        field: 'value', type: 'quantitative',
        scale: { scheme: 'blues' }, legend: null,
      },
      tooltip: [
        { field: 'country', title: 'Země' },
        { field: 'value', title: indicator.unit, format: ',.2~f' },
        { field: 'year', title: 'Rok dat' },
      ],
    },
    config: { font: 'system-ui', background: '#f8fafc', view: { stroke: null } },
  };
}

// ─── Předdefinované datasety ─────────────────────────────────────────────────

interface PresetDataset {
  id: string;
  title: string;
  desc: string;
  emoji: string;
  subjects: string[];
  chartType: ChartTypeId;
  spec: object;
}

const CDN = 'https://cdn.jsdelivr.net/npm/vega-datasets@2/data';
const CDN_WORLD = 'https://cdn.jsdelivr.net/npm/world-atlas@2';

// Sdílená základní vrstva mapy světa
const worldBase = {
  data: { url: `${CDN_WORLD}/countries-110m.json`, format: { type: 'topojson', feature: 'countries' } },
  mark: { type: 'geoshape', fill: '#e2e8f0', stroke: 'white', strokeWidth: 0.4 },
};

const PRESET_DATASETS: PresetDataset[] = [
  // ── ZEMĚPIS ────────────────────────────────────────────────────────────────
  {
    id: 'gapminder-scatter',
    title: 'Gapminder: Porodnost vs. délka života',
    desc: 'Scatter 190 zemí – porodnost vs. délka života, velikost = populace (rok 2000)',
    emoji: '🌍',
    subjects: ['zeměpis', 'ekonomika', 'demografie'],
    chartType: 'scatter',
    spec: {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      title: { text: 'Gapminder: Porodnost vs. Délka života (2000)', fontSize: 14, fontWeight: 700, color: '#0f172a' },
      width: 520, height: 360,
      data: { url: `${CDN}/gapminder.json` },
      transform: [{ filter: 'datum.year == 2000' }],
      mark: { type: 'point', filled: true, opacity: 0.75 },
      encoding: {
        x: { field: 'fertility', type: 'quantitative', title: 'Porodnost (děti/ženu)', scale: { zero: false } },
        y: { field: 'life_expect', type: 'quantitative', title: 'Délka života (roky)', scale: { zero: false } },
        size: { field: 'pop', type: 'quantitative', title: 'Populace', scale: { rangeMax: 2000 }, legend: null },
        color: { field: 'cluster', type: 'nominal', scale: { scheme: 'tableau10' }, title: 'Region' },
        tooltip: [
          { field: 'country', title: 'Země' },
          { field: 'life_expect', title: 'Délka života' },
          { field: 'fertility', title: 'Porodnost' },
          { field: 'pop', title: 'Populace', format: ',' },
        ],
      },
      config: { font: 'system-ui', background: '#f8fafc', view: { stroke: null } },
    },
  },

  {
    id: 'gapminder-line',
    title: 'Gapminder: Vývoj délky života (1955–2005)',
    desc: 'Vývoj střední délky života vybraných zemí v čase',
    emoji: '📈',
    subjects: ['zeměpis', 'dějepis', 'demografie'],
    chartType: 'line',
    spec: {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      title: { text: 'Vývoj střední délky života (1955–2005)', fontSize: 14, fontWeight: 700, color: '#0f172a' },
      width: 520, height: 340,
      data: { url: `${CDN}/gapminder.json` },
      transform: [{ filter: "indexof(['China', 'India', 'United States', 'Germany', 'Czech Republic', 'Brazil', 'Japan', 'Nigeria'], datum.country) >= 0" }],
      mark: { type: 'line', point: true, strokeWidth: 2 },
      encoding: {
        x: { field: 'year', type: 'ordinal', title: 'Rok' },
        y: { field: 'life_expect', type: 'quantitative', title: 'Délka života (roky)', scale: { zero: false } },
        color: { field: 'country', type: 'nominal', title: 'Země' },
        tooltip: [{ field: 'country', title: 'Země' }, { field: 'year', title: 'Rok' }, { field: 'life_expect', title: 'Délka života' }],
      },
      config: { font: 'system-ui', background: '#f8fafc', view: { stroke: null } },
    },
  },

  {
    id: 'global-temp',
    title: 'Globální oteplování (1880–2023)',
    desc: 'Teplotní anomálie oproti průměru 1951–1980 – kladná = teplejší než průměr',
    emoji: '🌡️',
    subjects: ['přírodopis', 'zeměpis', 'ekologie'],
    chartType: 'area',
    spec: {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      title: { text: 'Globální teplotní anomálie (1880–2023)', fontSize: 14, fontWeight: 700, color: '#0f172a' },
      width: 540, height: 320,
      data: { url: `${CDN}/global-temp.csv` },
      transform: [
        { calculate: "parseFloat(datum.Anomaly)", as: "anomaly_num" },
        { calculate: "datum.anomaly_num > 0 ? 'Nad průměrem' : 'Pod průměrem'", as: "smer" },
      ],
      mark: { type: 'bar', width: { band: 1 } },
      encoding: {
        x: { field: 'Date', type: 'temporal', title: 'Rok' },
        y: { field: 'anomaly_num', type: 'quantitative', title: 'Teplotní anomálie (°C)' },
        color: { field: 'smer', type: 'nominal', scale: { domain: ['Nad průměrem', 'Pod průměrem'], range: ['#ef4444', '#3b82f6'] }, title: null },
        tooltip: [{ field: 'Date', title: 'Datum', type: 'temporal' }, { field: 'anomaly_num', title: 'Anomálie (°C)', format: '.2f' }],
      },
      config: { font: 'system-ui', background: '#f8fafc', view: { stroke: null } },
    },
  },

  {
    id: 'co2',
    title: 'CO₂ v atmosféře (1958–2023)',
    desc: 'Koncentrace oxidu uhličitého – Keelingova křivka z Mauna Loa na Havaji',
    emoji: '💨',
    subjects: ['přírodopis', 'ekologie', 'chemie'],
    chartType: 'line',
    spec: {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      title: { text: 'Koncentrace CO₂ v atmosféře – Keelingova křivka', fontSize: 14, fontWeight: 700, color: '#0f172a' },
      width: 540, height: 320,
      data: { url: `${CDN}/co2-concentration.csv` },
      mark: { type: 'line', strokeWidth: 1.5, color: '#f97316' },
      encoding: {
        x: { field: 'Date', type: 'temporal', title: 'Rok' },
        y: { field: 'CO2', type: 'quantitative', title: 'CO₂ (ppm)', scale: { zero: false } },
        tooltip: [{ field: 'Date', title: 'Datum', type: 'temporal' }, { field: 'CO2', title: 'CO₂ (ppm)' }],
      },
      config: { font: 'system-ui', background: '#f8fafc', view: { stroke: null } },
    },
  },

  {
    id: 'earthquakes',
    title: 'Zemětřesení světa',
    desc: 'Symbol mapa zemětřesení s magnitudou > 4 na světové mapě',
    emoji: '🌋',
    subjects: ['zeměpis', 'přírodopis', 'geologie'],
    chartType: 'map-world',
    spec: {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      title: { text: 'Zemětřesení světa (magnituda > 4)', fontSize: 14, fontWeight: 700, color: '#0f172a' },
      width: 620, height: 400,
      projection: { type: 'naturalEarth1' },
      layer: [
        worldBase,
        {
          data: { url: `${CDN}/earthquakes.json`, format: { type: 'json', property: 'features' } },
          transform: [
            { calculate: 'datum.geometry.coordinates[0]', as: 'longitude' },
            { calculate: 'datum.geometry.coordinates[1]', as: 'latitude' },
            { calculate: 'datum.properties.mag', as: 'mag' },
            { filter: 'datum.mag > 4' },
          ],
          mark: { type: 'circle', opacity: 0.45, color: '#ef4444' },
          encoding: {
            longitude: { field: 'longitude', type: 'quantitative' },
            latitude: { field: 'latitude', type: 'quantitative' },
            size: { field: 'mag', type: 'quantitative', scale: { domain: [4, 9], range: [4, 300] }, title: 'Magnituda' },
            color: { field: 'mag', type: 'quantitative', scale: { scheme: 'reds', domain: [4, 9] }, title: 'Magnituda', legend: null },
            tooltip: [{ field: 'mag', title: 'Magnituda' }],
          },
        },
      ],
      config: { background: '#dbeafe', view: { stroke: null } },
    },
  },

  {
    id: 'airports',
    title: 'Letiště světa',
    desc: 'Dot mapa letišť světa s IATA kódem a názvem – geografická distribuce',
    emoji: '✈️',
    subjects: ['zeměpis', 'doprava', 'geografie'],
    chartType: 'map-world',
    spec: {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      title: { text: 'Letiště světa', fontSize: 14, fontWeight: 700, color: '#0f172a' },
      width: 620, height: 400,
      projection: { type: 'naturalEarth1' },
      layer: [
        worldBase,
        {
          data: { url: `${CDN}/airports.csv` },
          mark: { type: 'circle', size: 5, color: '#6366f1', opacity: 0.6 },
          encoding: {
            longitude: { field: 'longitude', type: 'quantitative' },
            latitude: { field: 'latitude', type: 'quantitative' },
            tooltip: [{ field: 'name', title: 'Letiště' }, { field: 'city', title: 'Město' }, { field: 'country', title: 'Stát' }, { field: 'iata', title: 'IATA' }],
          },
        },
      ],
      config: { background: '#dbeafe', view: { stroke: null } },
    },
  },

  {
    id: 'disasters',
    title: 'Přírodní katastrofy (1900–2017)',
    desc: 'Počet obětí přírodních katastrof dle typu – sucha, povodně, zemětřesení…',
    emoji: '💥',
    subjects: ['zeměpis', 'přírodopis', 'ekologie'],
    chartType: 'bar',
    spec: {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      title: { text: 'Oběti přírodních katastrof dle typu (1900–2017)', fontSize: 14, fontWeight: 700, color: '#0f172a' },
      width: 520, height: 360,
      data: { url: `${CDN}/disasters.csv` },
      transform: [
        { filter: "datum.Entity !== 'All natural disasters'" },
        { aggregate: [{ op: 'sum', field: 'Deaths', as: 'celkem_obeti' }], groupby: ['Entity'] },
        { filter: 'datum.celkem_obeti > 0' },
      ],
      mark: { type: 'bar', cornerRadiusTopLeft: 3, cornerRadiusTopRight: 3 },
      encoding: {
        y: { field: 'Entity', type: 'nominal', title: 'Typ katastrofy', sort: '-x' },
        x: { field: 'celkem_obeti', type: 'quantitative', title: 'Celkový počet obětí', axis: { format: '~s' } },
        color: { field: 'Entity', type: 'nominal', scale: { scheme: 'tableau10' }, legend: null },
        tooltip: [{ field: 'Entity', title: 'Katastrofa' }, { field: 'celkem_obeti', title: 'Obětí celkem', format: ',' }],
      },
      config: { font: 'system-ui', background: '#f8fafc', view: { stroke: null } },
    },
  },

  // ── PŘÍRODOPIS ──────────────────────────────────────────────────────────────
  {
    id: 'penguins-scatter',
    title: 'Tučňáci Antarktidy – druhy a rozměry',
    desc: 'Scatter: délka zobáku vs. hmotnost – 3 druhy tučňáků na ostrovech Antarktidy',
    emoji: '🐧',
    subjects: ['přírodopis', 'biologie', 'matematika'],
    chartType: 'scatter',
    spec: {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      title: { text: 'Tučňáci Antarktidy: Délka zobáku vs. Hmotnost', fontSize: 14, fontWeight: 700, color: '#0f172a' },
      width: 500, height: 340,
      data: { url: `${CDN}/penguins.json` },
      transform: [{ filter: 'datum["Body Mass (g)"] != null' }],
      mark: { type: 'point', filled: true, size: 80, opacity: 0.8 },
      encoding: {
        x: { field: 'Beak Length (mm)', type: 'quantitative', title: 'Délka zobáku (mm)', scale: { zero: false } },
        y: { field: 'Body Mass (g)', type: 'quantitative', title: 'Hmotnost (g)', scale: { zero: false } },
        color: { field: 'Species', type: 'nominal', scale: { scheme: 'set2' }, title: 'Druh' },
        shape: { field: 'Species', type: 'nominal', title: 'Druh' },
        tooltip: [
          { field: 'Species', title: 'Druh' }, { field: 'Island', title: 'Ostrov' },
          { field: 'Beak Length (mm)', title: 'Délka zobáku (mm)' }, { field: 'Body Mass (g)', title: 'Hmotnost (g)' },
        ],
      },
      config: { font: 'system-ui', background: '#f8fafc', view: { stroke: null } },
    },
  },

  {
    id: 'penguins-boxplot',
    title: 'Tučňáci – distribuce hmotnosti (box plot)',
    desc: 'Box plot hmotnosti tučňáků dle druhu – medián, kvartily, odlehlé hodnoty',
    emoji: '📦',
    subjects: ['matematika', 'statistika', 'přírodopis'],
    chartType: 'bar',
    spec: {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      title: { text: 'Distribuce hmotnosti tučňáků dle druhu', fontSize: 14, fontWeight: 700, color: '#0f172a' },
      width: 400, height: 320,
      data: { url: `${CDN}/penguins.json` },
      transform: [{ filter: 'datum["Body Mass (g)"] != null' }],
      mark: { type: 'boxplot', extent: 'min-max', median: { color: 'white', strokeWidth: 2 } },
      encoding: {
        x: { field: 'Species', type: 'nominal', title: 'Druh tučňáka' },
        y: { field: 'Body Mass (g)', type: 'quantitative', title: 'Hmotnost (g)' },
        color: { field: 'Species', type: 'nominal', scale: { scheme: 'set2' }, legend: null },
        tooltip: [{ field: 'Species', title: 'Druh' }],
      },
      config: { font: 'system-ui', background: '#f8fafc', view: { stroke: null } },
    },
  },

  // ── DĚJEPIS ────────────────────────────────────────────────────────────────
  {
    id: 'wheat',
    title: 'Ceny pšenice a mzdy (1565–1964)',
    desc: 'Historický vývoj ceny pšenice a mezd v Anglii – klasická vizualizace Platyfaira',
    emoji: '🌾',
    subjects: ['dějepis', 'ekonomika', 'matematika'],
    chartType: 'line',
    spec: {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      title: { text: 'Ceny pšenice a mzdy v Anglii (1565–1964)', fontSize: 14, fontWeight: 700, color: '#0f172a' },
      width: 540, height: 320,
      data: { url: `${CDN}/wheat.json` },
      layer: [
        {
          mark: { type: 'bar', color: '#f59e0b', opacity: 0.6 },
          encoding: {
            x: { field: 'year', type: 'quantitative', title: 'Rok', axis: { format: 'd' } },
            y: { field: 'wheat', type: 'quantitative', title: 'Cena pšenice (šilinky/čtvrtce)' },
            tooltip: [{ field: 'year', title: 'Rok', format: 'd' }, { field: 'wheat', title: 'Cena pšenice' }],
          },
        },
        {
          mark: { type: 'line', color: '#6366f1', strokeWidth: 2.5 },
          encoding: {
            x: { field: 'year', type: 'quantitative' },
            y: { field: 'wages', type: 'quantitative' },
            tooltip: [{ field: 'year', title: 'Rok', format: 'd' }, { field: 'wages', title: 'Týdenní mzda' }],
          },
        },
      ],
      config: { font: 'system-ui', background: '#f8fafc', view: { stroke: null } },
    },
  },

  {
    id: 'monarchs',
    title: 'Angličtí panovníci – časová osa',
    desc: 'Délka vlády anglických/britských panovníků – timeline od středověku po současnost',
    emoji: '👑',
    subjects: ['dějepis', 'angličtina'],
    chartType: 'timeline',
    spec: {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      title: { text: 'Angličtí panovníci – délka vlády', fontSize: 14, fontWeight: 700, color: '#0f172a' },
      width: 540, height: 380,
      data: { url: `${CDN}/monarchs.json` },
      mark: { type: 'bar', cornerRadiusTopRight: 3, cornerRadiusBottomRight: 3 },
      encoding: {
        y: { field: 'name', type: 'nominal', title: null, sort: { field: 'start', order: 'ascending' } },
        x: { field: 'start', type: 'quantitative', title: 'Rok' },
        x2: { field: 'end' },
        color: { field: 'index', type: 'nominal', scale: { scheme: 'tableau10' }, legend: null },
        tooltip: [{ field: 'name', title: 'Panovník' }, { field: 'start', title: 'Od' }, { field: 'end', title: 'Do' }],
      },
      config: { font: 'system-ui', background: '#f8fafc', view: { stroke: null } },
    },
  },

  // ── MATEMATIKA / STATISTIKA ─────────────────────────────────────────────────
  {
    id: 'anscombe',
    title: 'Anscombeho kvarteto',
    desc: '4 datasety se stejnou průměrnou hodnotou, ale zcela odlišným rozložením – proč vizualizace?',
    emoji: '📊',
    subjects: ['matematika', 'statistika'],
    chartType: 'scatter',
    spec: {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      title: { text: 'Anscombeho kvarteto – 4 datasety, stejná statistika', fontSize: 14, fontWeight: 700, color: '#0f172a' },
      columns: 2,
      data: { url: `${CDN}/anscombe.json` },
      facet: { field: 'Series', type: 'nominal', title: 'Dataset' },
      spec: {
        width: 220, height: 180,
        mark: { type: 'point', filled: true, size: 80, color: '#6366f1' },
        encoding: {
          x: { field: 'X', type: 'quantitative', scale: { zero: false } },
          y: { field: 'Y', type: 'quantitative', scale: { zero: false } },
          tooltip: [{ field: 'X' }, { field: 'Y' }],
        },
      },
      config: { font: 'system-ui', background: '#f8fafc', view: { stroke: null } },
    },
  },

  {
    id: 'barley',
    title: 'Výnosy ječmene dle odrůdy a místa',
    desc: 'Klasický zemědělský dataset – výnosy 6 odrůd ječmene na 6 farmách v Minnesotě (1930–31)',
    emoji: '🌿',
    subjects: ['matematika', 'přírodopis', 'statistika'],
    chartType: 'scatter',
    spec: {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      title: { text: 'Výnosy ječmene dle odrůdy a farmy (Minnesota, 1930–31)', fontSize: 14, fontWeight: 700, color: '#0f172a' },
      width: 200,
      data: { url: `${CDN}/barley.json` },
      facet: { field: 'site', type: 'ordinal', title: 'Farma' },
      columns: 3,
      spec: {
        width: 180, height: 120,
        mark: { type: 'point', filled: true },
        encoding: {
          x: { field: 'yield', type: 'quantitative', title: 'Výnos', scale: { zero: false } },
          y: { field: 'variety', type: 'ordinal', title: null },
          color: { field: 'year', type: 'ordinal', title: 'Rok' },
          tooltip: [{ field: 'variety', title: 'Odrůda' }, { field: 'yield', title: 'Výnos' }, { field: 'year', title: 'Rok' }],
        },
      },
      config: { font: 'system-ui', background: '#f8fafc', view: { stroke: null } },
    },
  },

  // ── ČR SPECIFICKÁ DATA (inline) ─────────────────────────────────────────────
  {
    id: 'cz-regions-pop',
    title: '🇨🇿 Kraje ČR – počet obyvatel',
    desc: 'Populace 14 krajů České republiky (2024) – od nejlidnatějšího po nejmenší',
    emoji: '🗺️',
    subjects: ['zeměpis', 'ČR', 'demografie'],
    chartType: 'bar-h',
    spec: {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      title: { text: 'Populace krajů ČR (2024)', fontSize: 14, fontWeight: 700, color: '#0f172a' },
      width: 480, height: 360,
      mark: { type: 'bar', cornerRadiusTopRight: 4, cornerRadiusBottomRight: 4 },
      data: { values: [
        { kraj: 'Středočeský', populace: 1453294 }, { kraj: 'Praha', populace: 1357326 },
        { kraj: 'Jihomoravský', populace: 1213311 }, { kraj: 'Moravskoslezský', populace: 1178812 },
        { kraj: 'Ústecký', populace: 811616 }, { kraj: 'Jihočeský', populace: 702137 },
        { kraj: 'Plzeňský', populace: 610074 }, { kraj: 'Olomoucký', populace: 621928 },
        { kraj: 'Zlínský', populace: 573637 }, { kraj: 'Pardubický', populace: 539854 },
        { kraj: 'Královéhradecký', populace: 546407 }, { kraj: 'Vysočina', populace: 498694 },
        { kraj: 'Liberecký', populace: 452422 }, { kraj: 'Karlovarský', populace: 277678 },
      ]},
      encoding: {
        y: { field: 'kraj', type: 'nominal', title: 'Kraj', sort: '-x' },
        x: { field: 'populace', type: 'quantitative', title: 'Počet obyvatel', axis: { format: '~s' } },
        color: { field: 'populace', type: 'quantitative', scale: { scheme: 'blues' }, legend: null },
        tooltip: [{ field: 'kraj', title: 'Kraj' }, { field: 'populace', title: 'Obyvatel', format: ',' }],
      },
      config: { font: 'system-ui', background: '#f8fafc', view: { stroke: null } },
    },
  },

  {
    id: 'cz-regions-area',
    title: '🇨🇿 Kraje ČR – rozloha (km²)',
    desc: 'Rozloha 14 krajů České republiky v km² – největší kraj je Středočeský',
    emoji: '📐',
    subjects: ['zeměpis', 'ČR', 'matematika'],
    chartType: 'bar',
    spec: {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      title: { text: 'Rozloha krajů ČR (km²)', fontSize: 14, fontWeight: 700, color: '#0f172a' },
      width: 520, height: 340,
      mark: { type: 'bar', cornerRadiusTopLeft: 4, cornerRadiusTopRight: 4 },
      data: { values: [
        { kraj: 'Středočeský', rozloha: 11015 }, { kraj: 'Jihočeský', rozloha: 10057 },
        { kraj: 'Vysočina', rozloha: 6796 }, { kraj: 'Jihomoravský', rozloha: 7195 },
        { kraj: 'Moravskoslezský', rozloha: 5427 }, { kraj: 'Olomoucký', rozloha: 5267 },
        { kraj: 'Plzeňský', rozloha: 7561 }, { kraj: 'Ústecký', rozloha: 5334 },
        { kraj: 'Pardubický', rozloha: 4519 }, { kraj: 'Královéhradecký', rozloha: 4758 },
        { kraj: 'Zlínský', rozloha: 3964 }, { kraj: 'Liberecký', rozloha: 3163 },
        { kraj: 'Praha', rozloha: 496 }, { kraj: 'Karlovarský', rozloha: 3315 },
      ]},
      encoding: {
        x: { field: 'kraj', type: 'nominal', title: 'Kraj', sort: '-y', axis: { labelAngle: -40 } },
        y: { field: 'rozloha', type: 'quantitative', title: 'Rozloha (km²)' },
        color: { field: 'rozloha', type: 'quantitative', scale: { scheme: 'greens' }, legend: null },
        tooltip: [{ field: 'kraj', title: 'Kraj' }, { field: 'rozloha', title: 'Rozloha (km²)', format: ',' }],
      },
      config: { font: 'system-ui', background: '#f8fafc', view: { stroke: null } },
    },
  },

  {
    id: 'eu-gdp',
    title: '🇪🇺 HDP zemí EU (2023)',
    desc: 'HDP na obyvatele v EUR – porovnání 27 členských zemí EU',
    emoji: '💶',
    subjects: ['zeměpis', 'ekonomika', 'EU'],
    chartType: 'bar-h',
    spec: {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      title: { text: 'HDP na obyvatele – země EU (2023, EUR)', fontSize: 14, fontWeight: 700, color: '#0f172a' },
      width: 480, height: 520,
      mark: { type: 'bar', cornerRadiusTopRight: 3, cornerRadiusBottomRight: 3 },
      data: { values: [
        { zeme: 'Lucembursko', hdp: 120800 }, { zeme: 'Irsko', hdp: 99900 }, { zeme: 'Dánsko', hdp: 67400 },
        { zeme: 'Nizozemsko', hdp: 62100 }, { zeme: 'Švédsko', hdp: 57700 }, { zeme: 'Belgie', hdp: 52100 },
        { zeme: 'Finsko', hdp: 50200 }, { zeme: 'Německo', hdp: 48700 }, { zeme: 'Rakousko', hdp: 55000 },
        { zeme: 'Francie', hdp: 43100 }, { zeme: 'Itálie', hdp: 34100 }, { zeme: 'Španělsko', hdp: 32800 },
        { zeme: 'Česká republika', hdp: 29700 }, { zeme: 'Malta', hdp: 33200 }, { zeme: 'Slovensko', hdp: 22000 },
        { zeme: 'Polsko', hdp: 20800 }, { zeme: 'Maďarsko', hdp: 19100 }, { zeme: 'Chorvatsko', hdp: 19800 },
        { zeme: 'Rumunsko', hdp: 15100 }, { zeme: 'Bulharsko', hdp: 13100 }, { zeme: 'Řecko', hdp: 21600 },
        { zeme: 'Litva', hdp: 24700 }, { zeme: 'Lotyšsko', hdp: 20800 }, { zeme: 'Estonsko', hdp: 25500 },
        { zeme: 'Slovinsko', hdp: 30500 }, { zeme: 'Kypr', hdp: 29900 }, { zeme: 'Portugalsko', hdp: 25100 },
      ]},
      encoding: {
        y: { field: 'zeme', type: 'nominal', title: null, sort: '-x' },
        x: { field: 'hdp', type: 'quantitative', title: 'HDP na obyvatele (EUR)', axis: { format: '~s' } },
        color: {
          field: 'zeme', type: 'nominal', legend: null,
          condition: [{ test: "datum.zeme === 'Česká republika'", value: '#ef4444' }],
          value: '#6366f1',
        },
        tooltip: [{ field: 'zeme', title: 'Země' }, { field: 'hdp', title: 'HDP/obyv. (EUR)', format: ',' }],
      },
      config: { font: 'system-ui', background: '#f8fafc', view: { stroke: null } },
    },
  },
];

// ─── ČSÚ DataStat – datasety ──────────────────────────────────────────────────

interface CSUDataset {
  id: string;
  code: string;
  title: string;
  desc: string;
  emoji: string;
  subjects: string[];
  /** Sloupec, podle kterého se zobrazí hodnota na X */
  valueCol: string;
  /** Sloupec pro popisek na Y */
  labelCol: string;
  /** Server-side filtr (odeslaný do edge function jako ?filter=) */
  filter?: { col: string; val: string };
  /** Klientský filtr – aplikuje se na stažená data (AND logika) */
  clientFilters?: Array<{ col: string; val: string }>;
  /** Volitelný limit na počet řádků */
  limit?: number;
  unit: string;
}

const CSU_DATASETS: CSUDataset[] = [
  {
    id: 'csu-tourists-regions',
    code: 'CRUHVD1T2',
    title: '🏨 Cestovní ruch – hosté v krajích ČR',
    desc: 'Počet hostů v hromadných ubytovacích zařízeních dle krajů (ČSÚ, 2024)',
    emoji: '🏨',
    subjects: ['zeměpis', 'ČR', 'cestovní ruch'],
    labelCol: 'ČR, Reg. soudržnosti, Kraje',
    valueCol: 'Hodnota',
    filter: { col: 'Ukazatel', val: 'Počet hostů' },
    clientFilters: [{ col: 'Rezidence', val: 'Celkem' }],
    unit: 'hostů',
  },
  {
    id: 'csu-wages-quarterly',
    code: 'MZDQ1T1',
    title: '💰 Průměrné mzdy v ČR – čtvrtletní vývoj',
    desc: 'Vývoj průměrné hrubé měsíční mzdy v ČR od roku 2000 (ČSÚ)',
    emoji: '💰',
    subjects: ['ekonomika', 'ČR', 'mzdy'],
    labelCol: 'Čtvrtletí',
    valueCol: 'Hodnota',
    filter: { col: 'Ukazatel', val: 'Průměrná hrubá měsíční mzda na přepočtené počty zaměstnanců (Kč)' },
    limit: 100,
    unit: 'Kč',
  },
  {
    id: 'csu-wages-sector',
    code: 'MZDQ1T2',
    title: '🏭 Mzdy dle odvětví (nejnovější čtvrtletí)',
    desc: 'Průměrné hrubé mzdy dle odvětví CZ-NACE – nejnovější čtvrtletí (ČSÚ)',
    emoji: '🏭',
    subjects: ['ekonomika', 'ČR', 'pracovní trh'],
    labelCol: 'Odvětví ekonomické činnosti',
    valueCol: 'Hodnota',
    filter: { col: 'Ukazatel', val: 'Průměrná hrubá měsíční mzda na přepočtené počty zaměstnanců (Kč)' },
    unit: 'Kč',
  },
  {
    id: 'csu-population-regions',
    code: 'WOBY02AK',
    title: '👥 Počet obyvatel dle krajů ČR',
    desc: 'Aktuální počet obyvatel v krajích České republiky (ČSÚ)',
    emoji: '👥',
    subjects: ['zeměpis', 'ČR', 'demografie'],
    labelCol: 'Území-Kraj',
    valueCol: 'Hodnota',
    filter: { col: 'Ukazatel', val: 'Počet obyvatel - celkem' },
    unit: 'obyvatel',
  },
  {
    id: 'csu-unemployment-regions',
    code: 'WREG01CT4',
    title: '📉 Nezaměstnanost dle krajů ČR',
    desc: 'Podíl nezaměstnaných osob v krajích ČR – nejnovější rok (ČSÚ)',
    emoji: '📉',
    subjects: ['ekonomika', 'ČR', 'pracovní trh'],
    labelCol: 'Území',
    valueCol: 'Hodnota',
    filter: { col: 'Ukazatel', val: 'Podíl nezaměstnaných osob - celkem (%)' },
    unit: '%',
  },
  {
    id: 'csu-inflation',
    code: 'CEN0101HT02',
    title: '📊 Míra inflace v ČR – měsíční',
    desc: 'Vývoj míry inflace v ČR (meziroční přírůstek CPI, ČSÚ)',
    emoji: '📊',
    subjects: ['ekonomika', 'ČR', 'inflace'],
    labelCol: 'Měsíce',
    valueCol: 'Hodnota',
    filter: { col: 'Ukazatel', val: 'Přírůstek indexu spotřebitelských cen ke stejnému měsíci předchozího roku' },
    limit: 36,
    unit: '%',
  },
  {
    id: 'csu-business-by-region',
    code: 'RES03RT6',
    title: '🏢 Ekonomické subjekty dle krajů',
    desc: 'Počet ekonomických subjektů (firem) v krajích ČR – nejnovější rok (ČSÚ)',
    emoji: '🏢',
    subjects: ['ekonomika', 'ČR', 'podnikání'],
    labelCol: 'Kraje, SO ORP-Kraj',
    valueCol: 'Hodnota',
    filter: { col: 'Ukazatel', val: 'Počet ekonomických subjektů celkem' },
    clientFilters: [
      { col: 'Počet zaměstnanců', val: 'Celkem' },
      { col: 'Kraje, SO ORP-SO ORP', val: '' },
    ],
    unit: 'subjektů',
  },
];

/** Volá csu-proxy edge function a vrátí řádky */
async function fetchCSUData(dataset: CSUDataset): Promise<Record<string, string>[]> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const params: Record<string, string> = { code: dataset.code };
  if (dataset.filter) params.filter = `${dataset.filter.col}=${dataset.filter.val}`;
  if (dataset.limit) params.limit = String(dataset.limit);

  const queryString = new URLSearchParams(params).toString();
  const url = `${supabaseUrl}/functions/v1/csu-proxy?${queryString}`;

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey,
    },
  });

  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json.rows ?? [];
}

/** Sestaví Vega-Lite spec z ČSÚ dat */
function buildCSUSpec(rows: Record<string, string>[], dataset: CSUDataset): object {
  // Server-side filtr byl odeslán do edge function; klientský filtr aplikujeme zde
  let filtered = dataset.clientFilters
    ? rows.filter(r => dataset.clientFilters!.every(f => r[f.col] === f.val))
    : rows;

  // Pro datasety s časovou osou: seřadit chronologicky
  // Pro datasety dle krajů/odvětví: vzít první výskyt (nejnovější hodnota, pokud jsou seřazena desc)
  const seen = new Set<string>();
  const parsed = filtered
    .map(r => ({
      label: r[dataset.labelCol] ?? '',
      value: parseFloat((r[dataset.valueCol] ?? '0').replace(/\s/g, '').replace(',', '.')),
    }))
    .filter(r => {
      if (!r.label || !r.label.trim() || isNaN(r.value)) return false;
      // Přeskočit národní / celkové agregáty
      const skipExact = ['Celkem', 'Česko', 'ČR', 'Česká republika', ''];
      if (skipExact.includes(r.label)) return false;
      // Přeskočit duplicity (první výskyt = nejnovější při sestupném řazení)
      if (seen.has(r.label)) return false;
      seen.add(r.label);
      return true;
    });

  const displayRows = parsed.slice(0, 30);
  const isTimeSeries = displayRows.length > 8 && displayRows.every(r => /\d{4}/.test(r.label));

  if (isTimeSeries) {
    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      title: { text: dataset.title, fontSize: 14, fontWeight: 700, color: '#0f172a' },
      width: 540, height: 320,
      data: { values: displayRows },
      mark: { type: 'line', point: true, strokeWidth: 2.5, color: '#6366f1' },
      encoding: {
        x: { field: 'label', type: 'ordinal', title: null, axis: { labelAngle: -40, labelLimit: 80 } },
        y: { field: 'value', type: 'quantitative', title: dataset.unit },
        tooltip: [{ field: 'label', title: 'Období' }, { field: 'value', title: dataset.unit, format: ',.1f' }],
      },
      config: { font: 'system-ui', background: '#f8fafc', view: { stroke: null } },
    };
  }

  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    title: { text: dataset.title, fontSize: 14, fontWeight: 700, color: '#0f172a' },
    width: 480, height: Math.max(240, displayRows.length * 22 + 40),
    mark: { type: 'bar', cornerRadiusTopRight: 3, cornerRadiusBottomRight: 3 },
    data: { values: displayRows },
    encoding: {
      y: { field: 'label', type: 'nominal', title: null, sort: '-x' },
      x: { field: 'value', type: 'quantitative', title: dataset.unit, axis: { format: '~s' } },
      color: { field: 'value', type: 'quantitative', scale: { scheme: 'blues' }, legend: null },
      tooltip: [{ field: 'label', title: dataset.labelCol }, { field: 'value', title: dataset.unit, format: ',' }],
    },
    config: { font: 'system-ui', background: '#f8fafc', view: { stroke: null } },
  };
}

// ─── Hlavní komponenta ────────────────────────────────────────────────────────

export function VizApp() {
  const navigate = useNavigate();

  // Uložené vizualizace
  const [savedVizs, setSavedVizs] = useState<SavedViz[]>(loadSaved);

  // Aktuální vizualizace
  const [currentSpec, setCurrentSpec] = useState<object | null>(PREVIEW_SPECS['bar']);
  const [currentTitle, setCurrentTitle] = useState('Sloupcový');
  const [selectedVizId, setSelectedVizId] = useState<string | null>(null);

  // Nastavení
  const [chartType, setChartType] = useState<ChartTypeId>('bar');
  const [topic, setTopic] = useState('');
  const [scheme, setScheme] = useState('tableau10');

  // Wizard stav
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [wizardFocus, setWizardFocus] = useState('');
  const [wizardTimePeriod, setWizardTimePeriod] = useState('any');

  // Reálná data z World Bank (načtena na pozadí po vyplnění tématu)
  const [realData, setRealData] = useState<{ rows: WBRow[]; label: string; indicator: string } | null>(null);
  const [fetchingRealData, setFetchingRealData] = useState(false);

  // UI state
  const [generating, setGenerating] = useState(false);
  const [showSpecEditor, setShowSpecEditor] = useState(false);
  const [showDesignPanel, setShowDesignPanel] = useState(false);
  const [specText, setSpecText] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    types: true, datasets: false, worldbank: false, csu: false, saved: false,
  });
  const [datasetSearch, setDatasetSearch] = useState('');
  // World Bank live data
  const [wbLoading, setWbLoading] = useState(false);
  const [wbSearch, setWbSearch] = useState('');
  // ČSÚ live data
  const [csuLoading, setCsuLoading] = useState(false);
  const [csuSearch, setCsuSearch] = useState('');

  // vega view pro export
  const vegaViewRef = useRef<any>(null);

  const toggleSection = (key: string) =>
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  // ── World Bank: načíst živý indikátor ─────────────────────────────────────
  const loadWBIndicator = useCallback(async (indicator: WBIndicator) => {
    setWbLoading(true);
    setCurrentSpec(null);
    setShowSpecEditor(false);
    try {
      toast.info(`Stahuji data: ${indicator.label}…`);
      const data = await fetchWBIndicator(indicator.code, indicator.topN ?? 30);
      if (!data.length) throw new Error('Žádná data pro tento indikátor');
      const spec = buildWBSpec(data, indicator);
      setCurrentSpec(spec);
      setCurrentTitle(`${indicator.emoji} ${indicator.label}`);
      setChartType('bar-h');
      setSpecText(JSON.stringify(spec, null, 2));
      setSelectedVizId(null);
      toast.success(`Načteno ${data.length} zemí (World Bank)`);
    } catch (err: any) {
      toast.error(`Chyba: ${err.message}`);
    } finally {
      setWbLoading(false);
    }
  }, []);

  const filteredWBIndicators = wbSearch.trim()
    ? WB_INDICATORS.filter(i =>
        i.label.toLowerCase().includes(wbSearch.toLowerCase()) ||
        i.subjects.some(s => s.toLowerCase().includes(wbSearch.toLowerCase()))
      )
    : WB_INDICATORS;

  // ── ČSÚ: načíst dataset přes edge function proxy ───────────────────────────
  const loadCSUDataset = useCallback(async (dataset: CSUDataset) => {
    setCsuLoading(true);
    setCurrentSpec(null);
    setShowSpecEditor(false);
    try {
      toast.info(`Stahuji data z ČSÚ: ${dataset.title}…`);
      const rows = await fetchCSUData(dataset);
      if (!rows.length) throw new Error('ČSÚ nevrátila žádná data');
      const spec = buildCSUSpec(rows, dataset);
      setCurrentSpec(spec);
      setCurrentTitle(dataset.title);
      setChartType('bar-h');
      setSpecText(JSON.stringify(spec, null, 2));
      setSelectedVizId(null);
      toast.success(`Načteno ${rows.length} řádků z ČSÚ DataStat`);
    } catch (err: any) {
      toast.error(`Chyba ČSÚ: ${err.message}`);
    } finally {
      setCsuLoading(false);
    }
  }, []);

  const filteredCSUDatasets = csuSearch.trim()
    ? CSU_DATASETS.filter(d =>
        d.title.toLowerCase().includes(csuSearch.toLowerCase()) ||
        d.desc.toLowerCase().includes(csuSearch.toLowerCase()) ||
        d.subjects.some(s => s.toLowerCase().includes(csuSearch.toLowerCase()))
      )
    : CSU_DATASETS;

  // ── Načíst preset dataset ─────────────────────────────────────────────────
  const loadPreset = useCallback((preset: PresetDataset) => {
    setCurrentSpec(preset.spec);
    setCurrentTitle(preset.title);
    setChartType(preset.chartType);
    setSpecText(JSON.stringify(preset.spec, null, 2));
    setSelectedVizId(null);
    setTopic(preset.desc);
    setShowSpecEditor(false);
  }, []);

  // Filtrované presety pro vyhledávání
  const filteredPresets = datasetSearch.trim()
    ? PRESET_DATASETS.filter(p =>
        p.title.toLowerCase().includes(datasetSearch.toLowerCase()) ||
        p.desc.toLowerCase().includes(datasetSearch.toLowerCase()) ||
        p.subjects.some(s => s.toLowerCase().includes(datasetSearch.toLowerCase()))
      )
    : PRESET_DATASETS;

  // ── Výběr typu → okamžitý preview ────────────────────────────────────────
  const selectChartType = useCallback((id: ChartTypeId) => {
    setChartType(id);
    setSelectedVizId(null);
    const preview = PREVIEW_SPECS[id];
    setCurrentSpec(preview);
    setSpecText(JSON.stringify(preview, null, 2));
    const ct = CHART_TYPES.find(c => c.id === id);
    setCurrentTitle(ct?.label ?? '');
  }, []);

  // ── Načítání reálných dat z World Bank ─────────────────────────────────────
  const identifyAndFetch = useCallback(async (currentTopic: string, currentFocus: string, currentTimePeriod: string) => {
    if (!currentTopic.trim()) return;
    setFetchingRealData(true);
    setRealData(null);
    try {
      const result = await fetchWorldBankForTopic(currentTopic, currentFocus, currentTimePeriod);
      if (result) setRealData(result);
    } catch (err) {
      console.error('[VizApp] World Bank fetch failed:', err);
    } finally {
      setFetchingRealData(false);
    }
  }, []);

  // Wrapper pro změnu kroku – při přechodu z 1→2 spustí načítání dat
  const handleWizardStepChange = useCallback((step: 1 | 2 | 3) => {
    setWizardStep(step);
    if (step === 2) {
      identifyAndFetch(topic, wizardFocus, wizardTimePeriod);
    }
  }, [topic, wizardFocus, wizardTimePeriod, identifyAndFetch]);

  // ── Generování spec ────────────────────────────────────────────────────────
  const generate = useCallback(async () => {
    if (!topic.trim()) { toast.error('Zadej téma vizualizace'); return; }
    setGenerating(true);
    setCurrentSpec(null);
    setShowSpecEditor(false);
    try {
      const { chatWithAIProxy } = await import('../../utils/ai-chat-proxy');

      let spec: object;
      const dataRows = realData?.rows;

      if (chartType === 'map-world' || chartType === 'map-europe') {
        // Mapy: AI generuje data (s reálnými daty pokud dostupná), my buildujeme spec
        const prompt = buildMapPrompt(chartType, topic, dataRows);
        const resp = await chatWithAIProxy(
          [{ role: 'user', content: prompt }],
          'gemini-3.1-pro',
          { max_tokens: 4096 },
        );
        const data = extractJSON(resp);
        if (!data.countries?.length) throw new Error('AI nevrátila pole countries');
        spec = chartType === 'map-world'
          ? buildWorldMapSpec(data.title, data.valueTitle, data.countries, scheme)
          : buildEuropeMapSpec(data.title, data.valueTitle, data.countries, scheme);
        setCurrentTitle(data.title);
      } else {
        // Grafy: AI generuje celý Vega-Lite spec (wizard: focus + timePeriod + reálná data)
        const prompt = buildChartPrompt(chartType, topic, scheme, wizardFocus, wizardTimePeriod, dataRows);
        const resp = await chatWithAIProxy(
          [{ role: 'user', content: prompt }],
          'gemini-3.1-pro',
          { max_tokens: 8192 },
        );
        spec = extractJSON(resp);
        const s = spec as any;
        setCurrentTitle(s.title?.text ?? s.title ?? topic);
      }

      setCurrentSpec(spec);
      setSpecText(JSON.stringify(spec, null, 2));
      setWizardStep(1);
      setRealData(null);
      toast.success(dataRows?.length ? `✅ Vizualizace s ${dataRows.length} reálnými záznamy!` : 'Vizualizace vygenerována!');
    } catch (err: any) {
      console.error(err);
      toast.error(`Chyba generování: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  }, [topic, chartType, scheme, wizardFocus, wizardTimePeriod, realData]);

  // ── Uložit vizualizaci ─────────────────────────────────────────────────────
  const saveViz = useCallback(() => {
    if (!currentSpec) { toast.error('Nejdřív vygeneruj vizualizaci'); return; }
    const newViz: SavedViz = {
      id: `viz-${Date.now()}`,
      title: currentTitle || topic || 'Vizualizace',
      chartType,
      spec: currentSpec,
      topic,
      createdAt: new Date().toISOString(),
    };
    setSavedVizs(prev => {
      const updated = [newViz, ...prev];
      persistSaved(updated);
      return updated;
    });
    setSelectedVizId(newViz.id);
    toast.success('Vizualizace uložena!');
    setOpenSections(prev => ({ ...prev, saved: true }));
  }, [currentSpec, currentTitle, topic, chartType]);

  // ── Načíst uloženou ────────────────────────────────────────────────────────
  const loadViz = useCallback((viz: SavedViz) => {
    setCurrentSpec(viz.spec);
    setCurrentTitle(viz.title);
    setChartType(viz.chartType);
    setTopic(viz.topic);
    setSpecText(JSON.stringify(viz.spec, null, 2));
    setSelectedVizId(viz.id);
    setShowSpecEditor(false);
  }, []);

  // ── Smazat ────────────────────────────────────────────────────────────────
  const deleteViz = useCallback((id: string) => {
    setSavedVizs(prev => {
      const updated = prev.filter(v => v.id !== id);
      persistSaved(updated);
      return updated;
    });
    if (selectedVizId === id) {
      setCurrentSpec(null);
      setSelectedVizId(null);
    }
  }, [selectedVizId]);

  // ── Export PNG ─────────────────────────────────────────────────────────────
  const exportPng = useCallback(async () => {
    if (!vegaViewRef.current) { toast.error('Graf není připraven'); return; }
    try {
      const url = await vegaViewRef.current.toImageURL('png', 2);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentTitle || 'graf'}.png`;
      a.click();
      toast.success('PNG staženo!');
    } catch {
      toast.error('Export se nezdařil');
    }
  }, [currentTitle]);

  // ── Přímá aktualizace spec (pro design panel) ──────────────────────────────
  const updateSpec = useCallback((newSpec: object) => {
    setCurrentSpec(newSpec);
    setSpecText(JSON.stringify(newSpec, null, 2));
  }, []);

  // ── Spec editor → preview ─────────────────────────────────────────────────
  const applySpecText = useCallback(() => {
    try {
      const parsed = JSON.parse(specText);
      setCurrentSpec(parsed);
      const t = (parsed as any).title;
      if (t) setCurrentTitle(typeof t === 'string' ? t : t.text ?? '');
      toast.success('Spec aplikován');
    } catch {
      toast.error('Neplatný JSON');
    }
  }, [specText]);

  // ── Nová vizualizace – reset na wizard krok 1 ─────────────────────────────
  const newViz = useCallback(() => {
    setCurrentSpec(null);
    setSpecText('');
    setCurrentTitle('');
    setSelectedVizId(null);
    setTopic('');
    setWizardFocus('');
    setWizardTimePeriod('any');
    setWizardStep(1);
    setShowSpecEditor(false);
  }, []);

  const chartTypeInfo = CHART_TYPES.find(c => c.id === chartType)!;
  const groups = ['Grafy', 'Mapy'];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>

      {/* ── Levý panel ────────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div style={{
          width: 300, height: '100vh', background: '#0f172a', display: 'flex',
          flexDirection: 'column', flexShrink: 0, overflowY: 'auto', overflowX: 'hidden',
        }}>
          {/* Hlavička */}
          <div style={{ padding: '16px 16px 0', borderBottom: '1px solid #1e293b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <button
                onClick={() => navigate('/admin')}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4, borderRadius: 6 }}
              >
                <ArrowLeft size={18} />
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #22d3ee)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BarChart2 size={17} color="white" />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>Vizualizér</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>Vega-Lite grafy a mapy</div>
                </div>
              </div>
            </div>

            {/* Nová vizualizace */}
            <button
              onClick={newViz}
              style={{ width: '100%', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 10, border: '1px dashed #334155', background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#a5b4fc'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.color = '#94a3b8'; }}
            >
              <Plus size={15} /> Nová vizualizace
            </button>
          </div>

          {/* ── Sekce: Typ vizualizace ────────────────────────────────────── */}
          <SideSection
            title="Typ vizualizace"
            icon={<LayoutGrid size={13} />}
            open={openSections.types}
            onToggle={() => toggleSection('types')}
          >
            {groups.map(group => (
              <div key={group} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>{group}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {CHART_TYPES.filter(c => c.group === group).map(c => (
                    <button
                      key={c.id}
                      onClick={() => selectChartType(c.id)}
                      title={c.desc}
                      style={{
                        padding: '7px 8px', borderRadius: 8, border: '1px solid',
                        borderColor: chartType === c.id ? '#6366f1' : '#1e293b',
                        background: chartType === c.id ? 'rgba(99,102,241,0.15)' : 'transparent',
                        color: chartType === c.id ? '#a5b4fc' : '#64748b',
                        fontSize: 11, cursor: 'pointer', textAlign: 'left',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      <span style={{ fontSize: 14 }}>{c.emoji}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </SideSection>


          {/* ── Sekce: Hotové datasety ───────────────────────────────────── */}
          <SideSection
            title={`Hotové datasety (${PRESET_DATASETS.length})`}
            icon={<Globe size={13} />}
            open={openSections.datasets}
            onToggle={() => toggleSection('datasets')}
          >
            {/* Vyhledávání */}
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <input
                type="text"
                value={datasetSearch}
                onChange={e => setDatasetSearch(e.target.value)}
                placeholder="Hledat dataset…"
                style={{
                  width: '100%', padding: '6px 10px 6px 28px', borderRadius: 8,
                  border: '1px solid #1e293b', background: '#0a0f1a', color: '#e2e8f0',
                  fontSize: 11, outline: 'none', boxSizing: 'border-box',
                }}
              />
              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#475569', fontSize: 11 }}>🔍</span>
              {datasetSearch && (
                <button
                  onClick={() => setDatasetSearch('')}
                  style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 13, padding: 0 }}
                >×</button>
              )}
            </div>

            {filteredPresets.length === 0 && (
              <p style={{ fontSize: 11, color: '#334155', textAlign: 'center', padding: '8px 0' }}>Nic nenalezeno</p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 380, overflowY: 'auto' }}>
              {filteredPresets.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => loadPreset(preset)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px',
                    borderRadius: 8, border: '1px solid #1e293b', background: 'transparent',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.background = 'rgba(99,102,241,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e293b'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{preset.emoji}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preset.title}</div>
                    <div style={{ fontSize: 10, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{preset.desc}</div>
                    <div style={{ display: 'flex', gap: 3, marginTop: 4, flexWrap: 'wrap' }}>
                      {preset.subjects.slice(0, 3).map(s => (
                        <span key={s} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#0f172a', color: '#64748b', border: '1px solid #1e293b' }}>{s}</span>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </SideSection>

          {/* ── Sekce: World Bank živá data ──────────────────────────────── */}
          <SideSection
            title="Živá data (World Bank)"
            icon={<Globe size={13} />}
            open={openSections.worldbank}
            onToggle={() => toggleSection('worldbank')}
          >
            <div style={{ fontSize: 10, color: '#475569', marginBottom: 8, lineHeight: 1.5 }}>
              Čerstvá data přímo z World Bank API – {WB_INDICATORS.length} indikátorů, 200+ zemí. Zdarma, bez API klíče.
            </div>

            {/* Vyhledávání */}
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <input
                type="text"
                value={wbSearch}
                onChange={e => setWbSearch(e.target.value)}
                placeholder="Hledat indikátor…"
                style={{
                  width: '100%', padding: '6px 10px 6px 28px', borderRadius: 8,
                  border: '1px solid #1e293b', background: '#0a0f1a', color: '#e2e8f0',
                  fontSize: 11, outline: 'none', boxSizing: 'border-box',
                }}
              />
              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#475569', fontSize: 11 }}>🔍</span>
              {wbSearch && (
                <button onClick={() => setWbSearch('')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 13, padding: 0 }}>×</button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 340, overflowY: 'auto' }}>
              {filteredWBIndicators.map(ind => (
                <button
                  key={ind.code}
                  onClick={() => loadWBIndicator(ind)}
                  disabled={wbLoading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                    borderRadius: 8, border: '1px solid #1e293b', background: 'transparent',
                    cursor: wbLoading ? 'not-allowed' : 'pointer', textAlign: 'left', width: '100%',
                    opacity: wbLoading ? 0.5 : 1,
                  }}
                  onMouseEnter={e => { if (!wbLoading) { e.currentTarget.style.borderColor = '#22d3ee'; e.currentTarget.style.background = 'rgba(34,211,238,0.06)'; } }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e293b'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ fontSize: 15, flexShrink: 0 }}>{ind.emoji}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ind.label}</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 2, alignItems: 'center' }}>
                      <span style={{ fontSize: 9, color: '#64748b', background: '#0f172a', padding: '1px 5px', borderRadius: 4, border: '1px solid #1e293b' }}>{ind.unit}</span>
                      {ind.subjects.slice(0, 2).map(s => (
                        <span key={s} style={{ fontSize: 9, color: '#475569' }}>{s}</span>
                      ))}
                    </div>
                  </div>
                  {wbLoading ? <Loader2 size={11} className="animate-spin" style={{ color: '#22d3ee', flexShrink: 0 }} /> : <ChevronRight size={11} style={{ color: '#334155', flexShrink: 0 }} />}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 8, fontSize: 9, color: '#334155', textAlign: 'center' }}>
              Zdroj: <span style={{ color: '#475569' }}>data360.worldbank.org</span> · aktualizováno 2026
            </div>
          </SideSection>

          {/* ── Sekce: Živá data ČSÚ ─────────────────────────────────────── */}
          <SideSection
            title="Živá data (ČSÚ)"
            icon={<Map size={13} />}
            open={openSections.csu}
            onToggle={() => toggleSection('csu')}
          >
            <div style={{ fontSize: 10, color: '#475569', marginBottom: 8, lineHeight: 1.5 }}>
              Čerstvá data přímo z ČSÚ DataStat – {CSU_DATASETS.length} datasetů o ČR. Aktualizováno automaticky.
            </div>

            {/* Vyhledávání */}
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <input
                type="text"
                value={csuSearch}
                onChange={e => setCsuSearch(e.target.value)}
                placeholder="Hledat dataset ČSÚ…"
                style={{
                  width: '100%', padding: '6px 10px 6px 28px', borderRadius: 8,
                  border: '1px solid #1e293b', background: '#0a0f1a', color: '#e2e8f0',
                  fontSize: 11, outline: 'none', boxSizing: 'border-box',
                }}
              />
              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#475569', fontSize: 11 }}>🔍</span>
              {csuSearch && (
                <button onClick={() => setCsuSearch('')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 13, padding: 0 }}>×</button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 340, overflowY: 'auto' }}>
              {filteredCSUDatasets.map(ds => (
                <button
                  key={ds.id}
                  onClick={() => loadCSUDataset(ds)}
                  disabled={csuLoading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                    borderRadius: 8, border: '1px solid #1e293b', background: 'transparent',
                    cursor: csuLoading ? 'not-allowed' : 'pointer', textAlign: 'left', width: '100%',
                    opacity: csuLoading ? 0.5 : 1,
                  }}
                  onMouseEnter={e => { if (!csuLoading) { e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.background = 'rgba(245,158,11,0.06)'; } }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e293b'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ fontSize: 15, flexShrink: 0 }}>{ds.emoji}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ds.title}</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 2, alignItems: 'center' }}>
                      <span style={{ fontSize: 9, color: '#64748b', background: '#0f172a', padding: '1px 5px', borderRadius: 4, border: '1px solid #1e293b' }}>{ds.unit}</span>
                      {ds.subjects.slice(0, 2).map(s => (
                        <span key={s} style={{ fontSize: 9, color: '#475569' }}>{s}</span>
                      ))}
                    </div>
                  </div>
                  {csuLoading ? <Loader2 size={11} className="animate-spin" style={{ color: '#f59e0b', flexShrink: 0 }} /> : <ChevronRight size={11} style={{ color: '#334155', flexShrink: 0 }} />}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 8, fontSize: 9, color: '#334155', textAlign: 'center' }}>
              Zdroj: <span style={{ color: '#f59e0b' }}>ČSÚ DataStat</span> · data.csu.gov.cz · proxy přes Edge Function
            </div>
          </SideSection>

          {/* ── Sekce: Uložené ────────────────────────────────────────────── */}
          <SideSection
            title={`Uložené (${savedVizs.length})`}
            icon={<Save size={13} />}
            open={openSections.saved}
            onToggle={() => toggleSection('saved')}
          >
            {savedVizs.length === 0 ? (
              <p style={{ fontSize: 11, color: '#334155', textAlign: 'center', padding: '12px 0' }}>Zatím nic uloženo</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {savedVizs.map(v => {
                  const ct = CHART_TYPES.find(c => c.id === v.chartType);
                  const isSelected = selectedVizId === v.id;
                  return (
                    <div
                      key={v.id}
                      onClick={() => loadViz(v)}
                      style={{
                        padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                        border: `1px solid ${isSelected ? '#6366f1' : '#1e293b'}`,
                        background: isSelected ? 'rgba(99,102,241,0.1)' : 'transparent',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 16 }}>{ct?.emoji ?? '📊'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</div>
                        <div style={{ fontSize: 10, color: '#475569' }}>{ct?.label}</div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteViz(v.id); }}
                        style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 2 }}
                        title="Smazat"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </SideSection>

          <div style={{ flex: 1 }} />

          {/* Footer */}
          <div style={{ padding: '10px 14px', borderTop: '1px solid #1e293b', fontSize: 10, color: '#334155', textAlign: 'center' }}>
            Powered by Vega-Lite v6
          </div>
        </div>
      )}

      {/* ── Tlačítko collapse sidebar ──────────────────────────────────────────── */}
      <button
        onClick={() => setSidebarOpen(p => !p)}
        style={{
          position: 'absolute', left: sidebarOpen ? 300 : 0, top: '50%', transform: 'translateY(-50%)',
          zIndex: 10, background: '#1e293b', border: 'none', color: '#94a3b8',
          cursor: 'pointer', padding: '8px 4px', borderRadius: '0 8px 8px 0',
        }}
      >
        {sidebarOpen ? <ChevronRight size={14} /> : <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />}
      </button>

      {/* ── Hlavní oblast ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
          background: 'white', borderBottom: '1px solid #e2e8f0', flexShrink: 0,
        }}>
          {currentSpec && (
            <>
              <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{currentTitle || 'Vizualizace'}</div>
              <button onClick={() => { setShowSpecEditor(p => !p); if (showDesignPanel) setShowDesignPanel(false); }} style={toolbarBtn(showSpecEditor)}>
                <Code2 size={14} /> JSON spec
              </button>
              <button onClick={() => { setShowDesignPanel(p => !p); if (showSpecEditor) setShowSpecEditor(false); }} style={toolbarBtn(showDesignPanel, false, '#7c3aed')}>
                <Palette size={14} /> Design
              </button>
              <button onClick={generate} disabled={generating} style={toolbarBtn(false)}>
                <RefreshCw size={14} /> Regenerovat
              </button>
              <button onClick={saveViz} style={toolbarBtn(false, true)}>
                <Save size={14} /> Uložit
              </button>
              <button onClick={exportPng} style={toolbarBtn(false)}>
                <Download size={14} /> PNG
              </button>
            </>
          )}
          {!currentSpec && !generating && (
            <div style={{ flex: 1, fontSize: 13, color: '#94a3b8' }}>
              {wizardStep === 1 ? 'Krok 1 – zadej téma' : wizardStep === 2 ? 'Krok 2 – vyber typ vizualizace' : 'Krok 3 – časové období'}
            </div>
          )}
        </div>

        {/* Obsah */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Spec editor */}
          {showSpecEditor && currentSpec && (
            <div style={{ width: 340, background: '#0a0f1a', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid #1e293b', fontSize: 11, fontWeight: 600, color: '#64748b' }}>
                Vega-Lite JSON spec
              </div>
              <textarea
                value={specText}
                onChange={e => setSpecText(e.target.value)}
                style={{ flex: 1, padding: '10px 12px', background: 'transparent', border: 'none', color: '#86efac', fontSize: 11, fontFamily: 'monospace', resize: 'none', outline: 'none' }}
              />
              <div style={{ padding: 8, borderTop: '1px solid #1e293b' }}>
                <button
                  onClick={applySpecText}
                  style={{ width: '100%', padding: '8px', borderRadius: 8, border: 'none', background: '#6366f1', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  ▶ Aplikovat spec
                </button>
              </div>
            </div>
          )}

          {/* Chart preview / Wizard */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 32 }}>
            {generating && (
              <div style={{ textAlign: 'center', color: '#64748b' }}>
                <Loader2 size={40} className="animate-spin" style={{ margin: '0 auto 16px' }} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>Generuji vizualizaci…</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>AI připravuje data a spec · může trvat 10–30 s</div>
              </div>
            )}
            {!generating && !currentSpec && (
              <GenerationWizard
                step={wizardStep}
                onStepChange={handleWizardStepChange}
                topic={topic}
                onTopicChange={setTopic}
                focus={wizardFocus}
                onFocusChange={setWizardFocus}
                chartType={chartType}
                onChartTypeSelect={(id) => {
                  setChartType(id);
                }}
                timePeriod={wizardTimePeriod}
                onTimePeriodChange={setWizardTimePeriod}
                generating={generating}
                onGenerate={generate}
                realDataLabel={realData?.label ?? null}
                realDataCount={realData?.rows.length ?? 0}
                fetchingRealData={fetchingRealData}
              />
            )}
            {!generating && currentSpec && (
              <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 4px 32px rgba(0,0,0,0.08)', padding: 24, maxWidth: '100%' }}>
                <VegaChart spec={currentSpec} onViewReady={v => { vegaViewRef.current = v; }} />
              </div>
            )}
          </div>

          {/* Design panel – vpravo */}
          {showDesignPanel && currentSpec && (
            <DesignPanel
              spec={currentSpec as any}
              chartType={chartType}
              onUpdate={updateSpec}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Design Panel ─────────────────────────────────────────────────────────────

/** Mutates `obj` by setting a dot-path to `value`. Null removes the key, undefined deletes it. */
function setDeep(obj: any, path: string, value: any) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!cur[keys[i]] || typeof cur[keys[i]] !== 'object') cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  const last = keys[keys.length - 1];
  if (value === undefined) delete cur[last];
  else cur[last] = value;
}

const MAP_COLOR_SCHEMES = [
  { id: 'oranges', label: '🟠 Oranžová' },
  { id: 'blues', label: '🔵 Modrá' },
  { id: 'greens', label: '🟢 Zelená' },
  { id: 'reds', label: '🔴 Červená' },
  { id: 'purples', label: '🟣 Fialová' },
  { id: 'yelloworangered', label: '🌡️ Tepelná' },
  { id: 'yellowgreenblue', label: '🌊 Žlutá–modrá' },
  { id: 'viridis', label: '🌈 Viridis' },
  { id: 'plasma', label: '💜 Plasma' },
  { id: 'greys', label: '⬛ Šedá' },
];

const INTERPOLATE_OPTIONS = [
  { id: 'linear', label: 'Lineární' },
  { id: 'monotone', label: 'Monotone (hladká)' },
  { id: 'cardinal', label: 'Cardinal' },
  { id: 'step', label: 'Schodová (step)' },
  { id: 'step-before', label: 'Step Before' },
  { id: 'step-after', label: 'Step After' },
  { id: 'basis', label: 'Basis (zahlazená)' },
];

const dInputStyle: React.CSSProperties = {
  width: '100%', padding: '5px 8px', borderRadius: 6,
  border: '1px solid #e2e8f0', fontSize: 12, outline: 'none',
  fontFamily: 'system-ui', background: 'white', color: '#0f172a', boxSizing: 'border-box',
};

function DSection({ title, children, open: defaultOpen = true }: {
  title: string; children: React.ReactNode; open?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid #f1f5f9' }}>
      <button onClick={() => setOpen(p => !p)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 16px', background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8,
      }}>
        {title}
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </button>
      {open && <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>}
    </div>
  );
}

function DRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{label}</div>
      {children}
    </div>
  );
}

function DSlider({ label, value, min, max, step = 1, fmt, onChange }: {
  label: string; value: number; min: number; max: number;
  step?: number; fmt?: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700 }}>{fmt ? fmt(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#7c3aed', height: 4 }}
      />
    </div>
  );
}

function DToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{label}</span>
      <button onClick={() => onChange(!value)} style={{
        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
        background: value ? '#7c3aed' : '#d1d5db', position: 'relative', transition: 'background .15s', flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%', background: 'white',
          left: value ? 18 : 2, transition: 'left .15s',
        }} />
      </button>
    </div>
  );
}

function DColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 20, height: 20, borderRadius: 4, background: value, border: '1px solid #e2e8f0' }} />
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          style={{ width: 36, height: 24, padding: 1, borderRadius: 4, border: '1px solid #e2e8f0', cursor: 'pointer' }}
        />
      </div>
    </div>
  );
}

function DesignPanel({ spec, chartType, onUpdate }: {
  spec: any; chartType: ChartTypeId; onUpdate: (spec: object) => void;
}) {
  // ── Detect layered vs simple spec ─────────────────────────────────────────
  const isLayered = Array.isArray(spec.layer);

  // Map chartType → expected Vega-Lite mark type for the primary layer
  const PRIMARY_MARK_MAP: Partial<Record<ChartTypeId, string>> = {
    bar: 'bar', 'bar-h': 'bar', line: 'line', area: 'area',
    pie: 'arc', scatter: 'point', heatmap: 'rect', timeline: 'bar',
    'map-world': 'geoshape', 'map-europe': 'geoshape',
  };
  const wantedMark = PRIMARY_MARK_MAP[chartType] ?? '';

  // Index of the primary layer (the main chart layer, not decorative rule/text layers)
  const primaryLayerIdx: number = isLayered
    ? (spec.layer as any[]).findIndex((l: any) => {
        const t = typeof l.mark === 'string' ? l.mark : l.mark?.type;
        return t === wantedMark;
      })
    : -1;

  // ── Deep GET from spec top-level ──────────────────────────────────────────
  const g = (path: string): any => path.split('.').reduce((o: any, k) => o?.[k], spec);

  // ── Deep SET at spec top-level (title, width, height, config, projection) ─
  const u = (path: string, value: any) => {
    const clone = JSON.parse(JSON.stringify(spec));
    setDeep(clone, path, value);
    onUpdate(clone);
  };

  // ── MARK helpers ──────────────────────────────────────────────────────────
  // Read mark from primary layer or top-level
  const markSrc: any = isLayered && primaryLayerIdx >= 0
    ? spec.layer[primaryLayerIdx].mark
    : spec.mark;
  const markObj: any = typeof markSrc === 'string' ? { type: markSrc } : (markSrc ?? {});
  const gm = (key: string): any => markObj[key];

  // Write to mark (always updating the correct location)
  const um = (key: string, value: any) => {
    const clone = JSON.parse(JSON.stringify(spec));
    const m = { ...markObj };
    if (value === undefined) delete m[key]; else m[key] = value;
    if (isLayered && primaryLayerIdx >= 0) clone.layer[primaryLayerIdx].mark = m;
    else clone.mark = m;
    onUpdate(clone);
  };
  const umMulti = (updates: Record<string, any>) => {
    const clone = JSON.parse(JSON.stringify(spec));
    const m = { ...markObj, ...updates };
    if (isLayered && primaryLayerIdx >= 0) clone.layer[primaryLayerIdx].mark = m;
    else clone.mark = m;
    onUpdate(clone);
  };

  // ── ENCODING helpers ──────────────────────────────────────────────────────
  // Source for reading encoding: top-level (if exists) or primary layer
  const encSrc: any = (isLayered && !spec.encoding && primaryLayerIdx >= 0)
    ? spec.layer[primaryLayerIdx]
    : spec;
  const ge = (path: string): any => path.split('.').reduce((o: any, k) => o?.[k], encSrc);

  // Write encoding to correct location
  const ue = (path: string, value: any) => {
    const clone = JSON.parse(JSON.stringify(spec));
    const target = (isLayered && !clone.encoding && primaryLayerIdx >= 0)
      ? clone.layer[primaryLayerIdx]
      : clone;
    setDeep(target, path, value);
    onUpdate(clone);
  };

  // Write multiple encoding paths in one atomic update (avoids stale-clone bug)
  const ueBatch = (updates: Array<[string, any]>) => {
    const clone = JSON.parse(JSON.stringify(spec));
    const target = (isLayered && !clone.encoding && primaryLayerIdx >= 0)
      ? clone.layer[primaryLayerIdx]
      : clone;
    for (const [path, value] of updates) setDeep(target, path, value);
    onUpdate(clone);
  };

  // ── Chart type flags ──────────────────────────────────────────────────────
  const isMap = chartType === 'map-world' || chartType === 'map-europe';
  const isPie = chartType === 'pie';
  const isBar = chartType === 'bar' || chartType === 'bar-h';
  const isLine = chartType === 'line';
  const isArea = chartType === 'area';
  const isScatter = chartType === 'scatter';
  const isHeatmap = chartType === 'heatmap';
  const isTimeline = chartType === 'timeline';
  const hasAxes = !isMap && !isPie;

  // ── Title ─────────────────────────────────────────────────────────────────
  const titleRaw = g('title');
  const titleText = typeof titleRaw === 'string' ? titleRaw : (g('title.text') ?? '');
  const titleOn = titleRaw !== null && titleRaw !== undefined && titleRaw !== '';
  const setTitle = (v: string) => {
    if (typeof titleRaw === 'string') u('title', v);
    else u('title.text', v);
  };
  const toggleTitle = (on: boolean) => {
    if (!on) u('title', null);
    else u('title', titleText || 'Nadpis grafu');
  };

  // ── Subtitle ──────────────────────────────────────────────────────────────
  const subtitleRaw = g('title.subtitle');
  const subtitleText = typeof subtitleRaw === 'string' ? subtitleRaw
    : Array.isArray(subtitleRaw) ? (subtitleRaw as string[]).join(' ') : '';
  const subtitleOn = !!subtitleText;

  // Ensures title is always in object form before touching subtitle
  const setSubtitle = (v: string) => {
    const clone = JSON.parse(JSON.stringify(spec));
    if (typeof clone.title === 'string') clone.title = { text: clone.title };
    else if (!clone.title || typeof clone.title !== 'object') clone.title = { text: titleText || 'Nadpis grafu' };
    if (!v) delete clone.title.subtitle; else clone.title.subtitle = v;
    onUpdate(clone);
  };
  const toggleSubtitle = (on: boolean) => {
    if (!on) setSubtitle('');
    else setSubtitle(subtitleText || 'Podnadpis grafu');
  };

  // ── Color scheme & legend ─────────────────────────────────────────────────
  // For maps the color is in condition; for regular charts it's direct
  const colorSchemeKey = isMap ? 'encoding.color.condition.scale.scheme' : 'encoding.color.scale.scheme';
  const colorSchemeVal = ge(colorSchemeKey) ?? (isMap ? 'oranges' : 'tableau10');
  const legendVal = ge('encoding.color.legend');
  const legendOn = legendVal !== null && legendVal !== undefined && legendVal !== false;

  return (
    <div style={{
      width: 280, background: 'white', borderLeft: '1px solid #e2e8f0',
      display: 'flex', flexDirection: 'column', overflowY: 'auto', flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid #e2e8f0', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 7,
        background: 'linear-gradient(135deg, #faf5ff, #ede9fe)',
      }}>
        <Palette size={15} style={{ color: '#7c3aed' }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#4c1d95' }}>Design</span>
        <span style={{ fontSize: 10, color: '#8b5cf6', background: '#ede9fe', padding: '1px 6px', borderRadius: 4 }}>
          {CHART_TYPES.find(c => c.id === chartType)?.emoji} {CHART_TYPES.find(c => c.id === chartType)?.label}
        </span>
        {isLayered && (
          <span style={{ fontSize: 9, color: '#f59e0b', background: '#fef3c7', padding: '1px 5px', borderRadius: 4, marginLeft: 'auto' }} title="Graf má více vrstev">
            vrstvy
          </span>
        )}
      </div>

      {/* ── OBECNÉ ─────────────────────────────────────────────────────────── */}
      <DSection title="Obecné">
        <DToggle label="Zobrazit nadpis" value={titleOn} onChange={toggleTitle} />
        {titleOn && (<>
          <DRow label="Text nadpisu">
            <input value={titleText} onChange={e => setTitle(e.target.value)} style={dInputStyle} />
          </DRow>
          <DColorRow label="Barva nadpisu" value={g('title.color') ?? '#0f172a'} onChange={v => u('title.color', v)} />
          <DSlider label="Velikost nadpisu" value={g('title.fontSize') ?? 14} min={10} max={28} fmt={v => `${v}px`} onChange={v => u('title.fontSize', v)} />
        </>)}

        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 8, marginTop: 2 }}>
          <DToggle label="Zobrazit podnadpis" value={subtitleOn} onChange={toggleSubtitle} />
          {subtitleOn && (<>
            <DRow label="Text podnadpisu">
              <input value={subtitleText} onChange={e => setSubtitle(e.target.value)} style={dInputStyle} />
            </DRow>
            <DColorRow label="Barva podnadpisu" value={g('title.subtitleColor') ?? '#64748b'} onChange={v => u('title.subtitleColor', v)} />
            <DSlider label="Velikost podnadpisu" value={g('title.subtitleFontSize') ?? 12} min={8} max={22}
              fmt={v => `${v}px`} onChange={v => u('title.subtitleFontSize', v)} />
          </>)}
        </div>
        <DSlider label="Šířka grafu" value={g('width') ?? 520} min={300} max={900} step={20} fmt={v => `${v}px`} onChange={v => u('width', v)} />
        <DSlider label="Výška grafu" value={g('height') ?? 360} min={150} max={700} step={20} fmt={v => `${v}px`} onChange={v => u('height', v)} />
        <DColorRow label="Barva pozadí" value={g('config.background') ?? '#f8fafc'} onChange={v => u('config.background', v)} />
        <DRow label="Písmo">
          <select value={g('config.font') ?? 'system-ui'} onChange={e => u('config.font', e.target.value)} style={{ ...dInputStyle, padding: '4px 6px' }}>
            <option value="Fenomen Sans, system-ui, sans-serif">Fenomen Sans (Vividbooks)</option>
            <option value="system-ui">System UI (výchozí)</option>
            <option value="Georgia, serif">Georgia (serifové)</option>
            <option value="'Courier New', monospace">Courier New (mono)</option>
            <option value="Arial, sans-serif">Arial</option>
            <option value="'Times New Roman', serif">Times New Roman</option>
          </select>
        </DRow>
      </DSection>

      {/* ── BARVY ──────────────────────────────────────────────────────────── */}
      <DSection title="Barvy">
        <DRow label="Barevné schéma">
          <select
            value={colorSchemeVal}
            onChange={e => ue(colorSchemeKey, e.target.value)}
            style={{ ...dInputStyle, padding: '4px 6px' }}
          >
            {(isMap ? MAP_COLOR_SCHEMES : COLOR_SCHEMES).map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </DRow>
        {!isMap && (
          <DToggle
            label="Zobrazit legendu"
            value={legendOn}
            onChange={v => ue('encoding.color.legend', v ? {} : null)}
          />
        )}
        {!isMap && legendOn && (<>
          <DRow label="Pozice legendy">
            <select
              value={ge('encoding.color.legend.orient') ?? 'right'}
              onChange={e => ue('encoding.color.legend.orient', e.target.value)}
              style={{ ...dInputStyle, padding: '4px 6px' }}
            >
              <option value="right">Vpravo</option>
              <option value="left">Vlevo</option>
              <option value="top">Nahoře</option>
              <option value="bottom">Dole</option>
              <option value="top-right">Vpravo nahoře</option>
              <option value="bottom-right">Vpravo dole</option>
            </select>
          </DRow>
          <DSlider label="Velikost popisků legendy"
            value={ge('encoding.color.legend.labelFontSize') ?? 11} min={7} max={22}
            fmt={v => `${v}px`} onChange={v => ue('encoding.color.legend.labelFontSize', v)} />
          <DSlider label="Velikost nadpisu legendy"
            value={ge('encoding.color.legend.titleFontSize') ?? 11} min={7} max={22}
            fmt={v => `${v}px`} onChange={v => ue('encoding.color.legend.titleFontSize', v)} />
          <DSlider label="Velikost symbolů"
            value={ge('encoding.color.legend.symbolSize') ?? 100} min={20} max={400} step={10}
            fmt={v => `${v}`} onChange={v => ue('encoding.color.legend.symbolSize', v)} />
          <DSlider label="Mezera mezi položkami"
            value={ge('encoding.color.legend.rowPadding') ?? 2} min={0} max={20}
            fmt={v => `${v}px`} onChange={v => ue('encoding.color.legend.rowPadding', v)} />
        </>)}
      </DSection>

      {/* ── SLOUPCOVÝ / TIMELINE ────────────────────────────────────────────── */}
      {(isBar || isTimeline) && (
        <DSection title="Sloupce">
          <DSlider
            label={chartType === 'bar' ? 'Zaoblení horních rohů' : 'Zaoblení pravých rohů'}
            value={gm('cornerRadiusTopLeft') ?? gm('cornerRadiusTopRight') ?? 0} min={0} max={20} fmt={v => `${v}px`}
            onChange={v => {
              if (chartType === 'bar') umMulti({ cornerRadiusTopLeft: v, cornerRadiusTopRight: v });
              else umMulti({ cornerRadiusTopRight: v, cornerRadiusBottomRight: v });
            }}
          />
          <DSlider label="Průhlednost" value={gm('opacity') ?? 1} min={0.05} max={1} step={0.05}
            fmt={v => `${Math.round(v * 100)}%`} onChange={v => um('opacity', v)} />
        </DSection>
      )}

      {/* ── SPOJNICOVÝ ─────────────────────────────────────────────────────── */}
      {isLine && (
        <DSection title="Čára">
          <DSlider label="Tloušťka čáry" value={gm('strokeWidth') ?? 2} min={0.5} max={8} step={0.5}
            fmt={v => `${v}px`} onChange={v => um('strokeWidth', v)} />
          <DToggle label="Zobrazit datové body"
            value={gm('point') !== false && gm('point') !== undefined ? !!gm('point') : false}
            onChange={v => um('point', v ? { filled: true, size: 60 } : false)} />
          {!!gm('point') && (
            <DSlider label="Velikost bodů"
              value={typeof gm('point') === 'object' ? ((gm('point') as any).size ?? 60) : 60}
              min={10} max={300}
              onChange={v => um('point', { ...(typeof gm('point') === 'object' ? gm('point') : { filled: true }), size: v })} />
          )}
          <DRow label="Tvar čáry">
            <select value={gm('interpolate') ?? 'linear'} onChange={e => um('interpolate', e.target.value)}
              style={{ ...dInputStyle, padding: '4px 6px' }}>
              {INTERPOLATE_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </DRow>
          <DToggle label="Přerušovaná čára"
            value={Array.isArray(gm('strokeDash'))}
            onChange={v => um('strokeDash', v ? [6, 3] : undefined)} />
          {Array.isArray(gm('strokeDash')) && (
            <DRow label="Vzor přerušení">
              <select
                value={JSON.stringify(gm('strokeDash'))}
                onChange={e => um('strokeDash', JSON.parse(e.target.value))}
                style={{ ...dInputStyle, padding: '4px 6px' }}>
                <option value="[6,3]">— — — střední</option>
                <option value="[4,2]">- - - hustá</option>
                <option value="[10,4]">— — — řídká</option>
                <option value="[2,2]">··· tečkovaná</option>
                <option value="[8,3,2,3]">—·— čárka-tečka</option>
              </select>
            </DRow>
          )}
        </DSection>
      )}

      {/* ── PLOŠNÝ ─────────────────────────────────────────────────────────── */}
      {isArea && (
        <DSection title="Výplň">
          <DSlider label="Průhlednost výplně" value={gm('fillOpacity') ?? 0.8} min={0.05} max={1} step={0.05}
            fmt={v => `${Math.round(v * 100)}%`} onChange={v => um('fillOpacity', v)} />
          <DRow label="Tvar čáry">
            <select value={gm('interpolate') ?? 'monotone'} onChange={e => um('interpolate', e.target.value)}
              style={{ ...dInputStyle, padding: '4px 6px' }}>
              {INTERPOLATE_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </DRow>
          <DToggle label="Zobrazit linii nahoře" value={!!gm('line')} onChange={v => um('line', v ? true : false)} />
        </DSection>
      )}

      {/* ── KOLÁČOVÝ ───────────────────────────────────────────────────────── */}
      {isPie && (
        <DSection title="Koláč / Donut">
          <DSlider label="Vnitřní poloměr (donut efekt)" value={gm('innerRadius') ?? 0} min={0} max={120}
            fmt={v => v === 0 ? 'Koláč' : `${v}px`} onChange={v => um('innerRadius', v)} />
          <DSlider label="Vnější poloměr" value={gm('outerRadius') ?? 120} min={60} max={180}
            fmt={v => `${v}px`} onChange={v => um('outerRadius', v)} />
          <DSlider label="Průhlednost" value={gm('opacity') ?? 1} min={0.05} max={1} step={0.05}
            fmt={v => `${Math.round(v * 100)}%`} onChange={v => um('opacity', v)} />
        </DSection>
      )}

      {/* ── BODOVÝ ─────────────────────────────────────────────────────────── */}
      {isScatter && (
        <DSection title="Body">
          <DSlider label="Velikost bodů" value={gm('size') ?? 120} min={10} max={600}
            onChange={v => um('size', v)} />
          <DSlider label="Průhlednost" value={gm('opacity') ?? 0.8} min={0.05} max={1} step={0.05}
            fmt={v => `${Math.round(v * 100)}%`} onChange={v => um('opacity', v)} />
          <DRow label="Tvar">
            <select value={gm('shape') ?? 'circle'} onChange={e => um('shape', e.target.value)}
              style={{ ...dInputStyle, padding: '4px 6px' }}>
              <option value="circle">● Kruh</option>
              <option value="square">■ Čtverec</option>
              <option value="diamond">◆ Kosočtverec</option>
              <option value="triangle-up">▲ Trojúhelník</option>
              <option value="cross">✚ Křížek</option>
              <option value="stroke">— Čárka</option>
            </select>
          </DRow>
          <DToggle label="Vyplněný tvar" value={gm('filled') !== false} onChange={v => um('filled', v)} />
        </DSection>
      )}

      {/* ── HEATMAPA ───────────────────────────────────────────────────────── */}
      {isHeatmap && (
        <DSection title="Buňky">
          <DSlider label="Zaoblení buněk" value={gm('cornerRadius') ?? 0} min={0} max={16}
            fmt={v => `${v}px`} onChange={v => um('cornerRadius', v)} />
          <DSlider label="Průhlednost" value={gm('opacity') ?? 1} min={0.05} max={1} step={0.05}
            fmt={v => `${Math.round(v * 100)}%`} onChange={v => um('opacity', v)} />
        </DSection>
      )}

      {/* ── MAPA ───────────────────────────────────────────────────────────── */}
      {isMap && (
        <DSection title="Mapa">
          {chartType === 'map-world' && (
            <DRow label="Typ projekce">
              <select value={g('projection.type') ?? 'naturalEarth1'} onChange={e => u('projection.type', e.target.value)}
                style={{ ...dInputStyle, padding: '4px 6px' }}>
                <option value="naturalEarth1">Natural Earth (výchozí)</option>
                <option value="mercator">Mercator (plochá)</option>
                <option value="equalEarth">Equal Earth (plochy zachovány)</option>
                <option value="orthographic">Ortografická (globus)</option>
                <option value="stereographic">Stereografická (pól)</option>
                <option value="conicEqualArea">Albers (kuželová)</option>
                <option value="robinson">Robinson</option>
                <option value="winkel3">Winkel Tripel</option>
              </select>
            </DRow>
          )}
          <DSlider label="Tloušťka hranic" value={gm('strokeWidth') ?? 0.5} min={0} max={4} step={0.25}
            fmt={v => `${v}px`} onChange={v => um('strokeWidth', v)} />
          <DColorRow label="Barva hranic" value={gm('stroke') ?? '#ffffff'} onChange={v => um('stroke', v)} />
          <DColorRow label="Barva moří (pozadí)" value={g('config.background') ?? '#dbeafe'} onChange={v => u('config.background', v)} />
          <DColorRow label="Státy bez dat" value={ge('encoding.color.value') ?? '#e2e8f0'} onChange={v => ue('encoding.color.value', v)} />
          <DToggle label="Zobrazit legendu" value={legendOn} onChange={v => ue('encoding.color.condition.legend', v ? {} : null)} />
        </DSection>
      )}

      {/* ── OSY ────────────────────────────────────────────────────────────── */}
      {hasAxes && (
        <DSection title="Osy" open={false}>
          <DRow label="Popis osy X">
            <input value={ge('encoding.x.title') ?? ''} placeholder="Automatický"
              onChange={e => ue('encoding.x.title', e.target.value || null)}
              style={dInputStyle} />
          </DRow>
          <DRow label="Popis osy Y">
            <input value={ge('encoding.y.title') ?? ''} placeholder="Automatický"
              onChange={e => ue('encoding.y.title', e.target.value || null)}
              style={dInputStyle} />
          </DRow>

          {/* Mřížky */}
          <DToggle label="Mřížka na ose X" value={ge('encoding.x.axis.grid') !== false}
            onChange={v => ue('encoding.x.axis.grid', v)} />
          <DToggle label="Mřížka na ose Y" value={ge('encoding.y.axis.grid') !== false}
            onChange={v => ue('encoding.y.axis.grid', v)} />

          {/* Popisky osy X */}
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 8, marginTop: 2 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Popisky osy X</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <DToggle label="Zobrazit popisky"
                value={ge('encoding.x.axis.labels') !== false}
                onChange={v => ue('encoding.x.axis.labels', v)} />
              {ge('encoding.x.axis.labels') !== false && (<>
                <DSlider label="Velikost písma" value={ge('encoding.x.axis.labelFontSize') ?? 11} min={7} max={20}
                  fmt={v => `${v}px`} onChange={v => ue('encoding.x.axis.labelFontSize', v)} />
                <DSlider label="Natočení" value={ge('encoding.x.axis.labelAngle') ?? 0} min={-90} max={0} step={15}
                  fmt={v => `${v}°`} onChange={v => ue('encoding.x.axis.labelAngle', v)} />
                <DRow label="Zobrazit jen klíčové">
                  <select
                    value={
                      ge('encoding.x.axis.tickCount') != null ? String(ge('encoding.x.axis.tickCount'))
                        : ge('encoding.x.axis.labelOverlap') === 'parity' ? 'parity'
                        : 'all'
                    }
                    onChange={e => {
                      const v = e.target.value;
                      if (v === 'all') {
                        ueBatch([['encoding.x.axis.tickCount', undefined], ['encoding.x.axis.labelOverlap', undefined]]);
                      } else if (v === 'parity') {
                        ueBatch([['encoding.x.axis.tickCount', undefined], ['encoding.x.axis.labelOverlap', 'parity']]);
                      } else {
                        ueBatch([['encoding.x.axis.tickCount', Number(v)], ['encoding.x.axis.labelOverlap', undefined]]);
                      }
                    }}
                    style={{ ...dInputStyle, padding: '4px 6px' }}
                  >
                    <option value="all">Všechny</option>
                    <option value="2">Jen začátek a konec</option>
                    <option value="parity">Každý druhý</option>
                    <option value="3">Max 3</option>
                    <option value="5">Max 5</option>
                    <option value="8">Max 8</option>
                    <option value="10">Max 10</option>
                  </select>
                </DRow>
              </>)}
            </div>
          </div>

          {/* Popisky osy Y */}
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Popisky osy Y</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <DToggle label="Zobrazit popisky"
                value={ge('encoding.y.axis.labels') !== false}
                onChange={v => ue('encoding.y.axis.labels', v)} />
              {ge('encoding.y.axis.labels') !== false && (<>
                <DSlider label="Velikost písma" value={ge('encoding.y.axis.labelFontSize') ?? 11} min={7} max={20}
                  fmt={v => `${v}px`} onChange={v => ue('encoding.y.axis.labelFontSize', v)} />
                <DRow label="Zobrazit jen klíčové">
                  <select
                    value={
                      ge('encoding.y.axis.tickCount') != null ? String(ge('encoding.y.axis.tickCount'))
                        : 'all'
                    }
                    onChange={e => {
                      const v = e.target.value;
                      if (v === 'all') ue('encoding.y.axis.tickCount', undefined);
                      else ue('encoding.y.axis.tickCount', Number(v));
                    }}
                    style={{ ...dInputStyle, padding: '4px 6px' }}
                  >
                    <option value="all">Všechny</option>
                    <option value="2">Jen začátek a konec</option>
                    <option value="3">Max 3</option>
                    <option value="5">Max 5</option>
                    <option value="8">Max 8</option>
                    <option value="10">Max 10</option>
                  </select>
                </DRow>
              </>)}
            </div>
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
            <DToggle label="Nulová osa Y" value={ge('encoding.y.scale.zero') !== false}
              onChange={v => ue('encoding.y.scale.zero', v)} />
          </div>
        </DSection>
      )}

      {/* ── TOOLTIP ─────────────────────────────────────────────────────────── */}
      <DSection title="Tooltip" open={false}>
        <DToggle label="Zobrazit tooltip" value={gm('tooltip') !== false}
          onChange={v => um('tooltip', v ? true : false)} />
      </DSection>

      <div style={{ padding: 12, marginTop: 'auto' }}>
        <button
          onClick={() => {
            navigator.clipboard.writeText(JSON.stringify(spec, null, 2));
            toast.success('Spec zkopírován do schránky');
          }}
          style={{
            width: '100%', padding: '8px', borderRadius: 8, border: '1px solid #e2e8f0',
            background: 'white', color: '#6b7280', fontSize: 11, cursor: 'pointer', fontWeight: 600,
          }}
        >
          📋 Kopírovat JSON spec
        </button>
      </div>
    </div>
  );
}

// ─── Sub-komponenty ───────────────────────────────────────────────────────────

function SideSection({
  title, icon, open, onToggle, children,
}: {
  title: string; icon: React.ReactNode; open: boolean;
  onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{ borderBottom: '1px solid #1e293b' }}>
      <button
        onClick={onToggle}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}
      >
        <span style={{ color: '#475569' }}>{icon}</span>
        <span style={{ flex: 1, textAlign: 'left' }}>{title}</span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && <div style={{ padding: '0 14px 14px' }}>{children}</div>}
    </div>
  );
}

// ─── GenerationWizard ─────────────────────────────────────────────────────────

const TIME_PERIOD_OPTIONS = [
  { id: 'any',      label: 'Nezáleží',        emoji: '♾️' },
  { id: 'history',  label: 'Historicky (100+ let)', emoji: '🏛️' },
  { id: 'decade',   label: 'Posledních 10 let', emoji: '📅' },
  { id: 'recent',   label: 'Posledních 5 let',  emoji: '🗓️' },
  { id: 'year2024', label: 'Rok 2024',           emoji: '📆' },
  { id: 'year2023', label: 'Rok 2023',           emoji: '📆' },
];

function GenerationWizard({
  step, onStepChange,
  topic, onTopicChange,
  focus, onFocusChange,
  chartType, onChartTypeSelect,
  timePeriod, onTimePeriodChange,
  generating, onGenerate,
  realDataLabel, realDataCount, fetchingRealData,
}: {
  step: 1 | 2 | 3;
  onStepChange: (s: 1 | 2 | 3) => void;
  topic: string;
  onTopicChange: (v: string) => void;
  focus: string;
  onFocusChange: (v: string) => void;
  chartType: ChartTypeId;
  onChartTypeSelect: (id: ChartTypeId) => void;
  timePeriod: string;
  onTimePeriodChange: (v: string) => void;
  generating: boolean;
  onGenerate: () => void;
  realDataLabel: string | null;
  realDataCount: number;
  fetchingRealData: boolean;
}) {
  const canAdvance1 = topic.trim().length >= 2;

  // Badge zobrazující stav reálných dat
  const DataBadge = () => {
    if (step === 1) return null;
    if (fetchingRealData) return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
        background: '#fefce8', border: '1px solid #fde047', borderRadius: 8,
        fontSize: 12, color: '#854d0e', marginBottom: 16,
      }}>
        <Loader2 size={12} className="animate-spin" />
        Hledám reálná data z World Bank…
      </div>
    );
    if (realDataLabel && realDataCount > 0) return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
        background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8,
        fontSize: 12, color: '#166534', marginBottom: 16,
      }}>
        ✅ Nalezena reálná data: <strong>{realDataLabel}</strong> — {realDataCount} záznamů z World Bank
      </div>
    );
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
        background: '#fafafa', border: '1px solid #e2e8f0', borderRadius: 8,
        fontSize: 12, color: '#94a3b8', marginBottom: 16,
      }}>
        ℹ️ Pro toto téma nebyla nalezena data z World Bank — AI použije vlastní znalosti
      </div>
    );
  };

  const stepDot = (n: number, label: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700,
        background: step >= n ? '#6366f1' : '#e2e8f0',
        color: step >= n ? 'white' : '#94a3b8',
        flexShrink: 0,
      }}>{n}</div>
      <span style={{ fontSize: 12, color: step === n ? '#0f172a' : '#94a3b8', fontWeight: step === n ? 600 : 400 }}>{label}</span>
    </div>
  );

  return (
    <div style={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 36, justifyContent: 'center' }}>
        {stepDot(1, 'Téma')}
        <div style={{ flex: 1, maxWidth: 48, height: 2, background: step >= 2 ? '#6366f1' : '#e2e8f0', borderRadius: 2 }} />
        {stepDot(2, 'Typ grafu')}
        <div style={{ flex: 1, maxWidth: 48, height: 2, background: step >= 3 ? '#6366f1' : '#e2e8f0', borderRadius: 2 }} />
        {stepDot(3, 'Období')}
      </div>

      {/* ── KROK 1: TÉMA ─────────────────────────────────────────────────────── */}
      {step === 1 && (
        <div style={{ animation: 'fadeIn .2s ease' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 6, textAlign: 'center' }}>
            📊 Na co chceš graf?
          </div>
          <div style={{ fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24 }}>
            Zadej téma – zeměpis, dějepis, ekonomika, biologie…
          </div>

          <textarea
            autoFocus
            value={topic}
            onChange={e => onTopicChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && canAdvance1) { e.preventDefault(); onStepChange(2); } }}
            placeholder="Např.: Populace zemí EU, Rozloha kontinentů, Bitvy 1. světové války…"
            rows={3}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 12,
              border: `2px solid ${canAdvance1 ? '#6366f1' : '#e2e8f0'}`,
              fontSize: 15, outline: 'none', resize: 'none', fontFamily: 'system-ui',
              boxSizing: 'border-box', transition: 'border-color .15s',
              color: '#0f172a', background: 'white',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            }}
          />

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, fontWeight: 600 }}>
              Co konkrétně chceš ukázat? <span style={{ fontWeight: 400, color: '#94a3b8' }}>(nepovinné)</span>
            </div>
            <input
              value={focus}
              onChange={e => onFocusChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canAdvance1) onStepChange(2); }}
              placeholder="Např.: srovnání podle HDP, vývoj v čase, top 10 největších…"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                border: '1px solid #e2e8f0', fontSize: 13, outline: 'none',
                fontFamily: 'system-ui', boxSizing: 'border-box', color: '#0f172a', background: 'white',
              }}
            />
          </div>

          {/* Example chips */}
          <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['Délka největších řek světa', 'HDP zemí EU 2024', 'Složení atmosféry Země', 'Vznik a zánik SSSR', 'Výška nejvyšších hor'].map(ex => (
              <button
                key={ex}
                onClick={() => { onTopicChange(ex); onStepChange(2); }}
                style={{
                  padding: '5px 12px', borderRadius: 20, border: '1px solid #e2e8f0',
                  background: 'white', color: '#475569', fontSize: 12, cursor: 'pointer',
                  transition: 'all .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#6366f1'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#475569'; }}
              >
                {ex}
              </button>
            ))}
          </div>

          <button
            onClick={() => onStepChange(2)}
            disabled={!canAdvance1}
            style={{
              marginTop: 24, width: '100%', padding: '13px', borderRadius: 12, border: 'none',
              background: canAdvance1 ? 'linear-gradient(135deg, #6366f1, #22d3ee)' : '#e2e8f0',
              color: canAdvance1 ? 'white' : '#94a3b8',
              fontSize: 15, fontWeight: 700, cursor: canAdvance1 ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            Pokračovat →
          </button>
        </div>
      )}

      {/* ── KROK 2: TYP VIZUALIZACE ─────────────────────────────────────────── */}
      {step === 2 && (
        <div style={{ animation: 'fadeIn .2s ease' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 6, textAlign: 'center' }}>
            🎨 Jak to chceš zobrazit?
          </div>
          <div style={{ fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 16 }}>
            Vyber typ vizualizace pro: <strong style={{ color: '#6366f1' }}>{topic}</strong>
          </div>
          <DataBadge />

          {['Grafy', 'Mapy'].map(group => (
            <div key={group} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>{group}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                {CHART_TYPES.filter(c => c.group === group).map(c => (
                  <button
                    key={c.id}
                    onClick={() => { onChartTypeSelect(c.id); onStepChange(3); }}
                    title={c.desc}
                    style={{
                      padding: '14px 12px', borderRadius: 12, border: '2px solid',
                      borderColor: chartType === c.id ? '#6366f1' : '#e2e8f0',
                      background: chartType === c.id ? '#eef2ff' : 'white',
                      cursor: 'pointer', textAlign: 'center',
                      boxShadow: chartType === c.id ? '0 0 0 3px rgba(99,102,241,0.12)' : '0 1px 4px rgba(0,0,0,0.04)',
                      transition: 'all .15s',
                    }}
                    onMouseEnter={e => { if (chartType !== c.id) { e.currentTarget.style.borderColor = '#c7d2fe'; e.currentTarget.style.background = '#f5f3ff'; } }}
                    onMouseLeave={e => { if (chartType !== c.id) { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'white'; } }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 6 }}>{c.emoji}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: chartType === c.id ? '#4f46e5' : '#0f172a' }}>{c.label}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{c.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={() => onStepChange(1)}
              style={{ padding: '11px 20px', borderRadius: 10, border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
            >
              ← Zpět
            </button>
            <button
              onClick={() => onStepChange(3)}
              style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #6366f1, #22d3ee)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Pokračovat →
            </button>
          </div>
        </div>
      )}

      {/* ── KROK 3: ČASOVÉ OBDOBÍ ────────────────────────────────────────────── */}
      {step === 3 && (
        <div style={{ animation: 'fadeIn .2s ease' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 6, textAlign: 'center' }}>
            📅 Jaké časové období?
          </div>
          <div style={{ fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 16 }}>
            {CHART_TYPES.find(c => c.id === chartType)?.emoji} {CHART_TYPES.find(c => c.id === chartType)?.label} · <strong style={{ color: '#6366f1' }}>{topic}</strong>
          </div>
          <DataBadge />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
            {TIME_PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => onTimePeriodChange(opt.id)}
                style={{
                  padding: '12px 14px', borderRadius: 12, border: '2px solid',
                  borderColor: timePeriod === opt.id ? '#6366f1' : '#e2e8f0',
                  background: timePeriod === opt.id ? '#eef2ff' : 'white',
                  cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                  boxShadow: timePeriod === opt.id ? '0 0 0 3px rgba(99,102,241,0.12)' : '0 1px 4px rgba(0,0,0,0.04)',
                  transition: 'all .15s',
                }}
              >
                <span style={{ fontSize: 20 }}>{opt.emoji}</span>
                <span style={{ fontSize: 13, fontWeight: timePeriod === opt.id ? 700 : 500, color: timePeriod === opt.id ? '#4f46e5' : '#0f172a' }}>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>

          <div style={{
            padding: '12px 16px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0',
            marginBottom: 20, fontSize: 13, color: '#475569', lineHeight: 1.5,
          }}>
            <strong>Shrnutí:</strong> {CHART_TYPES.find(c => c.id === chartType)?.emoji} {CHART_TYPES.find(c => c.id === chartType)?.label}
            {' · '}{topic}
            {focus && <> · <em>{focus}</em></>}
            {' · '}{TIME_PERIOD_OPTIONS.find(o => o.id === timePeriod)?.label}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => onStepChange(2)}
              style={{ padding: '11px 20px', borderRadius: 10, border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
            >
              ← Zpět
            </button>
            <button
              onClick={onGenerate}
              disabled={generating}
              style={{
                flex: 1, padding: '13px', borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg, #6366f1, #22d3ee)',
                color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
              }}
            >
              <Wand2 size={17} /> Vygenerovat vizualizaci
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({
  chartType, onGenerate, topicEmpty,
}: {
  chartType: ChartTypeId; onGenerate: () => void; topicEmpty: boolean;
}) {
  const ct = CHART_TYPES.find(c => c.id === chartType)!;
  return (
    <div style={{ textAlign: 'center', maxWidth: 420 }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>{ct.emoji}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
        {ct.label}
      </div>
      <div style={{ fontSize: 14, color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>
        {ct.desc}. Zadej téma vlevo a stiskni <strong>Generovat</strong> – AI vytvoří vizualizaci s reálnými daty.
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
        {getExampleTopics(chartType).map(ex => (
          <span key={ex} style={{ padding: '4px 10px', borderRadius: 20, background: '#f1f5f9', color: '#475569', fontSize: 12 }}>
            {ex}
          </span>
        ))}
      </div>
      {topicEmpty && (
        <div style={{ fontSize: 12, color: '#f59e0b', background: '#fef3c7', padding: '8px 16px', borderRadius: 8 }}>
          ← Nejdřív zadej téma do levého panelu
        </div>
      )}
    </div>
  );
}

function getExampleTopics(chartType: ChartTypeId): string[] {
  const examples: Record<ChartTypeId, string[]> = {
    'bar':       ['Rozloha kontinentů', 'Výška nejvyšších hor', 'HDP zemí EU'],
    'bar-h':     ['Délka největších řek', 'Počet obyvatel měst ČR', 'Životnost živočichů'],
    'line':      ['Vývoj populace světa', 'Teplota Prahy 1900–2024', 'HDP ČR po roce 1990'],
    'area':      ['Spotřeba energie zdrojů', 'Složení atmosféry v čase', 'Vývoj počtu druhů'],
    'pie':       ['Složení atmosféry', 'Náboženství ve světě', 'Energetický mix ČR'],
    'scatter':   ['HDP vs. délka života', 'CO₂ vs. teplota', 'Rozloha vs. populace'],
    'heatmap':   ['Srážky v měsících', 'Teploty v Evropě', 'Aktivita sopek dle roku'],
    'timeline':  ['Starověký Řím', 'Vznik států Evropy', '1. světová válka'],
    'map-world': ['Populace států světa', 'HDP na obyvatele', 'CO₂ emise dle státu'],
    'map-europe':['Populace evropských zemí', 'HDP Evropy', 'Délka pobřeží'],
  };
  return examples[chartType] ?? [];
}

function toolbarBtn(active: boolean, primary = false, accentColor = '#4f46e5') {
  const bg = primary ? '#6366f1' : active ? '#ede9fe' : '#f1f5f9';
  const color = primary ? 'white' : active ? accentColor : '#475569';
  return {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: 600, background: bg, color,
  } as React.CSSProperties;
}
