// src/lib/viz-intent.ts
// Extracts explicit visualization intent from natural language messages.
// Layer 1 of the five-layer visualization decision system.

import type { ArtifactType } from './types';

// ─── Explicit chart type keyword map ─────────────────────────────────────────

const EXPLICIT_INTENT_MAP: Array<{ patterns: RegExp[]; type: ArtifactType }> = [
  // Column / vertical bar
  {
    patterns: [
      /\bcolumn chart\b/i,
      /\bvertical bar\b/i,
      /\bbar chart\b(?! horizontal| horiz)/i,
      /\bmake (?:it|this) (?:a )?bar\b/i,
      /\bshow (?:as|it as) (?:a )?(?:column|bar)\b/i,
      /\bdisplay (?:as|it as) (?:a )?(?:column|bar)\b/i,
      /\bchange (?:it |this )?to (?:a )?(?:column|bar) chart\b/i,
    ],
    type: 'COLUMN_CHART',
  },
  // Horizontal bar
  {
    patterns: [
      /\bhorizontal bar\b/i,
      /\bbar chart (?:horizontal|horiz)\b/i,
    ],
    type: 'BAR_CHART',
  },
  // Line
  {
    patterns: [
      /\bline chart\b/i,
      /\bline graph\b/i,
      /\bshow as (?:a )?line\b/i,
      /\bmake (?:it|this) (?:a )?line\b/i,
      /\bchange (?:it |this )?to (?:a )?line\b/i,
    ],
    type: 'LINE_CHART',
  },
  // Area
  {
    patterns: [
      /\barea chart\b/i,
      /\barea graph\b/i,
      /\bstacked area\b/i,
      /\bshow as (?:an? )?area\b/i,
    ],
    type: 'AREA_CHART',
  },
  // Pie
  {
    patterns: [
      /\bpie chart\b/i,
      /\bshow as (?:a )?pie\b/i,
      /\bmake (?:it|this) (?:a )?pie\b/i,
    ],
    type: 'PIE_CHART',
  },
  // Donut
  {
    patterns: [
      /\bdonut chart\b/i,
      /\bdoughnut chart\b/i,
      /\bshow as (?:a )?donut\b/i,
    ],
    type: 'DONUT_CHART',
  },
  // Scatter
  {
    patterns: [
      /\bscatter (?:plot|chart|graph)\b/i,
      /\bscatterplot\b/i,
      /\bshow as (?:a )?scatter\b/i,
      /\bplot (?:the )?correlation\b/i,
    ],
    type: 'SCATTER',
  },
  // Histogram
  {
    patterns: [
      /\bhistogram\b/i,
      /\bdistribution chart\b/i,
      /\bshow (?:as |the )?distribution\b/i,
    ],
    type: 'HISTOGRAM',
  },
  // Heatmap
  {
    patterns: [
      /\bheatmap\b/i,
      /\bheat map\b/i,
      /\bshow as (?:a )?heatmap\b/i,
    ],
    type: 'HEATMAP',
  },
  // Treemap
  {
    patterns: [
      /\btreemap\b/i,
      /\btree map\b/i,
      /\bshow as (?:a )?treemap\b/i,
    ],
    type: 'TREEMAP',
  },
  // Funnel
  {
    patterns: [
      /\bfunnel chart\b/i,
      /\bfunnel (?:diagram|view)\b/i,
      /\bshow as (?:a )?funnel\b/i,
      /\bshow (?:the )?(?:conversion|drop.?off) funnel\b/i,
    ],
    type: 'FUNNEL',
  },
  // Gauge
  {
    patterns: [
      /\bgauge chart\b/i,
      /\bgauge (?:view|diagram)\b/i,
      /\bshow as (?:a )?gauge\b/i,
    ],
    type: 'GAUGE',
  },
  // Radar / spider
  {
    patterns: [
      /\bradar chart\b/i,
      /\bspider chart\b/i,
      /\bradial chart\b/i,
      /\bshow as (?:a )?radar\b/i,
    ],
    type: 'RADAR',
  },
  // Sankey
  {
    patterns: [
      /\bsankey (?:chart|diagram)?\b/i,
      /\bflow diagram\b/i,
      /\bshow as (?:a )?sankey\b/i,
    ],
    type: 'SANKEY',
  },
  // Boxplot
  {
    patterns: [
      /\bbox (?:plot|chart)\b/i,
      /\bboxplot\b/i,
      /\bshow as (?:a )?box plot\b/i,
    ],
    type: 'BOXPLOT',
  },
  // Candlestick
  {
    patterns: [
      /\bcandlestick\b/i,
      /\bOHLC chart\b/i,
      /\bshow as (?:a )?candlestick\b/i,
    ],
    type: 'CANDLESTICK',
  },
  // Composed
  {
    patterns: [
      /\bcomposed chart\b/i,
      /\bdual.axis chart\b/i,
      /\bbar.*line (?:chart|combo)\b/i,
      /\bcombination chart\b/i,
    ],
    type: 'COMPOSED_CHART',
  },
  // USA map
  {
    patterns: [
      /\busa? map\b/i,
      /\bstate map\b/i,
      /\bby state\b/i,
      /\bmap (?:by|of) (?:states?|usa?)\b/i,
      /\bchoropleth (?:by |of )?(?:state|us|usa)\b/i,
    ],
    type: 'USA_MAP',
  },
  // World map / choropleth
  {
    patterns: [
      /\bworld map\b/i,
      /\bglobal map\b/i,
      /\bby country\b/i,
      /\bmap (?:by|of) (?:country|countries|the world|region)\b/i,
      /\bchoropleth\b/i,
      /\beach country\b/i,
      /\b(?:on|as|in)\s+a\s+map\b/i,
      /\bmap\s+(?:this|it|them|the|that)\b/i,
      /\bshow\s+(?:me\s+)?(?:a\s+)?map\b/i,
      /\bgeographic(?:al(?:ly)?)?\b/i,
      /\bdisplay\s+(?:on\s+)?(?:a\s+)?map\b/i,
      /\bput\s+(?:this\s+|that\s+|it\s+)?on\s+(?:a\s+)?map\b/i,
    ],
    type: 'WORLD_MAP',
  },
  // Table (explicit)
  {
    patterns: [
      /\bshow as (?:a )?table\b/i,
      /\bdisplay as (?:a )?table\b/i,
      /\btabular (?:view|format)\b/i,
      /\bswitch to table\b/i,
      /\bno chart\b/i,
    ],
    type: 'TABLE',
  },
];

// ─── Semantic intent phrases ──────────────────────────────────────────────────
// These trigger when the user's phrasing strongly implies a chart type
// without explicitly naming it.

const SEMANTIC_INTENT_MAP: Array<{ patterns: RegExp[]; type: ArtifactType }> = [
  {
    patterns: [
      /\btrend (?:over time|by (?:month|week|year|day|quarter))\b/i,
      /\bover time\b/i,
      /\bmonth(?:ly)? trend\b/i,
    ],
    type: 'LINE_CHART',
  },
  {
    patterns: [
      /\bdistribution of\b/i,
      /\bfrequency (?:of|distribution)\b/i,
    ],
    type: 'HISTOGRAM',
  },
  {
    patterns: [
      /\bconversion (?:funnel|stages?|steps?)\b/i,
      /\bdrop.?off (?:by|per) stage\b/i,
    ],
    type: 'FUNNEL',
  },
  {
    patterns: [
      /\bcorrelation (?:between|of)\b/i,
      /\brelationship between\b/i,
    ],
    type: 'SCATTER',
  },
  {
    patterns: [
      /\brunning (?:total|sum)\b/i,
      /\bcumulative\b/i,
    ],
    type: 'AREA_CHART',
  },
];

// ─── Viz mutation detection ───────────────────────────────────────────────────
// Phrases that indicate "change the chart type of the existing result"
// without requesting new data.

const VIZ_MUTATION_PHRASES = [
  /\bmake (?:it|this) (?:a )/i,
  /\bshow (?:it |this )?as (?:a )?/i,
  /\bdisplay (?:it |this )?as (?:a )?/i,
  /\bchange (?:it |this )?to (?:a )?/i,
  /\bswitch (?:it |this )?to (?:a )?/i,
  /\bconvert (?:it |this )?to (?:a )?/i,
  /\bturn (?:it|this) into (?:a )?/i,
  /\buse (?:a )?.*chart\b/i,
];

// Keywords that indicate a NEW data question (not just a chart switch)
const NEW_DATA_SIGNALS = [
  /\bhow many\b/i,
  /\bwhat (?:is|are|were|was)\b/i,
  /\bshow me\b(?! (?:as|it|this))/i,
  /\blist (?:all|the)\b/i,
  /\bfind (?:all|the)\b/i,
  /\bget (?:all|the)\b/i,
  /\bcount (?:of|the)\b/i,
  /\bsum (?:of|the)\b/i,
  /\baverage\b/i,
  /\btotal\b/i,
  /\btop \d+\b/i,
  /\bby (?:month|week|day|year|quarter)\b/i,
  /\bover (?:the )?(?:last|past)\b/i,
  /\bwhere\b/i,
  /\bfilter\b/i,
  /\bgroup (?:by)\b/i,
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extracts an explicit visualization intent from a user message.
 * Returns the ArtifactType if one is found, or null if none.
 */
export function extractVisualizationIntent(message: string): ArtifactType | null {
  // Check explicit chart type names first (higher confidence)
  for (const { patterns, type } of EXPLICIT_INTENT_MAP) {
    if (patterns.some((p) => p.test(message))) {
      return type;
    }
  }

  // Check semantic intent phrases (lower confidence, don't fire on data questions)
  // Only trigger semantic intents when there's no competing data-query signal
  const hasNewDataSignal = NEW_DATA_SIGNALS.some((p) => p.test(message));
  if (!hasNewDataSignal) {
    for (const { patterns, type } of SEMANTIC_INTENT_MAP) {
      if (patterns.some((p) => p.test(message))) {
        return type;
      }
    }
  }

  return null;
}

/**
 * Returns true when the message is purely a chart-type-change request
 * with no new data question embedded -- meaning we can recompose the
 * existing result with a new chart type instead of re-querying BigQuery.
 */
export function isVizMutationOnly(message: string): boolean {
  const hasMutationPhrase = VIZ_MUTATION_PHRASES.some((p) => p.test(message));
  if (!hasMutationPhrase) return false;

  // If it also asks for new data, it's NOT a pure mutation
  const hasNewData = NEW_DATA_SIGNALS.some((p) => p.test(message));
  if (hasNewData) return false;

  // Must have a recognized chart type target
  const hasKnownTarget = EXPLICIT_INTENT_MAP.some(({ patterns }) =>
    patterns.some((p) => p.test(message))
  );
  return hasKnownTarget;
}
