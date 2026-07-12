# Schema Discovery & Exploration — Product Design Report

**Report:** 02-schema-discovery  
**Project:** BigQuery AIF  
**Date:** 2026-07-11  
**Status:** Design-ready / Engineering-ready

---

## 1. Executive Summary

Schema discovery is one of the highest-leverage surfaces in a data assistant. When an analyst opens a new dataset, they face a cold-start problem: which table is the right one, what does it actually represent, is it fresh, and how do they join it correctly? A basic schema viewer answers the first question poorly and ignores the rest. An expert data catalog answers all five.

This report audits the current schema skill implementation in BigQuery AIF, identifies the gaps between what we have and what expert catalogs (dbt Explorer, Select Star, Atlan, Secoda) do, and produces a detailed design spec for every surface area: table summaries, dataset overviews, lineage visualization, search and discovery, and documentation annotation.

The core design thesis is: **metadata is the product.** Every stat — row count, freshness, query frequency, popular joins — is a decision accelerator. The UI's job is to surface these signals at the right granularity at the right moment, without ever requiring the user to write an INFORMATION_SCHEMA query themselves.

All primary metadata sources (row counts, table sizes, partition info, last-modified timestamps) are **free** in BigQuery — no table scans required. The cost of building a world-class schema explorer is essentially zero at the data layer. The investment is entirely in the UX and the orchestration logic.

**Top 5 highest-impact changes (in order):**
1. Usage signals from `INFORMATION_SCHEMA.JOBS` surfaced in table summary
2. Popular joins display (most underrated feature in any data catalog)
3. Grain statement in AI-generated descriptions
4. Column search for tables with >20 columns
5. Freshness color-coding (green / yellow / red)

---

## 2. Current State Audit

### 2.1 Schema Skill Handler

**File:** `src/lib/skills/handle-schema.ts` (532 lines)

The current implementation is structured and functional. It covers four declared scopes:

| Scope | Status | What it does |
|---|---|---|
| `PROJECT` | Working | Lists datasets with table counts |
| `DATASET` | Working | Lists tables with row counts and sizes |
| `TABLE` | Working | Full column metadata via REST + INFORMATION_SCHEMA |
| `ROUTINE` | Declared but unimplemented | UDF handler has no code |

The TABLE scope is the strongest. It pulls:
- Column schema via BigQuery REST API
- `INFORMATION_SCHEMA.COLUMN_FIELD_PATHS` for nested field traversal
- `TABLE_CONSTRAINTS` + `KEY_COLUMN_USAGE` for primary/foreign key detection
- Fast SQL templates for common enrichment patterns
- Slow path: Gemini-generated INFORMATION_SCHEMA SQL for unusual requests
- Cross-dataset fuzzy table name matching

Self-review is skipped for PROJECT and DATASET scope (appropriate — these are structural lookups).

### 2.2 Display Layer

**Artifact type:** `SCHEMA_VIEW`  
**Component:** `SchemaView.tsx` (67 KB)

| Scope | Current Display |
|---|---|
| PROJECT | "Found N datasets" headline + chips per dataset |
| DATASET | "X has N tables" + chip per table |
| TABLE | Leads with partitioning/clustering if present, then columns |

The TABLE display is functional but missing the surrounding context that makes it actionable.

### 2.3 Gap Analysis

The following capabilities are absent from the current implementation:

| Gap | Category | Impact |
|---|---|---|
| ROUTINE scope — zero handler code | Missing feature | Medium |
| No schema history / versioning (SCHEMA_DRIFT has no baseline) | Missing feature | Medium |
| No column-level description write-back to BigQuery | Missing feature | High |
| No dataset-level documentation or labels in PROJECT scope | Missing surface | Medium |
| No TABLE_STORAGE_TIMELINE for storage growth | Missing data | Low |
| No table expiration dates | Missing data | Low |
| No external table configuration (GCS paths, formats) | Missing feature | Medium |
| No policy tags surfaced in schema view | Missing signal | Medium |
| No usage signals from INFORMATION_SCHEMA.JOBS | Missing signal | Very High |
| No popular joins derived from query logs | Missing signal | High |
| No freshness color-coding | Missing UX | High |
| No column search for large tables | Missing UX | High |
| Dataset tables listed alphabetically, not by importance | Wrong default | High |

---

## 3. Expert Catalog Design Principles

These seven principles are synthesized from dbt Explorer, Select Star, Atlan, and Secoda. They represent the design delta between a basic schema viewer and a tool analysts actually trust.

### What Expert Catalogs Do vs. Basic Schema Viewers

| Signal | Basic Viewer | Expert Catalog |
|---|---|---|
| Column names and types | Yes | Yes |
| Column descriptions | If documented | AI-assisted + human-curated |
| Table description | If documented | Business-centric (grain, purpose, update frequency) |
| Row count | No | Yes (from TABLE_STORAGE) |
| Last modified | No | Yes, with freshness interpretation |
| Popularity ranking | No | Query-frequency based |
| Who uses this table | No | Top users, teams |
| Common query patterns | No | Parsed from query history |
| Frequent joins | No | Derived from query logs |
| Data quality signals | No | Null rates, freshness checks |
| Certification status | No | Verified / Deprecated / Flagged |
| Lineage | No | Table-level + column-level |

---

### Principle 1: Usage is the most honest documentation

Documentation written by humans is often wrong, stale, or missing. Query logs are ground truth. A table queried 847 times per month is more important than one queried 3 times — regardless of what any README says. Usage frequency must be a first-class UI signal, not buried in a tooltip.

> **Implementation:** Surface query count (last 30 days) prominently in table summary header. Rank dataset table lists by query frequency, not alphabetically.

### Principle 2: The grain statement is the single most valuable piece of documentation

"One row per completed order" communicates more than three paragraphs of column descriptions. If nothing else is documented, the grain statement must exist. It is the first thing an analyst asks when they see a new table.

> **Implementation:** Require grain statement in AI-generated descriptions. Template: `"One row per {inferred entity}."` This is a prompt engineering change, not an engineering effort.

### Principle 3: AI generates, humans confirm — never the reverse

AI-generated descriptions lower the authoring burden from 100% to ~20% (review and confirm). But wrong descriptions are worse than no descriptions — they create false confidence. The Atlan pattern is correct: offer a generated suggestion, badge it "AI-generated — verify before trusting," and require explicit human confirmation before persisting.

> **Implementation:** Offer description generation on first view of undocumented table. Show badge until human-confirmed. Never auto-apply without confirmation.

### Principle 4: Metadata lives in two tiers — free and expensive

All structural metadata (row counts, table sizes, creation time, last modified, partition info, column schema) is free in BigQuery — it comes from INFORMATION_SCHEMA and `__TABLES__`, not table scans. Sample data, null rates, and value distributions cost money. Schema exploration must operate primarily in the free tier and clearly signal when the user is about to trigger a paid scan.

> **Implementation:** Default to free metadata. Mark paid operations (sample rows, null rate calculation) with a cost indicator before executing.

### Principle 5: Popular joins eliminate the most common analyst mistake

Analysts joining on wrong keys — or not knowing which key to use — is the most common source of incorrect query results. A catalog that shows `orders JOIN customers ON orders.customer_id = customers.id (used in 234 queries)` eliminates this error class entirely. This information exists in query logs and requires no human input to generate.

> **Implementation:** Parse `INFORMATION_SCHEMA.JOBS.query` to extract frequent JOIN patterns per table. Display in Usage tab of table summary.

### Principle 6: Progressive disclosure prevents cognitive overload

A table with 150 columns is overwhelming if all 150 are shown at once. The correct pattern is a layered reveal: key identity info → stats → schema tab → column detail → sample data → usage → lineage. Each layer is on-demand. The default view must be scannable in under 10 seconds.

> **Implementation:** Zone-based layout (see Section 4). Tabbed deep-dive. Column search for tables >20 columns.

### Principle 7: Certification and freshness are trust signals, not metadata

"VERIFIED" and color-coded freshness indicators (green/yellow/red) are not decoration. They are the primary trust mechanism. An analyst who sees a red freshness indicator will not build a dashboard on that table without asking questions first. These signals prevent downstream data quality incidents.

> **Implementation:** Freshness color-coding based on `last_modified_time`. Certification status as a badge in the identity header (inferred or manually set).

---

## 4. Table Summary Design

A table summary must answer five questions, in priority order. The zone-based layout ensures each question is answered at the appropriate depth.

**The five questions:**
1. What is this table and what does it represent?
2. Is it fresh and trustworthy?
3. What are the key columns?
4. Who cares about this table and how is it used?
5. Where does it come from and what does it feed?

---

### Zone 1: Identity Header (always visible)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [TABLE]  project.sales_dataset.orders                  [VERIFIED] [PII]│
│                                                                         │
│  One row per completed order. Primary source for revenue reporting.     │
│                                                                         │
│  Owner: data-team@company.com  |  Dataset: sales_dataset  |  28 columns│
└─────────────────────────────────────────────────────────────────────────┘
```

**Requirements:**
- Full qualified table path: `project.dataset.table`
- Grain statement as the subtitle — specifically "One row per X", not a generic description
- Certification badge: `VERIFIED`, `DEPRECATED`, `UNVERIFIED` (default hidden if unset)
- PII badge: shown if policy tags detected in any column
- Owner: from table labels or `OPTIONS(description)` metadata
- Column count in header (not in stats row — too important to bury)

---

### Zone 2: Key Stats Row (always visible, below header)

```
┌──────────┬───────────┬────────────────────────────┬─────────────────────┐
│  4.2M    │  1.8 GB   │  Partitioned by order_date │  Queried 847x/month │
│  rows    │  storage  │  Clustered by customer_id  │  Updated 2h ago     │
└──────────┴───────────┴────────────────────────────┴─────────────────────┘
```

**Freshness color-coding:**
- Green: updated < 24 hours ago
- Yellow: updated 1–3 days ago
- Red: updated > 3 days ago

For partitioned tables, show: `"Latest partition: 2026-07-10 (yesterday)"`

Two freshness signals are distinct:
- **Metadata freshness:** when table was last written to (`__TABLES__.last_modified_time`)
- **Data freshness:** age of most recent record (`MAX(timestamp_column)`) — only available on explicit request (costs a scan)

**Stats displayed:**
1. Row count (from `TABLE_STORAGE.total_rows`)
2. Table size (from `TABLE_STORAGE.total_logical_bytes`, human-formatted)
3. Partition / clustering info (from `INFORMATION_SCHEMA.PARTITIONS`)
4. Query frequency (from `INFORMATION_SCHEMA.JOBS`, last 30 days)
5. Last modified (color-coded, from `__TABLES__.last_modified_time`)

---

### Zone 3: Tabbed Deep Dive

Four tabs, shown in this order:

```
[Schema]  [Sample Data]  [Usage]  [Lineage]
```

---

#### Tab 1 — Schema

Column list layout — each row:

| Column | Type | Mode | Description | Sample Values | Null Rate |
|---|---|---|---|---|---|
| `order_id` | `INTEGER` | REQUIRED | Unique identifier for each order | 10042, 10043 | — |
| `customer_id` | `INTEGER` | REQUIRED | FK to customers.customer_id | 882, 4471 | — |
| `net_amount` | `FLOAT` | NULLABLE | Revenue after refunds, before tax | 142.50, 89.00 | 2.1% |
| `order_date` | `DATE` | REQUIRED | Date the order was placed | 2026-07-10 | — |

**Column layout spec:**
1. Column name — monospace font, fixed width
2. Type badge — pill style: `STRING`, `INTEGER`, `TIMESTAMP`, etc.
3. Mode indicator — icon only: filled circle = REQUIRED, empty circle = NULLABLE (not text)
4. Description — 2-line truncated, click to expand
5. Sample values — 2–3 examples, light muted color
6. Null rate — small inline bar or percentage; hidden if < 5%

**Column search:** mandatory for tables with more than 20 columns. Filters live on keystroke.

**Nested fields:** RECORD types shown as expandable rows with indentation. Field path shown in full (`record.nested.field_name`).

---

#### Tab 2 — Sample Data

```
┌────────────┬─────────────┬────────────┬────────────────┐
│ order_id   │ customer_id │ net_amount │ order_date     │
├────────────┼─────────────┼────────────┼────────────────┤
│ 10042      │ 882         │ 142.50     │ 2026-07-10     │
│ 10043      │ 4471        │ 89.00      │ 2026-07-10     │
│ 10044      │ 1205        │ null       │ 2026-07-09     │
│ 10045      │ 882         │ 312.75     │ 2026-07-09     │
│ 10046      │ 7732        │ 55.00      │ 2026-07-08     │
└────────────┴─────────────┴────────────┴────────────────┘
5 rows  |  Not a full result — smell test only
```

**Rules:**
- Maximum 5 rows
- Columns with >90% null rate hidden by default (toggle to show)
- Long strings truncated at 60 characters with `...`
- `null` rendered in italics, muted color
- Cost indicator shown before fetching: "This will scan up to X MB"

---

#### Tab 3 — Usage

```
Queried 847 times this month

Top users:
  Alice Chen        312 queries
  Bob Kim           187 queries
  3 others           ...

Popular queries:
  SELECT order_id, customer_id, total_amount
  FROM orders WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)

  SELECT COUNT(*) FROM orders WHERE status = 'completed'
  AND order_date >= '2026-01-01'

Popular joins:
  orders JOIN customers
    ON orders.customer_id = customers.id
    Used in 234 queries

  orders JOIN order_items
    ON orders.order_id = order_items.order_id
    Used in 187 queries
```

**Implementation notes:**
- Source: `INFORMATION_SCHEMA.JOBS` filtered by `creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)`
- Filter out service account queries (ETL bots) to surface human intent
- SQL parsing for JOIN extraction: look for `JOIN <table>` patterns and `ON <col> = <col>` clauses
- Truncate query text at 120 characters for display
- Popular joins are the highest-value output of this tab

---

#### Tab 4 — Lineage

Inline mini-graph (see Section 6 for full lineage spec):

```
[salesforce_opportunities] --►  [stg_opportunities]  --►  [orders]  --►  [revenue_daily]
[stripe_charges]           --►  [stg_charges]         --►            --►  [cohort_analysis]
                                                                     --►  [Sales Dashboard]
```

- Click any node to open its table summary
- "View full lineage" button opens the full lineage visualization

---

### Zone 4: Column Detail Panel (on column click)

Clicking any column expands a side panel or inline detail block:

```
net_amount  FLOAT  NULLABLE

Description:
  Revenue after refunds, before tax.
  [AI-generated — verify before trusting]

Sample values:  142.50  |  89.00  |  312.75  |  null

Data quality:
  Null rate: 2.1%  (148 of 7,042 rows sampled)
  Min: 0.00  |  Max: 48,200.00  |  Avg: 87.43

Appears in queries:
  SELECT SUM(net_amount) FROM orders WHERE ...
  SELECT net_amount, order_id FROM orders JOIN ...

[Edit description]  [View column lineage]
```

---

### Zone 5: Inline Actions (contextual, always accessible)

```
[Copy full path]  [Query this table]  [Add description]  [View lineage]  [Export schema]
```

Actions are present but visually quiet — ghost/outline style buttons. They should not compete with the data.

---

## 5. Dataset Overview Design

When a user asks about a dataset (DATASET scope), the response must communicate: what is in here, how big is it, what matters, and where to start. The current chip-based list is insufficient.

---

### Section 1: Header Card

```
┌─────────────────────────────────────────────────────────────────────────┐
│  sales_dataset                                      project: my-project  │
│                                                                         │
│  42 tables  |  187.3 GB total  |  Last updated: 2h ago (orders table)  │
│                                                                         │
│  Central dataset for sales and revenue analytics. Contains fact tables  │
│  for orders and transactions, dimension tables for customers and         │
│  products, and dbt-generated aggregates for reporting.                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Section 2: Key Stats Grid

| Stat | Value | Notes |
|---|---|---|
| Total tables | 42 | Breakdown: 28 regular, 11 views, 3 materialized views |
| Total rows | 2.4B | Sum across all tables |
| Total storage | 187.3 GB | Logical bytes |
| Est. full-scan cost | ~$4.20 | At $5/TB standard rate |
| Date range covered | Jan 2022 – present | From partition metadata |
| Most recent update | 2h ago (orders) | `__TABLES__` max `last_modified_time` |

---

### Section 3: Table Listing — Ranked by Importance

**Default sort: query frequency (last 30 days), then row count, then recency. Never alphabetical.**

Alphabetical ordering is the wrong default for data catalogs. Importance order is what analysts need.

```
┌────────────────────┬───────────┬────────┬──────────────┬──────────────────┬──────────┐
│ Table              │ Rows      │ Size   │ Updated      │ Queries/mo       │ Type     │
├────────────────────┼───────────┼────────┼──────────────┼──────────────────┼──────────┤
│ orders             │ 4.2M      │ 1.8 GB │ 2h ago       │ 847              │ [FACT]   │
│ order_items        │ 19.1M     │ 8.3 GB │ 2h ago       │ 634              │ [FACT]   │
│ customers          │ 287K      │ 45 MB  │ 4h ago       │ 412              │ [DIM]    │
│ products           │ 14K       │ 3 MB   │ 1d ago       │ 201              │ [DIM]    │
│ daily_rev_summary  │ 1.8K      │ 890 KB │ 2h ago       │ 189              │ [AGG]    │
│ stg_orders         │ 4.2M      │ 1.7 GB │ 2h ago       │ 34               │ [STAGING]│
└────────────────────┴───────────┴────────┴──────────────┴──────────────────┴──────────┘
```

**Badge inference heuristics (no human input required):**
- `[FACT]`: high row count + frequently queried + contains metric columns (amount, count, revenue)
- `[DIM]`: lower row count + columns named `id`, `name`, `description`, `code`
- `[STAGING]`: prefix `stg_`, `raw_`, `int_`, `tmp_`
- `[AGG]`: prefix `daily_`, `weekly_`, `monthly_`, `summary_`, `agg_`
- `[VIEW]`: table type = VIEW or MATERIALIZED_VIEW

---

### Section 4: Naming Patterns (synthesized)

The assistant analyzes and narrates the naming conventions it observes:

> "This dataset follows dbt naming conventions. Tables prefixed `stg_` contain staged source data (7 tables). Tables prefixed `int_` contain intermediate transformations (4 tables). Most tables are partitioned by `created_at` or `order_date`. Time coverage runs from January 2022 to present based on partition metadata."

This is AI-narrated from structural observation — no human input required.

---

### Section 5: Suggested Entry Points

> **Start here:**
> - `orders` — most-queried fact table (847x/month), 4.2M rows, central to all revenue analysis
> - `customers` — primary customer dimension, joins to most other tables via `customer_id`
> - `daily_revenue_summary` — pre-aggregated, fast to query, good for dashboards

These are ranked by query frequency. The guidance is algorithmic, not curated.

---

### Section 6: Cost Context

Cost estimates are calculated from `TABLE_STORAGE.total_logical_bytes` using BigQuery on-demand pricing ($5/TB):

```
Estimated scan costs (on-demand pricing):

  orders (1.8 GB):
    With date partition filter:  ~$0.009
    Full table scan:             ~$9.00

  Full dataset scan (187.3 GB): ~$4.20

  Views and materialized views may have different cost profiles.
```

Show this section collapsed by default. Expand on click.

---

## 6. Lineage Visualization

### 6.1 Layout

**Canonical layout: left-to-right directional flow.**

- Upstream sources: left
- Focal table: center
- Downstream consumers: right

```
[raw.crm.sf_opps]    --►  [stg_opportunities]  --+
                                                   +--►  [orders]  --►  [revenue_daily]
[raw.payments.stripe]--►  [stg_charges]        --+             --►  [cohort_analysis]
                                                                --►  [Sales Dashboard]
```

**Do not use force-directed layouts.** Force-directed graphs are disorienting for lineage because analysts have a strong mental model of upstream/downstream as left/right. Violating this model creates confusion.

Top-down layout is acceptable only for simple, narrow DAGs with no fan-out.

---

### 6.2 Granularity Levels

| Level | Answers | Default |
|---|---|---|
| Table / dataset | What tables feed this table? | YES |
| Job / pipeline | What processes transform this data? | On demand |
| Column | Where does this specific column come from? | On demand |

Column-level lineage ("lineage lenses" in dbt Explorer) is the most powerful feature but also the most compute-intensive to derive. It should be available on demand, not rendered by default.

**Column-level lineage trigger:** user clicks a column name in the Schema tab → lineage graph highlights the path for that specific column through all upstream and downstream transformations.

---

### 6.3 Handling Wide and Deep Graphs

Large lineage graphs must not render as hairballs. Apply these techniques:

| Technique | When to apply | How |
|---|---|---|
| Progressive disclosure | Always | Show 1 hop upstream + 1 hop downstream by default |
| Layer collapsing | > 3 nodes at same depth | "5 source tables" as single expandable node |
| Focus path | User clicks a node | Highlight full upstream path; dim everything else |
| Zoom-aware rendering | Continuous | Low zoom = names only; medium = type badges; high = row count + freshness |

---

### 6.4 Interactive Features

| Interaction | Behavior |
|---|---|
| Click node | Open mini-summary panel (description, row count, freshness) — no navigation |
| Double-click node | Open full table summary |
| Click edge | Show the transformation / job that connects the two nodes |
| Upstream toggle | Expand one additional hop upstream |
| Downstream toggle | Expand one additional hop downstream |
| Filter by type | Show/hide: table, view, materialized view, external table, BI tool |
| Search in graph | Highlight matching nodes |
| Impact analysis mode | Select focal table → amber glow on all downstream nodes affected by a change |

**Impact analysis** is the "what breaks if I change this?" mode. It is distinct from normal lineage browsing and must be triggered explicitly (button or command).

---

### 6.5 Conversational Lineage Format

When lineage is rendered in chat context (no graph renderer available), use this text format:

```
Lineage for: project.sales_dataset.orders

Upstream (2 hops):
  raw.crm.salesforce_opportunities
    -> [dbt model: stg_opportunities]
    -> orders

  raw.payments.stripe_charges
    -> [dbt model: stg_charges]
    -> orders

Downstream:
  orders -> reporting.revenue_daily       (updated 2h ago)
  orders -> reporting.cohort_analysis     (updated 6h ago)
  orders -> [Looker: Sales Dashboard]     (8 views today)

Impact: changing orders schema would affect 2 reporting tables and 1 BI dashboard.
```

The impact summary at the bottom is always included when downstream consumers exist.

---

## 7. Search and Discovery

### 7.1 Result Ranking

Search results must be ranked by a weighted blend — not alphabetically. Alphabetical order rewards tables named with early-alphabet prefixes, not important tables.

| Signal | Weight | Source |
|---|---|---|
| Text relevance (name, column names, description) | Highest | Lexical match |
| Usage frequency (queries, last 30 days) | Strong | `INFORMATION_SCHEMA.JOBS` |
| Recency (last modified) | Tiebreaker | `__TABLES__.last_modified_time` |

Default result order: popularity. Alphabetical only on explicit request.

---

### 7.2 Facets

Show a maximum of 5–6 visible facets. Display result counts per facet value. Allow multi-select within a facet.

| Facet | Values | Why |
|---|---|---|
| Dataset | List of datasets in project | Scope to domain |
| Table type | TABLE, VIEW, MATERIALIZED VIEW | Affects query strategy |
| Partition type | Partitioned, unpartitioned | Affects query cost |
| Freshness | Updated today / this week / older | Trust signal |
| Size tier | Small (<100 MB), Medium (100 MB–10 GB), Large (>10 GB) | Query planning |
| Certification | Verified, Unverified, Deprecated | Trust signal |

---

### 7.3 Search Result Card

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [TABLE]  orders                                    [VERIFIED] 847/mo   │
│           project.sales_dataset  |  4.2M rows  |  Updated 2h ago       │
│                                                                         │
│  One row per completed order. Primary source for revenue reporting.     │
│                                                                         │
│  Columns: order_id, customer_id, total_amount, order_date  (+23 more)  │
│                                                                         │
│  [Query this table]   [View schema]   [Copy full path]                  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Card spec:**
- Table type icon (table / view / materialized view)
- Name (large, bold)
- Certification badge + query frequency (right-aligned)
- Full qualified path + row count + freshness (subtitle line)
- Description as first content after name — not buried
- Column list: first 4 most-distinctive columns, then `(+N more)`
- Action buttons: present but visually quiet (ghost/outline style)

**Column highlighting:** if the search query matched a column name, show that column first in the column list and highlight it.

---

### 7.4 Semantic and Fuzzy Search

Three-layer search stack:

| Layer | Mechanism | Handles |
|---|---|---|
| Lexical | Direct string match against names and descriptions | Exact matches, prefix matches |
| Fuzzy | Levenshtein distance | Typos: `"ordres"` -> `"orders"` |
| Semantic | Vector similarity (embeddings) | Business-to-technical translation |

**Semantic examples:**
- `"monthly recurring revenue"` -> finds `mrr_daily`, columns named `mrr_amount`, `monthly_revenue`
- `"customer churn"` -> finds `churn_events`, `customer_retention_monthly`
- `"what did we sell last week"` -> finds `orders`, `order_items`

Semantic search requires pre-computed embeddings over table names, descriptions, and column names. These can be generated on-demand (first access) and cached.

---

### 7.5 No-Results Experience

When search returns zero results, do not show a blank state. Show:

1. **Spelling suggestion:** "Did you mean: `orders`?"
2. **Broader suggestion:** "Try searching in: `project.analytics`"
3. **Partial match:** "We didn't find `MRR` but found columns named `mrr_amount`, `monthly_revenue` in `reporting.kpi_summary`"

The no-results state is a discovery opportunity. A user searching for something that doesn't exist by that name is often searching for something that does exist under a different name.

---

## 8. Documentation and Annotation

### 8.1 AI-Assisted Description Generation

The Atlan pattern applied to BigQuery AIF:

**Step 1: Detection**

On TABLE scope response, check if `table.description` is empty. If so, offer generation inline:

```
This table has no description. Want me to generate one based on column
names and sample data? I'll draft it — you confirm before it's saved.
```

**Step 2: Generation**

Template:
```
{table_name} contains {inferred entity}. One row per {inferred grain}.
Key columns: {most distinctive columns}. Updated {freshness}. Part of {dataset}.
```

Example output:
```
`orders` contains completed customer orders. One row per order. Key columns:
order_id (unique identifier), customer_id (links to customers), net_amount
(revenue after refunds), order_date (when order was placed). Updated daily.
Part of the sales_dataset.
```

**Step 3: Human confirmation**

Show the draft with an `[AI-generated — verify before saving]` badge. Two actions:
- `[Confirm and save]` -> calls BigQuery table update API
- `[Edit]` -> opens inline editor, then save

Column-level example:
```
ltv_90d in customers has no description.
Suggested: "Customer lifetime value over the trailing 90 days."
[Confirm]  [Edit]  [Skip]
```

**Quality rule:** if the AI-generated description cannot be grounded in column names, data types, or sample values with reasonable confidence, show "I'm not confident enough to suggest a description for this table" rather than generating a low-quality guess. Wrong descriptions are worse than no descriptions.

---

### 8.2 Inline Annotation Conversational Pattern

Users can annotate tables and columns through natural language without knowing the BigQuery API:

**Example interaction:**

```
User:   The `net_amount` column in orders represents revenue after refunds and before tax.

AI:     I'll add this description to project.sales_dataset.orders.net_amount:
        "Revenue after refunds, before tax."

        Confirm?  [Yes, save it]  [Edit]

User:   Yes, save it.

AI:     Done. Description saved. It's now visible in the BigQuery console
        and queryable via INFORMATION_SCHEMA.COLUMNS.
```

**Context-awareness rules:**
- If user is currently viewing `orders` schema and mentions a column by name, infer the table automatically
- If user mentions a column that exists in multiple tables, ask to confirm: "Did you mean `net_amount` in `orders` or `net_amount` in `order_items`?"
- If user says "add a description to this column" while a column is in focus, use the focused column

**Disambiguation prompt:**
```
I can see you're looking at the orders schema. Did you mean to add this
description to orders.net_amount?  [Yes]  [Different column]
```

---

### 8.3 Write-Back Actions

Both table-level and column-level descriptions persist directly to BigQuery via the REST API. They are not stored in a separate catalog — they live in BigQuery and are therefore visible in the BigQuery console and `INFORMATION_SCHEMA`.

**SQL equivalents (for reference):**

```sql
-- Table-level description
ALTER TABLE `project.dataset.orders`
SET OPTIONS (description = 'One row per completed order. Primary source for revenue reporting.');

-- Column-level description
ALTER TABLE `project.dataset.orders`
ALTER COLUMN net_amount
SET OPTIONS (description = 'Revenue after refunds, before tax.');
```

**Routing:** Description write-back falls under the data-management skill's DDL scope. The router needs signal for description-setting intent:
- Trigger phrases: "add a description", "document this column", "annotate", "this column means", "this table represents"
- Context: currently viewed table/column serves as implicit target

---

## 9. BigQuery Metadata Sources Reference

All sources in this section are **free** — they do not scan table data.

| Metadata | Source | Cost |
|---|---|---|
| Row count | `INFORMATION_SCHEMA.TABLE_STORAGE.total_rows` | Free |
| Table size (logical) | `INFORMATION_SCHEMA.TABLE_STORAGE.total_logical_bytes` | Free |
| Table size (physical) | `INFORMATION_SCHEMA.TABLE_STORAGE.total_physical_bytes` | Free |
| Creation time | `INFORMATION_SCHEMA.TABLE_STORAGE.creation_time` | Free |
| Last modified time | `dataset.__TABLES__.last_modified_time` (milliseconds epoch) | Free |
| Partition info | `INFORMATION_SCHEMA.PARTITIONS` | Free |
| Column schema | BigQuery REST API (`tables.get`) | Free |
| Column descriptions | REST API `.schema.fields[].description` | Free |
| Table description | REST API `.description` | Free |
| Table constraints | `INFORMATION_SCHEMA.TABLE_CONSTRAINTS` | Free |
| Key column usage | `INFORMATION_SCHEMA.KEY_COLUMN_USAGE` | Free |
| Policy tags | REST API `.schema.fields[].policyTags` | Free |
| Table labels | REST API `.labels` | Free |
| Query history | `INFORMATION_SCHEMA.JOBS` (project-level) | Free |
| Table expiration | REST API `.expirationTime` | Free |
| External table config | REST API `.externalDataConfiguration` | Free |
| Routine definitions | `INFORMATION_SCHEMA.ROUTINES` | Free |

**Paid operations (require table scan):**

| Operation | Trigger | Cost |
|---|---|---|
| Sample rows | User explicitly requests sample data | Bytes scanned in first N rows |
| Null rates | User explicitly requests data quality stats | Full column scan |
| Value distributions | User explicitly requests distributions | Full column scan |
| Data freshness (MAX timestamp) | User requests data-level freshness | Full column scan |

The UI must display a cost estimate and require explicit confirmation before executing any paid operation.

---

## 10. Implementation Roadmap

Ranked by impact-to-effort ratio. All items that touch the schema skill or display layer require a build and deploy cycle per project rules.

| # | Change | Impact | Effort | Primary File |
|---|---|---|---|---|
| 1 | Usage signals from `INFORMATION_SCHEMA.JOBS` in table summary | Very High | Medium | `handle-schema.ts` |
| 2 | Popular joins display in Usage tab | High | Medium | `handle-schema.ts`, `SchemaView.tsx` |
| 3 | Grain statement in AI-generated table descriptions | High | Low | Prompt in `handle-schema.ts` |
| 4 | Column search in SchemaView for tables >20 cols | High | Low | `SchemaView.tsx` |
| 5 | Freshness color-coding (green/yellow/red) in schema view | High | Low | `SchemaView.tsx` |
| 6 | Dataset table list ranked by query frequency | High | Medium | `handle-schema.ts`, `SchemaView.tsx` |
| 7 | Annotation write-back (table + column descriptions) | High | Medium | New: `handle-annotate.ts`, router |
| 8 | Table type badges inferred heuristically in DATASET scope | Medium | Low | `handle-schema.ts` |
| 9 | Suggested entry points in DATASET overview | Medium | Low | `handle-schema.ts` |
| 10 | Cost estimates in DATASET overview | Medium | Low | `handle-schema.ts` |
| 11 | Policy tags surfaced in TABLE scope | Medium | Medium | `handle-schema.ts`, `SchemaView.tsx` |
| 12 | ROUTINE scope handler implementation | Medium | High | `handle-schema.ts` |
| 13 | SCHEMA_DRIFT baseline storage in Firestore | Medium | Low | New: drift baseline writer |
| 14 | External table configuration display | Low | Medium | `handle-schema.ts`, `SchemaView.tsx` |
| 15 | Table expiration dates in TABLE scope | Low | Low | `handle-schema.ts` |

---

### Phase 1 — Quick Wins (items 3, 4, 5, 8, 9)

Prompt changes and small UI additions in `SchemaView.tsx`. No new API calls. No new data sources.  
**Estimated effort:** 1–2 days. Ship these first.

### Phase 2 — Usage Intelligence (items 1, 2, 6)

Add `INFORMATION_SCHEMA.JOBS` queries to the schema skill. The data is free but the query is new. Use explicit `creation_time` filters and `LIMIT` to keep costs at zero. Parse JOIN patterns from query text using regex or SQL AST.  
**Estimated effort:** 3–5 days.

### Phase 3 — Annotation Write-Back (item 7)

New intent in the router, new skill handler for annotation, BigQuery REST API calls for `tables.patch`. Conversational pattern requires careful context-awareness, disambiguation, and confirmation flow design.  
**Estimated effort:** 3–5 days.

### Phase 4 — Remaining Features (items 10–15)

Lower priority, higher effort, or lower analyst impact. Pick up as bandwidth allows.

---

*End of Report*

---

**See also:**
- `01-data-visualization.md` — chart types, rendering strategy, query result display
- `03-query-composer.md` — query generation UX, SQL editing, explain mode (planned)
- `04-data-quality.md` — freshness monitoring, drift detection, alert design (planned)
