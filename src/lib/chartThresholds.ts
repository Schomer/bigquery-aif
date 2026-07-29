// src/lib/chartThresholds.ts
// Single source of truth for all numeric thresholds used in chart selection.
// These values are referenced by inferVisualizationType(), validateHint(),
// and should be reflected in the AI prompt guidance.

export const CHART_THRESHOLDS = {
  /** Below this many points per series, a line reads as a fragment. Use columns. */
  MIN_POINTS_PER_LINE_SERIES: 5,

  /** Above this many slices, angle comparison becomes unreliable. */
  MAX_PIE_SLICES: 6,

  /** Below this many points, a scatter cannot show a pattern. */
  MIN_SCATTER_POINTS: 5,

  /** Categorical rows above this need a ranking signal to stay a chart. */
  CATEGORICAL_CHART_SOFT_LIMIT: 25,

  /**
   * Hard ceiling for bar charts regardless of sorting.
   * TODO: this is a pixel question wearing a row-count costume. The correct
   * ceiling is (availableHeight / minLegibleRowHeight). Revisit once the
   * renderer can report its container height to the composer, or once the
   * horizontal bar renderer supports virtualized scrolling.
   */
  CATEGORICAL_CHART_HARD_LIMIT: 50,

  /** Above this average label length, prefer horizontal bars. */
  MAX_LABEL_LENGTH_FOR_COLUMNS: 12,

  /** Rows above this prefer horizontal bars even with short labels. */
  MAX_ROWS_FOR_COLUMNS: 15,

  /** Minimum rows for a meaningful histogram. */
  MIN_HISTOGRAM_ROWS: 20,

  /** Scale gap between two numeric series that justifies a dual axis. */
  DUAL_AXIS_SCALE_RATIO: 10,

  /** Heatmap row bounds. */
  MIN_HEATMAP_ROWS: 9,
  MAX_HEATMAP_ROWS: 400,

  /** Treemap row bounds for parts-of-whole. */
  MIN_TREEMAP_ROWS: 5,
  MAX_TREEMAP_ROWS: 50,

  /** Scatter requires at least 2 numeric columns. */
  MIN_SCATTER_NUMERIC_COLS: 2,

  /** Scatter needs at least this many rows in the heuristic tree (Step 9). */
  MIN_SCATTER_ROWS: 10,

  /** Max rows for radar chart. */
  MAX_RADAR_ROWS: 10,

  /** Radar needs 3-8 numeric columns. */
  MIN_RADAR_NUMERIC_COLS: 3,
  MAX_RADAR_NUMERIC_COLS: 8,

  /** Funnel max rows. */
  MAX_FUNNEL_ROWS: 8,
} as const;
