/**
 * Volání Edge funkce vividboard-proxy — gateway často vyžaduje apikey + Authorization
 * (jen Bearer anon někdy nestačí). Při přihlášení použije user JWT.
 */

import { supabase } from './supabase/client';
import { projectId, publicAnonKey } from './supabase/info';

export async function fetchVividboardProxy(boardId: string): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const jwt = session?.access_token ?? publicAnonKey;
  const url = `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/vividboard-proxy/${boardId}`;

  return fetch(url, {
    headers: {
      apikey: publicAnonKey,
      Authorization: `Bearer ${jwt}`,
    },
  });
}
