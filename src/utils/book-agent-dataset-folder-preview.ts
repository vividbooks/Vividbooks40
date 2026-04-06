/**
 * Parsuje JSON výstup agenta (režim „složky“) na řádky pro náhled ve stylu RVP Scout.
 */

export type BookAgentFolderPreviewRow = {
  label: string;
  count: number;
  sub?: string;
  /** Původní položka ze struktury — pro rozbalení a zobrazení obsahu */
  detail: unknown;
};

function stripCodeFence(s: string): string {
  let t = s.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '');
    t = t.replace(/\s*```$/s, '');
  }
  return t.trim();
}

function countNested(item: Record<string, unknown>): number {
  if (Array.isArray(item.podkapitoly)) return item.podkapitoly.length;
  if (Array.isArray(item.soubory)) return item.soubory.length;
  if (Array.isArray(item.items)) return item.items.length;
  if (Array.isArray(item.children)) return item.children.length;
  if (typeof item.pocet === 'number' && Number.isFinite(item.pocet)) return Math.max(0, Math.floor(item.pocet));
  return 0;
}

function rowFromItem(item: unknown): BookAgentFolderPreviewRow | null {
  if (!item || typeof item !== 'object') return null;
  const x = item as Record<string, unknown>;
  const label = String(
    x.nazev ?? x.name ?? x.titulek ?? x.tema ?? x.title ?? x.slozka ?? x.label ?? '',
  ).trim();
  if (!label) return null;
  const count = countNested(x);
  const sub = typeof x.soubor === 'string' && x.soubor.trim() ? x.soubor.trim() : undefined;
  return { label, count, sub, detail: item };
}

function rowsFromArray(arr: unknown[]): BookAgentFolderPreviewRow[] {
  const out: BookAgentFolderPreviewRow[] = [];
  for (const el of arr) {
    const r = rowFromItem(el);
    if (r) out.push(r);
  }
  return out;
}

/**
 * Vrátí řádky pro seznam „složek“, nebo null pokud JSON nepoznáme / nejde parsovat.
 */
export function tryParseFolderRowsFromDatasetPreview(text: string): BookAgentFolderPreviewRow[] | null {
  const stripped = stripCodeFence(text);
  if (!stripped.startsWith('{') && !stripped.startsWith('[')) return null;
  let data: unknown;
  try {
    data = JSON.parse(stripped);
  } catch {
    return null;
  }

  if (Array.isArray(data)) {
    const rows = rowsFromArray(data);
    return rows.length > 0 ? rows : null;
  }

  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;

  if (o.ucebnice && typeof o.ucebnice === 'object') {
    const u = o.ucebnice as Record<string, unknown>;
    if (Array.isArray(u.struktura)) {
      const rows = rowsFromArray(u.struktura);
      if (rows.length > 0) return rows;
    }
  }

  if (Array.isArray(o.struktura)) {
    const rows = rowsFromArray(o.struktura);
    if (rows.length > 0) return rows;
  }

  for (const key of ['temata', 'témata', 'topics', 'kapitoly', 'položky', 'polozky', 'items', 'rvp_temata']) {
    if (Array.isArray(o[key])) {
      const rows = rowsFromArray(o[key] as unknown[]);
      if (rows.length > 0) return rows;
    }
  }

  if (o.dataset && typeof o.dataset === 'object') {
    const d = o.dataset as Record<string, unknown>;
    if (Array.isArray(d.struktura)) {
      const rows = rowsFromArray(d.struktura);
      if (rows.length > 0) return rows;
    }
  }

  return null;
}
