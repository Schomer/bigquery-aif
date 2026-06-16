# Skill: BigQuery Data Quality

## 1. Trigger conditions

Activate when the user wants to know **how good/healthy/complete the data
is**, as opposed to querying the data itself (Query) or its structure
(Schema). Signals:

- "profile this table", "what does this data look like"
- "find duplicates", "are there duplicate rows"
- "check for nulls", "how complete is this", "completeness audit"
- "validate the types", "does this match what we expect"
- "check referential integrity", "are there orphaned rows"
- "is this table up to date / fresh"
- "are there any out-of-range values", "value range validation"
- "has the schema changed", "schema drift"

This skill is **read-only** — every check below is a `SELECT`. If a check
surfaces a problem the user wants fixed, that's a hand-off to Data
Management, not something this skill does itself.

---

## 2. Auth & setup

- OAuth scope: `bigquery.readonly` — same as Schema and Query, nothing
  additional
- No write access needed anywhere in this skill

---

## 3. Core mechanisms

There's no dedicated "data quality API" — every check is a generated SQL
query, run through the same `jobs.query`/`dryRun` path as the Query skill.
This skill's job is **generating the right SQL** from the schema, not
calling new endpoints.

| Check | SQL pattern | Schema dependency |
|---|---|---|
| Profile (distributions, cardinality) | `APPROX_COUNT_DISTINCT`, `APPROX_QUANTILES`, `MIN`/`MAX`/`AVG`/`STDDEV` per column | Needs column list + types from Schema to build one expression per column |
| Null analysis / completeness | `COUNTIF(col IS NULL) / COUNT(*)` per column | Same — iterate `columns` |
| Find duplicates | `SELECT <key_cols>, COUNT(*) FROM t GROUP BY <key_cols> HAVING COUNT(*) > 1` | Key column(s): use Schema's `tableConstraints.primaryKey` if present; otherwise fall back to a naming heuristic (`*_id`, `*_key`) and confirm with the user, or ask directly |
| Validate data types | Compare `INFORMATION_SCHEMA.COLUMNS` types against an expected schema (user-provided or inferred from a reference table) | Schema lookup, no row-level query needed |
| Referential integrity | `SELECT COUNT(*) FROM child LEFT JOIN parent ON child.fk = parent.pk WHERE parent.pk IS NULL` | Join key: use Schema's `tableConstraints.foreignKeys` if present to identify both the column and the referenced table/column; otherwise ask the user which columns relate the two tables |
| Data freshness | `tables.get` → `lastModifiedTime`, or `INFORMATION_SCHEMA.PARTITIONS` for per-partition freshness | Schema lookup only — cheap, no scan |
| Value range validation | `SELECT COUNT(*) FROM t WHERE col < @min OR col > @max` | Needs expected bounds — user-provided or derived from profile stats |
| Schema drift detection | Diff current `INFORMATION_SCHEMA.COLUMNS` against a prior snapshot | See §8 — needs persisted history |

---

## 4. Workflow steps

1. **Classify the check type**
2. **Get column/key info from Schema** — never hand-write column lists;
   pull from Schema's cached result so new/renamed columns are picked up
   automatically
3. **Cost guard** (see §7) — dry run before running a full profile,
   especially on large tables
4. **Generate the SQL** — for multi-column checks (profile, null analysis),
   build *one* query covering all columns rather than one query per column
   (see §7 for why)
5. **Execute**
6. **Normalize** into the common shape
7. **Map to UI**
8. **Offer follow-ups** — quality findings almost always lead somewhere
   (Data Management to fix, Monitoring to watch ongoing)

---

## 5. Normalized result shape

```json
{
  "checkType": "PROFILE | NULLS | DUPLICATES | TYPE_VALIDATION | REFERENTIAL | FRESHNESS | RANGE | DRIFT",
  "table": "proj.dataset.orders",
  "sql": "SELECT ...",
  "findings": [
    {
      "column": "customer_email",
      "metric": "null_rate",
      "value": 0.034,
      "severity": "INFO | WARNING | ISSUE"
    }
  ],
  "summary": {
    "rowsScanned": 1048576,
    "issuesFound": 2,
    "checkedAt": "2026-06-14T10:00:00Z"
  }
}
```

`findings` is the flexible part — its shape varies by `checkType` (e.g.
duplicates returns grouped key + count; drift returns added/removed/changed
columns; referential integrity returns an orphan count + sample keys), but
always carries `severity` so the UI can render consistently across check
types.

---

## 6. UI mapping heuristics

| Result shape | Component |
|---|---|
| Profile, multiple columns | Table — one row per column, with null rate, distinct count, min/max/avg as sortable columns |
| Profile, single column | Stat card + distribution chart (histogram from `APPROX_QUANTILES` buckets) |
| Null/completeness | Bar chart — null rate per column, or a single completeness % KPI for the whole table |
| Duplicates found | Table of duplicate key groups + counts; empty state ("no duplicates found") if none |
| Type validation | Diff table — expected vs. actual type, only showing mismatches |
| Referential integrity | KPI card (orphan count) + sample of orphaned keys in a table |
| Freshness | Status card — last modified time vs. an expected cadence, colored by how stale |
| Range validation | KPI card (out-of-range count) + sample rows |
| Schema drift | Diff view — added/removed/changed columns since last snapshot |

---

## 7. Cost & sampling considerations

Profiling touches every row of a table by default, which can be expensive
on large tables. The tier/gate behavior (when to just show cost vs. when
to pause for confirmation) follows the **shared cost guardrail policy** in
`bigquery-shared-harness-policies.md` — this section covers what's
*specific* to Data Quality on top of that:

- **Batch columns into one query**: instead of N queries (one per column),
  build a single query with one `SELECT` expression per column-metric pair
  — same bytes scanned, one job instead of N
- **Show the dry-run estimate before running by default**, even at lower
  tiers — profiling is often run on tables the user hasn't queried yet and
  may not have a cost intuition for, so surfacing the number (without
  necessarily *gating* on it below Tier 3) sets expectations
- **`SAMPLING_SUGGESTED`** (shared policy, Tier 2+): offer
  `TABLESAMPLE SYSTEM (10 PERCENT)` for an approximate profile at a
  fraction of the cost, with "run on full table" as an explicit opt-in
- **`APPROX_*` functions are already approximate** — if sampling is also in
  play, say so explicitly; don't let the user think they're getting an
  exact answer when both approximations are stacked

---

## 8. Schema drift: persistence requirement

Unlike every other check here, drift detection needs **history that
doesn't exist anywhere by default** — Schema's cache (and
INFORMATION_SCHEMA) only reflect *current* state.

Two options, not mutually exclusive:

1. **App-maintained snapshots**: store a copy of each table's
   `INFORMATION_SCHEMA.COLUMNS` result (with a timestamp) in a small
   metadata table the app owns. Drift detection becomes a diff between the
   latest snapshot and a new fetch. Simple, reliable, but means this skill
   has a write dependency somewhere (even if just to "its own" bookkeeping
   table) — worth deciding whether that table lives in the user's project
   or an app-managed one
2. **Data Lineage API events**: schema-changing jobs (DDL) are captured as
   lineage events automatically once the Data Lineage API is enabled (see
   Discovery §13/skill) — drift detection could query "has a schema-
   changing job run on this table since X" without maintaining its own
   table, at the cost of depending on an API that may not be enabled

Recommendation: start with option 1 for a working drift check, and treat
option 2 as a future "for free" enhancement once Discovery's lineage
integration exists and you can confirm the API is enabled.

---

## 9. Follow-up / exploration hooks

All hand-offs below use the shared handoff envelope (see
`bigquery-shared-harness-policies.md`) — e.g. "remove these" carries
`{ "table": ..., "operationHint": "DEDUPE", "filter": <the key columns and
duplicate values found> }` so Data Management doesn't have to re-derive
which rows were flagged.

- **Duplicates found** → "remove these" hands off to Data Management
  (dedup pattern, §2 of that skill)
- **Nulls found** → "fill these in" hands off to Data Management
  (`UPDATE ... COALESCE`)
- **Orphaned rows found** → "show me these rows" (Query), or "remove them"
  (Data Management)
- **Freshness issue found** → "alert me if this happens again" hands off
  to **Data Loading**, not Monitoring — this is a data condition (§C of the
  shared policies doc). Default to **Tier 0** (save the check so the user
  can re-run it on demand); only move to Tier 1 (scheduled + email) if the
  phrasing implies wanting to be told without asking
- **Drift detected** → "what changed it" hands off to Discovery (lineage
  for the table around that time window)
- **Profile complete, looks fine** → offer **Tier 0**: "want me to save
  this check so you can re-run it later?" — cheaper default than scheduling,
  and Monitoring only comes in if the user separately wants system-level
  visibility into a *scheduled job's* run history (Tier 1+)
