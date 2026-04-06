/**
 * Horizontální pipeline agentů pro knihu — jeden sloupec = jeden agent,
 * výstup předchozího kroku je vstupem dalšího; poslední uzel „Kniha“ bere finální dataset.
 *
 * Modely odpovídají aliasům v `supabase/functions/ai-chat/index.ts` (mapování na Gemini 3.x).
 */

export type BookAgentPipelineSchemaVersion = 1;

/** Alias předávaný do `chatWithAIProxy` — stejné jako v projektových pravidlech Gemini */
export type BookAgentPipelineModelId =
  | 'gemini-3.1-pro'
  | 'gemini-3-flash'
  | 'gemini-image-flash'
  | 'gemini-image-pro';

export const DEFAULT_BOOK_AGENT_PIPELINE_MODEL_ID: BookAgentPipelineModelId = 'gemini-3.1-pro';

const MODEL_IDS = new Set<string>([
  'gemini-3.1-pro',
  'gemini-3-flash',
  'gemini-image-flash',
  'gemini-image-pro',
]);

export const BOOK_AGENT_PIPELINE_MODEL_OPTIONS: {
  id: BookAgentPipelineModelId;
  label: string;
  hint: string;
}[] = [
  {
    id: 'gemini-3.1-pro',
    label: 'Gemini 3.1 Pro',
    hint: 'Nejlepší reasoning, složité úlohy, učebnice',
  },
  {
    id: 'gemini-3-flash',
    label: 'Gemini 3 Flash',
    hint: 'Rychlé úlohy, chat, jednoduché generování',
  },
  {
    id: 'gemini-image-flash',
    label: 'Gemini 3.1 Flash Image',
    hint: 'Generování obrázků, rychlé ilustrace',
  },
  {
    id: 'gemini-image-pro',
    label: 'Gemini 3 Pro Image',
    hint: 'Vysoká kvalita ilustrací',
  },
];

export function normalizeBookAgentPipelineModelId(raw: unknown): BookAgentPipelineModelId {
  if (typeof raw === 'string' && MODEL_IDS.has(raw)) {
    return raw as BookAgentPipelineModelId;
  }
  return DEFAULT_BOOK_AGENT_PIPELINE_MODEL_ID;
}

/** Jeden JSON artefakt vs. struktura více složek/souborů (Curriculum Factory). */
export type BookAgentDatasetOutputMode = 'single' | 'folders';

export const DEFAULT_BOOK_AGENT_DATASET_OUTPUT_MODE: BookAgentDatasetOutputMode = 'single';

export function normalizeBookAgentDatasetOutputMode(raw: unknown): BookAgentDatasetOutputMode {
  if (raw === 'folders' || raw === 'single') return raw;
  return DEFAULT_BOOK_AGENT_DATASET_OUTPUT_MODE;
}

export type BookAgentPipelineStep = {
  id: string;
  /** Zobrazovaný název sloupce */
  name: string;
  /** Co má agent dělat — systémový / uživatelský popis role */
  rolePrompt: string;
  /** Model volaný přes AI proxy (`chatWithAIProxy`) */
  modelId: BookAgentPipelineModelId;
  /** Jeden soubor vs. více složek/souborů v JSON (ovlivní prompt i náhled). */
  datasetOutputMode: BookAgentDatasetOutputMode;
  /** Náhled / JSON výstupního datasetu (po napojení generování) */
  datasetPreview?: string;
};

export type BookAgentPipelineState = {
  schemaVersion: BookAgentPipelineSchemaVersion;
  steps: BookAgentPipelineStep[];
};

/** Jedna uložená varianta pipeline (jako jeden design systém v seznamu). */
export type BookAgentWorkflow = {
  id: string;
  name: string;
  steps: BookAgentPipelineStep[];
  /** ISO čas poslední úpravy (řazení v „Historii“ + štítek Upraveno) */
  updatedAt?: string;
  /** Vestavěná šablona, pokud workflow vzniklo z presetu */
  presetId?: string;
};

export type BookAgentWorkspaceSchemaVersion = 2;

/** Celý stav editoru: více workflow, aktivní výběr (localStorage na knihu). */
export type BookAgentWorkspaceState = {
  schemaVersion: BookAgentWorkspaceSchemaVersion;
  workflows: BookAgentWorkflow[];
  activeWorkflowId: string;
};

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `step_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function createBookAgentPipelineStep(
  partial?: Partial<
    Pick<BookAgentPipelineStep, 'name' | 'rolePrompt' | 'datasetPreview' | 'modelId' | 'datasetOutputMode'>
  >,
): BookAgentPipelineStep {
  const modelId = normalizeBookAgentPipelineModelId(partial?.modelId);
  const datasetOutputMode = normalizeBookAgentDatasetOutputMode(partial?.datasetOutputMode);
  return {
    id: randomId(),
    name: partial?.name?.trim() || 'Nový agent',
    rolePrompt: partial?.rolePrompt ?? '',
    modelId,
    datasetOutputMode,
    ...(partial?.datasetPreview !== undefined ? { datasetPreview: partial.datasetPreview } : {}),
  };
}

export function createEmptyBookAgentPipeline(): BookAgentPipelineState {
  return { schemaVersion: 1, steps: [] };
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function bookAgentWorkflowWithTouch(wf: BookAgentWorkflow): BookAgentWorkflow {
  return { ...wf, updatedAt: nowIso() };
}

export function createBookAgentWorkflow(
  partial?: Partial<Pick<BookAgentWorkflow, 'name' | 'steps' | 'presetId' | 'updatedAt'>>,
): BookAgentWorkflow {
  return {
    id: randomId(),
    name: partial?.name?.trim() || 'Nový workflow',
    steps: partial?.steps ?? [],
    updatedAt: partial?.updatedAt ?? nowIso(),
    ...(partial?.presetId ? { presetId: partial.presetId } : {}),
  };
}

export function cloneBookAgentPipelineSteps(steps: BookAgentPipelineStep[]): BookAgentPipelineStep[] {
  return steps.map((s) =>
    createBookAgentPipelineStep({
      name: s.name,
      rolePrompt: s.rolePrompt,
      modelId: s.modelId,
      datasetOutputMode: s.datasetOutputMode,
      ...(s.datasetPreview !== undefined ? { datasetPreview: s.datasetPreview } : {}),
    }),
  );
}

export function migrateBookAgentPipelineV1ToWorkspace(v1: BookAgentPipelineState): BookAgentWorkspaceState {
  const wf = createBookAgentWorkflow({ name: 'Výchozí', steps: cloneBookAgentPipelineSteps(v1.steps) });
  return {
    schemaVersion: 2,
    workflows: [wf],
    activeWorkflowId: wf.id,
  };
}

export function createEmptyBookAgentWorkspace(): BookAgentWorkspaceState {
  const wf = createBookAgentWorkflow({ name: 'Nový workflow', steps: [] });
  return {
    schemaVersion: 2,
    workflows: [wf],
    activeWorkflowId: wf.id,
  };
}

export function parseBookAgentWorkspaceState(raw: unknown): BookAgentWorkspaceState | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion !== 2) return null;
  if (!Array.isArray(o.workflows)) return null;
  const workflows: BookAgentWorkflow[] = [];
  for (const w of o.workflows) {
    if (!w || typeof w !== 'object') continue;
    const wr = w as Record<string, unknown>;
    if (typeof wr.id !== 'string' || !wr.id.trim()) continue;
    if (typeof wr.name !== 'string' || !wr.name.trim()) continue;
    if (!Array.isArray(wr.steps)) continue;
    const steps: BookAgentPipelineStep[] = [];
    for (const item of wr.steps) {
      if (!item || typeof item !== 'object') continue;
      const s = item as Record<string, unknown>;
      if (typeof s.id !== 'string' || !s.id.trim()) continue;
      const datasetPreview =
        typeof s.datasetPreview === 'string' && s.datasetPreview.trim() ? s.datasetPreview : undefined;
      const modelId = normalizeBookAgentPipelineModelId(s.modelId);
      const datasetOutputMode = normalizeBookAgentDatasetOutputMode(s.datasetOutputMode);
      steps.push({
        id: s.id,
        name: typeof s.name === 'string' && s.name.trim() ? s.name.trim() : 'Agent',
        rolePrompt: typeof s.rolePrompt === 'string' ? s.rolePrompt : '',
        modelId,
        datasetOutputMode,
        ...(datasetPreview !== undefined ? { datasetPreview } : {}),
      });
    }
    const presetId =
      typeof wr.presetId === 'string' && wr.presetId.trim() ? wr.presetId.trim() : undefined;
    const updatedAt =
      typeof wr.updatedAt === 'string' && wr.updatedAt.trim() ? wr.updatedAt.trim() : nowIso();
    workflows.push({
      id: wr.id,
      name: wr.name.trim(),
      steps,
      updatedAt,
      ...(presetId ? { presetId } : {}),
    });
  }
  if (workflows.length === 0) return null;
  let activeWorkflowId =
    typeof o.activeWorkflowId === 'string' && o.activeWorkflowId.trim()
      ? o.activeWorkflowId.trim()
      : workflows[0].id;
  if (!workflows.some((w) => w.id === activeWorkflowId)) {
    activeWorkflowId = workflows[0].id;
  }
  return { schemaVersion: 2, workflows, activeWorkflowId };
}

export function parseBookAgentPipelineState(raw: unknown): BookAgentPipelineState | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion !== 1) return null;
  if (!Array.isArray(o.steps)) return null;
  const steps: BookAgentPipelineStep[] = [];
  for (const item of o.steps) {
    if (!item || typeof item !== 'object') continue;
    const s = item as Record<string, unknown>;
    if (typeof s.id !== 'string' || !s.id.trim()) continue;
    const datasetPreview =
      typeof s.datasetPreview === 'string' && s.datasetPreview.trim() ? s.datasetPreview : undefined;
    const modelId = normalizeBookAgentPipelineModelId(s.modelId);
    const datasetOutputMode = normalizeBookAgentDatasetOutputMode(s.datasetOutputMode);
    steps.push({
      id: s.id,
      name: typeof s.name === 'string' && s.name.trim() ? s.name.trim() : 'Agent',
      rolePrompt: typeof s.rolePrompt === 'string' ? s.rolePrompt : '',
      modelId,
      datasetOutputMode,
      ...(datasetPreview !== undefined ? { datasetPreview } : {}),
    });
  }
  return { schemaVersion: 1, steps };
}
