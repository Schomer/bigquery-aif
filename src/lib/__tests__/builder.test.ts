import { describe, it, expect } from 'vitest';
import { envelopeToTile, groupTilesIntoRows, computeEqualizedSpans } from '../builder-types';
import type { CompositionEnvelope, SchemaResult } from '../types';
import type { BuilderTile } from '../builder-types';

describe('builder layout & tile hydration', () => {
  describe('envelopeToTile for tables & SCHEMA_VIEW', () => {
    it('synthesizes SQL and extracts sample rows from SCHEMA_VIEW envelope', () => {
      const schemaData: SchemaResult = {
        skill: 'schema',
        scope: 'TABLE',
        project: 'my-gcp-proj',
        dataset: 'analytics',
        table: 'users',
        columns: [
          { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
          { name: 'signup_count', type: 'INT64', mode: 'NULLABLE' },
        ],
        sampleRows: [
          { user_id: 'u_101', signup_count: 5 },
          { user_id: 'u_102', signup_count: 12 },
        ],
        tableConstraints: { primaryKey: [], foreignKeys: [] },
        fetchedAt: '2026-09-08T18:00:00Z',
      };

      const envelope: CompositionEnvelope = {
        id: 'env_schema_1',
        conversationId: 'conv_1',
        turnIndex: 1,
        skill: 'schema',
        tone: 'NEUTRAL',
        headline: { text: 'Table: analytics.users', basis: 'STATUS' },
        qualityFlags: [],
        provenance: { project: 'my-gcp-proj', dataset: 'analytics', table: 'users' },
        primaryArtifact: {
          type: 'SCHEMA_VIEW',
          data: schemaData,
        },
        requiresConfirmation: false,
        suggestedFollowups: [],
      };

      const tile = envelopeToTile(envelope, 0, 0);

      expect(tile.vizType).toBe('TABLE');
      expect(tile.cachedSql).toBe('SELECT * FROM `my-gcp-proj.analytics.users` LIMIT 100');
      expect(tile.lastSnapshot).toBeDefined();
      expect(tile.lastSnapshot?.columns).toEqual(['user_id', 'signup_count']);
      expect(tile.lastSnapshot?.rows).toEqual([
        ['u_101', 5],
        ['u_102', 12],
      ]);
      expect(tile.lastSnapshot?.rowCount).toBe(2);
    });
  });

  describe('groupTilesIntoRows', () => {
    it('groups tiles into 12-column rows based on colSpan', () => {
      const tiles: BuilderTile[] = [
        { id: 't1', title: 'Tile 1', col: 0, row: 0, colSpan: 6, rowSpan: 2 },
        { id: 't2', title: 'Tile 2', col: 6, row: 0, colSpan: 6, rowSpan: 2 },
        { id: 't3', title: 'Tile 3', col: 0, row: 2, colSpan: 4, rowSpan: 2 },
        { id: 't4', title: 'Tile 4', col: 4, row: 2, colSpan: 4, rowSpan: 2 },
        { id: 't5', title: 'Tile 5', col: 8, row: 2, colSpan: 4, rowSpan: 2 },
        { id: 't6', title: 'Tile 6', col: 0, row: 4, colSpan: 12, rowSpan: 3 },
      ];

      const rows = groupTilesIntoRows(tiles);
      expect(rows.length).toBe(3);
      expect(rows[0].map((t) => t.id)).toEqual(['t1', 't2']);
      expect(rows[1].map((t) => t.id)).toEqual(['t3', 't4', 't5']);
      expect(rows[2].map((t) => t.id)).toEqual(['t6']);
    });
  });

  describe('computeEqualizedSpans', () => {
    it('computes exact 12-column divisions for 1, 2, 3, 4, 6 tiles', () => {
      expect(computeEqualizedSpans(1)).toEqual([12]);
      expect(computeEqualizedSpans(2)).toEqual([6, 6]);
      expect(computeEqualizedSpans(3)).toEqual([4, 4, 4]);
      expect(computeEqualizedSpans(4)).toEqual([3, 3, 3, 3]);
      expect(computeEqualizedSpans(5)).toEqual([3, 3, 2, 2, 2]);
      expect(computeEqualizedSpans(6)).toEqual([2, 2, 2, 2, 2, 2]);
    });
  });
});
