/**
 * Figma OAuth Edge Function
 *
 * Akce (query param ?action=...):
 *   auth-url        → vrátí Figma OAuth URL pro přihlášení
 *   callback        → vymění auth code za access token, uloží do DB
 *   token-status    → vrátí info o stavu tokenu pro daného uživatele
 *   create-frame    → vytvoří nový frame ve Figma souboru
 *   open-url        → vrátí Figma URL pro otevření konkrétního frame
 *   sync-svg        → stáhne SVG z Figmy, uloží do Supabase Storage
 *
 * Secrets (nastavit přes: supabase secrets set FIGMA_CLIENT_ID=... atd.):
 *   FIGMA_CLIENT_ID
 *   FIGMA_CLIENT_SECRET
 *   FIGMA_REDIRECT_URI   (např. https://<project>.supabase.co/functions/v1/figma-oauth?action=callback)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FIGMA_CLIENT_ID = Deno.env.get('FIGMA_CLIENT_ID') ?? ''
const FIGMA_CLIENT_SECRET = Deno.env.get('FIGMA_CLIENT_SECRET') ?? ''
const FIGMA_REDIRECT_URI = Deno.env.get('FIGMA_REDIRECT_URI') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// ——— helpers ———

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function err(msg: string, status = 400) {
  return json({ error: msg }, status)
}

/** Stáhne access token uloženého uživatele z DB */
async function getStoredToken(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await supabase
    .from('figma_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .single()
  if (error) return null
  return data
}

/** Uloží / aktualizuje token v DB */
async function upsertToken(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
) {
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
  await supabase.from('figma_tokens').upsert(
    { user_id: userId, access_token: accessToken, refresh_token: refreshToken, expires_at: expiresAt },
    { onConflict: 'user_id' },
  )
}

// ——— main handler ———

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  // If Figma redirected back with ?code=..., treat as callback (Figma doesn't allow query params in redirect URI)
  const code = url.searchParams.get('code')
  const action = code && url.searchParams.get('state') ? 'callback' : (url.searchParams.get('action') ?? '')

  // Supabase admin client (pro operace s DB / Storage)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Získáme user_id z Authorization hlavičky (JWT Bearer token)
  async function getUserId(): Promise<string | null> {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) return null
    const { data } = await supabase.auth.getUser(token)
    return data?.user?.id ?? null
  }

  // ——————————————————————————————————————————
  // 1. AUTH-URL  →  vrátí OAuth URL pro frontend
  // ——————————————————————————————————————————
  if (action === 'auth-url') {
    if (!FIGMA_CLIENT_ID || !FIGMA_REDIRECT_URI) {
      return err('Figma OAuth není nakonfigurováno (chybí FIGMA_CLIENT_ID nebo FIGMA_REDIRECT_URI)')
    }
    // Embed user_id in state so callback can identify who is authenticating
    const userId = await getUserId()
    const state = `${crypto.randomUUID()}__${userId ?? 'anon'}`
    const scopes = [
      'current_user:read',
      'file_content:read',
      'file_metadata:read',
      'file_versions:read',
      'file_dev_resources:read',
      'file_comments:read',
      'projects:read',
      'library_assets:read',
      'library_content:read',
      'team_library_content:read',
    ].join(',')

    const oauthUrl =
      `https://www.figma.com/oauth?client_id=${FIGMA_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(FIGMA_REDIRECT_URI)}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&state=${state}` +
      `&response_type=code`
    return json({ url: oauthUrl, state })
  }

  // ——————————————————————————————————————————
  // 2. CALLBACK  →  vymění code za token a uloží do DB
  //    Figma přesměruje sem: ?code=...&state=...  (bez action param)
  // ——————————————————————————————————————————
  if (action === 'callback') {
    if (!code) return err('Chybí code')
    // Extract user_id from state (format: "uuid__userId")
    const stateParam = url.searchParams.get('state') ?? ''
    const userIdFromState = stateParam.includes('__') ? stateParam.split('__')[1] : null

    // Vyměnit code za access_token
    const tokenRes = await fetch('https://api.figma.com/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: FIGMA_CLIENT_ID,
        client_secret: FIGMA_CLIENT_SECRET,
        redirect_uri: FIGMA_REDIRECT_URI,
        code,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      const text = await tokenRes.text()
      return err(`Figma token error: ${text}`)
    }

    const tokenData = await tokenRes.json() as {
      access_token: string
      refresh_token: string
      expires_in: number
      user_id?: string
    }

    const uid = userIdFromState ?? tokenData.user_id ?? 'unknown'
    await upsertToken(supabase, uid, tokenData.access_token, tokenData.refresh_token, tokenData.expires_in)

    // Vrátíme HTML stránku, která zavře popup a pošle zprávu parent oknu
    return new Response(
      `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Figma propojeno</title></head>
<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:#4ade80;">
  <script>
    window.opener?.postMessage({ type: 'FIGMA_AUTH_SUCCESS' }, '*');
    setTimeout(() => window.close(), 1500);
  </script>
  <div style="text-align:center;">
    <div style="font-size:48px;margin-bottom:16px;">✅</div>
    <h2 style="margin:0 0 8px">Figma propojeno!</h2>
    <p style="color:#94a3b8;margin:0">Toto okno se automaticky zavře...</p>
  </div>
</body>
</html>`,
      { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }

  // ——————————————————————————————————————————
  // Zbývající akce vyžadují přihlášeného uživatele
  // ——————————————————————————————————————————
  const userId = await getUserId()
  if (!userId) return err('Neautorizováno', 401)

  // ——————————————————————————————————————————
  // 3. TOKEN-STATUS
  // ——————————————————————————————————————————
  if (action === 'token-status') {
    const stored = await getStoredToken(supabase, userId)
    if (!stored) return json({ connected: false })
    const expired = new Date(stored.expires_at) < new Date()
    return json({ connected: true, expired, expiresAt: stored.expires_at })
  }

  // ——————————————————————————————————————————
  // 4. CREATE-FRAME  →  vytvoří frame ve Figma souboru
  //    Body: { fileId, frameName, widthPx, heightPx }
  // ——————————————————————————————————————————
  if (action === 'create-frame') {
    const stored = await getStoredToken(supabase, userId)
    if (!stored) return err('Figma není propojeno')

    const body = await req.json() as {
      fileId: string
      frameName: string
      widthPx: number
      heightPx: number
    }

    // Figma REST API: vytvořit frame pomocí plugin API nebo přes "Figma Files API"
    // Frames se dají vytvářet přes POST /v1/files/:file_key/nodes (jen přes plugin).
    // Via REST API lze pouze číst. Vytváření framů přes REST není podporováno.
    //
    // ⚠️  Alternativa: Figma "Branching API" nebo Plugin API.
    // Pro server-side vytváření framů je třeba použít Figma Plugin.
    //
    // Prozatím vrátíme odkaz na soubor a nechte uživatele frame vytvořit manuálně,
    // nebo vytvoříme speciální "seed" page přes duplikaci šablony.
    //
    // Reálné řešení pro auto-create: Figma Plugin (viz README).

    return json({
      fileId: body.fileId,
      frameName: body.frameName,
      figmaUrl: `https://www.figma.com/file/${body.fileId}`,
      note: 'Frame musí být vytvořen manuálně ve Figmě nebo přes plugin. Zkopírujte URL framu a vložte ji do editoru.',
    })
  }

  // ——————————————————————————————————————————
  // 5. OPEN-URL  →  vrátí Figma URL pro otevření konkrétního frame
  //    Body: { fileId, nodeId }
  // ——————————————————————————————————————————
  if (action === 'open-url') {
    const body = await req.json() as { fileId: string; nodeId?: string }
    let figmaUrl = `https://www.figma.com/file/${body.fileId}`
    if (body.nodeId) {
      figmaUrl += `?node-id=${encodeURIComponent(body.nodeId)}`
    }
    return json({ url: figmaUrl })
  }

  // ——————————————————————————————————————————
  // 6. SYNC-SVG  →  exportuje SVG z Figmy, uloží do Supabase Storage
  //    Body: { fileId, nodeId, blockId }
  // ——————————————————————————————————————————
  if (action === 'sync-svg') {
    const stored = await getStoredToken(supabase, userId)
    if (!stored) return err('Figma není propojeno')

    const body = await req.json() as { fileId: string; nodeId: string; blockId: string }

    // Figma API uses "7:2" format, URL uses "7-2" format — normalize both
    const apiNodeId = body.nodeId.replace(/-/g, ':')  // URL → API format
    const urlNodeId = body.nodeId.replace(/:/g, '-')  // API → URL format (for lookup)

    // Export SVG z Figma API
    const exportRes = await fetch(
      `https://api.figma.com/v1/images/${body.fileId}?ids=${encodeURIComponent(apiNodeId)}&format=svg&svg_include_id=true`,
      { headers: { Authorization: `Bearer ${stored.access_token}` } },
    )

    if (!exportRes.ok) {
      const text = await exportRes.text()
      return err(`Figma export error: ${text}`)
    }

    const exportData = await exportRes.json() as { images: Record<string, string> }
    // Try both formats since Figma may return either
    const svgUrl = exportData.images[apiNodeId] ?? exportData.images[urlNodeId] ?? exportData.images[body.nodeId]
    if (!svgUrl) {
      return err(`Figma nevygenerovalo SVG URL. Dostupné klíče: ${Object.keys(exportData.images ?? {}).join(', ')}`)
    }

    // Stáhni SVG obsah
    const svgRes = await fetch(svgUrl)
    if (!svgRes.ok) return err('Chyba při stahování SVG ze Figmy')
    const svgContent = await svgRes.text()

    // Ulož do Supabase Storage s timestampem pro cache busting
    const ts = Date.now()
    const storagePath = `${userId}/${body.blockId}_${ts}.svg`
    // Smaž starý soubor pokud existuje (neblokující)
    supabase.storage.from('figma-svgs').list(`${userId}`).then(({ data }) => {
      if (data) {
        const old = data.filter(f => f.name.startsWith(`${body.blockId}_`) && !f.name.includes(`${ts}`))
        if (old.length > 0) {
          supabase.storage.from('figma-svgs').remove(old.map(f => `${userId}/${f.name}`))
        }
      }
    })
    const { error: uploadError } = await supabase.storage
      .from('figma-svgs')
      .upload(storagePath, new TextEncoder().encode(svgContent), {
        contentType: 'image/svg+xml',
        upsert: true,
      })

    if (uploadError) return err(`Storage upload error: ${uploadError.message}`)

    // Vrátí veřejné URL
    const { data: publicData } = supabase.storage.from('figma-svgs').getPublicUrl(storagePath)

    return json({
      svgUrl: publicData.publicUrl,
      syncedAt: new Date().toISOString(),
    })
  }

  return err(`Neznámá akce: ${action}`)
})
