/**
 * QuizMap – interaktivní mapa pro kvízy (react-simple-maps / SVG)
 *
 * Vrstvy:
 *   - Moderní státy   – world-atlas TopoJSON (výchozí)
 *   - Historické státy – aourednik/historical-basemaps GeoJSON (když je nastaven historicalYear)
 *   - Řeky            – Natural Earth 10m (showRivers)
 *   - Města           – Natural Earth 10m/50m dle regionu (showCities)
 *   - Markery         – vlastní body učitele
 *
 * Year picker – epochy s tlačítky pro výběr roku (zobrazí se jako overlay).
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps';

import type { SavedMap, MapMarker, MapRegionId } from '../../types/topic-dataset';
import { chatWithAIProxy } from '../../utils/ai-chat-proxy';

// ─── Datasety ─────────────────────────────────────────────────────────────────
// ── Základní mapa ─────────────────────────────────────────────────────────────
// 50m = ~2 MB, rychlé načtení; 10m = ~8 MB, příliš pomalé pro world view
const WORLD_TOPO        = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json';
// ── Hydrografie ───────────────────────────────────────────────────────────────
const RIVERS_URL        = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_10m_rivers_lake_centerlines.geojson';
const RIVERS_EUROPE_URL = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_10m_rivers_europe.geojson';
// Města: 10m všude (ne jen pro Evropu)
const CITIES_URL        = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_10m_populated_places.geojson';
const CITIES_10M_URL    = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_10m_populated_places.geojson';
// Fyzická geografie: nejvyšší dostupné rozlišení NE
const PHYSICAL_POLYS_URL = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_10m_geography_regions_polys.geojson';
const MARINE_POLYS_URL   = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_10m_geography_marine_polys.geojson';
const LAKES_URL          = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_10m_lakes.geojson';
// ── Doprava ───────────────────────────────────────────────────────────────────
const AIRPORTS_URL       = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_10m_airports.geojson';
// Železnice: ne_10m je nejvyšší NE, pro detailnější data → OpenRailwayMap (OSM)
const RAILROADS_URL      = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_10m_railroads.geojson';
// ── Politika ──────────────────────────────────────────────────────────────────
const TIME_ZONES_URL     = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_10m_time_zones.geojson';
// ── Geologie ──────────────────────────────────────────────────────────────────
// Tektonické desky: PB2002 model (Peter Bird) – nejpřesnější volně dostupný
const TECTONIC_PLATES_URL = 'https://cdn.jsdelivr.net/gh/fraxen/tectonicplates@master/GeoJSON/PB2002_plates.json';
// Vulkány: Smithsonian GVP – globální databáze
// Vulkány jsou statická data (Smithsonian GVP) — žádná URL závislost
// Zemětřesení: USGS FDSN API – živá data, cache 24h
const EARTHQUAKES_URL     = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=5.5&limit=500&starttime=2022-01-01&endtime=2024-12-31';
// ── Klima / biomy ─────────────────────────────────────────────────────────────
// Köppen-Geiger: Beck et al. 2018 (0.5° rozlišení)
const KOPPEN_URL          = 'https://cdn.jsdelivr.net/gh/drkarthick/climate_classification@master/data/koppen_geiger.geojson';
// Biomy: Resolve Ecoregions 2017 (zjednodušené polygony)
const BIOMES_URL          = 'https://cdn.jsdelivr.net/gh/Alois-xx/ecoregions@master/Ecoregions2017_simplified.geojson';
const HIST_BASE           = 'https://cdn.jsdelivr.net/gh/aourednik/historical-basemaps@master/geojson';

const EUROPE_REGIONS = new Set<MapRegionId>([
  'europe', 'central-europe', 'mediterranean', 'italy', 'greece', 'france', 'germany',
]);

// ─── Historické roky – epochy ─────────────────────────────────────────────────
export const HIST_EPOCHS: { label: string; years: { key: string; display: string }[] }[] = [
  {
    label: 'Pravěk',
    years: [
      { key: 'bc123000', display: '123 000 př.' },
      { key: 'bc10000',  display: '10 000 př.' },
      { key: 'bc8000',   display: '8 000 př.' },
      { key: 'bc5000',   display: '5 000 př.' },
      { key: 'bc4000',   display: '4 000 př.' },
      { key: 'bc3000',   display: '3 000 př.' },
      { key: 'bc2000',   display: '2 000 př.' },
      { key: 'bc1500',   display: '1 500 př.' },
    ],
  },
  {
    label: 'Starověk',
    years: [
      { key: 'bc1000', display: '1 000 př.' },
      { key: 'bc700',  display: '700 př.' },
      { key: 'bc500',  display: '500 př.' },
      { key: 'bc400',  display: '400 př.' },
      { key: 'bc323',  display: '323 př.' },
      { key: 'bc300',  display: '300 př.' },
      { key: 'bc200',  display: '200 př.' },
      { key: 'bc100',  display: '100 př.' },
      { key: 'bc1',    display: '1 př.' },
    ],
  },
  {
    label: 'Středověk',
    years: [
      { key: '100',  display: '100' },
      { key: '200',  display: '200' },
      { key: '300',  display: '300' },
      { key: '400',  display: '400' },
      { key: '500',  display: '500' },
      { key: '600',  display: '600' },
      { key: '700',  display: '700' },
      { key: '800',  display: '800' },
      { key: '900',  display: '900' },
      { key: '1000', display: '1000' },
      { key: '1100', display: '1100' },
      { key: '1200', display: '1200' },
      { key: '1279', display: '1279' },
      { key: '1300', display: '1300' },
      { key: '1400', display: '1400' },
    ],
  },
  {
    label: 'Novověk',
    years: [
      { key: '1492', display: '1492' },
      { key: '1500', display: '1500' },
      { key: '1530', display: '1530' },
      { key: '1600', display: '1600' },
      { key: '1650', display: '1650' },
      { key: '1700', display: '1700' },
      { key: '1715', display: '1715' },
      { key: '1783', display: '1783' },
      { key: '1800', display: '1800' },
      { key: '1815', display: '1815' },
    ],
  },
  {
    label: 'Moderní',
    years: [
      { key: '1880', display: '1880' },
      { key: '1900', display: '1900' },
      { key: '1914', display: '1914' },
      { key: '1920', display: '1920' },
      { key: '1930', display: '1930' },
      { key: '1938', display: '1938' },
      { key: '1945', display: '1945' },
      { key: '1960', display: '1960' },
      { key: '1994', display: '1994' },
      { key: '2000', display: '2000' },
      { key: '2010', display: '2010' },
    ],
  },
];

// Všechny roky naplocho pro lookup
const ALL_YEARS = HIST_EPOCHS.flatMap(e => e.years);

export function histYearDisplay(key: string): string {
  return ALL_YEARS.find(y => y.key === key)?.display ?? key;
}

function histUrl(year: string): string {
  return `${HIST_BASE}/world_${year}.geojson`;
}

// ─── České překlady historických názvů ───────────────────────────────────────
// Klíč = anglický název z GeoJSON (NAME / PARTOF), hodnota = český překlad
const CZ_NAMES: Record<string, string> = {
  // ── Starověk ──────────────────────────────────────────────────────────────
  'Roman Empire':                     'Římská říše',
  'Western Roman Empire':             'Západořímská říše',
  'Eastern Roman Empire':             'Východořímská říše',
  'Byzantine Empire':                 'Byzantská říše',
  'Achaemenid Empire':                'Achajmenovská říše',
  'Macedonian Empire':                'Makedonská říše',
  'Seleucid Empire':                  'Seleukovská říše',
  'Ptolemaic Kingdom':                'Ptolemaiovský Egypt',
  'Carthage':                         'Kartágo',
  'Kingdom of Pontus':                'Pontské království',
  'Parthian Empire':                  'Parthská říše',
  'Sassanid Empire':                  'Sásánovská říše',
  'Han Empire':                       'Říše Chan',
  'Maurya Empire':                    'Maurjovská říše',
  'Kushan Empire':                    'Kušánská říše',
  'Kingdom of Kush':                  'Kušské království',
  'Kingdom of Axum':                  'Aksumské království',
  'Egypt':                            'Egypt',
  'Nubia':                            'Núbie',
  'Athens':                           'Athény',
  'Sparta':                           'Sparta',
  'Epirus':                           'Épeiros',

  // ── Středověk ─────────────────────────────────────────────────────────────
  'Carolingian Empire':               'Franská říše (Karolínci)',
  'Frankish Kingdom':                 'Franská říše',
  'Holy Roman Empire':                'Svatá říše římská',
  'Kingdom of France':                'Francouzské království',
  'Kingdom of England':               'Anglické království',
  'Kingdom of Scotland':              'Skotské království',
  'Kingdom of Ireland':               'Irské království',
  'Kingdom of Norway':                'Norské království',
  'Kingdom of Sweden':                'Švédské království',
  'Kingdom of Denmark':               'Dánské království',
  'Kingdom of Hungary':               'Uherské království',
  'Kingdom of Poland':                'Polské království',
  'Kingdom of Bohemia':               'České království',
  'Kingdom of Croatia':               'Chorvatské království',
  'Kingdom of Serbia':                'Srbské království',
  'Kingdom of Bulgaria':              'Bulharské carství',
  'Duchy of Austria':                 'Rakouské vévodství',
  'Duchy of Burgundy':                'Burgundské vévodství',
  'Grand Duchy of Lithuania':         'Velkovévodství litevské',
  'Polish-Lithuanian Commonwealth':   'Polsko-litevská unie',
  'Kievan Rus':                       'Kyjevská Rus',
  'Principality of Moscow':           'Moskevské knížectví',
  'Muscovy':                          'Moskevské carství',
  'Novgorod Republic':                'Novgorodská republika',
  'Mongol Empire':                    'Mongolská říše',
  'Golden Horde':                     'Zlatá horda',
  'Ilkhanate':                        'Ílchánát',
  'Chagatai Khanate':                 'Čagatajský chanát',
  'Timurid Empire':                   'Timúrovská říše',
  'Ottoman Empire':                   'Osmanská říše',
  'Mamluk Sultanate':                 'Mamlúcký sultanát',
  'Abbasid Caliphate':                'Abbásovský chalífát',
  'Umayyad Caliphate':                'Umajjovský chalífát',
  'Fatimid Caliphate':                'Fátimovský chalífát',
  'Sultanate of Rum':                 'Rumský sultanát',
  'Crusader States':                  'Křižácké státy',
  'Kingdom of Jerusalem':             'Jeruzalémské království',
  'Republic of Venice':               'Benátská republika',
  'Republic of Genoa':                'Janovská republika',
  'Duchy of Milan':                   'Milánské vévodství',
  'Papal States':                     'Papežský stát',
  'Kingdom of Sicily':                'Sicilské království',
  'Kingdom of Naples':                'Neapolské království',
  'Kingdom of Aragon':                'Aragonské království',
  'Kingdom of Castile':               'Kastilské království',
  'Kingdom of Portugal':              'Portugalské království',
  'Kingdom of León':                  'Leónské království',
  'Emirate of Granada':               'Granadský emirát',
  'Caliphate of Córdoba':             'Córdobský chalífát',
  'Mali Empire':                      'Malská říše',
  'Songhai Empire':                   'Songajská říše',
  'Kanem-Bornu':                      'Kánemsko-bornská říše',
  'Kingdom of Ghana':                 'Ghanské království',
  'Delhi Sultanate':                  'Dillíský sultanát',
  'Vijayanagara Empire':              'Vijayanágarská říše',
  'Khmer Empire':                     'Khmerská říše',
  'Song Empire':                      'Říše Sung',
  'Tang Empire':                      'Říše Tchang',
  'Liao Dynasty':                     'Dynastie Liao',
  'Jin Dynasty':                      'Dynastie Ťin',
  'Yuan Dynasty':                     'Dynastie Jüan',
  'Ming Empire':                      'Říše Ming',
  'Joseon':                           'Čosŏn',
  'Japan':                            'Japonsko',

  // ── Novověk ───────────────────────────────────────────────────────────────
  'Habsburg Monarchy':                'Habsburská monarchie',
  'Austrian Empire':                  'Rakouské císařství',
  'Austro-Hungarian Empire':          'Rakousko-Uhersko',
  'Austrian Netherlands':             'Rakouské Nizozemí',
  'Spanish Empire':                   'Španělské impérium',
  'Kingdom of Spain':                 'Španělské království',
  'Portuguese Empire':                'Portugalské impérium',
  'Kingdom of Portugal':              'Portugalské království',
  'French Empire':                    'Francouzské císařství',
  'First French Empire':              'První francouzské císařství',
  'Kingdom of Prussia':               'Pruské království',
  'Brandenburg-Prussia':              'Braniborsko-Prusko',
  'Russian Empire':                   'Ruská říše',
  'Tsardom of Russia':                'Ruské carství',
  'Swedish Empire':                   'Švédské impérium',
  'Danish-Norwegian Union':           'Dánsko-norská unie',
  'Republic of the United Provinces': 'Spojené provincie (Holandsko)',
  'Dutch Republic':                   'Holandská republika',
  'Kingdom of the Netherlands':       'Nizozemské království',
  'Republic of Florence':             'Florentská republika',
  'Grand Duchy of Tuscany':           'Toskánské velkovévodství',
  'Kingdom of Sardinia':              'Sardinské království',
  'Kingdom of the Two Sicilies':      'Království obojí Sicílie',
  'Duchy of Savoy':                   'Savojské vévodství',
  'Swiss Confederation':              'Švýcarská konfederace',
  'Safavid Empire':                   'Safávidská říše',
  'Mughal Empire':                    'Mughalská říše',
  'Maratha Empire':                   'Maráthská říše',
  'Qing Empire':                      'Říše Čching (Qing)',
  'Tokugawa Shogunate':               'Tokugawský šógunát',
  'Aztec Empire':                     'Aztécká říše',
  'Inca Empire':                      'Incká říše',
  'British Empire':                   'Britské impérium',
  'Kingdom of Great Britain':         'Království Velká Británie',
  'United Kingdom':                   'Spojené království',
  'Confederate States':               'Konfederované státy',
  'United States':                    'Spojené státy americké',
  'New Spain':                        'Nové Španělsko',
  'New France':                       'Nová Francie',
  'Brazil':                           'Brazílie',
  'Empire of Brazil':                 'Brazilské císařství',
  'Napoleonic Empire':                'Napoleonova říše',

  // ── Moderní ───────────────────────────────────────────────────────────────
  'German Empire':                    'Německé císařství',
  'Weimar Republic':                  'Výmarská republika',
  'Nazi Germany':                     'Nacistické Německo',
  'Third Reich':                      'Třetí říše',
  'Germany':                          'Německo',
  'East Germany':                     'NDR (Východní Německo)',
  'West Germany':                     'NSR (Západní Německo)',
  'France':                           'Francie',
  'Italy':                            'Itálie',
  'Kingdom of Italy':                 'Italské království',
  'Russia':                           'Rusko',
  'Soviet Union':                     'Sovětský svaz',
  'USSR':                             'SSSR',
  'People\'s Republic of China':      'Čínská lidová republika',
  'Republic of China':                'Čínská republika',
  'China':                            'Čína',
  'Japan':                            'Japonsko',
  'Japanese Empire':                  'Japonské císařství',
  'Ottoman Empire (late)':            'Osmanská říše (pozdní)',
  'Turkey':                           'Turecko',
  'India':                            'Indie',
  'British India':                    'Britská Indie',
  'Pakistan':                         'Pákistán',
  'Afghanistan':                      'Afghánistán',
  'Iran':                             'Írán',
  'Persia':                           'Persie',
  'Iraq':                             'Irák',
  'Arabia':                           'Arábie',
  'Belgian Congo':                    'Belgické Kongo',
  'French West Africa':               'Francouzská Západní Afrika',
  'British East Africa':              'Britská Východní Afrika',
  'Ethiopia':                         'Etiopie',
  'Abyssinia':                        'Habeš (Etiopie)',
  'South Africa':                     'Jižní Afrika',
  'Rhodesia':                         'Rhodésie',
  'Mexico':                           'Mexiko',
  'Argentina':                        'Argentina',
  'Chile':                            'Chile',
  'Peru':                             'Peru',
  'Colombia':                         'Kolumbie',
  'Venezuela':                        'Venezuela',
  'Canada':                           'Kanada',
  'Australia':                        'Austrálie',
  'New Zealand':                      'Nový Zéland',
  'Korea':                            'Korea',
  'North Korea':                      'Severní Korea',
  'South Korea':                      'Jižní Korea',
  'Vietnam':                          'Vietnam',
  'Czechoslovakia':                   'Československo',
  'Czech Republic':                   'Česká republika',
  'Slovakia':                         'Slovensko',
  'Yugoslavia':                       'Jugoslávie',
  'Poland':                           'Polsko',
  'Hungary':                          'Maďarsko',
  'Romania':                          'Rumunsko',
  'Bulgaria':                         'Bulharsko',
  'Greece':                           'Řecko',
  'Albania':                          'Albánie',
  'Serbia':                           'Srbsko',
  'Croatia':                          'Chorvatsko',
  'Bosnia':                           'Bosna',
  'Montenegro':                       'Černá Hora',
  'Slovenia':                         'Slovinsko',
  'Ukraine':                          'Ukrajina',
  'Belarus':                          'Bělorusko',
  'Lithuania':                        'Litva',
  'Latvia':                           'Lotyšsko',
  'Estonia':                          'Estonsko',
  'Finland':                          'Finsko',
  'Sweden':                           'Švédsko',
  'Norway':                           'Norsko',
  'Denmark':                          'Dánsko',
  'Iceland':                          'Island',
  'Netherlands':                      'Nizozemsko',
  'Belgium':                          'Belgie',
  'Luxembourg':                       'Lucembursko',
  'Switzerland':                      'Švýcarsko',
  'Austria':                          'Rakousko',
  'Spain':                            'Španělsko',
  'Portugal':                         'Portugalsko',
  'United Kingdom of Great Britain and Ireland': 'Spojené království',
  'Great Britain':                    'Velká Británie',
  'Ireland':                          'Irsko',
  'Scotland':                         'Skotsko',
  'Wales':                            'Wales',
  'England':                          'Anglie',
  'Morocco':                          'Maroko',
  'Algeria':                          'Alžírsko',
  'Tunisia':                          'Tunisko',
  'Libya':                            'Libye',
  'Egypt':                            'Egypt',
  'Sudan':                            'Súdán',
  'Kenya':                            'Keňa',
  'Tanzania':                         'Tanzanie',
  'Congo':                            'Kongo',
  'Nigeria':                          'Nigérie',
  'Ghana':                            'Ghana',
  'Senegal':                          'Senegal',
  'Angola':                           'Angola',
  'Mozambique':                       'Mosambik',
  'Madagascar':                       'Madagaskar',
  'Saudi Arabia':                     'Saúdská Arábie',
  'Israel':                           'Izrael',
  'Palestine':                        'Palestina',
  'Syria':                            'Sýrie',
  'Lebanon':                          'Libanon',
  'Jordan':                           'Jordánsko',
  'Cyprus':                           'Kypr',
  'Malta':                            'Malta',
  'Iceland':                          'Island',
  'Greenland':                        'Grónsko',
  'Tibet':                            'Tibet',
  'Mongolia':                         'Mongolsko',
  'Philippines':                      'Filipíny',
  'Indonesia':                        'Indonésie',
  'Malaysia':                         'Malajsie',
  'Thailand':                         'Thajsko',
  'Burma':                            'Barma',
  'Myanmar':                          'Myanmar',
  'Cambodia':                         'Kambodža',
  'Laos':                             'Laos',
};

// ─── Slovník geografických pojmů pro pattern fallback ────────────────────────
const CZ_WORDS: Record<string, string> = {
  // Typy celků
  'culture':       'kultura',
  'civilization':  'civilizace',
  'empire':        'říše',
  'Empire':        'říše',
  'kingdom':       'království',
  'Kingdom':       'království',
  'republic':      'republika',
  'Republic':      'republika',
  'duchy':         'vévodství',
  'Duchy':         'vévodství',
  'principality':  'knížectví',
  'Principality':  'knížectví',
  'caliphate':     'chalífát',
  'Caliphate':     'chalífát',
  'sultanate':     'sultanát',
  'Sultanate':     'sultanát',
  'khanate':       'chanát',
  'Khanate':       'chanát',
  'horde':         'horda',
  'Horde':         'horda',
  'confederation': 'konfederace',
  'Confederation': 'konfederace',
  'federation':    'federace',
  'Federation':    'federace',
  'union':         'unie',
  'Union':         'unie',
  'state':         'stát',
  'State':         'stát',
  'shogunate':     'šógunát',
  'Shogunate':     'šógunát',
  'people':        'lid',
  'People':        'lid',
  'tribe':         'kmen',
  'Tribe':         'kmen',
  // Zeměpisné pojmy v názvech
  'of':  '',
  'the': '',
  'and': 'a',
  'Great': 'Velká',
  'Holy':  'Svatá',
  'New':   'Nová',
  'Old':   'Stará',
  'East':  'Východní',
  'West':  'Západní',
  'North': 'Severní',
  'South': 'Jižní',
  'Upper': 'Horní',
  'Lower': 'Dolní',
  'Inner': 'Vnitřní',
  'Outer': 'Vnější',
  'Roman': 'římská',
  'Byzantine': 'byzantská',
  'Islamic':   'islámská',
  'Arab':      'arabská',
  'Persian':   'perská',
  'Greek':     'řecká',
  'Germanic':  'germánská',
  'Slavic':    'slovanská',
  'Celtic':    'keltská',
  'Turkish':   'turecká',
  'Mongol':    'mongolská',
  'Chinese':   'čínská',
  'Japanese':  'japonská',
  'Indian':    'indická',
  'French':    'francouzská',
  'English':   'anglická',
  'Spanish':   'španělská',
  'Portuguese':'portugalská',
  'Russian':   'ruská',
  'Polish':    'polská',
  'Hungarian': 'uherská',
  'Bohemian':  'česká',
  'Austrian':  'rakouská',
  'German':    'německá',
  'Italian':   'italská',
  'Dutch':     'holandská',
  'Swedish':   'švédská',
  'Danish':    'dánská',
  'Norwegian': 'norská',
  'Scottish':  'skotská',
  'British':   'britská',
  'Ottoman':   'osmanská',
  'Safavid':   'safávidská',
  'Mughal':    'mughalská',
  'Abbasid':   'abbásovská',
  'Umayyad':   'umajjovská',
  'Fatimid':   'fátimovská',
  'Seljuk':    'seldžucká',
  'Mamluk':    'mamlúcká',
  'Carolingian':'karolínská',
  'Frankish':  'franská',
  'Visigothic':'vizigótská',
  'Ostrogothic':'ostrogótská',
  'Lombard':   'lombardská',
  'Vandal':    'vandalská',
  'Saxon':     'saská',
  'Viking':    'vikingská',
  'Pictish':   'piktská',
  'Brythonic': 'britská',
  'Bronze Age':'Doba bronzová',
  'Iron Age':  'Doba železná',
  'Stone Age': 'Doba kamenná',
  'Neolithic': 'Neolit',
  'Mesolithic':'Mezolit',
  'Paleolithic':'Paleolit',
  'Nordic':    'nordická',
  'Atlantic':  'atlantická',
  'Aegean':    'egejská',
  'Urnfield':  'Kultura popelnicových polí',
  'Lusatian':  'Lužická',
  'Hallstatt': 'Halštatská',
  'Corded Ware': 'Šňůrová keramika',
  'Bell Beaker': 'Zvoncovité poháry',
  'Linear Pottery': 'Lineární keramika',
  'Únětice':   'Únětická',
  'Unetice':   'Únětická',
  'Terramare': 'Terramare',
  'Tumulus':   'Mohylová',
  'Lausitz':   'Lužická',
  'La Tène':   'Laténská',
  'Minoan':    'Minojská',
  'Mycenaean': 'Mykénská',
  'Assyrian':  'asyrská',
  'Babylonian':'babylonská',
  'Hittite':   'chetitská',
  'Phoenician':'fénická',
  'Lydian':    'lýdská',
  'Scythian':  'skytská',
  'Sarmatian': 'sarmatská',
  'Hunnic':    'hunská',
  'Avar':      'avarská',
  'Khazar':    'chazarská',
  'Pecheneg':  'pečeněžská',
  'Cuman':     'kumánská',
  'Tatar':     'tatarská',
  'Tibetan':   'tibetská',
  'Khmer':     'khmerská',
};

// Speciální překlady celých názvů pro archaeological cultures a méně časté státy
const CZ_EXTRA: Record<string, string> = {
  'Lusatian culture':           'Lužická kultura',
  'Unetice culture':            'Únětická kultura',
  'Únětice culture':            'Únětická kultura',
  'Bell Beaker culture':        'Kultura zvoncovitých pohárů',
  'Corded Ware culture':        'Kultura šňůrové keramiky',
  'Linear Pottery culture':     'Kultura lineární keramiky',
  'Hallstatt culture':          'Halštatská kultura',
  'La Tène culture':            'Laténská kultura',
  'Nordic Bronze Age':          'Nordická doba bronzová',
  'Atlantic Bronze Age':        'Atlantická doba bronzová',
  'Urnfield culture':           'Kultura popelnicových polí',
  'Terramare culture':          'Kultura terramare',
  'Tumulus culture':            'Mohylová kultura',
  'Minoan civilization':        'Minojská civilizace',
  'Mycenaean civilization':     'Mykénská civilizace',
  'Aegean Bronze Age':          'Egejská doba bronzová',
  'Phoenicia':                  'Fénicie',
  'Assyrian Empire':            'Asyrská říše',
  'Neo-Assyrian Empire':        'Novosyrská říše',
  'Neo-Babylonian Empire':      'Novobabylonská říše',
  'Hittite Empire':             'Chetitská říše',
  'Kingdom of Lydia':           'Lýdské království',
  'Scythia':                    'Skytie',
  'Sarmatia':                   'Sarmacie',
  'Gaul':                       'Galie',
  'Britannia':                  'Británie',
  'Germania':                   'Germánie',
  'Hispania':                   'Hispánia',
  'Dacia':                      'Dácie',
  'Pannonia':                   'Panonie',
  'Illyria':                    'Ilýrie',
  'Thrace':                     'Thrákie',
  'Anatolia':                   'Anatolie',
  'Mesopotamia':                'Mezopotámie',
  'Levant':                     'Levanta',
  'Arabia':                     'Arábie',
  'Nubia':                      'Núbie',
  'Ethiopia (ancient)':         'Etiopie (starověká)',
  'Axum':                       'Aksumské království',
  'Nabataean Kingdom':          'Nabatejské království',
  'Palmyrene Empire':           'Palmýrská říše',
  'Kingdom of Armenia':         'Arménské království',
  'Iberian Kingdom':            'Iberijské království',
  'Colchis':                    'Kolchida',
  'Pontus':                     'Pontus',
  'Bithynia':                   'Bithýnie',
  'Pergamon':                   'Pergamon',
  'Rhodes':                     'Rhodos',
  'Epirus':                     'Épeiros',
  'Macedon':                    'Makedonie',
  'Thessaly':                   'Thessalie',
  'Attica':                     'Attika',
  'Peloponnese':                'Peloponés',
  'Crete':                      'Kréta',
  'Cyprus':                     'Kypr',
  'Corsica':                    'Korsika',
  'Sardinia':                   'Sardinie',
  'Sicily':                     'Sicílie',
  'Etruria':                    'Etrurie',
  'Umbria':                     'Umbrie',
  'Latium':                     'Latium',
  'Mauretania':                 'Mauretánie',
  'Numidia':                    'Numidie',
  'Africa Proconsularis':       'Prokonsulární Afrika',
  'Vandal Kingdom':             'Vandalské království',
  'Ostrogothic Kingdom':        'Ostrogótské království',
  'Visigothic Kingdom':         'Vizigótské království',
  'Lombard Kingdom':            'Lombardské království',
  'Burgundy':                   'Burgundsko',
  'Saxony':                     'Sasko',
  'Bavaria':                    'Bavorsko',
  'Swabia':                     'Švábsko',
  'Thuringia':                  'Durynsko',
  'Frisia':                     'Frísko',
  'Brittany':                   'Bretaň',
  'Aquitaine':                  'Akvitánie',
  'Provence':                   'Provence',
  'Lorraine':                   'Lotrinsko',
  'Alsace':                     'Alsasko',
  'Flanders':                   'Flandry',
  'Brabant':                    'Brabantsko',
  'Hainaut':                    'Henegavsko',
  'Normandy':                   'Normandie',
  'Champagne':                  'Champagne',
  'Catalonia':                  'Katalánsko',
  'Navarre':                    'Navarra',
  'Galicia':                    'Galície',
  'Asturias':                   'Asturie',
  'Castile-León':               'Kastilie-León',
  'Aragon':                     'Aragonsko',
  'Castile':                    'Kastilie',
  'León':                       'León',
  'Almoravid dynasty':          'Almorávidé',
  'Almohad dynasty':            'Almohádé',
  'Granada':                    'Granada',
  'Emirate of Córdoba':         'Córdobský emirát',
  'Kievan Rus\'':               'Kyjevská Rus',
  'Novgorod':                   'Novgorod',
  'Vladimir':                   'Vladimirské knížectví',
  'Galicia-Volhynia':           'Haličsko-volyňské knížectví',
  'Teutonic Order':             'Řád německých rytířů',
  'Livonian Order':             'Livonský řád',
  'Kingdom of Cyprus':          'Kyperské království',
  'Kingdom of Georgia':         'Gruzínské království',
  'Abbasid':                    'Abbásovci',
  'Ayyubid':                    'Ajjúbovci',
  'Zengid':                     'Zengidé',
  'Hafsid':                     'Hafidé',
  'Marinid':                    'Marinidé',
  'Almohad':                    'Almohádé',
  'Mali':                       'Malská říše',
  'Ghana':                      'Ghanská říše',
  'Kanem':                      'Kánemská říše',
  'Bornu':                      'Bornuská říše',
  'Nubian kingdoms':            'Núbijská království',
  'Meroe':                      'Meroé',
  'Axum':                       'Aksumská říše',
  'Zagwe':                      'Zagweská dynastie',
  'Delhi':                      'Dillíský sultanát',
  'Chola':                      'Čólská říše',
  'Pallava':                    'Pallavovská říše',
  'Gupta':                      'Guptovská říše',
  'Kushan':                     'Kušánská říše',
  'Satavahana':                 'Satavahanská říše',
  'Maurya':                     'Maurjovská říše',
  'Pagan':                      'Paganská říše',
  'Majapahit':                  'Madžapahistská říše',
  'Srivijaya':                  'Šrívídžajská říše',
  'Khmer':                      'Khmerská říše',
  'Dai Viet':                   'Đại Việt',
  'Champa':                     'Čampa',
  'Three Kingdoms of Korea':    'Tři korejská království',
  'Goryeo':                     'Korjo',
  'Joseon':                     'Čosŏn',
  'Goryeo':                     'Korjo',
  'Yamato':                     'Yamato',
  'Nara':                       'Narská říše',
  'Heian':                      'Heiganská éra',
  'Tang':                       'Říše Tchang',
  'Song':                       'Říše Sung',
  'Liao':                       'Dynastie Liao',
  'Western Xia':                'Říše Xi Xia',
  'Jin':                        'Dynastie Ťin',
  'Southern Song':              'Jižní Sung',
  'Northern Song':              'Severní Sung',
  'Five Dynasties':             'Pět dynastií',
  'Sui':                        'Říše Suej',
  'Han':                        'Říše Chan',
  'Qin':                        'Říše Čchin',
  'Zhou':                       'Říše Čou',
  'Shang':                      'Šangská dynastie',
  'Aztec Triple Alliance':      'Aztécká říše',
  'Tlaxcala':                   'Tlaxcala',
  'Maya':                       'Mayská civilizace',
  'Inca':                       'Incká říše',
  'Chimu':                      'Chimúská říše',
  'Tiwanaku':                   'Tiwanaku',
  'Wari':                       'Wari',
  'Mississippian':              'Mississippijská kultura',
  'Hohokam':                    'Hohokam',
  'Anasazi':                    'Anasazi',
  'Iroquois Confederacy':       'Irokézská konfederace',
  'Timur':                      'Timúrovci',
  'Timurid':                    'Timúrovci',
  'Shaybanid':                  'Šajbánovci',
  'Chagatai':                   'Čagatajský chanát',
  'Zunghar':                    'Džungarský chanát',
  'Crimean Khanate':            'Krymský chanát',
  'Kazan Khanate':              'Kazaňský chanát',
  'Astrakhan Khanate':          'Astrachaňský chanát',
  'Siberian Khanate':           'Sibiřský chanát',
  'Nogai Horde':                'Nogajská horda',
  'Great Horde':                'Velká horda',
  'Blue Horde':                 'Modrá horda',
  'White Horde':                'Bílá horda',
  'Ilkhanate':                  'Ílchánát',
  'Hulagu':                     'Hulagúovci',
  'Transoxiana':                'Transoxiána',
  'Khorasan':                   'Chorásán',
  'Khwarezm':                   'Chorezmská říše',
  'Ghaznavid':                  'Ghaznovcovci',
  'Ghurid':                     'Ghúridé',
  'Ziyarid':                    'Zijáridé',
  'Buyid':                      'Bújovci',
  'Hamdanid':                   'Hamdánovci',
  'Fatimid':                    'Fátimovci',
  'Idrisid':                    'Idrísovci',
  'Aghlabid':                   'Aghlábovci',
  'Tulunid':                    'Túlúnovci',
  'Ikhshidid':                  'Ikhšídovci',
  'Autonomous':                 '(autonomní)',
  'Protectorate':               '(protektorát)',
  'Colony':                     '(kolonie)',
  'Mandate':                    '(mandát)',
  'Territory':                  '(území)',

  // ── Typické složeniny z historical-basemaps ───────────────────────────────
  'Greek city-states':          'Řecké městské státy',
  'Greek colonies':             'Řecké kolonie',
  'Saharan pastoral nomads':    'Saharští pastevečtí nomádi',
  'East African pastoral nomads': 'Východoafričtí pastevečtí nomádi',
  'West African pastoral nomads': 'Západoafričtí pastevečtí nomádi',
  'Arabian pastoral nomads':    'Arabští pastevečtí nomádi',
  'Central Asian nomads':       'Středoasijští nomádi',
  'Eurasian nomads':            'Euroasijští nomádi',
  'Siberian nomads':            'Sibiřští nomádi',
  'Steppe nomads':              'Stepní nomádi',
  'Germanic tribes':            'Germánské kmeny',
  'Celtic tribes':              'Keltské kmeny',
  'Slavic tribes':              'Slovanské kmeny',
  'Baltic tribes':              'Baltské kmeny',
  'Scythian nomads':            'Skytští nomádi',
  'Sarmatian nomads':           'Sarmatští nomádi',
  'Nomadic peoples':            'Kočovné národy',
  'Nomadic tribes':             'Kočovné kmeny',
  'Hunter-gatherers':           'Lovci a sběrači',
  'Hunter gatherers':           'Lovci a sběrači',
  'Foragers':                   'Sběrači',
  'Pastoral nomads':            'Pastevečtí nomádi',
  'Semi-nomadic peoples':       'Polonkočovné národy',
  'Sub-Saharan Africa':         'Subsaharská Afrika',
  'North Africa':               'Severní Afrika',
  'East Africa':                'Východní Afrika',
  'West Africa':                'Západní Afrika',
  'Central Africa':             'Střední Afrika',
  'South Africa':               'Jižní Afrika',
  'Southeast Asia':             'Jihovýchodní Asie',
  'South Asia':                 'Jižní Asie',
  'East Asia':                  'Východní Asie',
  'Central Asia':               'Střední Asie',
  'Middle East':                'Střední východ',
  'Near East':                  'Blízký východ',
  'Far East':                   'Dálný východ',
  'North America':              'Severní Amerika',
  'South America':              'Jižní Amerika',
  'Central America':            'Střední Amerika',
  'Mesoamerica':                'Mezoamerika',
  'Hellenistic kingdoms':       'Helénistická království',
  'Successor states':           'Nástupnické státy',
  'Late Roman Empire':          'Pozdní Římská říše',
  'Western Roman Empire':       'Západořímská říše',
  'Eastern Roman Empire':       'Východořímská říše',
  'Holy Roman Empire':          'Svatá říše římská',
  'Byzantine Empire':           'Byzantská říše',
  'Latin Empire':               'Latinské císařství',
  'Bulgarian Empire':           'Bulharská říše',
  'Serbian Empire':             'Srbská říše',
  'Kingdom of France':          'Francouzské království',
  'Kingdom of England':         'Anglické království',
  'Kingdom of Scotland':        'Skotské království',
  'Kingdom of Portugal':        'Portugalské království',
  'Kingdom of Castile':         'Kastilské království',
  'Kingdom of Aragon':          'Aragonské království',
  'Kingdom of Navarre':         'Navarrské království',
  'Kingdom of León':            'Leonské království',
  'Kingdom of Denmark':         'Dánské království',
  'Kingdom of Sweden':          'Švédské království',
  'Kingdom of Norway':          'Norské království',
  'Kingdom of Hungary':         'Uherské království',
  'Kingdom of Poland':          'Polské království',
  'Kingdom of Bohemia':         'České království',
  'Kingdom of Croatia':         'Chorvatské království',
  'Kingdom of Serbia':          'Srbské království',
  'Kingdom of Bulgaria':        'Bulharské carství',
  'Duchy of Burgundy':          'Burgundské vévodství',
  'Duchy of Normandy':          'Normandské vévodství',
  'Duchy of Bavaria':           'Bavorské vévodství',
  'Duchy of Saxony':            'Saské vévodství',
  'Duchy of Swabia':            'Švábské vévodství',
  'Duchy of Lorraine':          'Lotrinské vévodství',
  'Duchy of Austria':           'Rakouské vévodství',
  'Duchy of Brabant':           'Brabantské vévodství',
  'County of Flanders':         'Flandreské hrabství',
  'Duchy of Milan':             'Milánské vévodství',
  'Republic of Venice':         'Benátská republika',
  'Republic of Genoa':          'Janovská republika',
  'Republic of Florence':       'Florentská republika',
  'Papal States':               'Papežský stát',
  'Kingdom of Naples':          'Neapolské království',
  'Kingdom of Sicily':          'Sicilské království',
  'Two Sicilies':               'Obojí Sicílie',
  'Kingdom of the Two Sicilies': 'Království Obojí Sicílie',
  'Golden Horde':               'Zlatá horda',
  'Kievan Rus':                 'Kyjevská Rus',
  'Grand Duchy of Moscow':      'Moskevské velkoknížectví',
  'Principality of Moscow':     'Moskevské knížectví',
  'Grand Duchy of Lithuania':   'Litevské velkoknížectví',
  'Grand Duchy of Kiev':        'Kyjevské velkoknížectví',
  'Principality of Novgorod':   'Novgorodské knížectví',
  'Republic of Novgorod':       'Novgorodská republika',
  'Principality of Vladimir':   'Vladimirské knížectví',
  'Principality of Galicia':    'Haličské knížectví',
  'Principality of Volhynia':   'Volyňské knížectví',
  'Order of the Teutonic Knights': 'Řád německých rytířů',
  'Teutonic Knights':           'Němečtí rytíři',
  'Kingdom of Jerusalem':       'Jeruzalémské království',
  'County of Tripoli':          'Tripolské hrabství',
  'Principality of Antioch':    'Antiochijské knížectví',
  'County of Edessa':           'Edesské hrabství',
  'Emirate of Sicily':          'Sicilský emirát',
  'Fatimid Caliphate':          'Fátimovský chalífát',
  'Abbasid Caliphate':          'Abbásovský chalífát',
  'Umayyad Caliphate':          'Umajjovský chalífát',
  'Rashidun Caliphate':         'Rašídúnský chalífát',
  'Ottoman Empire':             'Osmanská říše',
  'Safavid Empire':             'Safávidská říše',
  'Mughal Empire':              'Mughalská říše',
  'Delhi Sultanate':            'Dillíský sultanát',
  'Seljuk Empire':              'Seldžucká říše',
  'Khwarazmian Empire':         'Chorezmská říše',
  'Timurid Empire':             'Timúrovská říše',
  'Mongol Empire':              'Mongolská říše',
  'Yuan dynasty':               'Dynastie Juan',
  'Ming dynasty':               'Dynastie Ming',
  'Qing dynasty':               'Dynastie Čching',
  'Tang dynasty':               'Dynastie Tchang',
  'Song dynasty':               'Dynastie Sung',
  'Han dynasty':                'Dynastie Chan',
  'Qin dynasty':                'Dynastie Čchin',
  'Zhou dynasty':               'Dynastie Čou',
  'Sui dynasty':                'Dynastie Suej',
  'Maurya Empire':              'Maurjovská říše',
  'Gupta Empire':               'Guptovská říše',
  'Kushan Empire':              'Kušánská říše',
  'Achaemenid Empire':          'Achaimenovská říše',
  'Persian Empire':             'Perská říše',
  'Macedonian Empire':          'Makedonská říše',
  'Alexandrian Empire':         'Alexandrova říše',
  'Ptolemaic Kingdom':          'Ptolemaiovské království',
  'Seleucid Empire':            'Seleukovská říše',
  'Kingdom of Macedon':         'Makedonské království',
  'Kingdom of Epirus':          'Épeirské království',
  'Athenian Empire':            'Athénská říše',
  'Spartan hegemony':           'Spartská hegemonie',
  'Theban hegemony':            'Thébská hegemonie',
  'Delian League':              'Délský spolek',
  'Peloponnesian League':       'Peloponéský spolek',
  'Achaean League':             'Achájský spolek',
  'Aetolian League':            'Aitólský spolek',
  'Roman Republic':             'Římská republika',
  'Roman Empire':               'Římská říše',
  'Carthaginian Empire':        'Kartaginská říše',
  'Phoenician city-states':     'Fénická městská republika',
  'Italian city-states':        'Italská městská republika',
  'Mesopotamian city-states':   'Mezopotamská města-státy',
  'Sumerian city-states':       'Sumerská města-státy',
  'Akkadian Empire':            'Akkadská říše',
  'Babylonian Empire':          'Babylonská říše',
  'Assyrian Empire':            'Asyrská říše',
  'Hittite Empire':             'Chetitská říše',
  'Egyptian Empire':            'Egyptská říše',
  'New Kingdom of Egypt':       'Nová říše Egypta',
  'Middle Kingdom of Egypt':    'Střední říše Egypta',
  'Old Kingdom of Egypt':       'Stará říše Egypta',
  'Mali Empire':                'Malská říše',
  'Songhai Empire':             'Songajská říše',
  'Ghana Empire':               'Ghanská říše',
  'Kanem-Bornu':                'Kánem-Bornu',
  'Inca Empire':                'Incká říše',
  'Aztec Empire':               'Aztécká říše',
  'Maya civilization':          'Mayská civilizace',
  'Olmec civilization':         'Olmécká civilizace',
  'Teotihuacan':                'Teotihuacán',
  'Toltec civilization':        'Toltécká civilizace',
  'Mississippi culture':        'Mississippijská kultura',
  'Hopewell culture':           'Hopewellská kultura',
  'Woodland culture':           'Lesní kultura',
  'Adena culture':              'Adenská kultura',
  'Clovis culture':             'Klovisská kultura',
  'Dorset culture':             'Dorsetská kultura',
  'Thule culture':              'Thuleská kultura',
  'Inuit peoples':              'Inuité',
  'Norse settlements':          'Normanská sídla',
  'Viking settlements':         'Vikingská sídla',
  'Varangian Rus':              'Varjažská Rus',
  'Danelaw':                    'Dánský zákon',
  'Anglo-Saxon kingdoms':       'Anglosaská království',
  'Heptarchy':                  'Heptarchie',
  'Pictish kingdoms':           'Piktská království',
  'Strathclyde':                'Strathclyde',
  'Dalriada':                   'Dál Fiatach',
  'Caliphate of Córdoba':       'Córdobský chalífát',
  'Taifa kingdoms':             'Taifská království',
  'Reconquista':                'Reconquista',
  'Crown of Castile':           'Kastilská koruna',
  'Crown of Aragon':            'Aragonská koruna',
  'Iberian Union':              'Iberská unie',
  'Spanish Empire':             'Španělská říše',
  'Portuguese Empire':          'Portugalská říše',
  'British Empire':             'Britská říše',
  'French Empire':              'Francouzská říše',
  'Russian Empire':             'Ruská říše',
  'Austrian Empire':            'Rakouská říše',
  'Austro-Hungarian Empire':    'Rakousko-Uhersko',
  'German Empire':              'Německá říše',
  'Kingdom of Prussia':         'Pruské království',
  'Electorate of Brandenburg':  'Braniborské kurfiřtství',
  'Electorate of Saxony':       'Saské kurfiřtství',
  'Electorate of Bavaria':      'Bavorské kurfiřtství',
  'Swiss Confederation':        'Švýcarská konfederace',
  'Dutch Republic':             'Nizozemská republika',
  'Belgian Netherlands':        'Belgické Nizozemí',
  'Kingdom of the Netherlands': 'Nizozemské království',
  'Kingdom of Belgium':         'Belgické království',
  'United Kingdom':             'Spojené království',
  'United States':              'Spojené státy americké',
  'Confederate States':         'Konfederované státy',
  'Republic of Texas':          'Texaská republika',
  'New Spain':                  'Nové Španělsko',
  'New France':                 'Nová Francie',
  'New England':                'Nová Anglie',
  'British India':              'Britská Indie',
  'French Indochina':           'Francouzská Indočína',
  'Dutch East Indies':          'Nizozemská východní Indie',
  'Mayan city-states':          'Mayská města-státy',
  'Andean civilizations':       'Andské civilizace',
  'Amazon basin peoples':       'Národy povodí Amazonky',
  'Peoples of the Plains':      'Národy prérijí',
  'Pacific Northwest peoples':  'Národy severozápadního Pacifiku',
  'Aboriginal Australia':       'Původní obyvatelé Austrálie',
  'Polynesian peoples':         'Polynéské národy',
  'Melanesian peoples':         'Melanéské národy',
  'Micronesian peoples':        'Mikronéské národy',
  'Bantu peoples':              'Bantujské národy',
  'Nilotic peoples':            'Nilotské národy',
  'Cushitic peoples':           'Kúšitské národy',
  'Berber peoples':             'Berberské národy',
  'Tuareg':                     'Tuaregové',
  'Bedouin':                    'Beduíni',
  'Mongol tribes':              'Mongolské kmeny',
  'Turkic peoples':             'Turkické národy',
  'Turkic tribes':              'Turkické kmeny',
  'Iranian peoples':            'Íránské národy',
  'Semitic peoples':            'Semitské národy',
  'Indo-European peoples':      'Indoevropské národy',
  'Uralic peoples':             'Uralské národy',
  'Finno-Ugric peoples':        'Ugrofinské národy',
  'Dravidian peoples':          'Drávidské národy',
  'Austronesian peoples':       'Austronéské národy',
  'Sino-Tibetan peoples':       'Sino-tibetské národy',
};


// ─── Dynamický AI překlad s cache ────────────────────────────────────────────
const LS_KEY = 'quizmap-translations-v1';
const aiTranslations: Record<string, string> = (() => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
})();

async function batchTranslate(names: string[]): Promise<Record<string, string>> {
  if (!names.length) return {};
  try {
    const list = names.map((n, i) => `${i + 1}. ${n}`).join('\n');
    const prompt = `Přelož tyto historické názvy států, říší, kultur a území do češtiny. Vrať POUZE JSON objekt kde klíč je původní anglický název a hodnota je český překlad. Žádný jiný text.\n\n${list}`;
    const result = await chatWithAIProxy(
      [{ role: 'user', content: prompt }],
      'gemini-3-flash',
      { temperature: 0.1, max_tokens: 2000 },
    );
    const match = result.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch { /* tiché selhání */ }
  return {};
}

/** Přeloží název — statická tabulka → AI cache → pattern fallback */
export function toCzechName(name: string): string {
  if (!name) return name;
  if (CZ_NAMES[name]) return CZ_NAMES[name];
  if (CZ_EXTRA[name]) return CZ_EXTRA[name];
  if (aiTranslations[name]) return aiTranslations[name];
  return applyPatterns(name);
}

function applyPatterns(name: string): string {
  return name
    // Složené výrazy – MUSÍ být před jednotlivými slovy
    .replace(/\bcity-states?\b/gi,         'městské státy')
    .replace(/\bcity states?\b/gi,         'městské státy')
    .replace(/\bpastoral nomads?\b/gi,     'pastevečtí nomádi')
    .replace(/\bsemi-nomadic\b/gi,         'polonkočovný')
    .replace(/\bhunter-gatherers?\b/gi,    'lovci a sběrači')
    .replace(/\bhunter gatherers?\b/gi,    'lovci a sběrači')
    .replace(/\bBronze Age\b/gi,           'doba bronzová')
    .replace(/\bIron Age\b/gi,             'doba železná')
    .replace(/\bStone Age\b/gi,            'doba kamenná')
    .replace(/\bMiddle Ages?\b/gi,         'středověk')
    .replace(/\bHoly Roman Empire\b/gi,    'Svatá říše římská')
    .replace(/\bRoman Empire\b/gi,         'Římská říše')
    .replace(/\bRoman Republic\b/gi,       'Římská republika')
    .replace(/\bByzantine Empire\b/gi,     'Byzantská říše')
    .replace(/\bOttoman Empire\b/gi,       'Osmanská říše')
    // Samostatná slova – adjektiva
    .replace(/\bSaharan\b/gi,             'Saharský')
    .replace(/\bSub-Saharan\b/gi,         'Subsaharský')
    .replace(/\bNorthern\b/gi,            'Severní')
    .replace(/\bSouthern\b/gi,            'Jižní')
    .replace(/\bEastern\b/gi,             'Východní')
    .replace(/\bWestern\b/gi,             'Západní')
    .replace(/\bCentral\b/gi,             'Střední')
    .replace(/\bAncient\b/gi,             'Starověká')
    .replace(/\bGreat\b/gi,               'Velká')
    .replace(/\bHoly\b/gi,                'Svatá')
    .replace(/\bLate\b/gi,                'Pozdní')
    .replace(/\bEarly\b/gi,               'Raná')
    .replace(/\bUpper\b/gi,               'Horní')
    .replace(/\bLower\b/gi,               'Dolní')
    .replace(/\bInner\b/gi,               'Vnitřní')
    .replace(/\bOuter\b/gi,               'Vnější')
    .replace(/\bNeo-\b/gi,               'Nový')
    // Etnické/jazykové adjektivy
    .replace(/\bRoman\b/gi,               'Římský')
    .replace(/\bByzantine\b/gi,           'Byzantský')
    .replace(/\bGreek\b/gi,               'Řecký')
    .replace(/\bGermanic\b/gi,            'Germánský')
    .replace(/\bSlavic\b/gi,              'Slovanský')
    .replace(/\bCeltic\b/gi,              'Keltský')
    .replace(/\bTurkic\b/gi,              'Turkický')
    .replace(/\bMongol\b/gi,              'Mongolský')
    .replace(/\bArab\b/gi,                'Arabský')
    .replace(/\bPersian\b/gi,             'Perský')
    .replace(/\bTurkish\b/gi,             'Turecký')
    .replace(/\bIsland\b/gi,              'Ostrůvní')
    .replace(/\bScythian\b/gi,            'Skytský')
    .replace(/\bSarmatian\b/gi,           'Sarmatský')
    .replace(/\bVandal\b/gi,              'Vandalský')
    .replace(/\bFrankish\b/gi,            'Franský')
    .replace(/\bViking\b/gi,              'Vikingský')
    .replace(/\bNorse\b/gi,               'Normanský')
    .replace(/\bAnglo-Saxon\b/gi,         'Anglosaský')
    .replace(/\bBerber\b/gi,              'Berberský')
    .replace(/\bNilotic\b/gi,             'Nilotský')
    .replace(/\bBantu\b/gi,               'Bantujský')
    .replace(/\bAustronesian\b/gi,        'Austronéský')
    .replace(/\bPolynesian\b/gi,          'Polynéský')
    .replace(/\bDravidian\b/gi,           'Drávidský')
    .replace(/\bFinno-Ugric\b/gi,         'Ugrofinský')
    .replace(/\bIranian\b/gi,             'Íránský')
    .replace(/\bSemitic\b/gi,             'Semitský')
    .replace(/\bMayan\b/gi,               'Mayský')
    .replace(/\bAztec\b/gi,               'Aztécký')
    .replace(/\bInca\b/gi,                'Incký')
    .replace(/\bMesopotamian\b/gi,        'Mezopotamský')
    .replace(/\bEgyptian\b/gi,            'Egyptský')
    .replace(/\bIndian\b/gi,              'Indický')
    .replace(/\bChinese\b/gi,             'Čínský')
    .replace(/\bJapanese\b/gi,            'Japonský')
    .replace(/\bTibetan\b/gi,             'Tibetský')
    .replace(/\bKhmer\b/gi,              'Khmerský')
    // Podstatná jména
    .replace(/\bcivilization\b/gi,        'civilizace')
    .replace(/\bcivilisation\b/gi,        'civilizace')
    .replace(/\bculture\b/gi,             'kultura')
    .replace(/\bempire\b/gi,              'říše')
    .replace(/\bkingdom\b/gi,             'království')
    .replace(/\brepublic\b/gi,            'republika')
    .replace(/\bduchy\b/gi,               'vévodství')
    .replace(/\bprincipality\b/gi,        'knížectví')
    .replace(/\bcaliphate\b/gi,           'chalífát')
    .replace(/\bsultanate\b/gi,           'sultanát')
    .replace(/\bkhanate\b/gi,             'chanát')
    .replace(/\bhorde\b/gi,               'horda')
    .replace(/\bconfederation\b/gi,       'konfederace')
    .replace(/\bconfederacy\b/gi,         'konfederace')
    .replace(/\bshogunate\b/gi,           'šógunát')
    .replace(/\bprotectorate\b/gi,        'protektorát')
    .replace(/\bterritory\b/gi,           'území')
    .replace(/\bcolonies\b/gi,            'kolonie')
    .replace(/\bcolony\b/gi,              'kolonie')
    .replace(/\bmandate\b/gi,             'mandát')
    .replace(/\bstates?\b/gi,             'stát')
    .replace(/\bdynasty\b/gi,             'dynastie')
    .replace(/\border\b/gi,               'řád')
    .replace(/\bnomads?\b/gi,             'nomádi')
    .replace(/\bpeoples?\b/gi,            'národy')
    .replace(/\btribes?\b/gi,             'kmeny')
    .replace(/\balliance\b/gi,            'aliance')
    .replace(/\bleague\b/gi,              'spolek')
    .replace(/\bunion\b/gi,               'unie')
    .replace(/\bfederation\b/gi,          'federace')
    .replace(/\bsettlements?\b/gi,        'osady')
    .replace(/\bkingdoms?\b/gi,           'království')
    .replace(/\bhegemony\b/gi,            'hegemonie')
    .replace(/\bcolonies\b/gi,            'kolonie')
    // Předložky a členy
    .replace(/\bof the\b/gi,              '')
    .replace(/\bof\b/gi,                  '')
    .replace(/\bthe\b/gi,                 '')
    .replace(/\band\b/gi,                 'a')
    .replace(/\s{2,}/g,                   ' ')
    .trim();
}

// ─── Barvy pro historické státy – stabilní hash dle NAME ─────────────────────
const HIST_PALETTE = [
  '#c9b99a','#b8c9a0','#a0b8c9','#c9a0b8','#c9c4a0',
  '#a0c9b4','#c9a8a0','#b0a0c9','#a0c4c9','#c9bba0',
  '#9ec9a0','#c9a09e','#a09ec9','#c9c09e','#9ec4c9',
];
function histColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xfffff;
  return HIST_PALETTE[Math.abs(h) % HIST_PALETTE.length];
}

// ─── České názvy řek ─────────────────────────────────────────────────────────
const CZ_RIVERS: Record<string, string> = {
  'Amazon': 'Amazonka', 'Nile': 'Nil', 'Yangtze': 'Jang-c\'-ťiang', 'Yellow River': 'Žlutá řeka (Chuang-che)',
  'Ob': 'Ob', 'Yenisei': 'Jenisej', 'Lena': 'Lena', 'Amur': 'Amur', 'Mekong': 'Mekong',
  'Congo': 'Kongo', 'Niger': 'Niger', 'Volga': 'Volha', 'Danube': 'Dunaj', 'Rhine': 'Rýn',
  'Elbe': 'Labe', 'Oder': 'Odra', 'Vistula': 'Visla', 'Loire': 'Loira', 'Rhône': 'Rhôna',
  'Seine': 'Seina', 'Thames': 'Temže', 'Tiber': 'Tibera', 'Po': 'Pád', 'Tagus': 'Tejo',
  'Ebro': 'Ebro', 'Guadalquivir': 'Guadalquivir', 'Dnieper': 'Dněpr', 'Don': 'Don',
  'Ural': 'Ural', 'Kama': 'Kama', 'Dniester': 'Dněstr', 'Prut': 'Prut',
  'Sava': 'Sáva', 'Drava': 'Dráva', 'Tisza': 'Tisa', 'Morava': 'Morava',
  'Vltava': 'Vltava', 'Elbe (Czech: Labe)': 'Labe', 'March': 'Morava',
  'Mississippi': 'Mississippi', 'Missouri': 'Missouri', 'Colorado': 'Colorado',
  'Columbia': 'Columbia', 'Rio Grande': 'Rio Grande', 'Mackenzie': 'Mackenzie',
  'Orinoco': 'Orinoko', 'Paraná': 'Paraná', 'Paraguay': 'Paraguay',
  'Ganges': 'Ganga', 'Indus': 'Indus', 'Brahmaputra': 'Brahmaputra',
  'Irrawaddy': 'Iravadi', 'Tigris': 'Tigris', 'Euphrates': 'Eufrat',
  'Murray': 'Murray', 'Darling': 'Darling', 'Zambezi': 'Zambezi',
  'Orange': 'Oranžová řeka', 'Limpopo': 'Limpopo', 'Senegal': 'Senegal',
  'Okavango': 'Okavango', 'Blue Nile': 'Modrý Nil', 'White Nile': 'Bílý Nil',
  'Ob-Irtysh': 'Ob-Irtyš', 'Irtysh': 'Irtyš',
};

function toCzechRiver(name: string): string {
  return CZ_RIVERS[name] ?? name;
}

// ─── České názvy fyzickogeografických oblastí ────────────────────────────────
const CZ_PHYSICAL: Record<string, string> = {
  // Pohoří — Evropa
  'Alps': 'Alpy', 'Pyrenees': 'Pyreneje', 'Carpathians': 'Karpaty',
  'Apennines': 'Apeniny', 'Balkans': 'Balkánské pohoří', 'Caucasus': 'Kavkaz',
  'Urals': 'Ural', 'Scandinavian Mountains': 'Skandinávské pohoří',
  'Dinaric Alps': 'Dinárské Alpy', 'Transylvanian Alps': 'Transylvánské Alpy',
  'Bohemian Massif': 'Česká vysočina', 'Massif Central': 'Masif Central',
  'Iberian Peninsula Mountains': 'Iberská pohoří', 'Sierra Nevada': 'Sierra Nevada',
  'Cantabrian Mountains': 'Kantabrijské pohoří', 'Rila': 'Rila',
  'Rhodope Mountains': 'Rodopy', 'Pindus': 'Pindos',
  // Pohoří — Asie
  'Himalayas': 'Himaláje', 'Hindu Kush': 'Hindúkuš', 'Karakoram': 'Karakoram',
  'Pamir': 'Pamír', 'Tian Shan': 'Ťan-šan', 'Altai': 'Altaj',
  'Zagros': 'Zagros', 'Elburz': 'Elbrus', 'Kunlun': 'Kunlun',
  'Qilian Shan': 'Čchilian', 'Yablonoi': 'Jablonovyj', 'Stanovoy': 'Stanovoj',
  'Verkhoyansk Range': 'Verchojanské pohoří', 'Chersky Range': 'Čerské pohoří',
  'Sichote-Alin': 'Sikhote-Alin', 'Korean Peninsula Mountains': 'Korejská pohoří',
  'Japanese Alps': 'Japonské Alpy',
  // Pohoří — Afrika
  'Atlas Mountains': 'Atlasské pohoří', 'Ethiopian Highlands': 'Etiopská vysočina',
  'Drakensberg': 'Drakensberky', 'Ruwenzori': 'Rwenzori',
  // Pohoří — Amerika
  'Rocky Mountains': 'Skalnaté hory', 'Appalachians': 'Apalačské pohoří',
  'Sierra Madre': 'Sierra Madre', 'Andes': 'Andy',
  'Brooks Range': 'Pohranní pohoří', 'Coast Ranges': 'Pobřežní pohoří',
  'Cascade Range': 'Kaskádové hory', 'Sierra Nevada (USA)': 'Sierra Nevada',
  // Nížiny a planiny — Evropa
  'North European Plain': 'Severoevropská nížina', 'Po Plain': 'Pádská nížina',
  'Pannonian Plain': 'Panonská nížina', 'Wallachian Plain': 'Valašská nížina',
  'Danube Lowlands': 'Dunajská nížina', 'East European Plain': 'Východoevropská nížina',
  'West Siberian Plain': 'Západosibiřská nížina', 'Volga Upland': 'Volžská vrchovina',
  // Nížiny — Amerika
  'Amazon Basin': 'Amazonská nížina', 'Llanos': 'Llanos', 'Pampas': 'Pampy',
  'Patagonia': 'Patagonie', 'Orinoco Lowlands': 'Orinocká nížina',
  'Mississippi Valley': 'Mississippská nížina', 'Gulf Coastal Plain': 'Pobřežní nížina Mexického zálivu',
  'Great Plains': 'Velké planiny', 'Canadian Shield': 'Kanadský štít',
  // Planiny a plateaux
  'Tibetan Plateau': 'Tibetská náhorní plošina', 'Mongolian Plateau': 'Mongolská náhorní plošina',
  'Deccan Plateau': 'Dekanská plošina', 'Arabian Plateau': 'Arabská plošina',
  'Iranian Plateau': 'Íránská plošina', 'Anatolian Plateau': 'Anatolská plošina',
  'Ethiopian Plateau': 'Etiopská plošina', 'East African Plateau': 'Východoafrická plošina',
  'South African Plateau': 'Jihoafrická plošina', 'Brazilian Highlands': 'Brazilská vysočina',
  'Guiana Highlands': 'Guyanská vysočina', 'Colorado Plateau': 'Coloradská plošina',
  'Columbia Plateau': 'Columbijecká plošina',
  // Pouště
  'Sahara': 'Sahara', 'Arabian Desert': 'Arabská poušť', 'Gobi': 'Gobi',
  'Karakum': 'Karakum', 'Kyzylkum': 'Kyzylkum', 'Taklamakan': 'Taklimakan',
  'Thar Desert': 'Thárská poušť', 'Iranian Desert': 'Íránská poušť',
  'Namib': 'Namib', 'Kalahari': 'Kalahari', 'Great Sandy Desert': 'Velká písečná poušť',
  'Gibson Desert': 'Gibsonova poušť', 'Great Victoria Desert': 'Velká Viktoriina poušť',
  'Sonoran Desert': 'Sonorská poušť', 'Mojave Desert': 'Mohavská poušť',
  'Chihuahuan Desert': 'Čivavská poušť', 'Great Basin': 'Velká kotlina',
  'Patagonian Desert': 'Patagonská poušť', 'Atacama': 'Atacama',
  // Stepi a savany
  'Eurasian Steppe': 'Euroasijská step', 'Kazakh Steppe': 'Kazašská step',
  'Sahel': 'Sahel', 'Sudan Savanna': 'Súdánská savana',
  // Oceány, moře (přeloženy i zde)
  'Pacific Ocean': 'Tichý oceán', 'Atlantic Ocean': 'Atlantský oceán',
  'Indian Ocean': 'Indický oceán', 'Arctic Ocean': 'Severní ledový oceán',
  'Southern Ocean': 'Jižní oceán',
  'Mediterranean Sea': 'Středozemní moře', 'Black Sea': 'Černé moře',
  'Caspian Sea': 'Kaspické moře', 'Red Sea': 'Rudé moře',
  'Arabian Sea': 'Arabské moře', 'Bay of Bengal': 'Bengálský záliv',
  'South China Sea': 'Jihočínské moře', 'East China Sea': 'Východočínské moře',
  'Yellow Sea': 'Žluté moře', 'Sea of Japan': 'Japonské moře',
  'Sea of Okhotsk': 'Ochotské moře', 'Bering Sea': 'Beringovo moře',
  'Gulf of Mexico': 'Mexický záliv', 'Caribbean Sea': 'Karibské moře',
  'North Sea': 'Severní moře', 'Baltic Sea': 'Baltské moře',
  'Norwegian Sea': 'Norské moře', 'Barents Sea': 'Barentsovo moře',
  'Kara Sea': 'Karské moře', 'Laptev Sea': 'Laptěvovo moře',
  'East Siberian Sea': 'Východosibiřské moře', 'Chukchi Sea': 'Čukotské moře',
  'Beaufort Sea': 'Beaufortovo moře', 'Hudson Bay': 'Hudsonův záliv',
  'Gulf of Guinea': 'Guinejský záliv', 'Mozambique Channel': 'Mosambický průliv',
  'Persian Gulf': 'Perský záliv', 'Gulf of Aden': 'Adenský záliv',
  'Strait of Malacca': 'Malacký průliv', 'English Channel': 'Lamanšský průliv',
  'Strait of Gibraltar': 'Gibraltarský průliv', 'Adriatic Sea': 'Jaderné moře',
  'Aegean Sea': 'Egejské moře', 'Ionian Sea': 'Iónské moře',
  'Tyrrhenian Sea': 'Tyrhénské moře', 'Ligurian Sea': 'Ligurské moře',
  'Coral Sea': 'Korálové moře', 'Tasman Sea': 'Tasmanovo moře',
  'Gulf of Bothnia': 'Botnický záliv', 'Gulf of Finland': 'Finský záliv',
  'Gulf of Riga': 'Rižský záliv', 'Skagerrak': 'Skagerrak', 'Kattegat': 'Kattegat',
  'Irish Sea': 'Irské moře', 'Bay of Biscay': 'Biskajský záliv',
  'Strait of Dover': 'Doverský průliv', 'Strait of Sicily': 'Sicilský průliv',
  'Drake Passage': 'Drakeův průliv', 'Scotia Sea': 'Skotské moře',
  'Weddell Sea': 'Weddellovo moře', 'Ross Sea': 'Rossovo moře',
};

function toCzechPhysical(name: string): string {
  return CZ_PHYSICAL[name] ?? toCzechName(name);
}

// ─── Barvy fyzickogeografických tříd ─────────────────────────────────────────
const PHYSICAL_COLORS: Record<string, { fill: string; fillOpacity: number; stroke: string }> = {
  'Range/Mtn':   { fill: '#b8956a', fillOpacity: 0.45, stroke: '#8b6340' },
  'Geologic':    { fill: '#c4a87a', fillOpacity: 0.35, stroke: '#9a7a50' },
  'Plain':       { fill: '#a8c880', fillOpacity: 0.35, stroke: '#78a050' },
  'Basin':       { fill: '#c8d4a0', fillOpacity: 0.30, stroke: '#98a470' },
  'Delta':       { fill: '#78c8a8', fillOpacity: 0.40, stroke: '#489878' },
  'Desert':      { fill: '#e8c87a', fillOpacity: 0.40, stroke: '#b8985a' },
  'Lowland':     { fill: '#b0d498', fillOpacity: 0.35, stroke: '#80a468' },
  'Polar':       { fill: '#c8e4f4', fillOpacity: 0.40, stroke: '#98b4c4' },
  'Tundra':      { fill: '#b0c8d4', fillOpacity: 0.35, stroke: '#80a0b4' },
  'Tableland':   { fill: '#c8a878', fillOpacity: 0.35, stroke: '#987848' },
  'Valley':      { fill: '#a0c890', fillOpacity: 0.35, stroke: '#70a060' },
  'Peninsula':   { fill: '#d4b898', fillOpacity: 0.30, stroke: '#a48868' },
  'Island group':{ fill: '#a4d4d4', fillOpacity: 0.35, stroke: '#64a4a4' },
  'default':     { fill: '#c8b898', fillOpacity: 0.25, stroke: '#988868' },
};

const MARINE_COLORS: Record<string, { fill: string; fillOpacity: number; stroke: string }> = {
  'Ocean':   { fill: '#4a90c8', fillOpacity: 0.30, stroke: '#2a6898' },
  'Sea':     { fill: '#5aa8d8', fillOpacity: 0.28, stroke: '#3a78a8' },
  'Bay':     { fill: '#6ab8e0', fillOpacity: 0.28, stroke: '#4a88b8' },
  'Gulf':    { fill: '#5ab0d8', fillOpacity: 0.28, stroke: '#3a80a8' },
  'Strait':  { fill: '#7ac8e4', fillOpacity: 0.28, stroke: '#5a98b4' },
  'Channel': { fill: '#7ac0e0', fillOpacity: 0.28, stroke: '#5a90b0' },
  'Inlet':   { fill: '#88cce4', fillOpacity: 0.28, stroke: '#6898b4' },
  'default': { fill: '#5ab0d8', fillOpacity: 0.25, stroke: '#3a80a8' },
};

// Překlad featurecla → české označení
const PHYS_CLS_CZ: Record<string, string> = {
  'Range/Mtn': 'pohoří', 'Geologic': 'geologická oblast', 'Plain': 'planina/nížina',
  'Basin': 'kotlina', 'Delta': 'delta', 'Desert': 'poušť', 'Lowland': 'nížina',
  'Polar': 'polární oblast', 'Tundra': 'tundra', 'Tableland': 'plošina',
  'Valley': 'údolí', 'Peninsula': 'poloostrov', 'Island group': 'souostroví',
  'Ocean': 'oceán', 'Sea': 'moře', 'Bay': 'záliv', 'Gulf': 'záliv',
  'Strait': 'průliv', 'Channel': 'průliv', 'Inlet': 'zátoka',
};

// ─── Barvy klimatických pásů (Köppen-Geiger) ──────────────────────────────────
const KOPPEN_COLORS: Record<string, string> = {
  Af:'#0000FF', Am:'#0078FF', As:'#46A0FA', Aw:'#46A0FA',
  BWh:'#FF0000', BWk:'#FF9696', BSh:'#F5A500', BSk:'#FFD37F',
  Csa:'#FFFF00', Csb:'#C8C800', Csc:'#969600',
  Cwa:'#96FF96', Cwb:'#64C864', Cwc:'#32A032',
  Cfa:'#C8FF50', Cfb:'#64FF50', Cfc:'#32C800',
  Dsa:'#FF00FF', Dsb:'#C800C8', Dsc:'#963296', Dsd:'#966496',
  Dwa:'#AB2626', Dwb:'#852626', Dwc:'#6E2626', Dwd:'#522626',
  Dfa:'#6496FF', Dfb:'#2064FF', Dfc:'#1496E1', Dfd:'#1432C8',
  ET:'#B2B2B2', EF:'#FFFFFF',
};
const KOPPEN_NAMES_CZ: Record<string, string> = {
  Af:'Tropický deštný les', Am:'Tropický monzun', As:'Tropická savana suchá', Aw:'Tropická savana vlhká',
  BWh:'Horká poušť', BWk:'Studená poušť', BSh:'Horká step', BSk:'Studená step',
  Csa:'Středomořské suché', Csb:'Středomořské mírné', Csc:'Středomořské chladné',
  Cwa:'Vlhké subtropické suché zima', Cwb:'Mírné suché zima', Cwc:'Chladné suché zima',
  Cfa:'Vlhké subtropické', Cfb:'Oceánské', Cfc:'Suboceánské',
  Dsa:'Kontinentální suchá horká', Dsb:'Kontinentální suchá mírná', Dsc:'Kontinentální suchá chladná', Dsd:'Kontinentální suchá polární',
  Dwa:'Kontinentální suché zima horká', Dwb:'Kontinentální suché zima mírná', Dwc:'Kontinentální suché zima chladná', Dwd:'Kontinentální suché zima polární',
  Dfa:'Vlhké kontinentální horké', Dfb:'Vlhké kontinentální mírné', Dfc:'Subarktické mírné', Dfd:'Subarktické polární',
  ET:'Tundra', EF:'Věčný led',
};

// ─── Barvy biomů (Resolve 2017) ───────────────────────────────────────────────
const BIOME_COLORS: Record<number, string> = {
  1:'#00a650',  // Tropický/subtropický vlhký šir. les
  2:'#00692b',  // Tropický/subtropický suché šir. les
  3:'#5ebd5e',  // Tropický/subtropický jehličnatý les
  4:'#5f7f3b',  // Temperátní šir. les
  5:'#207035',  // Temperátní jehličnatý les
  6:'#025c37',  // Boreální jehličnatý les (tajga)
  7:'#cabd61',  // Tropická/subtropická savana
  8:'#c4a400',  // Temperátní step
  9:'#c8e84f',  // Zaplavené traviny
  10:'#f5e642', // Montánní step
  11:'#ffc800', // Tundra
  12:'#e8c896', // Středomořské ekosystémy
  13:'#f5a500', // Pouště a xerické křoviny
  14:'#00a0c8', // Mangrovníkové lesy
  98:'#aaaaaa', // Jezero
  99:'#888888', // Horniny a led
};
const BIOME_NAMES_CZ: Record<number, string> = {
  1:'Tropický vlhký les', 2:'Tropický suchý les', 3:'Tropický jehličnatý les',
  4:'Listnatý les mírného pásu', 5:'Jehličnatý les mírného pásu', 6:'Tajga',
  7:'Tropická savana', 8:'Temperátní step', 9:'Zaplavené louky',
  10:'Montánní pastviny', 11:'Tundra', 12:'Středomořské křoviny',
  13:'Pouště a suché křoviny', 14:'Mangrovníky', 98:'Jezero', 99:'Skalní a ledový terén',
};

// ─── Časové zóny ─────────────────────────────────────────────────────────────
const TZ_PALETTE = [
  '#e8d5b7','#d4e8c8','#b7d5e8','#e8b7d5','#d5e8b7',
  '#c8d4e8','#e8c8b7','#b7e8d5','#d5b7e8','#e8e8b7',
  '#b7b7e8','#e8d5d5','#d5d5b7','#c8b7e8','#b7e8c8',
];
function tzColor(zone: string): string {
  let h = 0;
  for (let i = 0; i < zone.length; i++) h = (h * 31 + zone.charCodeAt(i)) & 0xfffff;
  return TZ_PALETTE[Math.abs(h) % TZ_PALETTE.length];
}

// ─── GeoJSON cache ────────────────────────────────────────────────────────────
const geoCache = new Map<string, any>();
async function fetchGeo(url: string): Promise<any> {
  if (geoCache.has(url)) return geoCache.get(url);
  const r = await fetch(url);
  const d = await r.json();
  geoCache.set(url, d);
  return d;
}

// ─── ISO A3 → ISO N3 ─────────────────────────────────────────────────────────
export const MARKER_ICONS: Record<string, string> = {
  city: '🏙️', capital: '⭐', battle: '⚔️', landmark: '🏛️',
  river: '🌊', mountain: '⛰️', custom: '📍',
};

const A3_TO_N3: Record<string, string> = {
  AFG:'004',ALB:'008',DZA:'012',AND:'020',AGO:'024',ARG:'032',ARM:'051',AUS:'036',
  AUT:'040',AZE:'031',BHS:'044',BHR:'048',BGD:'050',BLR:'112',BEL:'056',BLZ:'084',
  BEN:'204',BTN:'064',BOL:'068',BIH:'070',BWA:'072',BRA:'076',BRN:'096',BGR:'100',
  BFA:'854',BDI:'108',CPV:'132',KHM:'116',CMR:'120',CAN:'124',CAF:'140',TCD:'148',
  CHL:'152',CHN:'156',COL:'170',COM:'174',COD:'180',COG:'178',CRI:'188',CIV:'384',
  HRV:'191',CUB:'192',CYP:'196',CZE:'203',DNK:'208',DJI:'262',DOM:'214',ECU:'218',
  EGY:'818',SLV:'222',GNQ:'226',ERI:'232',EST:'233',SWZ:'748',ETH:'231',FJI:'242',
  FIN:'246',FRA:'250',GAB:'266',GMB:'270',GEO:'268',DEU:'276',GHA:'288',GRC:'300',
  GTM:'320',GIN:'324',GNB:'624',GUY:'328',HTI:'332',HND:'340',HUN:'348',ISL:'352',
  IND:'356',IDN:'360',IRN:'364',IRQ:'368',IRL:'372',ISR:'376',ITA:'380',JAM:'388',
  JPN:'392',JOR:'400',KAZ:'398',KEN:'404',PRK:'408',KOR:'410',KWT:'414',KGZ:'417',
  LAO:'418',LVA:'428',LBN:'422',LSO:'426',LBR:'430',LBY:'434',LIE:'438',LTU:'440',
  LUX:'442',MDG:'450',MWI:'454',MYS:'458',MDV:'462',MLI:'466',MLT:'470',MRT:'478',
  MUS:'480',MEX:'484',MDA:'498',MCO:'492',MNG:'496',MNE:'499',MAR:'504',MOZ:'508',
  MMR:'104',NAM:'516',NPL:'524',NLD:'528',NZL:'554',NIC:'558',NER:'562',NGA:'566',
  MKD:'807',NOR:'578',OMN:'512',PAK:'586',PAN:'591',PNG:'598',PRY:'600',PER:'604',
  PHL:'608',POL:'616',PRT:'620',QAT:'634',ROU:'642',RUS:'643',RWA:'646',SAU:'682',
  SEN:'686',SRB:'688',SLE:'694',SVK:'703',SVN:'705',SOM:'706',ZAF:'710',SSD:'728',
  ESP:'724',LKA:'144',SDN:'729',SUR:'740',SWE:'752',CHE:'756',SYR:'760',TWN:'158',
  TJK:'762',TZA:'834',THA:'764',TLS:'626',TGO:'768',TTO:'780',TUN:'788',TUR:'792',
  TKM:'795',UGA:'800',UKR:'804',ARE:'784',GBR:'826',USA:'840',URY:'858',UZB:'860',
  VEN:'862',VNM:'704',YEM:'887',ZMB:'894',ZWE:'716',XKX:'983',PSE:'275',
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface QuizMapProps {
  map: SavedMap;
  height?: number;
  quizMode?: boolean;
  onAnswer?: (correct: boolean, name: string) => void;
  onCountryClick?: (isoN3: string, name: string) => void;
  /** Pokud předáno zvenku, ovládá rok externally (např. z AtlasApp) */
  historicalYear?: string;
  onHistoricalYearChange?: (year: string | undefined) => void;
}

interface TooltipState { x: number; y: number; name: string; sub?: string }

// ─── LakesLayer ──────────────────────────────────────────────────────────────
function LakesLayer({ quizMode, correctIds, answeredCorrect, answeredWrong, onLakeClick, onHover }: {
  quizMode: boolean; correctIds: Set<string>;
  answeredCorrect: Set<string>; answeredWrong: Set<string>;
  onLakeClick: (name: string) => void;
  onHover: (name: string | null, e: React.MouseEvent | null) => void;
}) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetchGeo(LAKES_URL).then(setData).catch(() => {}); }, []);
  if (!data) return null;
  return (
    <Geographies geography={data}>
      {({ geographies }) => geographies.map(geo => {
        const name = geo.properties?.name ?? geo.properties?.NAME ?? '';
        const isCorrect = answeredCorrect.has(name);
        const isWrong   = answeredWrong.has(name);
        const fill = isCorrect ? '#22c55e' : isWrong ? '#ef4444' : '#5ba3d9';
        const czName = CZ_PHYSICAL[name] ?? toCzechName(name);
        return (
          <Geography key={geo.rsmKey} geography={geo}
            fill={fill} fillOpacity={isCorrect || isWrong ? 0.85 : 0.65}
            stroke="#3a7ab8" strokeWidth={0.4}
            style={{ default:{outline:'none',cursor:quizMode?'pointer':'default'}, hover:{outline:'none',fillOpacity:0.9}, pressed:{outline:'none'} }}
            onMouseEnter={e => onHover(czName, e)} onMouseMove={e => onHover(czName, e)}
            onMouseLeave={() => onHover(null, null)} onClick={() => quizMode && onLakeClick(name)}
          />
        );
      })}
    </Geographies>
  );
}

// ─── TimeZonesLayer ───────────────────────────────────────────────────────────
function TimeZonesLayer({ quizMode, correctIds, answeredCorrect, answeredWrong, onTzClick, onHover }: {
  quizMode: boolean; correctIds: Set<string>;
  answeredCorrect: Set<string>; answeredWrong: Set<string>;
  onTzClick: (name: string) => void;
  onHover: (name: string | null, sub: string | null, e: React.MouseEvent | null) => void;
}) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetchGeo(TIME_ZONES_URL).then(setData).catch(() => {}); }, []);
  if (!data) return null;
  return (
    <Geographies geography={data}>
      {({ geographies }) => geographies.map(geo => {
        const zone   = geo.properties?.name ?? geo.properties?.time_zone ?? geo.properties?.TZID ?? '';
        const offset = geo.properties?.zone ?? geo.properties?.utc_format ?? '';
        const isCorrect = answeredCorrect.has(zone);
        const isWrong   = answeredWrong.has(zone);
        const fill = isCorrect ? '#22c55e' : isWrong ? '#ef4444' : tzColor(zone);
        return (
          <Geography key={geo.rsmKey} geography={geo}
            fill={fill} fillOpacity={isCorrect || isWrong ? 0.75 : 0.35}
            stroke="#94a3b8" strokeWidth={0.3}
            style={{ default:{outline:'none',cursor:quizMode?'pointer':'default'}, hover:{outline:'none',fillOpacity:0.55}, pressed:{outline:'none'} }}
            onMouseEnter={e => onHover(zone, offset ? `UTC${offset}` : null, e)}
            onMouseMove={e  => onHover(zone, offset ? `UTC${offset}` : null, e)}
            onMouseLeave={() => onHover(null, null, null)} onClick={() => quizMode && onTzClick(zone)}
          />
        );
      })}
    </Geographies>
  );
}

// ─── TectonicPlatesLayer ──────────────────────────────────────────────────────
function TectonicPlatesLayer({ quizMode, correctIds, answeredCorrect, answeredWrong, onPlateClick, onHover }: {
  quizMode: boolean; correctIds: Set<string>;
  answeredCorrect: Set<string>; answeredWrong: Set<string>;
  onPlateClick: (name: string) => void;
  onHover: (name: string | null, e: React.MouseEvent | null) => void;
}) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetchGeo(TECTONIC_PLATES_URL).then(setData).catch(() => {}); }, []);
  if (!data) return null;

  const CZ_PLATES: Record<string, string> = {
    'African Plate': 'Africká deska', 'Antarctic Plate': 'Antarktická deska',
    'Arabian Plate': 'Arabská deska', 'Australian Plate': 'Australská deska',
    'Caribbean Plate': 'Karibská deska', 'Cocos Plate': 'Kokosová deska',
    'Eurasian Plate': 'Euroasijská deska', 'Indian Plate': 'Indická deska',
    'Juan de Fuca Plate': 'Deska Juan de Fuca', 'Nazca Plate': 'Nazcská deska',
    'North American Plate': 'Severoamerická deska', 'Pacific Plate': 'Pacifická deska',
    'Philippine Plate': 'Filipínská deska', 'Scotia Plate': 'Skotská deska',
    'South American Plate': 'Jihoamerická deska', 'Somali Plate': 'Somálská deska',
    'Amur Plate': 'Amurská deska', 'Anatolian Plate': 'Anatolská deska',
    'Burma Plate': 'Barmská deska', 'Caribbean Plate': 'Karibská deska',
    'Caroline Plate': 'Karolínská deska', 'Okhotsk Plate': 'Ochotská deska',
  };

  return (
    <Geographies geography={data}>
      {({ geographies }) => geographies.map(geo => {
        const name = geo.properties?.PlateName ?? geo.properties?.name ?? '';
        const czName = CZ_PLATES[name] ?? name;
        const isCorrect = answeredCorrect.has(name);
        const isWrong   = answeredWrong.has(name);
        const fill = isCorrect ? '#22c55e' : isWrong ? '#ef4444' : 'transparent';
        return (
          <Geography key={geo.rsmKey} geography={geo}
            fill={fill} fillOpacity={0.15}
            stroke={isCorrect ? '#22c55e' : isWrong ? '#ef4444' : '#e11d48'}
            strokeWidth={1.5} strokeDasharray={isCorrect || isWrong ? undefined : '4,3'}
            style={{ default:{outline:'none',cursor:quizMode?'pointer':'default'}, hover:{outline:'none',fillOpacity:0.2}, pressed:{outline:'none'} }}
            onMouseEnter={e => onHover(czName, e)} onMouseMove={e => onHover(czName, e)}
            onMouseLeave={() => onHover(null, null)} onClick={() => quizMode && onPlateClick(name)}
          />
        );
      })}
    </Geographies>
  );
}

// ─── ClimateLayer (Köppen-Geiger) ─────────────────────────────────────────────
function ClimateLayer({ quizMode, correctIds, answeredCorrect, answeredWrong, onZoneClick, onHover }: {
  quizMode: boolean; correctIds: Set<string>;
  answeredCorrect: Set<string>; answeredWrong: Set<string>;
  onZoneClick: (name: string) => void;
  onHover: (name: string | null, sub: string | null, e: React.MouseEvent | null) => void;
}) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetchGeo(KOPPEN_URL).then(setData).catch(() => {}); }, []);
  if (!data) return null;
  return (
    <Geographies geography={data}>
      {({ geographies }) => geographies.map(geo => {
        const code = geo.properties?.code ?? geo.properties?.GRIDCODE ?? geo.properties?.climate ?? '';
        const isCorrect = answeredCorrect.has(code);
        const isWrong   = answeredWrong.has(code);
        const baseColor = KOPPEN_COLORS[code] ?? '#cccccc';
        const fill = isCorrect ? '#22c55e' : isWrong ? '#ef4444' : baseColor;
        const czName = KOPPEN_NAMES_CZ[code] ?? code;
        return (
          <Geography key={geo.rsmKey} geography={geo}
            fill={fill} fillOpacity={isCorrect || isWrong ? 0.80 : 0.50}
            stroke="none"
            style={{ default:{outline:'none',cursor:quizMode?'pointer':'default'}, hover:{outline:'none',fillOpacity:0.70}, pressed:{outline:'none'} }}
            onMouseEnter={e => onHover(czName, `${code}`, e)} onMouseMove={e => onHover(czName, `${code}`, e)}
            onMouseLeave={() => onHover(null, null, null)} onClick={() => quizMode && onZoneClick(code)}
          />
        );
      })}
    </Geographies>
  );
}

// ─── BiomesLayer (Resolve 2017) ───────────────────────────────────────────────
function BiomesLayer({ quizMode, correctIds, answeredCorrect, answeredWrong, onBiomeClick, onHover }: {
  quizMode: boolean; correctIds: Set<string>;
  answeredCorrect: Set<string>; answeredWrong: Set<string>;
  onBiomeClick: (name: string) => void;
  onHover: (name: string | null, sub: string | null, e: React.MouseEvent | null) => void;
}) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetchGeo(BIOMES_URL).then(setData).catch(() => {}); }, []);
  if (!data) return null;
  return (
    <Geographies geography={data}>
      {({ geographies }) => geographies.map(geo => {
        const biomeNum  = Number(geo.properties?.BIOME_NUM ?? geo.properties?.biome ?? 0);
        const biomeName = geo.properties?.BIOME_NAME ?? geo.properties?.ECO_NAME ?? '';
        const isCorrect = answeredCorrect.has(biomeName);
        const isWrong   = answeredWrong.has(biomeName);
        const baseColor = BIOME_COLORS[biomeNum] ?? '#aaaaaa';
        const fill = isCorrect ? '#22c55e' : isWrong ? '#ef4444' : baseColor;
        const czName = BIOME_NAMES_CZ[biomeNum] ?? biomeName;
        return (
          <Geography key={geo.rsmKey} geography={geo}
            fill={fill} fillOpacity={isCorrect || isWrong ? 0.80 : 0.45}
            stroke="none"
            style={{ default:{outline:'none',cursor:quizMode?'pointer':'default'}, hover:{outline:'none',fillOpacity:0.65}, pressed:{outline:'none'} }}
            onMouseEnter={e => onHover(czName, null, e)} onMouseMove={e => onHover(czName, null, e)}
            onMouseLeave={() => onHover(null, null, null)} onClick={() => quizMode && onBiomeClick(biomeName)}
          />
        );
      })}
    </Geographies>
  );
}

// ─── RailroadsLayer ───────────────────────────────────────────────────────────
function RailroadsLayer({ quizMode, correctIds, answeredCorrect, answeredWrong, onRailClick, onHover }: {
  quizMode: boolean; correctIds: Set<string>;
  answeredCorrect: Set<string>; answeredWrong: Set<string>;
  onRailClick: (name: string) => void;
  onHover: (name: string | null, e: React.MouseEvent | null) => void;
}) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetchGeo(RAILROADS_URL).then(setData).catch(() => {}); }, []);
  if (!data) return null;
  return (
    <Geographies geography={data}>
      {({ geographies }) => geographies.map(geo => {
        const name = geo.properties?.name ?? geo.properties?.NAME ?? '';
        const type = geo.properties?.type ?? '';
        const isCorrect = answeredCorrect.has(name);
        const isWrong   = answeredWrong.has(name);
        const stroke = isCorrect ? '#22c55e' : isWrong ? '#ef4444' : '#64748b';
        return (
          <Geography key={geo.rsmKey} geography={geo}
            fill="none" stroke={stroke} strokeWidth={0.5}
            style={{ default:{outline:'none',cursor:quizMode?'pointer':'default'}, hover:{outline:'none'}, pressed:{outline:'none'} }}
            onMouseEnter={e => onHover(name || `Trať (${type})`, e)} onMouseMove={e => onHover(name || `Trať (${type})`, e)}
            onMouseLeave={() => onHover(null, null)} onClick={() => quizMode && name && onRailClick(name)}
          />
        );
      })}
    </Geographies>
  );
}

// ─── AirportsLayer ────────────────────────────────────────────────────────────
function AirportsLayer({ quizMode, correctIds, answeredCorrect, answeredWrong, onAirportClick, onHover }: {
  quizMode: boolean; correctIds: Set<string>;
  answeredCorrect: Set<string>; answeredWrong: Set<string>;
  onAirportClick: (name: string) => void;
  onHover: (name: string | null, sub: string | null, e: React.MouseEvent | null) => void;
}) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetchGeo(AIRPORTS_URL).then(setData).catch(() => {}); }, []);
  if (!data) return null;
  return (
    <>
      {(data.features ?? []).map((f: any) => {
        if (!f.geometry?.coordinates) return null;
        const [lng, lat] = f.geometry.coordinates;
        const name = f.properties?.name ?? '';
        const iata = f.properties?.iata_code ?? f.properties?.abbrev ?? '';
        const isCorrect = answeredCorrect.has(name);
        const isWrong   = answeredWrong.has(name);
        const color = isCorrect ? '#22c55e' : isWrong ? '#ef4444' : '#7c3aed';
        return (
          <Marker key={f.properties?.featurecla + name + lng} coordinates={[lng, lat]}
            onClick={() => quizMode && onAirportClick(name)}>
            <g style={{cursor: quizMode ? 'pointer' : 'default'}}
              onMouseEnter={e => onHover(name, iata || null, e as any)}
              onMouseMove={e  => onHover(name, iata || null, e as any)}
              onMouseLeave={() => onHover(null, null, null)}>
              <circle r={3} fill={color} fillOpacity={0.85} stroke="white" strokeWidth={0.8}/>
              <text textAnchor="middle" y={-5} style={{fontSize:6, fill: color, fontWeight:700, pointerEvents:'none', userSelect:'none'}}>✈</text>
            </g>
          </Marker>
        );
      })}
    </>
  );
}

// ─── Statická data vulkánů (Smithsonian GVP) ────────────────────────────────
// [lng, lat, name, country, type]  type: A=aktivní H=historicky aktivní
const VOLCANO_DATA: [number, number, string, string, string][] = [
  // ── Evropa ─────────────────────────────────────────────────────────────────
  [15.00, 37.75, 'Etna', 'Itálie', 'A'],
  [14.43, 40.82, 'Vesuv', 'Itálie', 'H'],
  [15.21, 38.79, 'Stromboli', 'Itálie', 'A'],
  [14.70, 38.57, 'Vulcano', 'Itálie', 'A'],
  [12.70, 41.73, 'Campi Flegrei', 'Itálie', 'H'],
  [25.40, 36.40, 'Santorini', 'Řecko', 'H'],
  [-19.70, 63.98, 'Hekla', 'Island', 'A'],
  [-19.62, 63.63, 'Eyjafjallajökull', 'Island', 'A'],
  [-17.98, 65.07, 'Katla', 'Island', 'A'],
  [-16.78, 65.73, 'Krafla', 'Island', 'A'],
  [-22.33, 63.92, 'Grímsvötn', 'Island', 'A'],
  [-23.30, 63.63, 'Bárðarbunga', 'Island', 'A'],
  [-28.40, 38.57, 'Pico', 'Azory', 'A'],
  [-17.44, 28.57, 'Teide', 'Španělsko', 'H'],
  [-17.84, 28.57, 'Cumbre Vieja', 'Španělsko', 'A'],
  [15.32, 37.87, 'Pantelleria', 'Itálie', 'H'],
  // ── Afrika ─────────────────────────────────────────────────────────────────
  [37.36, -3.07, 'Kilimandžáro', 'Tanzanie', 'H'],
  [29.25, -1.52, 'Nyiragongo', 'DR Kongo', 'A'],
  [29.20, -1.41, 'Nyamulagira', 'DR Kongo', 'A'],
  [35.91, -2.76, 'Ol Doinyo Lengai', 'Tanzanie', 'A'],
  [40.67, 13.60, 'Erta Ale', 'Etiopie', 'A'],
  [41.79, 11.13, 'Dabbahu', 'Etiopie', 'A'],
  [8.70, 4.20, 'Cameroon', 'Kamerun', 'A'],
  [13.59, 37.54, 'Erta Ale (Dallol)', 'Etiopie', 'H'],
  [39.85, 14.95, 'Nabro', 'Eritrea', 'A'],
  [14.44, -17.95, 'Tristão da Cunha', 'Sv. Helena', 'A'],
  [-14.36, -7.89, 'Ascension Is.', 'Ascension', 'H'],
  // ── Střední Asie / Rusko ───────────────────────────────────────────────────
  [160.64, 56.05, 'Klyuchevskaya', 'Rusko', 'A'],
  [161.76, 55.98, 'Tolbachik', 'Rusko', 'A'],
  [157.83, 52.43, 'Mutnovsky', 'Rusko', 'A'],
  [158.84, 53.26, 'Gorely', 'Rusko', 'A'],
  [161.34, 55.42, 'Ksudach', 'Rusko', 'A'],
  [163.68, 57.47, 'Shiveluch', 'Rusko', 'A'],
  [162.36, 55.98, 'Bezymianny', 'Rusko', 'A'],
  [159.44, 52.56, 'Avachinsky', 'Rusko', 'A'],
  [153.00, 48.79, 'Ebeko', 'Rusko', 'A'],
  // ── Japonsko ───────────────────────────────────────────────────────────────
  [138.73, 35.36, 'Fuji', 'Japonsko', 'H'],
  [130.66, 31.58, 'Sakurajima', 'Japonsko', 'A'],
  [131.11, 32.88, 'Aso', 'Japonsko', 'A'],
  [130.30, 32.76, 'Unzen', 'Japonsko', 'H'],
  [140.68, 40.65, 'Iwate', 'Japonsko', 'A'],
  [141.45, 43.38, 'Usu', 'Japonsko', 'A'],
  [141.53, 44.38, 'Meakan', 'Japonsko', 'A'],
  [139.52, 34.73, 'Miyakejima', 'Japonsko', 'A'],
  [139.40, 34.90, 'Oshima', 'Japonsko', 'A'],
  [127.97, 30.48, 'Suwanosejima', 'Japonsko', 'A'],
  // ── Filipíny / Indonésie ────────────────────────────────────────────────────
  [120.35, 15.13, 'Pinatubo', 'Filipíny', 'A'],
  [123.69, 13.26, 'Mayon', 'Filipíny', 'A'],
  [120.99, 14.01, 'Taal', 'Filipíny', 'A'],
  [124.10, 9.20, 'Kanlaon', 'Filipíny', 'A'],
  [110.45, -7.54, 'Merapi', 'Indonésie', 'A'],
  [112.95, -7.92, 'Bromo', 'Indonésie', 'A'],
  [112.92, -8.11, 'Semeru', 'Indonésie', 'A'],
  [116.47, -8.42, 'Rinjani', 'Indonésie', 'A'],
  [118.00, -8.25, 'Tambora', 'Indonésie', 'H'],
  [105.42, -6.10, 'Krakatau', 'Indonésie', 'A'],
  [127.33, 1.38, 'Dukono', 'Indonésie', 'A'],
  [124.74, 1.36, 'Soputan', 'Indonésie', 'A'],
  [126.62, 1.67, 'Lokon-Empung', 'Indonésie', 'A'],
  [98.92, 3.65, 'Sinabung', 'Indonésie', 'A'],
  [100.42, -2.88, 'Kerinci', 'Indonésie', 'A'],
  [112.31, -7.13, 'Kelut', 'Indonésie', 'A'],
  [106.68, -6.70, 'Salak', 'Indonésie', 'A'],
  // ── Papua Nová Guinea ───────────────────────────────────────────────────────
  [152.20, -4.27, 'Tavurvur', 'PNG', 'A'],
  [150.72, -5.52, 'Ulawun', 'PNG', 'A'],
  [148.15, -5.87, 'Manam', 'PNG', 'A'],
  [147.34, -6.14, 'Langila', 'PNG', 'A'],
  [150.14, -6.74, 'Bagana', 'PNG', 'A'],
  // ── Vanuatu / Šalamounovy ostrovy ──────────────────────────────────────────
  [167.83, -15.39, 'Yasur', 'Vanuatu', 'A'],
  [167.58, -16.27, 'Ambrym', 'Vanuatu', 'A'],
  [167.47, -17.27, 'Lopevi', 'Vanuatu', 'A'],
  // ── Aljaška ────────────────────────────────────────────────────────────────
  [-169.95, 52.82, 'Cleveland', 'USA (Aljaška)', 'A'],
  [-164.16, 53.93, 'Shishaldin', 'USA (Aljaška)', 'A'],
  [-163.97, 54.07, 'Isanotski', 'USA (Aljaška)', 'A'],
  [-162.25, 54.76, 'Pavlof', 'USA (Aljaška)', 'A'],
  [-153.43, 57.44, 'Chiginagak', 'USA (Aljaška)', 'A'],
  [-152.74, 58.27, 'Augustine', 'USA (Aljaška)', 'A'],
  [-151.77, 60.49, 'Redoubt', 'USA (Aljaška)', 'A'],
  [-150.68, 60.99, 'Spurr', 'USA (Aljaška)', 'A'],
  [-166.04, 54.08, 'Veniaminof', 'USA (Aljaška)', 'A'],
  // ── USA ────────────────────────────────────────────────────────────────────
  [-122.18, 46.20, 'St. Helens', 'USA', 'A'],
  [-121.73, 46.85, 'Rainier', 'USA', 'H'],
  [-121.50, 44.34, 'Newberry', 'USA', 'H'],
  [-122.19, 41.41, 'Lassen', 'USA', 'A'],
  [-110.67, 44.43, 'Yellowstone', 'USA', 'H'],
  [-155.29, 19.41, 'Kīlauea', 'USA (Havaj)', 'A'],
  [-155.61, 19.48, 'Mauna Loa', 'USA (Havaj)', 'A'],
  [-156.00, 20.73, 'Haleakalā', 'USA (Havaj)', 'H'],
  // ── Mexiko ─────────────────────────────────────────────────────────────────
  [-98.62, 19.02, 'Popocatépetl', 'Mexiko', 'A'],
  [-103.62, 19.51, 'Colima', 'Mexiko', 'A'],
  [-97.27, 18.70, 'Citlaltépetl', 'Mexiko', 'A'],
  [-102.24, 19.49, 'Paricutín', 'Mexiko', 'H'],
  // ── Střední Amerika ─────────────────────────────────────────────────────────
  [-89.62, 14.38, 'Santa Ana', 'Salvador', 'A'],
  [-89.76, 13.74, 'Izalco', 'Salvador', 'A'],
  [-90.88, 14.77, 'Santiaguito', 'Guatemala', 'A'],
  [-90.60, 14.47, 'Fuego', 'Guatemala', 'A'],
  [-90.88, 14.97, 'Atitlán', 'Guatemala', 'H'],
  [-85.37, 12.98, 'Concepción', 'Nikaragua', 'A'],
  [-86.16, 12.59, 'Masaya', 'Nikaragua', 'A'],
  [-86.52, 12.98, 'Momotombo', 'Nikaragua', 'H'],
  [-84.70, 10.84, 'Poás', 'Kostarika', 'A'],
  [-84.23, 10.20, 'Irazú', 'Kostarika', 'A'],
  [-83.77, 10.02, 'Turrialba', 'Kostarika', 'A'],
  // ── Jižní Amerika ───────────────────────────────────────────────────────────
  [-77.36, 1.22, 'Galeras', 'Kolumbie', 'A'],
  [-75.37, 4.89, 'Nevado del Ruiz', 'Kolumbie', 'A'],
  [-78.44, -0.68, 'Cotopaxi', 'Ekvádor', 'A'],
  [-78.65, -0.46, 'Pichincha', 'Ekvádor', 'A'],
  [-78.04, -1.47, 'Tungurahua', 'Ekvádor', 'A'],
  [-77.65, -0.28, 'Reventador', 'Ekvádor', 'A'],
  [-69.65, -18.14, 'Ollagüe', 'Chile/Bolívie', 'A'],
  [-67.89, -22.27, 'Láscar', 'Chile', 'A'],
  [-71.94, -39.42, 'Villarrica', 'Chile', 'A'],
  [-72.50, -41.10, 'Osorno', 'Chile', 'H'],
  [-73.59, -41.33, 'Calbuco', 'Chile', 'A'],
  [-72.37, -40.67, 'Mocho-Choshuenco', 'Chile', 'H'],
  [-73.02, -45.92, 'Hudson', 'Chile', 'A'],
  [-68.54, -26.11, 'Ojos del Salado', 'Chile', 'H'],
  [-70.57, -35.22, 'Planchón-Peteroa', 'Chile', 'A'],
  // ── Karibik ────────────────────────────────────────────────────────────────
  [-61.17, 16.72, 'Soufrière Hills', 'Montserrat', 'A'],
  [-61.65, 13.33, 'Soufrière St. Vincent', 'Sv. Vincenc', 'A'],
  [-62.18, 17.33, 'Soufrière Guadeloupe', 'Guadeloupe', 'H'],
  // ── Střední Asie / Indie ───────────────────────────────────────────────────
  [92.10, 11.62, 'Barren Island', 'Indie', 'A'],
  [39.29, 15.78, 'Alayta', 'Etiopie', 'H'],
  // ── Nový Zéland ────────────────────────────────────────────────────────────
  [175.63, -37.68, 'Whakaari (White Is.)', 'Nový Zéland', 'A'],
  [175.53, -39.28, 'Tongariro', 'Nový Zéland', 'A'],
  [175.64, -39.15, 'Ngauruhoe', 'Nový Zéland', 'A'],
  [175.57, -39.30, 'Ruapehu', 'Nový Zéland', 'A'],
  // ── Polinésie / Tichý oceán ─────────────────────────────────────────────────
  [-149.60, -17.68, 'Piton de la Fournaise', 'Réunion', 'A'],
  [169.44, -19.52, 'Ambrym', 'Vanuatu', 'A'],
  [-109.88, -27.12, 'Wolf', 'Galapágy', 'A'],
  [-91.35, -0.37, 'Cerro Azul', 'Galapágy', 'A'],
];

// ─── VolcanoesLayer ───────────────────────────────────────────────────────────
function VolcanoesLayer({ quizMode, correctIds, answeredCorrect, answeredWrong, onVolcanoClick, onHover }: {
  quizMode: boolean; correctIds: Set<string>;
  answeredCorrect: Set<string>; answeredWrong: Set<string>;
  onVolcanoClick: (name: string) => void;
  onHover: (name: string | null, sub: string | null, e: React.MouseEvent | null) => void;
}) {
  return (
    <>
      {VOLCANO_DATA.map(([lng, lat, name, country, type]) => {
        const isCorrect = answeredCorrect.has(name);
        const isWrong   = answeredWrong.has(name);
        // Aktivní = sytě červená, historicky aktivní = oranžová
        const baseColor = type === 'A' ? '#dc2626' : '#f97316';
        const color = isCorrect ? '#22c55e' : isWrong ? '#ef4444' : baseColor;
        return (
          <Marker key={`vol-${name}`} coordinates={[lng, lat]}
            onClick={() => quizMode && onVolcanoClick(name)}>
            <g style={{ cursor: quizMode ? 'pointer' : 'default' }}
              onMouseEnter={e => onHover(name, `${country} · ${type === 'A' ? 'aktivní' : 'historicky aktivní'}`, e as any)}
              onMouseMove={e  => onHover(name, `${country} · ${type === 'A' ? 'aktivní' : 'historicky aktivní'}`, e as any)}
              onMouseLeave={() => onHover(null, null, null)}>
              <polygon points="0,-7 5,4 -5,4" fill={color} fillOpacity={0.9} stroke="white" strokeWidth={1}/>
              <circle r={1.5} cx={0} cy={-1} fill="orange" opacity={0.8}/>
            </g>
          </Marker>
        );
      })}
    </>
  );
}

// ─── EarthquakesLayer (USGS) ──────────────────────────────────────────────────
const EQ_CACHE_KEY = 'quizmap-earthquakes-v1';
const EQ_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

async function fetchEarthquakes(): Promise<any> {
  try {
    const cached = localStorage.getItem(EQ_CACHE_KEY);
    if (cached) {
      const { ts, data } = JSON.parse(cached);
      if (Date.now() - ts < EQ_CACHE_TTL) return data;
    }
  } catch {}
  const res = await fetch(EARTHQUAKES_URL);
  const data = await res.json();
  try { localStorage.setItem(EQ_CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
  return data;
}

function EarthquakesLayer({ quizMode, correctIds, answeredCorrect, answeredWrong, onEqClick, onHover }: {
  quizMode: boolean; correctIds: Set<string>;
  answeredCorrect: Set<string>; answeredWrong: Set<string>;
  onEqClick: (name: string) => void;
  onHover: (name: string | null, sub: string | null, e: React.MouseEvent | null) => void;
}) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetchEarthquakes().then(setData).catch(() => {}); }, []);
  if (!data) return null;
  return (
    <>
      {(data.features ?? []).map((f: any) => {
        if (!f.geometry?.coordinates) return null;
        const [lng, lat] = f.geometry.coordinates;
        const mag    = f.properties?.mag ?? 0;
        const place  = f.properties?.place ?? '';
        const time   = f.properties?.time ? new Date(f.properties.time).getFullYear() : '';
        const r      = Math.max(2, (mag - 5) * 2.5);  // M5.5 → r=1.25, M8 → r=7.5
        const color  = mag >= 7.5 ? '#7c0000' : mag >= 6.5 ? '#dc2626' : mag >= 5.5 ? '#f97316' : '#fbbf24';
        const key    = `${f.id ?? (lng + lat + mag)}`;
        return (
          <Marker key={key} coordinates={[lng, lat]} onClick={() => quizMode && onEqClick(place)}>
            <g style={{cursor: quizMode ? 'pointer' : 'default'}}
              onMouseEnter={e => onHover(place, `M${mag.toFixed(1)} · ${time}`, e as any)}
              onMouseMove={e  => onHover(place, `M${mag.toFixed(1)} · ${time}`, e as any)}
              onMouseLeave={() => onHover(null, null, null)}>
              <circle r={r} fill={color} fillOpacity={0.65} stroke={color} strokeWidth={0.5}/>
            </g>
          </Marker>
        );
      })}
    </>
  );
}

// ─── PhysicalRegionsLayer ────────────────────────────────────────────────────
function PhysicalRegionsLayer({ quizMode, correctIds, answeredCorrect, answeredWrong, onRegionClick, onHover }: {
  quizMode: boolean;
  correctIds: Set<string>;
  answeredCorrect: Set<string>;
  answeredWrong: Set<string>;
  onRegionClick: (name: string) => void;
  onHover: (name: string | null, sub: string | null, e: React.MouseEvent | null) => void;
}) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchGeo(PHYSICAL_POLYS_URL).then(setData).catch(() => {});
  }, []);

  if (!data) return null;

  return (
    <Geographies geography={data}>
      {({ geographies }) =>
        geographies.map(geo => {
          const name     = geo.properties?.name ?? geo.properties?.NAME ?? '';
          const cls      = geo.properties?.featurecla ?? geo.properties?.FEATURECLA ?? 'default';
          const isCorrect = answeredCorrect.has(name);
          const isWrong   = answeredWrong.has(name);

          const style = PHYSICAL_COLORS[cls] ?? PHYSICAL_COLORS['default'];
          const fill  = isCorrect ? '#22c55e' : isWrong ? '#ef4444' : style.fill;
          const czName = toCzechPhysical(name);
          const czCls  = PHYS_CLS_CZ[cls] ?? cls.toLowerCase();

          return (
            <Geography
              key={geo.rsmKey}
              geography={geo}
              fill={fill}
              fillOpacity={isCorrect || isWrong ? 0.75 : style.fillOpacity}
              stroke={style.stroke}
              strokeWidth={0.6}
              style={{
                default: { outline: 'none', cursor: quizMode ? 'pointer' : 'default' },
                hover:   { outline: 'none', fillOpacity: (isCorrect || isWrong ? 0.85 : style.fillOpacity + 0.2), cursor: quizMode ? 'pointer' : 'default' },
                pressed: { outline: 'none' },
              }}
              onMouseEnter={(e: React.MouseEvent) => onHover(czName, czCls, e)}
              onMouseMove={(e: React.MouseEvent)  => onHover(czName, czCls, e)}
              onMouseLeave={() => onHover(null, null, null)}
              onClick={() => quizMode && onRegionClick(name)}
            />
          );
        })
      }
    </Geographies>
  );
}

// ─── OceansLayer ─────────────────────────────────────────────────────────────
function OceansLayer({ quizMode, correctIds, answeredCorrect, answeredWrong, onRegionClick, onHover }: {
  quizMode: boolean;
  correctIds: Set<string>;
  answeredCorrect: Set<string>;
  answeredWrong: Set<string>;
  onRegionClick: (name: string) => void;
  onHover: (name: string | null, sub: string | null, e: React.MouseEvent | null) => void;
}) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchGeo(MARINE_POLYS_URL).then(setData).catch(() => {});
  }, []);

  if (!data) return null;

  return (
    <Geographies geography={data}>
      {({ geographies }) =>
        geographies.map(geo => {
          const name    = geo.properties?.name ?? geo.properties?.NAME ?? '';
          const cls     = geo.properties?.featurecla ?? geo.properties?.FEATURECLA ?? 'default';
          const isCorrect = answeredCorrect.has(name);
          const isWrong   = answeredWrong.has(name);

          const style  = MARINE_COLORS[cls] ?? MARINE_COLORS['default'];
          const fill   = isCorrect ? '#22c55e' : isWrong ? '#ef4444' : style.fill;
          const czName = toCzechPhysical(name);
          const czCls  = PHYS_CLS_CZ[cls] ?? cls.toLowerCase();

          return (
            <Geography
              key={geo.rsmKey}
              geography={geo}
              fill={fill}
              fillOpacity={isCorrect || isWrong ? 0.75 : style.fillOpacity}
              stroke={style.stroke}
              strokeWidth={0.5}
              style={{
                default: { outline: 'none', cursor: quizMode ? 'pointer' : 'default' },
                hover:   { outline: 'none', fillOpacity: (isCorrect || isWrong ? 0.85 : style.fillOpacity + 0.15), cursor: quizMode ? 'pointer' : 'default' },
                pressed: { outline: 'none' },
              }}
              onMouseEnter={(e: React.MouseEvent) => onHover(czName, czCls, e)}
              onMouseMove={(e: React.MouseEvent)  => onHover(czName, czCls, e)}
              onMouseLeave={() => onHover(null, null, null)}
              onClick={() => quizMode && onRegionClick(name)}
            />
          );
        })
      }
    </Geographies>
  );
}

// ─── HistoricalLayer ──────────────────────────────────────────────────────────
function HistoricalLayer({
  year, quizMode, correctIds, answeredCorrect, answeredWrong,
  onStateClick, onHover,
}: {
  year: string;
  quizMode: boolean;
  correctIds: Set<string>;
  answeredCorrect: Set<string>;
  answeredWrong: Set<string>;
  onStateClick: (name: string) => void;
  onHover: (name: string | null, sub: string | null, e: React.MouseEvent | null) => void;
}) {
  const [data, setData]             = useState<any>(null);
  const [czMap, setCzMap]           = useState<Record<string, string>>({});
  const currentYear                 = useRef(year);

  useEffect(() => {
    currentYear.current = year;
    setData(null);
    setCzMap({});

    fetchGeo(histUrl(year)).then(async d => {
      if (currentYear.current !== year) return;
      setData(d);

      // Sbírej všechna unikátní jména z GeoJSON
      const allNames = new Set<string>();
      for (const f of d.features ?? []) {
        const n  = f.properties?.NAME ?? '';
        const po = f.properties?.PARTOF ?? f.properties?.SUBJECTO ?? '';
        if (n)  allNames.add(n);
        if (po) allNames.add(po);
      }

      // Filtruj jen ty, které nejsou v statických tabulkách ani AI cache
      const needsAI: string[] = [];
      const resolved: Record<string, string> = {};
      for (const n of allNames) {
        if (CZ_NAMES[n])          { resolved[n] = CZ_NAMES[n]; }
        else if (CZ_EXTRA[n])     { resolved[n] = CZ_EXTRA[n]; }
        else if (aiTranslations[n]) { resolved[n] = aiTranslations[n]; }
        else                      { needsAI.push(n); }
      }

      // Okamžitě zobraz co máme
      setCzMap({ ...resolved });

      if (!needsAI.length) return;

      // Pošli vše co zbývá Gemini najednou
      const results = await batchTranslate(needsAI);
      Object.assign(aiTranslations, results);
      try { localStorage.setItem(LS_KEY, JSON.stringify(aiTranslations)); } catch {}

      if (currentYear.current !== year) return;
      setCzMap(prev => ({ ...prev, ...results }));
    }).catch(() => {});
  }, [year]);

  if (!data) return null;

  return (
    <Geographies geography={data}>
      {({ geographies }) =>
        geographies.map(geo => {
          const name    = geo.properties?.NAME ?? '';
          const partOf  = geo.properties?.PARTOF ?? geo.properties?.SUBJECTO ?? '';
          const isCorrect = answeredCorrect.has(name);
          const isWrong   = answeredWrong.has(name);

          const fill = isCorrect ? '#22c55e'
            : isWrong   ? '#ef4444'
            : histColor(partOf || name);

          const czName   = czMap[name]   ?? applyPatterns(name);
          const czPartOf = partOf && partOf !== name ? (czMap[partOf] ?? applyPatterns(partOf)) : null;

          return (
            <Geography
              key={geo.rsmKey}
              geography={geo}
              fill={fill}
              fillOpacity={0.75}
              stroke="#7a6a58"
              strokeWidth={0.5}
              style={{
                default: { outline: 'none', cursor: quizMode ? 'pointer' : 'default' },
                hover:   { outline: 'none', fillOpacity: 1, cursor: quizMode ? 'pointer' : 'default' },
                pressed: { outline: 'none' },
              }}
              onMouseEnter={(e: React.MouseEvent) => onHover(czName, czPartOf, e)}
              onMouseMove={(e: React.MouseEvent)  => onHover(czName, czPartOf, e)}
              onMouseLeave={() => onHover(null, null, null)}
              onClick={() => quizMode && onStateClick(name)}
            />
          );
        })
      }
    </Geographies>
  );
}

// ─── RiversLayer ──────────────────────────────────────────────────────────────
function RiversLayer({ region, quizMode, correctIds, answeredCorrect, answeredWrong, onRiverClick, onHover }: {
  region: MapRegionId; quizMode: boolean; correctIds: Set<string>;
  answeredCorrect: Set<string>; answeredWrong: Set<string>;
  onRiverClick: (name: string) => void;
  onHover: (name: string | null, e: React.MouseEvent | null) => void;
}) {
  const [riverData,   setRiverData]   = useState<any>(null);
  const [europeExtra, setEuropeExtra] = useState<any>(null);
  const isEurope = EUROPE_REGIONS.has(region);

  useEffect(() => { fetchGeo(RIVERS_URL).then(setRiverData).catch(() => {}); }, []);
  useEffect(() => {
    if (isEurope) fetchGeo(RIVERS_EUROPE_URL).then(setEuropeExtra).catch(() => {});
  }, [isEurope]);

  if (!riverData) return null;

  const allFeatures = [
    ...riverData.features.filter((f: any) => f.properties?.featurecla !== 'Lake'),
    ...(europeExtra?.features ?? []).filter((f: any) => f.properties?.featurecla !== 'Lake'),
  ];
  const filtered = { type: 'FeatureCollection', features: allFeatures };

  return (
    <Geographies geography={filtered}>
      {({ geographies }) =>
        geographies.map(geo => {
          const name      = geo.properties?.name ?? geo.properties?.Name ?? '';
          const isCorrect = answeredCorrect.has(name);
          const isWrong   = answeredWrong.has(name);
          const stroke    = isCorrect ? '#22c55e' : isWrong ? '#ef4444' : '#5eabf0';
          return (
            <Geography
              key={geo.rsmKey}
              geography={geo}
              fill="none"
              stroke={stroke}
              strokeWidth={isCorrect || isWrong ? 2.5 : 1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                default: { outline: 'none', cursor: quizMode ? 'pointer' : 'default' },
                hover:   { outline: 'none', stroke: quizMode ? '#3b82f6' : '#38bdf8', strokeWidth: 2.5 },
                pressed: { outline: 'none' },
              }}
              onMouseEnter={(e: React.MouseEvent) => onHover(toCzechRiver(name), e)}
              onMouseMove={(e: React.MouseEvent)  => onHover(toCzechRiver(name), e)}
              onMouseLeave={() => onHover(null, null)}
              onClick={() => quizMode && onRiverClick(name)}
            />
          );
        })
      }
    </Geographies>
  );
}

// ─── CitiesLayer ──────────────────────────────────────────────────────────────
function CitiesLayer({ region, quizMode, correctIds, answeredCorrect, answeredWrong, onCityClick, onHover }: {
  region: MapRegionId; quizMode: boolean; correctIds: Set<string>;
  answeredCorrect: Set<string>; answeredWrong: Set<string>;
  onCityClick: (name: string) => void;
  onHover: (name: string | null, sub: string | null, e: React.MouseEvent | null) => void;
}) {
  void region; // 10m je globálně, region se používá jen pro Evropu (rivers)
  const [citiesData, setCitiesData] = useState<any>(null);

  useEffect(() => {
    setCitiesData(null);
    fetchGeo(CITIES_URL).then(setCitiesData).catch(() => {});
  }, []);

  const cities = useMemo(() => citiesData?.features ?? [], [citiesData]);
  if (!citiesData) return null;

  return (
    <>
      {cities.map((f: any, i: number) => {
        const [lng, lat] = f.geometry.coordinates;
        const name       = f.properties?.NAME ?? '';
        const country    = f.properties?.SOV0NAME ?? '';
        const isCapital  = f.properties?.FEATURECLA === 'Admin-0 capital';
        const isCorrect  = answeredCorrect.has(name);
        const isWrong    = answeredWrong.has(name);
        const dotColor   = isCorrect ? '#22c55e' : isWrong ? '#ef4444' : isCapital ? '#f59e0b' : '#e11d48';
        const dotR       = isCapital ? 3.5 : 2.5;

        return (
          <Marker key={`city-${i}`} coordinates={[lng, lat]} onClick={() => quizMode && onCityClick(name)}>
            <g
              style={{ cursor: quizMode ? 'pointer' : 'default' }}
              onMouseEnter={e => onHover(name, country, e)}
              onMouseMove={e  => onHover(name, country, e)}
              onMouseLeave={() => onHover(null, null, null)}
            >
              <circle r={8} fill="transparent" />
              <circle r={isCorrect || isWrong ? dotR + 1.5 : dotR} fill={dotColor}
                stroke="white" strokeWidth={isCapital ? 1 : 0.7} opacity={0.9} />
              {(isCorrect || isWrong) && (
                <text textAnchor="middle" dominantBaseline="central"
                  style={{ fontSize: 6, fill: 'white', fontWeight: 700, userSelect: 'none', pointerEvents: 'none' }}>
                  {isCorrect ? '✓' : '✗'}
                </text>
              )}
            </g>
          </Marker>
        );
      })}
    </>
  );
}

// ─── YearPicker ───────────────────────────────────────────────────────────────
function YearPicker({ selected, onChange, onClear }: {
  selected: string | undefined;
  onChange: (year: string) => void;
  onClear: () => void;
}) {
  const [activeEpoch, setActiveEpoch] = useState<number>(() => {
    if (!selected) return 4; // Moderní jako výchozí
    return HIST_EPOCHS.findIndex(e => e.years.some(y => y.key === selected)) ?? 4;
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  // Přeskroluj na aktivní rok
  useEffect(() => {
    if (selected && scrollRef.current) {
      const btn = scrollRef.current.querySelector(`[data-year="${selected}"]`) as HTMLElement;
      btn?.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
    }
  }, [selected, activeEpoch]);

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 15,
      background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(8px)',
      borderTop: '1px solid rgba(255,255,255,0.1)',
      userSelect: 'none',
    }}>
      {/* Epochy tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0 8px' }}>
        {HIST_EPOCHS.map((ep, i) => (
          <button key={i} onClick={() => setActiveEpoch(i)}
            style={{
              padding: '5px 10px', fontSize: 9, fontWeight: 700, cursor: 'pointer',
              background: 'transparent', border: 'none',
              borderBottom: activeEpoch === i ? '2px solid #f59e0b' : '2px solid transparent',
              color: activeEpoch === i ? '#f59e0b' : '#94a3b8',
              textTransform: 'uppercase', letterSpacing: '0.04em',
              transition: 'all .12s',
            }}
          >{ep.label}</button>
        ))}
        <div style={{ flex: 1 }} />
        {selected && (
          <button onClick={onClear}
            style={{
              padding: '4px 10px', fontSize: 9, fontWeight: 700, cursor: 'pointer',
              background: 'transparent', border: 'none', color: '#64748b',
            }}
          >✕ Moderní mapa</button>
        )}
      </div>

      {/* Roky */}
      <div ref={scrollRef} style={{
        display: 'flex', gap: 4, padding: '6px 8px', overflowX: 'auto',
        scrollbarWidth: 'none',
      }}>
        {HIST_EPOCHS[activeEpoch].years.map(({ key, display }) => {
          const active = selected === key;
          return (
            <button
              key={key}
              data-year={key}
              onClick={() => onChange(key)}
              style={{
                flexShrink: 0,
                padding: '4px 9px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                cursor: 'pointer', border: 'none', transition: 'all .12s',
                background: active ? '#f59e0b' : 'rgba(255,255,255,0.08)',
                color: active ? '#1e293b' : '#cbd5e1',
                boxShadow: active ? '0 2px 8px rgba(245,158,11,0.4)' : 'none',
              }}
            >
              {display}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Region projekce ──────────────────────────────────────────────────────────
const REGION_PROJECTION: Record<MapRegionId, { center: [number, number]; zoom: number }> = {
  world:            { center: [0,    10  ], zoom: 1    },
  europe:           { center: [15,   54  ], zoom: 4.5  },
  'central-europe': { center: [16,   50  ], zoom: 8    },
  mediterranean:    { center: [18,   38  ], zoom: 4    },
  'middle-east':    { center: [40,   30  ], zoom: 4    },
  africa:           { center: [20,    5  ], zoom: 2.5  },
  asia:             { center: [90,   40  ], zoom: 2.2  },
  americas:         { center: [-75,  10  ], zoom: 2    },
  'czech-republic': { center: [15.5, 49.8], zoom: 18   },
  italy:            { center: [12.5, 42  ], zoom: 6.5  },
  greece:           { center: [22,   39  ], zoom: 8    },
  france:           { center: [2,    47  ], zoom: 7    },
  germany:          { center: [10,   51  ], zoom: 7    },
  custom:           { center: [15,   52  ], zoom: 4    },
};

// ─── Hlavní QuizMap ───────────────────────────────────────────────────────────
export function QuizMap({
  map, height = 400, quizMode = false, onAnswer, onCountryClick,
  historicalYear: historicalYearProp, onHistoricalYearChange,
}: QuizMapProps) {
  const [hoveredCountry,  setHoveredCountry]  = useState<string | null>(null);
  const [tooltip,         setTooltip]         = useState<TooltipState | null>(null);
  const [answeredCorrect, setAnsweredCorrect] = useState<Set<string>>(new Set());
  const [answeredWrong,   setAnsweredWrong]   = useState<Set<string>>(new Set());

  // Rok může být řízen zvenčí (prop) nebo lokálně (map.historicalYear)
  const [localYear, setLocalYear] = useState<string | undefined>(map.historicalYear);
  const activeYear = historicalYearProp !== undefined ? historicalYearProp : localYear;

  const handleYearChange = useCallback((year: string) => {
    setLocalYear(year);
    onHistoricalYearChange?.(year);
  }, [onHistoricalYearChange]);

  const handleYearClear = useCallback(() => {
    setLocalYear(undefined);
    onHistoricalYearChange?.(undefined);
  }, [onHistoricalYearChange]);

  const proj = REGION_PROJECTION[map.region] ?? REGION_PROJECTION.europe;

  // Progresivní upgrade: pro detailní regiony načti 10m hned po 50m (swap po načtení)
  const WORLD_TOPO_HQ = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-10m.json';
  const needHQ = proj.zoom >= 4; // europe, central-europe, italy, greece, france, germany, czech...
  const [hqReady, setHqReady] = useState(false);
  useEffect(() => {
    if (!needHQ) { setHqReady(false); return; }
    setHqReady(false);
    fetchGeo(WORLD_TOPO_HQ).then(() => setHqReady(true)).catch(() => {});
  }, [needHQ]);
  const activeWorldTopo = needHQ && hqReady ? WORLD_TOPO_HQ : WORLD_TOPO;

  const showRivers      = map.overlays?.showRivers      ?? false;
  const showLakes       = map.overlays?.showLakes       ?? false;
  const showOceans      = map.overlays?.showOceans      ?? false;
  const showCities      = map.overlays?.showCities      ?? false;
  const showPhysical    = map.overlays?.showPhysical    ?? false;
  const showClimate     = map.overlays?.showClimate     ?? false;
  const showBiomes      = map.overlays?.showBiomes      ?? false;
  const showTectonics   = map.overlays?.showTectonics   ?? false;
  const showVolcanoes   = map.overlays?.showVolcanoes   ?? false;
  const showEarthquakes = map.overlays?.showEarthquakes ?? false;
  const showTimezones   = map.overlays?.showTimezones   ?? false;
  const showAirports    = map.overlays?.showAirports    ?? false;
  const showRailroads   = map.overlays?.showRailroads   ?? false;
  const correctIds = useMemo(() => new Set(map.correctAnswers ?? []), [map.correctAnswers]);

  const choroplethColors = useMemo<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    (map.choropleth?.categories ?? []).forEach(cat =>
      (cat.isoCodes ?? []).forEach(iso => { m[iso.toUpperCase()] = cat.color; })
    );
    return m;
  }, [map.choropleth]);

  const highlightColors = useMemo<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    (map.highlights ?? []).forEach(h => { if (h.isoCode) m[h.isoCode.toUpperCase()] = h.color; });
    return m;
  }, [map.highlights]);

  const getCountryFill = useCallback((isoA3: string, isoN3: string) => {
    const key = isoA3.toUpperCase();
    if (answeredCorrect.has(isoN3)) return '#22c55e';
    if (answeredWrong.has(isoN3))   return '#ef4444';
    if (choroplethColors[key])       return choroplethColors[key];
    if (highlightColors[key])        return highlightColors[key];
    if (hoveredCountry === isoN3)    return '#c8b9a2';
    return '#eee8dc';
  }, [hoveredCountry, choroplethColors, highlightColors, answeredCorrect, answeredWrong]);

  // Tooltip helper
  const setHoverTooltip = useCallback((name: string | null, e: React.MouseEvent | null, sub?: string | null) => {
    if (!name || !e) { setTooltip(null); return; }
    const rect = (e.currentTarget as HTMLElement).closest('[data-quizmap]')?.getBoundingClientRect();
    const x = rect ? e.clientX - rect.left : (e.nativeEvent as MouseEvent).offsetX;
    const y = rect ? e.clientY - rect.top  : (e.nativeEvent as MouseEvent).offsetY;
    setTooltip({ x, y, name, sub: sub ?? undefined });
  }, []);

  const handleCountryClick = useCallback((isoN3: string, name: string) => {
    onCountryClick?.(isoN3, name);
    if (!quizMode || map.markers.length > 0) return;
    const isoA3  = Object.entries(A3_TO_N3).find(([, n3]) => n3 === isoN3)?.[0];
    const correct = isoA3 ? correctIds.has(isoA3) : false;
    if (correct) { setAnsweredCorrect(prev => new Set(prev).add(isoN3)); onAnswer?.(true, name); }
    else         { setAnsweredWrong(prev => new Set(prev).add(isoN3));   onAnswer?.(false, name); }
  }, [quizMode, map.markers, correctIds, onAnswer, onCountryClick]);

  const handleHistStateClick = useCallback((name: string) => {
    if (!quizMode) return;
    const correct = correctIds.has(name);
    if (correct) { setAnsweredCorrect(prev => new Set(prev).add(name)); onAnswer?.(true, name); }
    else         { setAnsweredWrong(prev => new Set(prev).add(name));   onAnswer?.(false, name); }
  }, [quizMode, correctIds, onAnswer]);

  const handleMarkerClick = useCallback((marker: MapMarker) => {
    if (!quizMode) return;
    const correct = correctIds.has(marker.id);
    if (correct) { setAnsweredCorrect(prev => new Set(prev).add(marker.id)); onAnswer?.(true, marker.name); }
    else         { setAnsweredWrong(prev => new Set(prev).add(marker.id));   onAnswer?.(false, marker.name); }
  }, [quizMode, correctIds, onAnswer]);

  const handleRiverClick  = useCallback((name: string) => {
    if (!quizMode) return;
    const correct = correctIds.has(name);
    if (correct) { setAnsweredCorrect(p => new Set(p).add(name)); onAnswer?.(true, name); }
    else         { setAnsweredWrong(p => new Set(p).add(name));   onAnswer?.(false, name); }
  }, [quizMode, correctIds, onAnswer]);

  const handleCityClick = useCallback((name: string) => {
    if (!quizMode) return;
    const correct = correctIds.has(name);
    if (correct) { setAnsweredCorrect(p => new Set(p).add(name)); onAnswer?.(true, name); }
    else         { setAnsweredWrong(p => new Set(p).add(name));   onAnswer?.(false, name); }
  }, [quizMode, correctIds, onAnswer]);

  const handleGenericClick = useCallback((name: string) => {
    if (!quizMode || !name) return;
    const correct = correctIds.has(name);
    if (correct) { setAnsweredCorrect(p => new Set(p).add(name)); onAnswer?.(true, name); }
    else         { setAnsweredWrong(p => new Set(p).add(name));   onAnswer?.(false, name); }
  }, [quizMode, correctIds, onAnswer]);

  // alias pro zpětnou kompatibilitu
  const handlePhysicalClick = handleGenericClick;

  // Výška mapy se zkrátí o year picker
  const pickerHeight = 72;
  const mapHeight    = activeYear !== undefined ? height - pickerHeight : height;

  return (
    <div data-quizmap="1"
      style={{ position: 'relative', height, width: '100%', background: '#c8dff0', borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}
    >
      {/* Název */}
      {map.title && (
        <div style={{
          position: 'absolute', top: 10, left: 10, zIndex: 10,
          fontSize: 13, fontWeight: 800, color: '#0f172a',
          background: 'rgba(255,255,255,0.92)', padding: '4px 12px',
          borderRadius: 8, boxShadow: '0 1px 8px rgba(0,0,0,0.1)',
          backdropFilter: 'blur(4px)', pointerEvents: 'none', maxWidth: '60%',
        }}>{map.title}</div>
      )}

      {/* Historický rok badge */}
      {activeYear && (
        <div style={{
          position: 'absolute', top: 10, right: 10, zIndex: 10,
          background: 'rgba(245,158,11,0.92)', padding: '3px 12px',
          borderRadius: 8, fontSize: 12, fontWeight: 800, color: '#1e293b',
          boxShadow: '0 1px 8px rgba(0,0,0,0.15)',
        }}>
          {histYearDisplay(activeYear)} {activeYear.startsWith('bc') ? 'př. n. l.' : 'n. l.'}
        </div>
      )}

      {/* Legenda vrstev */}
      {(showRivers || showCities || showPhysical || showOceans || showLakes ||
        showTectonics || showVolcanoes || showEarthquakes || showTimezones ||
        showAirports || showRailroads || showClimate || showBiomes) && (
        <div style={{ position: 'absolute', top: activeYear ? 46 : 10, right: 10, zIndex: 10, display: 'flex', gap: 4, flexDirection: 'column', alignItems: 'flex-end', pointerEvents: 'none' }}>
          {[
            showTimezones   && { icon: '🕐', text: 'Čas. zóny' },
            showClimate     && { icon: '🌡️', text: 'Klima (Köppen)' },
            showBiomes      && { icon: '🌿', text: 'Biomy' },
            showPhysical    && { icon: '🏔️', text: 'Reliéf', extra: [{ c:'#b8956a',l:'pohoří'},{c:'#a8c880',l:'nížiny'},{c:'#e8c87a',l:'pouště'}] },
            showOceans      && { icon: '🌊', text: 'Oceány/moře' },
            showLakes       && { icon: '💧', text: 'Jezera' },
            showRivers      && { icon: '〰️', text: 'Řeky' },
            showTectonics   && { icon: '🌍', text: 'Tek. desky' },
            showVolcanoes   && { icon: '🌋', text: 'Vulkány' },
            showEarthquakes && { icon: '📡', text: 'Zemětřesení', extra: [{c:'#7c0000',l:'M7.5+'},{c:'#dc2626',l:'M6.5+'},{c:'#f97316',l:'M5.5+'}] },
            showRailroads   && { icon: '🚂', text: 'Železnice' },
            showAirports    && { icon: '✈️', text: 'Letiště' },
            showCities      && { icon: '🏙️', text: 'Města' },
          ].filter(Boolean).map((item: any, i: number) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.88)', borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>{item.icon}</span> {item.text}
              {item.extra?.map((e: any, j: number) => (
                <span key={j} style={{ display:'flex', alignItems:'center', gap:2 }}>
                  <span style={{ display:'inline-block', width:10, height:8, borderRadius:2, background:e.c }} />{e.l}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Zadání */}
      {map.description && map.exerciseType !== 'info' && (
        <div style={{
          position: 'absolute', bottom: activeYear !== undefined ? pickerHeight + 8 : 12, left: 12, right: 12, zIndex: 10,
          background: 'rgba(255,255,255,0.95)', borderRadius: 10,
          padding: '8px 14px', fontSize: 12, fontWeight: 600, color: '#0f172a',
          boxShadow: '0 2px 12px rgba(0,0,0,0.12)', backdropFilter: 'blur(4px)',
          pointerEvents: 'none',
        }}>{map.description}</div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'absolute', left: tooltip.x + 14, top: tooltip.y - 10, zIndex: 20,
          background: 'rgba(15,23,42,0.88)', color: '#f8fafc',
          padding: '5px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700,
          pointerEvents: 'none', whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        }}>
          {tooltip.name}
          {tooltip.sub && <span style={{ fontSize: 10, fontWeight: 400, color: '#94a3b8', marginLeft: 6 }}>{tooltip.sub}</span>}
        </div>
      )}

      {/* Mapa */}
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center: proj.center, scale: 800 / proj.zoom * proj.zoom }}
        style={{ width: '100%', height: mapHeight }}
        width={800}
        height={mapHeight}
      >
        <ZoomableGroup center={proj.center} zoom={proj.zoom} maxZoom={20}>

          {/* 1. Časové zóny (nejspodnější polygon vrstva) */}
          {showTimezones && (
            <TimeZonesLayer
              quizMode={quizMode} correctIds={correctIds}
              answeredCorrect={answeredCorrect} answeredWrong={answeredWrong}
              onTzClick={handleGenericClick}
              onHover={(name, sub, e) => setHoverTooltip(name, e, sub)}
            />
          )}

          {/* 2. Biomy */}
          {showBiomes && (
            <BiomesLayer
              quizMode={quizMode} correctIds={correctIds}
              answeredCorrect={answeredCorrect} answeredWrong={answeredWrong}
              onBiomeClick={handleGenericClick}
              onHover={(name, sub, e) => setHoverTooltip(name, e, sub)}
            />
          )}

          {/* 3. Klimatické pásy */}
          {showClimate && (
            <ClimateLayer
              quizMode={quizMode} correctIds={correctIds}
              answeredCorrect={answeredCorrect} answeredWrong={answeredWrong}
              onZoneClick={handleGenericClick}
              onHover={(name, sub, e) => setHoverTooltip(name, e, sub)}
            />
          )}

          {/* Historické státy (nahrazují moderní) */}
          {activeYear ? (
            <HistoricalLayer
              year={activeYear}
              quizMode={quizMode}
              correctIds={correctIds}
              answeredCorrect={answeredCorrect}
              answeredWrong={answeredWrong}
              onStateClick={handleHistStateClick}
              onHover={(name, sub, e) => setHoverTooltip(name, e, sub)}
            />
          ) : (
            /* Moderní státy */
            <Geographies geography={activeWorldTopo}>
              {({ geographies }) =>
                geographies.map(geo => {
                  const isoN3 = geo.id as string;
                  const isoA3 = Object.entries(A3_TO_N3).find(([, n]) => n === isoN3)?.[0] ?? '';
                  const name  = geo.properties?.name ?? '';
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={getCountryFill(isoA3, isoN3)}
                      stroke="#b5a898"
                      strokeWidth={0.4}
                      style={{
                        default: { outline: 'none', cursor: 'default' },
                        hover:   { outline: 'none', cursor: quizMode ? 'pointer' : 'default' },
                        pressed: { outline: 'none' },
                      }}
                      onMouseEnter={(e: React.MouseEvent) => { setHoveredCountry(isoN3); setHoverTooltip(toCzechName(name), e); }}
                      onMouseMove={(e: React.MouseEvent)  => setHoverTooltip(toCzechName(name), e)}
                      onMouseLeave={() => { setHoveredCountry(null); setTooltip(null); }}
                      onClick={() => handleCountryClick(isoN3, name)}
                    />
                  );
                })
              }
            </Geographies>
          )}

          {/* Fyzickogeografické regiony (pohoří, nížiny, pouště…) */}
          {showPhysical && (
            <PhysicalRegionsLayer
              quizMode={quizMode} correctIds={correctIds}
              answeredCorrect={answeredCorrect} answeredWrong={answeredWrong}
              onRegionClick={handlePhysicalClick}
              onHover={(name, sub, e) => setHoverTooltip(name, e, sub)}
            />
          )}

          {/* Oceány a moře */}
          {showOceans && (
            <OceansLayer
              quizMode={quizMode} correctIds={correctIds}
              answeredCorrect={answeredCorrect} answeredWrong={answeredWrong}
              onRegionClick={handlePhysicalClick}
              onHover={(name, sub, e) => setHoverTooltip(name, e, sub)}
            />
          )}

          {/* Jezera */}
          {showLakes && (
            <LakesLayer
              quizMode={quizMode} correctIds={correctIds}
              answeredCorrect={answeredCorrect} answeredWrong={answeredWrong}
              onLakeClick={handleGenericClick}
              onHover={(name, e) => setHoverTooltip(name, e, 'jezero')}
            />
          )}

          {/* Tektonické desky (obrysy) */}
          {showTectonics && (
            <TectonicPlatesLayer
              quizMode={quizMode} correctIds={correctIds}
              answeredCorrect={answeredCorrect} answeredWrong={answeredWrong}
              onPlateClick={handleGenericClick}
              onHover={(name, e) => setHoverTooltip(name, e, 'tek. deska')}
            />
          )}

          {/* Řeky */}
          {showRivers && (
            <RiversLayer
              region={map.region} quizMode={quizMode} correctIds={correctIds}
              answeredCorrect={answeredCorrect} answeredWrong={answeredWrong}
              onRiverClick={handleRiverClick}
              onHover={(name, e) => setHoverTooltip(name, e, 'řeka')}
            />
          )}

          {/* Železnice */}
          {showRailroads && (
            <RailroadsLayer
              quizMode={quizMode} correctIds={correctIds}
              answeredCorrect={answeredCorrect} answeredWrong={answeredWrong}
              onRailClick={handleGenericClick}
              onHover={(name, e) => setHoverTooltip(name, e, 'železnice')}
            />
          )}

          {/* Letiště */}
          {showAirports && (
            <AirportsLayer
              quizMode={quizMode} correctIds={correctIds}
              answeredCorrect={answeredCorrect} answeredWrong={answeredWrong}
              onAirportClick={handleGenericClick}
              onHover={(name, sub, e) => setHoverTooltip(name, e, sub)}
            />
          )}

          {/* Vulkány */}
          {showVolcanoes && (
            <VolcanoesLayer
              quizMode={quizMode} correctIds={correctIds}
              answeredCorrect={answeredCorrect} answeredWrong={answeredWrong}
              onVolcanoClick={handleGenericClick}
              onHover={(name, sub, e) => setHoverTooltip(name, e, sub)}
            />
          )}

          {/* Zemětřesení */}
          {showEarthquakes && (
            <EarthquakesLayer
              quizMode={quizMode} correctIds={correctIds}
              answeredCorrect={answeredCorrect} answeredWrong={answeredWrong}
              onEqClick={handleGenericClick}
              onHover={(name, sub, e) => setHoverTooltip(name, e, sub)}
            />
          )}

          {/* Města */}
          {showCities && (
            <CitiesLayer
              region={map.region} quizMode={quizMode} correctIds={correctIds}
              answeredCorrect={answeredCorrect} answeredWrong={answeredWrong}
              onCityClick={handleCityClick}
              onHover={(name, sub, e) => setHoverTooltip(name, e, sub)}
            />
          )}

          {/* Vlastní markery */}
          {(map.markers ?? []).map(marker => {
            const isCorrect   = answeredCorrect.has(marker.id);
            const isWrong     = answeredWrong.has(marker.id);
            const markerColor = isCorrect ? '#22c55e' : isWrong ? '#ef4444' : (marker.color ?? '#6366f1');
            const icon        = marker.icon ?? MARKER_ICONS[marker.type] ?? '📍';
            return (
              <Marker key={marker.id} coordinates={[marker.lng, marker.lat]} onClick={() => handleMarkerClick(marker)}>
                <g
                  style={{ cursor: quizMode ? 'pointer' : 'default' }}
                  onMouseEnter={e => setHoverTooltip(marker.name, e, marker.description)}
                  onMouseMove={e  => setHoverTooltip(marker.name, e, marker.description)}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <circle r={10} fill={markerColor} fillOpacity={0.9} stroke="white" strokeWidth={1.5} />
                  <text textAnchor="middle" dominantBaseline="central"
                    style={{ fontSize: 10, userSelect: 'none', pointerEvents: 'none' }}>
                    {isCorrect ? '✓' : isWrong ? '✗' : icon}
                  </text>
                  {marker.name && !quizMode && (
                    <text y={16} textAnchor="middle"
                      style={{ fontSize: 7, fill: '#1e293b', fontWeight: 700,
                        textShadow: '0 0 3px white, 0 0 3px white',
                        userSelect: 'none', pointerEvents: 'none' }}>
                      {marker.name}
                    </text>
                  )}
                </g>
              </Marker>
            );
          })}

        </ZoomableGroup>
      </ComposableMap>

      {/* Year picker — vždy viditelný pod mapou */}
      <YearPicker
        selected={activeYear}
        onChange={handleYearChange}
        onClear={handleYearClear}
      />
    </div>
  );
}

export default QuizMap;
