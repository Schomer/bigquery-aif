# Skill: BigQuery Discovery

## 1. Trigger conditions

Activate when the user's intent is **"help me find/understand/relate
things"** across a wider scope than a single known table — this is Schema's
companion for when the user doesn't already know exactly what they're
looking for, or wants to understand relationships *between* objects rather
than the structure of one object.

- **Search**: "is there a table with customer emails in it", "find columns
  named `*_id`", "what tables reference `orders`"
- **Comparison**: "compare `orders_v1` and `orders_v2`", "what changed
  between these two tables", "which columns are different"
- **Lineage**: "where does this table's data come from", "what depends on
  this table", "show me how this was built", "what would break if I
  changed this column"

If the user already knows the table and wants its structure, that's
**Schema** (§3), not this skill — Discovery is for when the table itself is
part of the question.

---

## 2. Auth & setup

| Capability | Scope/role needed |
|---|---|
| In-project search via INFORMATION_SCHEMA | `bigquery.readonly` |
| Cross-project/org search via Knowledge Catalog | `roles/dataplex.catalogViewer` |
| Lineage graphs | `roles/datalineage.viewer` + `bigquery.tables.get`/`bigquery.jobs.get` on the relevant projects |

Lineage and cross-project search require APIs/roles beyond plain BigQuery
access — if these calls fail on permissions, fall back to in-project
INFORMATION_SCHEMA search rather than erroring out entirely.

---

## 3. Core API calls

| Purpose | Call | Notes |
|---|---|---|
| In-project table/column search | `INFORMATION_SCHEMA.TABLES`/`.COLUMNS` with `WHERE table_name LIKE ...` / `column_name LIKE ...` across all datasets | Fast, no extra API — good default for "search for X" within one project |
| Cross-project/org search | Knowledge Catalog search (Dataplex Catalog `entries.search`) | Richer metadata (descriptions, tags, owners), spans projects the user has catalog access to |
| Schema snapshots for comparison | Delegate to **Schema** skill for both tables | Don't re-fetch schema directly — use Schema's cached result (§8 of Schema skill) |
| Data-level comparison | Delegate to **Query** skill — row counts, aggregate diffs | e.g. `SELECT COUNT(*) FROM a` vs `b`, or a `FULL OUTER JOIN ... WHERE a.x IS NULL OR b.x IS NULL` for row-level diffs |
| Lineage graph | Data Lineage API — list processes/runs/links for an asset | Returns a directed graph of upstream/downstream assets and the jobs that connected them |

---

## 4. Workflow steps

1. **Classify intent**: search, comparison, or lineage
2. **Search path**:
   - Default to INFORMATION_SCHEMA search within the current project
   - If the user's phrasing implies a broader scope ("anywhere", "across
     projects") or in-project search returns nothing, try Knowledge
     Catalog search
3. **Comparison path**:
   - Call Schema for both tables' normalized shapes (§5 of Schema skill)
   - Diff `columns` (added/removed/changed name, type, mode)
   - Optionally hand off to Query for a data-level diff (row counts,
     sample of mismatched rows) if the user asks "what's actually
     different" rather than just "what's structurally different"
4. **Lineage path**:
   - Query the Data Lineage API for the target table/job
   - Build a node/edge graph (assets = nodes, jobs/processes = edges or
     edge labels)
5. **Normalize** into the common shape (§5)
6. **Map to UI** and offer follow-ups

---

## 5. Normalized result shape

```json
{
  "discoveryType": "SEARCH | COMPARISON | LINEAGE",

  "search": {
    "query": "customer_email",
    "scope": "PROJECT | ORGANIZATION",
    "results": [
      { "type": "TABLE", "ref": "proj.dataset.customers", "matchedOn": "column: customer_email" }
    ]
  },

  "comparison": {
    "left": "proj.dataset.orders_v1",
    "right": "proj.dataset.orders_v2",
    "schemaDiff": {
      "addedColumns": [{ "name": "discount_code", "type": "STRING" }],
      "removedColumns": [],
      "changedColumns": [{ "name": "total", "from": "FLOAT64", "to": "NUMERIC" }]
    },
    "dataDiff": null
  },

  "lineage": {
    "target": "proj.dataset.orders",
    "nodes": [
      { "id": "proj.dataset.raw_orders", "type": "TABLE" },
      { "id": "proj.dataset.orders", "type": "TABLE" }
    ],
    "edges": [
      { "from": "proj.dataset.raw_orders", "to": "proj.dataset.orders", "process": "scheduled query: nightly_orders_etl" }
    ]
  }
}
```

Only the relevant top-level key (`search`, `comparison`, or `lineage`) is
populated based on `discoveryType`.

---

## 6. UI mapping heuristics

| Result shape | Component |
|---|---|
| Search, few results | List of matches — type icon, location, what matched |
| Search, many results | Table, sortable/filterable by type/dataset |
| Search, no results | Empty state — offer to broaden scope (project → org) or rephrase |
| Comparison, schema diff | Side-by-side or unified diff view: added/removed/changed columns |
| Comparison, with data diff | Schema diff + a stats row (row counts) or sample of mismatched rows |
| Lineage | Workflow/lineage diagram (directed graph) — per visualization mapping §15 |

---

## 7. Follow-up / exploration hooks

Hand-offs below use the shared envelope (`bigquery-shared-harness-policies.md`
§B) — e.g. lineage's "what ran most recently" carries the job/process names
from the `edges` array so Monitoring queries the right jobs directly.

- **From search results** → "show me the schema" (Schema), "preview rows"
  (Query), "compare this with [other result]" (back into this skill)
- **From comparison** → "show me rows that differ" (Query, data-level diff
  if not already run)
- **From lineage** → "what ran most recently in this pipeline" (Monitoring
  — job history for the processes shown as edges), "did anything fail
  upstream" (Monitoring)
- **No results anywhere** → suggest the user check spelling/scope, or that
  the asset may be in a project they don't have catalog access to
