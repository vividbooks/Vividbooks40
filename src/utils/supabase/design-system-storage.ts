import { supabase } from './client';
import type { DesignSystem } from '../../types/design-system';
import { stripBase64FromObject } from './upload-image';

// ── DB row shape (snake_case) ─────────────────────────────────────────────────

interface DesignSystemRow {
  id: string;
  teacher_id: string;
  name: string;
  description: string | null;
  thumbnail_color: string | null;
  colors: unknown;
  typography: unknown;
  page_defaults: unknown;
  ai_prompts: unknown;
  block_preferences: unknown;
  /** Po migraci vždy přítomné; starší API odpovědi bez sloupce → undefined */
  dataset?: unknown;
  created_at: string;
  updated_at: string;
}

/**
 * Design systémy vytvořené před tímto okamžikem bez `dataset.referenceImageIds` v DB se chovají jako dřív:
 * UI slučuje celou sdílenou knihovnu učitele. Novější záznamy bez pole dostanou `referenceImageIds: []`
 * (jen soubory navázané na tento DS), aby „nový design systém“ neukazoval cizí obrázky.
 */
const REFERENCE_IMAGE_SCOPE_DEFAULT_EMPTY_SINCE_MS = Date.parse('2026-03-26T00:00:00.000Z');

function normalizeDatasetReferenceImageScope(
  dataset: NonNullable<DesignSystem['dataset']>,
  createdAtIso: string,
): DesignSystem['dataset'] {
  if (dataset.referenceImageIds !== undefined) {
    return dataset;
  }
  const t = Date.parse(createdAtIso);
  if (Number.isNaN(t) || t < REFERENCE_IMAGE_SCOPE_DEFAULT_EMPTY_SINCE_MS) {
    return dataset;
  }
  return { ...dataset, referenceImageIds: [] };
}

function rowToDesignSystem(row: DesignSystemRow): DesignSystem {
  const rawDataset = (row.dataset as DesignSystem['dataset']) ?? { files: [] };
  return {
    id: row.id,
    teacher_id: row.teacher_id,
    name: row.name,
    description: row.description ?? undefined,
    thumbnail_color: row.thumbnail_color ?? '#5C5CFF',
    colors: (row.colors as DesignSystem['colors']) ?? [],
    typography: (row.typography as DesignSystem['typography']) ?? { headingFont: 'Inter', bodyFont: 'Inter', baseFontSize: 'normal' },
    pageDefaults: (row.page_defaults as DesignSystem['pageDefaults']) ?? { pageFormat: 'a4', pageBackgroundColor: '#ffffff', gridColumns: 12, gridGap: 'medium' },
    aiPrompts: (row.ai_prompts as DesignSystem['aiPrompts']) ?? { imageStyle: '', negativePrompt: '', characterStyle: '' },
    blockPreferences: (row.block_preferences as DesignSystem['blockPreferences']) ?? { preferred: [] },
    dataset: normalizeDatasetReferenceImageScope(rawDataset, row.created_at),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Load all design systems owned by the current teacher */
export async function getDesignSystems(): Promise<DesignSystem[]> {
  const { data, error } = await supabase
    .from('design_systems')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[design-system-storage] getDesignSystems error:', error);
    return [];
  }
  return (data as DesignSystemRow[]).map(rowToDesignSystem);
}

/** Load a single design system by ID */
export async function getDesignSystem(id: string): Promise<DesignSystem | null> {
  const { data, error } = await supabase
    .from('design_systems')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return rowToDesignSystem(data as DesignSystemRow);
}

/** Create or update a design system. Pass id to update, omit to create. */
export async function saveDesignSystem(
  ds: Omit<DesignSystem, 'id' | 'teacher_id' | 'created_at' | 'updated_at'> & { id?: string }
): Promise<DesignSystem | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const safeBlockPrefs = stripBase64FromObject(ds.blockPreferences) as DesignSystem['blockPreferences'];
  /** Bez `dataset` v objektu neposíláme sloupec — Postgres ponechá stávající hodnotu (klasický editor nesmí omylem vymazat reference). */
  const safeDataset =
    ds.dataset != null ? (stripBase64FromObject(ds.dataset) as DesignSystem['dataset']) : undefined;

  const payload = {
    ...(ds.id ? { id: ds.id } : {}),
    teacher_id: user.id,
    name: ds.name,
    description: ds.description ?? null,
    thumbnail_color: ds.thumbnail_color ?? '#5C5CFF',
    colors: ds.colors,
    typography: ds.typography,
    page_defaults: ds.pageDefaults,
    ai_prompts: ds.aiPrompts,
    block_preferences: safeBlockPrefs,
    ...(safeDataset !== undefined ? { dataset: safeDataset } : {}),
  };

  const { data, error } = await supabase
    .from('design_systems')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error || !data) {
    console.error('[design-system-storage] saveDesignSystem error:', error);
    return null;
  }
  return rowToDesignSystem(data as DesignSystemRow);
}

/** Duplicate an existing design system with a new name */
export async function duplicateDesignSystem(id: string, newName: string): Promise<DesignSystem | null> {
  const original = await getDesignSystem(id);
  if (!original) return null;

  const { id: _id, teacher_id: _tid, created_at: _ca, updated_at: _ua, ...rest } = original;
  return saveDesignSystem({ ...rest, name: newName });
}

/** Delete a design system by ID */
export async function deleteDesignSystem(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('design_systems')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[design-system-storage] deleteDesignSystem error:', error);
    return false;
  }
  return true;
}
