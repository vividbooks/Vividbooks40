export type AnnotationGridPresetId =
  | 'blank'
  | 'grid-lg'
  | 'grid-sm'
  | 'lines-lg'
  | 'lines-sm'
  | 'columns-lg'
  | 'columns-sm'
  | 'dots-lg'
  | 'dots-sm'
  | 'fields-6'
  | 'fields-4'
  | 'fields-3'
  | 'fields-2';

export type AnnotationStrokeStyle = 'solid' | 'dashed';
export type AnnotationBrushKind = 'pen' | 'highlighter';

export type AnnotationActiveTool =
  | 'select'
  | 'laser'
  | 'brush'
  | 'text'
  | 'symbols'
  | 'image'
  | 'eraser';

export type AnnotationToolbarAction = 'capture' | 'undo' | 'redo' | 'trash';

export interface AnnotationPoint {
  x: number;
  y: number;
}

export interface AnnotationStrokeObject {
  id: string;
  kind: 'stroke';
  points: AnnotationPoint[];
  color: string;
  size: number;
  brushKind: AnnotationBrushKind;
  strokeStyle: AnnotationStrokeStyle;
}

export interface AnnotationTextObject {
  id: string;
  kind: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: string;
  fontSize: number;
}

export interface AnnotationImageObject {
  id: string;
  kind: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  url: string;
  alt?: string;
}

export type AnnotationObject =
  | AnnotationStrokeObject
  | AnnotationTextObject
  | AnnotationImageObject;

export interface AnnotationSlideSnapshot {
  sheetEnabled: boolean;
  sheetPreset: AnnotationGridPresetId;
  objects: AnnotationObject[];
}

export interface AnnotationSlideState extends AnnotationSlideSnapshot {
  past: AnnotationSlideSnapshot[];
  future: AnnotationSlideSnapshot[];
}

export interface AnnotationLaserStroke {
  id: string;
  points: AnnotationPoint[];
  color: string;
  size: number;
  expiresAt: number;
}
