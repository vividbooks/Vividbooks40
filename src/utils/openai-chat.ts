import OpenAI from 'openai';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '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';

// Inicializace OpenAI klienta
// Pozor: V produkci by se mělo volat přes backend, aby klíč nebyl v prohlížeči.
// Pro účely dema/vývoje použijeme dangerouslyAllowBrowser: true
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true 
});

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

