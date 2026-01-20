/**
 * Gemini TTS Edge Function
 * 
 * Využívá Gemini 2.5 Flash TTS přes Vertex AI pro kvalitní text-to-speech.
 * Dokumentace: https://cloud.google.com/text-to-speech/docs/gemini-tts
 * 
 * Podporované hlasy: Aoede, Charon, Fenrir, Kore, Puck, a další
 * Podporované jazyky: čeština (cs-CZ), angličtina, a 20+ dalších
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TTSRequest {
  text: string;
  voice?: string; // Voice name: Puck, Charon, Kore, Fenrir, Aoede, etc.
  prompt?: string; // Style prompt: "Say this warmly", "Speak like a teacher"
  languageCode?: string; // e.g. 'cs-CZ' for Czech
}

interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
}

// Available Gemini TTS voices
const VOICES = {
  'Kore': 'Kore',      // Female, soft and warm - RECOMMENDED for Czech
  'Aoede': 'Aoede',    // Female, bright and clear
  'Puck': 'Puck',      // Male, versatile
  'Charon': 'Charon',  // Male, deep
  'Fenrir': 'Fenrir',  // Male, energetic
} as const

/**
 * Create a JWT for Google OAuth2
 */
async function createJWT(serviceAccount: ServiceAccountKey): Promise<string> {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  }

  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
  }

  // Base64URL encode
  const base64UrlEncode = (obj: object) => {
    const json = JSON.stringify(obj)
    const base64 = btoa(json)
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  const headerEncoded = base64UrlEncode(header)
  const payloadEncoded = base64UrlEncode(payload)
  const signatureInput = `${headerEncoded}.${payloadEncoded}`

  // Import private key and sign
  const privateKeyPem = serviceAccount.private_key
  const pemHeader = '-----BEGIN PRIVATE KEY-----'
  const pemFooter = '-----END PRIVATE KEY-----'
  const pemContents = privateKeyPem
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\n/g, '')

  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  )

  const signatureEncoded = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  return `${signatureInput}.${signatureEncoded}`
}

/**
 * Get access token from Google OAuth2
 */
async function getAccessToken(serviceAccount: ServiceAccountKey): Promise<string> {
  const jwt = await createJWT(serviceAccount)

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OAuth2 token error: ${error}`)
  }

  const data = await response.json()
  return data.access_token
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { 
      text, 
      voice = 'Kore', 
      prompt = 'Mluv česky jako přátelský učitel. Mluv přirozeně, srozumitelně a svižně.',
      languageCode = 'cs-CZ' 
    }: TTSRequest = await req.json()

    if (!text || text.trim().length === 0) {
      throw new Error('Text is required')
    }

    // Get service account from secrets
    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT')
    if (!serviceAccountJson) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT not configured')
    }

    const serviceAccount: ServiceAccountKey = JSON.parse(serviceAccountJson)
    const projectId = serviceAccount.project_id

    console.log(`Gemini TTS: "${text.substring(0, 50)}..." with voice ${voice}`)

    // Get access token
    const accessToken = await getAccessToken(serviceAccount)

    // Use Gemini TTS - correct format from documentation
    // https://docs.cloud.google.com/text-to-speech/docs/gemini-tts
    const voiceName = VOICES[voice as keyof typeof VOICES] || 'Kore'
    
    const requestBody = {
      input: {
        // Style prompt for controlling voice style
        prompt: prompt,
        // The actual text to speak
        text: text,
      },
      voice: {
        languageCode: languageCode,
        name: voiceName,
        // Model name is required for Gemini TTS
        modelName: 'gemini-2.5-flash-tts',
      },
      audioConfig: {
        audioEncoding: 'MP3',
        // Faster speaking rate (1.0 = normal, 1.15 = slightly faster)
        speakingRate: 1.15,
      },
    }
    
    // Try Cloud Text-to-Speech API first (simpler, works with service account)
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize`,
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(requestBody)
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Gemini TTS error:', response.status, errorData)
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Gemini TTS error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`,
          fallbackToGoogleTTS: true
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 200
        }
      )
    }

    const data = await response.json()
    
    if (!data.audioContent) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No audio content in response',
          fallbackToGoogleTTS: true
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 200
        }
      )
    }

    console.log('Gemini TTS success!')

    return new Response(
      JSON.stringify({ 
        success: true, 
        audioContent: data.audioContent,
        mimeType: 'audio/mp3'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Gemini TTS error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error',
        fallbackToGoogleTTS: true
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200
      }
    )
  }
})
