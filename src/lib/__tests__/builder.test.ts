import { describe, it, expect } from 'vitest';
import { envelopeToTile, groupTilesIntoRows, computeEqualizedSpans, equalizeRowTiles } from '../builder-types';
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

  describe('equalizeRowTiles', () => {
    it('distributes 100% width across tiles in a row', () => {
      const t1 = { id: '1', title: 'Tile 1', col: 0, row: 0, colSpan: 12, rowSpan: 2 };
      const t2 = { id: '2', title: 'Tile 2', col: 0, row: 0, colSpan: 12, rowSpan: 2 };
      const t3 = { id: '3', title: 'Tile 3', col: 0, row: 0, colSpan: 12, rowSpan: 2 };

      const eq1 = equalizeRowTiles([t1], 0);
      expect(eq1[0].widthPercent).toBe(100);
      expect(eq1[0].row).toBe(0);

      const eq2 = equalizeRowTiles([t1, t2], 1);
      expect(eq2[0].widthPercent).toBe(50);
      expect(eq2[1].widthPercent).toBe(50);
      expect(eq2[0].row).toBe(1);

      const eq3 = equalizeRowTiles([t1, t2, t3], 2);
      expect(eq3[0].widthPercent).toBeCloseTo(33.333, 2);
      expect(eq3[1].widthPercent).toBeCloseTo(33.333, 2);
      expect(eq3[2].widthPercent).toBeCloseTo(33.333, 2);
    });
  });

  describe('groupTilesIntoRows', () => {
    it('groups tiles by explicit rowIndex when present', () => {
      const t1 = { id: '1', title: 'Tile 1', col: 0, row: 0, rowIndex: 0, colSpan: 6, rowSpan: 2 };
      const t2 = { id: '2', title: 'Tile 2', col: 1, row: 0, rowIndex: 0, colSpan: 6, rowSpan: 2 };
      const t3 = { id: '3', title: 'Tile 3', col: 0, row: 1, rowIndex: 1, colSpan: 12, rowSpan: 2 };

      const rows = groupTilesIntoRows([t1, t2, t3]);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveLength(2);
      expect(rows[1]).toHaveLength(1);
    });
  });

  describe('builder persistence serialization (Firestore safety)', () => {
    it('serializes documents with nested snapshot rows and filter options without top-level nested arrays', async () => {
      const { serializeDocumentPayload, deserializeDocumentPayload, stripUndefined } = await import('../builder-persistence');

      const testDoc = {
        id: 'doc_test_123',
        userId: 'user_abc',
        type: 'dashboard' as const,
        name: 'Sales Dashboard',
        description: 'Revenue analysis',
        tiles: [
          {
            id: 'tile_1',
            title: 'Revenue by Category',
            col: 0,
            row: 0,
            colSpan: 6,
            rowSpan: 2,
            lastSnapshot: {
              columns: ['category', 'revenue'],
              rows: [
                ['Electronics', 50000],
                ['Clothing', 32000],
              ],
              rowCount: 2,
              fetchedAt: '2026-09-09T00:00:00Z',
            },
            parameterBindings: undefined,
          },
        ],
        globalFilters: [
          {
            id: 'filter_1',
            label: 'Region',
            type: 'DROPDOWN' as const,
            paramName: 'region',
            options: ['US', 'EU', 'APAC'],
            defaultValue: undefined,
          },
        ],
        tags: ['sales', '2026'],
        createdAt: '2026-09-09T00:00:00Z',
        updatedAt: '2026-09-09T00:00:00Z',
      };

      const payload = serializeDocumentPayload('user_abc', testDoc);

      // Verify no nested arrays exist in top-level payload properties
      expect(payload.id).toBe('doc_test_123');
      expect(payload.userId).toBe('user_abc');
      expect(payload.docJson).toBeDefined();
      expect(typeof payload.docJson).toBe('string');
      expect(payload.tiles).toBeUndefined(); // tiles serialized inside docJson
      expect(payload.globalFilters).toBeUndefined(); // filters serialized inside docJson
      expect(Array.isArray(payload.tags)).toBe(true);
      expect(payload.tags).toEqual(['sales', '2026']);

      // Ensure no undefined properties leaked
      const rawJson = payload.docJson as string;
      expect(rawJson).not.toContain('"parameterBindings"');

      // Verify full fidelity deserialization
      const restored = deserializeDocumentPayload(payload, 'user_abc');
      expect(restored.id).toBe('doc_test_123');
      expect(restored.name).toBe('Sales Dashboard');
      expect(restored.tiles).toHaveLength(1);
      expect(restored.tiles[0].lastSnapshot?.rows).toEqual([
        ['Electronics', 50000],
        ['Clothing', 32000],
      ]);
      expect(restored.globalFilters?.[0].options).toEqual(['US', 'EU', 'APAC']);
    });
  });
});

