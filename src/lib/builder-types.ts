// Builder document types.
// Unified model for all composable document types: dashboard, app, report, recipe.

import type { ArtifactType, CompositionEnvelope } from './types';

export type DocumentType = 'dashboard' | 'app' | 'report' | 'recipe';

export interface BuilderTile {
  id: string;
  title: string;
  cachedSql?: string;
  vizType?: ArtifactType;
  /** Snapshot of primaryArtifact.data for immediate rendering without re-query. */
  artifactData?: unknown;
  col: number;       // 0-based column in 12-col grid
  row: number;       // 0-based row
  colSpan: number;   // 1-12
  rowSpan: number;   // 1-4
  sourceEnvelopeId?: string;
  // App-specific: maps filter control IDs to SQL template variables
  parameterBindings?: Record<string, string>;
  // Report-specific
  tileType?: 'query' | 'text';
  textContent?: string;
  // Recipe-specific
  sourcePrompt?: string;
  stepOrder?: number;
}

export interface BuilderDocument {
  id: string;
  userId: string;
  type: DocumentType;
  name: string;
  description: string;
  tiles: BuilderTile[];
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
  return {
    id: `tile_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    title: typeof envelope.headline.text === 'string'
      ? envelope.headline.text.slice(0, 80)
      : String(envelope.headline.text ?? 'Untitled'),
    cachedSql: envelope.provenance.sql,
    vizType: envelope.primaryArtifact.type,
    artifactData: envelope.primaryArtifact.data,
    col,
    row,
    colSpan: 6,
    rowSpan: 2,
    sourceEnvelopeId: envelope.id,
    sourcePrompt: undefined,
    tileType: 'query',
  };
}
