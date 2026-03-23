/**
 * scan-base64.mjs
 *
 * Rychlý read-only scan — zjistí kolik řádků v DB obsahuje base64.
 * Nic nemazá, pouze hlásí počty.
 *
 * Použití:
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/scan-base64.mjs
 */

const SUPABASE_URL = 'https://njbtqmsxbyvpwigfceke.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_KEY) {
  console.error('❌ Chybí SUPABASE_SERVICE_ROLE_KEY!')
  console.error('   Spusť: SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/scan-base64.mjs')
  process.exit(1)
}

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'apikey': SERVICE_KEY,
}

// Patterns detekované jako base64
const BASE64_PATTERNS = [
  'data:image',
  'data:application',
  'data:video',
  '/9j/4',          // JPEG raw
  'iVBORw0KGgo',   // PNG raw
  'R0lGOD',         // GIF raw
]

async function runSql(query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
  }).catch(() => null)

  // Supabase REST nemá přímý SQL endpoint bez RPC — použijeme PostgREST LIKE filter
  return null
}

async function countBase64InTable(table, column) {
  // Sestavíme OR podmínku přes LIKE pro každý pattern
  const likeFilters = BASE64_PATTERNS.map(p =>
    `${column}=like.*${encodeURIComponent(p)}*`
  ).join(',')

  // Použijeme PostgREST s text cast a ilike
  const orFilter = BASE64_PATTERNS.map(p => `${column}.ilike.*${p}*`).join(',')

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=id&or=(${orFilter})`,
    { method: 'HEAD', headers: { ...headers, 'Prefer': 'count=exact' } }
  )

  if (!res.ok) {
    // Fallback — JSONB column nemůže být přímo filtrována jako text přes REST
    return await countBase64ViaRpc(table, column)
  }

  const count = res.headers.get('content-range')
  // content-range: 0-24/1234
  const match = count?.match(/\/(\d+)$/)
  return match ? parseInt(match[1]) : null
}

async function countBase64ViaRpc(table, column) {
  // Přímý SQL přes supabase-js není možný bez edge function,
  // místo toho načteme sample a zkontrolujeme ručně
  let total = 0
  let from = 0
  const pageSize = 1000

  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?select=id,${column}&limit=${pageSize}&offset=${from}`,
      { headers: { ...headers, 'Prefer': 'count=exact' } }
    )

    if (!res.ok) {
      console.error(`  ❌ Chyba při čtení ${table}: ${res.status}`)
      return null
    }

    const rows = await res.json()
    if (!rows || rows.length === 0) break

    for (const row of rows) {
      const text = JSON.stringify(row[column] ?? '')
      if (BASE64_PATTERNS.some(p => text.includes(p))) {
        total++
      }
    }

    if (rows.length < pageSize) break
    from += pageSize
    process.stdout.write(`  ... scanuji stránku ${Math.floor(from / pageSize) + 1} (${from} řádků)\r`)
  }

  return total
}

async function scanTable(table, column) {
  console.log(`\n🔍 Skenuji: ${table}.${column}`)
  const count = await countBase64ViaRpc(table, column)
  if (count === null) {
    console.log(`  ⚠️  Nepodařilo se načíst`)
  } else if (count === 0) {
    console.log(`  ✅ Čistá! Žádný base64 nalezen.`)
  } else {
    console.log(`  🚨 NALEZENO ${count} řádků s base64!`)
  }
  return count ?? 0
}

async function main() {
  console.log('🔎 BASE64 SCAN — read-only, nic se nemění')
  console.log(`   Databáze: ${SUPABASE_URL}`)
  console.log(`   Datum: ${new Date().toLocaleString('cs-CZ')}`)

  const tables = [
    { table: 'teacher_worksheets', column: 'content' },
    { table: 'teacher_boards',     column: 'slides'  },
    { table: 'topic_data_sets',    column: 'media'   },
  ]

  let totalDirty = 0
  const results = []

  for (const { table, column } of tables) {
    const count = await scanTable(table, column)
    totalDirty += count
    results.push({ table, column, count })
  }

  console.log('\n' + '─'.repeat(50))
  console.log('📊 VÝSLEDKY:')
  for (const r of results) {
    const icon = r.count === 0 ? '✅' : '🚨'
    console.log(`  ${icon} ${r.table}.${r.column}: ${r.count} řádků s base64`)
  }
  console.log('─'.repeat(50))

  if (totalDirty === 0) {
    console.log('\n✅ Databáze je čistá! Žádný base64 nenalezen.')
  } else {
    console.log(`\n🚨 Celkem ${totalDirty} řádků obsahuje base64!`)
    console.log('   Spusť purge: SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/run-purge-base64.mjs')
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
