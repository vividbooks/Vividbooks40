import type { DesignSystem, DesignSystemTypography, TypoStyleOverride } from '../types/design-system';
import { collectGoogleFontsForPrint } from '../types/design-system';
import type {
  Worksheet,
  WorksheetBlock,
  WorksheetMetadata,
  HeadingContent,
  DesignSystemSource,
} from '../types/worksheet';
import { DEFAULT_WORKSHEET_METADATA, mergeBlockWithDefaultVisualStyles } from '../types/worksheet';

function withTextStyle<T extends Record<string, any>>(
  content: T,
  style?: TypoStyleOverride,
  force = false,
): T {
  if (!style) return content;
  return {
    ...content,
    ...((force || content.fontFamily == null) && style.fontFamily ? { fontFamily: style.fontFamily } : {}),
    ...((force || content.fontSize == null) && style.fontSize != null ? { fontSize: style.fontSize } : {}),
    ...((force || content.lineHeight == null) && style.lineHeight != null ? { lineHeight: style.lineHeight } : {}),
    ...((force || content.letterSpacing == null) && style.letterSpacing != null ? { letterSpacing: style.letterSpacing } : {}),
    ...((force || content.textColor == null) && style.textColor ? { textColor: style.textColor } : {}),
    ...((force || content.fontWeight == null) && style.fontWeight != null ? { fontWeight: String(style.fontWeight) } : {}),
    ...((force || content.isBold == null) && style.isBold != null ? { isBold: style.isBold } : {}),
    ...((force || content.isItalic == null) && style.isItalic != null ? { isItalic: style.isItalic } : {}),
    ...((force || content.isUnderline == null) && style.isUnderline != null ? { isUnderline: style.isUnderline } : {}),
  };
}

function shouldPreserve(source: DesignSystemSource | undefined, respectCustomSources: boolean): boolean {
  return respectCustomSources && source === 'custom';
}

function isTypographyContentKey(key: string): boolean {
  return (
    key === 'align' ||
    key === 'headingStyle' ||
    key === 'highlightColor' ||
    key === 'textColor' ||
    key === 'fontFamily' ||
    key === 'fontSize' ||
    key === 'fontWeight' ||
    key === 'lineHeight' ||
    key === 'letterSpacing' ||
    key === 'isBold' ||
    key === 'isItalic' ||
    key === 'isUnderline' ||
    key.endsWith('Align') ||
    key.endsWith('TextColor') ||
    key.endsWith('FontFamily') ||
    key.endsWith('FontSize') ||
    key.endsWith('FontWeight') ||
    key.endsWith('LineHeight') ||
    key.endsWith('LetterSpacing') ||
    key.endsWith('IsBold') ||
    key.endsWith('IsItalic') ||
    key.endsWith('IsUnderline')
  );
}

function stripTypographyFromContent(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stripTypographyFromContent(item));
  }
  if (!value || typeof value !== 'object') return value;

  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (isTypographyContentKey(key)) continue;
    out[key] = stripTypographyFromContent(nested);
  }
  return out;
}

function preserveField(
  specificSource: DesignSystemSource | undefined,
  fallbackSource: DesignSystemSource | undefined,
  respectCustomSources: boolean,
): boolean {
  return (
    shouldPreserve(specificSource, respectCustomSources) ||
    shouldPreserve(fallbackSource, respectCustomSources)
  );
}

function getHeadingTypographyOverride(
  typography: DesignSystemTypography,
  level: HeadingContent['level'] | undefined,
): TypoStyleOverride {
  if (level === 'h2') return typography.styles?.h2 ?? {};
  if (level === 'h3') return typography.styles?.h3 ?? {};
  return typography.styles?.h1 ?? {};
}

function applyTypographyToBlock(
  block: WorksheetBlock,
  ds: DesignSystem,
  options?: { forceTypography?: boolean; respectCustomSources?: boolean },
): WorksheetBlock {
  if (!block.content || typeof block.content !== 'object') return block;
  const forceTypography = options?.forceTypography ?? false;
  const preserveTypography = shouldPreserve(block.typographySource, options?.respectCustomSources ?? false);
  if (preserveTypography) return block;

  if (block.type === 'heading') {
    const headingContent = block.content as HeadingContent & Record<string, any>;
    const style = getHeadingTypographyOverride(ds.typography, headingContent.level);
    return {
      ...block,
      typographySource: 'design-system',
      content: withTextStyle(
        {
          ...headingContent,
          fontFamily:
            forceTypography
              ? style.fontFamily ?? `'${ds.typography.headingFont}', serif`
              : headingContent.fontFamily ??
            style.fontFamily ??
            `'${ds.typography.headingFont}', serif`,
        },
        style,
        forceTypography,
      ),
    };
  }

  if (
    block.type === 'paragraph' ||
    block.type === 'multiple-choice' ||
    block.type === 'fill-blank' ||
    block.type === 'free-answer' ||
    block.type === 'examples'
  ) {
    const bodyStyle = ds.typography.styles?.body ?? {};
    return {
      ...block,
      typographySource: 'design-system',
      content: withTextStyle(
        {
          ...(block.content as Record<string, any>),
          fontFamily:
            forceTypography
              ? bodyStyle.fontFamily ?? `'${ds.typography.bodyFont}', sans-serif`
              : (block.content as Record<string, any>).fontFamily ??
            bodyStyle.fontFamily ??
            `'${ds.typography.bodyFont}', sans-serif`,
        },
        bodyStyle,
        forceTypography,
      ),
    };
  }

  return block;
}

function applyVisualStylesToBlock(
  block: WorksheetBlock,
  ds: DesignSystem,
  options?: { respectCustomSources?: boolean },
): WorksheetBlock {
  const preserveVisualStyles = shouldPreserve(block.visualStyleSource, options?.respectCustomSources ?? false);
  if (preserveVisualStyles) return block;
  return {
    ...mergeBlockWithDefaultVisualStyles(
      { ...block, visualStyles: undefined },
      ds.blockPreferences.defaultVisualStyles,
    ),
    visualStyleSource: 'design-system',
  };
}

export function buildWorksheetMetadataFromDesignSystem(
  ds: DesignSystem,
  base?: WorksheetMetadata,
  options?: { respectCustomSources?: boolean },
): WorksheetMetadata {
  const respectCustomSources = options?.respectCustomSources ?? false;
  const preservePage = shouldPreserve(base?.pageStyleSource, respectCustomSources);
  const preserveLayout = shouldPreserve(base?.layoutStyleSource, respectCustomSources);
  const preserveDefaultVisuals = shouldPreserve(
    base?.defaultBlockVisualStylesSource,
    respectCustomSources,
  );
  const preserveTypography = shouldPreserve(
    base?.designTypographySource,
    respectCustomSources,
  );
  const preservePageFormat = preserveField(base?.pageFormatSource, base?.pageStyleSource, respectCustomSources);
  const preserveGridColumns = preserveField(base?.gridColumnsSource, base?.pageStyleSource, respectCustomSources);
  const preserveGridGap = preserveField(base?.gridGapSource, base?.pageStyleSource, respectCustomSources);
  const preservePageBackground = preserveField(
    base?.pageBackgroundColorSource,
    base?.pageStyleSource,
    respectCustomSources,
  );
  const preserveGlobalFontSize = preserveField(
    base?.globalFontSizeSource,
    base?.designTypographySource,
    respectCustomSources,
  );
  const preserveLayoutMode = preserveField(base?.layoutModeSource, base?.layoutStyleSource, respectCustomSources);
  const preservePageColumnLayout = preserveField(
    base?.pageColumnLayoutSource,
    base?.layoutStyleSource,
    respectCustomSources,
  );
  const preserveTwoColumnASpan = preserveField(
    base?.twoColumnASpanSource,
    base?.layoutStyleSource,
    respectCustomSources,
  );
  const preservePageOverrides = preserveField(
    base?.pageOverridesSource,
    base?.layoutStyleSource,
    respectCustomSources,
  );

  return {
    ...DEFAULT_WORKSHEET_METADATA,
    ...base,
    pageFormat: preservePageFormat ? base?.pageFormat : ds.pageDefaults.pageFormat,
    gridColumns: preserveGridColumns ? base?.gridColumns : ds.pageDefaults.gridColumns,
    gridGap: preserveGridGap ? base?.gridGap : ds.pageDefaults.gridGap,
    pageBackgroundColor: preservePageBackground ? base?.pageBackgroundColor : ds.pageDefaults.pageBackgroundColor,
    globalFontSize: preserveGlobalFontSize ? base?.globalFontSize : ds.typography.baseFontSize,
    layoutMode: preserveLayoutMode ? base?.layoutMode : (base?.layoutMode ?? 'grid'),
    pageColumnLayout: preservePageColumnLayout ? base?.pageColumnLayout : base?.pageColumnLayout,
    twoColumnASpan: preserveTwoColumnASpan ? base?.twoColumnASpan : base?.twoColumnASpan,
    pageOverrides: preservePageOverrides ? base?.pageOverrides : base?.pageOverrides,
    designSystemId: ds.id,
    pageStyleSource: preservePage ? base?.pageStyleSource : 'design-system',
    pageFormatSource: preservePageFormat ? base?.pageFormatSource : 'design-system',
    gridColumnsSource: preserveGridColumns ? base?.gridColumnsSource : 'design-system',
    gridGapSource: preserveGridGap ? base?.gridGapSource : 'design-system',
    pageBackgroundColorSource: preservePageBackground ? base?.pageBackgroundColorSource : 'design-system',
    layoutStyleSource: preserveLayout ? base?.layoutStyleSource : 'design-system',
    layoutModeSource: preserveLayoutMode ? base?.layoutModeSource : 'design-system',
    pageColumnLayoutSource: preservePageColumnLayout ? base?.pageColumnLayoutSource : 'design-system',
    twoColumnASpanSource: preserveTwoColumnASpan ? base?.twoColumnASpanSource : 'design-system',
    pageOverridesSource: preservePageOverrides ? base?.pageOverridesSource : 'design-system',
    designFonts: preserveTypography
      ? base?.designFonts
      : { heading: ds.typography.headingFont, body: ds.typography.bodyFont },
    printGoogleFontFamilies: preserveTypography
      ? base?.printGoogleFontFamilies
      : collectGoogleFontsForPrint(ds.typography),
    designTypographySource: preserveTypography ? base?.designTypographySource : 'design-system',
    globalFontSizeSource: preserveGlobalFontSize ? base?.globalFontSizeSource : 'design-system',
    defaultBlockVisualStyles: preserveDefaultVisuals
      ? base?.defaultBlockVisualStyles
      : ds.blockPreferences.defaultVisualStyles,
    defaultBlockVisualStylesSource: preserveDefaultVisuals
      ? base?.defaultBlockVisualStylesSource
      : 'design-system',
  };
}

export function applyDesignSystemSnapshotToWorksheet(
  worksheet: Worksheet,
  ds: DesignSystem,
  options?: { forceTypography?: boolean; respectCustomSources?: boolean },
): Worksheet {
  return {
    ...worksheet,
    metadata: buildWorksheetMetadataFromDesignSystem(ds, worksheet.metadata, {
      respectCustomSources: options?.respectCustomSources,
    }),
    blocks: (worksheet.blocks ?? [])
      .map((block) => applyVisualStylesToBlock(block, ds, {
        respectCustomSources: options?.respectCustomSources,
      }))
      .map((block) => applyTypographyToBlock(block, ds, {
        forceTypography: options?.forceTypography ?? false,
        respectCustomSources: options?.respectCustomSources,
      })),
  };
}

export function resetWorksheetPageSettingsToDesignSystem(
  metadata: WorksheetMetadata,
  ds: DesignSystem,
): WorksheetMetadata {
  return buildWorksheetMetadataFromDesignSystem(ds, {
    ...metadata,
    pageStyleSource: undefined,
    pageFormatSource: undefined,
    gridColumnsSource: undefined,
    gridGapSource: undefined,
    pageBackgroundColorSource: undefined,
    layoutStyleSource: undefined,
    layoutModeSource: undefined,
    pageColumnLayoutSource: undefined,
    twoColumnASpanSource: undefined,
    pageOverridesSource: undefined,
    designTypographySource: undefined,
    globalFontSizeSource: undefined,
    defaultBlockVisualStylesSource: undefined,
  });
}

export function resetBlockToDesignSystem(
  block: WorksheetBlock,
  ds: DesignSystem,
): WorksheetBlock {
  const stripped: WorksheetBlock = {
    ...block,
    visualStyles: undefined,
    visualStyleSource: undefined,
    typographySource: undefined,
    content: stripTypographyFromContent(block.content) as WorksheetBlock['content'],
  };

  return applyTypographyToBlock(
    applyVisualStylesToBlock(stripped, ds),
    ds,
    { forceTypography: true },
  );
}
