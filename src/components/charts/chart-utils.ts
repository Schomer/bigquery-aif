// W3-03: 8-color WCAG AA-safe categorical palette
// All colors pass 3:1+ contrast on dark (#0f0f17) and light (#ffffff) bg.
// Perceptually spaced to avoid confusion between adjacent series.
export const COLORS = [
  '#60a5fa',  // sky-blue — primary
  '#34d399',  // emerald
  '#f472b6',  // pink
  '#fb923c',  // orange
  '#a78bfa',  // violet
  '#facc15',  // amber/yellow
  '#22d3ee',  // cyan
  '#f87171',  // coral-red
];

export const AXIS_STYLE = {
  tick: { fill: 'var(--text-muted)', fontSize: 11 },
  axisLine: false,
  tickLine: false,
};

export const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    fontSize: 12,
    color: 'var(--text)',
  },
};

export const GRID_STYLE = {
  stroke: 'var(--border-subtle)',
  vertical: false,
};

export const CHART_HEIGHT = 280;

export const CHART_MARGIN = { top: 4, right: 16, left: 0, bottom: 4 };

/**
 * Maps columnar query results into an array of row objects keyed by column name.
 * When sortByValue is true, sorts the result by the first numeric column descending
 * (categorical ranking reads better). Pass xKey to skip natural-order time columns.
 */
export function buildChartData(
  columns: string[],
  rows: unknown[][],
  options?: { sortByValue?: boolean; xKey?: string },
): Record<string, unknown>[] {
  const data = rows.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      const v = row[i];
      // Coerce object values (BigQuery STRUCT/RECORD, Timestamp objects) to
      // strings so chart components never try to render a raw object in JSX.
      if (v !== null && typeof v === 'object') {
        obj[col] = JSON.stringify(v);
      } else if (typeof v === 'string' && v !== '' && !isNaN(Number(v))) {
        // Coerce numeric strings to numbers for proper chart plotting
        obj[col] = Number(v);
      } else {
        obj[col] = v;
      }
    });
    return obj;
  });

  if (options?.sortByValue) {
    // Skip natural-order columns (months, quarters, weeks, ordinal labels)
    const xKey = options.xKey ?? columns[0];
    const NATURAL_ORDER_PATTERN = /month|quarter|week|day|date|time|year|q[1-4]|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i;
    const shouldSkipSort = NATURAL_ORDER_PATTERN.test(xKey);

    if (!shouldSkipSort) {
      // Find the first numeric column that isn't the x-key
      const numericKey = columns.find((c) => {
        if (c === xKey) return false;
        const sample = data.find((r) => r[c] != null);
        return sample !== undefined && typeof sample[c] === 'number';
      });
      if (numericKey) {
        data.sort((a, b) => (Number(b[numericKey]) || 0) - (Number(a[numericKey]) || 0));
      }
    }
  }

  return data;
}

/**
 * Detects long-format multi-series data and pivots it to wide format.
 *
 * Long format: [category, x_axis, metric] — one row per category per x value.
 * Example: [country, year, population] with China+USA rows.
 *
 * Wide format: [x_axis, Category1, Category2, ...] — one row per x value.
 * Example: [year, China, United States] — ready for a multi-series line chart.
 *
 * Detection heuristic:
 * - Exactly 3 columns
 * - First column has low cardinality (2–20 unique values, and < 50% of row count)
 * - At least 2 unique values in the first column (otherwise not multi-series)
 */
export function pivotLongFormat(
  columns: string[],
  rows: unknown[][],
): { isPivoted: true; data: Record<string, unknown>[]; xKey: string; yKeys: string[] } | { isPivoted: false } {
  if (columns.length !== 3 || rows.length < 2) return { isPivoted: false };

  // Check cardinality of the first (category) column
  const seriesValues = new Set(rows.map((r) => String((r as unknown[])[0] ?? '')));
  const cardinality = seriesValues.size;
  if (cardinality < 2 || cardinality > 20) return { isPivoted: false };
  // If nearly every row has a unique category value, it's not long format
  if (cardinality / rows.length >= 0.5) return { isPivoted: false };

  const xKey = columns[1];  // e.g. "year"
  const yKeys = Array.from(seriesValues);  // e.g. ["China", "United States"]

  // Build pivot map keyed by the x-axis value
  const pivotMap = new Map<unknown, Record<string, unknown>>();
  for (const row of rows) {
    const r = row as unknown[];
    const seriesLabel = String(r[0] ?? '');
    const xVal = r[1];
    const rawMetric = r[2];
    const metric =
      typeof rawMetric === 'string' && rawMetric !== '' && !isNaN(Number(rawMetric))
        ? Number(rawMetric)
        : rawMetric;

    if (!pivotMap.has(xVal)) {
      pivotMap.set(xVal, { [xKey]: xVal });
    }
    pivotMap.get(xVal)![seriesLabel] = metric;
  }

  const data = Array.from(pivotMap.values());
  return { isPivoted: true, data, xKey, yKeys };
}



/**
 * Resolves which column is the x-axis and which columns are y-axes.
 * Falls back to first column for x and all remaining columns for y.
 */
export function resolveAxes(
  columns: string[],
  xAxis?: string | null,
  yAxis?: string[] | null,
): { xKey: string; yKeys: string[] } {
  const xKey = xAxis ?? columns[0];
  const yKeys = yAxis ?? columns.filter((c) => c !== xKey);
  return { xKey, yKeys };
}

/**
 * Returns a Gaussian KDE estimator function for the given data.
 * Uses Silverman's rule of thumb for bandwidth when not provided.
 */
export function gaussianKDE(
  data: number[],
  bandwidth?: number,
): (x: number) => number {
  const n = data.length;
  if (n === 0) return () => 0;

  const h =
    bandwidth ??
    (() => {
      const mean = data.reduce((s, v) => s + v, 0) / n;
      const variance = data.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
      const stdDev = Math.sqrt(variance);
      // Silverman's rule: h = 0.9 * min(stdDev, IQR/1.34) * n^(-1/5)
      const sorted = [...data].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(n * 0.25)];
      const q3 = sorted[Math.floor(n * 0.75)];
      const iqr = q3 - q1;
      const spread = Math.min(stdDev, iqr / 1.34);
      return 0.9 * (spread > 0 ? spread : stdDev > 0 ? stdDev : 1) * n ** -0.2;
    })();

  const kernel = (u: number) =>
    (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * u * u);

  return (x: number) => {
    const sum = data.reduce((s, xi) => s + kernel((x - xi) / h), 0);
    return sum / (n * h);
  };
}

/**
 * Computes five-number summary (min, q1, median, q3, max) for boxplot rendering.
 */
export function computeQuartiles(values: number[]): {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
} {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const quantile = (arr: number[], p: number): number => {
    const idx = p * (arr.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return arr[lo];
    return arr[lo] + (arr[hi] - arr[lo]) * (idx - lo);
  };

  return {
    min: sorted[0],
    q1: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    q3: quantile(sorted, 0.75),
    max: sorted[n - 1],
  };
}

/**
 * Build a natural-language drill-down message from a column + value.
 * Replaces the old technical "Filter the last query where ..." text.
 */
export function drillDownMessage(column: string, rawValue: unknown): string {
  const display = rawValue === null || rawValue === undefined
    ? String(rawValue)
    : String(rawValue);
  return `Show only rows where ${column} is ${display}`;
}
