/**
 * Události pro UI během multi-krokového generování design systému z briefu.
 */

export type DesignSystemPipelineEvent = {
  stepId: string;
  /** Krátký text do „bobánku“ */
  label: string;
  status: 'running' | 'done' | 'error';
  detail?: string;
};
