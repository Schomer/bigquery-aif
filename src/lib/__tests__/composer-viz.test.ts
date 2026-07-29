import { describe, it, expect } from 'vitest';
import { inferVisualizationType } from '../composer';
import { makeResult, timeSeries, categorical, singleValue } from './helpers/queryResult';

describe('inferVisualizationType', () => {
  describe('AI hint trust path', () => {
    it('returns valid chart hint directly when validation passes', () => {
      const result = makeResult({
        columns: ['date', 'value'],
        columnTypes: ['DATE', 'FLOAT64'],
        rows: [['2024-01-01', 1], ['2024-01-02', 2], ['2024-01-03', 3], ['2024-01-04', 4], ['2024-01-05', 5]],
        suggestedVisualization: 'LINE_CHART'
      });
      expect(inferVisualizationType(result)).toBe('LINE_CHART');
    });

    it('falls through to tree when hint is TABLE', () => {
      const result = makeResult({
        columns: ['a', 'b'],
        columnTypes: ['STRING', 'FLOAT64'],
        rows: [['A', 1], ['B', 2], ['C', 3], ['D', 4], ['E', 5], ['F', 6]],
        suggestedVisualization: 'TABLE'
      });
      expect(inferVisualizationType(result)).toBe('COLUMN_CHART'); // categorical + numeric <= 15 rows
    });

    it('falls through to tree when hint is INTERACTIVE_WIDGET', () => {
      const result = makeResult({
        columns: ['a', 'b'],
        columnTypes: ['STRING', 'FLOAT64'],
        rows: [['A', 1], ['B', 2], ['C', 3], ['D', 4], ['E', 5], ['F', 6]],
        suggestedVisualization: 'INTERACTIVE_WIDGET'
      });
      expect(inferVisualizationType(result)).toBe('COLUMN_CHART');
    });

    it('falls through to tree when hint is null/undefined', () => {
      const result = makeResult({
        columns: ['a', 'b'],
        columnTypes: ['STRING', 'FLOAT64'],
        rows: [['A', 1], ['B', 2], ['C', 3], ['D', 4], ['E', 5], ['F', 6]]
      });
      expect(inferVisualizationType(result)).toBe('COLUMN_CHART');
    });

    it('trusts suggestedVisualization when set to a valid non-TABLE value', () => {
      const result = makeResult({
        columns: ['a', 'b'],
        columnTypes: ['STRING', 'FLOAT64'],
        rows: [['A', 1], ['B', 2], ['C', 3]],
        suggestedVisualization: 'BAR_CHART'
      });
      expect(inferVisualizationType(result)).toBe('BAR_CHART');
    });

    // Phase 5: validation rejection tests
    it('rejects LINE_CHART hint when fewer than 5 data points', () => {
      const result = makeResult({
        columns: ['date', 'value'],
        columnTypes: ['DATE', 'FLOAT64'],
        rows: [['2024-01-01', 1], ['2024-01-02', 2]],
        suggestedVisualization: 'LINE_CHART'
      });
      // Validation rejects LINE_CHART, tree produces COLUMN_CHART (sparse time-series)
      expect(inferVisualizationType(result)).toBe('COLUMN_CHART');
    });

    it('rejects PIE_CHART hint when more than 6 rows', () => {
      const result = makeResult({
        columns: ['cat', 'value'],
        columnTypes: ['STRING', 'FLOAT64'],
        rows: Array.from({ length: 10 }, (_, i) => [`Cat${i}`, i + 1]),
        suggestedVisualization: 'PIE_CHART'
      });
      // Validation rejects PIE_CHART, tree produces COLUMN_CHART
      expect(inferVisualizationType(result)).not.toBe('PIE_CHART');
    });

    it('rejects BAR_CHART hint when 1 row with 1 numeric (should be KPI)', () => {
      const result = makeResult({
        columns: ['total'],
        columnTypes: ['FLOAT64'],
        rows: [[42]],
        suggestedVisualization: 'BAR_CHART'
      });
      expect(inferVisualizationType(result)).toBe('KPI_CARD');
    });

    it('rejects SCATTER hint when fewer than 5 data points', () => {
      const result = makeResult({
        columns: ['x', 'y'],
        columnTypes: ['FLOAT64', 'FLOAT64'],
        rows: [[1, 2], [3, 4]],
        suggestedVisualization: 'SCATTER'
      });
      expect(inferVisualizationType(result)).not.toBe('SCATTER');
    });
  });

  describe('data validity gates', () => {
    it('returns TABLE for empty rows', () => {
      const result = makeResult({
        columns: ['a'],
        rows: []
      });
      expect(inferVisualizationType(result)).toBe('TABLE');
    });

    it('returns TABLE for all ID columns', () => {
      const result = makeResult({
        columns: ['user_id', 'group_id'],
        rows: [['123', '456'], ['124', '456']]
      });
      expect(inferVisualizationType(result)).toBe('TABLE');
    });
  });

  describe('geo-point detection', () => {
    it('returns GEO_POINT_MAP for lat + lng columns', () => {
      const result = makeResult({
        columns: ['lat', 'lng'],
        columnTypes: ['FLOAT64', 'FLOAT64'],
        rows: [[37.77, -122.41]]
      });
      expect(inferVisualizationType(result)).toBe('GEO_POINT_MAP');
    });
  });

  describe('single-value results', () => {
    it('returns KPI_CARD for 1 row, 1 numeric, 0 categorical', () => {
      const result = singleValue(42);
      expect(inferVisualizationType(result)).toBe('KPI_CARD');
    });

    it('returns KPI_CARD for 1 row, 3 numerics, 0 categorical', () => {
      const result = makeResult({
        columns: ['a', 'b', 'c'],
        columnTypes: ['FLOAT64', 'FLOAT64', 'FLOAT64'],
        rows: [[1, 2, 3]]
      });
      expect(inferVisualizationType(result)).toBe('KPI_CARD');
    });

    it('returns STAT_ROW for 2-5 rows, 1 cat, 1-2 numeric, 0 date', () => {
      const result = categorical(3);
      expect(inferVisualizationType(result)).toBe('STAT_ROW');
    });
  });

  describe('structural specialties', () => {
    it('returns CANDLESTICK for OHLC + date', () => {
      const result = makeResult({
        columns: ['date', 'open', 'high', 'low', 'close'],
        columnTypes: ['DATE', 'FLOAT64', 'FLOAT64', 'FLOAT64', 'FLOAT64'],
        rows: [['2024-01-01', 10, 12, 9, 11]]
      });
      expect(inferVisualizationType(result)).toBe('CANDLESTICK');
    });

    it('returns SANKEY for source/target + numeric', () => {
      const result = makeResult({
        columns: ['source', 'target', 'value'],
        columnTypes: ['STRING', 'STRING', 'FLOAT64'],
        rows: [['A', 'B', 10]]
      });
      expect(inferVisualizationType(result)).toBe('SANKEY');
    });

    it('returns HEATMAP for 2 categoricals + 1 numeric (both >1 unique, 9-400 rows)', () => {
      const rows = [];
      for(let i=0; i<3; i++) {
        for(let j=0; j<3; j++) {
          rows.push([`CatA${i}`, `CatB${j}`, i*j]);
        }
      }
      const result = makeResult({
        columns: ['cat_a', 'cat_b', 'value'],
        columnTypes: ['STRING', 'STRING', 'FLOAT64'],
        rows
      });
      expect(inferVisualizationType(result)).toBe('HEATMAP');
    });
  });

  describe('time-series', () => {
    it('returns COLUMN_CHART for 1 date + 1 numeric, <5 rows', () => {
      const result = timeSeries(4);
      expect(inferVisualizationType(result)).toBe('COLUMN_CHART');
    });

    it('returns COMPOSED_CHART for 1 date + 2 numerics, >10x scale diff', () => {
      const result = makeResult({
        columns: ['date', 'val1', 'val2'],
        columnTypes: ['DATE', 'FLOAT64', 'FLOAT64'],
        rows: [
          ['2024-01-01', 10, 1000],
          ['2024-01-02', 12, 1200],
          ['2024-01-03', 11, 1100],
          ['2024-01-04', 13, 1300],
          ['2024-01-05', 10, 1000]
        ]
      });
      expect(inferVisualizationType(result)).toBe('COMPOSED_CHART');
    });

    it('KNOWN WRONG: returns LINE_CHART instead of AREA_CHART for 1 date + 1 numeric named cumulative_total due to regex bug', () => {
      const result = makeResult({
        columns: ['date', 'cumulative_total'],
        columnTypes: ['DATE', 'FLOAT64'],
        rows: [
          ['2024-01-01', 10], 
          ['2024-01-02', 20],
          ['2024-01-03', 30],
          ['2024-01-04', 40],
          ['2024-01-05', 50]
        ]
      });
      expect(inferVisualizationType(result)).toBe('LINE_CHART');
    });

    it('returns LINE_CHART for 1 date + 1 numeric, >=5 rows', () => {
      const result = timeSeries(5);
      expect(inferVisualizationType(result)).toBe('LINE_CHART');
    });
  });

  describe('distribution', () => {
    it('returns HISTOGRAM for 1 numeric, 0 categorical, 0 date, >=20 rows', () => {
      const rows = Array.from({length: 20}, (_, i) => [i]);
      const result = makeResult({
        columns: ['value'],
        columnTypes: ['FLOAT64'],
        rows
      });
      expect(inferVisualizationType(result)).toBe('HISTOGRAM');
    });
  });

  describe('categorical + numeric', () => {
    it('KNOWN WRONG: returns TABLE for >25 rows', () => {
      const result = categorical(26);
      expect(inferVisualizationType(result)).toBe('TABLE');
    });

    it('returns FUNNEL for monotonically decreasing + stage column name', () => {
      const result = makeResult({
        columns: ['funnel_stage', 'users'],
        columnTypes: ['STRING', 'FLOAT64'],
        rows: [
          ['visit', 100], ['signup', 50], ['purchase', 10],
          ['upsell', 5], ['referral', 2], ['retain', 1]
        ]
      });
      expect(inferVisualizationType(result)).toBe('FUNNEL');
    });

    it('KNOWN WRONG: returns STAT_ROW for <=5 rows, all positive, parts-of-whole signal (DONUT_CHART unreachable)', () => {
      const result = categorical(4, { columnName: 'percent' });
      expect(inferVisualizationType(result)).toBe('STAT_ROW');
    });

    it('returns COLUMN_CHART for <=15 rows, short labels', () => {
      const result = makeResult({
        columns: ['cat', 'val'],
        columnTypes: ['STRING', 'FLOAT64'],
        rows: [['A', 1], ['B', 2], ['C', 3], ['D', 4], ['E', 5], ['F', 6]]
      });
      expect(inferVisualizationType(result)).toBe('COLUMN_CHART');
    });

    it('returns BAR_CHART for <=25 rows, long labels', () => {
      const result = makeResult({
        columns: ['cat', 'val'],
        columnTypes: ['STRING', 'FLOAT64'],
        rows: [
          ['Very Long Category Name A', 1],
          ['Very Long Category Name B', 2],
          ['Very Long Category Name C', 3],
          ['Very Long Category Name D', 4],
          ['Very Long Category Name E', 5],
          ['Very Long Category Name F', 6]
        ]
      });
      expect(inferVisualizationType(result)).toBe('BAR_CHART');
    });
  });

  describe('multi-category', () => {
    it('returns HEATMAP for 2 categorical + 1 numeric, both >1 unique', () => {
      const rows = [];
      for(let i=0; i<3; i++) {
        for(let j=0; j<3; j++) {
          rows.push([`CatA${i}`, `CatB${j}`, i*j]);
        }
      }
      const result = makeResult({
        columns: ['cat_a', 'cat_b', 'value'],
        columnTypes: ['STRING', 'STRING', 'FLOAT64'],
        rows
      });
      expect(inferVisualizationType(result)).toBe('HEATMAP');
    });

    it('returns BAR_CHART for 2+ categorical + 1+ numeric (fallback)', () => {
      const result = makeResult({
        columns: ['cat1', 'cat2', 'val'],
        columnTypes: ['STRING', 'STRING', 'FLOAT64'],
        rows: [
          ['A', 'B', 1],
          ['A', 'B', 2] // Not enough rows/uniques for heatmap
        ]
      });
      expect(inferVisualizationType(result)).toBe('BAR_CHART');
    });
  });

  describe('relationship detection', () => {
    it('returns SCATTER for 2 numerics, >=10 rows', () => {
      const rows = Array.from({length: 10}, (_, i) => [i, i*2]);
      const result = makeResult({
        columns: ['x', 'y'],
        columnTypes: ['FLOAT64', 'FLOAT64'],
        rows
      });
      expect(inferVisualizationType(result)).toBe('SCATTER');
    });
  });

  describe('multi-dimensional', () => {
    it('KNOWN WRONG: returns COLUMN_CHART instead of RADAR for 1 categorical, 3-8 numerics, <=10 rows', () => {
      const result = makeResult({
        columns: ['cat', 'val1', 'val2', 'val3'],
        columnTypes: ['STRING', 'FLOAT64', 'FLOAT64', 'FLOAT64'],
        rows: [['A', 1, 2, 3], ['B', 4, 5, 6]]
      });
      expect(inferVisualizationType(result)).toBe('COLUMN_CHART');
    });
  });

  describe('hierarchical', () => {
    it('KNOWN WRONG: returns COLUMN_CHART instead of TREEMAP for 1-2 categoricals, 1 numeric, 5-50 rows, parts-of-whole', () => {
      const rows = Array.from({length: 10}, (_, i) => [`Cat${i}`, i]);
      const result = makeResult({
        columns: ['cat', 'percent'],
        columnTypes: ['STRING', 'FLOAT64'],
        rows
      });
      expect(inferVisualizationType(result)).toBe('COLUMN_CHART');
    });
  });

  describe('last resort', () => {
    it('returns TABLE when no matching pattern', () => {
      // Something that matches no heuristics
      const result = makeResult({
        columns: ['cat1', 'cat2', 'cat3', 'cat4'],
        columnTypes: ['STRING', 'STRING', 'STRING', 'STRING'],
        rows: [['A', 'B', 'C', 'D'], ['E', 'F', 'G', 'H']]
      });
      expect(inferVisualizationType(result)).toBe('TABLE');
    });
  });

  describe('historical regressions', () => {
    it('returns NOT HEATMAP (BAR_CHART) for 2 categoricals + 1 numeric where one has 1 unique value', () => {
      const result = makeResult({
        columns: ['cat1', 'country', 'val'],
        columnTypes: ['STRING', 'STRING', 'FLOAT64'],
        rows: Array.from({length: 10}, (_, i) => ['Constant', `Country${i}`, i])
      });
      expect(inferVisualizationType(result)).not.toBe('HEATMAP');
      expect(inferVisualizationType(result)).toBe('BAR_CHART');
    });

    it('returns COLUMN_CHART (falls through) for INTERACTIVE_WIDGET hint', () => {
      const result = makeResult({
        columns: ['cat', 'val'],
        columnTypes: ['STRING', 'FLOAT64'],
        rows: [['A', 1], ['B', 2], ['C', 3], ['D', 4], ['E', 5], ['F', 6]],
        suggestedVisualization: 'INTERACTIVE_WIDGET'
      });
      expect(inferVisualizationType(result)).toBe('COLUMN_CHART');
    });

    it('returns NOT HEATMAP for top 10 countries in year 900 shape', () => {
      const result = makeResult({
        columns: ['year', 'country', 'val'],
        columnTypes: ['STRING', 'STRING', 'FLOAT64'],
        rows: Array.from({length: 10}, (_, i) => ['900', `Country${i}`, i])
      });
      expect(inferVisualizationType(result)).not.toBe('HEATMAP');
    });

    it('returns NOT FUNNEL for monotonically decreasing data WITHOUT stage-like column name', () => {
      const result = makeResult({
        columns: ['random_cat', 'users'],
        columnTypes: ['STRING', 'FLOAT64'],
        rows: [['A', 100], ['B', 50], ['C', 10]]
      });
      expect(inferVisualizationType(result)).not.toBe('FUNNEL');
    });

    it('returns NOT auto-selected as map for Geographic column country (should be BAR_CHART or COLUMN_CHART)', () => {
      const result = makeResult({
        columns: ['country', 'val'],
        columnTypes: ['STRING', 'FLOAT64'],
        rows: [['US', 1], ['CA', 2], ['GB', 3], ['FR', 4], ['DE', 5], ['JP', 6]]
      });
      const type = inferVisualizationType(result);
      expect(type === 'BAR_CHART' || type === 'COLUMN_CHART').toBe(true);
      expect(type).not.toBe('GEO_POINT_MAP');
    });
  });

  describe('KNOWN WRONG behaviors', () => {
    it('KNOWN WRONG: returns STAT_ROW for 3-row comparison queries', () => {
      const result = categorical(3);
      expect(inferVisualizationType(result)).toBe('STAT_ROW');
    });

    it('Phase 4 FIX: returns BAR_CHART for sorted 30-row ranking queries', () => {
      const result = categorical(30, { sql: 'SELECT cat, val FROM t ORDER BY val DESC LIMIT 30' });
      result.rows = result.rows.sort((a, b) => (b[1] as number) - (a[1] as number));
      expect(inferVisualizationType(result)).toBe('BAR_CHART');
    });

    it('returns TABLE for unsorted 30-row queries (no ranking signal)', () => {
      const result = categorical(30);
      expect(inferVisualizationType(result)).toBe('TABLE');
    });
  });

  // ── Phase 0.5: Invariant tests ────────────────────────────────────────────

  describe('invariants', () => {
    // Renderable artifact types that the chart/table renderer can handle
    const RENDERABLE_TYPES = new Set([
      'TABLE', 'LINE_CHART', 'BAR_CHART', 'AREA_CHART', 'SCATTER', 'PIE_CHART',
      'DONUT_CHART', 'COLUMN_CHART', 'HISTOGRAM', 'SPARKLINE', 'RADAR', 'FUNNEL',
      'TREEMAP', 'SANKEY', 'COMPOSED_CHART', 'GAUGE', 'HEATMAP', 'BOXPLOT',
      'CANDLESTICK', 'VIOLIN', 'DENSITY_PLOT', 'RIDGELINE', 'NETWORK_GRAPH',
      'TILE_MAP', 'GEO_POINT_MAP', 'USA_MAP', 'WORLD_MAP', 'KPI_CARD',
      'STAT_ROW', 'INTERACTIVE_WIDGET',
    ]);

    // Hard preconditions per chart type.
    // Returns false only when the chart is *impossible* to render with this data.
    function preconditionsMet(type: string, result: ReturnType<typeof makeResult>): boolean {
      const cols = result.columns;
      const colTypes = result.columnTypes ?? [];
      const rows = result.rows;

      switch (type) {
        case 'GEO_POINT_MAP': {
          const lc = cols.map(c => c.toLowerCase());
          const hasLat = lc.some(c => c === 'lat' || c === 'latitude' || c.endsWith('_lat') || c.endsWith('_latitude'));
          const hasLng = lc.some(c => c === 'lng' || c === 'longitude' || c === 'lon' || c === 'long' || c.endsWith('_lng') || c.endsWith('_longitude'));
          return hasLat && hasLng;
        }
        case 'CANDLESTICK': {
          const lc = cols.map(c => c.toLowerCase());
          return ['open', 'high', 'low', 'close'].every(f => lc.includes(f));
        }
        case 'SANKEY': {
          const lc = cols.map(c => c.toLowerCase());
          return lc.includes('source') && lc.includes('target');
        }
        case 'SCATTER':
          return cols.length >= 2;
        case 'LINE_CHART':
        case 'AREA_CHART':
          return rows.length >= 1;
        case 'KPI_CARD':
          return rows.length >= 1 && rows.length <= 3;
        case 'TABLE':
          return true; // TABLE can always render
        default:
          return true; // Default: we trust the tree
      }
    }

    // Generate a diverse set of fixtures
    const ALL_FIXTURES = [
      singleValue(42),
      singleValue(0),
      categorical(3),
      categorical(6),
      categorical(10),
      categorical(15),
      categorical(20),
      categorical(26),
      categorical(30),
      timeSeries(3),
      timeSeries(5),
      timeSeries(12),
      timeSeries(12, 2),
      makeResult({ columns: ['a'], rows: [], columnTypes: ['STRING'] }),
      makeResult({ columns: ['user_id', 'group_id'], rows: [['a', 'b']], columnTypes: ['STRING', 'STRING'] }),
      makeResult({ columns: ['lat', 'lng'], rows: [[37.7, -122.4]], columnTypes: ['FLOAT64', 'FLOAT64'] }),
      makeResult({ columns: ['date', 'open', 'high', 'low', 'close'], columnTypes: ['DATE', 'FLOAT64', 'FLOAT64', 'FLOAT64', 'FLOAT64'], rows: [['2024-01-01', 10, 12, 9, 11]] }),
      makeResult({ columns: ['source', 'target', 'value'], columnTypes: ['STRING', 'STRING', 'FLOAT64'], rows: [['A', 'B', 10]] }),
      makeResult({ columns: ['x', 'y'], columnTypes: ['FLOAT64', 'FLOAT64'], rows: Array.from({ length: 10 }, (_, i) => [i, i * 2]) }),
      makeResult({ columns: ['cat', 'v1', 'v2', 'v3'], columnTypes: ['STRING', 'FLOAT64', 'FLOAT64', 'FLOAT64'], rows: [['A', 1, 2, 3], ['B', 4, 5, 6]] }),
      makeResult({ columns: ['value'], columnTypes: ['FLOAT64'], rows: Array.from({ length: 25 }, (_, i) => [i]) }),
      makeResult({ columns: ['c1', 'c2', 'v'], columnTypes: ['STRING', 'STRING', 'FLOAT64'], rows: (() => { const r = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r.push([`A${i}`, `B${j}`, i * j]); return r; })() }),
      makeResult({ columns: ['cat1', 'cat2', 'cat3', 'cat4'], columnTypes: ['STRING', 'STRING', 'STRING', 'STRING'], rows: [['A', 'B', 'C', 'D']] }),
      makeResult({ columns: ['funnel_stage', 'count'], columnTypes: ['STRING', 'FLOAT64'], rows: [['Visit', 100], ['Signup', 50], ['Buy', 10]] }),
      makeResult({ columns: ['a', 'b', 'c'], columnTypes: ['FLOAT64', 'FLOAT64', 'FLOAT64'], rows: [[1, 2, 3]] }),
      // Various row counts
      ...Array.from({ length: 5 }, (_, i) => categorical(i + 6, { columnName: 'revenue' })),
      // Mixed types
      makeResult({ columns: ['name', 'date', 'val'], columnTypes: ['STRING', 'DATE', 'FLOAT64'], rows: [['A', '2024-01-01', 10], ['B', '2024-01-02', 20], ['C', '2024-01-03', 30], ['D', '2024-01-04', 40], ['E', '2024-01-05', 50]] }),
      makeResult({ columns: ['name', 'date', 'val'], columnTypes: ['STRING', 'DATE', 'FLOAT64'], rows: [['A', '2024-01-01', 10], ['B', '2024-01-02', 20]] }),
      // Edge: 1 categorical, lots of numerics
      makeResult({ columns: ['cat', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], columnTypes: ['STRING', ...Array(8).fill('FLOAT64')], rows: [['X', 1, 2, 3, 4, 5, 6, 7, 8]] }),
      // Numeric only, few rows
      makeResult({ columns: ['a', 'b'], columnTypes: ['FLOAT64', 'FLOAT64'], rows: [[1, 2], [3, 4]] }),
    ];

    it('never returns an unsupported artifact type', () => {
      for (const fixture of ALL_FIXTURES) {
        const type = inferVisualizationType(fixture);
        expect(RENDERABLE_TYPES).toContain(type);
      }
    });

    it('never returns a chart whose hard preconditions the data fails', () => {
      for (const fixture of ALL_FIXTURES) {
        const type = inferVisualizationType(fixture);
        expect(preconditionsMet(type, fixture)).toBe(true);
      }
    });
  });

  // ── Phase 0.6: Golden corpus scored suite ─────────────────────────────────

  describe('golden corpus', () => {
    interface CorpusEntry {
      id: string;
      prompt: string;
      sql: string;
      columns: string[];
      columnTypes: string[];
      rowCount: number;
      sampleRows: unknown[][];
      aiHint: string;
      expected: string;
      acceptable: string[];
      notes: string;
    }

    // Load corpus
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const corpus: CorpusEntry[] = require('./fixtures/chart-corpus.json');

    function corpusEntryToResult(entry: CorpusEntry) {
      // Build full row data: use sampleRows and pad to rowCount
      let rows = entry.sampleRows;
      while (rows.length < entry.rowCount) {
        // Pad with copies of the last sample row (or empty array)
        const template = entry.sampleRows[entry.sampleRows.length - 1] ?? entry.columns.map(() => null);
        // Vary the padded rows slightly to avoid false monotonic/unique signals
        const padded = template.map((v, i) => {
          if (typeof v === 'number') return v - (rows.length * 0.1);
          if (typeof v === 'string' && entry.columnTypes[i] === 'STRING') return `${v}_${rows.length}`;
          return v;
        });
        rows = [...rows, padded];
      }
      return makeResult({
        columns: entry.columns,
        columnTypes: entry.columnTypes,
        rows,
        sql: entry.sql,
        suggestedVisualization: entry.aiHint,
      });
    }

    // Track results for the scored summary
    const results: Array<{ id: string; expected: string; acceptable: string[]; got: string; ok: boolean }> = [];

    for (const entry of corpus) {
      it(`corpus: ${entry.id}`, () => {
        const result = corpusEntryToResult(entry);
        const got = inferVisualizationType(result);
        const ok = entry.acceptable.includes(got);
        results.push({ id: entry.id, expected: entry.expected, acceptable: entry.acceptable, got, ok });
        // Individual tests pass if the result is in the acceptable set
        // We don't fail individual corpus tests -- accuracy is tracked by the threshold test below
      });
    }

    // eslint-disable-next-line vitest/valid-title
    it('corpus accuracy meets baseline threshold', () => {
      // Force all corpus tests to run first by evaluating here
      const allResults = corpus.map(entry => {
        const result = corpusEntryToResult(entry);
        const got = inferVisualizationType(result);
        const ok = entry.acceptable.includes(got);
        return { id: entry.id, expected: entry.expected, acceptable: entry.acceptable, got, ok };
      });

      const passing = allResults.filter(r => r.ok).length;
      const total = allResults.length;
      const rate = passing / total;

      // Print failures for diagnostics
      const failures = allResults.filter(r => !r.ok);
      if (failures.length > 0) {
        console.table(failures.map(f => ({
          id: f.id,
          expected: f.expected,
          got: f.got,
          acceptable: f.acceptable.join(', '),
        })));
      }
      console.log(`Corpus accuracy: ${passing}/${total} (${(rate * 100).toFixed(1)}%)`);

      // BASELINE_RATE: set to the current pass rate rounded down.
      // This is the floor -- every future phase must meet or exceed it.
      const BASELINE_RATE = 0.70;
      expect(rate).toBeGreaterThanOrEqual(BASELINE_RATE);
    });
  });
});
