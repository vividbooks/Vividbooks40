import { supabase } from './client';
import { projectId, publicAnonKey } from './info';

interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  skipAuth?: boolean; // Skip auth for faster requests
}

// Cache token at module level to avoid repeated getSession calls
let cachedToken: string | null = null;
let tokenExpiry: number = 0;
let isRefreshing: boolean = false;

function readTokenFromStorage(): { token: string; expiresAt?: number; refreshToken?: string } | null {
  try {
    const keyPrefix = `sb-${projectId}-auth-token`;
    const raw = localStorage.getItem(keyPrefix);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.access_token) {
      return { 
        token: parsed.access_token, 
        expiresAt: parsed.expires_at,
        refreshToken: parsed.refresh_token 
      };
    }
  } catch {
    // ignore storage parse errors
  }
  return null;
}

// Check if token is expired (with 60s buffer)
function isTokenExpired(expiresAt?: number): boolean {
  if (!expiresAt) return true;
  const now = Math.floor(Date.now() / 1000); // Convert to seconds
  return expiresAt < now + 60; // 60 second buffer
}

// Try to refresh the session
async function tryRefreshSession(): Promise<string | null> {
  if (isRefreshing) {
    // Wait for ongoing refresh
    await new Promise(r => setTimeout(r, 1000));
    if (cachedToken && tokenExpiry > Date.now() + 60000) {
      return cachedToken;
    }
    return null;
  }
  
  isRefreshing = true;
  try {
    console.log('[FetchHelper] Attempting session refresh...');
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.warn('[FetchHelper] Session refresh failed:', error.message);
      // Clear invalid tokens from localStorage
      const keyPrefix = `sb-${projectId}-auth-token`;
      localStorage.removeItem(keyPrefix);
      cachedToken = null;
      tokenExpiry = 0;
      return null;
    }
    
    if (data.session?.access_token) {
      cachedToken = data.session.access_token;
      const exp = data.session.expires_at;
      tokenExpiry = exp ? exp * 1000 : Date.now() + 3600000;
      console.log('[FetchHelper] Session refreshed successfully');
      return cachedToken;
    }
  } catch (e: any) {
    console.warn('[FetchHelper] Session refresh error:', e?.message || e);
  } finally {
    isRefreshing = false;
  }
  return null;
}

async function getToken(forceRefresh: boolean = false): Promise<string> {
  const now = Date.now();
  
  // Return cached token if still valid (with 60s buffer) and not forcing refresh
  if (!forceRefresh && cachedToken && tokenExpiry > now + 60000) {
    return cachedToken;
  }
  
  // If forcing refresh due to 401, try refresh first
  if (forceRefresh) {
    const refreshedToken = await tryRefreshSession();
    if (refreshedToken) {
      return refreshedToken;
    }
    // Refresh failed, use anon key
    console.log('[FetchHelper] Refresh failed, using anon key');
    return publicAnonKey;
  }
  
  try {
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<null>((resolve) => 
      setTimeout(() => resolve(null), 2500)
    );
    
    const result = await Promise.race([sessionPromise, timeoutPromise]);
    
    if (result && 'data' in result && result.data.session?.access_token) {
      cachedToken = result.data.session.access_token;
      const exp = result.data.session.expires_at;
      tokenExpiry = exp ? exp * 1000 : now + 3600000;
      return cachedToken;
    }
    
    if (result === null) {
      // Timeout - check storage but verify token is not expired
      const storageToken = readTokenFromStorage();
      if (storageToken?.token && !isTokenExpired(storageToken.expiresAt)) {
        cachedToken = storageToken.token;
        tokenExpiry = storageToken.expiresAt ? storageToken.expiresAt * 1000 : now + 3600000;
        return cachedToken;
      }
      
      // Token expired or missing - try refresh
      if (storageToken?.refreshToken) {
        const refreshedToken = await tryRefreshSession();
        if (refreshedToken) {
          return refreshedToken;
        }
      }
      
      console.log('[FetchHelper] getSession timed out, using anon key');
    }
  } catch (e) {
    // Error - check storage but verify token is not expired
    const storageToken = readTokenFromStorage();
    if (storageToken?.token && !isTokenExpired(storageToken.expiresAt)) {
      cachedToken = storageToken.token;
      tokenExpiry = storageToken.expiresAt ? storageToken.expiresAt * 1000 : now + 3600000;
      return cachedToken;
    }
    console.log('[FetchHelper] Session fetch failed, using anon key');
  }
  
  return publicAnonKey;
}

// Clear cache when auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    cachedToken = null;
    tokenExpiry = 0;
    return;
  }
  if (session?.access_token) {
    cachedToken = session.access_token;
    const exp = session.expires_at;
    tokenExpiry = exp ? exp * 1000 : Date.now() + 3600000;
  } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    cachedToken = null;
    tokenExpiry = 0;
  }
});

/**
 * Fast fetch wrapper for Supabase requests
 * Optimized for speed with token caching and automatic token refresh
 */
export async function fetchWithRetry(url: string, options: FetchOptions = {}): Promise<Response> {
  const { 
    timeout = 8000,  // Reduced from 15s
    retries = 1,     // Reduced from 3
    headers = {},
    skipAuth = false,
    ...fetchOptions 
  } = options;

  // Get token once at the start (cached)
  let token = skipAuth ? publicAnonKey : await getToken();
  
  let attempt = 0;
  
  while (attempt <= retries) {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          'apikey': publicAnonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timerId);

      if (!response.ok) {
        // On 401, try to refresh token and retry once
        if (response.status === 401 && attempt === 0 && !skipAuth) {
          console.log('[FetchHelper] Got 401, attempting token refresh...');
          cachedToken = null;
          tokenExpiry = 0;
          
          // Try to get a fresh token (with forced refresh)
          token = await getToken(true);
          
          // If we got anon key back, don't retry - just return the 401
          if (token === publicAnonKey) {
            console.log('[FetchHelper] Token refresh failed, returning 401');
            return response;
          }
          
          attempt++;
          continue;
        }

        // On server error, retry
        if (response.status >= 500 && attempt < retries) {
          attempt++;
          await new Promise(r => setTimeout(r, 500)); // Short delay
          continue;
        }
      }

      return response;

    } catch (error: any) {
      clearTimeout(timerId);
      
      if (attempt < retries) {
        attempt++;
        await new Promise(r => setTimeout(r, 300)); // Short delay
        continue;
      }
      
      throw error;
    }
  }

  throw new Error('Max retries exceeded');
}
