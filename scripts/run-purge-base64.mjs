/**
 * run-purge-base64.mjs
 * 
 * Spustí Edge Function purge-base64 opakovaně dokud nevyčistí všechny tabulky.
 * 
 * Použití:
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/run-purge-base64.mjs
 * 
 * Service Role Key najdeš v:
 *   Supabase Dashboard → Settings → API → service_role (secret)
 */

const SUPABASE_URL = 'https://njbtqmsxbyvpwigfceke.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_KEY) {
  console.error('❌ Chybí SUPABASE_SERVICE_ROLE_KEY!')
  console.error('   Spusť: SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/run-purge-base64.mjs')
  process.exit(1)
}

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/purge-base64`
const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SERVICE_KEY}`,
}

const TABLES = ['teacher_boards']
const BATCH = 20
const MAX_ITERATIONS = 1000
const DELAY_MS = 100

async function callPurge(table, afterId = null) {
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ table, batch: BATCH, after_id: afterId }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return await res.json()
}

async function purgeTable(table) {
  console.log(`\n🔥 Čistím: ${table}`)
  let totalCleaned = 0
  let iter = 0
  let afterId = null

  while (iter < MAX_ITERATIONS) {
    iter++
    try {
      const result = await callPurge(table, afterId)
      totalCleaned += result.processed || 0
      process.stdout.write(`  [${iter}] ${result.message} | celkem: ${totalCleaned} | cursor: ${result.next_id?.slice(0,8) ?? 'end'}\n`)

      if (result.done) {
        console.log(`  ✅ ${table} — hotovo! Celkem vyčištěno: ${totalCleaned} řádků`)
        break
      }

      afterId = result.next_id
      await new Promise(r => setTimeout(r, DELAY_MS))
    } catch (err) {
      console.error(`\n  ❌ Chyba při ${table} [iter ${iter}]:`, err.message)
      await new Promise(r => setTimeout(r, 2000))
    }
  }

  if (iter >= MAX_ITERATIONS) {
    console.warn(`\n  ⚠️ ${table}: dosažen MAX_ITERATIONS (${MAX_ITERATIONS}), možná zbývají další`)
  }
}

async function main() {
  console.log('🚀 Spouštím purge-base64...')
  console.log(`   URL: ${FUNCTION_URL}`)
  console.log(`   Batch: ${BATCH} řádků / volání`)
  console.log(`   Max iterations: ${MAX_ITERATIONS}`)

  for (const table of TABLES) {
    await purgeTable(table)
  }

  console.log('\n🎉 Hotovo! Všechny tabulky vyčištěny.')
  console.log('   Spusť VACUUM v Supabase SQL editoru:')
  console.log('   VACUUM (VERBOSE, ANALYZE) teacher_boards;')
  console.log('   VACUUM (VERBOSE, ANALYZE) teacher_worksheets;')
  console.log('   VACUUM (VERBOSE, ANALYZE) topic_data_sets;')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
