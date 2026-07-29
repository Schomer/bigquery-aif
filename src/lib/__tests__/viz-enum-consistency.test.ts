// src/lib/__tests__/viz-enum-consistency.test.ts
// Phase 1: Verify that every chart type mentioned in the system prompt
// is present in the tool enum, and vice versa.

import { describe, it, expect } from 'vitest';
import { buildFlashSystemPrompt } from '../../agent/prompts/flash';
import { runQueryTool } from '../../agent/tools/run-query';

// Chart types that the system can produce (from types.ts VisualizationType)
const KNOWN_VIZ_TYPES = new Set([
  'TABLE', 'LINE_CHART', 'BAR_CHART', 'AREA_CHART', 'SCATTER', 'PIE_CHART',
  'DONUT_CHART', 'COLUMN_CHART', 'HISTOGRAM', 'SPARKLINE', 'RADAR', 'FUNNEL',
  'TREEMAP', 'SANKEY', 'COMPOSED_CHART', 'GAUGE', 'HEATMAP', 'BOXPLOT',
  'CANDLESTICK', 'VIOLIN', 'DENSITY_PLOT', 'RIDGELINE', 'NETWORK_GRAPH',
  'TILE_MAP', 'GEO_POINT_MAP', 'USA_MAP', 'WORLD_MAP', 'KPI_CARD', 'STAT_ROW',
  'INTERACTIVE_WIDGET',
]);

// Extract SCREAMING_SNAKE_CASE chart type tokens from a string
function extractChartTypes(text: string): string[] {
  const matches = text.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) ?? [];
  return [...new Set(matches)].filter(m => KNOWN_VIZ_TYPES.has(m));
}

describe('visualization enum consistency', () => {
  const promptText = buildFlashSystemPrompt({
    project: 'test',
    availableDatasets: ['test'],
  });

  // Extract chart types mentioned in the visualization_hint guidance section
  const vizSection = promptText.slice(
    promptText.indexOf('visualization_hint'),
    promptText.indexOf('result_title'),
  );
  const promptChartTypes = extractChartTypes(vizSection);

  // Extract chart types from the tool enum description
  const enumDescription =
    (runQueryTool.declaration.parameters as { properties?: Record<string, { description?: string }> })
      ?.properties?.visualization_hint?.description ?? '';
  const enumChartTypes = extractChartTypes(enumDescription);

  it('every chart type in the prompt visualization_hint section is present in the tool enum', () => {
    for (const type of promptChartTypes) {
      expect(
        enumChartTypes,
        `Prompt mentions ${type} but it is missing from the tool enum. ` +
        `Add it to the run_query visualization_hint description.`,
      ).toContain(type);
    }
  });

  it('tool enum does not contain chart types not mentioned in the prompt (warning)', () => {
    const extraInEnum = enumChartTypes.filter(t => !promptChartTypes.includes(t) && t !== 'TABLE');
    // This is a soft check -- extra enum values are not an error, but they
    // expand the AI's option space without guidance on when to use them.
    if (extraInEnum.length > 0) {
      console.warn(
        `Tool enum contains chart types not mentioned in prompt guidance: ${extraInEnum.join(', ')}. ` +
        `Consider adding guidance for these types or removing them from the enum.`,
      );
    }
  });
});
