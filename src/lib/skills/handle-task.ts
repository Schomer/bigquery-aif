// src/lib/skills/handle-task.ts
// Task handler: delegates to the autonomous task resolver.
// Extracted from chat-orchestrator.ts.

import type { ChatMessage, CompositionEnvelope, SkillManifest, StatusCallback } from '../types';

export async function handleTask(
  message: string,
  _history: ChatMessage[],
  context?: { project?: string; dataset?: string; availableDatasets?: string[] },
  onStatus?: StatusCallback
): Promise<CompositionEnvelope[]> {
  const project = context?.project || '';

  onStatus?.('Researching available APIs for this task...');

  try {
    // Dynamic import to avoid loading task framework until needed
    const { resolveTask } = await import('../tasks/resolver');
    const plan = await resolveTask(message, project, 'us', onStatus);

    if (!plan || !plan.steps || plan.steps.length === 0) {
      // Resolver couldn't produce a plan -- return guidance
      const envelope: CompositionEnvelope = {
        id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        skill: 'task',
        headline: {
          text: 'Could not determine the right approach for this task.',
          tone: 'ATTENTION',
          basis: 'STATUS',
        },
        primaryArtifact: {
          type: 'TASK_VIEW',
          data: {
            plan: {
              title: 'Unable to resolve task',
              description: plan?.description || 'The system could not identify which Google Cloud APIs to use for this request. Try being more specific about what you want to accomplish.',
              approach: '',
              steps: [],
            },
            status: 'failed',
          },
        },
        provenance: { visibility: 'COLLAPSED' },
        nextActions: [],
      };
      return [envelope];
    }

    const statusNote = plan.fromLearnedPlan
      ? 'Using a previously successful approach'
      : `Found ${plan.steps.length} step${plan.steps.length !== 1 ? 's' : ''} to complete this task`;

    onStatus?.(statusNote);

    const envelope: CompositionEnvelope = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      skill: 'task',
      headline: {
        text: plan.title,
        tone: 'NEUTRAL',
        basis: 'STATUS',
      },
      primaryArtifact: {
        type: 'TASK_VIEW',
        data: {
          plan,
          status: 'planned',
        },
      },
      provenance: {
        visibility: 'COLLAPSED',
        project,
      },
      nextActions: [],
    };

    return [envelope];
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const envelope: CompositionEnvelope = {
      id: 'task_error_' + Date.now(),
      skill: 'task',
      headline: {
        text: 'Failed to plan this task',
        tone: 'ATTENTION',
        basis: 'STATUS',
      },
      primaryArtifact: {
        type: 'TASK_VIEW',
        data: {
          plan: {
            title: 'Task planning failed',
            description: `Error: ${errorMsg}. Try rephrasing your request or being more specific about the data task you want to accomplish.`,
            approach: '',
            steps: [],
          },
          status: 'failed',
        },
      },
      provenance: { visibility: 'COLLAPSED' },
      nextActions: [],
    };
    return [envelope];
  }
}

// ─── Skill manifest ───────────────────────────────────────────────────────────

export const manifest: SkillManifest = {
  skill: 'task',
  label: 'task resolver',
  signals: [
    { phrase: 'batch translation', weight: 3 },
    { phrase: 'translate sql', weight: 3 },
    { phrase: 'convert sql', weight: 3 },
    { phrase: 'migrate from', weight: 3 },
    { phrase: 'translate my', weight: 3 },
    { phrase: 'guide me through', weight: 3 },
    { phrase: 'walk me through', weight: 3 },
    { phrase: 'help me set up', weight: 3 },
    { phrase: 'set up a transfer', weight: 3 },
    { phrase: 'load data from', weight: 3 },
    { phrase: 'configure a connection', weight: 3 },
    { phrase: 'import data', weight: 3 },
    { phrase: 'translate these', weight: 3 },
    { phrase: 'translate some', weight: 3 },
    { phrase: 'batch translate', weight: 3 },
    { phrase: 'sql files', weight: 3 },
    { phrase: 'into google sql', weight: 3 },
    { phrase: 'to googlesql', weight: 3 },
    { phrase: 'to bigquery sql', weight: 3 },
    { phrase: 'step by step', weight: 2 },
    { phrase: 'translate', weight: 2 },
    { phrase: 'convert', weight: 2 },
    { phrase: 'migration', weight: 2 },
    { phrase: 'how do i', weight: 2 },
    { phrase: 'transfer', weight: 2 },
  ],
  handle: handleTask,
};
