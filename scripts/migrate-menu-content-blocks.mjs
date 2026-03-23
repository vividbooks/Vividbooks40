/**
 * migrate-menu-content-blocks.mjs
 *
 * Reorganizuje admin knihovnu z:
 *   Ročník → Téma → Materiály
 * na:
 *   Ročník → Obsahový blok → Dataset (téma) → Materiály
 *
 * "Obsahový blok" = rvp.thematicArea z topic_data_sets (např. "Starověk", "Evropa - přírodní podmínky")
 *
 * Použití:
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/migrate-menu-content-blocks.mjs
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/migrate-menu-content-blocks.mjs dejepis
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/migrate-menu-content-blocks.mjs dejepis --dry-run
 *
 * Parametry:
 *   [subject]   – volitelně filtruje jen jeden předmět (např. "dejepis")
 *   --dry-run   – jen ukáže co by se změnilo, nic neuloží
 *
 * Service Role Key najdeš v:
 *   Supabase Dashboard → Settings → API → service_role (secret)
 */

const SUPABASE_URL = 'https://njbtqmsxbyvpwigfceke.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_KEY) {
  console.error('❌ Chybí SUPABASE_SERVICE_ROLE_KEY!')
  console.error('   Spusť: SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/migrate-menu-content-blocks.mjs')
  process.exit(1)
}

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const SUBJECT_FILTER = args.find(a => !a.startsWith('--'))

// Všechny předměty (= kategorie menu)
const ALL_SUBJECTS = [
  'dejepis', 'zemepis', 'cestina', 'anglictina', 'nemcina', 'francouzstina',
  'matematika', 'prirodopis', 'fyzika', 'chemie',
  'cestina_1st', 'matematika_1st', 'anglictina_1st',
  'prvouka', 'prirodoveda', 'vlastiveda',
  'hudebni_vychova', 'vytvarna_vychova', 'telesna_vychova', 'pracovni_cinnosti',
]

const SUBJECTS = SUBJECT_FILTER ? [SUBJECT_FILTER] : ALL_SUBJECTS

const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'apikey': SERVICE_KEY,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchMenu(category) {
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/make-server-46c8107b/menu?category=${category}`,
    { headers: HEADERS },
  )
  if (!res.ok) {
    if (res.status === 404) return []
    throw new Error(`Menu fetch failed (${res.status}): ${await res.text()}`)
  }
  const data = await res.json()
  return data.menu || []
}

async function saveMenu(category, menu) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/make-server-46c8107b/menu`, {
    method: 'PUT',
    headers: HEADERS,
    body: JSON.stringify({ menu, category }),
  })
  if (!res.ok) {
    throw new Error(`Menu save failed (${res.status}): ${await res.text()}`)
  }
}

/** Načte všechny datasety pro daný předmět a vrátí mapu topic → thematicArea */
async function fetchTopicToBlockMap(subject) {
  const url = `${SUPABASE_URL}/rest/v1/topic_data_sets?subject_code=eq.${subject}&select=id,topic,rvp,milestone`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`DB fetch failed (${res.status}): ${await res.text()}`)
  const rows = await res.json()

  /** @type {Map<string, string>} topic → thematicArea */
  const map = new Map()
  for (const row of rows) {
    if (!row.topic) continue
    const area = row.rvp?.thematicArea
    if (area) map.set(row.topic, area)
  }
  return map
}

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ─── Core migration logic ─────────────────────────────────────────────────────

/**
 * Rozhodne, jestli je daná složka "přímý téma-folder" (stará struktura)
 * nebo "obsahový blok" (nová struktura) nebo jiný typ.
 *
 * Přímý téma-folder = složka, jejíž children jsou přímo materiály (ne složky).
 * Obsahový blok     = složka, jejíž children jsou složky (= datasety).
 */
function classifyFolder(folder) {
  const children = folder.children || []
  if (children.length === 0) return 'empty'
  const hasSubFolders = children.some(c => c.type === 'folder')
  const hasMaterials = children.some(c => c.type !== 'folder')
  if (hasSubFolders && !hasMaterials) return 'block' // nová struktura – obsahový blok
  if (!hasSubFolders && hasMaterials) return 'topic' // stará struktura – přímé materiály
  if (hasSubFolders && hasMaterials) return 'mixed'  // mix (nejisté)
  return 'empty'
}

/**
 * Zmigruje children jedné grade složky.
 * Vrátí { changed, newChildren, stats }.
 */
function migrateGradeChildren(gradeChildren, topicToBlockMap, gradeName) {
  const stats = { moved: 0, skipped: 0, unknown: 0 }
  
  // Zachovej složky, které jsou už "obsahové bloky" (mají sub-složky)
  // a přesuň "přímé téma-složky" pod příslušný blok.

  /** @type {Map<string, any>} blockName → blockFolder */
  const blockFolders = new Map()
  /** @type {any[]} složky, které je potřeba zmigrovat */
  const topicFolders = []
  /** @type {any[]} ostatní položky (materiály přímo na grade úrovni – neobvyklé) */
  const directMaterials = []

  for (const child of gradeChildren) {
    if (child.type !== 'folder') {
      directMaterials.push(child)
      continue
    }

    const kind = classifyFolder(child)

    if (kind === 'block') {
      // Už je to obsahový blok – zachovej
      blockFolders.set(child.label, child)
    } else if (kind === 'topic' || kind === 'mixed' || kind === 'empty') {
      // Stará struktura nebo prázdná – přesunout pod blok
      topicFolders.push(child)
    }
  }

  let changed = false

  for (const topicFolder of topicFolders) {
    const blockName = topicToBlockMap.get(topicFolder.label) || null

    if (!blockName) {
      console.log(`    ⚠️  Neznámý obsahový blok pro téma "${topicFolder.label}" – zůstane na místě jako "Ostatní"`)
      stats.unknown++

      // Přesun do "Ostatní" bloku
      const fallbackName = 'Ostatní'
      if (!blockFolders.has(fallbackName)) {
        blockFolders.set(fallbackName, {
          id: `folder-migrated-ostatni-${Date.now()}`,
          label: fallbackName,
          slug: 'ostatni',
          type: 'folder',
          icon: 'folder',
          children: [],
        })
      }
      blockFolders.get(fallbackName).children.push(topicFolder)
      changed = true
      continue
    }

    if (!blockFolders.has(blockName)) {
      blockFolders.set(blockName, {
        id: `folder-migrated-${slugify(blockName)}-${Date.now()}`,
        label: blockName,
        slug: slugify(blockName),
        type: 'folder',
        icon: 'folder',
        children: [],
      })
    }

    // Zkontroluj, jestli tam stejný dataset (podle labelu) už není
    const block = blockFolders.get(blockName)
    const alreadyThere = (block.children || []).some(c => c.label === topicFolder.label)
    if (!alreadyThere) {
      block.children = block.children || []
      block.children.push(topicFolder)
      console.log(`    ✅ "${topicFolder.label}" → "${blockName}"`)
      stats.moved++
      changed = true
    } else {
      console.log(`    ⏭  "${topicFolder.label}" → "${blockName}" (již existuje, přeskakuji)`)
      stats.skipped++
    }
  }

  const newChildren = [
    ...blockFolders.values(),
    ...directMaterials,
  ]

  return { changed, newChildren, stats }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function migrateSubject(subject) {
  console.log(`\n📚 Předmět: ${subject}`)

  let menu
  try {
    menu = await fetchMenu(subject)
  } catch (err) {
    console.log(`  ⚠️  Nelze načíst menu: ${err.message}`)
    return { moved: 0, skipped: 0, unknown: 0 }
  }

  if (menu.length === 0) {
    console.log('  ⏭  Prázdné menu, přeskakuji')
    return { moved: 0, skipped: 0, unknown: 0 }
  }

  const topicToBlockMap = await fetchTopicToBlockMap(subject)
  console.log(`  📊 Datasety s thematicArea: ${topicToBlockMap.size}`)

  let totalStats = { moved: 0, skipped: 0, unknown: 0 }
  let menuChanged = false

  for (const gradeFolder of menu) {
    if (gradeFolder.type !== 'folder') continue

    const gradeName = gradeFolder.label
    const children = gradeFolder.children || []

    // Zkontroluj, jestli grade folder obsahuje přímé téma-složky (stará struktura)
    const hasDirectTopics = children.some(c => {
      if (c.type !== 'folder') return false
      return classifyFolder(c) === 'topic' || classifyFolder(c) === 'mixed'
    })

    if (!hasDirectTopics) {
      console.log(`  📁 ${gradeName} – již migrováno nebo prázdné`)
      continue
    }

    console.log(`  📁 ${gradeName} – migruji...`)
    const { changed, newChildren, stats } = migrateGradeChildren(children, topicToBlockMap, gradeName)

    if (changed) {
      gradeFolder.children = newChildren
      menuChanged = true
    }

    totalStats.moved += stats.moved
    totalStats.skipped += stats.skipped
    totalStats.unknown += stats.unknown
  }

  if (!menuChanged) {
    console.log('  ✅ Žádné změny potřeba')
    return totalStats
  }

  if (DRY_RUN) {
    console.log(`  🔍 DRY-RUN: Přesunuto ${totalStats.moved} témat (neuloženo)`)
    console.log('  Nová struktura menu (první ročník):')
    const firstGrade = menu.find(f => f.type === 'folder')
    if (firstGrade) {
      for (const block of (firstGrade.children || [])) {
        console.log(`    📁 ${block.label}`)
        for (const topic of (block.children || [])) {
          console.log(`      📂 ${topic.label} (${(topic.children || []).length} materiálů)`)
        }
      }
    }
  } else {
    await saveMenu(subject, menu)
    console.log(`  💾 Uloženo – přesunuto ${totalStats.moved} témat`)
  }

  return totalStats
}

async function main() {
  console.log('🚀 Migrace menu: Ročník → Obsahový blok → Dataset → Materiály')
  if (DRY_RUN) console.log('   MODE: DRY-RUN (nic se neuloží)')
  console.log(`   Předměty: ${SUBJECTS.join(', ')}`)
  console.log(`   Supabase: ${SUPABASE_URL}`)

  let total = { moved: 0, skipped: 0, unknown: 0 }

  for (const subject of SUBJECTS) {
    const stats = await migrateSubject(subject)
    total.moved += stats.moved
    total.skipped += stats.skipped
    total.unknown += stats.unknown
  }

  console.log('\n' + '─'.repeat(60))
  console.log(`🎉 Hotovo!`)
  console.log(`   Přesunuto témat:  ${total.moved}`)
  console.log(`   Přeskočeno:       ${total.skipped} (již v nové struktuře)`)
  console.log(`   Neznámý blok:     ${total.unknown} (přesunuto do "Ostatní")`)
  if (DRY_RUN) {
    console.log('\n   Pro skutečné uložení spusť bez --dry-run')
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
