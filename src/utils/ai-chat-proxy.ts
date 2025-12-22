/**
 * AI Chat Proxy
 * 
 * Volá Supabase Edge Function pro bezpečné AI API requesty.
 * API klíče jsou uloženy v Supabase secrets, ne v klientovi.
 */

import { supabase } from './supabase/client';
import { projectId, publicAnonKey } from './supabase/info';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  temperature?: number;
  max_tokens?: number;
}

interface ChatResponse {
  success: boolean;
  content?: string;
  error?: string;
  model?: string;
}

// Supabase URL - use from info.tsx (always available)
const SUPABASE_URL = `https://${projectId}.supabase.co`;

// Check if we should use the proxy (Edge Function) or direct API calls
// Default: always use proxy (API keys are in Supabase secrets)
// Can be disabled with localStorage.setItem('use_ai_proxy', 'false')
function shouldUseProxy(): boolean {
  // Check if explicitly disabled
  if (typeof window !== 'undefined') {
    const setting = localStorage.getItem('use_ai_proxy');
    if (setting === 'false') {
      return false;
    }
  }
  
  // Default: always use proxy (safest option)
  return true;
}

/**
 * Chat with AI using Supabase Edge Function proxy
 */
export async function chatWithAIProxy(
  messages: ChatMessage[],
  model: string,
  options: ChatOptions = {}
): Promise<string> {
  const { temperature = 0.7, max_tokens = 2048 } = options;

  try {
    // Get the current session for auth header
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || publicAnonKey}`,
      },
      body: JSON.stringify({
        messages,
        model,
        temperature,
        max_tokens,
      }),
    });

    const data: ChatResponse = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'AI request failed');
    }

    return data.content || '';

  } catch (error: any) {
    console.error('AI Proxy error:', error);
    throw error;
  }
}

/**
 * Helper to check if AI proxy is available
 */
export function isAIProxyAvailable(): boolean {
  return !!SUPABASE_URL;
}

/**
 * Enable or disable AI proxy for development
 */
export function setUseAIProxy(enabled: boolean): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('use_ai_proxy', enabled ? 'true' : 'false');
  }
}

export { shouldUseProxy };

