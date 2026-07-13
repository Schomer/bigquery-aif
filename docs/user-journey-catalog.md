# BigQuery AIF — User Journey Catalog

*Synthesized from parallel research across 5 domains: Ingestion, Transformation, Quality/Governance, Analytics/ML, Monitoring/Ops.*
*Each workflow type includes 3–5 journey variations with persona, goal, app interaction, output, and completion state.*

---

## How to Use This Document

Each entry follows this structure:
- **Persona & Context** — who is doing this and why
- **Goal** — what they're trying to accomplish
- **Typical approach** — how they'd do it manually (console, code, other tools)
- **Natural language trigger** — example prompts that route to this workflow
- **App behavior** — which skill handles it, what happens internally
- **App output** — what UI, data, and confirmation the user sees
- **Completion state** — how they know it worked, what happens next

---

# DOMAIN 1: DATA INGESTION & LOADING

## 1.1 Batch Load from GCS

### Journey A — Data Engineer: Historical Backfill
**Persona:** Backend data engineer migrating 3 years of order history from S3 (already moved to GCS) into a partitioned BigQuery table.

**Typical approach:** `bq load` CLI with `--source_format=PARQUET --destination_table=project:dataset.orders --time_partitioning_field=order_date` across multiple date-ranged files in a loop.

**Natural language trigger:**
> "Load all the Parquet files in gs://my-bucket/orders/2021-2023/ into dataset.orders, partitioned by order_date"

**App behavior:** Routes to `handle-task` (task framework). Resolves to a `CREATE EXTERNAL TABLE` + `INSERT INTO ... SELECT` plan with partition column injection. Generates a dry-run cost estimate before executing.

**App output:**
- Confirmation card: "This will load ~14M rows from 36 Parquet files into `dataset.orders` partitioned by order_date. Estimated cost: $0.00 (load jobs are free). Proceed?"
- Progress steps: "Scanning source files → Creating load job → Monitoring completion → Verifying row counts"
- Success card: row count, bytes loaded, partition distribution (min/max date), time taken

**Completion state:** Table visible in schema explorer with row count. Next-action chips: "Preview the loaded data", "Check for null order_dates", "Profile the orders table"

---

### Journey B — Business Analyst: Vendor CSV Drop
**Persona:** Marketing analyst who received a CSV file from a media vendor with campaign spend data. Needs it in BigQuery to join with their conversion data.

**Typical approach:** Console UI → Create table → Upload → click through schema auto-detect → pray the types are right → find out `spend` was detected as STRING not FLOAT.

**Natural language trigger:**
> "I have a CSV from our media vendor — how do I get it into BigQuery?"

**App behavior:** Routes to `handle-task`. Since this requires a local file upload (not GCS), the app explains the path: upload to GCS first, then load. Generates the GCS upload command and the subsequent `LOAD DATA` SQL statement. Alternatively walks through the console steps.

**App output:**
- Briefing: "CSVs need to go through GCS before BigQuery can read them. Here's the two-step process:"
- Step 1 card: `gsutil cp spend_data.csv gs://your-bucket/imports/spend_data.csv`
- Step 2 card: `LOAD DATA INTO dataset.vendor_spend FROM FILES (format='CSV', uris=['gs://...'], skip_leading_rows=1)` with auto-detect schema
- Warning: "If the `spend` column comes back as STRING, add `CAST(spend AS FLOAT64)` in a follow-up query."

**Completion state:** SQL ready to run. Chips: "Run this query", "Show me the schema after loading", "Join this with my conversions table"

---

### Journey C — DevOps Engineer: Automated Daily File Loads
**Persona:** Platform engineer setting up a daily pipeline — an app exports JSON to GCS every night at 2am, and it needs to land in BigQuery by 6am.

**Typical approach:** Cloud Scheduler → Cloud Functions → `bq load` call, or a Dataflow template job triggered by GCS pub/sub notification.

**Natural language trigger:**
> "Set up a scheduled query to load yesterday's app export from gs://app-exports/events/ into dataset.events every day at 3am"

**App behavior:** Routes to `handle-pipeline` (schedule creation). Generates a `LOAD DATA OVERWRITE TABLE ... FROM FILES(uris=['gs://app-exports/events/${RUN_DATE}/*.json'])` scheduled query with Data Transfer Service.

**App output:**
- Pipeline creation confirmation: "This will create a scheduled query that runs daily at 3:00 AM UTC. It will load JSON files from `gs://app-exports/events/{date}/` into `dataset.events` (OVERWRITE). Estimated cost per run: $0.00. Proceed?"
- After confirm: success card with the scheduled transfer config ID, next run time, and a link to the Data Transfer console

**Completion state:** Schedule active. Chips: "Show me the schedule I just created", "Simulate a run for yesterday's date", "Set up failure email alerts"

---

### Journey D — Data Steward: Schema Validation Before Load
**Persona:** Data steward who gets a weekly file from a partner and needs to validate its schema matches the BigQuery destination before loading (to avoid silent schema drift).

**Typical approach:** Manually download the file, open it, compare columns against `INFORMATION_SCHEMA.COLUMNS`, create a checklist.

**Natural language trigger:**
> "Before I load this week's partner file, can you compare the columns in gs://partner-bucket/weekly.csv to what's expected in dataset.partner_data?"

**App behavior:** Routes to `handle-discovery` (COMPARISON type). Fetches the destination table's schema from INFORMATION_SCHEMA, then reads the GCS file headers via a `SELECT * FROM EXTERNAL_QUERY(...)` dry-run with LIMIT 0. Diffs the column names and types.

**App output:**
- Schema comparison table with columns: Name | Source Type | Destination Type | Status (Match / New / Missing / Type Changed)
- Highlighted mismatches in red badges
- Summary: "3 columns match, 1 is new (`discount_pct` — not in destination), 1 type changed (`order_amount`: source is STRING, destination is FLOAT64)"

**Completion state:** Analyst decides whether to proceed (add column) or investigate. Chips: "Add the new column to destination table", "Cast order_amount to FLOAT64 in a transform query", "Proceed with load anyway (ignore extra columns)"

---

## 1.2 BigQuery Data Transfer Service (SaaS Sources)

### Journey A — Analytics Engineer: GA4 Daily Export Setup
**Persona:** Analytics engineer setting up the canonical Google Analytics 4 → BigQuery export for the first time for a new property.

**Typical approach:** BigQuery console → Data transfers → + Create → select GA4 → enter property ID → configure destination dataset.

**Natural language trigger:**
> "Set up a daily GA4 export for property 123456789 into my analytics dataset"

**App behavior:** Routes to `handle-pipeline`. Creates a Data Transfer Service config via the BigQuery Data Transfer API with source type `google_analytics_4`.

**App output:**
- Confirmation card: "This will create a daily transfer from GA4 Property 123456789 to `project.analytics`. GA4 will export event, session, and user data daily. Runs automatically after each day's data is finalized (usually by 9AM). Proceed?"
- Success: transfer config ID, first run scheduled time, note about the ~24-hour lag inherent to GA4 exports

**Completion state:** Tables like `events_20240115` will appear in the analytics dataset the next day. Chips: "Show me what tables the GA4 export creates", "Query yesterday's GA4 events"

---

### Journey B — Marketing Analyst: Google Ads Data Pull
**Persona:** Performance marketer who wants to pull Google Ads campaign performance into BigQuery for custom attribution modeling.

**Typical approach:** Console → Data transfers → Google Ads → enter customer ID → select reports.

**Natural language trigger:**
> "Can you set up an automatic Google Ads transfer for customer ID 123-456-7890 into the marketing dataset?"

**App behavior:** Routes to `handle-pipeline`. Creates DTS config with source `google_ads`, customer ID normalized (hyphens stripped to `1234567890`).

**App output:**
- Confirmation card listing the standard Ads report tables that will be created (Ad, AdGroup, Campaign, AdConversionAction, etc.), with a note that historical data will be backfilled for the last 28 days on first run.
- After confirm: success card with next run time and link to transfer history

**Completion state:** Ads tables available in marketing dataset. Chips: "Show me what Google Ads tables were created", "Query campaign performance this month", "Join ads data with my conversions"

---

### Journey C — Data Engineer: Amazon S3 Cross-Cloud Migration
**Persona:** Data engineer migrating a legacy analytics data lake from AWS S3 to Google Cloud, starting with the historical events dataset.

**Typical approach:** DTS → Data transfers → Amazon S3 → enter access key, secret, S3 URI, file format.

**Natural language trigger:**
> "I need to transfer Parquet files from s3://legacy-datalake/events/ to BigQuery. The files are partitioned by year and month."

**App behavior:** Routes to `handle-task`. Explains the S3 transfer requires credentials — walks through the DTS S3 connector configuration, noting the access key/secret requirement. Generates the configuration but doesn't submit (credentials must be provided in-console for security). Alternatively surfaces the LOAD DATA approach via BigQuery Omni.

**App output:**
- Step-by-step card: "To transfer from S3, you'll need: (1) AWS Access Key ID, (2) AWS Secret Access Key with s3:GetObject and s3:ListBucket permissions. Here's the DTS configuration to use..."
- Code card with the full `bq mk --transfer_config` CLI command pre-filled with all known parameters
- Security note: "Do not share your AWS credentials in this chat — enter them directly in the console using the link below."

**Completion state:** User completes setup in console. Chips: "Show me the status of my S3 transfer", "What tables will be created?", "Verify the first transfer run"

---

## 1.3 Streaming Ingestion

### Journey A — Backend Engineer: App Event Streaming Validation
**Persona:** Engineer who just deployed Storage Write API integration for their mobile app and wants to verify events are landing correctly.

**Typical approach:** `SELECT COUNT(*), MAX(event_timestamp) FROM dataset.app_events WHERE DATE(event_timestamp) = CURRENT_DATE()` every few minutes, cross-referencing with app-side logs.

**Natural language trigger:**
> "Are events landing in dataset.app_events? How many in the last hour?"

**App behavior:** Routes to `handle-query`. Generates a time-windowed COUNT query with freshness metadata. Also checks the last_modified_time via INFORMATION_SCHEMA.

**App output:**
- KPI card: "12,847 events in the last hour" with a time series chart showing events per 5-minute window
- Freshness badge: "Last row: 23 seconds ago"
- Note if event rate looks unusual vs. prior hour (quality flag)

**Completion state:** Engineer confirms streaming is healthy. Chips: "Show me event types distribution", "Check for any null user_ids in the last hour", "Set up an alert if events stop arriving"

---

### Journey B — Data Engineer: Streaming Deduplication Check
**Persona:** Engineer who recently migrated from legacy `insertAll` to Storage Write API and suspects there are duplicates in the transition window.

**Typical approach:** Complex window query across the streaming buffer transition period.

**Natural language trigger:**
> "Check for duplicate event_ids in dataset.app_events from the last 48 hours"

**App behavior:** Routes to `handle-data-quality` (DUPLICATES check type). Generates a deduplication query partitioned by event_id with a 48-hour window filter.

**App output:**
- Duplicates summary: "Found 1,247 duplicate event_ids across 623 groups. Most duplicates (92%) cluster in the 2024-01-15 14:00–16:00 UTC window — consistent with a migration transition."
- Table showing top duplicate groups with counts
- Recommendation: "The duplication pattern suggests a transition artifact, not an ongoing issue. Consider deduplicating the 48-hour window with a `CREATE OR REPLACE TABLE ... AS SELECT DISTINCT ...` operation."

**Completion state:** Engineer confirms issue scope. Chips: "Deduplicate those events", "Show me the exact time window of duplicates", "Is the deduplication still happening now?"

---

## 1.4 Federated Queries & External Tables

### Journey A — Analyst: Query a Google Sheet Without Loading It
**Persona:** Financial analyst whose team tracks budget allocations in a Google Sheet. Wants to join that data with actuals from BigQuery without exporting CSVs.

**Typical approach:** Create an external table via console → Google Drive → paste URL → manually define schema.

**Natural language trigger:**
> "Can I query the budget spreadsheet at docs.google.com/spreadsheets/d/1abc... alongside my actuals table?"

**App behavior:** Routes to `handle-task`. Explains the external table creation process, generates the DDL with the Sheet URL, and notes the one-time OAuth consent requirement.

**App output:**
- DDL card:
  ```sql
  CREATE EXTERNAL TABLE dataset.budget_sheet
  OPTIONS (
    format = 'GOOGLE_SHEETS',
    uris = ['https://docs.google.com/spreadsheets/d/1abc.../edit'],
    skip_leading_rows = 1
  );
  ```
- After creation: sample query joining the external table with the actuals table
- Warning: "Sheets external tables are slower than native tables and require Drive access. For repeated queries, consider loading the data instead."

**Completion state:** External table created. Sample JOIN query ready to run. Chips: "Run the join query", "Load this sheet into a native table", "Set this up to refresh daily"

---

### Journey B — Engineer: Live Query of Cloud SQL Production Data
**Persona:** Engineer who wants to join BigQuery analytics data with live operational data from Cloud SQL (PostgreSQL) for a real-time dashboard.

**Typical approach:** Set up a BigQuery connection resource for Cloud SQL, then use `EXTERNAL_QUERY()`.

**Natural language trigger:**
> "Can I query the live orders table from our Cloud SQL database and join it with our BigQuery customer data?"

**App behavior:** Routes to `handle-task`. Checks for existing BigQuery connections via the Connection API. If none found, walks through setup. Generates an `EXTERNAL_QUERY()` join template.

**App output:**
- If no connection exists: step-by-step card "First, create a BigQuery connection to your Cloud SQL instance..." with Console link and CLI command
- If connection exists: query template card with `EXTERNAL_QUERY()` pattern pre-filled, cost note ("Only the query result is transferred — avoid full table scans inside EXTERNAL_QUERY")

**Completion state:** Query ready. Chips: "Run this join", "Show me what connections are available", "How do I make this faster?"

---

# DOMAIN 2: DATA TRANSFORMATION & SQL

## 2.1 Interactive Ad-Hoc Queries

### Journey A — Business Analyst: First Exploration of a New Dataset
**Persona:** Analyst who just got access to a new dataset from the data engineering team and doesn't know what's in it.

**Typical approach:** `INFORMATION_SCHEMA.TABLES`, `INFORMATION_SCHEMA.COLUMNS`, `SELECT * FROM table LIMIT 10`, count nulls manually.

**Natural language trigger:**
> "What's in the sales_data dataset? Show me what tables there are."

**App behavior:** Routes to `handle-schema` (DATASET scope). Fetches tables via REST API, enriches with row counts and last-modified times from TABLE_STORAGE.

**App output:**
- Schema view: table list with row counts, sizes, last modified dates
- Highlight for the largest/most recently updated table
- Suggested entry points based on table names

**Natural language follow-up:**
> "Describe the orders table and show me a sample"

**App behavior:** Routes to `handle-schema` (TABLE scope), then generates and runs a `SELECT * FROM orders LIMIT 10` query.

**App output:**
- Full schema card: column name, type, nullable, description
- Partitioning/clustering info highlighted if present
- Sample rows in DataTable component
- Cost badge: "Scanned 2.4 MB"

**Completion state:** Analyst understands the table. Chips: "How many null order_ids are there?", "What's the date range of this data?", "Show me revenue by month"

---

### Journey B — Data Analyst: Time Series Trend Analysis
**Persona:** Analyst presenting weekly revenue trends to leadership and needs a chart they can put in a slide deck.

**Typical approach:** Write a `DATE_TRUNC(... MONTH)` + `SUM()` query, export to Sheets, build a chart.

**Natural language trigger:**
> "Show me monthly revenue for the last 12 months from the orders table"

**App behavior:** Routes to `handle-query`. Generates a time-series aggregation query with `DATE_TRUNC(order_date, MONTH)`, applies partition filter (if partitioned), runs dry-run, executes. Selects `LINE_CHART` visualization.

**App output:**
- Line chart: monthly revenue with trend line
- Notable findings: "Revenue grew 23% YoY. August shows a 15% dip — check for seasonal patterns or data gaps."
- DataTable below the chart with exact figures
- Cost badge + rows scanned

**Completion state:** Chart ready. Chips: "Break this down by region", "Compare to prior year", "Export this to Sheets"

---

### Journey C — Senior Analyst: Complex Multi-Table Analysis with CTEs
**Persona:** Senior analyst building a customer lifetime value calculation across three tables.

**Typical approach:** Write a complex CTE-based query with multiple joins, debug stage by stage.

**Natural language trigger:**
> "Calculate 12-month customer LTV: total revenue per customer from orders, minus returns from returns table, grouped by customer segment from the customers table"

**App behavior:** Routes to `handle-query`. Generates a CTE-based query: customers CTE → orders aggregation → returns aggregation → final join and calculation. Dry-runs first, shows cost estimate.

**App output:**
- Generated SQL shown in SQL panel (expandable)
- Result table: customer_segment | avg_ltv | total_customers | median_ltv
- Bar chart: LTV by segment
- Provenance panel: shows the full SQL, bytes scanned, slot time

**Completion state:** LTV figures ready. Chips: "Save this query", "Show me the distribution within each segment", "Which customers have the highest LTV?"

---

### Journey D — Analyst: Debugging a Slow or Expensive Query
**Persona:** Analyst whose weekly report query takes 45 minutes and the team is complaining about costs.

**Typical approach:** Check query plan in BigQuery console, look for full table scans, add partition filters.

**Natural language trigger:**
> "My orders query is scanning too much data. Can you help me optimize it?"

**App behavior:** Routes to `handle-monitoring` (QUERY_PLAN sub-type) or `handle-query` with optimization focus. Inspects the provided SQL (or last-run job), checks for missing partition filters, missing clustering utilization, `SELECT *` patterns.

**App output:**
- Analysis card: "Your query scans 2.1 TB per run. Issues found:
  1. No partition filter on `order_date` (partitioned table scanning all time)
  2. `SELECT *` includes 42 columns; only 6 are used downstream
  3. The subquery on `customers` runs before filtering — move the WHERE clause inside the CTE"
- Optimized SQL suggestion with estimated savings: "With these changes, estimated scan drops to 8.4 GB (99.6% reduction)"
- Before/after cost comparison

**Completion state:** Optimized query ready to test. Chips: "Run the optimized version", "Compare actual vs estimated cost", "Save the optimized query"

---

## 2.2 DML: Data Modification

### Journey A — Data Engineer: Bulk Status Update After Vendor Error
**Persona:** Data engineer who got a file from a vendor with 10,000 orders that were incorrectly marked as "cancelled" instead of "pending".

**Typical approach:** `UPDATE orders SET status = 'pending' WHERE order_id IN (SELECT order_id FROM vendor_corrections)` — but needs to check partition coverage first.

**Natural language trigger:**
> "Update the status to 'pending' for all order_ids in the corrections table where status = 'cancelled'"

**App behavior:** Routes to `handle-data-management`. Generates an UPDATE with a partition predicate. Shows a preview: `SELECT COUNT(*) ... WHERE status = 'cancelled' AND order_id IN (SELECT order_id FROM corrections)` first.

**App output:**
- Preview confirmation card: "This UPDATE will affect 10,247 rows in `dataset.orders`. The rows are spread across partitions 2024-01-01 to 2024-01-14. SQL shown below. Proceed?"
- Warning if no partition filter detected: "This UPDATE scans the full table (estimated 450 GB). Consider adding a date range filter to reduce cost."

**Completion state:** After confirm → job runs → success card with rows affected count. Chips: "Verify the update worked", "Show me a sample of the updated rows", "Check if there are other cancelled orders in that window"

---

### Journey B — Analyst: Correct a Bad Batch Load
**Persona:** Analyst who loaded a CSV but realizes a column was mapped wrong — `revenue` and `cost` columns are swapped.

**Typical approach:** Either delete and reload, or UPDATE to swap values.

**Natural language trigger:**
> "The revenue and cost columns got swapped in dataset.daily_sales for January. Can you fix it?"

**App behavior:** Routes to `handle-data-management`. Generates an UPDATE using a temp variable pattern:
```sql
UPDATE dataset.daily_sales
SET revenue = cost, cost = revenue
WHERE DATE(sale_date) BETWEEN '2024-01-01' AND '2024-01-31'
```
Shows preview before execution.

**App output:**
- Confirmation card with the corrective UPDATE, row count preview (31 partition-days affected), cost estimate
- Warning: "This modifies 31 partitions. Consider creating a table snapshot first."

**Completion state:** Swap executed. Chips: "Verify the fix — show me a sample row", "Create a snapshot before future loads", "Add a data quality check for this"

---

### Journey C — Data Engineer: MERGE Upsert for Incremental Load
**Persona:** Engineer building a daily incremental ETL: new and updated records from a staging table need to be merged into the production orders table.

**Typical approach:** Write a MERGE statement with `WHEN MATCHED THEN UPDATE ... WHEN NOT MATCHED THEN INSERT`.

**Natural language trigger:**
> "Merge today's data from dataset.orders_staging into dataset.orders — update existing rows and insert new ones"

**App behavior:** Routes to `handle-data-management`. Generates a MERGE with partition predicate on both target and source (today's date), shows preview of match counts.

**App output:**
- MERGE SQL in confirmation card with explicit partition predicate
- Preview: "Dry run: source has 15,234 rows for today. Estimated: ~12,000 updates + ~3,234 inserts. Confirmed match key: order_id"
- Note: "A static partition predicate on `DATE(T.order_date) = '2024-01-15'` has been added to prevent full-table scan."

**Completion state:** After confirm → MERGE executes → success card with rows inserted/updated counts. Chips: "Verify row counts match staging", "Schedule this merge to run daily", "Check for any rows that failed to merge"

---

### Journey D — Analyst: Delete Expired/Old Records
**Persona:** Data steward deleting records older than 3 years per the data retention policy.

**Typical approach:** `DELETE FROM dataset.events WHERE DATE(event_timestamp) < DATE_SUB(CURRENT_DATE(), INTERVAL 3 YEAR)` — expensive if table is large and not partitioned.

**Natural language trigger:**
> "Delete all events older than 3 years from dataset.events to comply with our retention policy"

**App behavior:** Routes to `handle-data-management`. Checks if table is partitioned. If yes, generates a partition-scoped DELETE. If not, warns about full-table scan cost and suggests setting `partition_expiration_days` instead.

**App output:**
- If partitioned: confirmation card "This will DELETE rows in 1,095 partitions (2021-01-01 and earlier). Estimated rows: ~2.3B. This is a large operation — consider running in batches by month."
- If unpartitioned: "Warning: this table is not partitioned. Deleting 3 years of data requires a full-table scan (est. 8.4 TB). Consider CTAS with a WHERE clause filter instead."

**Completion state:** Operation confirmed/adjusted. Chips: "Run this in monthly batches instead", "Show me how much data I'm about to delete", "Set up automatic partition expiration going forward"

---

## 2.3 DDL: Schema Management

### Journey A — Engineer: Create a New Partitioned Table
**Persona:** Engineer designing a new events table for a product launch.

**Natural language trigger:**
> "Create a new table called product_events in the analytics dataset, partitioned by day on event_timestamp, with fields: event_id (STRING), user_id (INT64), event_type (STRING), event_timestamp (TIMESTAMP), properties (JSON)"

**App behavior:** Routes to `handle-data-management`. Generates CREATE TABLE DDL with partitioning, clustering suggestions (event_type is a good cluster column), and `require_partition_filter = true`.

**App output:**
- DDL confirmation card:
  ```sql
  CREATE TABLE analytics.product_events (
    event_id STRING NOT NULL,
    user_id INT64,
    event_type STRING,
    event_timestamp TIMESTAMP,
    properties JSON
  )
  PARTITION BY DATE(event_timestamp)
  CLUSTER BY event_type, user_id
  OPTIONS (require_partition_filter = true);
  ```
- Note: "Clustering by event_type and user_id added — these are typically the most common filter columns for event data."

**Completion state:** Table created. Chips: "Describe the table I just created", "Add more columns", "Create a view over this table"

---

### Journey B — Engineer: Clone Table for Dev/Test
**Persona:** Engineer who needs a copy of the production orders table to test a schema migration without touching production.

**Natural language trigger:**
> "Clone the production orders table into a dev dataset for testing"

**App behavior:** Routes to `handle-data-management`. Generates `CREATE TABLE dev.orders_dev CLONE prod.orders`. Notes that CLONE is copy-on-write (storage-efficient).

**App output:**
- Confirmation card: "This creates an instant copy-on-write clone. Storage charged only for data that diverges. Recommended: set a 7-day expiration."
- After confirm: success + note about expiration. Chips: "Set an expiration on this clone", "Describe the cloned table", "Run my test queries against dev.orders_dev"

---

### Journey C — Engineer: Add Column to Existing Table
**Persona:** Engineer adding a new `discount_code` field to the orders table as part of a product feature launch.

**Natural language trigger:**
> "Add a nullable STRING column called discount_code to dataset.orders"

**App behavior:** Routes to `handle-data-management`. Generates `ALTER TABLE dataset.orders ADD COLUMN discount_code STRING`. Notes backward compatibility.

**App output:**
- Confirmation: "ALTER TABLE will add `discount_code STRING` (nullable). Existing rows will have NULL for this column. No data is modified. Proceed?"
- After confirm: success. Chips: "Verify the column was added", "Back-fill discount_code from another source", "Update the table description"

---

## 2.4 Views and Materialized Views

### Journey A — Analyst: Create a Reusable Business Logic View
**Persona:** Analyst who writes the same complex joins every week — joins orders with customers and products — and wants to stop repeating themselves.

**Natural language trigger:**
> "Create a view called orders_enriched that joins orders with customers and products, showing order_id, customer_name, product_name, order_date, and total_amount"

**App behavior:** Routes to `handle-data-management`. Generates `CREATE OR REPLACE VIEW` SQL with the described JOIN logic.

**App output:**
- DDL confirmation card with the generated view SQL
- Note: "Views don't store data — this query runs fresh every time the view is queried. For better performance on large tables, consider a materialized view instead."

**Completion state:** View created. Chips: "Query this view", "Create a materialized version for faster queries", "Share this view with my team"

---

### Journey B — Engineer: Create Materialized View for Dashboard
**Persona:** Engineer optimizing a Looker Studio dashboard that queries a large orders table every 5 seconds. Dashboard queries are slow and expensive.

**Natural language trigger:**
> "Create a materialized view for daily sales totals by region from orders — the dashboard refreshes it every hour"

**App behavior:** Routes to `handle-data-management`. Generates a `CREATE MATERIALIZED VIEW` with `enable_refresh = true, refresh_interval_minutes = 60`, appropriate `GROUP BY`.

**App output:**
- DDL confirmation card with estimated savings analysis: "Based on your dashboard's query pattern, this MV will reduce per-query scan from 420 GB to ~2 MB — approximately 99.5% cost reduction."
- Note about MV limitations (no subqueries, limited JOIN support)

**Completion state:** MV created and auto-refreshing. Chips: "Test a query against this materialized view", "Check the MV refresh status", "How much will this save per month?"

---

## 2.5 Scheduled Queries & Pipelines

### Journey A — Analyst: Weekly Report Automation
**Persona:** Analyst who manually runs a summary query every Monday morning and sends results to leadership. Wants to automate it.

**Natural language trigger:**
> "Schedule my weekly revenue summary query to run every Monday at 7am and save results to a reporting table"

**App behavior:** Routes to `handle-pipeline` (SCHEDULE type). Prompts for the SQL if not provided (or reuses the last query from context). Creates a scheduled query with destination table and `WRITE_TRUNCATE`.

**App output:**
- Confirmation: "This will create a scheduled query running every Monday at 7:00 AM UTC. Results go to `reporting.weekly_revenue` (overwrite each run). Estimated cost per run: ~$0.12. Proceed?"
- After confirm: success card with next run time, run history link

**Completion state:** Schedule live. Chips: "Simulate a run now to test it", "Set up email alerts if it fails", "Show me all my scheduled queries"

---

### Journey B — Engineer: View and Manage Existing Pipelines
**Persona:** Engineer who inherited a data warehouse and needs to audit what scheduled queries exist.

**Natural language trigger:**
> "Show me all scheduled queries in this project"

**App behavior:** Routes to `handle-pipeline` (LIST_SCHEDULES type). Fetches all transfer configs from Data Transfer API.

**App output:**
- Table: Name | Schedule | Last Run | Status | Destination Dataset
- Status badges: green (success), red (failed), yellow (running)
- Any recently failed schedules highlighted

**Completion state:** Full picture of pipeline health. Chips: "Show me details for the failed schedule", "Disable the nightly_refresh pipeline", "When did pipeline X last succeed?"

---

# DOMAIN 3: DATA QUALITY & GOVERNANCE

## 3.1 Data Profiling

### Journey A — Analyst: First-Look Profile of New Dataset
**Persona:** Analyst receiving a new dataset from a vendor who says "it's clean." They want to verify before building reports on it.

**Typical approach:** Write individual queries for nulls, distinct counts, min/max per column. Takes an hour manually for a 50-column table.

**Natural language trigger:**
> "Profile the vendor_sales table — I want to see null rates, distinct counts, and value ranges"

**App behavior:** Routes to `handle-data-quality` (PROFILE check type). Batches all profiling into a single `SELECT` with `COUNTIF(col IS NULL)`, `COUNT(DISTINCT col)`, `MIN/MAX/AVG` per column. Runs dry-run first.

**App output:**
- DataQualityView: column-by-column profiling table
  - Column | Type | Null% | Distinct Count | Min | Max | Sample Values
- Quality flags highlighted: columns with >20% nulls, single-value columns, suspicious distributions
- Overall score: "7 of 23 columns have quality concerns"

**Completion state:** Full quality picture. Chips: "Which columns have the most nulls?", "Show me the distribution of the category column", "Run this profile daily and alert if nulls increase"

---

### Journey B — Data Engineer: Pipeline Quality Gate
**Persona:** Engineer running a daily ETL and wants an automated quality gate — if the incoming data is bad (too many nulls, row count drops), the pipeline should halt.

**Natural language trigger:**
> "Check if today's events data in dataset.events passed quality thresholds: null rate on user_id < 5%, total rows > 10000"

**App behavior:** Routes to `handle-data-quality` (COMPLETENESS + RANGE_VALIDATION types). Runs targeted checks with today's partition filter.

**App output:**
- Pass/fail cards per check:
  - "user_id null rate: 0.8% — PASS (threshold: <5%)"
  - "Total rows: 847,293 — PASS (threshold: >10,000)"
- Overall: "All 2 quality checks passed. Today's data load is cleared."
- Or if failed: "FAIL: user_id null rate is 12.4% (threshold: <5%). Pipeline should not proceed. Investigate the ingestion source."

**Completion state:** Gate decision communicated. Chips: "Show me which rows have null user_ids", "Compare today's null rate to last week", "Set this up as an automated daily check"

---

### Journey C — Data Steward: Compliance Profile for PII Audit
**Persona:** Data steward who needs to identify which columns in a customer table contain PII before a compliance review.

**Natural language trigger:**
> "Scan the customers table for PII — show me which columns might contain names, emails, or phone numbers"

**App behavior:** Routes to `handle-data-quality` (PROFILE type with PII focus, or to `handle-task` for DLP integration). Runs pattern-based column analysis on column names + sample values. Optionally triggers Cloud DLP API if integrated.

**App output:**
- PII risk assessment table: Column | Data Type | PII Risk | Evidence
- High-risk columns flagged: `email_address`, `phone_number`, `full_name`, `ssn_last4`
- Recommendation: "Apply column-level security policies to high-risk columns. Use BigQuery Masked Reader roles for analysts."

**Completion state:** PII map ready for compliance team. Chips: "Show me how to mask the email column", "Apply row-level security by region", "Export this PII assessment as a report"

---

## 3.2 Duplicate Detection & Deduplication

### Journey A — Analyst: Find Duplicates Before Reporting
**Persona:** Analyst building a revenue report who suspects the orders table has duplicate rows from a bad ETL run.

**Natural language trigger:**
> "Are there duplicate order_ids in the orders table?"

**App behavior:** Routes to `handle-data-quality` (DUPLICATES check). Generates `GROUP BY order_id HAVING COUNT(*) > 1` query.

**App output:**
- DataQualityView: "Found 3,247 duplicate order_id groups affecting 6,491 total rows (0.8% of table)"
- Top duplicates shown: order_id | occurrence_count | first_seen | last_seen
- Impact estimate: "If not deduplicated, your revenue total is overstated by ~0.8%"

**Completion state:** Analyst understands scope. Chips: "Remove the duplicates", "Show me what's different between the duplicate rows", "Which pipeline caused these duplicates?"

---

### Journey B — Engineer: Deduplicate a Table
**Persona:** Following up on the duplicate discovery above, the engineer needs to actually remove them.

**Natural language trigger:**
> "Remove the duplicate order_ids from orders, keeping the most recent row for each"

**App behavior:** Routes to `handle-data-management`. Generates a CTAS-style deduplication using `ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY updated_at DESC) = 1`.

**App output:**
- Confirmation card showing the full SQL, row count before/after preview:
  "Before: 812,491 rows. After deduplication: 806,000 rows (6,491 duplicates removed)"
- Warning: "This will overwrite the table. Consider creating a snapshot first."
- Two action buttons: "Create snapshot first, then deduplicate" | "Deduplicate now"

**Completion state:** Table deduplicated. Chips: "Verify the deduplication worked", "Show me the row count now", "Set up a daily duplicate check"

---

### Journey C — Analyst: Check for Semantic Duplicates
**Persona:** Analyst who suspects there are records that are "the same order" but have slightly different data (e.g., same customer + product + date but different order_id due to system error).

**Natural language trigger:**
> "Find cases where the same customer placed the same order on the same day for the same product — even if the order_id is different"

**App behavior:** Routes to `handle-data-quality` (DUPLICATES with composite key). Generates a GROUP BY on (customer_id, product_id, order_date) with HAVING COUNT(*) > 1.

**App output:**
- Semantic duplicate groups table
- Example row: "Customer 12345 bought Product ABC on 2024-01-15 — appears 3 times with order_ids [O001, O002, O003]"
- Summary: "347 potential semantic duplicate groups found"

**Completion state:** Findings ready for investigation. Chips: "Show me the full details of these duplicates", "How do I tell which one is the 'real' order?", "Flag these for manual review"

---

## 3.3 Data Freshness

### Journey A — Analyst: Check If a Table Is Up To Date
**Persona:** Analyst running a Monday report and needs to know if the weekend's data landed.

**Natural language trigger:**
> "When was the orders table last updated? Is today's data there?"

**App behavior:** Routes to `handle-monitoring` (FRESHNESS sub-type). Checks `INFORMATION_SCHEMA.TABLES` last_modified_time and runs `SELECT MAX(order_date) FROM orders WHERE DATE(order_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 3 DAY)`.

**App output:**
- FreshnessView: "Last modified: 6 hours ago (Sunday 11:42 PM UTC). Latest order_date in table: 2024-01-14 (yesterday). Today's date is 2024-01-15 — today's data has NOT arrived yet."
- Context note: "This table is typically updated by 8 AM. Current time is 6:15 AM — within normal window."

**Completion state:** Analyst knows to wait. Chips: "Alert me when today's data arrives", "When did Saturday's data arrive?", "Set up a freshness SLA alert"

---

### Journey B — Engineer: Freshness SLA Monitoring
**Persona:** Engineer responsible for a pipeline that must complete by 8 AM. Wants an automated alert if it misses.

**Natural language trigger:**
> "Set up an alert if the orders table hasn't been updated by 8am every day"

**App behavior:** Routes to `handle-monitoring` (ALERT type, DATA_CONDITION). Creates a scheduled query that checks `MAX(last_modified_time) < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 8 HOUR)` and errors if true, triggering DTS email notification.

**App output:**
- Alert configuration card: "A daily check will run at 8:00 AM UTC. If orders table has not been updated in the last 8 hours, an email will be sent to [user email]. Proceed?"

**Completion state:** Alert configured. Chips: "Test the alert now", "Show me all my data freshness alerts", "Add a Slack notification too"

---

## 3.4 Schema Drift Detection

### Journey A — Engineer: Detect Schema Changes in Upstream Table
**Persona:** Engineer whose pipeline broke because an upstream team added/removed a column without telling anyone.

**Natural language trigger:**
> "Did the schema of dataset.raw_events change recently? I think someone dropped a column."

**App behavior:** Routes to `handle-data-quality` (SCHEMA_DRIFT check). Fetches current schema via INFORMATION_SCHEMA.COLUMNS and compares against a cached baseline (if available), or inspects recent INFORMATION_SCHEMA.JOBS for DDL statements affecting the table.

**App output:**
- Schema drift report: "3 changes detected vs. baseline (7 days ago):
  - REMOVED: `legacy_tracking_id` (STRING) — removed 2 days ago
  - ADDED: `session_id` (STRING) — added 5 days ago
  - TYPE CHANGED: `event_value` — was FLOAT64, now NUMERIC"
- Impact: "Your pipeline references `legacy_tracking_id` in 3 queries. These will now fail."

**Completion state:** Engineer understands the breaking changes. Chips: "Show me the queries that reference legacy_tracking_id", "Update my pipeline to use the new schema", "Who made these schema changes?"

---

### Journey B — Data Steward: Ongoing Schema Change Monitoring
**Persona:** Data steward who wants to be notified of any schema changes to critical production tables.

**Natural language trigger:**
> "Alert me whenever the schema of dataset.orders or dataset.customers changes"

**App behavior:** Routes to `handle-monitoring` (ALERT type). Creates a scheduled query that diffs INFORMATION_SCHEMA.COLUMNS snapshots daily and sends notification if differences are found.

**App output:**
- Alert setup confirmation with the monitored tables listed
- Note: "Snapshots will be taken daily. Changes detected within a 24-hour window."

**Completion state:** Schema monitor configured. Chips: "Take a schema snapshot now as the baseline", "Show me the history of schema changes"

---

## 3.5 Access Control & Governance

### Journey A — Engineer: Grant Table Access to a New Analyst
**Persona:** Engineer responding to an access request: a new analyst needs read access to the sales dataset.

**Natural language trigger:**
> "Grant analyst@company.com read access to the sales dataset"

**App behavior:** Routes to `handle-task`. Resolves to a `datasets.patch` API call adding the IAM binding `roles/bigquery.dataViewer` for the user on the dataset. Shows exactly what permissions will be granted.

**App output:**
- Confirmation card: "This grants analyst@company.com `BigQuery Data Viewer` access to `project.sales`. They will be able to read all tables in this dataset. They still need `BigQuery Job User` at the project level to run queries. Proceed?"
- After confirm: success confirmation

**Completion state:** Access granted. Chips: "Verify analyst@company.com's current permissions", "Grant them job user access too", "What does BigQuery Data Viewer include?"

---

### Journey B — Data Steward: Audit Who Has Access to a Sensitive Table
**Persona:** Data steward reviewing access to a table containing PII data.

**Natural language trigger:**
> "Who has access to the customers table?"

**App behavior:** Routes to `handle-monitoring` (ACCESS_PATTERNS sub-type). Queries `INFORMATION_SCHEMA.JOBS_BY_PROJECT` for users who have queried this table, plus inspects dataset IAM policy via the API.

**App output:**
- Access audit view: two sections
  - "IAM Access": users/groups with dataset or table-level roles
  - "Query Access (last 30 days)": users who have actually queried this table, with query counts
- Highlight: any external (non-company) email addresses
- Flag: "3 users have queried this table who are not in the approved access list in IAM"

**Completion state:** Access picture complete. Chips: "Revoke access for user@external.com", "Show me what they queried", "Apply column masking to the email column"

---

### Journey C — Engineer: Apply Column-Level Security (Masking)
**Persona:** Engineer implementing a requirement that analysts can see a masked version of customer email (last 4 chars only) while data engineers see the full value.

**Natural language trigger:**
> "Mask the email column in the customers table so analysts see only the domain part"

**App behavior:** Routes to `handle-task`. Explains the Policy Tag → Data Policy chain. Generates the DDL to assign a policy tag to the column and the `CREATE DATA POLICY` statement.

**App output:**
- Step-by-step card:
  1. Create a taxonomy and policy tag in Data Catalog
  2. Assign the policy tag to `customers.email`
  3. Create a data masking policy: `EMAIL_MASK` (shows only domain)
  4. Grant `BigQuery Masked Reader` role to the analyst group
- Note: "This requires BigQuery Data Catalog Fine-Grained Access enabled on the project."

**Completion state:** Masking plan ready. Chips: "Walk me through creating the taxonomy", "What does the masked value look like?", "Test the masking on my account"

---

## 3.6 Data Lineage

### Journey A — Analyst: Trace Where a Table's Data Comes From
**Persona:** Analyst investigating why a reporting table has incorrect values — wants to trace it back to the source.

**Natural language trigger:**
> "What tables feed into dataset.weekly_report? Show me the lineage."

**App behavior:** Routes to `handle-discovery` (LINEAGE type). Queries `INFORMATION_SCHEMA.JOBS_BY_PROJECT` for jobs that wrote to `weekly_report`, extracts referenced_tables from those jobs, and recursively maps upstream dependencies.

**App output:**
- LineageDagView: visual DAG showing `weekly_report ← summary_orders ← orders ← raw_orders_csv`
- Each node: table name, last modified, row count
- Job IDs linking each hop with timestamps

**Completion state:** Lineage mapped. Chips: "Show me who last modified raw_orders_csv", "When was this pipeline last run?", "What downstream tables depend on weekly_report?"

---

### Journey B — Engineer: Impact Analysis Before Dropping a Table
**Persona:** Engineer about to drop a table that looks unused but wants to make sure nothing downstream depends on it.

**Natural language trigger:**
> "What other tables or queries depend on dataset.legacy_events? I want to drop it."

**App behavior:** Routes to `handle-discovery` (LINEAGE type, downstream direction). Searches INFORMATION_SCHEMA.JOBS for any query that reads from `legacy_events`.

**App output:**
- Downstream impact report: "In the last 90 days, `legacy_events` was referenced in 7 queries by 3 users. Dependent tables: `reporting.legacy_dashboard_data` (last updated 45 days ago)."
- Safe-to-drop assessment: "No queries have referenced this table in the last 45 days. Dependent table `legacy_dashboard_data` also appears unused."

**Completion state:** Engineer can make an informed decision. Chips: "Drop legacy_events", "Archive it to GCS first", "Show me the 7 queries that used it"

---

# DOMAIN 4: ANALYTICS, BI & ML

## 4.1 Exploratory Data Analysis

### Journey A — Analyst: Cohort Analysis
**Persona:** Product analyst investigating if users who signed up in Q1 have better retention than Q4 signups.

**Natural language trigger:**
> "Compare 90-day retention for users who signed up in Q1 2023 vs Q4 2023"

**App behavior:** Routes to `handle-query`. Generates a cohort analysis query: signup date bucket → join with activity table → calculate days since signup → pivot retention at 30/60/90 day marks.

**App output:**
- Table: Cohort | 30-day retention | 60-day retention | 90-day retention
- Bar chart comparing cohorts
- Notable finding: "Q1 cohort shows 12% higher 90-day retention. Q4 cohort may reflect holiday acquisition quality difference."

**Completion state:** Cohort comparison ready. Chips: "Break this down by acquisition channel", "Show me week-by-week retention curves", "Export this for the product review"

---

### Journey B — Analyst: Top-N and Distribution Analysis
**Persona:** Operations analyst who needs to understand which product categories drive the most revenue.

**Natural language trigger:**
> "What are the top 10 product categories by revenue this quarter?"

**App behavior:** Routes to `handle-query`. Generates a `GROUP BY category ORDER BY SUM(revenue) DESC LIMIT 10` query with current quarter partition filter. Selects `BAR_CHART` visualization.

**App output:**
- Horizontal bar chart: top 10 categories with revenue values
- Sum total KPI card: total revenue this quarter
- Notable finding: "Top 2 categories account for 67% of total revenue — high concentration risk."

**Completion state:** Ready. Chips: "Compare this to last quarter", "Drill into the top category", "Show me the bottom 10 instead"

---

### Journey C — Analyst: Geospatial Analysis
**Persona:** Retail analyst mapping store performance by geography.

**Natural language trigger:**
> "Show me total sales by US state for the last 3 months"

**App behavior:** Routes to `handle-query`. Generates a `GROUP BY state` aggregation with partition filter. Notes that geospatial visualization would need Looker Studio integration; renders as a table and suggests the export path.

**App output:**
- Data table: State | Total Sales | Order Count | Avg Order Value
- Sorted by total sales descending
- Note: "For a geographic map visualization, export this to Looker Studio. Here's the connected query you can use as a data source."

**Completion state:** Data ready. Chips: "Export to Sheets for a map chart", "Which state had the highest growth vs last quarter?", "Show me city-level breakdown for California"

---

## 4.2 BigQuery ML

### Journey A — Analyst: Build a Sales Forecast Model
**Persona:** Demand planning analyst who wants to forecast next quarter's sales without writing Python.

**Natural language trigger:**
> "Build a time series forecast model for monthly revenue from the orders table"

**App behavior:** Routes to `handle-task`. Generates `CREATE OR REPLACE MODEL` with `model_type='ARIMA_PLUS'`, `time_series_timestamp_col`, `time_series_data_col`. Then `ML.FORECAST()` to generate predictions.

**App output:**
- Step cards:
  1. "Training model (ARIMA_PLUS on monthly_revenue)..." with progress
  2. "Model trained in 2m 14s. MAPE: 4.2% (good fit)"
  3. Forecast chart: historical + predicted revenue for next 3 months with confidence intervals
- Notable finding: "Model predicts 8.3% revenue growth in Q2 with 95% CI: [+5.1%, +11.6%]"

**Completion state:** Forecast ready. Chips: "Evaluate the model accuracy", "Save this model", "What assumptions is the model making?"

---

### Journey B — Analyst: Customer Segmentation with K-Means
**Persona:** Marketing analyst who wants to segment customers into behavioral groups for targeted campaigns.

**Natural language trigger:**
> "Cluster our customers into 5 segments based on purchase frequency, average order value, and days since last order"

**App behavior:** Routes to `handle-task`. Generates a feature engineering CTE (RFM calculation), then `CREATE OR REPLACE MODEL ... OPTIONS (model_type='kmeans', num_clusters=5)`, then `ML.PREDICT()`.

**App output:**
- Model training progress card
- Cluster summary table: Cluster | Avg Frequency | Avg AOV | Avg Days Since Purchase | Count
- Bar chart of cluster sizes
- Interpretation: "Cluster 1 = High-value loyalists (buy often, high AOV, recent). Cluster 5 = At-risk churners (haven't purchased in 120+ days)."

**Completion state:** Segments ready for marketing. Chips: "Export customer segments to a new table", "Show me which customers are in each cluster", "What campaign should I run for Cluster 5?"

---

### Journey C — Data Scientist: Evaluate an Existing Model
**Persona:** Data scientist reviewing the performance of a churn prediction model that was trained last month.

**Natural language trigger:**
> "How accurate is our churn_model? Show me the confusion matrix and AUC."

**App behavior:** Routes to `handle-task`. Runs `SELECT * FROM ML.EVALUATE(MODEL dataset.churn_model)`. Extracts classification metrics.

**App output:**
- Metrics card: AUC-ROC: 0.87 | Precision: 0.79 | Recall: 0.73 | F1: 0.76
- Confusion matrix visualization
- Interpretation: "AUC of 0.87 is strong. Recall of 0.73 means 27% of actual churners are missed — if this is a costly miss, consider lowering the classification threshold."

**Completion state:** Model performance understood. Chips: "Retrain the model with newer data", "Run predictions on the current customer base", "What features are most important?"

---

## 4.3 Analytics Hub & Data Sharing

### Journey A — Publisher: Share a Dataset With External Partners
**Persona:** Data product manager who wants to publish a curated analytics dataset for partner companies to subscribe to.

**Natural language trigger:**
> "How do I share our product analytics dataset with external partners through Analytics Hub?"

**App behavior:** Routes to `handle-task`. Explains the Analytics Hub flow: create a Data Exchange → create a Listing → link the BigQuery dataset → control subscriber access.

**App output:**
- Step-by-step card: Publisher workflow
  1. Create a Data Exchange in Analytics Hub
  2. Create a listing pointing to `dataset.product_analytics`
  3. Set visibility: public or restricted
  4. Subscribers create a linked dataset in their own project
- Note: "Subscribers query your data directly — you pay for your storage, they pay for their query compute."

**Completion state:** Publisher path explained. Chips: "Walk me through creating the Data Exchange", "What data can I safely share externally?", "How do I see who has subscribed?"

---

### Journey B — Subscriber: Subscribe to a Public Dataset
**Persona:** Analyst at a partner company who wants access to a public BigQuery dataset (e.g., public weather data) to enrich their analysis.

**Natural language trigger:**
> "How do I subscribe to the NOAA weather dataset from Analytics Hub and join it with my sales data?"

**App behavior:** Routes to `handle-task`. Explains Analytics Hub subscription: find the exchange, subscribe, get a linked dataset, query it like any BQ dataset.

**App output:**
- Subscription walkthrough card
- Sample JOIN query: `sales JOIN weather_data ON sale_date = weather.date AND store_state = weather.state`
- Note: "The linked dataset appears in your project's Explorer. You read the data but don't own it — no storage charges."

**Completion state:** Subscription path clear. Chips: "What public datasets are available on Analytics Hub?", "Help me write the JOIN query", "Can I cache frequently-used weather data locally?"

---

## 4.4 Connected Sheets

### Journey A — Business User: Build a Pivot Report in Sheets
**Persona:** Finance manager who needs a monthly pivot report from BigQuery data but works entirely in Google Sheets.

**Natural language trigger:**
> "How do I connect our BigQuery orders table to Google Sheets so I can build pivot tables?"

**App behavior:** Routes to `handle-data-loading` (EXPORT_SHEETS type) or `handle-task`. Explains Connected Sheets setup and limitations. Offers to generate a pre-filtered custom query to reduce Sheets load.

**App output:**
- Connected Sheets walkthrough: Data → Data Connectors → BigQuery → select table
- Custom query recommendation: "Rather than connecting to the raw orders table (500M rows), use this pre-aggregated query so Sheets only handles ~10,000 rows..."
- Pre-aggregated SQL for the finance use case

**Completion state:** Finance manager can build their pivot in Sheets backed by live BQ data. Chips: "Generate the custom query for my use case", "How do I schedule the Sheet to refresh daily?", "What are the limits on Connected Sheets?"

---

# DOMAIN 5: MONITORING, COST & OPERATIONS

## 5.1 Query Performance Monitoring

### Journey A — Admin: Find the Most Expensive Queries
**Persona:** BigQuery admin who got an unexpected bill spike and needs to find the culprit.

**Natural language trigger:**
> "What were the most expensive queries this month? Show me who ran them."

**App behavior:** Routes to `handle-monitoring` (COST_ANALYSIS sub-type). Queries INFORMATION_SCHEMA.JOBS_BY_PROJECT for `total_bytes_billed`, groups by user and query hash.

**App output:**
- CostAnalysisView: top 20 queries by bytes billed
  - Rank | User | Query preview | Bytes billed | Estimated cost | Count | Last run
- Callout: "3 queries from analyst@company.com each scan 2.1 TB — same pattern, no partition filter on orders table"

**Completion state:** Cost culprit identified. Chips: "Show me the full SQL for query #1", "Optimize that query", "Set a per-user query cost limit"

---

### Journey B — Engineer: Investigate a Slow Query
**Persona:** Engineer whose dashboard is timing out. A specific query is taking 8+ minutes.

**Natural language trigger:**
> "Why is my orders summary query so slow? The job ID is bq-job-xyz123"

**App behavior:** Routes to `handle-monitoring` (QUERY_PLAN sub-type). Fetches job details via `jobs.get` API, extracts `statistics.query.queryPlan`, identifies the bottleneck stage.

**App output:**
- Query plan breakdown: Stage | Input rows | Output rows | Slot time | Status
- Bottleneck highlighted: "Stage S02 (JOIN) consumed 73% of total slot time. Input: 2.4B rows × 180M rows. High shuffle volume suggests no partition predicate on the join key."
- Recommendations: "Add `AND DATE(o.order_date) = DATE(e.event_date)` to the JOIN condition to enable partition pruning on both sides."

**Completion state:** Bottleneck identified. Chips: "Show me the optimized query", "What was the bytes scanned?", "Run the optimized version and compare"

---

### Journey C — Analyst: Monitor My Own Query History
**Persona:** Analyst who wants to review what queries they've run today to understand their personal cost usage.

**Natural language trigger:**
> "Show me the queries I ran today and how much data each scanned"

**App behavior:** Routes to `handle-monitoring` (JOBS sub-type). Filters INFORMATION_SCHEMA.JOBS_BY_PROJECT for the current user's email and today's date.

**App output:**
- Table: Time | Query preview | Bytes scanned | Duration | Status
- KPI cards: Total bytes today | Total cost today | Query count
- Sorted by bytes descending

**Completion state:** Personal usage visible. Chips: "Which query was most expensive?", "How does today compare to my average?", "Show me last week's history"

---

## 5.2 Storage Monitoring & Cost

### Journey A — Admin: Find Storage Bloat
**Persona:** Admin who noticed the BigQuery storage bill tripled last month and needs to find what's growing.

**Natural language trigger:**
> "Which tables are using the most storage? Show me the breakdown."

**App behavior:** Routes to `handle-monitoring` (STORAGE_BREAKDOWN sub-type). Queries INFORMATION_SCHEMA.TABLE_STORAGE_BY_PROJECT.

**App output:**
- StorageBreakdownView: treemap of storage by dataset and table
- Table: Dataset | Table | Logical GB | Physical GB | Active GB | Long-term GB | Time travel GB
- Sorted by total descending
- Callout: "dataset.raw_events_copy has 4.2 TB in long-term storage — this table has not been queried in 120 days"

**Completion state:** Storage picture clear. Chips: "Archive raw_events_copy to GCS", "Set an expiration on the unused tables", "Show me storage growth over the last 90 days"

---

### Journey B — Engineer: Evaluate Physical vs Logical Billing
**Persona:** Engineer trying to optimize storage costs by switching datasets with heavily compressed data to physical billing.

**Natural language trigger:**
> "Which of my datasets would save money with physical storage billing?"

**App behavior:** Routes to `handle-monitoring` (STORAGE sub-type). Queries TABLE_STORAGE for compression ratios (logical/physical). Highlights datasets where ratio > 2 (physical billing would be cheaper).

**App output:**
- Comparison table: Dataset | Logical GB | Physical GB | Compression ratio | Savings if switched
- Recommendation: "dataset.events has 8.1x compression ratio — switching to physical billing would reduce storage cost by ~87% for this dataset"

**Completion state:** Optimization opportunity identified. Chips: "How do I switch to physical billing?", "What's the total potential savings?", "Switch all qualifying datasets to physical billing"

---

## 5.3 Cost Attribution & Budget Management

### Journey A — Manager: Monthly Cost Attribution by Team
**Persona:** Engineering manager who needs to show each team their BigQuery spend for the month.

**Natural language trigger:**
> "Show me BigQuery costs by user for the last 30 days"

**App behavior:** Routes to `handle-monitoring` (COST_ANALYSIS sub-type). Aggregates INFORMATION_SCHEMA.JOBS_BY_PROJECT by user_email, calculates estimated cost.

**App output:**
- CostAnalysisView: table of users sorted by cost
  - User | Jobs run | Total TiB scanned | Estimated cost
- Pie chart: cost distribution by user
- KPI card: total project cost this month

**Completion state:** Cost attribution ready. Chips: "Export this as a CSV for billing", "Set up monthly cost reports", "Which user had the biggest increase vs last month?"

---

### Journey B — Admin: Set Up Budget Alerts
**Persona:** Admin setting up proactive budget alerts to avoid bill shock.

**Natural language trigger:**
> "Set up an alert if our monthly BigQuery spend exceeds $5,000"

**App behavior:** Routes to `handle-monitoring` (ALERT type, PROJECT_WIDE). Explains Cloud Billing budget alert setup (links to console since billing budget creation requires billing console access, not BigQuery API).

**App output:**
- Step-by-step card: "Budget alerts are configured in Cloud Billing (not BigQuery). Here's how:
  1. Cloud Console → Billing → Budgets & Alerts
  2. Create budget: $5,000/month for BigQuery services
  3. Alert thresholds: 50% ($2,500), 90% ($4,500), 100% ($5,000)
  4. Notification: email or Pub/Sub"
- Deep link to billing console

**Completion state:** Alert path explained. Chips: "Show me current month's spend", "How much have we spent so far this month?", "Who gets the alert emails?"

---

## 5.4 Slot Monitoring & Reservations

### Journey A — Admin: Check Slot Utilization
**Persona:** Admin evaluating whether the project's slot reservation is properly sized.

**Natural language trigger:**
> "How are our BigQuery slots being used? Are we over or under-provisioned?"

**App behavior:** Routes to `handle-monitoring` (SLOTS sub-type). Queries INFORMATION_SCHEMA.JOBS_TIMELINE for slot utilization over the last 7 days.

**App output:**
- MonitoringView: hourly slot utilization chart (line chart showing avg vs. peak slots used)
- KPI cards: Avg utilization | Peak utilization | Reserved slots
- Assessment: "Your reservation has 200 slots. Average usage is 47 slots (24%). Peak was 182 slots last Tuesday at 9 AM. Consider enabling autoscale rather than reserving 200 fixed slots."

**Completion state:** Sizing decision informed. Chips: "Show me the peak query hours", "What would autoscale look like?", "Which queries drove the Tuesday peak?"

---

### Journey B — Admin: Investigate Query Queuing
**Persona:** Admin getting complaints that queries are queuing during business hours.

**Natural language trigger:**
> "Why are queries queuing? Show me which queries waited more than 30 seconds before running"

**App behavior:** Routes to `handle-monitoring` (JOBS sub-type). Queries JOBS_BY_PROJECT for large gaps between creation_time and start_time.

**App output:**
- Jobs table filtered to queued jobs with queue_seconds > 30
- Pattern: "87 jobs queued yesterday between 9-11 AM, averaging 4.2 minutes wait time. Peak concurrent jobs hit 298 (reservation capacity: 200 slots)."
- Recommendation: "Your reservation is saturated during morning hours. Options: (1) increase slot capacity, (2) route ad-hoc queries to batch priority, (3) shift ETL workloads to off-hours."

**Completion state:** Queuing root cause found. Chips: "Show me which users are causing the peak", "How do I set batch priority on ETL queries?", "How much would 50 more slots cost?"

---

## 5.5 Scheduled Query & Pipeline Health

### Journey A — Engineer: Morning Pipeline Health Check
**Persona:** Engineer doing their daily morning check to make sure all overnight pipelines ran successfully.

**Natural language trigger:**
> "Did all my scheduled queries run successfully last night?"

**App behavior:** Routes to `handle-pipeline` (RUN_HISTORY sub-type). Fetches all transfer config run statuses from DTS API for the last 12 hours.

**App output:**
- PipelineView: table of scheduled queries
  - Name | Scheduled time | Actual run time | Status | Duration | Rows written
- Green/red status badges per pipeline
- Alert if any are FAILED or haven't run yet

**Completion state:** Health check complete. Chips: "Show me details for the failed pipeline", "Re-run the failed pipeline manually", "Which pipeline took the longest?"

---

### Journey B — Engineer: Debug a Failed Scheduled Query
**Persona:** Engineer whose daily ETL failed at 3 AM and they're investigating at 8 AM.

**Natural language trigger:**
> "Why did the nightly_sales_rollup scheduled query fail? Show me the error"

**App behavior:** Routes to `handle-pipeline` (SCHEDULE_DETAILS sub-type). Fetches the transfer config run history, gets the error message from the failed run.

**App output:**
- Error detail card: "Run failed at 03:14 AM UTC. Error: 'Table `dataset.orders` was not found.' The source table was renamed at 03:08 AM — 6 minutes before the scheduled query ran."
- Timeline showing the sequence of events
- Resolution: "Update the scheduled query to reference the new table name."

**Completion state:** Root cause found. Chips: "Update the query to fix the table name", "Re-run the pipeline now", "Backfill the data that was missed"

---

### Journey C — Engineer: Backfill a Missed Pipeline Run
**Persona:** Engineer who needs to re-process data for the 3 days the pipeline was failing.

**Natural language trigger:**
> "Backfill the sales rollup pipeline for Jan 13, 14, and 15"

**App behavior:** Routes to `handle-pipeline`. Triggers manual DTS run for each date with `@run_date` parameter substituted. Submits three backfill runs.

**App output:**
- Progress card showing three submitted jobs: Jan 13 → queued, Jan 14 → queued, Jan 15 → queued
- Links to each run in the Data Transfer console
- Note: "Backfill runs use the same SQL and parameters as the regular scheduled run, with `@run_date` set to each specified date."

**Completion state:** Backfill in progress. Chips: "Check the backfill run status", "Verify the backfilled data looks correct", "Alert me when all three are done"

---

## 5.6 Access Pattern Analysis

### Journey A — Admin: Find Unused Tables for Cleanup
**Persona:** Admin doing quarterly cleanup to find tables nobody is querying so they can archive or delete them.

**Natural language trigger:**
> "Which tables in the raw dataset haven't been queried in the last 90 days?"

**App behavior:** Routes to `handle-monitoring` (ACCESS_PATTERNS sub-type). Left-joins INFORMATION_SCHEMA.TABLES with JOBS_BY_PROJECT referenced_tables to find zero-query tables.

**App output:**
- AccessPatternView: table of tables with last_queried_date
  - Table | Size GB | Last queried | Owner | Days since last query
- Sorted by days since last query descending
- Summary: "23 tables in the raw dataset have not been queried in 90+ days, totaling 847 GB"

**Completion state:** Cleanup list ready. Chips: "Export this list for review", "Archive these tables to GCS", "Set 90-day expiration on all these tables"

---

### Journey B — Admin: Audit Who Accessed a Specific Table
**Persona:** Security admin investigating a potential data access concern — needs to see who queried a sensitive table.

**Natural language trigger:**
> "Who queried the customer_pii table in the last 30 days and what did they query?"

**App behavior:** Routes to `handle-monitoring` (ACCESS_PATTERNS). Queries JOBS_BY_PROJECT with CROSS JOIN UNNEST(referenced_tables) filtered to the specific table.

**App output:**
- Access log table: User | Query count | Last access | Total bytes scanned | Query preview
- Flag if any unexpected users appear
- Note: "For full cell-level audit logs, enable Data Access audit logs in Cloud Logging and export to BigQuery."

**Completion state:** Access picture complete. Chips: "Show me the full queries these users ran", "Revoke access for unexpected users", "Set up automatic access alerts for this table"

---

## 5.7 Cost Optimization Recommendations

### Journey A — Admin: Get Optimization Recommendations for the Whole Project
**Persona:** Admin who wants a holistic view of cost optimization opportunities across the project.

**Natural language trigger:**
> "Give me a cost optimization analysis for our BigQuery project"

**App behavior:** Routes to `handle-monitoring` (COST_ANALYSIS sub-type) combined with storage analysis. Runs multiple diagnostic queries: tables missing partition filters, most expensive queries, physical vs logical billing comparison, long-term storage candidates.

**App output:**
- CostAnalysisView with multiple sections:
  1. "Top 5 expensive query patterns" with optimization suggestions
  2. "Storage optimization opportunities": 3 tables should switch to physical billing (saves $420/mo)
  3. "Partition filter violations": 12 queries regularly scan full table without partition filter
  4. "Unused tables": 23 tables not queried in 90 days (847 GB at $17/mo)
- Total potential savings: "$1,240/month"

**Completion state:** Optimization roadmap in hand. Chips: "Fix the top partition filter violations", "Switch qualified datasets to physical billing", "Archive the unused tables"

---

### Journey B — Analyst: Understand and Reduce My Own Query Costs
**Persona:** Analyst who got a stern email from the admin about their query costs and wants to understand and fix the issue.

**Natural language trigger:**
> "My queries are too expensive. Can you help me understand why and optimize them?"

**App behavior:** Routes to `handle-monitoring` then `handle-query`. Pulls the user's recent query history, identifies patterns (no partition filters, SELECT *, repeated identical queries), then generates optimized versions.

**App output:**
- "Your top 3 cost drivers this month:
  1. Orders query: no partition filter → scanning 2.1 TB per run. Fix: add `WHERE DATE(order_date) >= '2024-01-01'`
  2. Customer query: `SELECT *` fetches 42 columns but only 3 are used. Fix: select only needed columns
  3. Same query run 47 times: results don't change. Fix: save results to a temp table and reuse."
- Optimized versions of each query
- Estimated savings: "These changes reduce your monthly scan from 84 TB to ~1.2 TB"

**Completion state:** Analyst understands the fixes. Chips: "Run the optimized version of query #1", "Save query #3 results to a table", "What's my current month's spend?"

---

# APPENDIX: APP ROUTING & SKILL COVERAGE MATRIX

| Workflow Category | Primary Skill | Secondary Skill | Coverage |
|---|---|---|---|
| Schema exploration | handle-schema | — | Full |
| Ad-hoc queries | handle-query | — | Full |
| DML operations | handle-data-management | — | Full (with confirmation flow) |
| DDL operations | handle-data-management | — | Full (with confirmation flow) |
| Data profiling | handle-data-quality | — | Full (8 check types) |
| Duplicate detection/removal | handle-data-quality + handle-data-management | — | Full |
| Freshness monitoring | handle-monitoring | — | Full |
| Schema drift | handle-data-quality | — | Full |
| Job monitoring | handle-monitoring | — | Full |
| Cost analysis | handle-monitoring | — | Full |
| Storage monitoring | handle-monitoring | — | Full |
| Access patterns | handle-monitoring | — | Full |
| Scheduled query CRUD | handle-pipeline | — | Full |
| Pipeline run history | handle-pipeline | — | Full |
| Data lineage | handle-discovery | — | Full (via JOBS lineage) |
| Table search | handle-discovery | — | Full |
| ER diagrams | handle-discovery | — | Full |
| Export to CSV | handle-data-loading | — | Full |
| Export to Sheets | handle-data-loading | — | Full |
| Saved queries | handle-saved | — | Full |
| Batch load from GCS | handle-task | — | Partial (instructions + SQL) |
| DTS setup | handle-pipeline | handle-task | Partial |
| Streaming ingestion | handle-task | — | Partial (guidance only) |
| Federated queries | handle-task | — | Partial |
| CDC/Datastream | handle-task | — | Partial (guidance only) |
| BigQuery ML | handle-task | — | Partial |
| Analytics Hub | handle-task | — | Partial (guidance only) |
| Connected Sheets | handle-data-loading + handle-task | — | Partial |
| IAM/access control | handle-task | — | Partial |
| Column-level security | handle-task | — | Partial (guidance only) |
| Budget alerts | handle-monitoring | — | Partial (links to console) |
| Reservations | handle-monitoring | handle-task | Partial |

**Coverage Definitions:**
- **Full**: the app can execute the workflow end-to-end via API calls
- **Partial**: the app provides guidance, generates code/commands, or links to the console for steps it can't execute directly
