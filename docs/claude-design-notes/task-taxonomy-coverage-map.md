# Task Taxonomy Coverage Map

Cross-reference between the "03 - Task Taxonomy" list and the BigQuery
Capability Catalog / skill templates. Every item below maps to a skill
module, the underlying mechanism, the primary artifact it renders as (per
each skill's UI mapping and the visualization mapping doc), and the
relevant catalog section(s). Items that required new catalog additions are
marked **(new)**.

---

## 1. Data Exploration & Discovery

| Task | Skill | Mechanism | Primary artifact | Catalog ref |
|---|---|---|---|---|
| Browse projects/datasets/tables | Discovery | `datasets.list`, `tables.list` | Browsable list/tree | §3, §13 |
| View table schema | Schema | `tables.get`, `INFORMATION_SCHEMA.COLUMNS` | Column table (expandable for nested fields) — "smart" framing surfaces partitioning/clustering as query-cost guidance | §3 |
| Profile data (distributions, nulls, cardinality) | Data Quality **(new)** | `APPROX_COUNT_DISTINCT`, `APPROX_QUANTILES`, `COUNTIF` | Column profile table, flagged column(s) pinned — `ATTENTION` on deviation, `POSITIVE` if clean | §12 |
| Query data (ad-hoc SQL) | Query | `jobs.query`/`jobs.insert` | Per visualization mapping doc | §1 |
| Preview sample rows | Query | `SELECT * LIMIT N` or `tabledata.list` | Table | §1, §3 |
| Search for tables/columns | Discovery **(new)** | `INFORMATION_SCHEMA` + Knowledge Catalog search | List of matches, or table if many | §13 |
| Compare two tables | Discovery **(new)** | Schema diff (`INFORMATION_SCHEMA.COLUMNS`) + aggregate diff query | Diff table — `ATTENTION` on type changes or large row-count differences | §13 |
| View table lineage | Discovery **(new)** | Data Lineage API | Workflow/lineage diagram — different data source than a BQ query | §13 |
| Describe/summarize a dataset | Schema + Data Quality | `tables.get`/`datasets.get` + profiling | Summary card | §3, §12 |

---

## 2. Data Transformation & Cleaning

| Task | Skill | Mechanism | Primary artifact | Catalog ref |
|---|---|---|---|---|
| Deduplicate rows | Data Management | `DELETE`/CTAS with `ROW_NUMBER()` window dedup, snapshot-based execution | Confirmation card (example group) → result summary | §2 |
| Standardize values | Data Management | `UPDATE` with string functions | Confirmation card (`WHERE`-based preview) → result summary | §2 |
| Fill missing values | Data Management | `UPDATE ... SET col = COALESCE(...)` | Confirmation card → result summary | §2 |
| Remove outliers | Data Management (+ ML for detection) | `DELETE` after profiling/anomaly detection | Confirmation card → result summary — detection and removal are separate turns | §2, §12, §9 |
| Type casting | Data Management | `ALTER TABLE ... ALTER COLUMN SET DATA TYPE` or CTAS with `CAST` | Schema diff (before/after) | §2 |
| Normalize/denormalize | Data Management + Query | CTAS with joins / `UNNEST` | Schema diff + new-table summary | §1, §2 |
| Pivot/unpivot | Query **(new)** | `PIVOT`/`UNPIVOT` operators | Table (reshaped) — **not destructive**, standard Query pattern | §1 |
| Filter and segment | Query | `WHERE` clauses | Per visualization mapping doc | §1 |
| String operations | Query | Native string functions | Table — becomes Data Management only if writing results back (→ Standardize) | §1 |

---

## 3. Data Quality & Validation

All items in this category are the **Data Quality** skill **(new)**, §12.

| Task | Mechanism | Primary artifact |
|---|---|---|
| Find duplicates | `GROUP BY ... HAVING COUNT(*) > 1` | Table of duplicate groups, or `POSITIVE` empty state ("no duplicates found") |
| Null analysis | `COUNTIF(col IS NULL)` per column | Bar chart or table of null rates per column |
| Validate data types | `INFORMATION_SCHEMA.COLUMNS` vs. expected schema | Diff table (mismatches only) |
| Referential integrity check | `LEFT JOIN ... WHERE right.key IS NULL` | KPI card (orphan count) + sample table |
| Data freshness check | `tables.get` (`lastModifiedTime`) / `INFORMATION_SCHEMA.PARTITIONS` | Status card — cheapest check, no scan |
| Value range validation | Range checks via `WHERE` | KPI card (out-of-range count) + sample rows |
| Completeness audit | Null analysis aggregated across columns | Completeness % KPI, or per-column table |
| Schema drift detection | `INFORMATION_SCHEMA.COLUMNS` snapshot diff, or Data Lineage change events (§13) | Diff view (added/removed/changed columns) — requires persisted prior snapshot (§8) |

Optional managed path: Dataplex Data Quality scans (`dataScans` resource)
for scheduled, rule-based checks once ad-hoc profiling needs grow.

---

## 4. Joining & Combining

| Task | Skill | Mechanism | Primary artifact | Catalog ref |
|---|---|---|---|---|
| Join two tables | Query | INNER/LEFT/RIGHT/FULL/CROSS JOIN | Per visualization mapping doc | §1 |
| Union/append tables | Query | `UNION ALL`/`UNION DISTINCT` | Per visualization mapping doc | §1 |
| Cross-join / cartesian | Query | `CROSS JOIN` | Per visualization mapping doc — dry-run matters, cartesian products jump cost tiers fast | §1 |
| Lookup/enrich | Query (+ Enrichment for external) | JOIN, or remote function call | Table with added column(s) — routes to Enrichment only for external lookups | §1, §14 |
| Self-join | Query | Self-referencing JOIN | Per visualization mapping doc | §1 |
| Merge/upsert | Data Management | `MERGE` | Confirmation card (preview) → result summary | §2 |

---

## 5. Aggregation & Analytics

| Task | Skill | Mechanism | Primary artifact | Catalog ref |
|---|---|---|---|---|
| Group by + aggregate | Query | `GROUP BY` + aggregate functions | Per visualization mapping doc | §1 |
| Running totals/averages | Query | Window functions (`SUM()`/`AVG() OVER`) | Line or area chart | §1 |
| Ranking / Top-N | Query | `RANK()`/`ROW_NUMBER()` or `ORDER BY ... LIMIT` | Bar chart — emphasis usually unnecessary, sort order already shows "top" | §1 |
| Year-over-year comparison | Query | Date functions + self-join or window comparing periods | Multi-series line/area chart — comparison query is itself cost-tiered, don't add silently | §1 |
| Cohort analysis | Query | Grouped query pattern — bucket by acquisition period, measure over subsequent periods | Heatmap (cohort × period grid) | §1 |
| Funnel analysis | Query | Conditional aggregation across ordered stages | Funnel chart | §1, §15 |
| Statistical summary | Query / Data Quality | `MIN`/`MAX`/`AVG`/`STDDEV`/`APPROX_QUANTILES` | Table or KPI grid — overlaps with Data Quality's profile but framed as analysis | §1, §12 |
| Percentile/distribution | Query / Data Quality | `APPROX_QUANTILES` | Heatmap or bar-chart histogram | §1, §12 |

---

## 6. Schema & Table Operations

All items are the **Data Management** skill, §2.

| Task | Mechanism | Primary artifact |
|---|---|---|
| Add/remove columns | `ALTER TABLE ... ADD/DROP COLUMN` | Schema diff (before/after) |
| Rename columns | `ALTER TABLE ... RENAME COLUMN` | Schema diff |
| Create view | `CREATE VIEW` | Confirmation + new-object summary — safe/additive, no confirmation gate needed |
| Create table from query | `CREATE TABLE ... AS SELECT` (CTAS) **(new — explicit)** | Confirmation + new-table summary — safe/additive |
| Partition a table | CTAS with `PARTITION BY` into new table (can't alter in place) **(new — explicit)** | Confirmation → result summary — effectively a table rebuild, not a quick config change |
| Cluster a table | `ALTER TABLE ... SET OPTIONS (clustering_fields=...)` or CTAS with `CLUSTER BY` **(new — explicit)** | Confirmation → result summary — can be in-place, cheaper than partitioning |
| Copy/clone table | Copy job (`jobs.insert` with `copy` config) or `CREATE TABLE ... CLONE` **(new — explicit)** | Confirmation + new-table summary — safe/additive |

---

## 7. Job & Cost Management

All items are the **Monitoring** skill, §4/§8.

| Task | Mechanism | Primary artifact |
|---|---|---|
| Diagnose failed job | `jobs.get` + `INFORMATION_SCHEMA.JOBS` | Status/error card |
| Cost analysis | `INFORMATION_SCHEMA.JOBS` (bytes processed) | Table or KPI, often with period comparison (`COMPARISON` basis) |
| Find expensive queries | `INFORMATION_SCHEMA.JOBS_BY_PROJECT` sorted by bytes/slot-ms | Sortable table, expensive job highlighted |
| Storage analysis | `INFORMATION_SCHEMA.TABLE_STORAGE` **(new)** | Table or bar chart of storage by table |
| Slot usage analysis | `INFORMATION_SCHEMA.JOBS_TIMELINE` | Timeline/area chart |
| Query optimization suggestions | `jobs.get` → `statistics.query.queryPlan` **(new)** | Per-stage breakdown table — hands off to Query for the rewrite |
| Dry run / estimate | `dryRun: true` (also Query skill, §1) | Inline cost estimate — rarely standalone, usually embedded in another response |

---

## 8. Export & Sharing

All items are the **Data Loading** skill, §5/§6, with two new dependencies.

| Task | Mechanism | Primary artifact |
|---|---|---|
| Export to CSV/JSON | Extract job (`jobs.insert` with `extract` config) | Download link card |
| Share query results | Saved query sharing (Dataform API permissions) or Analytics Hub for broader sharing | Confirmation + share link — Analytics Hub path is lower-priority/optional |
| Schedule query | BigQuery Data Transfer API — scheduled queries | Schedule confirmation card (diff if updating an existing schedule) |
| Create saved query | Dataform API saved-query resources **(new)** | Confirmation with "run now" — also the Tier 0 alerting mechanism (§C) |
| Export to Sheets | Sheets API (`spreadsheets.values.update`/`append`) **(new)** | "Open in Sheets" link — 10M-cell limit check before attempting |

---

## 9. Visualization & Reporting

All 21 items map to §15 (cross-cutting) — see the companion **Visualization
& Chart Type Mapping** doc for the full result-shape → component table.
Summary: table, KPI card, bar/column/line/area/pie charts, sparkline,
heatmap, scatter plot, gauge, funnel, sankey, treemap, network graph,
workflow/lineage diagram (from §13's Data Lineage API, not a BQ query — the
one exception, owned by Discovery rather than Query), and the four map
types (dot, choropleth, USA, world — all needing geo data per §14/§15).
Comparison view is two instances of any shape above, not a distinct chart
type.

---

## 10. ML & Advanced Analytics

All items are the **ML/Analytics** skill, §9 (deferred — simple cases
routed through Query calling `AI.*`/`ML.*` functions directly).

| Task | Mechanism | Primary artifact |
|---|---|---|
| Train a model (BQML) | `CREATE MODEL` | Confirmation + model summary card |
| Classify text | `AI.GENERATE`/`AI.GENERATE_BOOL` or a trained classification model **(new — generative path)** | Table with classification column |
| Sentiment analysis | `AI.GENERATE_DOUBLE`/`AI.GENERATE` **(new)** | Table, or distribution chart of sentiment |
| Anomaly detection | `AI.DETECT_ANOMALIES` (zero-train) or `ML.DETECT_ANOMALIES` (trained model) **(new)** | Table/chart with `is_anomaly` rows emphasized — feeds the "remove outliers" handoff (§2) |
| Forecasting | `AI.FORECAST` (zero-train, TimesFM) or `ARIMA_PLUS` via `CREATE MODEL` **(new)** | Line chart — history + forecast band |
| Clustering | `CREATE MODEL` with `KMEANS` | Scatter plot colored by cluster, or table |

---

## 11. Data Enrichment

| Task | Skill | Mechanism | Primary artifact | Catalog ref |
|---|---|---|---|---|
| Translate text | Enrichment **(new)** | Cloud Translation API, or `AI.GENERATE` for lighter-weight cases | Table with translated column — `AI.GENERATE` is the lighter default | §14 |
| Geocode addresses | Enrichment **(new)** | Geocoding API (Maps Platform) | Table with lat/lng columns added — feeds map visualizations (§9) | §14 |
| Derive calculated fields | Query | SQL expressions / generated columns | Table | §1, §14 |
| Date/time parsing | Query | `PARSE_DATE`, `PARSE_TIMESTAMP`, etc. | Table | §1, §14 |
| Regex extraction | Query | `REGEXP_EXTRACT`, `REGEXP_REPLACE` | Table | §1, §14 |

---

## 12. Monitoring & Alerts

All items route through the **Monitoring** skill (§4) and/or the **data-
condition alerting pattern** (`bigquery-shared-harness-policies.md` §C),
depending on which of §C's three cases applies — project-wide aggregate
metrics go straight to Cloud Monitoring `alertPolicies`; anything scoped to
one job/schedule, or any row-content condition, goes through the Tier 0/1
saved-check or scheduled-check path.

| Task | Mechanism | Primary artifact |
|---|---|---|
| Watch a metric | Cloud Monitoring `timeSeries.list`/`alertPolicies` (project-wide), or Tier 0/1 per §C (per-job or data condition) | Varies — classify per §C before routing |
| Track query costs | `INFORMATION_SCHEMA.JOBS` (project-wide), or Tier 0/1 if scoped to one schedule | Varies — "this specific schedule" is §C's third routing case |
| Data freshness monitoring | Data Quality defines the check (§3) → Data Loading Tier 0/1 (§C) | Saved-check confirmation, or scheduled+email confirmation — defaults to Tier 0 |
| Threshold alerts | Cloud Monitoring `alertPolicies.create` (project-wide), or Tier 0/1 per §C | Varies |

---

## Summary of new additions

The taxonomy review surfaced two new skill modules and several explicit
mechanisms that weren't previously called out:

- **New skills**: Data Quality (§12), Discovery (§13), Enrichment (§14)
- **New mechanisms made explicit**: `PIVOT`/`UNPIVOT`, CTAS, re-partition/
  re-cluster pattern, copy jobs, `INFORMATION_SCHEMA.TABLE_STORAGE`, query
  plan via `jobs.get`, Sheets API export, Dataform-based saved queries,
  `AI.FORECAST`/`AI.DETECT_ANOMALIES`/`AI.GENERATE*` generative functions,
  Data Lineage API

A later pass added the **Primary artifact** column throughout (drawn from
each skill's UI-mapping table and the visualization mapping doc), corrected
two miscategorizations (pivot/unpivot, filter/segment, and string
operations are read-only Query reshapes, not destructive Data Management
operations), noted that "dry run/estimate" is infrastructure embedded in
other responses rather than a standalone task, and folded §12's alerting
tasks into the §C three-way routing split established during live testing.

Every taxonomy item now has a home in the catalog. The skill map table in
the capability catalog reflects all of the above.
