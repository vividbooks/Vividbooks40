import type { DesignSystem, DesignSystemBlockVisualStylePreset } from '../types/design-system';
import type { BlockVisualStyles } from '../types/worksheet';
import { BLOCK_VISUAL_STYLE_PRESETS } from '../components/worksheet-editor-pro/block-settings/VisualStylesSection';

export const BVS_PLAIN_ID = 'bvs-plain';
export const BVS_INFOBOX_ID = 'bvs-infobox';

/** Stejná logika jako u výběru presetu na plátně — ignoruje `padding`. */
export function matchBlockVisualPresetStyleId(vs: BlockVisualStyles | undefined): string {
  if (!vs) return 'none';
  const { padding: _pad, textColumns: _tc, ...rest } = vs;
  if (!rest.backgroundColor && !rest.borderColor && !rest.shadow) return 'none';
  for (const preset of BLOCK_VISUAL_STYLE_PRESETS) {
    if (preset.id === 'none') continue;
    const ps = preset.styles;
    if (
      rest.backgroundColor === ps.backgroundColor &&
      rest.borderColor === ps.borderColor &&
      rest.borderWidth === ps.borderWidth &&
      rest.borderStyle === ps.borderStyle &&
      rest.borderRadius === ps.borderRadius &&
      rest.shadow === ps.shadow
    ) {
      return preset.id;
    }
  }
  return 'custom';
}

export function defaultBlockVisualPresetIdForLegacy(ds: DesignSystem): string {
  const dvs = ds.blockPreferences.defaultVisualStyles ?? {};
  const activeId = matchBlockVisualPresetStyleId(dvs);
  const hasChrome = !!(
    dvs.backgroundColor ||
    dvs.borderColor ||
    (dvs.shadow && dvs.shadow !== 'none')
  );
  if (activeId === 'none' && !hasChrome) return BVS_PLAIN_ID;
  return BVS_INFOBOX_ID;
}

/**
 * Seznam presetů pro UI — uložený nebo odvozený ze starého jediného `defaultVisualStyles`.
 */
export function resolveBlockVisualStylePresets(ds: DesignSystem): DesignSystemBlockVisualStylePreset[] {
  const stored = ds.blockPreferences.blockVisualStylePresets;
  if (stored && stored.length > 0) return stored;

  const dvs = ds.blockPreferences.defaultVisualStyles ?? {};
  const pad =
    typeof dvs.padding === 'number' && Number.isFinite(dvs.padding)
      ? Math.min(64, Math.max(0, Math.round(dvs.padding)))
      : 12;
  const highlight = BLOCK_VISUAL_STYLE_PRESETS.find((p) => p.id === 'highlight')!.styles as BlockVisualStyles;
  const activeId = matchBlockVisualPresetStyleId(dvs);
  const hasChrome = !!(
    dvs.backgroundColor ||
    dvs.borderColor ||
    (dvs.shadow && dvs.shadow !== 'none')
  );

  const plainStyles: BlockVisualStyles = { padding: pad };
  let infoboxStyles: BlockVisualStyles = { ...highlight, padding: pad };
  if (activeId !== 'none' && hasChrome) {
    infoboxStyles = { ...dvs, padding: pad };
  }

  return [
    { id: BVS_PLAIN_ID, role: 'plain', name: 'Bez ničeho', styles: plainStyles },
    { id: BVS_INFOBOX_ID, role: 'infobox', name: 'Infobox', styles: infoboxStyles },
  ];
}

export function syncBlockPreferencesDefaultVisualWithPresets(
  bp: DesignSystem['blockPreferences'],
  presets: DesignSystemBlockVisualStylePreset[],
  dsForLegacy: DesignSystem,
): DesignSystem['blockPreferences'] {
  const fallbackId = presets[0]?.id;
  const chosenId =
    bp.defaultBlockVisualPresetId ?? defaultBlockVisualPresetIdForLegacy(dsForLegacy) ?? fallbackId;
  const p = presets.find((x) => x.id === chosenId) ?? presets[0];
  if (!p) return bp;
  return {
    ...bp,
    defaultBlockVisualPresetId: p.id,
    defaultVisualStyles: { ...p.styles },
  };
}

export function newBlockVisualPresetId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `bvs-${crypto.randomUUID()}`;
  }
  return `bvs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
