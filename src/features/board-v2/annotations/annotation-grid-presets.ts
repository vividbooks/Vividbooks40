import type { CSSProperties } from 'react';
import type { AnnotationGridPresetId } from './annotation-types';

export const ANNOTATION_GRID_PRESETS: Array<{ id: AnnotationGridPresetId; label: string }> = [
  { id: 'blank', label: 'Prázdné' },
  { id: 'grid-lg', label: 'Čtverečky velké' },
  { id: 'grid-sm', label: 'Čtverečky malé' },
  { id: 'lines-lg', label: 'Linky velké' },
  { id: 'lines-sm', label: 'Linky malé' },
  { id: 'columns-lg', label: 'Sloupce velké' },
  { id: 'columns-sm', label: 'Sloupce malé' },
  { id: 'dots-lg', label: 'Tečky velké' },
  { id: 'dots-sm', label: 'Tečky malé' },
  { id: 'fields-6', label: '6 polí' },
  { id: 'fields-4', label: '4 pole' },
  { id: 'fields-3', label: '3 pole' },
  { id: 'fields-2', label: '2 pole' },
];

const BASE_GRID_COLOR = 'rgba(84, 99, 145, 0.16)';
const STRONG_GRID_COLOR = 'rgba(84, 99, 145, 0.22)';

export function getAnnotationSheetStyle(preset: AnnotationGridPresetId): CSSProperties {
  switch (preset) {
    case 'grid-lg':
      return {
        backgroundColor: '#ffffff',
        backgroundImage: `
          linear-gradient(${BASE_GRID_COLOR} 1px, transparent 1px),
          linear-gradient(90deg, ${BASE_GRID_COLOR} 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
      };
    case 'grid-sm':
      return {
        backgroundColor: '#ffffff',
        backgroundImage: `
          linear-gradient(${BASE_GRID_COLOR} 1px, transparent 1px),
          linear-gradient(90deg, ${BASE_GRID_COLOR} 1px, transparent 1px)
        `,
        backgroundSize: '24px 24px',
      };
    case 'lines-lg':
      return {
        backgroundColor: '#ffffff',
        backgroundImage: `linear-gradient(${BASE_GRID_COLOR} 1px, transparent 1px)`,
        backgroundSize: '100% 40px',
      };
    case 'lines-sm':
      return {
        backgroundColor: '#ffffff',
        backgroundImage: `linear-gradient(${BASE_GRID_COLOR} 1px, transparent 1px)`,
        backgroundSize: '100% 24px',
      };
    case 'columns-lg':
      return {
        backgroundColor: '#ffffff',
        backgroundImage: `linear-gradient(90deg, ${BASE_GRID_COLOR} 1px, transparent 1px)`,
        backgroundSize: '72px 100%',
      };
    case 'columns-sm':
      return {
        backgroundColor: '#ffffff',
        backgroundImage: `linear-gradient(90deg, ${BASE_GRID_COLOR} 1px, transparent 1px)`,
        backgroundSize: '40px 100%',
      };
    case 'dots-lg':
      return {
        backgroundColor: '#ffffff',
        backgroundImage: `radial-gradient(circle, ${STRONG_GRID_COLOR} 1.5px, transparent 1.5px)`,
        backgroundSize: '32px 32px',
      };
    case 'dots-sm':
      return {
        backgroundColor: '#ffffff',
        backgroundImage: `radial-gradient(circle, ${STRONG_GRID_COLOR} 1.25px, transparent 1.25px)`,
        backgroundSize: '20px 20px',
      };
    case 'fields-6':
      return {
        backgroundColor: '#ffffff',
        backgroundImage: `
          linear-gradient(${STRONG_GRID_COLOR} 2px, transparent 2px),
          linear-gradient(90deg, ${STRONG_GRID_COLOR} 2px, transparent 2px)
        `,
        backgroundSize: '33.333% 50%',
      };
    case 'fields-4':
      return {
        backgroundColor: '#ffffff',
        backgroundImage: `
          linear-gradient(${STRONG_GRID_COLOR} 2px, transparent 2px),
          linear-gradient(90deg, ${STRONG_GRID_COLOR} 2px, transparent 2px)
        `,
        backgroundSize: '50% 50%',
      };
    case 'fields-3':
      return {
        backgroundColor: '#ffffff',
        backgroundImage: `linear-gradient(90deg, ${STRONG_GRID_COLOR} 2px, transparent 2px)`,
        backgroundSize: '33.333% 100%',
      };
    case 'fields-2':
      return {
        backgroundColor: '#ffffff',
        backgroundImage: `linear-gradient(90deg, ${STRONG_GRID_COLOR} 2px, transparent 2px)`,
        backgroundSize: '50% 100%',
      };
    case 'blank':
    default:
      return {
        backgroundColor: '#ffffff',
      };
  }
}

export function getAnnotationPresetLabel(preset: AnnotationGridPresetId): string {
  return ANNOTATION_GRID_PRESETS.find((item) => item.id === preset)?.label || 'Prázdné';
}
