---
name: ui-components
description: Guide for building and modifying UI components in the BigQuery AIF app. Use when creating new views, modifying existing components, or working with the design system.
---

# UI Components

How to build and modify UI components in the BigQuery AIF app.

---

## Component registry

`ArtifactCard.tsx` is the routing layer for all composed output. It receives a `CompositionEnvelope` and dispatches to a view component based on `primaryArtifact.type`.

Current artifact type to view mapping:

| Artifact type | View component | Notes |
|---------------|----------------|-------|
| `TABLE` | `DataTable.tsx` | Generic sortable table renderer |
| `LINE_CHART`, `BAR_CHART`, `COLUMN_CHART`, `PIE_CHART`, `AREA_CHART` | `ChartView.tsx` | Chart rendering dispatcher |
| `KPI_CARD` | Inline in `ArtifactCard.tsx` | Single-value display |
| `SCHEMA` | `SchemaView.tsx` | Dataset/table listings, full table schemas (67KB -- high-risk edits) |
| `CONFIRMATION_CARD` | `ConfirmationCard.tsx` | Destructive operation confirmations |
| `DATA_QUALITY` | `DataQualityView.tsx` | Quality check results |
| `MONITORING` | `MonitoringView.tsx` | Job/resource monitoring |
| `COST_ANALYSIS` | `CostAnalysisView.tsx` | Cost breakdown visualizations |
| `ACCESS_PATTERNS` | `AccessPatternView.tsx` | Table access pattern analysis |
| `STORAGE_BREAKDOWN` | `StorageBreakdownView.tsx` | Storage treemaps |
| `FRESHNESS` | `FreshnessView.tsx` | Table freshness checks |
| `DISCOVERY` | `DiscoveryView.tsx` | Search results |
| `DATA_LOADING` | `DataLoadingView.tsx` | Export/schedule confirmations |
| `ER_DIAGRAM` | `ErDiagramView.tsx` | Entity-relationship diagrams |
| `LINEAGE` | `LineageDagView.tsx` | Data lineage DAG visualization |
| `MULTISTEP` | `MultistepView.tsx` | Multi-step workflow cards |

---

## Design system tokens

CSS custom properties defined in the global stylesheet. Use these instead of hardcoded colors:

```css
--bg:          /* page background */
--surface:     /* card/panel background */
--text:        /* primary text color */
--accent:      /* brand accent / interactive elements */
--positive:    /* success states, good-news tone */
--attention:   /* warning states, attention tone */
--issue:       /* error states, destructive actions */
--border:      /* borders and dividers */
--font-mono:   /* monospace font stack */
```

---

## Typography and icons

- **Text font**: Google Sans (`'Google Sans', sans-serif`). This is the only non-code font. Do not introduce Inter, Roboto, or other families.
- **Code font**: Google Sans Mono (`var(--font-mono)`). For code blocks, SQL, technical identifiers. Not for table data cells.
- **Icons**: Material Symbols Outlined. Monochrome only -- no multi-color or illustrated icons.
- **No emojis**: not in UI text, labels, tooltips, or any user-facing content.

---

## Shared primitives

These reusable components exist in `src/components/ui/`. Use them instead of creating new ones:

- **StatCard**: displays a labeled numeric value. Use for KPI-style metrics within views.
- **Badge**: small labeled pill for status indicators, tags, severity levels.
- **Tooltip**: hover tooltip for supplementary information.

Check `src/components/ui/` for the current inventory before creating new primitives.

---

## Chart type selection (result shape to visualization)

Chart type is determined by **data shape, not user intent**. The composer's `suggestedVisualization` from the LLM is a hint, not a mandate.

| Result shape | Visualization |
|-------------|---------------|
| 1 row, 1 numeric column | `KPI_CARD` |
| 1 date/time dim + 1+ numeric measures | `LINE_CHART` |
| 1 categorical dim + 1 numeric measure, <=20 categories | `COLUMN_CHART` (short labels) or `BAR_CHART` (long labels) |
| 1 categorical dim + 1 numeric measure, <=8 categories, parts-of-whole | `PIE_CHART` |
| 2 dims (categorical/binned) + 1 measure (matrix) | `HEATMAP` |
| 2 numeric measures + optional grouping dim | `SCATTER_PLOT` |
| Any shape, >20 rows or >3 columns | `TABLE` (default fallback) |
| Edge list: source dim, target dim, 1 measure | `SANKEY` (flow) or `NETWORK_GRAPH` (relationships) |

**When in doubt, use TABLE.** Every shape degrades gracefully to a table.

See `docs from claude/bigquery-visualization-mapping.md` for the full mapping.

---

## Performance rules

1. **Use `React.memo`** for artifact view components to prevent unnecessary re-renders when parent state changes.
2. **Lazy-load chart modules**: chart libraries are heavy. Import them dynamically so they do not block initial page load.
3. **Use `useMemo`** for expensive computations (e.g., data transformations, sorting, filtering large datasets).
4. **Cap rendered rows at 200**: if a query returns more rows, paginate or virtualize. Do not render 1000+ DOM rows.
5. **All display values must use `formatDisplayValue()`**: from `src/lib/format-value.ts`. Do not use raw `toLocaleString()` or `String()`.
6. **`formatCompactValue()`** is for space-constrained contexts: chart Y-axis ticks, compact displays (e.g., `$509.4M`).

---

## CompositionEnvelope anatomy

Every composed response follows this structure:

```typescript
{
  headline: {
    text: string,           // the takeaway, in plain language
    tone: 'NEUTRAL' | 'POSITIVE' | 'ATTENTION',
    basis: 'STATUS' | 'DEVIATION' | 'THRESHOLD' | 'COMPARISON' | 'DIRECT_ANSWER'
  },
  primaryArtifact: {
    type: string,            // artifact type key (TABLE, LINE_CHART, etc.)
    data: object,            // skill result data -- envelope wraps it, does not replace it
    emphasis: {
      highlight: string[],   // columns/rows/series worth attention
      deemphasize: string[]  // elements to quiet (still visible, not hidden)
    }
  },
  provenance: {
    visibility: 'COLLAPSED' | 'VISIBLE',
    sql: string,
    cost: { totalBytesProcessed: number, tier: number },
    jobId?: string,
    freshness?: string
  },
  nextActions: HandoffEnvelope[],  // capped at 4
  qualityFlags?: QualityFlag[]     // capped at 5, from result-quality.ts
}
```

### Key constraints

- **nextActions capped at 4**: each chip is a `HandoffEnvelope` with `targetSkill`, `label`, and `context`. Quality flag suggested actions also count toward this cap.
- **qualityFlags capped at 5**: from `analyzeResultQuality()` in `result-quality.ts`. Heuristic checks only -- no model calls.
- **provenance defaults to COLLAPSED**: exceptions are cost-notice+ tier and monitoring/discovery results where provenance is the primary content.
- **emphasis is additive, not replacement**: highlighted elements get visual distinction; de-emphasized elements get quieter styling but remain visible.
- **No emojis, no multi-color icons, monochrome only**: this applies to all rendered UI.
