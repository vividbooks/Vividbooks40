import OpenAI from 'openai';
import { chatWithAIProxy, shouldUseProxy } from './ai-chat-proxy';

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
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: params.systemPrompt }
    ];

    if (params.history) {
      params.history.forEach(msg => {
        messages.push({ role: msg.role, content: msg.content });
      });
    }

    messages.push({ role: 'user', content: params.message });

    // Use Supabase Edge Function proxy in production
    if (shouldUseProxy()) {
      return await chatWithAIProxy(messages, params.model, { temperature: 0.7, max_tokens: 1000 });
    }

    // Direct API call for development
    const apiKey = getOpenAIKey();
    if (!apiKey) {
      throw new Error('NO_API_KEY');
    }

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
  } catch (error: any) {
    console.error('OpenAI API Error:', error);
    
    // Parse specific error types for better user feedback
    if (error.message === 'NO_API_KEY') {
      throw new Error('Chybí OpenAI API klíč. Klikni na ikonu 🔑 a zadej svůj klíč.');
    }
    
    if (error.status === 401 || error.code === 'invalid_api_key') {
      throw new Error('Neplatný OpenAI API klíč. Zkontroluj nebo aktualizuj svůj klíč (ikona 🔑).');
    }
    
    if (error.status === 429) {
      throw new Error('Překročen limit OpenAI API. Počkej chvíli nebo zkontroluj svůj kredit na OpenAI.');
    }
    
    if (error.status === 402 || error.code === 'insufficient_quota') {
      throw new Error('Nedostatečný kredit na OpenAI účtu. Doplň kredit na platform.openai.com.');
    }

    if (error.status === 404) {
      throw new Error(`Model "${error.model || 'neznámý'}" není dostupný. Zkus jiný model.`);
    }
    
    throw error;
  }
}

