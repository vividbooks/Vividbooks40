import OpenAI from 'openai';

// Get API key from localStorage or env variable
export function getOpenAIKey(): string {
  // First check localStorage (runtime configuration)
  if (typeof window !== 'undefined') {
    const storedKey = localStorage.getItem('openai_api_key');
    if (storedKey) return storedKey;
  }
  // Fallback to env variable
  return import.meta.env.VITE_OPENAI_API_KEY || '';
}

// Set API key at runtime
export function setOpenAIKey(key: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('openai_api_key', key);
  }
}

// Inicializace OpenAI klienta
// Pozor: V produkci by se mělo volat přes backend, aby klíč nebyl v prohlížeči.
// Pro účely dema/vývoje použijeme dangerouslyAllowBrowser: true
function createOpenAIClient() {
  return new OpenAI({
    apiKey: getOpenAIKey(),
    dangerouslyAllowBrowser: true 
  });
}

export interface ChatParams {
  message: string;
  model: string;
  systemPrompt: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export async function chatWithOpenAI(params: ChatParams): Promise<string> {
  try {
    const messages: any[] = [
      { role: 'system', content: params.systemPrompt }
    ];

    if (params.history) {
      params.history.forEach(msg => {
        messages.push({ role: msg.role, content: msg.content });
      });
    }

    messages.push({ role: 'user', content: params.message });

    // GPT-5 models require `max_completion_tokens` instead of `max_tokens`.
    const isGpt5Family = /^gpt-5/i.test(params.model);

    // GPT-5 chat.completions currently only supports default temperature (1),
    // so we omit temperature for GPT-5 to avoid 400 errors.
    const openai = createOpenAIClient();
    const completion = await openai.chat.completions.create({
      messages: messages,
      model: params.model,
      ...(!isGpt5Family ? { temperature: 0.7 } : {}),
      ...(isGpt5Family ? { max_completion_tokens: 1000 } : { max_tokens: 1000 }),
    } as any);

    return completion.choices[0]?.message?.content || 'Omlouvám se, nemám odpověď.';
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw error;
  }
}

