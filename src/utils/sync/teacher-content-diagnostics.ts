/**
 * Fetch a "server truth" snapshot for the currently authenticated teacher.
 * Used for debugging cross-browser sync issues.
 */

const SUPABASE_URL = 'https://njbtqmsxbyvpwigfceke.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';

export interface TeacherContentSnapshot {
  userId: string;
  fetchedAt: string;
  boards: any[];
  documents: any[];
  folders: any[];
  worksheets: any[];
  files: any[];
  links: any[];
  tombstones?: any[];
}

async function fetchTable(path: string, accessToken: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'GET',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return (await res.json()) || [];
}

export async function fetchTeacherContentSnapshot(userId: string, accessToken: string): Promise<TeacherContentSnapshot> {
  const [boards, documents, folders, worksheets, files, links, tombstones] = await Promise.all([
    fetchTable(`teacher_boards?teacher_id=eq.${userId}&select=id,title,updated_at,created_at,folder_id&order=updated_at.desc`, accessToken),
    fetchTable(`teacher_documents?teacher_id=eq.${userId}&select=id,title,updated_at,created_at,folder_id&order=updated_at.desc`, accessToken),
    fetchTable(`teacher_folders?teacher_id=eq.${userId}&select=id,name,parent_id,position,created_at,updated_at&order=position.asc`, accessToken),
    fetchTable(`teacher_worksheets?teacher_id=eq.${userId}&select=id,name,updated_at,created_at,folder_id&order=updated_at.desc`, accessToken),
    fetchTable(`teacher_files?teacher_id=eq.${userId}&select=id,file_name,created_at,folder_id&order=created_at.desc`, accessToken),
    fetchTable(`teacher_links?teacher_id=eq.${userId}&select=id,title,created_at,folder_id&order=created_at.desc`, accessToken),
    fetchTable(`teacher_deleted_items?teacher_id=eq.${userId}&select=item_type,item_id,deleted_at,client_id&order=deleted_at.desc`, accessToken).catch(() => []),
  ]);

  return {
    userId,
    fetchedAt: new Date().toISOString(),
    boards,
    documents,
    folders,
    worksheets,
    files,
    links,
    tombstones,
  };
}




