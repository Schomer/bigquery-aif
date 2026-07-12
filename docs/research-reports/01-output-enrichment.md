# Output Enrichment — Product Design Report

**BigQuery AIF · Design & Engineering Reference**
**Report 01 of the Output Enrichment Series**
*July 2026*

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Audit](#2-current-state-audit)
3. [Statistical Intelligence Layer](#3-statistical-intelligence-layer)
4. [Chart Enrichment Design](#4-chart-enrichment-design)
5. [Output Composition Designs](#5-output-composition-designs)
6. [KPI Cards and Insight Cards](#6-kpi-cards-and-insight-cards)
7. [Next-Action Chips](#7-next-action-chips)
8. [Color, Typography, and Animation](#8-color-typography-and-animation)
9. [Companion Charts](#9-companion-charts)
10. [Implementation Roadmap](#10-implementation-roadmap)

---

## 1. Executive Summary

BigQuery AIF generates richer intelligence than it exposes. The LLM self-review pass already produces editorial insights, design notes, and statistical observations — none of which reach the user. The chart renderers receive emphasis hints that go unread. The briefing floats above the artifact card, visually disconnected. The `insight` string is generated and silently discarded on every response.

This report specifies what output enrichment looks like when the pipeline is closed: statistical intelligence surfaces automatically from result data, charts carry annotation and reference-line overlays, the briefing lives inside the card, KPI results become rich stat rows with sparklines, and next-action chips are ranked by actual findings rather than SQL intent.

The changes required range from trivial (render the `insight` string that already exists) to medium effort (a new `result-insights.ts` statistical engine). None require new LLM calls, new API contracts, or schema migrations.

**Highest-leverage changes, in order:**

1. Move `BriefingBlock` inside `ArtifactCard` — eliminates visual disconnect, low effort.
2. Render `CompositionEnvelope.insight` — already generated, never shown, one-line fix.
3. Add `STAT_ROW` composition for 2–5 row results — replaces table with stat card grid.
4. Build `result-insights.ts` — statistical engine that fires client-side, zero LLM cost.
5. Upgrade `KpiCard` with delta indicator and sparkline.

---

## 2. Current State Audit

### 2.1 Output Anatomy (as-built)

Every response renders exactly four regions in this vertical order:

```
┌──────────────────────────────────────────────────────┐
│  BriefingBlock (floats ABOVE ArtifactCard)           │
│  narrative + optional findings bullets               │
└──────────────────────────────────────────────────────┘
                        ↓ gap ↓
┌──────────────────────────────────────────────────────┐
│  ArtifactCard                                        │
│  ┌────────────────────────────────────────────────┐  │
│  │ Header: Headline (15px, w500) + tone tint     │  │
│  ├────────────────────────────────────────────────┤  │
│  │ Primary artifact (chart / table / KPI card)   │  │
│  ├────────────────────────────────────────────────┤  │
│  │ Footer meta: rows · bytes · SQL toggle · BQ ↗ │  │
│  ├────────────────────────────────────────────────┤  │
│  │ Chips: up to 4 HandoffEnvelope + 1 hardwired  │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### 2.2 Broken Pipeline — Confirmed Gaps

| Field | Generated? | Rendered? | Gap |
|---|---|---|---|
| `CompositionEnvelope.insight` | Yes (self-review pass) | No | String dropped before ArtifactCard |
| `designNotes` | Yes (LLM every call) | No | Silently discarded post-generation |
| `emphasis.highlight` | Yes | No | Chart renderers never read it |
| `emphasis.deemphasize` | Yes | No | DataTable ignores it |
| `notableFindings` | Typed, always `null` | N/A | Hardcoded null in `handle-query.ts` |
| `COMPOSED_CHART` type | Defined | No | Artifact type exists, never instantiated |

### 2.3 Missing Statistical Functions

The current library provides KDE and quartiles only. The following are absent:
- Mean, standard deviation
- Linear trend (slope, R²)
- CAGR
- Pearson correlation
- Rolling z-score / anomaly detection
- HHI concentration index
- Funnel drop-off rates

### 2.4 Component Inventory

| Component | State | Issue |
|---|---|---|
| `StatCard.tsx` | Exists; props: label, value, subtitle, trend, trendValue, accent | Not connected to query results |
| `BriefingBlock.tsx` | Exists; renders narrative + findings bullets | Floats above card — visual disconnect |
| `ChartWithToggle` | Exists; Chart/Table toggle | Toggle treats data as peer, should be subordinate |
| `ArtifactCard.tsx` | Fixed chrome: header + provenance + briefing (floating) + content + chips | Briefing is outside card boundary |
| `CompositionEnvelope.insight` | Nullable string field | Never rendered |
| `CompositionEnvelope.briefing` | `{ narrative: string; findings?: FindingItem[] }` | Passed to floating BriefingBlock |

---

## 3. Statistical Intelligence Layer

### 3.1 Philosophy

Statistical insights must be:
- **Earned**: only generated when sample size is sufficient.
- **Ranked**: anomalies surface before trends, trends before supporting stats.
- **Capped**: never more than 3 insights per chart.
- **Suppressible**: each insight carries its own suppress flag and reason.

### 3.2 `StatInsight` Type

```typescript
// src/lib/result-insights.ts

type InsightType =
  | 'TREND'
  | 'OUTLIER'
  | 'CORRELATION'
  | 'CONCENTRATION'
  | 'PERIOD_CHANGE'
  | 'DISTRIBUTION'
  | 'FUNNEL_DROPOFF'
  | 'RECORD_HIGH'
  | 'RECORD_LOW'
  | 'ANOMALY';

interface StatInsight {
  type: InsightType;
  priority: 1 | 2 | 3;             // 1 = highest; anomaly > trend > supporting
  headline: string;                 // ≤ 15 words — used as chart subtitle
  narrative?: string;               // 1–3 sentences — used in briefing
  value?: number;                   // primary numeric finding
  valueLabel?: string;              // unit/format hint, e.g. "%", "$", "x"
  suppressed?: boolean;
  suppressReason?: string;
}
```

### 3.3 Formulas by Chart Type

#### Time Series / Line Charts

| Metric | Formula | Suppress if |
|---|---|---|
| Linear trend slope | `m = (n·Σxy − Σx·Σy) / (n·Σx² − (Σx)²)` | R² < 0.40 |
| R² (goodness of fit) | `R² = 1 − (SS_res / SS_tot)` | — |
| CAGR | `(endValue / startValue)^(1/n_years) − 1` | n < 3 periods |
| Period-over-period | `(lastValue − firstValue) / |firstValue| × 100` | — |
| Anomaly (rolling z-score) | 5-period rolling window; flag if `|z| > 2.0` | n < 8 |
| Volatility (CV) | `stdev(y) / mean(y)`; label "high" if CV > 0.5 | — |

#### Bar / Column Charts

| Metric | Formula | Suppress if |
|---|---|---|
| Top share | `top_value / sum(all_values) × 100` | — |
| Leader-laggard gap | `(top − bottom) / bottom × 100` | — |
| Outlier detection | Z-score per bar; flag `|z| > 1.5` as notable | n < 5 |
| Uniformity | CV < 0.15 = near-uniform; CV > 0.5 = concentrated | — |

#### Scatter Plots

| Metric | Formula | Suppress if |
|---|---|---|
| Pearson r | Standard formula | n < 10, or `|r| < 0.40` |
| Significance | `t = r · √(n−2) / √(1−r²)` | n < 30 for significance claim |
| Strength label | `|r|` < 0.3 = weak; 0.3–0.5 = moderate; 0.5–0.7 = strong; > 0.7 = very strong | — |

#### Pie / Donut

| Metric | Formula | Suppress if |
|---|---|---|
| HHI | `Σ(s_i²)` where `s_i` is decimal share | — |
| HHI label | < 0.15 = unconcentrated; 0.15–0.25 = moderate; > 0.25 = high | — |
| Dominant check | Flag any category > 50% | — |

#### Funnels

| Metric | Formula |
|---|---|
| Per-step drop-off | `(value_i − value_{i+1}) / value_i × 100` |
| Completion rate | `last_step / first_step × 100` |
| Biggest leverage step | Step with highest drop-off percentage |

### 3.4 Global Suppression Rules

```
Minimum n thresholds by claim type:
  - Any statistic     → n ≥ 5
  - Z-score / anomaly → n ≥ 8
  - Correlation       → n ≥ 10
  - Significance test → n ≥ 30

Cap: 3 insights per chart
Rank order: ANOMALY (p1) > TREND (p2) > supporting stats (p3)
```

### 3.5 Module Design: `result-insights.ts`

```typescript
// src/lib/result-insights.ts

export function computeInsights(
  chartType: ChartType,
  data: Record<string, unknown>[],
  xKey: string,
  yKey: string,
): StatInsight[] {
  const insights: StatInsight[] = [];

  switch (chartType) {
    case 'LINE_CHART':
      insights.push(...computeTimeSeriesInsights(data, xKey, yKey));
      break;
    case 'BAR_CHART':
    case 'COLUMN_CHART':
      insights.push(...computeBarInsights(data, xKey, yKey));
      break;
    case 'SCATTER_CHART':
      insights.push(...computeScatterInsights(data, xKey, yKey));
      break;
    case 'PIE_CHART':
    case 'DONUT_CHART':
      insights.push(...computeConcentrationInsights(data, xKey, yKey));
      break;
    case 'FUNNEL_CHART':
      insights.push(...computeFunnelInsights(data, xKey, yKey));
      break;
  }

  // Sort by priority, filter suppressed, cap at 3
  return insights
    .filter(i => !i.suppressed)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);
}
```

Each sub-function (`computeTimeSeriesInsights`, etc.) returns `StatInsight[]` with `suppressed: true` entries for cases that fail thresholds — keeping the audit trail intact while excluding them from display.

---

## 4. Chart Enrichment Design

### 4.1 Reference Lines

Reference lines communicate baseline context without narration. Recharts supports `<ReferenceLine>` natively — no third-party dependency needed.

| Line type | Style | Color | Label |
|---|---|---|---|
| Average | Dashed, 1px | `#9E9E9E` (Gray) | `"Avg: $2.1M"` at right end |
| Target / Goal | Dashed, 1.5px | `#F59E0B` (Amber) | `"Target: $2.5M"` at right end |
| Prior period | Solid, 0.75px | `#D1D5DB` (Light gray) | `"Q3 2025"` at right end |

**Rules:**
- Always label with both the value AND the name (never value-only or name-only).
- Never show more than 2 reference lines simultaneously.
- Average line is the default when a trend insight fires.
- Target line requires explicit `target` metadata from the query result or schema annotation.

### 4.2 Annotations

Inspired by NYT/FT editorial chart discipline.

**Chart title = the editorial conclusion, not the data description.**

| Bad title | Good title |
|---|---|
| "Revenue by Region Q4" | "Southwest leads at $2.3M, 34% above average" |
| "Monthly Active Users" | "User growth reversed in August after feature removal" |
| "Sales Funnel Conversion" | "Checkout step loses 61% of visitors — highest friction point" |

**Annotation rules:**
- Cap at 3–4 annotations per chart.
- Anchor annotation above or beside the data point.
- Use thin `1px solid #CBD5E1` connector lines — never arrows.
- Text: 13px, weight 600, max 8 words.
- Only annotate at statistically notable points (anomaly, record high/low, trend inflection).

### 4.3 Statistical Overlays

#### Moving Averages
- Raw line: `opacity: 0.35`, `strokeWidth: 1.5`, series color
- 7-day MA: `opacity: 1.0`, `strokeWidth: 2.5`, series color (opaque)
- 30-day MA: `opacity: 1.0`, `strokeWidth: 2.5`, darker variant of series color
- Label at right endpoint: `"7-day avg"`, `"30-day avg"`

#### Confidence Intervals
- Fill between upper/lower bounds
- `opacity: 0.12` (10–15% range)
- Label explicitly: `"95% CI"` in legend
- Never show without the explicit label

#### Trend Lines
- `strokeDasharray: "4 2"`, `strokeWidth: 1.5`
- Color: same series color at 70% opacity
- Right-end label: `"Upward trend, +2.3%/mo"` or `"Declining −1.1%/mo"`

### 4.4 Outlier Markers

Outliers must be visually declared by their position relative to a reference band, not only by color.

| Signal | Spec |
|---|---|
| Color | Reserved amber `#F59E0B` (used nowhere else in chart palette) |
| Size | 30–50% larger than normal data points |
| Shape | Triangle or diamond (scatter); distinct dot with ring (line/bar) |
| Expected range band | ±2 SD shaded fill, `opacity: 0.08`, `#94A3B8` |
| Direct label threshold | `|z| > 3.0` — show value label directly on marker |
| Tooltip | Always include z-score: `"3.4 std dev above mean"` |

---

## 5. Output Composition Designs

Four compositions cover the full range of BigQuery result shapes. The composition is selected by the orchestrator based on row count, column types, and the primary artifact type selected.

### Composition A — KPI with Context
*For single-metric results (1 row, 1–3 columns)*

```
┌─────────────────────────────────────────────────────┐
│  [Headline — editorial sentence]              [⋮]   │
│  [Briefing: 2-sentence narrative — inside card]     │
│─────────────────────────────────────────────────────│
│                                                     │
│    $2.3M        Total Revenue — Q1 2026             │
│    ↑ +14% vs Q1 2025  ·  vs target: +3%             │
│    ▁▂▄▆▇█▆▄▃▂  (sparkline — last 12 periods)       │
│                                                     │
│─────────────────────────────────────────────────────│
│  5 rows · 142 MB · SQL ▶                            │
│  [Break down by region]  [Compare to last year]     │
└─────────────────────────────────────────────────────┘
```

**Selection criteria:** Single row result, numeric primary value.
**Briefing position:** Inside card, below headline, above metric.
**Sparkline:** Requires a secondary time-series query OR prior-period data in the result — only shown when available.
**Chips:** Drill-down and temporal shift ranked first.

---

### Composition B — Chart with Insight Brief
*For time series and categorical distributions*

```
┌─────────────────────────────────────────────────────┐
│  [Headline]                                   [⋮]   │
│  [2-sentence briefing — inside the card]            │
│─────────────────────────────────────────────────────│
│                                                     │
│  [Full-width chart — 240px tall]                    │
│   · Reference line at average or target             │
│   · Outlier markers if z-score threshold met        │
│   · Trend overlay if R² >= 0.40                     │
│                                                     │
│  [Chart ▲]  [Data ⊞]   (data toggle — subordinate)  │
│─────────────────────────────────────────────────────│
│  143 rows · 88 MB · SQL ▶                           │
│  [Drill: by region]  [Compare: last year]  [+1]     │
└─────────────────────────────────────────────────────┘
```

**Selection criteria:** LINE_CHART, BAR_CHART, or COLUMN_CHART; n ≥ 3 rows.
**Briefing position:** Inside card, between headline and chart.
**Data toggle:** Chart is primary; table is subordinate (not a peer tab).
**Enrichment:** Average reference line shown by default if `computeInsights()` fires a TREND insight.

---

### Composition C — Multi-Stat Overview
*For 2–5 row results with a category dimension and a metric*

```
┌─────────────────────────────────────────────────────┐
│  [Headline]                                   [⋮]   │
│  [Briefing: 1 sentence]                             │
│─────────────────────────────────────────────────────│
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ EMEA     │  │ US       │  │ APAC     │          │
│  │ $1.2M    │  │ $0.9M    │  │ $0.4M    │          │
│  │ ↑ 23%   │  │ → 1%    │  │ ↓ 8%    │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                     │
│  [Optional: small bar chart below stat row]         │
│─────────────────────────────────────────────────────│
│  [Show trend]  [Compare to Q4]  [Investigate APAC]  │
└─────────────────────────────────────────────────────┘
```

**Selection criteria:** 2–5 rows; result has 1 categorical column + 1–2 numeric columns.
**Artifact type:** New `STAT_ROW` composition — renders `StatCard` grid.
**Delta indicator:** Shown when a prior-period column is present in the result.
**Chips:** Chips are generated from the stat values (e.g., "Investigate APAC" when APAC has a negative delta).

---

### Composition D — Anomaly Callout
*For ATTENTION-tone results with a detected outlier*

```
┌─────────────────────────────────────────────────────┐
│ ┊ [4px amber left accent bar]                        │
│  [Headline — names the specific anomaly]      [⋮]   │
│  [Briefing: 2 sentences — names anomaly]            │
│─────────────────────────────────────────────────────│
│                                                     │
│  [Chart with callout annotation at anomaly point]   │
│  [Expected range band ±2SD shown as gray fill]      │
│                                                     │
│  ⚠ [Quality flag — promoted above footer]    [×]   │
│─────────────────────────────────────────────────────│
│  SQL ▶  ·  BigQuery ↗                               │
│  [Investigate]  [Set alert]  [Compare baseline]     │
└─────────────────────────────────────────────────────┘
```

**Selection criteria:** `tone === 'ATTENTION'` AND at least one ANOMALY `StatInsight` with priority 1.
**Left accent bar:** 4px solid `#F59E0B` (amber) — same color class as quality flags.
**Quality flag:** Promoted above the footer, not buried in it.
**Chips:** `Investigate`, `Set alert`, `Compare baseline` — ranked by anomaly salience.

---

## 6. KPI Cards and Insight Cards

### 6.1 StatCard Upgrade Path

`StatCard.tsx` already accepts `trend`, `trendValue`, and `accent` props. The upgrade adds:

1. **Delta line**: direction arrow + percentage + comparison period label, always stated explicitly.
2. **Sparkline**: 40–60px tall, 12 data points, 1.5–2px line weight, no axes, no grid.
3. **Status badge** (optional): RAG (Red/Amber/Green) with icon + text label — never color alone.

#### StatCard Anatomy

```
┌─────────────────────────────────────┐
│ LABEL TEXT                   [badge]│  ← 11px, w500, uppercase, ls 0.04em
│ $2,347,821                          │  ← 24–28px, w700 (KPI in stat row)
│ ↑ +14.2%  vs Q1 2025                │  ← 13px, w600, colored arrow
│ ▁▂▃▄▅▇▆▅▄▃▂  (sparkline)           │  ← 48px tall, 12 points
└─────────────────────────────────────┘

Width:  200–320px
Height: 140–180px
Padding: 16px
Border-radius: 10–12px
Left accent bar: 4px (positive=teal, negative=red, neutral=transparent)
```

#### Delta Arrow Colors

| Direction | Color | Token |
|---|---|---|
| Positive | `#00897b` (Teal) | `--color-positive` |
| Negative | `#c62828` (Deep Red) | `--color-negative` |
| Neutral / flat | `#9E9E9E` (Gray) | `--color-neutral` |

### 6.2 Insight Card Anatomy

Insight cards surface the top `StatInsight` from `result-insights.ts` as a standalone card adjacent to the chart. Used in Composition B when the primary insight is strong (priority 1).

```
┌──────────────────────────────┐
│ [TYPE BADGE]                 │  ← 10px, uppercase, colored background
│ Headline text here           │  ← 14–16px, w600
│ +34.2%                       │  ← 28–36px primary metric
│ ▁▂▄▆█▆▄▂  (mini sparkline)  │  ← 32px tall
│ vs Q1 2025 average           │  ← 12px, muted
│ [View breakdown →]           │  ← 12px CTA
└──────────────────────────────┘
```

**Layout:** Insight cards sit to the right of the chart on wide viewports; below the chart on narrow viewports. Max 1 insight card per composition.

---

## 7. Next-Action Chips

### 7.1 Chip Taxonomy

Five chip categories cover the full decision space after a result is shown:

| Category | Icon | Example labels |
|---|---|---|
| Drill-down | `subdirectory_arrow_right` | "Break down by region", "Show by product" |
| Temporal shift | `calendar_today` | "Compare to last month", "Show year-over-year" |
| Threshold investigation | `filter_alt` | "Show rows above $500", "Filter to top 10%" |
| Correlation exploration | `scatter_plot` | "Does this correlate with churn?", "Plot vs. spend" |
| Quality sanity | `warning_amber` | "Check data quality", "Show rows where [col] is null" |

### 7.2 Dynamic Chip Generation

Chips must be generated from result statistics, not just SQL intent. The following heuristics bind chip text to actual findings:

| Condition | Generated chip |
|---|---|
| Month N is the result maximum | `"What drove the [Month N] peak?"` |
| Column has > 20% nulls (quality flag) | `"Show rows where [col] is missing"` |
| Top category > 50% share | `"Break down [category] further"` |
| Only 1 row returned | `"Show trend for [dimension] over time"` |
| ANOMALY insight priority 1 | `"Investigate [anomaly point]"` |
| Negative delta on a category | `"Investigate [category] decline"` |
| Strong Pearson r detected | `"Does this correlate with [y-col]?"` |

### 7.3 Ranking Algorithm

```
Rank 1: Chips that address the headline finding
         (headline says "March was lowest" → "What happened in March?" goes first)
Rank 2: Chips generated from quality flags
Rank 3: Generic drill-down chips
Rank 4: Schema / lineage chips (e.g., "View table in BigQuery")
```

Cap at 4 chips total. Research suggests 2–3 drives higher adoption than 4+.

### 7.4 Visual Design

| Chip type | Background | Border | Text color |
|---|---|---|---|
| Primary (top 2) | `var(--accent-dim)` | none | `var(--accent-text)` |
| Secondary (3–4) | transparent | `1px solid var(--border)` | `var(--text-secondary)` |

```css
/* Chip base */
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  max-width: 40ch;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Icon prefix */
.chip .chip-icon {
  font-size: 12px;   /* Material Symbol, optical size 20 */
  flex-shrink: 0;
}
```

**Chip entrance animation:** 50ms stagger left-to-right (respects `prefers-reduced-motion`).

---

## 8. Color, Typography, and Animation

### 8.1 8-Color Categorical Palette

WCAG 2.1 AA compliant. Deuteranopia-safe — verified against Coblis simulator.

| Series | Hex | Name | Notes |
|---|---|---|---|
| 1 | `#1a73e8` | Google Blue | Primary series |
| 2 | `#00897b` | Teal | Secondary series |
| 3 | `#f57c00` | Amber | Tertiary |
| 4 | `#7b1fa2` | Purple | Quaternary |
| 5 | `#0097a7` | Cyan | Quinary |
| 6 | `#c62828` | Deep Red | Reserve for negative/critical only |
| 7 | `#558b2f` | Olive Green | |
| 8 | `#4e342e` | Brown | Residual / "Other" category |

**Semantic overrides** (not drawn from the palette rotation):
- Outlier markers: `#F59E0B` (Amber) — used nowhere else in chart rendering.
- Reference line (average): `#9E9E9E` (Gray).
- Reference line (target): `#F59E0B` (Amber — same as outlier; never overlap).
- Quality flag accent: `#F59E0B`.

### 8.2 Typography Scale

| Element | Size | Weight | Notes |
|---|---|---|---|
| KPI large number (full screen) | 40–48px | 700 | Full-screen KPI view only |
| KPI large number (in stat row) | 24–28px | 700 | Composition C cards |
| Insight card primary metric | 28–36px | 700 | |
| Insight card headline | 15px | 600 | |
| Chart annotation callout | 13px | 600 | Max 8 words |
| KPI delta indicator | 13px | 600 | |
| Chart axis tick labels | 11px | 400 | |
| Stat card label | 11px | 500 | Uppercase, `letter-spacing: 0.04em` |
| Meta / provenance | 11px | 400 | |
| Chip label | 12px | 500 | |
| Headline (editorial) | 15px | 500 | Current; preserved |

### 8.3 Micro-animations

All animations must respect `prefers-reduced-motion: reduce` — wrap in a media query check and fall back to immediate render.

| Element | Animation | Duration | Easing |
|---|---|---|---|
| Bar chart bars | Grow from baseline | 300ms | `ease-out` |
| Line chart path | Draw left-to-right (stroke-dashoffset) | 500ms | `ease-in-out` |
| KPI value | Count-up from 0 to final | 600ms | `ease-out` |
| Skeleton shimmer | Left-to-right shimmer gradient | 1.4s | `linear` (loop) |
| Chip entrance | 50ms stagger per chip, fade + slide up 4px | 50ms each | `ease-out` |
| Quality flag | Slide in after chart renders | 200ms delay + 200ms | `ease-out` |
| Insight card | Fade in 150ms after chart | 150ms | `ease-out` |

**Skeleton shimmer spec:**
```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--surface-dim) 25%,
    var(--surface-mid) 50%,
    var(--surface-dim) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s linear infinite;
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Skeleton dimensions must match the final layout exactly */
```

---

## 9. Companion Charts

### 9.1 When to Show

| Primary chart type | Companion type | Trigger condition |
|---|---|---|
| LINE_CHART | MoM % change bar chart | n ≥ 6 periods AND CV > 0.10 |
| BAR_CHART | % change bar vs. prior period | 2+ time periods present in result |
| HISTOGRAM | Box plot | n ≥ 20 rows |
| SCATTER | Marginal histograms | n > 30 points |

**Cap:** 1 companion per primary chart.

### 9.2 Ghost Line Overlays vs. Companion Charts

Ghost line overlays (a muted dashed prior-period line on the same chart) are more efficient than a separate companion chart in most cases:

| Approach | Use when |
|---|---|
| Ghost line overlay | Comparing 2 time periods on the same axis scale |
| Companion chart | The comparison requires a different axis (e.g., absolute vs. % change) |
| Next-action chip | When the companion insight is speculative — offer it, don't auto-show |

**Default behavior:** Do not auto-show companion charts. Offer them as next-action chips ("Compare to prior period", "Show distribution"). Only auto-show when `StatInsight.type === 'ANOMALY'` AND the companion provides direct visual confirmation.

### 9.3 `COMPOSED_CHART` Artifact Type

The type is already defined in the type system. Three changes required to activate it:

1. Add `companionArtifact` field to `CompositionEnvelope` type.
2. Generate `companionArtifact` in `composer.ts` when trigger conditions are met.
3. Render `companionArtifact` in `ArtifactCard.tsx` below the primary chart, separated by a 16px gap and a `0.08` opacity divider line.

```typescript
// Addition to CompositionEnvelope
interface CompositionEnvelope {
  // ... existing fields ...
  companionArtifact?: {
    type: 'BAR_CHART' | 'HISTOGRAM' | 'SCATTER_CHART';
    title: string;
    data: Record<string, unknown>[];
    xKey: string;
    yKey: string;
  };
}
```

---

## 10. Implementation Roadmap

Ordered by impact-to-effort ratio. All items are additive — none require breaking changes to existing API contracts or schema migrations.

| Priority | Change | Files Affected | Impact | Effort |
|---|---|---|---|---|
| 1 | Move `BriefingBlock` inside `ArtifactCard` | `ArtifactCard.tsx`, `BriefingBlock.tsx` | High | Low |
| 2 | Render `CompositionEnvelope.insight` string | `ArtifactCard.tsx` | High | Low |
| 3 | Add `STAT_ROW` composition for 2–5 row results | `types.ts`, `composer.ts`, `ArtifactCard.tsx`, new `StatRow.tsx` | High | Medium |
| 4 | Create `result-insights.ts` statistical engine | New file `src/lib/result-insights.ts` | High | Medium |
| 5 | KpiCard delta indicator + sparkline | `StatCard.tsx`, `ArtifactCard.tsx` | High | Medium |
| 6 | Chip icon prefix + two visual weight tiers | `ChipRow.tsx` (or equivalent) | Medium | Low |
| 7 | Chip ranking by headline salience | `composer.ts` | High | Medium |
| 8 | Reference line support in ChartView | `ChartView.tsx` (Recharts `<ReferenceLine>`) | Medium | Low |
| 9 | Define 8-color categorical palette in design tokens | `globals.css` or `theme.ts` | Medium | Low |
| 10 | Chart draw animations via Recharts props | `ChartView.tsx` | Low–Medium | Low |
| 11 | Wire `emphasis.highlight` to DataTable column styling | `DataTable.tsx` | Medium | Low |
| 12 | Generate `companionArtifact` for qualifying time series | `composer.ts`, `ArtifactCard.tsx`, `types.ts` | High | Medium |

### Ordering Rationale

Items 1 and 2 have zero new API surface — they are pure render wiring of data that already exists. They should ship together as one PR.

Items 3 and 4 can be developed in parallel: `result-insights.ts` has no UI dependency, and `STAT_ROW` composition has no statistical dependency.

Items 6, 8, 9, and 10 are cosmetic and can be batched as a single "visual polish" PR with no logic risk.

Item 12 (companion charts) should wait until items 1–5 are stable, as it depends on the enriched composition pipeline.

---

*End of Report — Output Enrichment v1.0*
*Next report: 02-routing-intelligence.md*
