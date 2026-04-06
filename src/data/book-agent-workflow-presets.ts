/**
 * Vestavěné šablony workflow agentů (např. Curriculum Factory).
 * Kroky jsou šablony bez id — při vytvoření workflow se z nich generují `BookAgentPipelineStep`.
 */

import {
  createBookAgentPipelineStep,
  createBookAgentWorkflow,
  type BookAgentDatasetOutputMode,
  type BookAgentPipelineModelId,
  type BookAgentWorkflow,
} from '../types/book-agent-pipeline';
import { CURRICULUM_FACTORY_WORKFLOW_STEPS } from './curriculum-factory-agents';

export type BookAgentWorkflowPresetStepTemplate = {
  name: string;
  rolePrompt: string;
  modelId: BookAgentPipelineModelId;
  /** Výchozí režim výstupu — Curriculum Factory používá složky u většiny agentů */
  datasetOutputMode?: BookAgentDatasetOutputMode;
};

export type BookAgentWorkflowPresetDefinition = {
  id: string;
  name: string;
  description: string;
  steps: BookAgentWorkflowPresetStepTemplate[];
};

/**
 * Stejní agenti jako v admin Curriculum Factory (`CurriculumFactoryV2` + `utils/curriculum/agents.ts`).
 */
export const CURRICULUM_FACTORY_PRESET: BookAgentWorkflowPresetDefinition = {
  id: 'curriculum-factory',
  name: 'Curriculum Factory',
  description:
    'RVP Scout → Planner → Data Collector → Creator → Publisher — odpovídá pipeline v `src/utils/curriculum/agents.ts`.',
  steps: CURRICULUM_FACTORY_WORKFLOW_STEPS.map((s) => ({
    name: s.name,
    rolePrompt: s.rolePrompt,
    modelId: s.modelId,
    datasetOutputMode: s.datasetOutputMode,
  })),
};

export const BOOK_AGENT_WORKFLOW_PRESETS: BookAgentWorkflowPresetDefinition[] = [CURRICULUM_FACTORY_PRESET];

export function getWorkflowPresetById(id: string): BookAgentWorkflowPresetDefinition | undefined {
  return BOOK_AGENT_WORKFLOW_PRESETS.find((p) => p.id === id);
}

/** Nové workflow z vestavěné šablony (čerstvé id kroků). */
export function createWorkflowFromPreset(def: BookAgentWorkflowPresetDefinition): BookAgentWorkflow {
  const steps = def.steps.map((t) =>
    createBookAgentPipelineStep({
      name: t.name,
      rolePrompt: t.rolePrompt,
      modelId: t.modelId,
      ...(t.datasetOutputMode !== undefined ? { datasetOutputMode: t.datasetOutputMode } : {}),
    }),
  );
  return createBookAgentWorkflow({ name: def.name, steps, presetId: def.id });
}
