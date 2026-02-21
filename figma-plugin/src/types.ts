// ── Vividbooks block types (subset needed for Figma rendering) ──────────────

export type BlockType =
  | 'heading'
  | 'paragraph'
  | 'image'
  | 'free-answer'
  | 'multiple-choice'
  | 'fill-blank'
  | 'connect-pairs'
  | 'table'
  | 'spacer'
  | 'infobox'
  | 'examples'
  | 'qr-code';

export interface WorksheetBlock {
  id: string;
  type: BlockType;
  order: number;
  width?: number;
  content: Record<string, unknown>;
}

export interface Worksheet {
  id: string;
  name: string;
  blocks: WorksheetBlock[];
}

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
}

// ── Messages between UI iframe and plugin sandbox ────────────────────────────

export interface SyncMessage {
  type: 'SYNC';
  worksheets: Worksheet[];
  /** base64-encoded PNG per image URL */
  imageCache: Record<string, string>;
}

export interface DoneMessage {
  type: 'DONE';
  nodeCount: number;
}

export interface ErrorMessage {
  type: 'ERROR';
  message: string;
}

export interface ProgressMessage {
  type: 'PROGRESS';
  current: number;
  total: number;
  label: string;
}

export type SandboxToUI = DoneMessage | ErrorMessage | ProgressMessage;
export type UIToSandbox = SyncMessage;
