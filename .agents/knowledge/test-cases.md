# Canonical Test Cases

Known-good scenarios that must produce correct results. Before deploying any change, verify that these cases still work. Each test specifies the expected routing, expected behavior, and what a failure looks like.

Last verified: 2026-07-16

> **Architecture note (2026-07-13)**: The routing architecture changed from keyword-first to AI-first. Schema, query, and data-quality still have a keyword fast-path. All other skills (data-management, monitoring, discovery, pipeline, governance, task) now route through the conversation handler (`handle-conversation.ts`), which is a tool-calling agent that decides what to do. The LLM classifier result for non-fast-path skills also routes to conversation. The final fallback is conversation, not the keyword result.
>
> **Impact on test cases**: R6, R11 still pass -- the conversation agent calls `execute_dml` and the destructive DML intercept adds the confirmation/preview gate. R12 still passes -- the conversation agent recognizes export intent and calls appropriate tools. The expected "skill" for these is now `conversation` internally, though the behavior contract (what the user sees) is unchanged.

---

## Routing Tests

These test that messages route to the correct skill.

### R1: Dataset listing routes to schema
- **Input**: "What datasets are in this project?"
- **Expected skill**: schema
- **Expected scope**: PROJECT
- **Expected output**: A list of dataset names with table counts
- **Failure looks like**: Returns a query result or routes to discovery

### R2: Table listing within a dataset routes to schema
- **Input**: "What tables are in the analytics dataset?"
- **Expected skill**: schema
- **Expected scope**: DATASET
- **Expected dataset**: analytics
- **Expected output**: A list of table names within the analytics dataset
- **Failure looks like**: Lists all datasets instead of tables, or routes to query

### R3: Table description routes to schema
- **Input**: "Describe the orders table"
- **Expected skill**: schema
- **Expected scope**: TABLE
- **Expected output**: Full schema with columns, types, partitioning info
- **Failure looks like**: Runs a SELECT query on the table instead of showing metadata

### R4: Analytical question routes to query
- **Input**: "Show me the top 10 orders by revenue"
- **Expected skill**: query
- **Expected output**: SQL with ORDER BY and LIMIT 10, executed and displayed
- **Failure looks like**: Routes to schema or data-management

### R5: "Show duplicates" routes to data-quality, not data-management
- **Input**: "Show me the duplicates in the orders table"
- **Expected skill**: data-quality
- **Expected check type**: DUPLICATES
- **Failure looks like**: Routes to data-management (would try to DELETE)

### R6: "Remove duplicates" routes to data-management
- **Input**: "Remove the duplicates from the orders table"
- **Expected skill**: data-management
- **Expected operation**: DEDUPE
- **Failure looks like**: Routes to data-quality (would just SHOW duplicates)

### R7: Ambiguous read/write defaults to read
- **Input**: "Are there any duplicates in orders?"
- **Expected skill**: data-quality
- **Expected output**: Shows duplicate analysis, does NOT modify data
- **Failure looks like**: Routes to data-management

### R8: Filter with equality pattern routes to query
- **Input**: "Show me more about `status` = 'shipped'"
- **Expected skill**: query
- **Expected output**: SQL with WHERE clause
- **Failure looks like**: Routes to schema (because of "show me more about")

### R9: Follow-up filter on displayed table is single-step query
- **Input**: "filter it down to only rum categories" (after viewing a table schema)
- **Context**: lastSkill=schema, lastTable=liquor_backup
- **Expected skill**: query (single step, NOT multistep)
- **Expected output**: SQL with WHERE clause, one cost confirmation at most
- **Failure looks like**: Creates a 2-step workflow (schema fetch + query) with double confirmation

### R10: Natural filter phrasings route to query with high confidence
- **Input**: "filter down to only the rows where county is Polk"
- **Expected skill**: query
- **Expected confidence**: high (keyword router, bypasses LLM classifier)
- **Failure looks like**: Falls to LLM classifier due to regex miss

### R11: Follow-up action after data-quality routes to data-management
- **Input**: "Clean those up" (after a data-quality check)
- **Expected skill**: data-management (via context boost)
- **Failure looks like**: Routes to query or stays in data-quality

### R12: Export after query routes to data-loading
- **Input**: "Export that to Google Sheets" (after a query)
- **Expected skill**: data-loading
- **Expected operation**: EXPORT_SHEETS
- **Failure looks like**: Routes to query or generates new SQL

### R13: Filtered aggregation routes to query, not multistep
- **Input**: "show me how many total sales there was for the store BARMUDA DISTRIBUTION"
- **Expected skill**: query
- **Expected confidence**: high (keyword router, bypasses LLM classifier)
- **Expected visualization**: KPI_CARD
- **Expected output**: Single number, sum of sales filtered by store name
- **Failure looks like**: Creates a multistep workflow with schema listing + schema describe + query

### R14: Conversational input routes to conversation
- **Input**: "Hi, what can you help me with?"
- **Expected skill**: conversation
- **Expected output**: Prose response with action chips (not an artifact card)
- **Failure looks like**: Routes to query or schema, returns empty or error

### R15: Meta-conversational follow-up routes to conversation, not query
- **Input**: "explain what you just did" (after any query result)
- **Expected skill**: conversation
- **Expected output**: Plain explanation prose, not a new query result
- **Failure looks like**: Routes to query and runs a new SQL query

---

## Schema Tests

These test the schema skill's behavior.

### S1: Project scope lists datasets, not tables
- **Input**: "List my datasets"
- **Expected**: Returns SchemaResult with scope=PROJECT, columns containing dataset names
- **Failure looks like**: Returns table names or throws an error

### S2: Qualified dataset.table reference resolves correctly
- **Input**: "Describe analytics.orders"
- **Expected**: dataset=analytics, table=orders, scope=TABLE
- **Failure looks like**: Treats "analytics.orders" as a single table name in the wrong dataset

### S3: Unknown table triggers cross-dataset search
- **Input**: "Describe the orders table" (when orders is not in the context dataset)
- **Expected**: Searches all datasets, finds the table in the correct one
- **Failure looks like**: Returns "Not found" without searching other datasets

### S4: Dataset name matching is case-insensitive
- **Input**: "What's in ANALYTICS?"
- **Expected**: Matches the `analytics` dataset regardless of case
- **Failure looks like**: Treats ANALYTICS as a table name

---

## Query Tests

### Q1: Time series generates appropriate chart
- **Input**: "Show me orders per month for the last year"
- **Expected**: SQL with DATE_TRUNC and GROUP BY, visualization=LINE_CHART
- **Failure looks like**: Returns TABLE visualization for time-series data

### Q2: Single aggregate generates KPI card
- **Input**: "How many orders are there?"
- **Expected**: SQL with COUNT(*), visualization=KPI_CARD
- **Failure looks like**: Returns a full table with one row

### Q3: SQL error triggers auto-retry
- **Input**: Any query that would fail due to GEOGRAPHY/STRUCT columns
- **Expected**: First query fails, Gemini repairs SQL (e.g., excludes problematic columns), retry succeeds
- **Failure looks like**: Error thrown to user without retry attempt

### Q4: Expensive query triggers cost confirmation
- **Input**: Any query against a very large table without partition filter
- **Expected**: Dry run detects high cost tier, returns confirmation card
- **Failure looks like**: Query executes immediately without cost warning

### Q5: Entity name filter uses fuzzy matching
- **Input**: "total sales for HY-VEE FOOD STORE"
- **Expected**: SQL with `LIKE '%HY-VEE FOOD STORE%'` or `CONTAINS_SUBSTR`, NOT `= 'HY-VEE FOOD STORE'`
- **Expected output**: Non-zero total sales, visualization=KPI_CARD
- **Failure looks like**: Zero rows returned because of exact-match WHERE clause

---

## Data Management Tests

### DM1: Destructive operation requires confirmation
- **Input**: "Delete all rows where status = 'cancelled'"
- **Expected**: Preview showing affected rows, confirmation card, execution only after confirm
- **Note (2026-07-13)**: Confirmation gate is now enforced by the conversation handler's `execute_dml` tool intercept (not by `handleDataManagement` routing). The `pendingDestructiveDml` intercept fires on DELETE/TRUNCATE/DROP regardless of phrasing.
- **Failure looks like**: Rows deleted without preview/confirmation

### DM2: Misrouted analytical query gets redirected
- **Input**: "Analyze sales trends over time" (if LLM classifier misroutes to data-management)
- **Expected**: Safety net detects mismatch, redirects to query handler
- **Failure looks like**: Tries to generate DML for an analytical question

### DM3: Destructive intent in any phrasing still requires confirmation
- **Input**: "get rid of all the rows with null values" (or "clean out the cancelled orders")
- **Expected**: Conversation agent calls `execute_dml`, intercept fires, confirmation card shown
- **Note**: This phrasing would NOT have matched MUTATING_VERBS keywords. Passes because LLM understands intent.
- **Failure looks like**: No confirmation shown, rows deleted immediately

---

## Integration Tests

### I1: End-to-end conversation flow
1. "What datasets do I have?" -> schema, PROJECT scope
2. "What's in [dataset]?" -> schema, DATASET scope
3. "Describe [table]" -> schema, TABLE scope
4. "Show me the top 10 rows" -> query
5. "Export that to sheets" -> data-loading

### I2: Data quality to data management handoff
1. "Check for duplicates in orders" -> data-quality, DUPLICATES
2. "Remove those" -> data-management, DEDUPE (via context boost)

---

## Task Routing Tests

### T1: SQL translation routes to task
- **Input**: "i want to batch translate some sql files into google sql"
- **Expected skill**: task
- **Expected output**: TaskWorkflowView with dialect selector + SQL input
- **Failure looks like**: Routes to query, produces empty response or hallucinated migration service message

### T2: Translate column still routes to query
- **Input**: "translate the description column"
- **Expected skill**: query
- **Expected output**: SQL using AI.GENERATE for column translation
- **Failure looks like**: Routes to task (SQL migration workflow)

### T3: Data transfer setup routes to task
- **Input**: "help me set up a data transfer from S3"
- **Expected skill**: task
- **Expected output**: TaskWorkflowView with Data Transfer Service plan
- **Failure looks like**: Routes to data-loading or query

### T4: Guided workflow routes to task
- **Input**: "guide me through connecting BigQuery to my Cloud SQL database"
- **Expected skill**: task
- **Expected output**: TaskWorkflowView with Connection API plan
- **Failure looks like**: Routes to query or returns generic text response

---

## Monitoring Routing

| ID | Input | Expected Skill | Expected Sub-Type | Confidence |
|----|-------|---------------|-------------------|------------|
| M1 | "what jobs ran in the last hour" | monitoring | JOBS | high |
| M2 | "how much storage is my project using" | monitoring | STORAGE | high |
| M3 | "show me cost breakdown by user this week" | monitoring | COST_ANALYSIS | high |
| M4 | "which tables haven't been updated in 30 days" | monitoring | FRESHNESS | high |

## Discovery Routing

| ID | Input | Expected Skill | Expected Sub-Type | Confidence |
|----|-------|---------------|-------------------|------------|
| D1 | "find tables with email columns" | discovery | SEARCH | high |
| D2 | "compare orders_v1 and orders_v2" | discovery | COMPARISON | high |
| D3 | "where does this table get its data" | discovery | LINEAGE | high |

## Data Quality Routing

| ID | Input | Expected Skill | Expected Sub-Type | Confidence |
|----|-------|---------------|-------------------|------------|
| DQ1 | "profile the orders table" | data-quality | PROFILE | high |
| DQ2 | "check for null values in the customers table" | data-quality | NULLS | high |
| DQ3 | "check referential integrity between orders and customers" | data-quality | REFERENTIAL_INTEGRITY | high |

## Negative Tests

| ID | Input | Should NOT Route To | Expected Skill | Confidence |
|----|-------|-------------------|---------------|------------|
| N1 | "show me duplicate rows" | data-management | data-quality | high |
| N2 | "how many tables do I have" | query | schema | high |
| N3 | "what's the schema of orders" | query | schema | high |
| N4 | "run this query every day" | query | data-loading | high |
| N5 | "why is my query slow" | query | monitoring | high |

## Pipeline Routing

| ID | Input | Expected Skill | Expected Sub-Type | Confidence |
|----|-------|---------------|-------------------|------------|
| P1 | "show my scheduled queries" | pipeline | LIST_SCHEDULES | high |
| P2 | "what's scheduled to run tonight" | pipeline | LIST_SCHEDULES | high |
| P3 | "create a pipeline that loads data from raw_orders to clean_orders daily" | pipeline | CREATE_PIPELINE | high |
| P4 | "show me the run history for my nightly ETL" | pipeline | RUN_HISTORY | high |
| P5 | "delete the weekly report schedule" | pipeline | DELETE_SCHEDULE | high |

## Governance Routing

| ID | Input | Expected Skill | Expected Sub-Type | Confidence |
|----|-------|---------------|-------------------|------------|
| G1 | "who has access to the analytics dataset" | governance | ACCESS_AUDIT | high |
| G2 | "show permissions on the orders table" | governance | ACCESS_AUDIT | high |
| G3 | "check security policies on users" | governance | TABLE_SECURITY | high |
| G4 | "is there any PII in the customers table" | governance | SENSITIVE_DATA_SCAN | high |
| G5 | "scan for sensitive data" | governance | SENSITIVE_DATA_SCAN | high |
| G6 | "how well documented is this dataset" | governance | DATA_CLASSIFICATION | high |
| G7 | "which tables have no description" | governance | DATA_CLASSIFICATION | high |
| G8 | "audit access to the sales dataset" | governance | ACCESS_AUDIT | high |
| G9 | "data classification for analytics" | governance | DATA_CLASSIFICATION | high |
| G10 | "compliance check on this dataset" | governance | ACCESS_AUDIT | high |

---

## UX Evaluation Scenarios

These test the app from the **user's perspective** -- not routing or mechanics, but whether the output is genuinely good. Run via `node scripts/ux-eval.mjs`.

25 scenarios across all skills are evaluated on 6 dimensions (1-5 scale, minimum 4 to pass):
- **Task Completion**: Did the app do what the user asked?
- **Headline Quality**: Does the title add value and accurately describe the result?
- **Visual Clarity**: Is the result easy to read, well-formatted, and visually informative?
- **Data Insight**: Does the output help the user understand their data?
- **Suggestion Quality**: Are next-step suggestions specific, relevant, and useful?
- **Overall Intelligence**: Does this feel like a smart assistant or a dumb query runner?

Test IDs: F1-F5 (Foundation), Q1-Q6 (Query), DQ1-DQ3 (Data Quality), M1-M3 (Monitoring), D1-D2 (Discovery), V1-V2 (Visualization), G1 (Governance), DL1 (Data Loading), P1 (Pipeline), C1 (Conversation).

Results: `test-results/ux-eval-report.md` and `test-results/ux-eval-results.json`.
Screenshots: `test-screenshots/ux-eval/`.

---

## New Feature Tests (Added 2026-07-10 through 2026-07-16)

These cover features built after the original test-cases were written. They have not been automated yet.

### NF1: /plan prefix shows a plan card before execution
- **Input**: "/plan show me the top 10 orders by revenue"
- **Expected**: PLAN_CARD artifact displayed with title, summary, numbered steps, and a Proceed button. No SQL executed.
- **Click Proceed**: Re-sends the original query through the normal pipeline and shows result.
- **Failure looks like**: Query executes immediately without showing a plan, or plan card crashes.

### NF2: CSV upload flow works end-to-end
- **Input**: User attaches a CSV file via the paperclip button
- **Expected**: Phase 1 shows file drop zone. Phase 2 shows preview table + dataset/table fields. Phase 3 executes upload after confirm button.
- **Failure looks like**: File attaches but no upload view appears, or upload executes without a preview.

### NF3: Interactive widget -- date range picker
- **Input**: "show me sales over time with a date range filter"
- **Expected**: INTERACTIVE_WIDGET artifact with date pickers (start/end empty by default), Apply/Clear buttons, chart rendered below
- **Failure looks like**: Plain query result with no filter controls.

### NF4: Interactive widget -- NOT triggered for ranking queries (no filter requested)
- **Input**: "show me the top 15 countries by population in 2023"
- **Expected**: BAR_CHART or COLUMN_CHART with 15 rows. No widget controls.
- **Failure looks like**: Widget with a MULTI_SELECT for country (17,000+ rows).

### NF4b: Interactive widget -- triggered for ranking + explicit filter request
- **Input**: "show the top countries by population with a filter for year"
- **Expected**: INTERACTIVE_WIDGET with a DROPDOWN for year. Chart shows top countries by population. Selecting a year re-runs the query with `WHERE year = N`.
- **Failure looks like**: Plain bar chart with no year filter control.

### NF5: Multi-series line chart pivots long-format data
- **Input**: "show me population of China and USA over time"
- **Expected**: LINE_CHART with two series (one per country), year on x-axis
- **Failure looks like**: Two lines where one is the year values (flat near zero at chart scale) and the other is population.

### NF6: Zero-row result shows diagnostic headline, not LLM summary
- **Input**: Any query that returns 0 rows (e.g., a WHERE filter with no matches)
- **Expected**: Diagnostic headline ("No rows matched your filter criteria"), TABLE artifact type, recovery chips ("Sample table", "View schema")
- **Failure looks like**: Optimistic LLM summary as headline, or chart component receiving empty data.

### NF7: Saved query follow-up uses CTE wrapping
- **Input**: User runs a saved artifact, then asks "group by month"
- **Expected**: SQL wraps the saved query as a CTE: `WITH saved AS (...) SELECT ... FROM saved GROUP BY month`
- **Failure looks like**: LLM queries a real BigQuery table, ignoring the saved query context.

### NF8: Sample rows tab -- pagination and filter
- **Input**: In the SchemaView Sample tab, change rows-per-page to 100, type a filter, click Filter
- **Expected**: Table updates to show filtered/paginated rows with "1-100 of N" indicator
- **Failure looks like**: No pagination controls visible, or filter has no effect.

