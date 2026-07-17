# Skill: BigQuery Data Management (Cleanup)

## 1. Trigger conditions

Activate when the user's intent involves **modifying or removing** data,
schema, or objects rather than just reading them. Signals:

- "delete", "remove", "clear out", "drop", "get rid of"
- "update", "fix", "correct", "change all the..."
- "merge", "upsert", "dedupe" — **note**: "remove duplicates" is its own
  operation subtype (`DEDUPE`) with a different preview shape than other
  `DELETE`s — see step 4
- "set this table to expire", "auto-clean old data"
- "undo that", "restore the table I deleted"
- Schema changes: "add a column", "rename", "change the type of"

This skill is the one most likely to cause irreversible harm if it
hallucinates a target or skips confirmation — treat every trigger as
**plan first, confirm, then execute**.

---

## 2. Auth & setup

- OAuth scope: `bigquery` (read/write) for DML/DDL;
  `bigquery.readonly` is NOT sufficient for anything in this skill
- Dataset/table-level admin operations (expiration, undelete) may need
  broader `bigquery.admin` depending on IAM setup — surface a clear error
  if a call fails on permissions rather than retrying

---

## 3. Core API calls

| Purpose | Call | Notes |
|---|---|---|
| Row-level changes | `jobs.query` / `jobs.insert` with `DELETE`, `UPDATE`, `MERGE`, `INSERT` | Standard DML via SQL |
| Full clear | `TRUNCATE TABLE` via query | Faster than `DELETE` with no `WHERE`, but still subject to time travel |
| Schema changes | `ALTER TABLE ... ADD/DROP/RENAME COLUMN`, `CREATE/DROP TABLE/VIEW/SCHEMA` via query | DDL goes through the same query path as DML |
| Set table expiration | `tables.patch` (`expirationTime`) or `ALTER TABLE ... SET OPTIONS (expiration_timestamp=...)` | Automated cleanup — no manual delete needed |
| Set dataset default expiration | `datasets.patch` (`defaultTableExpirationMs`) | New tables in dataset inherit this |
| Query historical state | `SELECT ... FOR SYSTEM_TIME AS OF <timestamp>` | Time-travel window is configurable, 2–7 days, default 7 |
| Restore deleted dataset | `datasets.undelete` | Only within the time-travel window |
| Point-in-time copy | `CREATE SNAPSHOT TABLE ... CLONE` / `CREATE TABLE ... CLONE` | Cheap copy-on-write backup before a risky operation |

---

## 4. Workflow steps

1. **Classify the operation**: row-level (DML), schema-level (DDL),
   expiration/lifecycle config, or restore/undo
2. **Resolve the target** against cached schema (table/column names must
   exist — never guess)
3. **Build the statement**, then **always dry run** (`dryRun: true`) to get
   `totalBytesProcessed` and confirm the statement parses — feed this
   through the cost tiers in `bigquery-shared-harness-policies.md` §A
4. **Preview impact** before executing anything destructive:
   - For `DELETE`/`UPDATE`/`MERGE` with a `WHERE` clause: run a
     `SELECT COUNT(*)` with the same `WHERE` clause to show how many rows
     will be affected
   - For **`DEDUPE`** ("remove duplicates"): this isn't a `WHERE`-clause
     delete — preview, confirmation, and execution all need a different
     shape:
     - **Key columns**: from Schema's `tableConstraints.primaryKey` if
       present; otherwise ask the user which column(s) define a duplicate
     - **Preview query**: count affected groups and rows, not just rows —
       `SELECT COUNT(*) AS group_count, SUM(cnt - 1) AS rows_to_remove FROM
       (SELECT <key_cols>, COUNT(*) AS cnt FROM t GROUP BY <key_cols>) WHERE
       cnt > 1`
     - **Tiebreaker** (which row in each group survives): check Schema's
       `columns` for a timestamp-like field (`updated_at`, `created_at`,
       `_ingested_at`, or any `TIMESTAMP`/`DATETIME` type). If found,
       default to "keep most recent by `<column>`" and **state this choice
       explicitly** in the confirmation — don't apply it silently. If no
       such column exists, ask the user which row should survive rather
       than picking an arbitrary one
     - **Execution**: **operate on the exact rows identified in the
       preview**, not a re-evaluation of the duplicate condition. Capture
       each to-be-removed row's primary key + tiebreaker value during the
       preview query, then `DELETE` matching those specific values —
       rather than re-running `ROW_NUMBER() OVER (PARTITION BY <key_cols>
       ORDER BY <tiebreaker> DESC)` at execution time and removing whatever
       it finds *then*. This means execution can remove at most what was
       previewed (never more), and any shortfall only happens if one of
       those specific rows changed in the interim — see §6's note on
       `affectedRows`
   - For `DROP TABLE`/`TRUNCATE`: surface the table's current row count and
     size from `tables.get`
5. **Confirm with the user** — if either the destructive-operation gate
   (§5 below) or the cost gate (`COST_CONFIRM`, shared policy §A) applies,
   show **one combined confirmation card** with both the preview (rows/size)
   and the cost estimate, and a single confirm action — never stack two
   separate prompts for the same operation
6. **Execute** via `jobs.query`/`jobs.insert`
7. **Normalize the result** and report what actually happened
8. **Signal Schema cache invalidation** if the operation changed schema or
   table identity (see §7) — Schema's cache otherwise has no way to know
9. **Offer undo/follow-up** based on time-travel availability

---

## 5. Destructive vs. safe operations

| Category | Operations | Confirmation required? |
|---|---|---|
| **Safe / additive** | `INSERT`, `CREATE TABLE/VIEW` (new objects), set expiration on unused tables | No — but still show what was created |
| **Reversible (time travel)** | `DELETE`, `UPDATE`, `MERGE`, `TRUNCATE`, `DROP TABLE`, column drops on tables, `DEDUPE`* | **Yes** — show preview + explicit confirm, mention it's recoverable via time travel for N days |
| **Hard to reverse** | `DROP DATASET` (if outside undelete window), `DROP SCHEMA CASCADE`, expiration set to "now" | **Yes, with extra emphasis** — restate exactly what's being removed and that recovery may not be possible |

\* `DEDUPE` additionally requires confirming the tiebreaker (which row
survives) — see step 4. The confirmation card must show this even when the
row-count preview alone wouldn't normally need extra explanation.

Never chain a destructive operation directly off a single ambiguous user
message ("clean up the old stuff") — resolve to a specific statement and
preview first, even if that takes an extra turn.

---

## 6. Normalized result shape

```json
{
  "operationType": "DML | DDL | DEDUPE | EXPIRATION | RESTORE | SNAPSHOT",
  "sql": "DELETE FROM ... WHERE ...",
  "preview": {
    "estimatedRows": 482,
    "totalBytesProcessed": 1048576,
    "dedupe": {
      "groupCount": 12,
      "extraRowCount": 18,
      "tiebreaker": {
        "column": "updated_at",
        "direction": "DESC",
        "source": "INFERRED | USER_SPECIFIED"
      }
    }
  },
  "confirmed": true,
  "result": {
    "status": "SUCCESS | ERROR",
    "affectedRows": 482,
    "jobId": "job_abc123",
    "error": null
  },
  "undo": {
    "available": true,
    "method": "FOR SYSTEM_TIME AS OF",
    "expiresAt": "2026-06-21T00:00:00Z"
  },
  "schemaInvalidation": {
    "required": true,
    "scope": "project.dataset.table",
    "reason": "ALTER TABLE ADD COLUMN"
  }
}
```

`schemaInvalidation` is `null`/omitted for pure DML that doesn't change
structure (e.g. a `DELETE` that removes rows but not columns) — see §7 for
what counts as invalidating. `preview.dedupe` is present only for
`DEDUPE` operations.

For `DEDUPE`, `result.affectedRows` should equal
`preview.dedupe.extraRowCount` in the normal case. If it's lower, one or
more of the specific previewed rows no longer matched by execution time
(per the snapshot-based execution in §4) — see the Response Composition
doc for how to phrase this.

---

## 7. Schema cache invalidation

The Schema skill caches structural metadata (columns, types, partitioning,
clustering — see Schema §7) keyed by `project.dataset.table`. Data
Management is the primary source of staleness, so it owns telling Schema
when that cache is wrong.

**Operations that require invalidation** (set `schemaInvalidation.required
= true`):

- Any `ALTER TABLE` (add/drop/rename column, type change, clustering change)
- `CREATE TABLE`/`CREATE TABLE ... AS SELECT` (new entry, not yet cached —
  Schema should fetch fresh on next reference rather than serve a miss as
  "doesn't exist")
- `DROP TABLE`/`DROP VIEW`/`DROP SCHEMA` (remove from cache entirely)
- `CREATE/DROP VIEW`, `CREATE/DROP MATERIALIZED VIEW`
- Re-partitioning/re-clustering via CTAS-and-swap (the "table" at that
  identifier now has different structure even though the name is unchanged)
- `datasets.undelete` (restored object's schema may differ from what was
  cached before deletion)

**Operations that do NOT require invalidation:**

- `INSERT`/`UPDATE`/`DELETE`/`MERGE`/`TRUNCATE` — row-level changes don't
  affect `columns`, `partitioning`, etc. (Schema's *unc­ached* fields like
  `rowCount`/`lastModifiedTime` are naturally fresh on next fetch regardless)
- Setting table/dataset expiration — doesn't change structure

**Mechanism**: this is an in-process signal, not a separate API call — when
Data Management's result includes `schemaInvalidation.required: true`, the
harness should evict that key from Schema's cache (or mark it stale) before
the next turn, so a subsequent "show me the schema" or another skill's
lookup gets a live fetch rather than stale structure.

---

## 8. UI mapping heuristics

| Stage / result shape | Component |
|---|---|
| Before destructive op | Confirmation card: statement, preview count/size, explicit confirm/cancel actions |
| Before `DEDUPE` | Confirmation card: group count, total rows to remove, **and the tiebreaker** ("keeping the most recent row by `updated_at`" — or, if no timestamp column exists, a prompt asking which row to keep before showing this card) |
| DDL schema change | Before/after schema diff (columns added/removed/changed) |
| Successful DML | Result summary card: rows affected, bytes processed, duration |
| Error | Error card showing the failed statement + message, offer "adjust and retry" |
| Expiration set | Confirmation card showing the new expiry date/time |
| Restore | Success card linking to the restored table |

---

## 9. Follow-up / exploration hooks

Hand-offs below use the shared envelope (`bigquery-shared-harness-policies.md`
§B) — e.g. "make this recurring" carries the executed statement and target
table so Data Loading can seed a scheduled query without re-asking what to
run.

- **"Undo that"** — if within the time-travel window, offer to run
  `CREATE TABLE ... AS SELECT * FROM table FOR SYSTEM_TIME AS OF <pre-op
  timestamp>` to restore prior state, or `datasets.undelete` if the whole
  dataset was dropped
- **"Show me what changed"** — diff row counts or schema before/after
- **"Make this recurring"** — hand off to the Data Loading skill / BigQuery
  Data Transfer API for a scheduled cleanup query
- **"Snapshot before I do this"** — offer `CREATE SNAPSHOT TABLE` as a
  pre-op safety step for high-risk operations
