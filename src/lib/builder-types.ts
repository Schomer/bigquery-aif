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

  // Extract snapshot if rows exist
  let lastSnapshot: TileSnapshot | undefined = undefined;
  if (artifactData && typeof artifactData === 'object' && 'columns' in artifactData && 'rows' in artifactData) {
    const dataObj = artifactData as { columns: string[]; rows: (string | number | boolean | null)[][]; rowCount?: number };
    lastSnapshot = {
      columns: dataObj.columns || [],
      rows: dataObj.rows || [],
      rowCount: dataObj.rowCount ?? (dataObj.rows?.length || 0),
      fetchedAt: new Date().toISOString(),
    };
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
