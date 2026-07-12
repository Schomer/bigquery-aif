// src/lib/skills/handle-discovery.ts
// Discovery handler: search, comparison, lineage, ER diagrams.
// Extracted from chat-orchestrator.ts.

import { callGemini, DiscoveryResponseSchema } from '../gemini-client';
import { getAvailableDatasets } from '../orchestrator-utils';
import { fetchSchema } from './schema';
import { executeQuery, detectBqRegion } from '../bigquery-client';
import { compose } from '../composer';
import type {
  ChatMessage, CompositionEnvelope, DiscoveryResult, DiscoverySearchResult, SkillManifest, StatusCallback,
  LineageNode, LineageEdge, ErTableInfo, ErRelationship, ErDiagramData,
} from '../types';

// ─── Discovery handler ─────────────────────────────────────────────────────────

export async function handleDiscovery(
  message: string,
  _history: ChatMessage[],
  context?: { project?: string; dataset?: string; handoffContext?: Record<string, unknown> },
  onStatus?: StatusCallback
): Promise<CompositionEnvelope[]> {
  const project = context?.project || '';
  const hc = context?.handoffContext;
  const available = await getAvailableDatasets(project);

  // If handoff context carries a pre-classified discovery type, skip LLM
  let intent: { discoveryType: string; query: string; tableName?: string; secondTable?: string };
  if (hc?.discoveryType && typeof hc.discoveryType === 'string') {
    intent = {
      discoveryType: hc.discoveryType as string,
      query: (hc.query as string) ?? (hc.table as string) ?? '',
      tableName: (hc.tableName as string) ?? (hc.table as string) ?? undefined,
      secondTable: (hc.secondTable as string) ?? undefined,
    };
    onStatus?.(`Running ${intent.discoveryType} (from handoff)...`);
  } else {
    intent = await callGemini({
      systemInstruction: `You are a BigQuery discovery assistant. Classify the user's request as one of: SEARCH (find tables/views matching a term), COMPARISON (compare two specific tables' schemas), LINEAGE (trace where data comes from or what depends on a table), ER_DIAGRAM (show entity relationships, foreign keys, table relationships in a dataset), or JOIN_DISCOVERY (find potential join keys between two tables, or ask how to join two tables). Extract the search term or table name into 'query'. For COMPARISON and JOIN_DISCOVERY, extract the second table into 'secondTable'. For LINEAGE, extract the table name into 'tableName'. For ER_DIAGRAM, extract the dataset name into 'query'. The active project is ${project}, available datasets are: ${available.join(', ')}.`,
      prompt: message,
      schema: DiscoveryResponseSchema,
      project,
    });
  }

  // LINEAGE: trace upstream and downstream dependencies via INFORMATION_SCHEMA.JOBS
  if (intent.discoveryType === 'LINEAGE') {
    const tableName = intent.tableName || intent.query;
    const tableLower = tableName.toLowerCase().replace(/`/g, '');
    onStatus?.(`Tracing lineage for "${tableName}"...`);

    const lineageRegion = await detectBqRegion(project);
    const lineageSql = `SELECT job_id, user_email, statement_type, creation_time, destination_table, referenced_tables FROM \`${project}\`.\`region-${lineageRegion}\`.INFORMATION_SCHEMA.JOBS_BY_PROJECT WHERE creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY) AND (LOWER(CAST(destination_table AS STRING)) LIKE '%${tableLower}%' OR LOWER(CAST(referenced_tables AS STRING)) LIKE '%${tableLower}%') ORDER BY creation_time DESC LIMIT 50`;

    let readsFrom: string[] = [];
    let writtenBy: string[] = [];
    const nodes: LineageNode[] = [];
    const edgeMap = new Map<string, LineageEdge>();
    const nodeSet = new Set<string>();

    const ensureNode = (id: string, type: LineageNode['type'] = 'TABLE') => {
      const lower = id.toLowerCase();
      if (nodeSet.has(lower)) return;
      nodeSet.add(lower);
      const parts = id.split('.');
      const ds = parts.length >= 2 ? parts[parts.length - 2] : '';
      nodes.push({ id: lower, label: parts[parts.length - 1] || id, type, dataset: ds });
    };

    const addEdge = (source: string, target: string, stmtType: string, time: string) => {
      const key = `${source}->${target}`;
      const existing = edgeMap.get(key);
      if (existing) {
        existing.jobCount++;
        if (time > existing.lastSeen) existing.lastSeen = time;
        if (!existing.statementTypes.includes(stmtType)) existing.statementTypes.push(stmtType);
      } else {
        edgeMap.set(key, { source, target, jobCount: 1, lastSeen: time, statementTypes: [stmtType] });
      }
    };

    try {
      const executed = await executeQuery(lineageSql, project);
      const iDest = executed.columns.indexOf('destination_table');
      const iRefs = executed.columns.indexOf('referenced_tables');
      const iStmt = executed.columns.indexOf('statement_type');
      const iTime = executed.columns.indexOf('creation_time');

      const upstreamSet = new Set<string>();
      const downstreamSet = new Set<string>();

      for (const row of executed.rows) {
        const destStr = String(row[iDest] ?? '').toLowerCase();
        const refsStr = String(row[iRefs] ?? '').toLowerCase();
        const stmtType = String(row[iStmt] ?? '');
        const timeStr = String(row[iTime] ?? '');

        const destMatchesTarget = destStr.includes(tableLower);
        const refsMatchTarget = refsStr.includes(tableLower);

        if (destMatchesTarget && refsStr) {
          const refs = refsStr.match(/[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+/g);
          if (refs) {
            refs.forEach(r => {
              upstreamSet.add(r);
              ensureNode(r, 'TABLE');
              addEdge(r, tableLower, stmtType, timeStr);
            });
          }
        }
        if (refsMatchTarget && destStr) {
          const dests = destStr.match(/[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+/g);
          if (dests) {
            dests.forEach(d => {
              downstreamSet.add(d);
              ensureNode(d, 'TABLE');
              addEdge(tableLower, d, stmtType, timeStr);
            });
          }
        }
      }

      upstreamSet.delete(tableLower);
      downstreamSet.delete(tableLower);
      readsFrom = Array.from(upstreamSet);
      writtenBy = Array.from(downstreamSet);
    } catch {
      // INFORMATION_SCHEMA.JOBS access may fail -- return empty lineage
    }

    // Ensure the target node exists
    ensureNode(tableLower, 'TARGET');

    const result: DiscoveryResult = {
      skill: 'discovery',
      discoveryType: 'LINEAGE',
      query: intent.query,
      results: [],
      comparison: null,
      lineage: {
        tableName,
        readsFrom,
        writtenBy,
        nodes,
        edges: Array.from(edgeMap.values()),
      },
    };
    return [compose('discovery', result)];
  }

  // ER_DIAGRAM: show foreign key relationships in a dataset
  if (intent.discoveryType === 'ER_DIAGRAM') {
    const datasetName = intent.query || intent.tableName || '';
    onStatus?.(`Building ER diagram for "${datasetName}"...`);

    try {
      // Fetch all tables and their columns with constraints
      const colsSql = `SELECT table_name, column_name, data_type, ordinal_position FROM \`${project}.${datasetName}\`.INFORMATION_SCHEMA.COLUMNS ORDER BY table_name, ordinal_position`;
      const constraintsSql = `SELECT ccu.table_name AS from_table, ccu.column_name AS from_column, kcu.table_name AS to_table, kcu.column_name AS to_column FROM \`${project}.${datasetName}\`.INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu JOIN \`${project}.${datasetName}\`.INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu ON ccu.constraint_name = kcu.constraint_name WHERE ccu.table_name != kcu.table_name`;
      const pkSql = `SELECT kcu.table_name, kcu.column_name FROM \`${project}.${datasetName}\`.INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu JOIN \`${project}.${datasetName}\`.INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc ON kcu.constraint_name = tc.constraint_name WHERE tc.constraint_type = 'PRIMARY KEY'`;

      const [colsResult, pkResult] = await Promise.all([
        executeQuery(colsSql, project),
        executeQuery(pkSql, project).catch(() => ({ columns: [], rows: [] as unknown[][] })),
      ]);

      // Build table/column map
      const tableMap = new Map<string, Array<{ name: string; type: string; isPk: boolean }>>();
      const pkSet = new Set<string>();
      for (const row of pkResult.rows) {
        pkSet.add(`${row[0]}.${row[1]}`);
      }
      for (const row of colsResult.rows) {
        const tbl = String(row[0] ?? '');
        const col = String(row[1] ?? '');
        const type = String(row[2] ?? '');
        if (!tableMap.has(tbl)) tableMap.set(tbl, []);
        tableMap.get(tbl)!.push({ name: col, type, isPk: pkSet.has(`${tbl}.${col}`) });
      }

      const tables: ErTableInfo[] = Array.from(tableMap.entries()).map(([name, columns]) => ({
        name,
        columns,
      }));

      // Fetch FK relationships
      let relationships: ErRelationship[] = [];
      try {
        const fkResult = await executeQuery(constraintsSql, project);
        const fkMap = new Map<string, ErRelationship>();
        for (const row of fkResult.rows) {
          const fromTable = String(row[0] ?? '');
          const fromCol = String(row[1] ?? '');
          const toTable = String(row[2] ?? '');
          const toCol = String(row[3] ?? '');
          const key = `${fromTable}->${toTable}`;
          if (!fkMap.has(key)) {
            fkMap.set(key, { fromTable, fromColumns: [], toTable, toColumns: [], type: 'FOREIGN_KEY' });
          }
          const rel = fkMap.get(key)!;
          if (!rel.fromColumns.includes(fromCol)) rel.fromColumns.push(fromCol);
          if (!rel.toColumns.includes(toCol)) rel.toColumns.push(toCol);
        }
        relationships = Array.from(fkMap.values());
      } catch {
        // Constraints query may fail -- return tables without relationships
      }

      const erData: ErDiagramData = {
        dataset: datasetName,
        tables,
        relationships,
      };

      const result: DiscoveryResult = {
        skill: 'discovery',
        discoveryType: 'ER_DIAGRAM',
        query: datasetName,
        results: [],
        comparison: null,
        lineage: null,
        erDiagram: erData,
      };
      return [compose('discovery', result)];
    } catch {
      const result: DiscoveryResult = {
        skill: 'discovery',
        discoveryType: 'ER_DIAGRAM',
        query: datasetName,
        results: [],
        comparison: null,
        lineage: null,
        erDiagram: { dataset: datasetName, tables: [], relationships: [] },
      };
      return [compose('discovery', result)];
    }
  }

  if (intent.discoveryType === 'COMPARISON') {
    const leftRef = intent.query;
    const rightRef = intent.secondTable ?? '';

    const parseRef = (ref: string) => {
      const parts = ref.replace(/`/g, '').split('.');
      return { dataset: parts[parts.length - 2] ?? '', table: parts[parts.length - 1] ?? '' };
    };

    const leftParsed = parseRef(leftRef);
    const rightParsed = parseRef(rightRef);

    const [leftSchema, rightSchema] = await Promise.all([
      fetchSchema(leftParsed.dataset || undefined, leftParsed.table || undefined, project).catch(() => null),
      fetchSchema(rightParsed.dataset || undefined, rightParsed.table || undefined, project).catch(() => null),
    ]);

    const leftCols = new Map((leftSchema?.columns ?? []).map((c) => [c.name, c.type]));
    const rightCols = new Map((rightSchema?.columns ?? []).map((c) => [c.name, c.type]));

    const addedColumns: Array<{ name: string; type: string }> = [];
    const removedColumns: Array<{ name: string; type: string }> = [];
    const changedColumns: Array<{ name: string; fromType: string; toType: string }> = [];

    for (const [name, type] of rightCols) {
      if (!leftCols.has(name)) {
        addedColumns.push({ name, type });
      } else if (leftCols.get(name) !== type) {
        changedColumns.push({ name, fromType: leftCols.get(name)!, toType: type });
      }
    }
    for (const [name, type] of leftCols) {
      if (!rightCols.has(name)) {
        removedColumns.push({ name, type });
      }
    }

    const result: DiscoveryResult = {
      skill: 'discovery',
      discoveryType: 'COMPARISON',
      query: intent.query,
      results: [],
      comparison: {
        left: leftRef,
        right: rightRef,
        addedColumns,
        removedColumns,
        changedColumns,
      },
    };
    return [compose('discovery', result)];
  }

  // W3-13: JOIN_DISCOVERY — find potential join keys between two tables and compute match rates
  if (intent.discoveryType === 'JOIN_DISCOVERY') {
    const leftTableRaw = intent.query || intent.tableName || '';
    const rightTableRaw = intent.secondTable || '';
    if (!leftTableRaw || !rightTableRaw) {
      // Fall through to SEARCH if tables not identified
    } else {
      onStatus?.(`Finding join keys between ${leftTableRaw} and ${rightTableRaw}...`);
      // Resolve datasets for each table
      const resolveTable = async (ref: string): Promise<{ dataset: string; table: string } | null> => {
        const parts = ref.replace(/`/g, '').split('.');
        if (parts.length >= 2) return { dataset: parts[parts.length - 2], table: parts[parts.length - 1] };
        // Search available datasets for a table with this name
        for (const ds of available) {
          try {
            const dsSchema = await fetchSchema(ds, undefined, project);
            const match = dsSchema.columns.find(c => c.name.toLowerCase() === ref.toLowerCase());
            if (match) return { dataset: ds, table: ref };
          } catch { /* ignore */ }
        }
        return null;
      };
      const [leftRef, rightRef] = await Promise.all([resolveTable(leftTableRaw), resolveTable(rightTableRaw)]);
      if (leftRef && rightRef) {
        const [leftSchema, rightSchema] = await Promise.all([
          fetchSchema(leftRef.dataset, leftRef.table, project).catch(() => null),
          fetchSchema(rightRef.dataset, rightRef.table, project).catch(() => null),
        ]);
        if (leftSchema && rightSchema) {
          const leftCols = new Set(leftSchema.columns.map(c => c.name.toLowerCase()));
          const rightCols = new Set(rightSchema.columns.map(c => c.name.toLowerCase()));
          // Find overlapping column names
          const overlaps = [...leftCols].filter(c => rightCols.has(c));
          // Prefer columns that look like keys: *_id, id, *_key, *_code
          const keyPatterns = /^(id$|.*_id$|.*_key$|.*_code$|.*_no$)/i;
          const joinCandidates = overlaps.filter(c => keyPatterns.test(c));
          const candidates = joinCandidates.length > 0 ? joinCandidates : overlaps.slice(0, 3);
          // Build match rate SQL for the top candidate
          const topJoinKey = candidates[0];
          let matchRatePct: number | undefined;
          if (topJoinKey) {
            try {
              const matchSql = `
                WITH left_keys AS (SELECT DISTINCT \`${topJoinKey}\` AS jk FROM \`${project}.${leftRef.dataset}.${leftRef.table}\` WHERE \`${topJoinKey}\` IS NOT NULL),
                     right_keys AS (SELECT DISTINCT \`${topJoinKey}\` AS jk FROM \`${project}.${rightRef.dataset}.${rightRef.table}\` WHERE \`${topJoinKey}\` IS NOT NULL),
                     matched AS (SELECT COUNT(*) AS cnt FROM left_keys l JOIN right_keys r ON l.jk = r.jk)
                SELECT ROUND(100.0 * (SELECT cnt FROM matched) / NULLIF((SELECT COUNT(*) FROM left_keys), 0), 1) AS match_rate_pct
              `;
              onStatus?.(`Computing match rate for join key: ${topJoinKey}...`);
              const matchResult = await executeQuery(matchSql, project).catch(() => null);
              if (matchResult && matchResult.rows.length > 0) {
                matchRatePct = Number(matchResult.rows[0][0] ?? 0);
              }
            } catch { /* non-critical */ }
          }
          const joinDefinition = {
            leftTable: `${project}.${leftRef.dataset}.${leftRef.table}`,
            rightTable: `${project}.${rightRef.dataset}.${rightRef.table}`,
            candidates,
            topJoinKey,
            matchRatePct,
            overlaps,
          };
          const joinResult: DiscoveryResult = {
            skill: 'discovery',
            discoveryType: 'JOIN_DISCOVERY',
            results: candidates.map(c => ({
              type: 'TABLE' as const,
              ref: `${project}.${leftRef.dataset}.${leftRef.table} ↔ ${project}.${rightRef.dataset}.${rightRef.table}`,
              matchedOn: `column:${c}`,
              description: c === topJoinKey && matchRatePct !== undefined
                ? `Join on \`${c}\` — ${matchRatePct}% of left rows match right`
                : `Potential join key: \`${c}\``,
            })),
            joinDefinition,
          };
          return [compose('discovery', joinResult)];

        }
      }
    }
  }

  // SEARCH: query INFORMATION_SCHEMA across all datasets
  const projectSchema = await fetchSchema(undefined, undefined, project);
  const datasets = projectSchema.columns
    .map((c) => c.name)
    .filter((name) => name && name.toLowerCase() !== project.toLowerCase());

  const term = intent.query.toLowerCase();
  // Build search variants for basic plural/singular stemming
  const searchTerms = new Set<string>([term]);
  if (term.endsWith('ies')) searchTerms.add(term.slice(0, -3) + 'y');
  if (term.endsWith('es')) searchTerms.add(term.slice(0, -2));
  if (term.endsWith('s') && !term.endsWith('ss')) searchTerms.add(term.slice(0, -1));
  // Also add plural of singular
  if (!term.endsWith('s')) searchTerms.add(term + 's');
  const likeConditions = Array.from(searchTerms)
    .map((t) => `LOWER(t.table_name) LIKE '%${t}%'`)
    .join(' OR ');
  const colLikeConditions = Array.from(searchTerms)
    .map((t) => `LOWER(column_name) LIKE '%${t}%'`)
    .join(' OR ');
  const resultsMap = new Map<string, DiscoverySearchResult>();

  onStatus?.(`Searching for \"${term}\" across ${datasets.length} datasets in ${project}...`);
  await Promise.all(
    datasets.map(async (dataset) => {
      try {
        // Match table names
        const tablesSql = [
          `SELECT t.table_name, t.table_type, o.option_value AS description`,
          `FROM \`${project}.${dataset}\`.INFORMATION_SCHEMA.TABLES t`,
          `LEFT JOIN \`${project}.${dataset}\`.INFORMATION_SCHEMA.TABLE_OPTIONS o`,
          `  ON t.table_name = o.table_name AND o.option_name = 'description'`,
          `WHERE ${likeConditions}`,
        ].join(' ');

        const tablesResult = await executeQuery(tablesSql, project).catch(() => null);
        if (tablesResult) {
          for (const row of tablesResult.rows) {
            const name = String(row[0] ?? '');
            const rawType = String(row[1] ?? 'TABLE').toUpperCase();
            const type: DiscoverySearchResult['type'] =
              rawType === 'VIEW' ? 'VIEW' : 'TABLE';
            const ref = `${project}.${dataset}.${name}`;
            if (!resultsMap.has(ref)) {
              resultsMap.set(ref, {
                type,
                ref,
                matchedOn: 'table_name',
                description: row[2] ? String(row[2]).replace(/^"|"+$/g, '') : null,
              });
            }
          }
        }

        // Match column names
        const colsSql = [
          `SELECT DISTINCT table_name`,
          `FROM \`${project}.${dataset}\`.INFORMATION_SCHEMA.COLUMNS`,
          `WHERE ${colLikeConditions}`,
        ].join(' ');

        const colsResult = await executeQuery(colsSql, project).catch(() => null);
        if (colsResult) {
          for (const row of colsResult.rows) {
            const name = String(row[0] ?? '');
            const ref = `${project}.${dataset}.${name}`;
            if (!resultsMap.has(ref)) {
              resultsMap.set(ref, {
                type: 'TABLE',
                ref,
                matchedOn: 'column_name',
                description: null,
              });
            } else {
              const existing = resultsMap.get(ref)!;
              if (existing.matchedOn === 'table_name') {
                existing.matchedOn = 'table_name, column_name';
              }
            }
          }
        }
      } catch {
        // Non-fatal — skip inaccessible datasets
      }
    })
  );

  const result: DiscoveryResult = {
    skill: 'discovery',
    discoveryType: 'SEARCH',
    query: intent.query,
    results: Array.from(resultsMap.values()),
    comparison: null,
  };
  return [compose('discovery', result)];
}

// ─── Skill manifest ───────────────────────────────────────────────────────────

export const manifest: SkillManifest = {
  skill: 'discovery',
  label: 'discovery search',
  signals: [
    { phrase: 'search', weight: 2 },
    { phrase: 'find a table', weight: 3 },
    { phrase: 'find tables', weight: 3 },
    { phrase: 'compare', weight: 3 },
    { phrase: 'lineage', weight: 3 },
    { phrase: 'where does this come from', weight: 3 },
    { phrase: 'what depends on', weight: 3 },
    { phrase: 'related to', weight: 2 },
    { phrase: 'er diagram', weight: 3 },
    { phrase: 'entity relationship', weight: 3 },
    { phrase: 'table relationships', weight: 3 },
    { phrase: 'how are tables related', weight: 3 },
    { phrase: 'relationships between', weight: 3 },
    { phrase: 'foreign keys in', weight: 3 },
    { phrase: 'show relationships', weight: 3 },
  ],
  handle: handleDiscovery,
};
