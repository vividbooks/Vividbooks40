#!/usr/bin/env node
/**
 * WWF Ecoregions → Supabase Storage
 *
 * Co dělá:
 *   1. Stáhne WWF TEOW shapefile (150 MB)
 *   2. Převede na GeoJSON přes mapshaper (zjednodušení na 5 %)
 *   3. Nahraje do Supabase Storage jako geodata/wwf-ecoregions.geojson
 *
 * Použití (spusť MIMO sandbox, přímo v terminálu):
 *   npm install -g mapshaper       # jen jednou
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=xxx node scripts/prepare-ecoregions.mjs
 *
 * Klíče najdeš v Supabase Dashboard → Settings → API
 *   – SUPABASE_URL     = Project URL
 *   – SUPABASE_SERVICE_KEY = service_role key (ne anon!)
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP = join(__dirname, '../.tmp-ecoregions');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = 'geodata';
const OUTPUT_PATH = 'wwf-ecoregions.geojson';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Nastav env proměnné SUPABASE_URL a SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function run(cmd) {
  console.log(`▶ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: TMP });
}

function download(url, dest) {
  console.log(`  Stahuji pomocí curl (sleduje přesměrování)...`);
  execSync(`curl -L --progress-bar -o "${dest}" "${url}"`, { stdio: 'inherit', cwd: TMP });
  return Promise.resolve();
}

async function uploadToSupabase(filePath) {
  const content = readFileSync(filePath);
  const size = (content.length / 1024 / 1024).toFixed(1);
  console.log(`\n📤 Nahrávám ${size} MB do Supabase Storage: ${BUCKET}/${OUTPUT_PATH}`);

  // Nejprve vytvoř bucket pokud neexistuje
  const createBucketRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });
  if (!createBucketRes.ok && createBucketRes.status !== 409) {
    const err = await createBucketRes.text();
    if (!err.includes('already exists')) console.warn('  ⚠ Bucket:', err);
  }

  // Upload souboru
  const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${OUTPUT_PATH}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/geo+json',
      'x-upsert': 'true',
    },
    body: content,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Upload selhal: ${err}`);
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${OUTPUT_PATH}`;
  console.log(`✅ Hotovo! Veřejná URL:\n   ${publicUrl}`);
  return publicUrl;
}

// ── Main ─────────────────────────────────────────────────────────────────────

mkdirSync(TMP, { recursive: true });

const ZIP = join(TMP, 'teow.zip');
const SHP = join(TMP, 'wwf_terr_ecos.shp');
const GEOJSON = join(TMP, OUTPUT_PATH);

// 1. Stáhni shapefile
if (!existsSync(ZIP)) {
  console.log('📥 Stahuji WWF TEOW shapefile (~150 MB)...');
  await download(
    'https://files.worldwildlife.org/wwfcmsprod/files/Publication/file/6kcchn7e3u_official_teow.zip',
    ZIP
  );
} else {
  console.log('✓ ZIP již stažen');
}

// 2. Rozbal
if (!existsSync(SHP)) {
  console.log('\n📦 Rozbaluji ZIP...');
  run(`unzip -o teow.zip`);
}

// 3. Najdi .shp soubor (může být ve složce)
let shpFile = SHP;
if (!existsSync(SHP)) {
  const found = execSync('find . -name "*.shp" | head -1', { cwd: TMP }).toString().trim();
  if (!found) { console.error('❌ .shp soubor nenalezen'); process.exit(1); }
  shpFile = join(TMP, found.replace(/^\.\//, ''));
  console.log(`  Nalezen: ${shpFile}`);
}

// 4. Konverze přes mapshaper
if (!existsSync(GEOJSON)) {
  console.log('\n🗜  Konvertuji shapefile → GeoJSON (zjednodušení 5 %)...');
  // Zachováme jen důležité properties: ECO_NAME, BIOME_NAME, BIOME_NUM, REALM
  run(
    `mapshaper "${shpFile}" ` +
    `-simplify 5% keep-shapes ` +
    `-filter-fields ECO_NAME,REALM,BIOME,eco_code ` +
    `-o format=geojson "${GEOJSON}"`
  );
  const sizeMB = (fs.statSync(GEOJSON).size / 1024 / 1024).toFixed(1);
  console.log(`  → ${GEOJSON} (${sizeMB} MB)`);
} else {
  console.log('✓ GeoJSON již existuje');
}

// 5. Upload do Supabase
const url = await uploadToSupabase(GEOJSON);

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ HOTOVO

Přidej tuto URL do VividMap.tsx:

  'wwf_ecoregions': '${url}',

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
