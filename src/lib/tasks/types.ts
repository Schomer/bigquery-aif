// src/lib/tasks/types.ts
// Type definitions for the task resolution and execution framework.

// -- ResolvedPlan: what the resolver produces --

export interface ResolvedPlan {
  title: string;
  description: string;
  approach: string;
  alternativeApproaches?: string[];
  steps: ResolvedStep[];
  fromLearnedPlan?: boolean;
  learnedPlanId?: string;
}

export interface ResolvedStep {
  id: string;
  label: string;
  description: string;
  apiCall: ApiCallSpec;
  inputs: DynamicInput[];
  outputMapping?: Record<string, string>;
  iterateOver?: string;
}

export interface ApiCallSpec {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  bodyTemplate?: Record<string, unknown>;
  headers?: Record<string, string>;
}

export interface DynamicInput {
  name: string;
  type: 'select' | 'text' | 'textarea' | 'file_upload' | 'toggle' | 'number';
  label: string;
  required: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  defaultValue?: string;
  helpText?: string;
  accept?: string;
  multiple?: boolean;
  mapsTo: string;
}

export interface TaskStepResult {
  stepId: string;
  success: boolean;
  summary: string;
  data: unknown;
  error?: string;
  artifacts: TaskArtifact[];
  outputContext?: Record<string, unknown>;
}

export interface TaskArtifact {
  type: 'code' | 'diff' | 'table' | 'download' | 'message' | 'error';
  label: string;
  content: string;
  language?: string;
  originalContent?: string;
  downloadFilename?: string;
}

// -- Learned plan: stored in Firestore --

export interface LearnedPlan {
  id: string;
  project: string;
  originalPrompt: string;
  keywords: string[];
  plan: ResolvedPlan;
  createdAt: string;
  lastUsedAt: string;
  successCount: number;
  failureCount: number;
}

// -- Top-level task result for the app --

export interface TaskResult {
  skill: 'task';
  plan: ResolvedPlan;
  status: 'planned' | 'executing' | 'completed' | 'failed';
}
