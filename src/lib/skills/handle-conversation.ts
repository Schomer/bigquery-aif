// src/lib/skills/handle-conversation.ts
// Conversational AI handler -- lets the user talk to the app naturally.
// Not every message is a task. This handler provides expert-level data
// advice, answers questions, and guides users toward concrete actions.

import { callGeminiWithSchema, ConversationResponseSchema, loadSkillDoc } from '../gemini-client';
import type { ChatMessage, CompositionEnvelope, SkillManifest, SkillName, StatusCallback } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ConversationResponse {
  response: string;
  suggestedActions?: Array<{ label: string; skill?: string }>;
}

// ─── Skill doc knowledge cache ───────────────────────────────────────────────

let _skillKnowledgeCache: string | null = null;

async function getSkillKnowledge(): Promise<string> {
  if (_skillKnowledgeCache) return _skillKnowledgeCache;

  const skillNames = [
    'schema', 'query', 'data-management', 'data-quality',
    'monitoring', 'discovery', 'data-loading', 'pipeline', 'governance',
  ];

  const docs = await Promise.all(skillNames.map(s => loadSkillDoc(s)));

  // Extract capability summaries (first ~20 lines per doc) to stay under token budget
  _skillKnowledgeCache = docs
    .map((d, i) => {
      const lines = d.split('\n').slice(0, 20);
      return `### ${skillNames[i]} skill\n${lines.join('\n')}`;
    })
    .join('\n\n---\n\n');

  return _skillKnowledgeCache;
}

// ─── System prompt builder ───────────────────────────────────────────────────

function buildConversationPrompt(
  project: string,
  availableDatasets: string[],
  context: any,
  skillKnowledge: string,
): string {
  const lastTableLine = context?.lastTable
    ? `The user was most recently looking at: ${context.lastTable}`
    : '';
  const lastTableSchemaLine = context?.lastTableSchema?.length
    ? `Schema of ${context.lastTable}:\n${context.lastTableSchema.map(
        (c: any) => `  - ${c.name} (${c.type})${c.description ? ': ' + c.description : ''}`
      ).join('\n')}`
    : '';
  const lastSkillLine = context?.lastSkill
    ? `Their last action used the ${context.lastSkill} skill.`
    : '';
  const datasetTablesLine = context?.lastDatasetTables?.length
    ? `Tables in the active dataset: ${context.lastDatasetTables.join(', ')}`
    : '';

  return `You are a data expert and BigQuery specialist embedded in a data management application. You have deep knowledge of:

BIGQUERY & GOOGLE CLOUD EXPERTISE:
- BigQuery SQL dialect (GoogleSQL), including window functions, UNNEST, STRUCT/ARRAY types, INFORMATION_SCHEMA, federated queries
- Table design: partitioning (time-unit, integer-range, ingestion-time), clustering, materialized views, table cloning vs copying
- Cost management: on-demand vs capacity pricing, slot reservations, storage billing (active vs long-term), query cost estimation
- Data organization: dataset design patterns, project structure, region selection, data lifecycle management
- Data ingestion: BigQuery Data Transfer Service, scheduled queries, Cloud Storage loads, streaming inserts, Dataflow, Pub/Sub
- Security: IAM roles, dataset/table-level permissions, row-level security, column-level security, VPC Service Controls, authorized views
- Performance: query optimization, partition pruning, BI Engine, search indexes, query plan analysis
- External data: BigLake, external tables (Cloud Storage, Drive, Bigtable), federated queries to Cloud SQL/Spanner
- ML/AI: BigQuery ML (CREATE MODEL, ML.PREDICT, ML.EVALUATE), Vertex AI integration

WHAT THIS APP CAN DO FOR THE USER (offer these proactively when relevant):
${skillKnowledge}

YOUR ATTITUDE:
- Default to "sure, I can do that" / "sure, let me check on that" / "sure, let me set that up"
- Be an expert who is also approachable. Think senior data engineer sitting next to them, not a help desk.
- When the user describes a problem, immediately think about what you can DO about it, not just explain it.
- Give concrete, specific advice using their actual project and data. Not generic textbook answers.
- When you suggest an action you can perform, frame it as something you will do: "I can check that for you" / "Want me to set that up?"
- Keep responses focused: 2-4 short paragraphs max. Use line breaks between thoughts. No bullet-point walls.
- When you don't know something specific about their data, say so and offer to look: "I'm not sure how that table is structured -- want me to check?"
- Never say "I can't do that." Say "sure" and figure out a path, even if it takes multiple steps.
- Do not use emojis.

CONVERSATION CONTEXT:
- Project: ${project || '(not selected yet)'}
- Available datasets: ${availableDatasets.length > 0 ? availableDatasets.join(', ') : '(none visible yet)'}
${lastTableLine}
${lastTableSchemaLine}
${lastSkillLine}
${datasetTablesLine}

SUGGESTED ACTIONS:
- When the conversation naturally leads to something you can do (query data, create a table, check quality, etc.), include 2-3 suggestedActions in your response. These become clickable chips the user can tap.
- Phrase them as the user's next action: "Show me my datasets", "Profile the orders table", "Create a reporting dataset"
- Only include actions when they are genuinely relevant. Not every response needs chips.
- Include the target skill when you know it (schema, query, data-management, data-quality, monitoring, discovery, data-loading, pipeline, governance).

IMPORTANT: You are having a conversation. Do not generate SQL, do not execute queries, do not return tables or charts. If the user asks you to DO something concrete with their data, tell them what you'll do and include it as a suggestedAction chip so the system can route to the right handler. If they're asking a question, discussing options, or seeking advice, just talk to them.`;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function handleConversation(
  message: string,
  history: ChatMessage[],
  context?: {
    project?: string;
    dataset?: string;
    resolvedDataset?: string;
    availableDatasets?: string[];
    lastTable?: string;
    lastTableSchema?: { name: string; type: string; description?: string }[];
    lastSkill?: SkillName;
    lastDatasetTables?: string[];
  },
  onStatus?: StatusCallback,
): Promise<CompositionEnvelope[]> {
  onStatus?.('Thinking...');

  const project = context?.project || '';
  const available = context?.availableDatasets ?? [];
  const skillKnowledge = await getSkillKnowledge();

  const systemPrompt = buildConversationPrompt(project, available, context, skillKnowledge);

  const messages = history.slice(-30).map(m => ({
    role: m.role as 'user' | 'assistant',
    content: typeof m.content === 'string' ? m.content : String(m.content ?? ''),
  }));

  const result = await callGeminiWithSchema<ConversationResponse>({
    systemInstruction: systemPrompt,
    messages: [...messages, { role: 'user' as const, content: message }],
    schema: ConversationResponseSchema,
    project,
  });

  const responseText = result.response || 'Let me know how I can help.';

  const envelope: CompositionEnvelope = {
    id: 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    skill: 'conversation',
    headline: {
      text: responseText,
      tone: 'NEUTRAL' as const,
      basis: 'STATUS' as const,
    },
    primaryArtifact: {
      type: 'CONVERSATION',
      data: { text: responseText },
    },
    provenance: { visibility: 'COLLAPSED' },
    skipSelfReview: true,
    nextActions: (result.suggestedActions || []).slice(0, 4).map(
      (action) => ({
        targetSkill: (action.skill || 'conversation') as SkillName,
        label: action.label,
        context: {},
        sourceSkill: 'conversation' as SkillName,
        sourceResultRef: '',
      })
    ),
  };

  return [envelope];
}

// ─── Manifest ────────────────────────────────────────────────────────────────

export const manifest: SkillManifest = {
  skill: 'conversation',
  label: 'assistant',
  signals: [],   // no keyword signals -- routed by LLM classifier only
  handle: handleConversation,
};
