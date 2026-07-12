# Data Ops Center — Product Design Report

**BigQuery AIF | Report 05**
**Date:** 2026-07-12
**Status:** Design-Ready

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Audit](#2-current-state-audit)
3. [Scheduled Query Management](#3-scheduled-query-management)
4. [Job History and Run Log Design](#4-job-history-and-run-log-design)
5. [Cost Monitoring and Query Performance](#5-cost-monitoring-and-query-performance)
6. [Pipeline Status Overview](#6-pipeline-status-overview)
7. [Query History and Audit Log](#7-query-history-and-audit-log)
8. [Design Principles](#8-design-principles)
9. [Implementation Roadmap](#9-implementation-roadmap)

---

## 1. Executive Summary

The BigQuery AIF app has solid foundations for data operations monitoring — nine monitoring sub-types, a pipeline skill covering the full transfer lifecycle, and a cost analysis view tied to `INFORMATION_SCHEMA`. What it lacks is operational depth: the job plan stub never calls the API, time ranges are hardcoded, scheduled query cards show state but not health, and cost data is disconnected from the workflows that generate it.

This report specifies the Data Ops Center: a coherent, chat-native experience for managing scheduled queries, interpreting run history, tracking cost, and auditing query provenance. The design draws from dbt Cloud's trigger provenance model, Dagster's asset-centric freshness framing, GitHub Actions' collapsible step logs, and Snowflake Snowsight's duration scatter plots.

**The central argument:** Operations management is not a list of job statuses. It is answering the question: *is my data ready, reliable, and reasonably priced?* Every design decision below flows from this framing.

**Six highest-leverage fixes, in order:**

1. Wire `QUERY_PLAN` to the actual `jobs.get` API (currently a stub)
2. Surface execution stage breakdown from `queryPlan` in query performance results
3. Add a 30-day health dot strip to every scheduled query card
4. Add failure tier escalation (Tier 2 and Tier 3 persistent banners)
5. Show inline optimization tips on cost analysis (LLM-generated from SQL + schema)
6. Fix hardcoded `location = 'us'` in the pipeline skill

---

## 2. Current State Audit

### 2.1 Monitoring Skill (`handle-monitoring.ts`, ~850 lines)

Nine sub-types, three output view types, with significant gaps:

| Sub-type | Data Source | Time Window | Output View | Gap |
|---|---|---|---|---|
| `JOBS` | `INFORMATION_SCHEMA.JOBS_BY_PROJECT` | Last 24h, 50 rows | `MONITORING_VIEW` | No adjustable range |
| `STORAGE` | `INFORMATION_SCHEMA.TABLE_STORAGE` | Latest snapshot | `MONITORING_VIEW` (repurposed) | — |
| `SLOTS` | `INFORMATION_SCHEMA.JOBS_TIMELINE_BY_PROJECT` | 100 intervals | `MONITORING_VIEW` (repurposed) | No timeline chart — raw table only |
| `QUERY_PLAN` | Static guidance text | — | `MONITORING_VIEW` (static text) | **Stub — no `jobs.get` API call** |
| `ALERT` | Three-way: PROJECT_WIDE / JOB_SPECIFIC / DATA_CONDITION | Varies | `ALERT_VIEW` | PROJECT_WIDE alerts are text-only guidance; no Cloud Monitoring integration |
| `STORAGE_BREAKDOWN` | `INFORMATION_SCHEMA.TABLE_STORAGE` | Latest snapshot | `STORAGE_VIEW` | — |
| `ACCESS_PATTERNS` | `INFORMATION_SCHEMA.JOBS_BY_PROJECT` | Last 30 days, grouped | `ACCESS_PATTERN_VIEW` | Time range hardcoded |
| `COST_ANALYSIS` | `INFORMATION_SCHEMA.JOBS_BY_PROJECT` | Last 30 days | `COST_ANALYSIS_VIEW` | Hardcoded $6.25/TB; no flat-rate mode |
| `FRESHNESS` | `__TABLES__.last_modified_time` | Per dataset | `FRESHNESS_VIEW` | — |

**Hardcoded constants that will break real projects:**
- `JOBS`: 24-hour window — no way to ask "show me jobs from last week"
- `COST_ANALYSIS` / `ACCESS_PATTERNS` / `FRESHNESS`: 30-day window, no override
- `COST_ANALYSIS`: pricing assumed at `$6.25/TB` — incorrect for EU, APAC, flat-rate customers
- No detection of currently-running jobs — all data is historical

### 2.2 Pipeline Skill (`handle-pipeline.ts`, ~605 lines)

| Operation | API | Status |
|---|---|---|
| `LIST` | BigQuery Data Transfer API | Working |
| `DETAILS` | BigQuery Data Transfer API | Working |
| `CREATE` | BigQuery Data Transfer API | Working |
| `UPDATE` | BigQuery Data Transfer API | Working |
| `DELETE` | BigQuery Data Transfer API | Working |
| `RUN_HISTORY` | BigQuery Data Transfer API | Working |

**PipelineView.tsx (10KB):** Renders scheduled query list and run history. Functional but operationally thin — shows status and timestamps, not reliability trends or cost.

**Critical bug:** `location` hardcoded to `'us'` — any EU or APAC project will fail silently. The Data Transfer API requires the correct region.

### 2.3 What Works

- Full CRUD pipeline management is rare in AI data assistants — this is a genuine differentiator
- `COST_ANALYSIS` and `FRESHNESS` sub-types are conceptually correct and return useful data
- `ACCESS_PATTERNS` grouping by query/user/table is the right approach for audit use cases
- `ALERT_VIEW` structure for `JOB_SPECIFIC` and `DATA_CONDITION` types is sound

### 2.4 What's Broken or Missing

- `QUERY_PLAN` is dead weight — the stub should either be removed or wired to reality
- No real-time running job detection
- No scheduled query health history (reliability, not just last state)
- No cost-per-run on scheduled query cards
- No execution stage breakdown (stage-level timing, bytes)
- No slot utilization visualization
- No budget tracking or projected month-end cost
- No inline optimization tips linked to actual query text
- No tables-referenced field in query history

---

## 3. Scheduled Query Management

### 3.1 Native BigQuery Console: The Ceiling

The BigQuery console scheduled queries view is a flat table: query name, schedule expression (raw cron string), last run timestamp, state, and a link to run history. It sets a low bar:

- No success rate or failure rate column
- No duration trend or p95 duration
- No next-run countdown — engineers must parse cron manually
- No cost-per-run — cost is invisible from the schedule list
- Alerting requires manually wiring Cloud Monitoring externally
- No version history — every edit overwrites silently

The console answers "what scheduled queries do I have?" It cannot answer "which ones are reliable?" or "which ones are expensive?"

### 3.2 Reference Bar: dbt Cloud and Dagster

**dbt Cloud — Trigger Provenance Model**

dbt Cloud's run history is the clearest reference for what professional operations management looks like. Each run record shows:

- Job name and environment
- Trigger type: `scheduled` / `API` / `manual` / `CI` — *why* did this run?
- Commit SHA for code-linked runs
- Queue wait time separate from execution duration
- Status badge
- Per-step log linked directly to the failing model

The rerun-from-failure button (not a full rerun — only failed steps) is operationally critical. The commit SHA surfaces version traceability that the BigQuery console entirely lacks.

**Dagster — Asset-Centric Freshness**

Dagster reframes the question from "did the job run?" to "is the data ready?" Each schedule card shows:

- Output asset name and group (not job name)
- Materialization status: `fresh`, `stale`, `failed`
- Last materialized timestamp
- Next scheduled run in absolute and relative time
- Per-partition status mini-grid for partitioned assets

This is the correct frame for data engineering. Job success and data freshness are orthogonal: a job can succeed and still produce stale data (incorrect partition range, upstream truncation, silent empty write). Both signals must be tracked independently.

### 3.3 The Schedule Card Spec

The card below is the target output for the `LIST` and `DETAILS` operations in PipelineView. The health dot strip is the single highest-value element — an engineer scanning 20 cards can identify reliable vs. flaky pipelines without opening any detail view.

```
SCHEDULED QUERY CARD
─────────────────────────────────────────────────────────────────────
Name:       daily_revenue_summary
Dest:       analytics.finance.daily_revenue
Schedule:   Every day at 08:00 UTC
Status:     [ACTIVE]

Health:     ● ● ● ● ○ ● ● ● ● ● ● ● ● ● ○ ● ● ● ● ● ● ● ● ● ● ● ● ● ●
            (30 dots · green = success · red = failure · gray = skipped)

Last run:   2026-07-11 08:03 UTC · succeeded · 4m 12s · 8.2 GB
Next run:   2026-07-12 08:00 UTC · in 10h 7m
Avg dur.:   3m 48s (p50) · 6m 12s (p95)
Est. cost:  ~$0.04/run · ~$1.20/month
Failure:    6.7% (30d) — 2 of 30 runs failed
─────────────────────────────────────────────────────────────────────
[Run now]   [View history]   [Edit schedule]   [Pause]
```

**What distinguishes this from a cron list:**

| Element | Why it matters |
|---|---|
| Health dot strip (30 days) | Reliability at a glance — no navigation required |
| p50 and p95 duration | p95 reveals flakiness even when median is good |
| Cost per run and per month | Makes infrastructure cost visible without querying billing |
| Next run in relative time | "in 10h 7m" is faster to parse than a cron expression |
| Failure rate percentage | Single number summarizes health trend |

**Dot strip encoding:**

- Green (filled): succeeded
- Red (filled): failed
- Gray (filled): skipped / disabled
- Empty circle: no run scheduled (weekend, excluded dates)
- Hoverable: tooltip shows run date, duration, status, and cost for that dot

### 3.4 Status Tiers for the Status Badge

| Badge | Condition |
|---|---|
| `[ACTIVE]` | Running on schedule, recent runs passing |
| `[INACTIVE]` | Paused by user |
| `[FAILING]` | 2+ failures in last 5 runs |
| `[STALE]` | Succeeding but destination table not updated (empty write) |

The `[STALE]` state requires checking `__TABLES__.last_modified_time` against the expected run window — this is the Dagster-style data freshness check layered on top of job status.

---

## 4. Job History and Run Log Design

### 4.1 Visual Representation Options

Different visualizations serve different operational questions. The right view depends on context.

| Visualization | Best for | Where to use |
|---|---|---|
| **Calendar heatmap** (GitHub contribution style) | 90-day pattern detection — which days fail, month-end clustering | Single schedule's long-term health modal |
| **Sparkline bar chart / dot strip** | Compact inline reliability view inside a card | Inside schedule card (30 bars: height = duration, color = status) |
| **Chronological list** | Operational detail — recent runs, error investigation | Default run history view for a schedule |
| **Gantt / timeline** | Multi-step pipelines with concurrent stages | Stage breakdown within a single run detail |
| **Duration scatter plot** | Outlier detection across all queries | Query history overview (Snowsight-style) |

The chronological list with inline error expansion is the default operational view. The calendar heatmap and scatter plot are higher-level diagnostic views accessed via explicit navigation.

### 4.2 Run Record Spec

```
RUN HISTORY — daily_revenue_summary
══════════════════════════════════════════════════════════════════════

Run #47   [SUCCEEDED]   2026-07-11 08:03:14 UTC   4m 12s
          Triggered: scheduled    Bytes: 8.2 GB    Rows written: 142,847
          Destination: analytics.finance.daily_revenue (partition 2026-07-10)
          Cost: ~$0.04

Run #46   [FAILED]      2026-07-10 08:01:52 UTC   0m 48s
          Triggered: scheduled    Bytes: 0    Rows: —
          Error: "Not found: Dataset analytics.finance was not found in location US"
          [Expand full error]  [Retry]  [View SQL]

Run #45   [SUCCEEDED]   2026-07-09 08:04:01 UTC   3m 58s
          Triggered: manual       Bytes: 7.9 GB    Rows written: 139,204
          Destination: analytics.finance.daily_revenue (partition 2026-07-08)
          Cost: ~$0.039

Run #44   [CANCELLED]   2026-07-08 08:00:33 UTC   0m 12s
          Triggered: scheduled    Bytes: 0    Rows: —
          Cancelled by: jane.doe@company.com
          [View SQL]
```

**Critical UX principle:** The error message appears inline in the list, not behind a navigation click. Every operations tool that hides error details behind a modal or a separate page introduces unnecessary context-switching. The error text should be truncated in the list (first 120 chars), fully expandable inline.

**Trigger type is required.** Run #45 was a manual run — that context explains why it ran on a Sunday when the schedule is weekday-only. Without trigger provenance, engineers blame the scheduling system for anomalies that were intentional.

### 4.3 Patterns from CI/CD UX

**From GitHub Actions:**

- Collapsible step groups, folded by default, auto-unfolded on failure — apply to multi-stage BigQuery pipeline step logs
- Re-run failed jobs only: surface a "Retry failed steps" button when a partial rerun would avoid re-scanning already-written partitions
- Run summary before logs: rows written, cost, duration, destination updated — these four fields answer 90% of questions without reading logs

**From Vercel Deployments:**

- "This deployment is live" → equivalent: "This run updated the downstream tables"
- Preview deployment data sample → "10-row sample of the data this run wrote" — surfaces silent empty writes

### 4.4 Failure Tier Escalation

Failure notification should scale with severity. Single-failure noise is as harmful as missed multi-failure escalation.

**Tier 1 — Isolated single failure**

Red badge on the run record. Inline error text. Retry button. No additional banners or alerts.

**Tier 2 — Repeated failures (2 or more of last 5 runs)**

```
[WARNING]  This pipeline has failed 2 of its last 5 runs.
           Most recent error: "Not found: Dataset analytics.finance"
           First occurrence: 2026-07-10 08:01 UTC
[View all failed runs]  [Retry now]
```

Persistent banner at the top of the run history view and on the schedule card. Does not auto-dismiss.

**Tier 3 — SLA breach (consecutive misses on a critical table)**

```
[ALERT]  analytics.finance.daily_revenue has missed 2 consecutive scheduled runs.
         Any dashboards or downstream queries reading from this table may have stale data.
         Last successful update: 2026-07-09 08:04 UTC (48 hours ago)

         Affected downstream tables (detected):
           - analytics.reporting.executive_summary
           - analytics.finance.weekly_rollup
[Investigate]  [Notify team]  [Override and run]
```

Tier 3 requires downstream dependency mapping — either declared (from pipeline metadata) or inferred (from `INFORMATION_SCHEMA.JOBS` WHERE clause analysis). Downstream impact is what converts a job failure into a business incident.

---

## 5. Cost Monitoring and Query Performance

### 5.1 Cost in Three Contexts

Cost information belongs in three distinct places, each serving a different decision point:

**1. Pre-execution — dry-run estimate**

Shown before the user clicks Run, before bytes are actually scanned.

```
This query will scan 8.2 GB · estimated cost: $0.051
  Add a partition filter on `order_date` to reduce scan to ~400 MB (~$0.0025)
[Run anyway]  [Show me the optimized version]
```

The optimization suggestion at dry-run time has the highest leverage: it prevents the cost, not just explains it afterward.

**2. Post-execution — provenance panel**

Shown in the result panel after a query completes.

```
QUERY EXECUTION SUMMARY
  Status:          SUCCEEDED
  Duration:        4m 12s  (queue: 0s · execution: 4m 12s)
  Bytes processed: 8.2 GB
  Cache hit:       No
  Slot-ms:         14,223,000
  Rows returned:   142,847
  Estimated cost:  $0.051
```

**3. Monitoring context — rolling totals**

Aggregated over 7/30/90-day windows, broken down by query, user, dataset, and project. This is the existing `COST_ANALYSIS` sub-type, which has the right structure but needs adjustable time windows and LLM-generated optimization tips.

### 5.2 Top-N Expensive Queries

The insight line is what transforms a cost table into an actionable document. The LLM generates it by combining the SQL text with schema metadata.

```
EXPENSIVE QUERIES THIS MONTH — Top 5 by total cost
══════════════════════════════════════════════════════════════════════

1.  revenue_reconciliation_v2          $84.20   12 runs   7.0 GB/run avg
    ─────────────────────────────────────────────────────────────────
    Insight: Table `orders` is scanned in full on each run.
    Adding a partition filter on `order_date` would reduce scan ~60%.
    [Show me the optimized SQL]

2.  customer_cohort_analysis           $62.40    3 runs   20.8 GB/run avg
    ─────────────────────────────────────────────────────────────────
    Insight: Reads full history of `events` table (6 years of data).
    Consider materializing pre-2024 data into a monthly summary table.
    [Design a materialization strategy]

3.  (ad hoc — john.doe@company.com)   $48.10    1 run    48.1 GB/run
    ─────────────────────────────────────────────────────────────────
    Run: 2026-07-08 14:22 UTC
    Insight: SELECT * with no WHERE clause on `raw_events` (48.1 GB).
    [Show the query]  [Suggest an optimized version]

4.  weekly_marketing_attribution       $31.80    4 runs    7.9 GB/run avg
    ─────────────────────────────────────────────────────────────────
    Insight: Joins `sessions` to `conversions` without a date filter.
    Both tables are partitioned on `event_date` — filter would help.
    [Show me the optimized SQL]

5.  product_feature_usage_daily        $18.60    7 runs    2.7 GB/run avg
    ─────────────────────────────────────────────────────────────────
    Insight: Consistent cost profile, no obvious optimization target.
══════════════════════════════════════════════════════════════════════
Total shown: $245.10 of $312.40 this month (78.4%)
```

The "[Show me the optimized SQL]" action is a natural language follow-up — the LLM already has the query text and schema context from the insight generation step.

### 5.3 Cost Alert Card

```
COST ALERT
══════════════════════════════════════════════════════════════════════
[WARNING]  Project spend elevated — $248 today vs. $41 daily average (7d)

Top contributor: john.doe@company.com
  3 queries · 38.4 TB scanned · $240 total

Largest single query:
  SELECT * FROM `project.dataset.orders` WHERE created_at > '2020-01-01'
  Ran at 09:14 UTC · 38.1 TB · $238 · Duration: 12m 48s

  Why it's expensive:
  No partition filter applied on `created_at`. The `orders` table is
  partitioned by `created_at` — adding a date range matching recent
  data would reduce bytes scanned by approximately 99%.

  Optimized query estimate: ~400 MB · ~$0.0025

[Show the full query]  [Run optimized version]  [Set budget alert]
══════════════════════════════════════════════════════════════════════
```

The "why it's expensive" section is LLM-generated. The inputs are: the SQL string, the table schema (partitioning info), and the bytes-billed figure. This is a medium-effort, high-impact addition to the existing `ALERT` sub-type.

### 5.4 Query Performance Breakdown

This replaces the current `QUERY_PLAN` stub. The data comes from `jobs.get` (the Jobs REST API), which returns `statistics.queryPlan` — an array of stage objects, each with timing, input/output rows, and step descriptions.

```
QUERY PERFORMANCE BREAKDOWN
══════════════════════════════════════════════════════════════════════
Job ID:              project:US.bqjob_r123abc456

Total duration:      4m 12s
  Queue wait:        0s
  Execution:         4m 12s

Bytes processed:     8.2 GB
Cache hit:           No
Slot-ms consumed:    14,223,000
Estimated cost:      $0.051

Execution stages:
  Stage 1  Read & Filter       1m 22s   33%  [████████░░░░░░░░░░░░░░░]
  Stage 2  Join                1m 48s   43%  [██████████░░░░░░░░░░░░░]
  Stage 3  Aggregate           0m 42s   17%  [████░░░░░░░░░░░░░░░░░░░]
  Stage 4  Write               0m 20s    7%  [██░░░░░░░░░░░░░░░░░░░░░]

Optimization tips:
  - Table `orders` is not partitioned on `order_date`. Adding a partition
    filter would reduce bytes scanned in Stage 1 by an estimated 70%.
  - Stage 2 join reads 3.1 GB from `customers`. Consider pre-filtering
    or materializing the filtered subset as a view.
══════════════════════════════════════════════════════════════════════
```

**Implementation note:** `statistics.queryPlan` contains `steps[]` per stage, each with `kind`, `substeps`, `recordsRead`, `recordsWritten`, `parallelInputs`, `completedParallelInputs`, and `status`. Stage bar widths are proportional to `computeMsAvg`. The LLM generates optimization tips by combining stage names and byte counts with the known table schema.

### 5.5 Budget Tracking

Three figures define the budget tracking widget:

| Metric | Description |
|---|---|
| Spent this month | Absolute total from billing export or `COST_ANALYSIS` aggregation |
| Daily burn rate | Average $/day over last 7 days, with trend direction (+/-%) |
| Projected month-end | If current burn rate holds for remaining days |

```
BUDGET TRACKING — July 2026
══════════════════════════════════════════════════════════════════════
Spent:       $312.40   of   $800.00 budget   (39%)

[████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]  ◄ projected end: $674
              $312                  $800

Daily burn:   $27.60/day avg (7d)  +3.2% vs prior week
Days left:    20 of 31 days elapsed
Projected:    $552 – $720  (median: $674)

Status: On track. Projected month-end is 16% below budget.
══════════════════════════════════════════════════════════════════════
```

If the projected month-end exceeds the budget, the marker extends beyond the bar end in red, and the status line reads: "At risk. Projected month-end ($920) exceeds budget by $120 (15%). Top contributor: john.doe@company.com."

---

## 6. Pipeline Status Overview

### 6.1 Key Health Signals

Health signals ordered by business impact, not technical severity:

| Rank | Signal | Why it ranks here |
|---|---|---|
| 1 | **Freshness of critical tables** | Stale data = wrong dashboards = wrong decisions |
| 2 | **Recent execution failures (last 24h)** | Immediate operational triage |
| 3 | **Anomalous row counts** | 90% drop in rows = upstream quality issue |
| 4 | **SLA latency** | Did data arrive by the promised time? |
| 5 | **Unresolved open incidents** | Visibility that the team knows about issues |

### 6.2 Job Success vs. Data Freshness

These are orthogonal signals and must be tracked independently.

A scheduled query can **succeed** while producing stale data in the following cases:
- The destination partition was already up to date (no new source rows)
- The query returned 0 rows (empty write, not detected by job status)
- The destination was wrong (wrote to yesterday's partition)
- An upstream table was truncated before the job ran

A freshness check reads `__TABLES__.last_modified_time` and compares it against the expected update window. Job status reads from `INFORMATION_SCHEMA.JOBS`. Both must be green for a table to be considered healthy.

**Visual representation:**

```
daily_revenue_summary

  Job status:     [SUCCEEDED]  2026-07-11 08:03 UTC
  Data freshness: [OK]         analytics.finance.daily_revenue
                               Last modified: 2026-07-11 08:06 UTC (within window)

vs.

daily_revenue_summary

  Job status:     [SUCCEEDED]  2026-07-11 08:03 UTC
  Data freshness: [STALE]      analytics.finance.daily_revenue
                               Last modified: 2026-07-09 14:22 UTC (47h ago — expected daily)
```

### 6.3 Daily Data Ops Briefing

The briefing format is designed for the first natural language query of the day: "How did last night's runs go?" or "Give me the morning data health summary."

```
DAILY DATA OPS BRIEFING — 2026-07-12 08:15 UTC
══════════════════════════════════════════════════════════════════════

STATUS    23 of 23 scheduled queries ran successfully overnight.

FRESHNESS
  [OK]    analytics.finance.daily_revenue        updated 07:58 UTC
  [OK]    analytics.product.feature_usage        updated 06:12 UTC
  [OK]    analytics.marketing.ad_spend           updated 08:01 UTC
  [LATE]  analytics.marketing.attribution        last updated 2026-07-10 (expected daily)

COST
  Yesterday spend:  $41.20   (7d avg: $39.80, +3.5%)
  Top query:        revenue_reconciliation_v2 · $8.40 · 5 runs

ANOMALIES
  None detected.

OPEN ISSUES
  None.

══════════════════════════════════════════════════════════════════════
1 freshness issue requires attention.
Ask me about the attribution pipeline or how to investigate the staleness.
```

**Formatting principle:** Overall status first (reassurance or alarm), then freshness (most business-impactful), then cost (most operational), then anomalies, then open issues. The closing line always offers a next action.

**Anomaly detection logic:**

- Row count drops: compare today's written rows to the 7-day average; flag if deviation exceeds 3 standard deviations
- Cost spikes: compare today's total bytes billed to the 7-day average; flag if greater than 2x average
- Missing runs: compare expected runs (from schedule definition) to actual runs in `INFORMATION_SCHEMA.JOBS`

---

## 7. Query History and Audit Log

### 7.1 Run Record Fields

| Field | Format | Notes |
|---|---|---|
| Timestamp | `2026-07-11 08:03:14 UTC` | Local time with UTC on hover |
| Duration | `4m 12s` | Wall-clock execution time |
| Status | `SUCCEEDED` / `FAILED` / `CANCELLED` / `CACHED` | Color badge |
| Bytes processed | `8.2 GB` | Human-formatted; not raw bytes |
| Estimated cost | `$0.051` | Bytes × regional rate |
| Rows returned | `142,847` | For SELECT; rows affected for DML |
| User / service account | `john.doe@company.com` | Who ran it |
| Trigger | `scheduled` / `manual` / `API` | Why did it run? |
| SQL preview | First 120 chars | Full SQL on expand |
| Tables referenced | Pill badges | Enables access pattern analysis |
| Cache hit | `Yes` / `No` | If Yes, cost = $0 |
| Job ID | `project:US.bqjob_r...` | For support escalation |

**The tables-referenced field** transforms query history from a log of SQL strings into a record of which tables were accessed when. It enables questions like "who queried the orders table this month?" without requiring users to write regex against SQL text.

### 7.2 Tool Comparison

| Tool | Best UX Element | Applicable Pattern |
|---|---|---|
| **Snowflake Snowsight** | Duration scatter plot: each query = dot, y=duration, x=time — outliers visible instantly; click dot → query detail | Primary overview visualization for query history |
| **Redshift Performance Insights** | Stacked area chart of query activity, color-coded by type; select time window → see running queries at that moment | Best for "something was slow at 2pm" postmortem |
| **BigQuery Console** | Has all the data in `INFORMATION_SCHEMA.JOBS` but requires writing SQL to investigate — bootstrapping problem | Exact reason NL query history is valuable |
| **dbt Cloud** | Trigger provenance column — see why each run fired | Trigger type field on every run record |

The scatter plot (Snowsight pattern) should be the default view for "show me my query history this week." Each dot represents one query: x-axis is time, y-axis is duration, color is status (green/red), size is cost. The user can brush-select a region to filter the list below.

### 7.3 Search and Filter Interface

**Time range selector:**

```
[Today]  [Yesterday]  [Last 7 days]  [Last 30 days]  [Custom range...]
```

**Filter panel:**

| Filter | Type | Values |
|---|---|---|
| Status | Multi-select | Succeeded / Failed / Cancelled / Cached |
| User | Multi-select | Users who ran queries in the time range |
| Tables referenced | Tag input | Filter to queries touching a specific table |
| Cost threshold | Numeric | Only show queries costing more than $X |
| Duration threshold | Numeric | Only show queries taking longer than N minutes |
| Free text | Text input | Substring match against SQL text |

**Sort options:** Most recent (default) · Most expensive · Slowest · Most bytes · Alphabetical by user

### 7.4 Natural Language Interface

The primary interface is conversational. The filter panel above is the output of a resolved intent, not a navigation step.

| Natural language query | Generated SQL intent |
|---|---|
| "Show me my most expensive queries this week" | `ORDER BY total_bytes_billed DESC` · `WHERE user_email = current_user` · 7-day window |
| "Which queries scanned more than 10 GB yesterday" | `WHERE total_bytes_processed > 10*1024^3` · `DATE(creation_time) = YESTERDAY` |
| "Who was querying the orders table this month" | `WHERE REGEXP_CONTAINS(query, r'\borders\b')` · current month window |
| "Show me all failed queries this week" | `WHERE state = 'DONE' AND error_result IS NOT NULL` · 7-day window |
| "What did I run before that big cost spike on Tuesday" | Time-bounded query relative to detected anomaly timestamp |
| "Which service accounts ran the most queries last month" | `GROUP BY user_email WHERE user_email LIKE '%gserviceaccount%'` |

Each maps to a parameterized `INFORMATION_SCHEMA.JOBS_BY_PROJECT` query. The LLM's role is to extract intent parameters, not write arbitrary SQL — which keeps the query surface bounded and auditable.

---

## 8. Design Principles

These six principles govern every design decision in the Data Ops Center. When two principles conflict, the higher-ranked one wins.

### Principle 1: Health over status

Display reliability trend, not just current pass/fail. A pipeline that succeeded today but failed 8 of the last 30 days is not healthy. A pipeline that failed once in 6 months is not in trouble. The 30-day dot strip, failure rate percentage, and p95 duration all embody this principle.

**Applied to:** Schedule card, run history list, daily briefing.

### Principle 2: Freshness and job success are orthogonal

Check both independently. Report both visually with separate indicators. Never collapse "job succeeded" and "data is fresh" into a single status — they can disagree, and when they do, the disagreement is always important.

**Applied to:** Schedule card status badges, pipeline status overview, daily briefing freshness section.

### Principle 3: Blast radius over error messages

Downstream impact is more important than the error text itself. "Not found: Dataset analytics.finance" tells an engineer what broke. "This failure means the executive_summary dashboard has had stale data for 48 hours" tells a business what broke. The Tier 3 escalation banner embodies this principle.

**Applied to:** Failure tier escalation, daily briefing anomaly section, cost alert card.

### Principle 4: Inline diagnosis, not navigation

Error messages appear in list view. Optimization tips appear in monitoring results. Query performance breakdowns appear in result panels. Requiring engineers to navigate to a separate detail page to find diagnostic information is the most common UX failure in operations tools.

**Applied to:** Run record inline errors, cost analysis insight lines, QUERY_PLAN stage breakdown.

### Principle 5: Cost in every context

Cost appears at dry-run, at result, and in monitoring. It appears on schedule cards (cost per run), on run records (cost per execution), and in the daily briefing (yesterday's spend). Cost is not a monitoring feature — it is a property of every query that runs.

**Applied to:** Pre-execution dry-run estimate, post-execution provenance panel, cost analysis, budget tracking, schedule card.

### Principle 6: Natural language is the primary interface

Structured views are the output of resolved queries, not the navigation model. The user does not open a "Query History" page and then apply filters. The user says "show me my most expensive queries this week" and receives a filtered, sorted result. The filter panel is the visual representation of what the LLM resolved from the intent.

**Applied to:** Query history, cost monitoring, pipeline status, daily briefing.

---

## 9. Implementation Roadmap

Prioritized by impact-to-effort ratio. Priorities 1–4 should ship in the first iteration.

| Priority | Change | Component | Impact | Effort | Notes |
|---|---|---|---|---|---|
| 1 | Wire `QUERY_PLAN` to actual `jobs.get` API call | `handle-monitoring.ts` | Very High | Medium | Replace stub with `GET /bigquery/v2/projects/{projectId}/jobs/{jobId}` |
| 2 | Surface execution stage breakdown from `queryPlan` stages | `handle-monitoring.ts` + new view | Very High | Medium | Parse `statistics.queryPlan[].steps` for stage timing and bytes |
| 3 | Add 30-day health dot strip to schedule cards | `PipelineView.tsx` | High | Medium | Requires querying run history for each transfer config |
| 4 | Failure tier escalation (Tier 2 / Tier 3 banners) | `PipelineView.tsx` | High | Low | Count failures in last 5 runs; detect Tier 3 via consecutive miss |
| 5 | Inline optimization tips on cost analysis results | `handle-monitoring.ts` + LLM prompt | High | Low | LLM generates tips from SQL text + schema; no new API call needed |
| 6 | Next run countdown on scheduled query cards | `PipelineView.tsx` | High | Low | Calculate from schedule expression and current time |
| 7 | Cost per run and failure rate on scheduled query cards | `PipelineView.tsx` | High | Low | Derived from existing `RUN_HISTORY` data + bytes billed |
| 8 | Adjustable time range for all monitoring queries | `handle-monitoring.ts` | High | Low | Parameterize the hardcoded `24h` and `30 days` constants |
| 9 | Daily ops briefing format (freshness + cost + anomalies) | New orchestrator intent | High | Medium | Combines `JOBS`, `COST_ANALYSIS`, and `FRESHNESS` sub-types |
| 10 | Budget tracking with projected month-end | New monitoring sub-type | High | Medium | Requires billing export table or `INFORMATION_SCHEMA.JOBS` aggregation |
| 11 | Tables referenced pill badges in query history | `handle-monitoring.ts` + view | High | Low | Parse `referencedTables` array from `INFORMATION_SCHEMA.JOBS` |
| 12 | Fix hardcoded `location = 'us'` in pipeline skill | `handle-pipeline.ts` | High | Low | Detect from project metadata or accept as parameter |
| 13 | Slot utilization timeline visualization | `handle-monitoring.ts` + new view | Medium | High | Requires chart component; data already fetched in `SLOTS` sub-type |
| 14 | Incident timeline for ongoing issues | New component | Medium | High | Requires incident state persistence across sessions |

### Iteration 1 — Fix the Foundation (Priorities 1, 2, 4, 12)

These changes either fix broken behavior or wire real data to stubs. They have no external dependencies on new views or new APIs beyond what is already called.

- Wire `QUERY_PLAN` to `jobs.get`
- Parse and display `queryPlan` stages with proportional duration bars
- Add failure tier banners to `PipelineView.tsx`
- Fix `location = 'us'` bug

### Iteration 2 — Operational Intelligence (Priorities 3, 5, 6, 7, 8, 11)

These changes add the operational context that elevates the experience above a cron list. Each is low-to-medium effort with high perceived value.

- 30-day health dot strip on schedule cards
- Cost per run, failure rate, next run countdown on cards
- Inline optimization tips on cost results
- Adjustable time ranges across all monitoring queries
- Tables referenced pills in query history

### Iteration 3 — Dashboard Features (Priorities 9, 10, 13, 14)

These require either new intent routing, new view components, or persistence infrastructure. Build after Iteration 2 has shipped and real user patterns are observable.

- Daily ops briefing intent
- Budget tracking widget
- Slot utilization timeline chart
- Incident tracking

---

*End of report. Next: 06-schema-explorer-and-discovery.md*
