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

    it('hydrates chart envelopes into BuilderTile with SQL and cached rows', () => {
      const envelope: CompositionEnvelope = {
        id: 'env_chart_1',
        conversationId: 'conv_1',
        turnIndex: 1,
        skill: 'query',
        tone: 'NEUTRAL',
        headline: { text: 'Monthly Revenue', basis: 'DATA' },
        qualityFlags: [],
        provenance: { sql: 'SELECT month, revenue FROM sales', project: 'my-proj' },
        primaryArtifact: {
          type: 'BAR_CHART',
          data: {
            columns: ['month', 'revenue'],
            rows: [['Jan', 1000], ['Feb', 1500]],
            rowCount: 2,
          },
        },
        requiresConfirmation: false,
        suggestedFollowups: [],
      };

      const tile = envelopeToTile(envelope, 6, 2);
      expect(tile.title).toBe('Monthly Revenue');
      expect(tile.vizType).toBe('BAR_CHART');
      expect(tile.cachedSql).toBe('SELECT month, revenue FROM sales');
      expect(tile.col).toBe(6);
      expect(tile.row).toBe(2);
      expect(tile.lastSnapshot?.rows).toEqual([['Jan', 1000], ['Feb', 1500]]);
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
