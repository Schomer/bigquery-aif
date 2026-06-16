# Skill: BigQuery Schema

## 1. Trigger conditions

This skill is unusual: it's invoked **directly** by users some of the time,
but invoked **internally** by every other skill almost all of the time.
Both paths use the same mechanism.

**Direct triggers:**
- "What datasets/tables are in this project?"
- "Show me the schema of orders"
- "What columns does X have?" / "Describe this table/dataset"
- "What functions/procedures do we have?"

**Internal triggers** (no user-facing message, just a lookup):
- Query needs to resolve table/column names before generating SQL
- Data Management needs to confirm a target table/column exists before
  building DDL/DML
- Discovery needs schema snapshots to search/compare against
- Data Quality needs column lists to generate per-column profiling queries

---

## 2. Auth & setup

- OAuth scope: `bigquery.readonly` — this skill never writes
- No additional setup; this is the lowest-privilege skill in the system

---

## 3. Core API calls

| Purpose | Call | Notes |
|---|---|---|
| List datasets | `datasets.list` | Project-level inventory |
| Dataset detail | `datasets.get` | Description, default expiration, labels, access list |
| List tables | `tables.list` | Dataset-level inventory (tables, views, materialized views) |
| Table detail | `tables.get` | Full schema, partitioning, clustering, row count, size, last-modified |
| Column-level schema | `INFORMATION_SCHEMA.COLUMNS` | Flat column list with types — often faster than `tables.get` when you only need columns across many tables |
| Nested/repeated fields | `INFORMATION_SCHEMA.COLUMN_FIELD_PATHS` | Expands `RECORD`/`STRUCT` and `REPEATED` fields into dotted paths |
| Table options | `INFORMATION_SCHEMA.TABLE_OPTIONS` | Partitioning, clustering, expiration, labels as queryable rows |
| Routines (UDFs/procedures) | `routines.list`/`routines.get` or `INFORMATION_SCHEMA.ROUTINES` + `.PARAMETERS` | Signatures, language, definition body |
| Row-level security | `rowAccessPolicies.list` | Which policies exist on a table (not what they filter — just presence/definition) |
| Declared keys | `INFORMATION_SCHEMA.TABLE_CONSTRAINTS` + `.KEY_COLUMN_USAGE` (+ `.CONSTRAINT_COLUMN_USAGE` for FK targets) | Primary/foreign keys *if declared* — BigQuery doesn't enforce these, so many tables won't have any even when a real relationship exists. Treat presence as a strong signal, absence as "unknown," not "none" |

---

## 4. Workflow steps

1. **Determine scope** — project, dataset, table, or column-level request
2. **Check cache** (see §7) — if a fresh entry exists for this scope, return
   it without an API call
3. **On cache miss**, fetch via the narrowest call that satisfies the
   request:
   - Just need column names/types for many tables → `INFORMATION_SCHEMA.
     COLUMNS`
   - Need full metadata for one table (partitioning, size, row count) →
     `tables.get`
   - Need dataset-level inventory → `datasets.list` + `tables.list`
4. **Normalize** into the common shape (§5)
5. **Update cache**
6. **Return** — either directly to the user (direct trigger) or as
   structured context to the calling skill (internal trigger)

---

## 5. Normalized result shape

```json
{
  "scope": "PROJECT | DATASET | TABLE | ROUTINE",
  "project": "my-project",
  "dataset": "my_dataset",
  "table": "orders",
  "description": "...",
  "type": "TABLE | VIEW | MATERIALIZED_VIEW | EXTERNAL",
  "columns": [
    {
      "name": "order_id",
      "type": "STRING",
      "mode": "REQUIRED | NULLABLE | REPEATED",
      "description": "...",
      "fields": []
    },
    {
      "name": "line_items",
      "type": "RECORD",
      "mode": "REPEATED",
      "fields": [
        { "name": "sku", "type": "STRING", "mode": "NULLABLE" },
        { "name": "qty", "type": "INTEGER", "mode": "NULLABLE" }
      ]
    }
  ],
  "partitioning": { "field": "order_date", "type": "DAY" },
  "clustering": ["customer_id"],
  "rowCount": 1048576,
  "sizeBytes": 209715200,
  "lastModifiedTime": "2026-06-13T08:00:00Z",
  "labels": { "team": "growth" },
  "tableConstraints": {
    "primaryKey": ["order_id"],
    "foreignKeys": [
      {
        "columns": ["customer_id"],
        "referencedTable": "proj.dataset.customers",
        "referencedColumns": ["customer_id"]
      }
    ]
  },
  "rowAccessPolicies": [],
  "fetchedAt": "2026-06-14T10:00:00Z"
}
```

`fields` recurses for nested `RECORD`/`STRUCT` types — keep this shape
consistent at every depth so the Composer doesn't need special-case logic
for nested vs. flat schemas.

---

## 6. UI mapping heuristics

| Result shape | Component |
|---|---|
| Project scope (list of datasets) | Browsable list/tree, dataset name + table count + size |
| Dataset scope (list of tables) | Table list with type icon (table/view/materialized view), row count, last modified |
| Table scope, flat schema | Column table: name, type, mode, description |
| Table scope, nested schema | Expandable/collapsible tree for `RECORD`/`STRUCT` and `REPEATED` fields |
| Dataset/table summary ("describe this") | Summary card: description, size, row count, partitioning/clustering, last modified |
| Routines | List with signature (name, params, return type), expandable to show definition |

---

## 7. Caching strategy

This is the part the rest of the harness depends on — get the contract
right here and every other skill gets simpler.

- **Cache key**: `project.dataset.table` (or `project.dataset` for
  dataset-level, `project` for project-level)
- **What's cached**: schema (columns, types, nesting), partitioning,
  clustering, description, labels — things that change rarely
- **What's NOT cached / always fetched fresh**: `rowCount`, `sizeBytes`,
  `lastModifiedTime` — these change constantly and are cheap to refresh
  independently via `tables.get` without re-fetching the schema
- **Invalidation triggers**:
  - Explicit user refresh ("re-check the schema")
  - Any DDL operation from the Data Management skill on that table/dataset
    (add/drop column, rename, recreate) — Data Management should signal
    Schema to invalidate after a successful DDL job
  - TTL fallback (e.g., 1 hour) in case invalidation signals are missed
- **Cold start**: on first reference to a table in a session, always fetch
  live — don't assume an empty cache means "table doesn't exist"

---

## 8. Contract with other skills

Other skills should be able to call this skill and get back the shape in
§5 without knowing whether it came from cache or a live fetch. Specifically:

- **Query** uses `columns` to validate column references before generating
  SQL, and `partitioning`/`clustering` to write partition-aware `WHERE`
  clauses
- **Data Management** uses `columns` + `type` to confirm a target exists
  and to generate accurate `ALTER TABLE` statements (e.g., knowing the
  current type before a type-cast `ALTER COLUMN`)
- **Data Quality** iterates `columns` to generate per-column profiling
  expressions (null checks, distinct counts) without the user specifying
  every column, and uses `tableConstraints.primaryKey`/`.foreignKeys` as
  the first source for duplicate-key and referential-integrity checks —
  falling back to heuristics or asking the user only when
  `tableConstraints` is empty (which, given BigQuery doesn't enforce these,
  will be common)
- **Discovery** uses cached schema snapshots as the basis for table
  comparison and search

If a calling skill needs something this skill doesn't return (e.g., sample
data), that's a sign that work belongs in Query, not in an expanded Schema
response — keep this skill's output to *structure*, not *content*.

All hand-offs in/out of this skill (e.g., "compare this with [other
table]" below) use the shared handoff envelope — see
`bigquery-shared-harness-policies.md`.

---

## 9. Follow-up / exploration hooks

- **"Show me sample rows"** → hands off to Query (`SELECT * LIMIT N`)
- **"Profile this table"** → hands off to Data Quality, using `columns`
  from this result to scope the profiling queries
- **"What's in this dataset"** (from a table-scoped result) → re-run at
  dataset scope
- **"Who can see this table"** → surface `rowAccessPolicies` presence, and
  point toward the Governance area (§10/§11 in the catalog) for policy
  details this skill doesn't resolve itself
- **"Compare this to [other table]"** → hands off to Discovery with both
  schema snapshots already in hand
