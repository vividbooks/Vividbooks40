/**
 * Vividbooks Sync – Plugin UI (ui.ts)
 *
 * Runs inside the Figma iframe. Has full network access.
 * Communicates with code.ts via postMessage.
 */

// ── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://njbtqmsxbyvpwigfceke.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';

// ── Types ────────────────────────────────────────────────────────────────────

interface SupabaseUser { id: string; email: string; }
interface SupabaseSession { access_token: string; user: SupabaseUser; }

interface DbWorksheet {
  id: string;
  name: string;
  content: any[]; // blocks
  folder_id: string | null;
  updated_at: string;
}

interface DbFolder {
  id: string;
  name: string;
  parent_id: string | null;
}

// ── State ────────────────────────────────────────────────────────────────────

let session: SupabaseSession | null = null;
let allWorksheets: DbWorksheet[] = [];
let allFolders: DbFolder[] = [];
let currentFolderId: string | null = null;
let folderStack: Array<{ id: string | null; name: string }> = [{ id: null, name: 'Kořen' }];
let selectedIds = new Set<string>();

// ── DOM helpers ───────────────────────────────────────────────────────────────

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function showScreen(name: 'login' | 'picker' | 'progress' | 'done' | 'error') {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  el(`screen-${name}`).classList.add('active');
}

function log(msg: string) {
  const logEl = el('progress-log');
  const line = document.createElement('div');
  line.textContent = `• ${msg}`;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function setProgress(done: number, total: number, label: string) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  el('progress-bar').style.width = `${pct}%`;
  el('progress-label').textContent = `${done} / ${total}`;
  el('progress-pct').textContent = `${pct} %`;
  el('progress-subtitle').textContent = label;
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function supabaseFetch(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<any> {
  const headers: Record<string, string> = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };
  const res = await fetch(`${SUPABASE_URL}${path}`, { ...options, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function signIn(email: string, password: string): Promise<SupabaseSession> {
  const data = await supabaseFetch('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!data?.access_token) throw new Error('Přihlášení selhalo – zkontrolujte e-mail a heslo.');
  return { access_token: data.access_token, user: data.user };
}

async function fetchWorksheets(token: string, userId: string): Promise<DbWorksheet[]> {
  return supabaseFetch(
    `/rest/v1/teacher_worksheets?teacher_id=eq.${userId}&select=id,name,content,folder_id,updated_at&order=name.asc`,
    {},
    token,
  );
}

async function fetchFolders(token: string, userId: string): Promise<DbFolder[]> {
  try {
    return await supabaseFetch(
      `/rest/v1/teacher_folders?teacher_id=eq.${userId}&select=id,name,parent_id&order=name.asc`,
      {},
      token,
    );
  } catch {
    return []; // folders table may not exist yet
  }
}

// ── Image fetching ────────────────────────────────────────────────────────────

async function fetchImageAsBytes(url: string): Promise<number[] | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return Array.from(new Uint8Array(buf));
  } catch {
    return null;
  }
}

function collectImageUrls(blocks: any[]): string[] {
  const urls = new Set<string>();
  for (const b of blocks) {
    const c = b.content || {};
    if (c.url) urls.add(c.url);
    if (c.imageUrl) urls.add(c.imageUrl);
    if (Array.isArray(c.gallery)) c.gallery.forEach((u: string) => u && urls.add(u));
    if (Array.isArray(c.options)) {
      c.options.forEach((o: any) => o.imageUrl && urls.add(o.imageUrl));
    }
    if (Array.isArray(c.subQuestions)) {
      c.subQuestions.forEach((sq: any) => sq.imageUrl && urls.add(sq.imageUrl));
    }
  }
  return [...urls].filter(Boolean);
}

// ── Render picker ─────────────────────────────────────────────────────────────

function renderPicker() {
  // Breadcrumb
  const bc = el('breadcrumb');
  bc.innerHTML = '';
  folderStack.forEach((item, idx) => {
    if (idx > 0) {
      const sep = document.createElement('span');
      sep.className = 'sep'; sep.textContent = '/';
      bc.appendChild(sep);
    }
    const btn = document.createElement('button');
    btn.textContent = idx === 0 ? '🏠 Kořen' : `📁 ${item.name}`;
    btn.onclick = () => {
      folderStack = folderStack.slice(0, idx + 1);
      currentFolderId = item.id;
      renderPicker();
    };
    bc.appendChild(btn);
  });

  // Items in current folder
  const list = el('ws-list');
  list.innerHTML = '';

  const childFolders = allFolders.filter(f => f.parent_id === currentFolderId);
  const childWorksheets = allWorksheets.filter(w => w.folder_id === currentFolderId);

  if (childFolders.length === 0 && childWorksheets.length === 0) {
    list.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px;font-size:12px">Tato složka je prázdná</div>';
  }

  // Folders first
  for (const folder of childFolders) {
    const item = document.createElement('div');
    item.className = 'ws-item folder-item';
    item.innerHTML = `
      <span class="ws-icon">📁</span>
      <span class="ws-name">${escHtml(folder.name)}</span>
      <span class="ws-meta">→</span>
    `;
    item.onclick = () => {
      folderStack.push({ id: folder.id, name: folder.name });
      currentFolderId = folder.id;
      renderPicker();
    };
    list.appendChild(item);
  }

  // Worksheets
  for (const ws of childWorksheets) {
    const checked = selectedIds.has(ws.id);
    const item = document.createElement('div');
    item.className = `ws-item${checked ? ' selected' : ''}`;
    item.dataset.id = ws.id;

    const date = new Date(ws.updated_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
    const blockCount = Array.isArray(ws.content) ? ws.content.length : 0;

    item.innerHTML = `
      <input type="checkbox" ${checked ? 'checked' : ''} />
      <span class="ws-icon">📄</span>
      <span class="ws-name">${escHtml(ws.name)}</span>
      <span class="ws-meta">${blockCount} bloků · ${date}</span>
    `;
    item.onclick = (e) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return; // handled below
      toggleSelect(ws.id, item);
    };
    const chk = item.querySelector('input')!;
    chk.onchange = () => toggleSelect(ws.id, item);
    list.appendChild(item);
  }

  updateSelectionBar();
}

function toggleSelect(id: string, item: HTMLElement) {
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
    item.classList.remove('selected');
    (item.querySelector('input') as HTMLInputElement).checked = false;
  } else {
    selectedIds.add(id);
    item.classList.add('selected');
    (item.querySelector('input') as HTMLInputElement).checked = true;
  }
  updateSelectionBar();
}

function updateSelectionBar() {
  el('sel-count').textContent = `${selectedIds.size} vybráno`;
  const btnSync = el<HTMLButtonElement>('btn-sync');
  btnSync.disabled = selectedIds.size === 0;
  btnSync.textContent = selectedIds.size > 0
    ? `▶ Přenést ${selectedIds.size} worksheet${selectedIds.size > 1 ? 'ů' : ''} do Figmy`
    : 'Vyberte worksheety';
}

// ── Sync pipeline ─────────────────────────────────────────────────────────────

async function startSync() {
  if (!session || selectedIds.size === 0) return;
  showScreen('progress');

  const selectedWorksheets = allWorksheets.filter(w => selectedIds.has(w.id));
  const totalWs = selectedWorksheets.length;

  // 1. Collect all image URLs
  setProgress(0, totalWs, 'Sbírám URL obrázků...');
  const allUrls: string[] = [];
  for (const ws of selectedWorksheets) {
    const blocks = Array.isArray(ws.content) ? ws.content : [];
    allUrls.push(...collectImageUrls(blocks));
  }
  const uniqueUrls = [...new Set(allUrls)];
  log(`Nalezeno ${uniqueUrls.length} unikátních obrázků`);

  // 2. Fetch all images
  const imageCache: Record<string, number[]> = {};
  let fetched = 0;
  setProgress(0, uniqueUrls.length, `Stahuju obrázky (0 / ${uniqueUrls.length})...`);
  for (const url of uniqueUrls) {
    const bytes = await fetchImageAsBytes(url);
    if (bytes) {
      imageCache[url] = bytes;
      fetched++;
    }
    setProgress(fetched, uniqueUrls.length, `Stahuju obrázky (${fetched} / ${uniqueUrls.length})...`);
  }
  log(`Staženo ${fetched} / ${uniqueUrls.length} obrázků`);

  // 3. Send to sandbox
  setProgress(0, totalWs, 'Předávám do Figma sandboxu...');
  log('Odesílám data do Figmy...');

  const worksheets = selectedWorksheets.map(ws => ({
    id: ws.id,
    name: ws.name,
    blocks: (Array.isArray(ws.content) ? ws.content : []).map((b: any, i: number) => ({
      id: b.id || `block-${i}`,
      type: b.type || 'unknown',
      order: b.order ?? i,
      width: b.width,
      content: b.content || {},
    })),
  }));

  parent.postMessage({
    pluginMessage: {
      type: 'SYNC',
      worksheets,
      imageCache,
    },
  }, '*');
}

// ── Message from sandbox ──────────────────────────────────────────────────────

window.onmessage = (event) => {
  const msg = event.data?.pluginMessage;
  if (!msg) return;

  if (msg.type === 'DONE') {
    const count: number = msg.count || 0;
    el('done-msg').textContent =
      `${count} worksheet${count !== 1 ? 'y' : ''} bylo úspěšně přeneseno do Figmy.\n` +
      `Každý worksheet je nyní samostatná sekce s ${count > 0 ? 'bloky jako framy' : 'framy'}.`;
    showScreen('done');
  }

  if (msg.type === 'ERROR') {
    el('error-msg').textContent = msg.message || 'Nastala neznámá chyba.';
    showScreen('error');
  }
};

// ── Login flow ────────────────────────────────────────────────────────────────

el('btn-login').onclick = async () => {
  const emailEl = el<HTMLInputElement>('email');
  const passEl = el<HTMLInputElement>('password');
  const errEl = el('login-error');
  const btnEl = el<HTMLButtonElement>('btn-login');

  errEl.style.display = 'none';
  btnEl.disabled = true;
  btnEl.textContent = 'Přihlašuji...';

  try {
    session = await signIn(emailEl.value.trim(), passEl.value);

    // Show user pill
    const email = session.user.email;
    el('user-avatar').textContent = email.charAt(0).toUpperCase();
    el('user-email-short').textContent = email.length > 18 ? email.slice(0, 15) + '…' : email;

    // Load data
    const [wsList, folderList] = await Promise.all([
      fetchWorksheets(session.access_token, session.user.id),
      fetchFolders(session.access_token, session.user.id),
    ]);

    allWorksheets = wsList || [];
    allFolders = folderList || [];
    currentFolderId = null;
    folderStack = [{ id: null, name: 'Kořen' }];
    selectedIds.clear();

    renderPicker();
    showScreen('picker');
  } catch (e: any) {
    errEl.textContent = e.message || 'Přihlášení selhalo.';
    errEl.style.display = 'block';
  } finally {
    btnEl.disabled = false;
    btnEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Přihlásit se`;
  }
};

// Allow Enter key in password field
el<HTMLInputElement>('password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') el('btn-login').click();
});

// ── Picker actions ────────────────────────────────────────────────────────────

el('btn-select-all').onclick = () => {
  allWorksheets
    .filter(w => w.folder_id === currentFolderId)
    .forEach(w => selectedIds.add(w.id));
  renderPicker();
};

el('btn-deselect-all').onclick = () => {
  allWorksheets
    .filter(w => w.folder_id === currentFolderId)
    .forEach(w => selectedIds.delete(w.id));
  renderPicker();
};

el('btn-sync').onclick = () => startSync();

el('btn-logout').onclick = () => {
  session = null;
  allWorksheets = [];
  allFolders = [];
  selectedIds.clear();
  el<HTMLInputElement>('password').value = '';
  el('login-error').style.display = 'none';
  showScreen('login');
};

// ── Done / Error screens ──────────────────────────────────────────────────────

el('btn-close').onclick = () => {
  parent.postMessage({ pluginMessage: { type: 'CANCEL' } }, '*');
};

el('btn-back-picker').onclick = () => {
  selectedIds.clear();
  renderPicker();
  showScreen('picker');
};

el('btn-back-error').onclick = () => showScreen('picker');

// ── Utilities ─────────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
