---
name: response-composition
description: Guide for the response composition layer -- how skill results become user-facing output. Use when modifying the composer, headline generation, next-action chips, or quality flags.
---

# Response Composition

How skill results become user-facing output through the composer layer (`src/lib/composer.ts`).

See `docs from claude/bigquery-response-composition.md` for the full design spec with worked examples.

---

## 4-part response anatomy

Every response, regardless of which skill produced it, has up to four parts:

1. **Headline** -- the takeaway in plain language. What happened, or what matters about the result.
2. **Primary artifact** -- the content: a chart, table, confirmation card, status card. Selected by data shape.
3. **Provenance** -- SQL, cost, time range, freshness, cache status. Trustworthiness metadata.
4. **Next actions** -- handoff chips for follow-up operations.

---

## Notability test

A finding is headline-worthy if at least one of these is true:

1. **Deviation** -- it differs from a baseline: other peers in the same result, a prior period, or a prior run.
2. **Threshold** -- it crosses a defined line: data quality severity of WARNING/ISSUE, a COST_CONFIRM tier, an anomaly flag.
3. **Direct answer** -- it is the actual answer to the implicit question, even if not the literal data requested.
4. **Unexpected given the operation** -- 0 rows affected by an UPDATE that should have matched, an export that hit a size limit, a result that differs from a number stated earlier in the same flow.

If none apply, the headline is a **status statement** -- concise confirmation of what ran. If the absence of a finding is reassuring, frame it that way ("No duplicates found -- looks clean") rather than as a flat non-event.

### Headline anti-patterns

- **Restating the request**: "Here are the results for revenue by month" -- the user knows what they asked
- **Leading with metadata**: "Query completed in 1.2s, scanned 50MB" -- this is provenance, not a headline
- **Vague hedging**: "There might be some interesting patterns here" -- name the pattern or say nothing
- **Over-narrating success**: "I've successfully completed your request!" -- proportional tone; routine ops do not need celebration

---

## Tone mapping

| Tone | When | Visual treatment |
|------|------|------------------|
| `NEUTRAL` | Status statements, routine results | Default styling, no accent |
| `POSITIVE` | Good-news framing of an absence-of-finding | Subtle positive accent (checkmark, light tint) -- not celebratory |
| `ATTENTION` | WARNING/ISSUE severity, threshold crossed, notable deviation | Subtle warm accent -- reserve stronger/red for ISSUE-level or destructive-op contexts |

The `basis` field records why the tone was chosen: `STATUS`, `DEVIATION`, `THRESHOLD`, `COMPARISON`, or `DIRECT_ANSWER`.

---

## Emphasis rules

Emphasis marks specific elements within the primary artifact as worth attention without changing the artifact type:

- A flagged column in a profile table: pinned to the top or visually distinguished
- An anomalous point in a time series: a different marker on that one point
- The job responsible for a cost spike: highlighted row in a sortable table

**When emphasis earns its place**: when it helps locate something that is not otherwise distinguishable from its neighbors. A flagged row in an unordered table, an anomalous point among many similar ones.

**When emphasis is redundant**: when the artifact's own structure already reveals the finding. A sorted Top-N bar chart does not need its top bars colored differently -- the sort order and bar length already show the ranking.

Do not add emphasis just because something was mentioned in the headline. Add it only when the artifact would not otherwise reveal it.

---

## Provenance visibility

Default: `COLLAPSED` (one click away, never the first thing seen).

Exceptions (set to `VISIBLE`):

- Anything at cost-notice tier or above (tier 3+)
- Any COST_CONFIRM-gated operation (the estimate is part of the confirmation)
- Results explicitly about provenance: Monitoring job-status results, Discovery lineage (provenance IS the primary artifact)

---

## Next-action chips

- **Capped at 4** per envelope. More than that becomes a menu, not suggestions.
- Each chip is a `HandoffEnvelope` with:
  - `targetSkill`: the skill to dispatch to
  - `label`: user-facing button text
  - `context`: pre-filled context so accepting does not require re-stating anything
- **Ordering**: the action most related to the headline finding goes first. If the headline flagged `customer_email` nulls, "show me orders missing an email" outranks generic suggestions.
- **Quality flag actions count toward the cap**: suggested actions from `qualityFlags` are included in the 4-chip limit.
- **Confirmation contexts are special**: for destructive operations, Confirm/Cancel are the actions (rendered by ConfirmationCard), not next-action chips. Normal chips resume after the operation executes.

---

## Quality flags

- Generated by `analyzeResultQuality()` in `src/lib/result-quality.ts`
- **Capped at 5** per result
- **No model calls**: pure heuristic analysis (latency budget is zero)
- Attached to the `CompositionEnvelope` for the UI to render

Heuristic checks:
- **Null rate > 20%**: columns with >20% null/empty values are flagged
- **Categorical near-duplicates**: similar but not identical values in categorical columns
- **Zero-row results**: flagged as unexpected unless the query shape suggests it is normal
- **Single-value columns**: flagged unless the column appears in the SQL's WHERE clause (filtering on a column makes single-value expected)

---

## Chart type by data shape

Chart selection is based on result shape, not user intent:

| Data shape | Chart type |
|-----------|------------|
| 1 row, 1 numeric column | `KPI_CARD` |
| 1 date/time column + 1+ numeric columns | `LINE_CHART` |
| 1 categorical column + 1 numeric column, <=20 categories | `COLUMN_CHART` or `BAR_CHART` |
| 1 categorical column + 1 numeric column, <=8 categories, parts-of-whole | `PIE_CHART` |
| 2 categorical columns + 1 numeric (matrix) | `HEATMAP` |
| 2 numeric columns + optional grouping | `SCATTER_PLOT` |
| Fallback (>20 rows, >3 columns, ambiguous shape) | `TABLE` |

The LLM's `suggestedVisualization` is a hint. The composer makes the final decision based on actual result columns and row count.

---

## Composer function pattern

Each skill has a dedicated `compose[Skill]()` function in `src/lib/composer.ts`. The general pattern:

```typescript
function composeQuery(result: QueryResult, qualityFlags?: QualityFlag[]): CompositionEnvelope {
  // 1. Determine headline text and tone based on notability test
  // 2. Select artifact type based on data shape
  // 3. Build emphasis based on notable findings
  // 4. Format provenance (SQL, cost, jobId)
  // 5. Generate next-action HandoffEnvelopes (max 4, quality actions count)
  // 6. Attach qualityFlags (max 5)
  // 7. Return CompositionEnvelope
}
```

When modifying a compose function:
- Do not change the artifact type selection logic without checking the visualization mapping
- Do not exceed the 4-chip next-action cap
- Do not exceed the 5-flag quality cap
- Ensure `provenance.visibility` follows the rules above
- Quality flag suggested actions reduce the available chip slots
