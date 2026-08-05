/**
 * A2.8 sequences/drips — internal types for the drip engine.
 * Sequences are time-delayed action chains (steps with delayDays) executed
 * against one lead per run. Actions reuse the automation engine's kinds
 * (see ../automation/types.ts) and are dispatched via ActionDispatcher.
 */

export type SequenceRunStatus = 'queued' | 'running' | 'success' | 'failed';

/** One step as the wire accepts it (stepOrder defaults to array index). */
export interface SequenceStepInput {
  stepOrder?: number;
  /** Days after run start before the step fires (0 = immediate). */
  delayDays?: number;
  /** Action descriptor { kind, config } — automation engine kinds. */
  action: { kind: string; config?: Record<string, unknown> };
}

export interface CreateSequenceDto {
  name: string;
  description?: string;
  isActive?: boolean;
  /** Trigger config (e.g. {kind:'manual'} or {kind:'lead_created'}). */
  trigger?: Record<string, unknown>;
  steps?: SequenceStepInput[];
}

export interface UpdateSequenceDto {
  name?: string;
  description?: string;
  isActive?: boolean;
  trigger?: Record<string, unknown>;
  /** When provided, replaces the full step list. */
  steps?: SequenceStepInput[];
}

export interface SequenceStepView {
  id: string;
  sequenceId: string;
  stepOrder: number;
  delayDays: number;
  action: Record<string, unknown>;
}

export interface SequenceView {
  id: string;
  enterpriseId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  trigger: Record<string, unknown>;
  steps: SequenceStepView[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SequenceRunView {
  id: string;
  sequenceId: string;
  enterpriseId: string;
  leadId: string | null;
  status: SequenceRunStatus;
  startedAt: Date;
  finishedAt: Date | null;
  currentStep: number;
  error: string | null;
}
