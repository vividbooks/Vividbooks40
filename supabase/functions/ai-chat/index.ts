/**
 * AI Chat Edge Function
 *
 * Bezpečné proxy pro OpenAI a Gemini API.
 * API klíče jsou uloženy jako Supabase secrets.
 *
 * Podporované Gemini modely:
 *   gemini-3.1-pro   → gemini-3.1-pro-preview   (text, reasoning, učebnice)
 *   gemini-3-flash   → gemini-3-flash-preview    (chat, překlady, fallback)
 *   gemini-image-flash → gemini-3.1-flash-image-preview  (generování obrázků)
 *   gemini-image-pro   → gemini-3-pro-image-preview      (HQ ilustrace)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Message content can be a string or multimodal array (text + images)
 */
type ChatMessageContent = string | ChatMessagePart[];

interface ChatMessagePart {
  type: 'text' | 'image';
  text?: string;
  data?: string; // base64 image data (without data: prefix)
  mimeType?: string; // e.g. 'image/png'
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: ChatMessageContent;
}

interface ChatRequest {
  messages: ChatMessage[];
  model: string;
  temperature?: number;
  max_tokens?: number;
  thinking_level?: 'minimal' | 'low' | 'medium' | 'high';
}

// Modely které vrací obrázky (inlineData) místo textu
const IMAGE_GENERATION_MODELS = [
  'gemini-3.1-flash-image-preview',
  'gemini-3-pro-image-preview',
];

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { messages, model, temperature = 0.7, max_tokens = 8192, thinking_level }: ChatRequest = await req.json()

    console.log(`Request: model=${model}, max_tokens=${max_tokens}`)

    if (!messages || messages.length === 0) {
      throw new Error('Messages are required')
    }

    // Determine which API to use based on model name
    const isGemini = model.toLowerCase().includes('gemini')
    
    let responseText: string

    if (isGemini) {
      // === GEMINI API ===
      const geminiApiKey = Deno.env.get('GEMINI_API_KEY_RAG')
      if (!geminiApiKey) {
        throw new Error('GEMINI_API_KEY_RAG not configured')
      }

      // Convert messages to Gemini format (supports multimodal content)
      const geminiContents = messages
        .filter(m => m.role !== 'system')
        .map(m => {
          const parts: any[] = []
          
          if (typeof m.content === 'string') {
            // Simple text message
            parts.push({ text: m.content })
          } else if (Array.isArray(m.content)) {
            // Multimodal message (text + images)
            for (const part of m.content) {
              if (part.type === 'text' && part.text) {
                parts.push({ text: part.text })
              } else if (part.type === 'image' && part.data) {
                parts.push({
                  inlineData: {
                    mimeType: part.mimeType || 'image/png',
                    data: part.data,
                  }
                })
              }
            }
          }
          
          // Fallback if no parts were added
          if (parts.length === 0) {
            parts.push({ text: '' })
          }
          
          return {
            role: m.role === 'assistant' ? 'model' : 'user',
            parts,
          }
        })

      // Add system instruction if present
      const systemMessage = messages.find(m => m.role === 'system')
      
      // Model mapping – Gemini 3 a 3.1 modely
      // gemini-3.1-pro       → gemini-3.1-pro-preview   (hlavní text model)
      // gemini-3-flash        → gemini-3-flash-preview   (rychlý fallback)
      // gemini-image-flash    → gemini-3.1-flash-image-preview (generování obrázků)
      // gemini-image-pro      → gemini-3-pro-image-preview    (HQ ilustrace)
      let geminiModel: string

      if (model.includes('image-flash') || model === 'gemini-image-flash') {
        geminiModel = 'gemini-3.1-flash-image-preview'
      } else if (model.includes('image-pro') || model === 'gemini-image-pro') {
        geminiModel = 'gemini-3-pro-image-preview'
      } else if (model.includes('3.1-pro') || model.includes('3.1 pro')) {
        geminiModel = 'gemini-3.1-pro-preview'
      } else if (model.includes('3-pro') || model.includes('3 pro') || model.includes('pro')) {
        // Backward compat: starý 'pro' přesměruj na 3.1
        geminiModel = 'gemini-3.1-pro-preview'
      } else {
        // Default: Gemini 3 Flash pro vše ostatní (rychlý, levný)
        geminiModel = 'gemini-3-flash-preview'
      }

      const isImageModel = IMAGE_GENERATION_MODELS.includes(geminiModel)
      const isGemini3 = true // Always Gemini 3+
      
      const geminiBody: any = {
        contents: geminiContents,
        generationConfig: {
          maxOutputTokens: max_tokens,
          temperature: temperature,
        }
      }

      // Image generation modely nepodporují thinkingConfig
      if (isGemini3 && !isImageModel) {
        geminiBody.generationConfig.thinkingConfig = {
          thinking_level: thinking_level || 'low'
        }
      }

      // Image modely potřebují responseModalities aby vrátily obrázek
      if (isImageModel) {
        geminiBody.generationConfig.responseModalities = ['Text', 'Image']
      }

      if (systemMessage) {
        // System instruction is always text-only
        const systemText = typeof systemMessage.content === 'string' 
          ? systemMessage.content 
          : systemMessage.content.filter(p => p.type === 'text').map(p => p.text).join('\n')
        geminiBody.systemInstruction = {
          parts: [{ text: systemText }]
        }
      }
      
      console.log(`Using Gemini model: ${geminiModel}`)
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiBody)
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Gemini API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`)
      }

      const data = await response.json()

      const allParts: any[] = data.candidates?.[0]?.content?.parts || []

      // Image generation modely vrací inlineData (base64 PNG)
      if (isImageModel) {
        const imageParts = allParts.filter((p: any) => p.inlineData?.data)
        const textParts = allParts.filter((p: any) => p.text && !p.thought)

        if (imageParts.length === 0) {
          const finishReason = data.candidates?.[0]?.finishReason
          const blockReason = data.promptFeedback?.blockReason
          console.error(`No image in response from ${geminiModel}. finishReason=${finishReason}, blockReason=${blockReason}`)
          const reason = blockReason ? `BLOCKED:${blockReason}` : finishReason ? `FINISH:${finishReason}` : 'NO_IMAGE'
          throw new Error(`Gemini image generation selhalo [${geminiModel}] – důvod: ${reason}`)
        }

        // Vrátíme JSON s obrázky a volitelným textem
        return new Response(
          JSON.stringify({
            success: true,
            model: geminiModel,
            images: imageParts.map((p: any) => ({
              data: p.inlineData.data,          // base64 PNG bez data: prefixu
              mimeType: p.inlineData.mimeType || 'image/png',
            })),
            content: textParts.map((p: any) => p.text).join('') || null,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // --- Text modely (původní logika) ---
      // Gemini 3 thinking models return parts with thought:true (internal reasoning).
      // We only want the non-thought parts as the response.
      const answerParts = allParts.filter((p: any) => p.text && !p.thought)

      if (answerParts.length > 0) {
        responseText = answerParts.map((p: any) => p.text).join('')
      } else {
        responseText = allParts.filter((p: any) => p.text).map((p: any) => p.text).join('')
      }

      if (!responseText) {
        const finishReason = data.candidates?.[0]?.finishReason
        const blockReason = data.promptFeedback?.blockReason
        console.error(`Empty response from ${geminiModel}. finishReason=${finishReason}, blockReason=${blockReason}`)
        console.error(`Parts count: ${allParts.length}, answer parts: ${answerParts.length}`)
        console.error('Full response:', JSON.stringify(data).slice(0, 800))
        const reason = blockReason ? `BLOCKED:${blockReason}` : finishReason ? `FINISH:${finishReason}` : 'EMPTY'
        throw new Error(`Gemini prázdná odpověď [${geminiModel}] – důvod: ${reason}`)
      }

    } else {
      // === OPENAI API ===
      const openaiApiKey = Deno.env.get('open_ai_key2')
      if (!openaiApiKey) {
        throw new Error('open_ai_key2 not configured')
      }

      // Determine if it's a GPT-5 model (different parameters)
      const isGpt5 = model.toLowerCase().includes('gpt-5')

      const openaiBody: any = {
        model: model,
        messages: messages,
      }

      // GPT-5 has different parameter requirements
      if (isGpt5) {
        openaiBody.max_completion_tokens = max_tokens
        // GPT-5 only supports default temperature
      } else {
        openaiBody.max_tokens = max_tokens
        openaiBody.temperature = temperature
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(openaiBody)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error?.message || 'Unknown error'
        
        // Provide specific error messages
        if (response.status === 401) {
          throw new Error('Neplatný OpenAI API klíč')
        } else if (response.status === 429) {
          throw new Error('Překročen limit OpenAI API. Počkej chvíli.')
        } else if (response.status === 402) {
          throw new Error('Nedostatečný kredit na OpenAI účtu')
        }
        
        throw new Error(`OpenAI API error: ${response.status} - ${errorMessage}`)
      }

      const data = await response.json()
      responseText = data.choices?.[0]?.message?.content || ''
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        content: responseText,
        model: model 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('AI Chat error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 400 
      }
    )
  }
})

