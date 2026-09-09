// Builder document types.
// Unified model for all composable document types: dashboard, app, report, recipe.

import type { ArtifactType, CompositionEnvelope, InteractiveWidgetData } from './types';
export type { ArtifactType };

export type DocumentType = 'dashboard' | 'app' | 'report' | 'recipe';

export type FilterControlType = 'DROPDOWN' | 'MULTI_SELECT' | 'DATE_RANGE' | 'SEARCH_INPUT' | 'NUMBER_INPUT';

export interface AppFilterControl {
  id: string;
  label: string;
  type: FilterControlType;
  paramName: string; // e.g. 'country' or 'start_date' or '{{country}}'
  column?: string;
  defaultValue?: string | number | string[] | null;
  options?: string[];
  optionsSql?: string; // Query to populate options dynamically from BigQuery
}

export interface TileSnapshot {
  columns: string[];
  rows: (string | number | boolean | null)[][];
  rowCount: number;
  fetchedAt: string;
}

export interface BuilderTile {
  id: string;
  title: string;
  cachedSql?: string;
  parameterizedSql?: string;
  vizType?: ArtifactType;
  /** Snapshot of primaryArtifact.data for immediate rendering without re-query. */
  artifactData?: unknown;
  col: number;       // 0-based column in 12-col grid
  row: number;       // 0-based row
  colSpan: number;   // 1-12
  rowSpan: number;   // 1-4
  sourceEnvelopeId?: string;
  // App-specific: maps filter control IDs or paramNames to SQL template variables
  parameterBindings?: Record<string, string>;
  // Report-specific
  tileType?: 'query' | 'text' | 'control';
  textContent?: string;
  // Recipe-specific
  sourcePrompt?: string;
  stepOrder?: number;
  // Cached execution snapshot
  lastSnapshot?: TileSnapshot;
}

export interface BuilderDocument {
  id: string;
  userId: string;
  type: DocumentType;
  name: string;
  description: string;
  tiles: BuilderTile[];
  globalFilters?: AppFilterControl[];
  filterValues?: Record<string, any>;
  project?: string;
  density?: 'compact' | 'standard' | 'spacious';
  createdAt: string;
  updatedAt: string;
  tags: string[];
  spaceId?: string;
  thumbnailUrl?: string;
}

/** Convert a CompositionEnvelope into a BuilderTile at a given grid position. */
export function envelopeToTile(
  envelope: CompositionEnvelope,
  col: number,
  row: number,
): BuilderTile {
  let cachedSql = envelope.provenance.sql;
  let parameterizedSql: string | undefined = undefined;
  let vizType = envelope.primaryArtifact.type;
  let artifactData = envelope.primaryArtifact.data;
  let lastSnapshot: TileSnapshot | undefined = undefined;

  // If this was an INTERACTIVE_WIDGET, extract inner query, parameters, and visualization
  if (envelope.primaryArtifact.type === 'INTERACTIVE_WIDGET') {
    const widget = envelope.primaryArtifact.data as InteractiveWidgetData;
    if (widget) {
      cachedSql = widget.baseSql;
      parameterizedSql = widget.parameterizedSql;
      vizType = widget.visualization as ArtifactType;
      artifactData = widget.initialResult;
    }
  }

  // If this is a SCHEMA_VIEW or table exploration card, synthesize table query and extract sample data
  if (envelope.primaryArtifact.type === 'SCHEMA_VIEW' || (artifactData && typeof artifactData === 'object' && 'table' in artifactData)) {
    vizType = 'TABLE';
    const schemaObj = artifactData as {
      project?: string;
      dataset?: string;
      table?: string;
      columns?: Array<{ name: string; type?: string } | string>;
      sampleRows?: unknown[];
      sample?: { columns?: string[]; rows?: unknown[][] };
    };

    const dataset = schemaObj?.dataset || (envelope.provenance as Record<string, unknown>)?.dataset as string | undefined;
    const table = schemaObj?.table || (envelope.provenance as Record<string, unknown>)?.table as string | undefined;
    const project = schemaObj?.project || envelope.provenance.project;

    if (dataset && table) {
      const fullTableRef = project ? `${project}.${dataset}.${table}` : `${dataset}.${table}`;
      if (!cachedSql) {
        cachedSql = `SELECT * FROM \`${fullTableRef}\` LIMIT 100`;
      }
    }

    // Extract columns
    let extractedCols: string[] = [];
    if (Array.isArray(schemaObj?.columns)) {
      extractedCols = schemaObj.columns.map((c) => (typeof c === 'string' ? c : c.name || String(c)));
    } else if (schemaObj?.sample?.columns) {
      extractedCols = schemaObj.sample.columns;
    }

    // Extract sample rows if present
    const rawSampleRows = schemaObj?.sampleRows || schemaObj?.sample?.rows;
    if (Array.isArray(rawSampleRows) && rawSampleRows.length > 0 && extractedCols.length > 0) {
      const rows: (string | number | boolean | null)[][] = rawSampleRows.map((r) => {
        if (Array.isArray(r)) return r as (string | number | boolean | null)[];
        if (typeof r === 'object' && r !== null) {
          const rec = r as Record<string, unknown>;
          return extractedCols.map((c) => (rec[c] !== undefined ? (rec[c] as string | number | boolean | null) : null));
        }
        return [r as string | number | boolean | null];
      });

      lastSnapshot = {
        columns: extractedCols,
        rows,
        rowCount: rows.length,
        fetchedAt: new Date().toISOString(),
      };
    }
  }

  // Extract snapshot if rows exist on data object
  if (!lastSnapshot && artifactData && typeof artifactData === 'object' && 'columns' in artifactData && 'rows' in artifactData) {
    const dataObj = artifactData as { columns: string[]; rows: (string | number | boolean | null)[][]; rowCount?: number };
    if (Array.isArray(dataObj.rows) && dataObj.rows.length > 0) {
      lastSnapshot = {
        columns: dataObj.columns || [],
        rows: dataObj.rows || [],
        rowCount: dataObj.rowCount ?? (dataObj.rows?.length || 0),
        fetchedAt: new Date().toISOString(),
      };
    }
  }

  return {
    id: `tile_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    title: typeof envelope.headline.text === 'string'
      ? envelope.headline.text.slice(0, 80)
      : String(envelope.headline.text ?? 'Untitled'),
    cachedSql,
    parameterizedSql,
    vizType,
    artifactData,
    col,
    row,
    colSpan: 6,
    rowSpan: 2,
    sourceEnvelopeId: envelope.id,
    sourcePrompt: undefined,
    tileType: 'query',
    lastSnapshot,
  };
}

/** Groups tiles sequentially into visual rows according to a 12-column grid. */
export function groupTilesIntoRows(tiles: BuilderTile[]): BuilderTile[][] {
  const rows: BuilderTile[][] = [];
  let currentRow: BuilderTile[] = [];
  let currentWidth = 0;

  for (const tile of tiles) {
    const span = Math.min(12, Math.max(1, tile.colSpan || 6));
    if (currentWidth + span > 12 && currentRow.length > 0) {
      rows.push(currentRow);
      currentRow = [tile];
      currentWidth = span;
    } else {
      currentRow.push(tile);
      currentWidth += span;
    }
  }
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }
  return rows;
}

/** Computes equalized column spans summing to <= 12 for N items in a row. */
export function computeEqualizedSpans(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [12];
  if (count === 2) return [6, 6];
  if (count === 3) return [4, 4, 4];
  if (count === 4) return [3, 3, 3, 3];
  if (count === 5) return [3, 3, 2, 2, 2];
  if (count === 6) return [2, 2, 2, 2, 2, 2];
  const base = Math.max(1, Math.floor(12 / count));
  const remainder = 12 - base * count;
  const result = new Array(count).fill(base);
  for (let i = 0; i < remainder; i++) {
    result[i] += 1;
  }
  return result;
}
