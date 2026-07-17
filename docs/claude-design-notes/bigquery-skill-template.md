# Skill: BigQuery Data

## 1. Trigger conditions

Activate this skill when the user's intent involves querying, aggregating,
comparing, or exploring tabular data that lives in BigQuery. Signals:

- Questions about counts, trends, totals, averages, top/bottom N, comparisons
- References to known dataset/table names or business entities mapped to tables
- Follow-ups like "break that down by X", "what about last quarter",
  "show me the raw rows"

If the user's request doesn't map to any known dataset/table after schema
lookup, fall back to asking a clarifying question rather than guessing a
table name.

---

## 2. Auth & setup

- OAuth scope: `https://www.googleapis.com/auth/bigquery.readonly`
  (use `bigquery` only if the app needs to write results to a table)
- Project ID: resolve from user config, don't hardcode
- All calls go through `https://bigquery.googleapis.com/bigquery/v2/...`

---

## 3. Core API calls

| Purpose | Endpoint | Notes |
|---|---|---|
| Schema discovery | `GET /projects/{p}/datasets` then `GET /projects/{p}/datasets/{d}/tables` | Cache this — don't re-fetch every turn |
| Table detail | `GET /projects/{p}/datasets/{d}/tables/{t}` | Returns schema, row count, size |
| Cost estimate | `POST /projects/{p}/queries` with `dryRun: true` | Returns `totalBytesProcessed` without running |
| Run query | `POST /projects/{p}/queries` | Sync-ish, set `timeoutMs`; use for interactive queries |
| Long query | `POST /projects/{p}/jobs` then poll `GET /projects/{p}/queries/{jobId}` | Use if dry run estimates >~30s runtime |
| Paginate results | `GET /projects/{p}/queries/{jobId}?pageToken=...` | Use `maxResults` to keep payloads small |

Alternative for schema/metadata: query `INFORMATION_SCHEMA.TABLES` and
`INFORMATION_SCHEMA.COLUMNS` directly via SQL — often simpler than the
metadata endpoints if you're already in query mode.

---

## 4. Workflow steps

1. **Resolve schema context** — pull cached schema for relevant
   dataset(s)/table(s); only re-fetch if stale or table not found
2. **Generate SQL** from intent + schema (column names, types, partitioning)
3. **Dry run** — check `totalBytesProcessed`; if above your cost threshold,
   surface a confirmation step before running
4. **Execute** — sync for small/fast queries, async job + poll for larger ones
5. **Normalize** results into the common shape (below)
6. **Map to UI** using the heuristics (below)
7. **Generate follow-ups** based on result shape and remaining schema columns

---

## 5. Normalized result shape

```json
{
  "sql": "SELECT ...",
  "schema": [
    { "name": "event_date", "type": "DATE" },
    { "name": "category", "type": "STRING" },
    { "name": "total", "type": "INTEGER" }
  ],
  "rows": [
    { "event_date": "2026-05-01", "category": "A", "total": 142 }
  ],
  "rowCount": 1,
  "totalBytesProcessed": 10485760,
  "cacheHit": false,
  "jobId": "job_abc123"
}
```

Keep this shape consistent regardless of which API path produced it (sync
query vs polled job) — the renderer shouldn't need to know which path ran.

---

## 6. UI mapping heuristics

| Result shape | Component |
|---|---|
| 1 row, 1 numeric column | Stat/KPI card |
| 1 row, several numeric columns | Stat card grid |
| date/time column + 1–2 numeric columns | Line or area chart |
| 1 categorical + 1 numeric, ≤ ~20 rows | Bar chart |
| 1 categorical + 1 numeric, > ~20 rows | Sortable/filterable table |
| lat/lng columns present | Map |
| many columns, mixed types | Table with column picker |
| 0 rows | Empty state with suggestion to broaden filters |

These are starting heuristics, not hard rules — let the Composer step
override based on the actual question asked (e.g., a "trend" question with
categorical data might still want a table if the user asked to "see the
rows").

---

## 7. Error & cost handling

- **Query error**: show the failed SQL (collapsed) + error message; offer a
  "try a different approach" follow-up rather than silently retrying
- **Cost guardrail**: follow the tiers in
  `bigquery-shared-harness-policies.md` §A — `dryRun` first, `COST_NOTICE`
  below 100 GB, `COST_CONFIRM` (pause for explicit go-ahead) at 100 GB+
- **Schema not found**: don't fabricate table/column names — ask the user or
  list available tables

---

## 8. Follow-up / exploration hooks

Generate these from the schema columns *not* used in the current query, plus
the query's structure. Each suggestion is a handoff per the shared envelope
(`bigquery-shared-harness-policies.md` §B) carrying the table ref and
current filters, so accepting it doesn't require re-stating context:

- "Break this down by [unused dimension column]"
- "Compare to [previous period]" (if a date column was used)
- "Show me the underlying rows"
- "Filter to [top category from results]"
- "Export this view" / "Save as a saved query"

Each hook should map directly back to step 2 (SQL generation) with the
addition as context — keeping the loop closed.
