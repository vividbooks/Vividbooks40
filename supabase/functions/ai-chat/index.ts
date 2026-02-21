/**
 * AI Chat Edge Function
 * 
 * Bezpečné proxy pro OpenAI a Gemini API.
 * API klíče jsou uloženy jako Supabase secrets.
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
      
      // Model mapping – ONLY Gemini 3 Pro and Gemini 3 Flash are used
      // Official model IDs (Gemini API / Vertex AI):
      //   gemini-3-pro-preview  → Gemini 3 Pro (best reasoning, complex tasks)
      //   gemini-3-flash-preview → Gemini 3 Flash (fast, cost-efficient)
      let geminiModel: string
      
      if (model.includes('3-pro') || model.includes('3 pro') || model.includes('pro')) {
        geminiModel = 'gemini-3-pro-preview'
      } else {
        // Default: Gemini 3 Flash for everything else (fast, cheap, capable)
        geminiModel = 'gemini-3-flash-preview'
      }
      
      const isGemini3 = true // Always Gemini 3
      
      const geminiBody: any = {
        contents: geminiContents,
        generationConfig: {
          maxOutputTokens: max_tokens,
          temperature: temperature,
        }
      }

      // Add thinking_level for Gemini 3 models
      // Supported levels: minimal, low, medium, high
      // Gemini 3 Pro always thinks; Flash defaults to low
      // REST API uses snake_case: thinking_level (NOT thinkingLevel)
      if (isGemini3) {
        geminiBody.generationConfig.thinkingConfig = {
          thinking_level: thinking_level || 'low'
        }
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
      
      // Gemini 3 thinking models return parts with thought:true (internal reasoning)
      // and parts without thought flag (the actual answer).
      // We only want the non-thought parts as the response.
      const allParts: any[] = data.candidates?.[0]?.content?.parts || []
      const answerParts = allParts.filter((p: any) => p.text && !p.thought)
      
      if (answerParts.length > 0) {
        responseText = answerParts.map((p: any) => p.text).join('')
      } else {
        // Fallback: if no non-thought parts found, include everything (older models)
        responseText = allParts.filter((p: any) => p.text).map((p: any) => p.text).join('')
      }
      
      // Log details when response is empty for debugging
      if (!responseText) {
        const finishReason = data.candidates?.[0]?.finishReason
        const blockReason = data.promptFeedback?.blockReason
        console.error(`Empty response from ${geminiModel}. finishReason=${finishReason}, blockReason=${blockReason}`)
        console.error(`Parts count: ${allParts.length}, answer parts: ${answerParts.length}`)
        console.error('Full response:', JSON.stringify(data).slice(0, 800))
        // Return structured error so frontend can show specific reason
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

