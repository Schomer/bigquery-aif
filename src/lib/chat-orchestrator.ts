// src/lib/chat-orchestrator.ts
// Per-turn client-side orchestration: receive message -> router -> skill dispatch -> compose -> return envelopes
// Runs entirely in the browser using the Gemini API REST endpoint via the configured API key.
//
// This file was refactored from a 3,835-line monolith into a thin dispatch layer.
// Handler logic lives in src/lib/skills/handle-*.ts
// Infrastructure lives in src/lib/gemini-client.ts, orchestrator-utils.ts, self-review.ts

import { classifyIntent, resolveReferences } from './router';
import { compose } from './composer';
import { callGemini, IntentClassifierSchema, loadSkillDoc } from './gemini-client';
import {
  getAvailableDatasets,
  resolveDefaultDatasetFromList,
  buildConversationStateSummary,
  stepWithLink,
} from './orchestrator-utils';
import { selfReviewEnvelope } from './self-review';

// Skill handlers
import { handleSchema } from './skills/handle-schema';
import { handleQuery } from './skills/handle-query';
import { handleDataManagement, executeConfirmedOperation } from './skills/handle-data-management';
import { handleDataQuality } from './skills/handle-data-quality';
import { handleMonitoring } from './skills/handle-monitoring';
import { handleDiscovery } from './skills/handle-discovery';
import { handleDataLoading } from './skills/handle-data-loading';
import { handleTask } from './skills/handle-task';

import type {
  ChatMessage,
  CompositionEnvelope,
  DataManagementResult,
  QueryResult,
  SkillName,
  StatusCallback,
} from './types';

// ---- Orchestrator client class ----

export interface ProcessMessageArgs {
  message: string;
  history: ChatMessage[];
  context?: {
    lastSkill?: SkillName;
    lastResultRef?: string;
    lastTable?: string;
    dataset?: string;
    project?: string;
    uid?: string;
    confirmedPayload?: DataManagementResult;
    forcedSkill?: SkillName;
    resolvedDataset?: string;
    availableDatasets?: string[];
    // Handoff chain: full envelope context from chip clicks
    handoffContext?: Record<string, unknown>;
  };
  onStatus?: StatusCallback;
}

export interface OrchestrationResult {
  envelopes: CompositionEnvelope[];
  skill?: SkillName;
}

export class ChatOrchestrator {
  static async processMessage({ message, history, context, onStatus }: ProcessMessageArgs): Promise<OrchestrationResult> {
    // -- Handle confirmation responses --
    if (context?.confirmedPayload && 'executionSql' in context.confirmedPayload) {
      const confirmed = context.confirmedPayload;
      const project = context?.project || '';
      const envelopes = await executeConfirmedOperation(confirmed, project);
      return { envelopes };
    }

    const project = context?.project || '';

    // -- Resolve referential language --
    const resolvedMessage = resolveReferences(message, context);

    let resolvedDataset = context?.resolvedDataset;
    let availableDatasets = context?.availableDatasets;

    // -- Classify intent --
    // Try keyword-based classification first to avoid an unnecessary Gemini
    // round-trip for obvious requests (e.g., "list my datasets").
    let skill = context?.forcedSkill;
    let routerConfidence: 'high' | 'medium' | 'low' = 'medium';
    if (!skill) {
      const keywordResult = classifyIntent(resolvedMessage, context);
      if (keywordResult.confidence === 'high') {
        skill = keywordResult.skill;
        routerConfidence = 'high';
        // Still need available datasets for downstream handlers
        if (!availableDatasets) {
          const available = await getAvailableDatasets(project);
          availableDatasets = available;
          resolvedDataset = resolvedDataset ?? resolveDefaultDatasetFromList(available, context?.dataset, project);
        }
      } else {
        // Low/medium confidence or ambiguous: fall back to LLM intent classifier
        routerConfidence = keywordResult.confidence;
        if (keywordResult.ambiguousReadWrite) {
          onStatus?.('Analyzing intent (ambiguous read/write signals detected)...');
        }
        try {
          const available = availableDatasets ?? await getAvailableDatasets(project);
          const dataset = resolvedDataset ?? resolveDefaultDatasetFromList(available, context?.dataset, project);
          availableDatasets = available;
          resolvedDataset = dataset;
          const messages = history.slice(-6).map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }));

          onStatus?.(`Classifying intent for: "${resolvedMessage.slice(0, 80)}${resolvedMessage.length > 80 ? '...' : ''}"`);

          const routingRef = await loadSkillDoc('intent-routing');

          const classifierPrompt = `You are the intent classifier for a BigQuery AI assistant.
You have two jobs:
1. Classify which SKILL should handle the user's request.
2. Detect if the request requires MULTIPLE DISTINCT ACTIONS (multistep).

Use the following routing reference to determine the correct skill:

${routingRef}

MULTISTEP RULES:
- A request with ONE VERB acting on ONE OBJECT is NEVER multistep.
- Only return isMultistep: true when the message contains EXPLICIT multi-action language: 'and then', 'after that', 'first...then', 'followed by', 'next', or a numbered list of distinct actions.
- When isMultistep is false, return an empty steps array.
- When isMultistep is true, decompose into steps. Each step needs: skill, description (short label), prompt (fully self-contained with explicit table refs like \`${project}.${dataset}.tablename\`).
- NEVER decompose an analytical question into a schema step followed by a query step. The query skill already loads schema context internally. Examples that are SINGLE-STEP query (NOT multistep): "show sales at store X over time", "analyze revenue by month", "what are the top products", "sales trend for category Y".
- Analytical phrases like 'analyze', 'show me', 'trend', 'over time', 'breakdown', 'compare', 'top N' are READ-ONLY query operations, NEVER data-management.

Current active project: ${project}
Current active dataset: ${dataset}
Available datasets: ${available.join(', ')}

CONVERSATION STATE:
${buildConversationStateSummary(context)}
The user's new message is a continuation of this conversation. Treat it as a follow-up to the current context unless it explicitly changes the subject. Do NOT re-derive context that is already established (e.g., do not add a schema step for a table the user is already looking at).`;

          const result = await callGemini({
            systemInstruction: classifierPrompt,
            messages: [...messages, { role: 'user' as const, content: resolvedMessage }],
            schema: IntentClassifierSchema,
            project,
          });

          if (result && result.isMultistep && result.steps && result.steps.length > 1) {
            // Guard: schema+query decomposition is always redundant because
            // handleQuery() loads schema context internally via buildSchemaContext().
            // Collapse to a single query step instead of creating a workflow.
            const isRedundantSchemaQuery = result.steps.length === 2
              && result.steps[0].skill === 'schema'
              && result.steps[1].skill === 'query';

            if (isRedundantSchemaQuery) {
              // Use the query step's prompt directly as a single-step query
              skill = 'query' as SkillName;
            } else {
              const envelope: CompositionEnvelope = {
                id: 'workflow_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                skill: 'multistep',
                headline: {
                  text: `Created a workflow with ${result.steps.length} steps to complete your request.`,
                  tone: 'NEUTRAL',
                  basis: 'STATUS',
                },
                primaryArtifact: {
                  type: 'MULTISTEP_VIEW',
                  data: {
                    steps: result.steps,
                  },
                },
                provenance: {
                  visibility: 'COLLAPSED',
                },
                nextActions: [],
              };
              return { envelopes: [envelope], skill: 'multistep' };
            }
          }

          // Single-step: use the LLM-classified skill
          if (result && result.skill) {
            skill = result.skill as SkillName;
          }
        } catch (e) {
          console.warn('[Intent classifier failed, falling back to keyword router]', e);
        }

        // Final fallback: use the keyword result even if low confidence
        if (!skill) {
          skill = keywordResult.skill;
        }
      }
    }

    const skillLabels: Record<string, string> = {
      'schema': 'schema lookup',
      'query': 'query builder',
      'data-management': 'data management',
      'data-quality': 'data quality check',
      'monitoring': 'monitoring',
      'discovery': 'discovery search',
      'data-loading': 'data export',
      'task': 'task resolver',
    };
    onStatus?.(`Matched skill: ${skillLabels[skill] || skill}`);

    // -- Dispatch to skill --
    let envelopes: CompositionEnvelope[] = [];

    // Pass pre-resolved context to handlers to avoid redundant fetches
    const enrichedContext = { ...context, resolvedDataset, availableDatasets };

    switch (skill) {
      case 'schema':
        envelopes = await handleSchema(resolvedMessage, enrichedContext, onStatus);
        break;
      case 'query':
        envelopes = await handleQuery(resolvedMessage, history, enrichedContext, onStatus);
        break;
      case 'data-management':
        envelopes = await handleDataManagement(resolvedMessage, history, enrichedContext, onStatus);
        break;
      case 'data-quality':
        envelopes = await handleDataQuality(resolvedMessage, enrichedContext, onStatus);
        break;
      case 'monitoring':
        envelopes = await handleMonitoring(resolvedMessage, enrichedContext, onStatus);
        break;
      case 'discovery':
        envelopes = await handleDiscovery(resolvedMessage, enrichedContext, onStatus);
        break;
      case 'data-loading':
        envelopes = await handleDataLoading(resolvedMessage, enrichedContext, onStatus);
        break;
      case 'task':
        envelopes = await handleTask(resolvedMessage, enrichedContext, onStatus);
        break;
      default:
        envelopes = await handleQuery(resolvedMessage, history, enrichedContext, onStatus);
    }

    // -- Self-review: run for skills that benefit from it --
    // Skip review for straightforward results where the Gemini review pass
    // rarely changes anything meaningful. This saves 1-3s of latency.
    //
    // Skip conditions (any envelope matching these is marked skipSelfReview):
    // 1. Schema results at PROJECT or DATASET scope (canned INFORMATION_SCHEMA)
    // 2. KPI_CARD results (single-value answers where headline IS the answer)
    // 3. High-confidence keyword match + clean execution + small result set
    if (envelopes.length > 0) {
      for (const env of envelopes) {
        if (env.requiresConfirmation || env.skipSelfReview) continue;

        const artifactType = env.primaryArtifact.type;
        const data = env.primaryArtifact.data as Record<string, unknown> | null;

        // Schema PROJECT/DATASET scope: straightforward metadata listings
        if (artifactType === 'SCHEMA_VIEW' && data && 'scope' in data) {
          const scope = (data as { scope: string }).scope;
          if (scope === 'PROJECT' || scope === 'DATASET') {
            env.skipSelfReview = true;
            continue;
          }
        }

        // KPI_CARD: single value answers, headline is the answer
        if (artifactType === 'KPI_CARD') {
          env.skipSelfReview = true;
          continue;
        }

        // High-confidence + small result: review adds little value
        if (routerConfidence === 'high' && data && 'rows' in data) {
          const rows = (data as { rows: unknown[] }).rows;
          if (Array.isArray(rows) && rows.length < 100) {
            env.skipSelfReview = true;
            continue;
          }
        }
      }

      const needsReview = envelopes.some((env) =>
        !env.requiresConfirmation && !env.skipSelfReview
      );
      if (needsReview) {
        onStatus?.('Reviewing output quality...');
        const reviewed = await Promise.all(
          envelopes.map((env) =>
            (env.requiresConfirmation || env.skipSelfReview)
              ? Promise.resolve(env)
              : selfReviewEnvelope(env, resolvedMessage, project, onStatus)
          )
        );
        envelopes = reviewed;
      }
    }

    return { envelopes, skill };
  }
}
