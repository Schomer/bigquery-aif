# Report 03: Data Quality Monitoring
## BigQuery AIF — Product Design Report

**Version**: 1.0  
**Date**: 2026-07-11  
**Scope**: Data quality check design, data observability (five pillars), column profiling output, alerting UX, and scheduled monitoring.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Audit](#2-current-state-audit)
3. [Five Pillars of Data Observability](#3-five-pillars-of-data-observability)
4. [Data Quality Check Output Design](#4-data-quality-check-output-design)
5. [Column Profiling Design](#5-column-profiling-design)
6. [Alerting and Anomaly Detection UX](#6-alerting-and-anomaly-detection-ux)
7. [Scheduled Monitoring and SLA Tracking](#7-scheduled-monitoring-and-sla-tracking)
8. [Implementation Roadmap](#8-implementation-roadmap)

---

## 1. Executive Summary

The BigQuery AIF app has a functional data quality foundation: eight check types, a dry-run cost gate, and an auto-retry fallback for schema edge cases. However, the output layer — what the user actually sees — falls well short of the standard set by tools like Monte Carlo, Bigeye, and dbt. The gap is not in SQL sophistication; it is in result presentation.

**The core problem**: failures appear without baselines, passes are invisible, and every anomaly looks isolated rather than trended. A user seeing "null rate for email: 43%" has no way to know whether that is catastrophic or normal for this table.

This report specifies the changes needed to move from adequate to excellent across five dimensions:

| Dimension | Current state | Target state |
|---|---|---|
| Check output | Raw metric value | Metric + baseline + sparkline + sample rows + actions |
| Column profiling | null rate + min/max/avg | Full profile per type with inline histogram / heatmap |
| Schema drift | Shows current schema | Diff rendering with downstream impact count |
| Alerting | No alert system | Incident cards with SLA breach language and named downstream |
| Scheduled monitoring | No scheduled checks | 30-day pass/fail calendar, health grid, SLA tracker |

All design specs in this report are directly implementable against the existing codebase with no new backend services required for priorities 1–9.

---

## 2. Current State Audit

### 2.1 DQ Skill Handler

**File**: `src/lib/skills/handle-data-quality.ts` (534 lines)

#### Check Inventory

| Check | What it does | Gaps |
|---|---|---|
| `PROFILE` | null_rate + distinct_count + min/max/avg per column | No STDDEV, no APPROX_QUANTILES, no sampling mode |
| `NULLS` | Null rate per column | — |
| `DUPLICATES` | Groups by first `*_id` column, HAVING COUNT(*) > 1 | No multi-column key support |
| `FRESHNESS` | Uses `fetchSchema()` lastModifiedTime — no SQL query | — |
| `COMPLETENESS` | Fill rate per column | — |
| `RANGE_VALIDATION` | LLM generates expected min/max, then checks | Does not use INFORMATION_SCHEMA.TABLE_CONSTRAINTS |
| `REFERENTIAL_INTEGRITY` | LLM infers FK from column names, LEFT JOIN IS NULL | Does not use actual FK constraints even when available |
| `SCHEMA_DRIFT` | Shows current INFORMATION_SCHEMA.COLUMNS | **No baseline stored — always returns "no stored baseline"** |

#### What Works Well

- **Cost gate**: dry-run before PROFILE and NULLS. FRESHNESS bypasses correctly (metadata only).
- **Auto-retry**: if PROFILE fails due to GEOGRAPHY columns, retries with null-counts only. Prevents hard errors on spatial tables.
- **Output type**: `DataQualityResult` feeds `DataQualityView.tsx` with a consistent contract.

#### Presentation Gaps in `DataQualityView.tsx`

- No historical sparkline per finding (trend of metric over time)
- No sample failing rows inline per finding
- No summary health score at top ("6 of 12 checks passed")
- No "last run vs. previous run" delta per metric
- PASS rows not shown — only failures (no test coverage visible to user)
- SCHEMA_DRIFT: no diff rendering; shows current schema columns only

### 2.2 Monitoring Skill Handler

**File**: `src/lib/skills/handle-monitoring.ts` (850 lines)

#### Sub-type Inventory

| Sub-type | Status | Key gaps |
|---|---|---|
| `JOBS` | Working | Time range hardcoded at 24h |
| `STORAGE` | Working | — |
| `SLOTS` | Working | — |
| `QUERY_PLAN` | **Stub** | Returns static guidance text; does not call `jobs.get` or parse `statistics.query.queryPlan` stages |
| `ALERT` | Working | No Cloud Monitoring API — PROJECT_WIDE alerts are guidance text only |
| `STORAGE_BREAKDOWN` | Working | — |
| `ACCESS_PATTERNS` | Working | Time range hardcoded at 30 days |
| `COST_ANALYSIS` | Working | Cost rate hardcoded at $6.25/TB; no flat-rate pricing mode |
| `FRESHNESS` | Working | Time range hardcoded at 30 days |

#### Critical Gaps

1. **QUERY_PLAN is a stub**: zero information about actual query execution stages. A user asking "why is my query slow?" gets a text explanation of what query plans are, not their query's plan.
2. **No real-time job status**: RUNNING state detection absent. Historical only.
3. **No scheduled check history**: each run is stateless; there is no persistence layer for trend analysis.

---

## 3. Five Pillars of Data Observability

Data observability tools converge on five measurable dimensions of data health. Each pillar maps to a distinct class of failure. A table can pass four pillars and fail one silently. The BigQuery AIF app currently addresses freshness and partial distribution; the others are absent or shallow.

---

### Pillar 1: Freshness

**Definition**: Was the table updated within its expected cadence? A table that "ran successfully" but loaded stale data is broken.

#### Detection Approach

| Method | Description |
|---|---|
| Static threshold | STALE if > 4h, VERY_STALE if > 24h |
| Learned cadence | ML learns historical update intervals; alerts when gap exceeds learned pattern (Monte Carlo approach) |
| SLA-aware | Named deadline ("due by 9:00 AM"); breach language on overdue |

BigQuery provides `INFORMATION_SCHEMA.TABLES.last_modified_time` for threshold detection. No query required — metadata only, matching the current FRESHNESS implementation.

#### Excellent Freshness Output

```
STALE — orders_daily
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Last updated:   2025-07-11 06:17 AM  (26h 43m ago)
Expected:       every 24h  (30-day learned cadence)
Gap:            +2h 43m beyond normal schedule

SLA: Expected by 9:00 AM — BREACHED (2h 43m overdue)

[Sparkline: 30-day update gaps, today highlighted in red]
Normal range: 22–25h  |  Today: 26h 43m

Downstream: revenue_summary, exec_dashboard (2 assets affected)

[Re-run ETL]  [Notify Stakeholders]  [Investigate]
```

**Design rule**: always show the gap (expected vs. actual), not just "26 hours ago." SLA breach language bridges the technical metric to business impact.

---

### Pillar 2: Volume

**Definition**: Did the expected number of rows arrive? A pipeline that loads 45k rows when it should load 100k has silently dropped 55k records — even if it "succeeded."

#### Volume Anomaly Pattern

```
Volume Check — transactions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Expected range:  80,000 – 120,000 rows
Actual:          45,234 rows
Deviation:       -56% below floor         [CRITICAL]

[Sparkline: 30-day row counts, today highlighted in red]
 120k |                                        |
  90k | ▂▃▄▃▄▅▃▄▃▄▃▄▅▃▄▄▅▃▄▄▃▄▄▃▄▅▄▄▃▅        |
  45k |                                  today ←
      └──────────────────────────────────────────
       Jun 11                          Jul 11

Partition with missing rows: 2025-07-11
Missing rows estimated: ~57,000
```

**Design rule**: the sparkline contextualizes whether the anomaly is one-time or trending. Show the specific partition or date bucket where rows are missing.

---

### Pillar 3: Schema

**Definition**: Did the table's column structure change? Additions, removals, and type changes all break downstream models silently.

#### Schema Drift Diff Display

```
SCHEMA CHANGE — customer_profiles
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Detected: 2025-07-11 09:14 AM
Baseline: stored 2025-06-01 (40 days ago)

  + loyalty_tier         STRING           (NEW column)
  ~ revenue_ytd          FLOAT64 → NUMERIC  (type changed)
  - old_segment_code     STRING           (REMOVED)

37 columns unchanged

Downstream impact: 3 models, 5 dashboards reference this table.
```

Color-coding convention:
- `+` green — added column
- `~` amber — type or mode change
- `-` red — removed column

**Critical addition**: immediate downstream impact count surfaces the blast radius before anyone manually traces lineage.

---

### Pillar 4: Distribution

**Definition**: Are column values distributed within their historical norms? A column that is 100% populated but has shifted from 2% null to 43% null, or from a normal spread to all-zeros, has broken data.

#### Distribution Anomalies to Detect

| Anomaly type | Example |
|---|---|
| Null rate jump | 2% → 45% after a pipeline run |
| Near-zero clustering | revenue values all < $0.01 after sign flip bug |
| Category shift | country = US: 80% → 60% after geo expansion |
| Range violation | age: 152 found; declared max: 120 |
| Sentinel inflation | test@example.com: 412 occurrences (1.5% of rows) |

#### Column-Level Distribution Card

```
DISTRIBUTION ANOMALY — orders.email
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Metric:         Null rate
Current:        43.2%
Historical avg: 2.1%  (30-day baseline)
Change:         +2,014%                     [ISSUE]

[30-day null rate sparkline, today highlighted]
  43% |                                        |
   5% | ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁        |
      └──────────────────────────────────────────

Likely cause: Pipeline change or schema mismatch in source feed.
Last pipeline run: 2025-07-11 08:23 AM

Downstream: email_campaigns model, customer_ltv_view

[Show 5 sample null rows]  [Query affected rows]  [View lineage]
```

---

### Pillar 5: Lineage

**Definition**: Knowing the upstream provenance and downstream dependents of a table. Lineage serves two functions:

| Function | Direction | Use case |
|---|---|---|
| Impact analysis | Downstream | "If I change this table, what breaks?" |
| Root cause analysis | Upstream | "This dashboard is wrong — where did the bad data come from?" |

#### Lineage Integration Points

BigQuery AIF does not have a lineage store today, but two low-cost integration points exist:

1. **At anomaly detection time**: surface "N downstream assets potentially affected" as a next-action chip that opens a lineage query.
2. **At SCHEMA_DRIFT output**: show downstream reference count from `INFORMATION_SCHEMA.OBJECT_REFERENCES` where available.

For the near term, "downstream impact" can be approximated by querying `INFORMATION_SCHEMA.VIEWS` and `ROUTINES` for references to the affected table — no external lineage service required.

---

## 4. Data Quality Check Output Design

### 4.1 Adequate vs. Excellent

The difference between an adequate and excellent check result is not the metric itself — it is the context around it.

| Dimension | Adequate | Excellent |
|---|---|---|
| Metric | "null_rate for email: 43%" | "43.2% null (was 2.1% — 30-day avg)" |
| Baseline | None | Historical average shown inline |
| Trend | None | Sparkline for this metric over 30 days |
| Sample rows | None | 5 failing rows shown inline (not in a modal) |
| Cause | None | "Likely: upstream pipeline change on 2025-07-10" |
| Actions | None | [Show nulls] [Query affected rows] [Fix with dbt patch] |
| Pass visibility | Failures only | All checks shown; PASS rows provide coverage confidence |

---

### 4.2 Anatomy of an Excellent Check Result Card

```
┌─────────────────────────────────────────────────────────────┐
│  email                        completeness     [ISSUE]       │
├─────────────────────────────────────────────────────────────┤
│  43.2% null                   was 2.1% (30-day avg)  +41pp  │
│                                                             │
│  [Sparkline: 30-day null rate trend, today in red]          │
│                                                             │
│  Sample failing rows (5 of 20,193):                         │
│  ┌──────────┬─────────┬───────────┬──────────┐             │
│  │ order_id │ cust_id │ email     │ created  │             │
│  │ 10041    │ C-2914  │ NULL      │ Jul 11   │             │
│  │ 10042    │ C-3381  │ NULL      │ Jul 11   │             │
│  │ 10043    │ C-1204  │ NULL      │ Jul 11   │             │
│  │ 10044    │ C-8801  │ NULL      │ Jul 11   │             │
│  │ 10045    │ C-0091  │ NULL      │ Jul 11   │             │
│  └──────────┴─────────┴───────────┴──────────┘             │
│                                                             │
│  [Show all nulls]  [Query affected rows]  [Fix with patch]  │
└─────────────────────────────────────────────────────────────┘
```

**Component breakdown**:

1. **Header row**: column name in monospace + check type label + severity badge
2. **Primary metric**: large readable value with comparison to baseline ("was 2.1%") and delta ("+ 41pp")
3. **Sparkline**: 30-day trend, axis-less, color matches severity (red for ISSUE)
4. **Sample failing rows**: inline table of 5 rows that fail the check. Visible by default — not collapsed in a modal
5. **Remediation actions**: 2–3 inline buttons, specific to check type

---

### 4.3 Severity Levels

| Level | Color | Trigger conditions |
|---|---|---|
| `ISSUE` | Red | Null rate > 20%, duplicates found, value outside declared range |
| `WARNING` | Amber | Null rate 5–20%, distinct count changed > 30% |
| `INFO` | Blue | First check run; informational profile stats only |
| `PASS` | Green | Check ran; all values within expected bounds |

Severity determines badge color, sparkline color, and sort order (ISSUE first).

---

### 4.4 Pass/Fail Summary (dbt / Great Expectations Pattern)

Show ALL checks — not just failures. PASS rows provide coverage confidence: without them, failures look like "checks we haven't run yet."

```
Check results for: orders
47,293 rows  ·  checked 2m ago  ·  6 passed, 2 issues, 1 warning

  [PASS]  Completeness    order_id         100% not null
  [PASS]  Completeness    customer_id      100% not null
  [ISSUE] Completeness    email            43.2% null  (+41pp)
  [PASS]  Uniqueness      order_id         0 duplicates
  [WARN]  Distribution    total_amount     Max $48,231  (P99: $1,200)
  [PASS]  Freshness       —                Updated 2h ago (within 4h SLA)
  [ISSUE] Schema drift    —                Column 'old_region' removed
  [PASS]  Range           total_amount     Min $0.01 · Max $48,231 · in range
  [PASS]  Referential     customer_id      All values in customers.id
```

**Top summary line** ("6 passed, 2 issues, 1 warning") replaces the absent health score. It provides the same instant signal as a test suite's green/red banner.

---

## 5. Column Profiling Design

The profile view is the primary exploration surface. Its job is to answer "is this column healthy?" without requiring the user to write SQL.

### 5.1 Overall Layout Pattern

```
┌─────────────────────────────────────────────────────────────┐
│  orders  ·  47,293 rows  ·  12 columns  ·  Updated 2h ago   │
├───────────────────┬─────────────────────────────────────────┤
│ Columns           │ Column detail: email                     │
│                   │                                         │
│ order_id     ████ │  [full profile for selected column]      │
│ customer_id  ████ │                                         │
│ email      * ░░░░ │                                         │
│ total_amt    ████ │                                         │
│ order_date   ████ │                                         │
│ is_verified  ████ │                                         │
│ ...               │                                         │
└───────────────────┴─────────────────────────────────────────┘
```

- **Left panel**: scrollable column list. Each row shows: column name, type badge, null rate progress bar, and a flag icon (*) for anomalies.
- **Right panel**: full profile for the selected column.
- **Header**: table name, row count, column count, last updated.

---

### 5.2 Numeric Columns (INT64, FLOAT64, NUMERIC)

```
revenue_usd                                              FLOAT64
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Row count:       47,293
Non-null:        47,290  (99.99%)
Nulls:               3  ( 0.01%)
Zeros:             214  ( 0.45%)

Min:             $0.01
Max:         $48,231.00      [anomaly: 24x above P99]
Mean:            $124.50
Median:           $67.80
Std dev:         $201.33
P25:              $32.10
P75:             $198.50
P99:           $1,998.00

Distribution (20 buckets):
  $0–$50    ████████████████░░░░  19,204 (40.6%)
  $50–$100  ████████████░░░░░░░░  13,801 (29.2%)
  $100–$200 ████████░░░░░░░░░░░░   9,843 (20.8%)
  $200–$500 ████░░░░░░░░░░░░░░░░   3,912  (8.3%)
  $500+     █░░░░░░░░░░░░░░░░░░░     533  (1.1%)

Anomaly: Max ($48,231) is 24x above P99 — possible outlier or data entry error.
```

**Histogram spec**:
- 15–20 buckets, equal-width
- Inline bar chart, 300px wide, no axes required
- Hover shows: bucket range + exact count + percentage
- Buckets containing anomalous values rendered in amber or red

**Key additions over current PROFILE output**: STDDEV, median, P25/P75/P99 (via `APPROX_QUANTILES`), zero count, anomaly call-out.

---

### 5.3 String Columns (STRING)

```
email                                                    STRING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Row count:       47,293
Non-null:        27,100  (57.3%)
Nulls:           20,193  (42.7%)       [ISSUE — was 2.1%]
Empty strings:       47  ( 0.1%)
Distinct values: 26,892  (99.2% distinct)

Length:  avg 24 chars  ·  min 8  ·  max 89

Top values:
  test@example.com      412  (1.5%)  ████░░░░░░
  noemail@none.com      298  (1.1%)  ███░░░░░░░
  user@domain.com       187  (0.7%)  ██░░░░░░░░
  admin@company.com      91  (0.3%)  █░░░░░░░░░
  placeholder@n/a        67  (0.2%)  █░░░░░░░░░

Pattern detection:
  Valid email format:   98.3%  (26,621 values)
  Invalid format:        1.7%  (  479 values)  [Show sample]
```

**Design notes**:
- **Top values** surfaces sentinel and placeholder values (test accounts, "noemail@none.com") that statistical aggregates hide.
- **Pattern detection** is powered by a regex the LLM generates per column semantic type (email, phone, postal code, URL, UUID).
- "Invalid format" link opens a sample query — same pattern as the sample failing rows in check results.

---

### 5.4 Date Columns (DATE, DATETIME, TIMESTAMP)

```
order_date                                                DATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Row count:       47,293
Non-null:        47,293  (100%)
Distinct dates:     365

Range: 2024-07-01 → 2025-07-11  (376 days)

Expected daily coverage:  376 dates
Actual distinct dates:    365 dates
Missing periods:           11 dates detected

Calendar heatmap (12 months):

     Jul Aug Sep Oct Nov Dec Jan Feb Mar Apr May Jun Jul
Mon   ░   ▓   ▓   ▓   ▓   ░   ▓   ▓   ▓   ▓   ▓   ▓   ▓
Tue   ▓   ▓   ▓   ▓   ▓   ░   ▓   ▓   ▓   ▓   ▓   ▓   ▓
Wed   ▓   ▓   ▓   ▓   ▓   ░   ▓   ▓   ▓   ▓   ▓   ▓   ▓
Thu   ▓   ▓   ▓   ▓   ▓   ░   ▓   ▓   ▓   ▓   ▓   ▓   ░
Fri   ▓   ▓   ▓   ▓   ▓   ░   ▓   ▓   ▓   ▓   ▓   ▓   ▓
Sat   ░   ░   ░   ░   ░   ░   ░   ░   ░   ░   ░   ░   ░
Sun   ░   ░   ░   ░   ░   ░   ░   ░   ░   ░   ░   ░   ░

Legend: ▓ = data present  ░ = no data  ▒ = low volume

Missing dates (sample):
  2024-12-25, 2025-01-01, 2025-04-20
  Likely: expected holiday gaps
```

**Calendar heatmap**: GitHub contribution graph pattern — 12-month grid, color intensity = row count per day. Missing dates are immediately visible as blank cells. Gaps that form patterns (weekends, month-end) are visually distinguishable from random missing days (pipeline failures).

---

### 5.5 Boolean Columns (BOOL)

```
is_verified                                               BOOL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Row count:  47,293  |  Non-null: 97.5%  |  Nulls: 2.5%

TRUE    38,200  (82.9%)  |████████████████░░░|
FALSE    7,900  (17.1%)  |████░░░░░░░░░░░░░░░|
NULL     1,193   (2.5%)  |░░░░░░░░░░░░░░░░░░░|
```

Simple proportional bars suffice for boolean columns. The null count merits a flag if > 1%.

---

## 6. Alerting and Anomaly Detection UX

### 6.1 Alert Card Anatomy

The alert card is the primary artifact of the monitoring system. It must answer three questions instantly: what broke, how bad is it, and what do I do?

```
┌─────────────────────────────────────────────────────────────┐
│  [CRITICAL]  Freshness Anomaly: orders_daily                 │
│              Detected 11:43 AM  ·  Unacknowledged            │
├─────────────────────────────────────────────────────────────┤
│  What happened                                              │
│    Table has not updated in 26h 43m.                        │
│    Expected cadence: every 24h (30-day learned average).    │
│    SLA breach: table was due by 9:00 AM — 2h 43m overdue.  │
│                                                             │
│  Historical context                                         │
│    [Sparkline: 30 days of update gaps, today in red]        │
│    Normal gap: 22–25h  |  Today: 26h 43m                    │
│                                                             │
│  Downstream impact                                          │
│    revenue_summary, exec_dashboard, weekly_report           │
│    (3 assets using stale data)                              │
├─────────────────────────────────────────────────────────────┤
│  [Investigate]  [View Lineage]  [Acknowledge]  [Snooze 4h]  │
└─────────────────────────────────────────────────────────────┘
```

**Component rationale**:

| Component | Purpose |
|---|---|
| Severity badge | Instant triage — CRITICAL / HIGH / MEDIUM / LOW |
| Detection timestamp | Anchors the incident in time |
| "What happened" | Plain-language narrative; metric + expected value |
| SLA breach line | Translates "26 hours ago" into business consequence |
| Sparkline | Confirms whether today is an anomaly vs. a trend |
| Named downstream | "revenue_summary" is actionable; "3 models" is not |
| Action buttons | Verbs, not nouns. "Investigate" not "Details" |

---

### 6.2 Alert Text Quality

The text in an alert card determines whether an on-call engineer can act without opening BigQuery.

**Freshness — bad vs. good**:

> **Bad**: "Table orders_daily has not been updated."
> **Good**: "orders_daily has not updated in 26h. Expected: every 24h. SLA due: 9:00 AM (2h 43m ago). Revenue dashboard is stale."

**Distribution — bad vs. good**:

> **Bad**: "Null rate for email is 43%."
> **Good**: "email null rate jumped from 2% to 43% after the 8:23 AM pipeline run. 20,193 rows are missing email values. Downstream email_campaigns model will produce incorrect segmentation."

**Pattern applied to every alert**:
1. Include the baseline ("from 2% to 43%")
2. Include the trigger/time context ("after the 8:23 AM pipeline run")
3. Include downstream impact by name ("email_campaigns model")

This pattern converts a metric into an incident narrative. An LLM generating the alert text is already available in the orchestrator — this is a prompt change, not a new system.

---

### 6.3 Alert Fatigue Prevention

Alert fatigue is the primary adoption killer for monitoring systems. Three mitigations:

| Mitigation | Implementation |
|---|---|
| **Incident grouping** | 14 columns affected by one pipeline run = 1 incident, not 14 alerts. Group by root cause (same timestamp window, same table, same pipeline) |
| **Sensitivity controls** | Per-table, per-column null rate threshold. Default: alert at > 10%. User-configurable to 5% or 25% |
| **Snooze with reason** | When snoozing, show the suppression reason on the card ("Snoozed until 9:00 AM — scheduled maintenance"). Surface a reminder when snooze expires |

---

## 7. Scheduled Monitoring and SLA Tracking

### 7.1 SLA Status Row

The SLA status row is the single most important output for business-facing users. It translates a timestamp into a verdict.

```
orders_daily
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SLA:          Fresh by 9:00 AM daily
Status:       BREACHED — 2h 43m overdue                [red]
Last refresh: 2025-07-11 06:17 AM
Next check:   In 17 minutes

[Re-run ETL]  [Investigate]  [Notify Stakeholders]
```

**Status color rules**:
- Green: SLA met, last refresh within window
- Amber: At-risk — within 30 minutes of deadline without confirmed refresh
- Red: Breached — past deadline, last refresh does not satisfy SLA

---

### 7.2 30-Day Pass/Fail Calendar

The 30-day calendar converts a sequence of check results into a pattern. Patterns reveal systemic issues that single-run metrics hide.

```
orders_daily — Freshness Check  (July 2025)

      1   2   3   4   5   6   7   8   9  10  11  ...
Mon  [G] [G] [G] [G] [G] [G] [G] [G] [G] [G] [R]
Tue  [G] [G] [G] [G] [G] [G] [G] [G] [G] [G]
Wed  [G] [G] [G] [G] [G] [G] [G] [G] [G] [G]
Thu  [G] [G] [G] [A] [G] [G] [G] [G] [G] [G]
Fri  [G] [G] [G] [G] [G] [G] [G] [G] [G] [G]
Sat  [.] [.] [.] [.] [.] [.] [.] [.] [.] [.]
Sun  [.] [.] [.] [.] [.] [.] [.] [.] [.] [.]

[G] Pass  [A] At-risk  [R] Breach  [.] No check
Hover: exact date, time of last refresh, result value
```

**Patterns this surfaces**:
- "This table fails every Monday" (weekend batch job issue)
- "Failures correlate with month-end" (high-volume processing delay)
- "4th of each month is always at-risk" (scheduled maintenance window)

**Storage requirement**: one record per table per check per day.

```sql
-- monitoring_history table schema
CREATE TABLE monitoring_history (
  table_ref     STRING,
  check_type    STRING,
  check_date    DATE,
  status        STRING,   -- PASS | AT_RISK | BREACH | ERROR
  metric_value  FLOAT64,
  run_at        TIMESTAMP
);
```

Store in Firestore for fast reads (calendar rendering) or BigQuery for SQL-queryable history. Firestore is lower-latency for the real-time dashboard; BigQuery is better for trend analysis.

---

### 7.3 Monitoring Dashboard Layout

The monitoring dashboard aggregates all tables and checks into a single health surface.

```
┌─────────────────────────────────────────────────────────────┐
│  DATA HEALTH OVERVIEW                                        │
│  82% healthy  ·  47 tables monitored  ·  as of 11:43 AM    │
│                                                             │
│  [3 Stale tables]  [2 Active alerts]  [1 SLA breach today]  │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────┬──────────────────────────────────┐
│  ALERTS FEED             │  TABLE HEALTH GRID               │
│                          │                                  │
│  [CRITICAL]              │  Table          Fresh  Vol  Sch  │
│  orders_daily            │  orders_daily   [R]   [G]  [G]  │
│  Freshness · 2h ago      │  customers      [G]   [G]  [A]  │
│  [Investigate] [Ack]     │  transactions   [G]   [G]  [G]  │
│                          │  products       [A]   [G]  [G]  │
│  [HIGH]                  │  sessions       [G]   [R]  [G]  │
│  customer_profiles       │                                  │
│  Schema drift · 4h ago   │  Sorted: worst first             │
│  [View diff] [Ack]       │  Click row: open full DQ report  │
│                          │                                  │
│  [MEDIUM]                │  30-DAY CALENDAR                 │
│  transactions            │  [tabs: Freshness / Volume /     │
│  Volume drop · 6h ago    │   Schema / Distribution]         │
│  [Investigate] [Ack]     │  [calendar grid — see section 7.2]│
└──────────────────────────┴──────────────────────────────────┘
```

**Section breakdown**:

| Section | Content | Sort order |
|---|---|---|
| Health overview (top strip) | Overall % healthy, stat cards for stale/alerts/breaches | — |
| Alerts feed (left column) | Open alerts, reverse-chronological | CRITICAL first |
| Table health grid (center) | One row per table, color-coded cells per pillar | Worst first |
| 30-day calendar (right/bottom) | Per-check calendar with tab switcher | Per selected table |

**Table health grid cell colors** follow the same three-state convention:
- Green: passing
- Amber: warning / at-risk
- Red: issue / breach

---

## 8. Implementation Roadmap

Ordered by impact-to-effort ratio. Priorities 1–9 require no new backend services — they are presentation and prompt changes. Priorities 10–14 require new data fetching or storage.

| Priority | Change | Pillar | Impact | Effort | Notes |
|---|---|---|---|---|---|
| 1 | SCHEMA_DRIFT baseline storage in Firestore | Schema | High | Low | Currently always returns "no baseline" — store on first run, diff on subsequent |
| 2 | Pass/fail summary row at top of DQ results | All | High | Low | Count PASS/ISSUE/WARNING, render one summary line |
| 3 | Show PASS rows alongside failures | All | High | Low | Map all check results, not just filtered failures |
| 4 | Freshness SLA breach text ("due by X, now Y") | Freshness | High | Low | Prompt change in handle-monitoring.ts + output template |
| 5 | Schema drift diff rendering (+ ~ -) | Schema | High | Low | Compare baseline vs. current columns, render colored diff |
| 6 | Sample failing rows inline per DQ finding | Distribution | High | Low | Add `LIMIT 5` subquery per check; render inline table |
| 7 | Top-values bar for string columns in PROFILE | Distribution | High | Low | Add `GROUP BY col ORDER BY COUNT DESC LIMIT 10` to PROFILE query |
| 8 | Column profile inline histograms (numeric) | Distribution | Very High | Medium | Add `APPROX_QUANTILES` to PROFILE; render bucket bars in DataQualityView |
| 9 | Calendar heatmap for date columns in profile | Distribution | High | Medium | Add distinct date count + gap detection to PROFILE; render calendar grid |
| 10 | Wire QUERY_PLAN to actual jobs.get API call | Monitoring | High | Medium | Replace stub with BigQuery Jobs API call; parse `statistics.query.queryPlan` |
| 11 | Volume sparkline per table in freshness view | Volume | High | Medium | Store daily row counts; render 30-day sparkline in freshness output |
| 12 | 30-day historical sparkline per DQ finding | All | High | High | Requires monitoring_history persistence layer (Firestore or BigQuery) |
| 13 | Monitoring dashboard (health grid + calendar) | All | High | High | New route/view; reads monitoring_history; renders grid and calendar |
| 14 | Alert incident timeline | All | Medium | High | Groups related alerts into incidents; requires event log and grouping logic |

### Dependency Graph

```
Priorities 1–9 (no new storage)
    All independent; can ship in any order.

Priority 12 (sparklines)
    Requires: monitoring_history table or Firestore collection.

Priorities 11, 13 (sparkline + dashboard)
    Requires: monitoring_history (same dependency as 12).

Priority 14 (incident timeline)
    Requires: monitoring_history + alert grouping logic.
```

### Recommended Sequence

**Sprint 1** (1–2 days): Ship priorities 1–6. These are prompt and template changes that dramatically improve the perceived quality of the DQ output with minimal code surface.

**Sprint 2** (3–5 days): Ship priorities 7–9. These add the histogram and heatmap visualizations that complete the column profiling surface.

**Sprint 3** (1 week): Ship priority 10 (unwire the QUERY_PLAN stub) and set up the monitoring_history persistence layer as a prerequisite for priorities 11–14.

**Sprint 4** (2 weeks): Ship priorities 11–14. These require the persistence layer and represent the full monitoring dashboard.

---

*End of report. Next reports in this series: `04-query-composer-ux.md`, `05-schema-explorer-design.md`.*
