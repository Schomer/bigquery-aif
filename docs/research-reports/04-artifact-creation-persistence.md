# Artifact Creation, Persistence & Library Experience
### Product Design Report — BigQuery AI Frontend

**Date**: 2026-07-11  
**Status**: Engineering-Ready Draft  
**Scope**: Persistence audit, non-query skill gaps, saved query library, workflows, pipelines, dashboards, join definitions, library UX

---

## 1. Executive Summary

The app already has a production-grade persistence foundation. Firestore is fully configured under a named `bigquery-aif` instance, and the Firestore schema covers conversations, saved artifacts, spaces, favorites, saved prompts, and monitoring checks. A typed `SavedArtifact` model exists with multi-step workflow support, parameterization slots, and result snapshots.

What's missing is not infrastructure — it's wiring and new surface area:

- Three high-value UI connections are dead or missing: the "Save as Workflow" function exists but has no trigger; SideNav links for Saved Queries and Query History are decorative anchors; save type detection always writes `'query'` regardless of content type.
- The `SavedDashboard` and `JoinDefinition` types need to be added to Firestore — the data model design is ready below.
- Non-query skills (data management, pipeline, discovery, governance, task) have meaningful implementation gaps — detailed per-skill in Section 4.
- The library experience exists at 1,392 lines but is under-navigated: no proper SideNav routing and no cross-type filtering surface.

The implementation roadmap at the end of this document prioritizes by impact-to-effort ratio. The top four items are all low-effort wiring fixes with high user-visible payoff.

---

## 2. Persistence Architecture Audit

### 2.1 Firestore Configuration

Firestore is **fully operational**. The named `bigquery-aif` instance is connected via Firebase JS SDK v12.14.0. All reads and writes go directly from the browser client to Firestore — no server-side persistence routes are needed or missing.

The auth boundary is strictly per-user: all collections live under `users/{uid}`, making the data model inherently private. Sharing across users requires a separate top-level collection or public document architecture (see gap item 5 in Section 3).

### 2.2 Existing Firestore Collections

All collections below are confirmed live under `users/{uid}`:

| Collection | Document Shape | Status |
|---|---|---|
| `conversations` | `{ title, createdAt, updatedAt, project, messagesJson }` | Working |
| `savedWork` | `SavedArtifact` (fully typed) | Working |
| `spaces` | `Space` (folder groupings for artifacts) | Working |
| `favorites` | `FavoriteItem` (starred envelopes) | Working |
| `prompts` | `SavedPrompt` (prompt template library) | Working |
| `checks` | `SavedCheck` (monitoring checks) | Working |
| `preferences` | `{ activeProject }` | Working |
| `favoriteProjects` | `string[]` | Working |

### 2.3 SavedArtifact Type (Current)

The `SavedArtifact` type is fully designed and implemented. It supports multi-step workflows, parameterization, and result snapshots out of the box.

```typescript
interface SavedArtifact {
  id: string;
  userId: string;
  type: 'query' | 'workflow' | 'pipeline' | 'app';
  name: string;
  description: string;
  steps: ArtifactStep[];         // ordered list of skill + SQL pairs
  parameters: ParameterDef[];    // parameterized variables
  createdAt: string;
  updatedAt: string;
  project?: string;
  dataset?: string;
  tags: string[];
  pinned: boolean;
  runCount: number;
  lastRunAt?: string;
  spaceId?: string;              // folder grouping via spaces collection
}

interface ArtifactStep {
  id: string;
  order: number;
  skill: SkillName;
  prompt: string;
  cachedSql?: string;
  visualizationType?: ArtifactType;
  parameters?: ParameterDef[];
  lastResultSnapshot?: CompositionEnvelope;
}
```

### 2.4 What's Working End-to-End

- Save button on every `ArtifactCard` (lines 159–168)
- `SaveModal` dialog: name, description, tags, type badge
- `saveArtifact()` writes to Firestore `savedWork.{id}`
- `SavedPage.tsx` (1,392 lines) — full library page renders saved artifacts
- `SavedWorkLibrary.tsx` (488 lines) — secondary library component
- `handle-saved.ts` (184 lines) — runs saved artifacts by fuzzy-matching name from chat
- `FavoritesPage.tsx` (622 lines) — stars and pinned artifacts view
- Space grouping system — folder-like organization of artifacts

---

## 3. Gaps: What's Working vs. What's Missing

### 3.1 Gap Table

| # | Gap | Severity | Root Cause |
|---|---|---|---|
| 1 | Save always assigns `type: 'query'` | High | `useSave` hook line 782 hardcoded |
| 2 | "Save conversation as workflow" has no UI trigger | High | `saveChatAsWorkflow()` exists as dead code |
| 3 | SideNav "Saved Queries" / "Query History" links are decorative | High | `<a>` tags with no `onClick` handlers |
| 4 | No `SavedDashboard` type or Firestore collection | High | Not yet designed or implemented |
| 5 | No sharing mechanism (artifacts strictly per-user) | Medium | `users/{uid}` boundary; needs top-level collection |
| 6 | No `JoinDefinition` type or collection | Medium | Not yet designed |
| 7 | No schema drift baseline storage | Medium | `SCHEMA_DRIFT` check type exists, never stores baseline |
| 8 | `sessionStorage` for `conversationId` — no cross-tab continuity | Low | Architecture choice |

### 3.2 Fix Notes for Top Gaps

**Gap 1 — Save type detection**: Infer `type` from the skill that produced the result. Mapping:

```
QUERY skill result          → 'query'
PIPELINE / SCHEDULE skill   → 'pipeline'
Multi-step chat thread      → 'workflow'
Monitoring / DQ views       → exclude from savedWork or use 'check' type
```

**Gap 2 — Save as Workflow button**: `saveChatAsWorkflow()` in the hook already collects conversation steps and writes to Firestore. It needs one trigger: a "Save as Workflow" button in the conversation toolbar, visible when two or more skill result cards are present in the thread.

**Gap 3 — SideNav links**: Replace `<a href="#">` anchors with `router.push('/saved')` and `router.push('/history')` calls using the existing Next.js router. Two-line fix.

---

## 4. Non-Query Skill Audit

### 4.1 Data Management (`handle-data-management.ts`, 285 lines)

**Supported operations** via Gemini + `DataManagementResponseSchema`:

| Category | Operations |
|---|---|
| Table/View Creation | CREATE TABLE (empty or CTAS), CREATE VIEW, CREATE MATERIALIZED VIEW |
| Destructive | DELETE, DROP TABLE/VIEW, TRUNCATE |
| Modification | UPDATE, ALTER TABLE (ADD/DROP/RENAME COLUMN, type change, clustering, description) |
| Data Ops | DEDUPE, FILL_NULLS, MERGE/upsert, COPY_TABLE, CLONE_TABLE, SNAPSHOT, re-partition via CTAS |

**Three execution strategies**:

| Strategy | Trigger | Behavior |
|---|---|---|
| `DIRECT_EXECUTE` | Safe ops (CREATE, COPY) | Immediate execution |
| `PREVIEW_AND_CONFIRM` | Destructive ops (DELETE, UPDATE, DROP) | Preview COUNT + cost dry-run → CONFIRMATION_CARD |
| `PREVIEW_AND_CONFIRM_DEDUPE` | DEDUPE ops | Shows keep/remove example rows → CONFIRMATION_CARD |

**Gaps**:

| Gap | Expected Behavior | Actual Behavior |
|---|---|---|
| Snapshot before operation | Skill doc says "proactively offer snapshot before destructive ops" | Never happens |
| Time-travel recovery | COMPLETION_CARD should link to `INFORMATION_SCHEMA.TABLE_SNAPSHOTS` | Not implemented |
| Undo chip | Spec calls for "Undo" chip after destructive ops | Only "Show updated table" chip generated |
| Multi-step atomicity | No transaction or rollback for multi-step operations | Not implemented |
| Bulk import | No path for loading external files into BigQuery | Not implemented |

### 4.2 Pipeline (`handle-pipeline.ts`, 605 lines)

**Supported operations** via BigQuery Data Transfer API:

`LIST_SCHEDULES` · `SCHEDULE_DETAILS` · `CREATE_PIPELINE` · `UPDATE_SCHEDULE` · `DELETE_SCHEDULE` · `RUN_HISTORY`

**Display**: `PipelineView.tsx` (10 KB) — LIST shows table of scheduled queries; RUN_HISTORY shows past runs with status.

**Gaps**:

| Gap | Notes |
|---|---|
| Location hardcoded to `'us'` | Fails for EU datasets and multi-region projects |
| No cost estimation for runs | Users cannot predict spend before scheduling |
| No DAG-style multi-step management | Single scheduled query only; no dependency chaining |
| No dbt / Dataform / Composer integration | Siloed to Data Transfer Service `scheduled_query` source type |
| No other DTS sources | No Google Ads, S3, or SaaS connector support |

### 4.3 Discovery (`handle-discovery.ts`, 413 lines)

**Sub-types**:

| Sub-type | Mechanism |
|---|---|
| `SEARCH` | Iterates datasets serially, fetches schemas, filters by query term against table/column names |
| `COMPARISON` | Fetches schemas for two named tables, diffs columns side by side |
| `LINEAGE` | Queries `INFORMATION_SCHEMA.JOBS_BY_PROJECT` 30-day window, extracts source → destination pairs |
| `ER_DIAGRAM` | Queries `INFORMATION_SCHEMA.COLUMNS + CONSTRAINT_COLUMN_USAGE + KEY_COLUMN_USAGE` |

**Display**: `DiscoveryView.tsx`, `LineageDagView.tsx` (14 KB D3 DAG), `ErDiagramView.tsx` (14 KB).

**Gaps**:

| Gap | Notes |
|---|---|
| SEARCH is serial and slow | `fetchSchema()` called sequentially per dataset; needs `Promise.all` parallelism |
| Lineage is 30-day text-match only | No column-level lineage; no Data Catalog / Dataplex integration |
| ER_DIAGRAM falls back silently | When no FK constraints exist, naming heuristic fallback is unimplemented |

### 4.4 Governance (`handle-governance.ts`, 502 lines)

**Sub-types**: `ACCESS_AUDIT` · `TABLE_SECURITY` · `SENSITIVE_DATA_SCAN` · `DATA_CLASSIFICATION`

**Gaps**:

| Gap | Notes |
|---|---|
| PII scan is heuristic-only | Regex on 1,000-row sample; no Google Cloud DLP integration |
| Read-only | No remediation actions — users cannot fix what they find |
| DATA_CLASSIFICATION checks presence, not quality | Empty description passes classification |
| `OBJECT_PRIVILEGES` behavior varies | Differs by region and BigQuery edition |

### 4.5 Task (`handle-task.ts`, 142 lines)

**Multi-step task orchestration** via `resolver.ts`. Seven pre-coded shortcuts:

`create-dataset` · `create-table-from-query` · `export-to-gcs` · `schedule-query` · `copy-table` · `delete-table` · `grant-access`

Learned plans persist to Firestore `learnedPlans` and improve on reuse. Display: `MultistepView.tsx` (15 KB) — step-by-step execution with per-step status.

This skill is the most complete of the non-query handlers. No critical gaps identified within the current implementation scope.

---

## 5. Saved Query Library Design

### 5.1 What Expert Tools Do

| Tool | Key Pattern |
|---|---|
| Mode Analytics | Searchable query library with version history, forking, and team sharing. Cards show: name, author, last run, run count, avg duration, tags |
| Redash | Flat library with filter experience. Metadata: title, description, created by, modified date, view count, data source |
| dbt | Models as a query library — `dbt docs` is the reference for professional query documentation: columns, tests, lineage per model |
| Retool Query Library | Reusable parameterized query components consumed across multiple app surfaces |

### 5.2 Saved Query Card Spec

```
┌───────────────────────────────────────────────────────────────┐
│ [Q]  Weekly Revenue Summary                           [★] [⋮] │
│      Last run: 2h ago · 847 total runs                        │
│      Tagged: finance, weekly, revenue                         │
│      Avg duration: 1m 23s · ~$0.04/run                       │
│                                                               │
│  SELECT SUM(revenue) FROM orders                              │
│  WHERE order_date >= DATE_TRUNC(CURRENT_DATE(), WEEK)         │
│                                                               │
│  [Run]  [Edit]  [Parameterize]  [Schedule]  [Share]           │
└───────────────────────────────────────────────────────────────┘
```

**Card fields**:
- Type badge (QUERY / WORKFLOW / PIPELINE / DASHBOARD)
- Name, star toggle, kebab overflow menu
- Last run timestamp + total run count
- Tags (clickable — filters the library to that tag)
- Average duration + estimated cost per run
- SQL preview (truncated, expandable inline)
- Action strip: Run, Edit, Parameterize, Schedule, Share

### 5.3 Query Versioning

Auto-save on every successful run (keep last 20 versions per artifact). Each version records:

- Version number and timestamp
- A minimal SQL diff from the previous version

```
Version history: Weekly Revenue Summary
─────────────────────────────────────────────────────────
v7  2026-07-12 08:03  Added WEEK boundary date filter
v6  2026-07-10 14:22  Changed SUM to SUM(DISTINCT ...)     [RESTORE]
v5  2026-07-09 09:11  Initial save                          [RESTORE]
```

Diff view is git-style (red removed, green added). Restore is one click with a confirmation step.

### 5.4 Query Organization

- **Tagging over folders**: tag intersection search outperforms nested folder navigation at scale
- **Surface tabs**: Most Used · Recently Viewed · Shared with Me · Recently Modified
- **Search**: semantic + keyword; filter by table or dataset referenced; filter by author
- **Starring/pinning**: starred items appear in FavoritesPage; pinned items always appear at top of the library grid

### 5.5 Query Parameterization

Parameterized queries use BigQuery's native `@param` syntax:

```sql
-- Parameters: days_back (INT64), status (STRING)
SELECT *
FROM orders
WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL @days_back DAY)
  AND status = @status
```

**Parameter input widgets**:

| Parameter Type | Input Widget |
|---|---|
| `DATE` / `TIMESTAMP` | Date range picker |
| `STRING` with bounded values | Dropdown from `SELECT DISTINCT col FROM table` |
| `STRING` open-ended | Text input with recent-value autocomplete |
| `INT64` / `FLOAT64` | Number input with min/max validation |

Parameter definitions are stored in `ArtifactStep.parameters: ParameterDef[]` (already in schema). The `SaveModal` needs a "Add parameter" section to define them at save time.

---

## 6. Workflow and Pipeline Design

### 6.1 Pipeline Step Types

| Step Type | Configuration Required |
|---|---|
| Extract | GCS URI, external table config, Cloud SQL connection |
| Transform | SQL body, dbt model reference, stored procedure call |
| Load | Destination table, write disposition (WRITE_TRUNCATE / WRITE_APPEND / WRITE_EMPTY / MERGE) |
| Schedule | Cron expression, event trigger, dependency trigger |
| Validate | Assertion SQL returning boolean, null-check SQL, row count bounds |
| Notify | Slack webhook URL, email address, Pub/Sub topic |
| Branch | Condition SQL returning boolean, on-true step ID, on-false step ID |

### 6.2 Conversational Pipeline Creation

Natural language → structured pipeline spec → user confirmation → execute.

**Example exchange**:

```
User: "Every morning at 8am, pull yesterday's orders from the raw dataset,
       join with the customers table, and load into analytics.daily_orders_enriched"

App:   I'll create a scheduled pipeline with these steps:

       Step 1: TRANSFORM (daily at 8:00 AM UTC)
         SQL: SELECT o.*, c.region, c.tier
              FROM raw.orders o
              JOIN raw.customers c ON o.customer_id = c.id
              WHERE DATE(o.created_at) = CURRENT_DATE() - 1

       Step 2: LOAD → analytics.daily_orders_enriched
         Write mode: WRITE_TRUNCATE (replace daily partition)

       Estimated cost: ~$0.12/day based on current orders volume

       [Create pipeline]  [Edit steps]  [Preview SQL]  [Cancel]
```

### 6.3 Pipeline Run Card

```
PIPELINE: daily_orders_enriched                        [SUCCEEDED]
─────────────────────────────────────────────────────────────────
Run #47 · 2026-07-12 08:03 UTC · 4m 12s total

  Step 1  TRANSFORM   ✓  2m 45s   8.2 GB scanned   ~$0.05
  Step 2  LOAD        ✓  1m 27s   142,847 rows written

Destination: analytics.daily_orders_enriched
Partition written: 2026-07-11
Next run: 2026-07-13 08:00 UTC (in 23h 57m)
─────────────────────────────────────────────────────────────────
[View data]  [View run history]  [Edit pipeline]  [Pause]
```

### 6.4 What dbt and Dagster Get Right

**dbt**: The DAG concept — staging → intermediate → mart transformation pipeline. Each step is a SQL model with documented inputs and outputs. The lineage graph shows the full dependency chain.

**Dagster**: Asset-centric rather than job-centric. Asks "is the data ready?" not "did the job run?". Schedule cards show materialization status (fresh / stale / failed), last materialized, next scheduled run.

The app's pipeline skill currently implements the scheduling side but not the asset status side. A future "data asset health" view — showing which destination tables are fresh versus stale — would bring Dagster-quality observability into the chat interface.

---

## 7. Dashboard Design

### 7.1 Proposed SavedDashboard Type

Two new types are needed in Firestore. Add as a new collection `dashboards` under `users/{uid}`:

```typescript
interface SavedDashboard {
  id: string;
  userId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  spaceId?: string;
  tiles: DashboardTile[];
  layout: 'grid' | 'freeform';
  pinned: boolean;
  tags: string[];
  globalFilters?: ParameterDef[];  // date range selectors, dimension dropdowns
  runCount: number;
  lastViewedAt?: string;
}

interface DashboardTile {
  id: string;
  artifactId: string;    // references SavedArtifact in savedWork collection
  stepIndex: number;     // which step within the artifact to render
  position: {
    col: number;
    row: number;
    width: number;       // in grid columns (12-column grid)
    height: number;      // in grid rows
  };
  title?: string;        // overrides the artifact headline
  refreshInterval?: number; // minutes between auto-refresh; 0 = manual only
}
```

### 7.2 Dashboard Composition Conversation

```
User: "Build me a sales performance dashboard"

App:   Building a Sales Performance Dashboard with 4 tiles:

       ┌─────────────────────────────────────────────────────┐
       │  [Revenue MTD]     [Orders MTD]     [Avg Order Val] │
       │─────────────────────────────────────────────────────│
       │  Revenue by Region (bar)  │  Revenue Trend (line)   │
       │─────────────────────────────────────────────────────│
       │  Top 10 Products (table)                            │
       └─────────────────────────────────────────────────────┘

       Global filter: Date range (default: This Month)

       [Save dashboard]  [Add tile]  [Change layout]  [Edit filters]
```

### 7.3 AI Dashboard Generation Principles

1. **Executive summary at top**: Lead with KPI strip (single numbers), then trends, then breakdowns
2. **Max 4–6 tiles per viewport**: More than six tiles without scrolling degrades readability
3. **Global date range filter**: Applies to all tiles simultaneously — passed as a `@date_start` / `@date_end` parameter injection
4. **Cross-filtering**: Clicking a region bar filters all other tiles to that region (shared filter state)
5. **Refresh strategy**: KPIs refresh on every page load; large tables refresh on demand only

---

## 8. Join Definition Design

### 8.1 Proposed JoinDefinition Type

Add as a new collection `joinDefinitions` under `users/{uid}`:

```typescript
interface JoinDefinition {
  id: string;
  userId: string;
  name: string;              // e.g., "Orders with Customer Details"
  description: string;
  createdAt: string;
  updatedAt: string;
  leftTable: string;         // fully-qualified BQ ref: project.dataset.table
  rightTable: string;
  joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  conditions: Array<{
    leftColumn: string;
    rightColumn: string;
    operator: '=' | '!=' | '<' | '>';
  }>;
  matchRate?: number;        // 0–1, computed at discovery time
  orphanedRowCount?: number; // rows in left table with no match
  tags: string[];
  useCount: number;          // how many queries reference this join
  lastUsedAt?: string;
}
```

### 8.2 Join Discovery Conversation

```
User: "Join the orders table with customers"

App:   Analyzing join relationship between orders and customers...

       Found likely join key:
         orders.customer_id  →  customers.id
         (99.8% match rate, 0.2% orphaned orders — 312 rows)

       Recommended join type: LEFT JOIN
       (preserves all orders even when customer record is missing)

       Preview (10 rows):
       order_id  │  customer_name  │  region   │  total_amount
       ──────────┼─────────────────┼───────────┼──────────────
       10042     │  Acme Corp      │  West      │  $4,200.00
       ...

       [Save join definition]  [Change join type]  [Add more tables]  [Explore data]
```

Match rate is computed by running:
```sql
SELECT
  COUNT(*) AS total_left,
  COUNTIF(r.id IS NOT NULL) AS matched,
  COUNTIF(r.id IS NULL) AS orphaned,
  SAFE_DIVIDE(COUNTIF(r.id IS NOT NULL), COUNT(*)) AS match_rate
FROM left_table l
LEFT JOIN right_table r ON l.join_key = r.id
```

### 8.3 Visual Join Builder

The proposed join builder interface for multi-table joins:

```
  ┌─────────────────┐         ┌─────────────────┐
  │ orders          │         │ customers        │
  │─────────────────│  LEFT   │─────────────────│
  │ order_id (PK)   │  JOIN   │ id (PK)          │
  │ customer_id  ───┼─────────┼─→ id             │
  │ order_date      │    ▾    │ name             │
  │ total_amount    │  [INNER │ region           │
  │ status          │   RIGHT │ tier             │
  └─────────────────┘   FULL] └─────────────────┘
```

**Interaction model**:
1. Click a column in the left table to begin a join condition
2. Click a column in the right table to complete it — a connector line appears
3. Join type selector (INNER / LEFT / RIGHT / FULL) shows with a diagram explanation
4. "Preview" button generates a 10-row sample with real data
5. "Save as Join Definition" persists to Firestore for reuse across queries

Saved join definitions surface as autocomplete suggestions when the user types a table name in a subsequent query prompt — the AI can auto-apply the known relationship.

---

## 9. Library Experience Design

### 9.1 Existing Library

`SavedPage.tsx` at 1,392 lines is a complete library implementation. The current gaps are navigational:
- `SavedWorkLibrary.tsx` (488 lines) appears not routed from SideNav
- No cross-type filtering surface (All / Queries / Workflows / Pipelines / Dashboards)
- No type-aware card rendering for dashboard tiles

### 9.2 Proposed Library Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Library                                   [+ New]  [Search] │
│─────────────────────────────────────────────────────────────│
│ Spaces:                                                     │
│ [Finance]  [Marketing]  [Operations]  [Data Eng]  [+]       │
│─────────────────────────────────────────────────────────────│
│ Filter: [All]  [Queries]  [Workflows]  [Pipelines]          │
│         [Dashboards]  [Apps]                                │
│─────────────────────────────────────────────────────────────│
│ Sort: Most recently used ▾                                  │
│─────────────────────────────────────────────────────────────│
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ [QUERY]      │  │ [WORKFLOW]   │  │ [PIPELINE]   │      │
│  │ Weekly Rev.  │  │ Month-End    │  │ Daily Orders │      │
│  │ 847 runs     │  │ 12 steps     │  │ Runs 8am UTC │      │
│  │ Last: 2h ago │  │ Last: 1d ago │  │ Last: 6h ago │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 9.3 Library Sort Options

| Sort Option | Description |
|---|---|
| Most recently used (default) | Surfaces the artifacts you actually reach for |
| Most frequently run | Surfaces high-value scheduled / critical queries |
| Recently created | Surfaces new work for review |
| Alphabetical | Consistent browse for named assets |
| By type | Groups all queries, then workflows, then pipelines, etc. |

### 9.4 Navigation Wiring Required

| Entry Point | Target Route | Fix Required |
|---|---|---|
| SideNav "Saved Queries" | `/saved?type=query` | Replace `<a>` with `router.push()` |
| SideNav "Query History" | `/history` | Replace `<a>` with `router.push()` |
| SideNav "Library" | `/saved` | Add new nav item |
| SideNav "Dashboards" | `/saved?type=dashboard` | Add new nav item |
| Conversation toolbar | "Save as Workflow" modal | Wire `saveChatAsWorkflow()` to button |

---

## 10. Implementation Roadmap

Ordered by impact-to-effort ratio. High-impact, low-effort fixes first.

| Priority | Change | Impact | Effort | Notes |
|---|---|---|---|---|
| 1 | Fix save type detection (not hardcoded `'query'`) | High | Low | 1-line fix in `useSave` hook; infer from skill name |
| 2 | Wire "Save as Workflow" button to `saveChatAsWorkflow()` | High | Low | Function exists; add toolbar button + visibility condition |
| 3 | Fix dead SideNav links (Saved Queries, Query History) | High | Low | Replace `<a>` anchors with `router.push()` |
| 4 | `SCHEMA_DRIFT` baseline stored in Firestore | High | Low | Write baseline on first check run; compare on subsequent |
| 5 | Location parameter in pipeline (not hardcoded `'us'`) | High | Low | Read from project preference or infer from dataset location |
| 6 | Add snapshot-before-operation offer to data management | High | Low | Inject suggestion into PREVIEW_AND_CONFIRM cards |
| 7 | Add `SavedDashboard` type + Firestore collection | High | Medium | Type spec in Section 7; collection: `users/{uid}/dashboards` |
| 8 | Add `JoinDefinition` type + Firestore collection | Medium | Low | Type spec in Section 8; collection: `users/{uid}/joinDefinitions` |
| 9 | Join discovery (match rate from result) | High | Medium | SQL in Section 8.2; surface in discovery skill |
| 10 | Query parameterization UI in SaveModal | High | Medium | Parameter form section in SaveModal; widgets per type |
| 11 | Dashboard tile assembly UI | High | High | Pick from savedWork; drag-to-grid; global filter wiring |
| 12 | Column-level documentation write-back via ALTER COLUMN | High | Medium | ALTER COLUMN SET OPTIONS (description = '...') |
| 13 | Discovery SEARCH parallelism (`Promise.all`) | Medium | Low | Single-line change from serial to parallel fetch |
| 14 | URL-based artifact sharing | Medium | Medium | Top-level `sharedArtifacts/{id}` collection; public read rule |
| 15 | Pipeline DAG visualization in PipelineView | Medium | High | D3 DAG already exists in LineageDagView; reuse pattern |

### Phase Grouping

**Phase 1 — Quick wins** (items 1–6): All low-effort, high-impact wiring fixes. Should ship together as a single PR. Zero new infrastructure required.

**Phase 2 — New types** (items 7–10): Add `SavedDashboard` and `JoinDefinition` to Firestore, join discovery flow, and parameterization UI. One sprint.

**Phase 3 — Rich surfaces** (items 11–15): Dashboard tile assembly, column documentation, URL sharing, DAG visualization. Two sprints.

---

*End of report.*
