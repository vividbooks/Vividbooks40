/**
 * Kanonická definice agentů Curriculum Factory — stejná jako `AGENTS` v
 * `CurriculumFactoryV2.tsx` a role podle `src/utils/curriculum/agents.ts`
 * (runAgent1, runAgent2, runAgent3DataSet, runAgent4DataSet, runAgent6DataSet).
 */

import type { BookAgentDatasetOutputMode, BookAgentPipelineModelId } from '../types/book-agent-pipeline';

export type CurriculumFactoryOutputType = 'rvp' | 'plans' | 'datasets' | 'materials' | 'published';

/** Metadata pro UI (sidebar „AGENTI“) — názvy a popisy 1:1 z CurriculumFactoryV2 */
export const CURRICULUM_FACTORY_AGENTS_META: readonly {
  id: number;
  name: string;
  description: string;
  color: string;
  outputType: CurriculumFactoryOutputType;
}[] = [
  {
    id: 1,
    name: 'RVP Scout',
    description: 'Stáhne RVP témata a kompetence',
    color: '#3B82F6',
    outputType: 'rvp',
  },
  {
    id: 2,
    name: 'Planner',
    description: 'Rozloží učivo do týdenních plánů',
    color: '#8B5CF6',
    outputType: 'plans',
  },
  {
    id: 3,
    name: 'Data Collector',
    description: 'Vytvoří DataSety (pojmy, fakta, obrázky)',
    color: '#EC4899',
    outputType: 'datasets',
  },
  {
    id: 4,
    name: 'Creator',
    description: 'Generuje materiály z DataSetů',
    color: '#F59E0B',
    outputType: 'materials',
  },
  {
    id: 5,
    name: 'Publisher',
    description: 'Ukládá do admin knihovny',
    color: '#10B981',
    outputType: 'published',
  },
] as const;

/**
 * Role pro pipeline knihy — odkazují na skutečnou implementaci v agents.ts.
 * Model: Pro = gemini-3.1-pro (viz AI_MODEL_PRO v agents.ts → mapuje se přes proxy);
 * Publisher = rychlé skládání / zápis jako Agent 6 → gemini-3-flash.
 */
const ROLE_RVP_SCOUT = [
  'Agent 1: RVP Scout (`runAgent1` v `src/utils/curriculum/agents.ts`).',
  'Analyzuje RVP, pracuje s `curriculum_rvp_data` (témata, ročníky, očekávané výstupy), obohacuje témata AI.',
  'Úkol: z výchozího zadání (předmět, ročník) připrav strukturovaný výstup pro Planner — témata RVP a kompetence ve formátu JSON.',
].join('\n');

const ROLE_PLANNER = [
  'Agent 2: Planner (`runAgent2` v `src/utils/curriculum/agents.ts`).',
  'Navrhuje learning units (Bloom, typy materiálů), staví context chain, rozkládá jednotky do školních týdnů, ukládá `learning_units` + `weekly_plans`.',
  'Vstup: dataset z RVP Scout. Výstup: JSON learning units a týdenní plány pro Data Collector.',
].join('\n');

const ROLE_DATA_COLLECTOR = [
  'Agent 3 (DataSet): Data Collector (`runAgent3DataSet` v `src/utils/curriculum/agents.ts`).',
  'Vytváří DataSety z týdenních plánů (nebo fallback z RVP témat): `topic_data_sets` s obsahem, pojmy, fakty a médii.',
  'Vstup: výstup Planneru + RVP. Výstup: ID a struktura DataSetů pro Creator.',
].join('\n');

const ROLE_CREATOR = [
  'Agent 4 (DataSet): Creator (`runAgent4DataSet` v `src/utils/curriculum/agents.ts`).',
  'Generuje materiály z DataSetů přes material-generators (`generated_materials` v `topic_data_sets`).',
  'Vstup: DataSet(y). Výstup: vygenerované materiály (worksheet, board, text…) připravené k publikaci.',
].join('\n');

const ROLE_PUBLISHER = [
  'Agent 6 (DataSet): Publisher / Assembler (`runAgent6DataSet` v `src/utils/curriculum/agents.ts`).',
  'Bere `generated_materials` z DataSetů a publikuje do admin struktury (`teacher_worksheets`, `teacher_boards`, `teacher_documents`…), označuje `copied_from: curriculum-factory-dataset`.',
  'Vstup: DataSety s materiály. Výstup: přehled publikovaných položek podle složek.',
].join('\n');

const ROLES = [ROLE_RVP_SCOUT, ROLE_PLANNER, ROLE_DATA_COLLECTOR, ROLE_CREATOR, ROLE_PUBLISHER];

/** Modely pro book pipeline (aliasy z ai-chat) — Pro pro 1–4, Flash pro Publisher */
const MODELS: BookAgentPipelineModelId[] = [
  'gemini-3.1-pro',
  'gemini-3.1-pro',
  'gemini-3.1-pro',
  'gemini-3.1-pro',
  'gemini-3-flash',
];

/** RVP / plány / datasety = více „složek“; creator často jeden blok; publisher přehled publikace. */
const OUTPUT_MODES: BookAgentDatasetOutputMode[] = ['folders', 'folders', 'folders', 'single', 'folders'];

export const CURRICULUM_FACTORY_WORKFLOW_STEPS: {
  name: string;
  rolePrompt: string;
  modelId: BookAgentPipelineModelId;
  datasetOutputMode: BookAgentDatasetOutputMode;
}[] = CURRICULUM_FACTORY_AGENTS_META.map((m, i) => ({
  name: m.name,
  rolePrompt: `${m.description}\n\n${ROLES[i]}`,
  modelId: MODELS[i]!,
  datasetOutputMode: OUTPUT_MODES[i] ?? 'folders',
}));
