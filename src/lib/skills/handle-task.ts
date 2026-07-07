// src/lib/skills/handle-task.ts
// Task handler: delegates to the autonomous task resolver.
// Extracted from chat-orchestrator.ts.

import type { CompositionEnvelope, StatusCallback } from '../types';

export async function handleTask(
  message: string,
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
