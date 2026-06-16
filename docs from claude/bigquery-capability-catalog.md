# BigQuery Capability Catalog

A full inventory of BigQuery (and adjacent Google Cloud) API capabilities,
organized by domain. Each section notes the relevant APIs/SQL surface and
which skill module in the harness it would live in. Use this as a checklist
when scoping skills so nothing falls through the cracks.

---

## 1. Query & joins (core SQL)

The workhorse layer — almost everything else builds on this.

- **Joins**: INNER, LEFT/RIGHT/FULL OUTER, CROSS, self-joins — all standard
  GoogleSQL, no special API needed
- **Set ops**: UNION ALL/DISTINCT, INTERSECT, EXCEPT
- **CTEs & subqueries**: `WITH` clauses, correlated subqueries
- **Window functions**: ranking, running totals, lead/lag
- **Pivot/unpivot**: `PIVOT`/`UNPIVOT` operators for reshaping rows ↔
  columns — no separate API, but easy to miss since it's less common SQL
- **Scripting**: multi-statement queries with `BEGIN...END`, `DECLARE`,
  `IF`/`LOOP`, session variables — useful for "do several things in one job"
- **Execution**: `jobs.query` (sync, ≤10s default), `jobs.insert` +
  `getQueryResults` (async, for long-running)
- **Cost check**: `dryRun: true` on either path returns
  `totalBytesProcessed` without executing

→ **Skill: Query** (your existing BigQuery skill template covers this)

---

## 2. Data modification & cleanup

This is the "cleanup" capability set — mutating or removing data/objects.

- **DML**: `INSERT`, `UPDATE`, `DELETE`, `MERGE` (upsert pattern)
- **DDL**: `CREATE/ALTER/DROP TABLE`, `VIEW`, `MATERIALIZED VIEW`, `SCHEMA`
  (dataset), `FUNCTION`, `PROCEDURE` — includes `CREATE TABLE ... AS SELECT`
  (CTAS), the standard way to "create a table from this query," and
  `ALTER TABLE ... ADD/DROP/RENAME COLUMN` / `ALTER COLUMN ... SET DATA TYPE`
  for schema edits on existing tables
- **Re-partitioning / re-clustering**: BigQuery can't change an existing
  table's partitioning in place — "partition this table" means a CTAS with
  `PARTITION BY`/`CLUSTER BY` into a new table (often followed by a rename/
  swap). Clustering *can* be altered in place via
  `ALTER TABLE ... SET OPTIONS (clustering_fields=...)`
- **Truncate**: `TRUNCATE TABLE` for fast full-table clears
- **Expiration (automated cleanup)**: table expiration, partition
  expiration — set via `tables.patch` / DDL options, no manual deletes needed
- **Time travel & restore**: query historical table state with
  `FOR SYSTEM_TIME AS OF`; restore deleted datasets via
  `datasets.undelete` (within the time-travel window)
- **Snapshots & clones**: `CREATE SNAPSHOT TABLE`, `CREATE TABLE ... CLONE`
  for point-in-time copies without duplicating storage
- **Copy jobs**: `jobs.insert` with a `copy` config — table-to-table copy,
  including cross-dataset/cross-project, for full-table duplication
  ("copy this table to staging")

→ **Skill: Data Management** — pair this with the dry-run cost check before
running any DELETE/MERGE at scale

---

## 3. Schema & metadata management

- **REST CRUD**: `datasets.{insert,get,patch,delete,list}`,
  `tables.{insert,get,patch,delete,list}`
- **Discovery via SQL**: `INFORMATION_SCHEMA.TABLES`, `.COLUMNS`,
  `.COLUMN_FIELD_PATHS` (for nested/repeated fields), `.TABLE_OPTIONS`
- **Routines**: `routines` resource + `CREATE FUNCTION` / `CREATE PROCEDURE`
  for reusable UDFs and stored procedures
- **Row-level security**: `rowAccessPolicies` resource — filter which rows
  a user/role can see on a shared table

→ **Skill: Schema** — this is what your "schema discovery" cache in the
Query skill should be backed by

---

## 4. Job management & monitoring

This is the "monitoring jobs" capability set.

- **Job lifecycle**: `jobs.insert` (start), `jobs.get` (status/result),
  `jobs.list` (history, 6-month retention), `jobs.cancel` (request stop —
  note cancelled jobs can still incur cost), `jobs.delete` (remove metadata)
- **INFORMATION_SCHEMA.JOBS** (and `JOBS_BY_PROJECT` /
  `JOBS_BY_USER` / `JOBS_BY_FOLDER` / `JOBS_BY_ORGANIZATION`): per-job
  summary — slot-ms, bytes processed, duration, errors, referenced tables
- **INFORMATION_SCHEMA.JOBS_TIMELINE**: time-sliced slot consumption for a
  running/completed job — good for "is this query healthy" views
- **Materialized view stats**: `materialized_view_statistics` field on a
  job, or via `INFORMATION_SCHEMA.MATERIALIZED_VIEWS` — was a query served
  from a materialized view or not, and why
- **Audit logs (Cloud Logging)**: admin activity (schema changes, job
  creation) and data access logs — "who did what, when"
- **Cloud Monitoring**: slot utilization metrics, dashboards, alerting
  policies (e.g., alert if available slots drop below threshold)
- **Query plan / optimization**: `jobs.get` returns
  `statistics.query.queryPlan` — per-stage timing, shuffle bytes, and
  records read/written. This is the basis for "why is this query slow" and
  "optimization suggestions" (e.g., flagging stages with high shuffle or
  large skew between parallel inputs)

→ **Skill: Monitoring** — natural home for "show me what's running",
"why was my query slow", "who changed this table"

---

## 5. Data loading & export

- **Load jobs**: `jobs.insert` with a `load` config — from Cloud Storage
  (CSV/JSON/Avro/Parquet/ORC) or via direct upload
- **Extract jobs**: `jobs.insert` with an `extract` config — export table
  data to Cloud Storage in the same formats
- **Streaming inserts**: legacy `tabledata.insertAll` — simple but quota-
  limited; superseded by the Storage Write API for serious throughput
- **BigQuery Data Transfer API**: scheduled, recurring transfers from SaaS
  sources (Google Ads, YouTube, Cloud Storage, etc.) *and* scheduled queries
  — useful for "refresh this dataset nightly" type automation
- **Export to Sheets**: not a BigQuery API call — use the Sheets API
  (`spreadsheets.values.update`/`append`) to write query result rows
  directly, or have the user open results via BigQuery's built-in "Open
  with Sheets" for larger sets
- **Saved queries**: now managed via the Dataform API (`bigquery.savedqueries.*`
  permissions, resources live under Dataform) rather than a dedicated
  BigQuery resource — "create a saved query" maps here, not to `jobs`

→ **Skill: Data Loading** — separate from Query since it's about getting
data in/out rather than analyzing what's there

---

## 6. High-throughput read/write (Storage API)

- **Storage Read API**: parallel, binary-serialized reads with column
  projection and filtering — for exporting large result sets to your own
  app/tools faster than paginated `jobs.getQueryResults`
- **Storage Write API**: high-throughput ingestion with at-least-once or
  exactly-once semantics, default streams or pending/batch commit modes —
  the modern replacement for streaming inserts

→ **Skill: Data Loading** (write side) / **Skill: Query** (read side, as an
optimization for big result sets)

---

## 7. External & federated data

- **External tables**: query data in place from Cloud Storage, Google
  Drive, or federated sources without loading it into BigQuery storage
- **BigQuery Connection API**: manage connections to Cloud SQL, Spanner,
  AWS S3/Redshift, Azure — enables federated queries across these via
  `EXTERNAL_QUERY`
- **Object tables**: structured references over unstructured files (images,
  PDFs, audio) in Cloud Storage — pairs with BQML/remote models for
  multimodal analysis

→ **Skill: Data Loading** or a dedicated **Skill: External Sources** if you
expect a lot of cross-source work

---

## 8. Performance & cost management

- **Partitioning & clustering**: reduce bytes scanned — set at table
  creation/DDL, surfaced in `TABLE_OPTIONS`
- **Materialized views**: auto-refreshing precomputed results; refresh cost
  monitored via the stats above
- **BI Engine**: in-memory acceleration reservations for dashboard-style
  queries
- **Reservation API**: manage slot commitments and assignments — relevant
  if your app runs on flat-rate capacity rather than on-demand
- **Storage analysis**: `INFORMATION_SCHEMA.TABLE_STORAGE` (and
  `TABLE_STORAGE_BY_PROJECT`/`_BY_ORGANIZATION`) — active vs. long-term
  storage bytes and billable bytes per table, the basis for "what's taking
  up space / costing the most to store"

→ **Skill: Monitoring** (read) / a separate **Skill: Capacity Admin** if
your app needs to *manage* reservations, not just report on them

---

## 9. ML & AI-native capabilities

Relevant given BQ Chat's AI-forward angle.

- **BigQuery ML**: `CREATE MODEL`, `ML.PREDICT`, `ML.EVALUATE` — train and
  serve models (regression, classification, forecasting, clustering) using
  SQL, no data movement
- **Forecasting**: `ARIMA_PLUS`/`ARIMA_PLUS_XREG` models via `CREATE MODEL`
  for trained time-series forecasts, or `AI.FORECAST` for a zero-training
  forecast using the built-in TimesFM model — covers "forecast next
  quarter's X" without a model-management step
- **Anomaly detection**: `ML.DETECT_ANOMALIES` against a trained model
  (autoencoder/PCA/k-means/ARIMA_PLUS), or `AI.DETECT_ANOMALIES` for a
  zero-training option using TimesFM against historical vs. target data —
  both return an `is_anomaly` flag per row
- **Generative SQL functions**: `AI.GENERATE`, `AI.GENERATE_BOOL`,
  `AI.GENERATE_DOUBLE` (Gemini-backed) for inline sentiment scoring, text
  classification, and free-form analysis directly in a query —
  `ML.GENERATE_TEXT`/`ML.GENERATE_EMBEDDING` remain available for
  longer-form generation and embeddings
- **Vector search**: `CREATE VECTOR INDEX`, `VECTOR_SEARCH` — semantic
  search over embeddings stored in BigQuery
- **Remote functions**: `CREATE FUNCTION ... REMOTE` calling Vertex AI (or
  Cloud Translation/other APIs, see §14) directly from SQL

Note: Google's own **Conversational Analytics** (BigQuery Data Agents,
Gemini-powered) overlaps significantly with BQ Chat's goals — same
reasoning → SQL → visualize → summarize loop, grounded in your schema and
"golden queries." Worth a periodic look as a point of comparison/inspiration
rather than a dependency.

→ **Skill: ML/Analytics** — likely a later addition, but worth reserving
the slot since it changes the result schema (model objects, not just rows)

---

## 10. Security & governance

- **IAM**: project/dataset/table-level roles
- **Authorized views/routines**: share query results without granting
  underlying table access
- **Row-level security**: `rowAccessPolicies` (see §3)
- **Column-level security**: policy tags (via Data Catalog/Dataplex) to
  restrict sensitive columns
- **CMEK**: customer-managed encryption keys for data at rest

→ Mostly **configuration**, not something the chat app actively calls per
turn — but worth a read-only "what can this user see" check if multiple
users share the app

---

## 11. Additional Google Cloud APIs (adjacent services)

These aren't part of the core BigQuery API but show up as soon as you build
out Monitoring, Data Loading, or Governance — worth scoping now so they
don't get bolted on later.

- **Cloud Logging API** (`logging.googleapis.com`, `entries.list`) — the
  actual mechanism behind "audit logs" in §4/§10. Needed for any "who did
  X" question. Filter by `protoPayload.serviceName="bigquery.googleapis.com"`
  (and `bigqueryconnection`, `bigqueryreservation`,
  `bigquerydatatransfer.googleapis.com`, `analyticshub.googleapis.com`,
  `bigquerydatapolicy.googleapis.com` for the adjacent services below)

- **Cloud Monitoring API v3** (`monitoring.googleapis.com`) —
  `projects.timeSeries.list` for metrics (slot utilization, query counts,
  errors), `projects.alertPolicies.{list,create,patch}` for programmatic
  alerting. Metrics for a query can take ~7 minutes to appear and **don't
  cover failed queries** — pair with INFORMATION_SCHEMA for that gap

- **Cloud Storage API** (`storage.googleapis.com`) — load jobs (§5) read
  from GCS URIs and extract jobs write to them; if your app lets users pick
  a file to load or browse exported results, you'll need
  `buckets.list`/`objects.list`/`objects.get` here too. This is the missing
  piece for a full Data Loading skill

- **Analytics Hub API** (`analyticshub.googleapis.com`) — data exchange and
  sharing: publish a dataset as a "listing" others can subscribe to without
  copying data. Relevant if BQ Chat ever needs to share curated datasets
  across users/orgs — likely its own **Data Sharing** skill if/when needed

- **BigQuery Data Policy API** (`bigquerydatapolicy.googleapis.com`) —
  column-level security via policy tags (data masking). Ties into the
  Schema skill (§3) for governance-aware metadata, but is a distinct API
  surface for creating/assigning the policies themselves

- **BigLake / Metastore API** (`biglake.googleapis.com`) — manages catalogs
  for open table formats (Iceberg, etc.) sitting on object storage. Lower
  priority unless BQ Chat needs to read lakehouse tables outside native BQ
  storage — flag as a future **External Sources** consideration alongside
  the Connection API (§7)

- **Vertex AI API** — backs the remote-model functions in §9
  (`ML.GENERATE_TEXT`, `ML.GENERATE_EMBEDDING`). If the ML/Analytics skill
  calls these, it's indirectly a Vertex AI dependency even though the SQL
  surface is all BigQuery

---

## 12. Data profiling & quality

No single "profiling API" — this is a pattern built from SQL + metadata
calls, but it's a distinct enough workflow (and result shape) to warrant
its own skill.

- **Distributions & cardinality**: `APPROX_COUNT_DISTINCT`,
  `APPROX_QUANTILES`, `MIN`/`MAX`/`AVG`/`STDDEV` per column — the basis for
  "profile this table"
- **Null analysis / completeness**: `COUNTIF(col IS NULL)` per column,
  often generated dynamically from `INFORMATION_SCHEMA.COLUMNS` so you
  don't have to hand-write one expression per column
- **Duplicate detection**: `SELECT key_cols, COUNT(*) FROM t GROUP BY
  key_cols HAVING COUNT(*) > 1`
- **Referential integrity**: BigQuery doesn't enforce foreign keys, so this
  is a `LEFT JOIN ... WHERE right.key IS NULL` check between tables —
  surfaced as an orphan-row count
- **Value range / type validation**: range checks via `WHERE`, type checks
  via `INFORMATION_SCHEMA.COLUMNS` vs. expected schema
- **Freshness**: `tables.get` (`lastModifiedTime`) or
  `INFORMATION_SCHEMA.PARTITIONS` for partition-level last-modified —
  "is this table stale"
- **Schema drift**: comparing `INFORMATION_SCHEMA.COLUMNS` snapshots over
  time (you'll need to persist prior snapshots somewhere — e.g. a small
  metadata table the app maintains) or watching schema-change events via
  the Data Lineage API (§13)
- **Managed option**: Dataplex **Data Quality scans** (`dataScans` resource)
  can run rule-based quality checks on a schedule if you want this
  managed rather than ad-hoc — worth evaluating once profiling needs grow
  beyond one-off checks

→ **Skill: Data Quality** — distinct from Query because results are
*about* the data (health/quality metrics) rather than the data itself, and
distinct from Monitoring because it's about data state, not job/system state

---

## 13. Lineage & discovery

- **Search**: `INFORMATION_SCHEMA` covers basic table/column search within
  a project; **Knowledge Catalog** (formerly Dataplex Universal Catalog)
  search covers cross-project/organization discovery with richer metadata
- **Lineage**: the **Data Lineage API** (part of Knowledge Catalog)
  automatically captures lineage for BigQuery query, copy, and load jobs —
  modeled as processes/runs/events. Query it to answer "where did this
  table's data come from" or "what depends on this table" and to render
  lineage graphs
- **Table comparison**: no dedicated API — built from `INFORMATION_SCHEMA.
  COLUMNS` (schema diff) plus row-count and aggregate comparisons (a Query
  skill task using two table references)

→ **Skill: Discovery** — could absorb the "browse/search" parts of Schema
(§3) plus lineage and table-comparison, since all three are about
*understanding what exists and how it relates* rather than modifying or
querying it for analysis

---

## 14. Data enrichment (external AI/geo APIs)

- **Translation**: Cloud Translation API (`translate.googleapis.com`) for
  translating text columns — can be called row-by-row from the app, or
  wrapped as a `CREATE FUNCTION ... REMOTE` so it's callable from SQL
- **Geocoding**: Geocoding API (Google Maps Platform) for address → lat/lng
  — feeds the map visualizations in §15 (dot map, choropleth). Same remote-
  function pattern applies for batch use from SQL
- **In-SQL alternative**: for simple cases, `AI.GENERATE`/`AI.GENERATE_BOOL`
  (§9) can do translation or classification inline without a separate API,
  trading precision/cost for fewer moving parts — useful default until a
  dedicated API is justified
- **Calculated fields, date/time parsing, regex extraction**: all native
  GoogleSQL (`PARSE_DATE`, `REGEXP_EXTRACT`, generated columns) — no
  external API needed, lives in the Query skill

→ **Skill: Enrichment** — the two external APIs (Translation, Geocoding)
are the only genuinely new dependencies; everything else here is Query

---

## 15. Visualization & reporting

This is less about new APIs and more about the **Composer/Renderer**
mapping from result shape → chart type. BigQuery-side enablers worth
noting:

- **Geospatial**: BigQuery GIS functions (`ST_GEOGPOINT`, `ST_DISTANCE`,
  `GEOGRAPHY` type) — required for any map visualization (dot map,
  choropleth, USA/world map) once you have lat/lng or region data
- **Time series for sparklines**: `ARRAY_AGG(value ORDER BY date)` produces
  the compact array a sparkline component needs in one query
- **Hierarchical aggregates for treemap/sankey/network**: typically a
  `GROUP BY` at multiple levels or a self-referencing edge list — standard
  SQL, but the *shape* (nodes/edges vs. flat rows) needs explicit handling
  in the Composer step

Given the breadth of chart types in the task list (20+), this likely
warrants its own reference doc mapping result shapes to components rather
than living inside each skill's "UI mapping heuristics" table — see the
companion visualization mapping doc.

→ **Cross-cutting** — every skill's UI mapping step draws from this; not a
standalone skill itself

---

## Skill map summary

| Skill module | Capability sections | Primary APIs |
|---|---|---|
| Query | §1, §12 (read-only checks), §14 (native SQL enrichment), partially §6 (read) | BigQuery (jobs, Storage Read) |
| Data Management (cleanup) | §2 | BigQuery (jobs, datasets, tables) |
| Schema | §3 | BigQuery (datasets, tables, routines) |
| Discovery | §13, search portion of §3 | BigQuery (INFORMATION_SCHEMA) + Knowledge Catalog + Data Lineage API |
| Data Quality | §12 | BigQuery (SQL + INFORMATION_SCHEMA) + optional Dataplex Data Quality scans |
| Monitoring | §4, §8 (read) | BigQuery (jobs, INFORMATION_SCHEMA) + Cloud Logging + Cloud Monitoring |
| Data Loading | §5, §6 (write), §7 | BigQuery (jobs, Data Transfer, Connection, Storage Write, Dataform/saved queries) + Cloud Storage + Sheets |
| Enrichment | §14 (external APIs) | Cloud Translation + Geocoding (Maps Platform) |
| ML/Analytics | §9 | BigQuery ML + Vertex AI (remote models) |
| Capacity Admin (optional) | §8 (manage) | BigQuery Reservation |
| Data Sharing (optional, future) | §11 | Analytics Hub |
| Governance (optional, future) | §10, §11 | BigQuery Data Policy |

Visualization (§15) is cross-cutting — every skill's UI mapping step draws
from it rather than owning it.

Each of these can follow the same template shape as the Query skill: trigger
conditions, API calls, workflow steps, normalized result shape, UI mapping,
and follow-up hooks — just with domain-appropriate results (e.g., Monitoring
results map to status/health cards rather than charts; Data Management
results map to confirmation dialogs rather than visualizations).
