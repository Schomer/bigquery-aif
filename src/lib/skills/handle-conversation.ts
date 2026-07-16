// src/lib/skills/handle-conversation.ts
// Conversational AI agent -- the smart front door for the app.
// Uses Gemini's function-calling loop to handle conversation AND simple
// data operations (list datasets, create dataset, get schema, run queries).
// For complex operations, responds conversationally and suggests action chips.

import { callGeminiWithTools, loadSkillDoc } from '../gemini-client';
import { BQ_TOOLS, BQ_TOOL_MAP } from '../bq-tools';
import type {
  ChatMessage, CompositionEnvelope, DataManagementResult, SkillManifest,
  SkillName, StatusCallback, QueryResult, VisualizationType, CostTier,
} from '../types';
import { compose } from '../composer';

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

function buildAgentPrompt(
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

  return `You are a data expert and BigQuery specialist embedded in a data management application.
You can both TALK to the user AND ACT on their behalf using the tools available to you.

YOUR TOOLS:
- list_datasets: See all datasets in the project
- list_tables: See all tables in a dataset
- get_table_schema: See the columns/types for a specific table
- run_query: Execute a GoogleSQL SELECT query and return results
- create_dataset: Create a new BigQuery dataset
- execute_dml: Run DML/DDL (INSERT, UPDATE, DELETE, CREATE TABLE, ALTER TABLE, DROP TABLE, etc.)

BIGQUERY & GOOGLE CLOUD EXPERTISE:
- BigQuery SQL dialect (GoogleSQL), window functions, UNNEST, STRUCT/ARRAY types, INFORMATION_SCHEMA, federated queries
- Table design: partitioning, clustering, materialized views, table cloning vs copying
- Cost management: on-demand vs capacity pricing, slot reservations, storage billing
- Data organization: dataset design patterns, project structure, region selection
- Data ingestion: Data Transfer Service, scheduled queries, Cloud Storage loads, streaming inserts
- Security: IAM roles, dataset/table-level permissions, row-level security, column-level security
- Performance: query optimization, partition pruning, BI Engine, search indexes, query plan analysis
- ML/AI: BigQuery ML (CREATE MODEL, ML.PREDICT, ML.EVALUATE), Vertex AI integration

WHAT THIS APP CAN DO (offer these proactively when relevant):
${skillKnowledge}

YOUR ATTITUDE:
- Default to "sure, I can do that" / "sure, let me check on that" / "sure, let me set that up"
- Be an expert who is also approachable. Think senior data engineer sitting next to the user.
- When the user describes something they want to do, DO IT using your tools. Don't explain how -- just do it.
- If you need information to proceed (like a dataset name, table name, etc.), ask ONE specific question. Don't ask a list of questions.
- Give concrete, specific advice using their actual project and data. Not generic textbook answers.
- Keep responses focused: 2-4 short paragraphs max. No bullet-point walls.
- When you don't know something specific about their data, offer to look using your tools.
- Never say "I can't do that." Figure out a way.
- Do not use emojis.

DECISION RULES:
1. If the user asks to DO something and you have enough info, USE YOUR TOOLS to do it immediately. Don't ask permission.
2. If the user asks to DO something but you're missing critical info (like a name or target), ask ONE question to get it.
3. If the user is asking a QUESTION or seeking ADVICE, respond conversationally. You can still use tools to look things up.
4. For operations that DESTROY data (DELETE, DROP, TRUNCATE), call execute_dml immediately with the correct SQL. The system will automatically intercept the call, count the affected rows, and show the user a confirmation card before anything is deleted. Do NOT run a preview query yourself or describe what you plan to do -- just call execute_dml.
5. For operations that CREATE or MODIFY (CREATE DATASET, CREATE TABLE, INSERT, UPDATE), go ahead and do it. These are reversible.
6. Always wrap fully qualified table references in backticks: \`project.dataset.tablename\`

CONVERSATION CONTEXT:
- Project: ${project || '(not selected yet)'}
- Available datasets: ${availableDatasets.length > 0 ? availableDatasets.join(', ') : '(none visible yet)'}
${lastTableLine}
${lastTableSchemaLine}
${lastSkillLine}
${datasetTablesLine}`;
}

// ─── Captured query result for building TABLE envelopes ──────────────────────

interface CapturedQuery {
  sql: string;
  columns: string[];
  columnTypes: string[];
  rows: unknown[][];
  rowCount: number;
  visualizationHint?: string;
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

  const systemPrompt = buildAgentPrompt(project, available, context, skillKnowledge);

  const messages = history.slice(-30).map(m => ({
    role: m.role as 'user' | 'assistant',
    content: typeof m.content === 'string' ? m.content : String(m.content ?? ''),
  }));
  messages.push({ role: 'user' as const, content: message });

  // Track captured results for building rich envelopes
  const capturedQueries: CapturedQuery[] = [];
  let datasetCreated: { datasetId: string; location: string } | null = null;
  let dmlExecuted: { sql: string; affectedRows: number } | null = null;

  // Destructive DML intercepted for preview+confirm flow (not direct execution)
  let pendingDestructiveDml: { sql: string; operation: string } | null = null;

  // Detect whether a SQL statement is destructive (requires user confirmation before running)
  function isDestructiveDml(sql: string): string | null {
    const s = sql.trimStart().toUpperCase();
    if (s.startsWith('DELETE')) return 'DELETE';
    if (s.startsWith('TRUNCATE')) return 'TRUNCATE';
    if (s.startsWith('DROP TABLE') || s.startsWith('DROP VIEW') || s.startsWith('DROP SCHEMA')) {
      return s.startsWith('DROP TABLE') ? 'DROP_TABLE' : s.startsWith('DROP VIEW') ? 'DROP_TABLE' : 'DROP_SCHEMA';
    }
    return null;
  }

  // Tool executor: intercepts results for envelope composition
  const toolExecutor = async (name: string, args: Record<string, unknown>, onStatusOverride?: (msg: string) => void): Promise<unknown> => {
    const tool = BQ_TOOL_MAP.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    const statusFn = onStatusOverride ?? onStatus;

    if (name === 'run_query') {
      // Intercept full result for UI rendering
      const { executeQuery } = await import('../bigquery-client');
      const sql = args.sql as string;
      const result = await executeQuery(sql, project, (ev) => {
        if (ev.state === 'RUNNING') {
          const bytes = ev.bytesProcessed;
          statusFn?.(bytes && bytes > 0
            ? `Query running — ${(bytes / (1024 * 1024)).toFixed(1)} MB scanned...`
            : 'Query running...');
        }
      });
      capturedQueries.push({
        sql,
        columns: result.columns,
        columnTypes: result.columnTypes,
        rows: result.rows as unknown[][],
        rowCount: result.rowCount,
        visualizationHint: args.visualizationHint as string | undefined,
      });
      // Return concise preview to the LLM
      return {
        columns: result.columns,
        rowCount: result.rowCount,
        sampleRows: result.rows.slice(0, 20),
      };
    }

    if (name === 'create_dataset') {
      const result = await tool.execute(args, project, statusFn);
      datasetCreated = result as { datasetId: string; location: string };
      return result;
    }

    if (name === 'execute_dml') {
      const sql = args.sql as string;
      const operation = isDestructiveDml(sql);
      if (operation) {
        // Intercept destructive DML -- do not execute yet.
        // Return a signal to the LLM that tells it to stop and await confirmation.
        pendingDestructiveDml = { sql, operation };
        return {
          pending_confirmation: true,
          message: 'Showing the user a count of affected rows and a confirmation prompt before executing.',
        };
      }
      const result = await tool.execute(args, project, statusFn) as { completed: boolean; numDmlAffectedRows: number };
      dmlExecuted = { sql, affectedRows: result.numDmlAffectedRows };
      return result;
    }

    return tool.execute(args, project, statusFn);
  };

  // Run the agent loop
  const agentResult = await callGeminiWithTools({
    systemInstruction: systemPrompt,
    messages,
    toolDeclarations: BQ_TOOLS.map(t => t.declaration),
    toolExecutor,
    project,
    onStatus,
    maxIterations: 8,
  });

  const responseText = agentResult.textResponse || 'Done.';
  const envelopes: CompositionEnvelope[] = [];

  // If destructive DML was intercepted, run a count preview and return a confirmation card.
  // The LLM already wrote the SQL -- we just gate execution behind a user confirmation.
  if (pendingDestructiveDml) {
    const { sql, operation } = pendingDestructiveDml as { sql: string; operation: string };
    onStatus?.(`Counting affected rows before ${operation}...`);

    // Derive a preview COUNT query from the execution SQL.
    // For DELETE: SELECT COUNT(*) FROM table WHERE ...
    // For TRUNCATE/DROP: count all rows in the table.
    let previewSql: string;
    const sqlUpper = sql.trimStart().toUpperCase();
    if (sqlUpper.startsWith('DELETE')) {
      // Replace DELETE ... FROM with SELECT COUNT(*) FROM, keep WHERE clause
      previewSql = sql.trimStart().replace(/^DELETE\s+/i, 'SELECT COUNT(*) AS affected_count -- preview of: DELETE ');
      // More reliable: rewrite the DELETE as a SELECT COUNT(*)
      const fromMatch = sql.match(/\bFROM\b([\s\S]+?)(?:\bWHERE\b([\s\S]*))?$/i);
      if (fromMatch) {
        const tableRef = fromMatch[1].trim();
        const whereClause = fromMatch[2] ? `WHERE ${fromMatch[2].trim()}` : '';
        previewSql = `SELECT COUNT(*) AS affected_count FROM ${tableRef} ${whereClause}`.trim();
      }
    } else {
      // For TRUNCATE/DROP, extract the table reference and count all rows
      const tableMatch = sql.match(/(?:TRUNCATE\s+TABLE|DROP\s+TABLE(?:\s+IF\s+EXISTS)?)\s+(`[^`]+`|\S+)/i);
      const tableRef = tableMatch?.[1] ?? '';
      previewSql = tableRef ? `SELECT COUNT(*) AS affected_count FROM ${tableRef}` : '';
    }

    let affectedRowCount = 0;
    if (previewSql) {
      try {
        const { executeQuery } = await import('../bigquery-client');
        const previewResult = await executeQuery(previewSql, project);
        const raw = Number(previewResult.rows[0]?.[0]);
        affectedRowCount = Number.isFinite(raw) ? Math.round(raw) : 0;
      } catch {
        // Non-fatal -- show confirmation without count
      }
    }

    let costEstimate;
    try {
      const { dryRun } = await import('../bigquery-client');
      costEstimate = await dryRun(sql, project);
    } catch {
      // Non-fatal
    }

    // Extract the table reference from the SQL for display purposes
    const tableMatch = sql.match(/(?:FROM|TABLE(?:\s+IF\s+EXISTS)?)\s+(`[^`]+`|\S+)/i);
    const table = tableMatch?.[1]?.replace(/`/g, '') ?? undefined;

    const confirmResult: DataManagementResult = {
      skill: 'data-management',
      requiresConfirmation: true,
      operation: operation as import('../types').DmOperation,
      table,
      previewSql,
      affectedRowCount,
      costEstimate: costEstimate ?? undefined,
      executionSql: sql,
      snapshotRowIds: [],
      snapshotOffer: (operation === 'DELETE' || operation === 'TRUNCATE') && affectedRowCount > 0,
    };

    // Use the LLM's natural language response as the headline if available
    const confirmHeadline = responseText && responseText !== 'Done.'
      ? responseText.split('\n')[0].slice(0, 200)
      : `Found ${affectedRowCount.toLocaleString()} row${affectedRowCount !== 1 ? 's' : ''} to ${operation.toLowerCase()}. Review and confirm.`;

    const confirmEnvelope = compose('data-management', confirmResult);
    confirmEnvelope.headline.text = confirmHeadline;
    return [confirmEnvelope];
  }

  // If a query was executed, build a proper data envelope through the compose pipeline
  if (capturedQueries.length > 0) {
    const lastQuery = capturedQueries[capturedQueries.length - 1];
    const queryResult: QueryResult = {
      skill: 'query',
      sql: lastQuery.sql,
      requiresConfirmation: false,
      costConfirm: null,
      columns: lastQuery.columns,
      columnTypes: lastQuery.columnTypes,
      rows: lastQuery.rows,
      rowCount: lastQuery.rowCount,
      totalBytesProcessed: 0,
      costTier: 0,
      suggestedVisualization: (lastQuery.visualizationHint as VisualizationType | undefined) ?? 'TABLE',
      resultSummary: responseText,
    };
    const composed = compose('query', queryResult);
    // Override the headline with the agent's natural response
    composed.headline.text = responseText.split('\n')[0].slice(0, 200);
    composed.skipSelfReview = true;
    envelopes.push(composed);
  } else {
    // Pure conversation or non-query tool use -- return text envelope
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
      nextActions: [],
    };

    // Build context-aware chips based on what tools were used
    const chips: typeof envelope.nextActions = [];

    // Add chips based on what tools were used
    if (capturedQueries.length > 0) {
      chips.push(
        { targetSkill: 'query' as SkillName, label: 'Modify this query', context: {}, sourceSkill: 'conversation' as SkillName, sourceResultRef: '' },
        { targetSkill: 'saved' as SkillName, label: 'Save this result', context: {}, sourceSkill: 'conversation' as SkillName, sourceResultRef: '' },
      );
    }

    // Add chips based on conversation context
    if (context?.lastTable && !datasetCreated) {
      chips.push(
        { targetSkill: 'data-quality' as SkillName, label: `Profile ${context.lastTable}`, context: {}, sourceSkill: 'conversation' as SkillName, sourceResultRef: '' },
      );
    }

    if (context?.dataset || context?.resolvedDataset) {
      const ds = context.resolvedDataset || context.dataset;
      chips.push(
        { targetSkill: 'schema' as SkillName, label: `Explore ${ds}`, context: {}, sourceSkill: 'conversation' as SkillName, sourceResultRef: '' },
      );
    }

    // Cap at 4 chips
    envelope.nextActions = chips.slice(0, 4);

    // If a dataset was created, replace with dataset-specific chips
    if (datasetCreated) {
      const ds = datasetCreated as { datasetId: string; location: string };
      envelope.nextActions = [
        {
          targetSkill: 'schema' as SkillName,
          label: `View ${ds.datasetId}`,
          context: {},
          sourceSkill: 'conversation' as SkillName,
          sourceResultRef: '',
        },
        {
          targetSkill: 'conversation' as SkillName,
          label: 'Create a table in it',
          context: {},
          sourceSkill: 'conversation' as SkillName,
          sourceResultRef: '',
        },
      ];
    }

    envelopes.push(envelope);
  }

  return envelopes;
}

// ─── Manifest ────────────────────────────────────────────────────────────────

export const manifest: SkillManifest = {
  skill: 'conversation',
  label: 'assistant',
  signals: [],   // no keyword signals -- this is the AI-first entry point
  handle: handleConversation,
};
