# Skill: BigQuery Monitoring

## 1. Trigger conditions

Activate when the user's intent is about the **state of the system**
rather than the data itself. Signals:

- "what's running", "is anything still going", "did that job finish"
- "why is this slow / expensive", "how many bytes did that scan"
- "show me recent queries", "what failed today"
- "who ran/changed this", "who has access to..."
- "set up an alert for...", "notify me if..." — **only** when the
  condition is about system/job state (slot usage, query errors, storage
  growth, cost). "Alert me if duplicates appear" or other data-condition
  requests route to Data Quality/Data Loading instead — see the data-
  condition alerting pattern in `bigquery-shared-harness-policies.md` §C

This skill is unusual in that it spans **three separate APIs** depending on
the question — the workflow's first job is routing to the right one.

---

## 2. Auth & setup

| Data source | Scope needed |
|---|---|
| `jobs.get`/`list`, `INFORMATION_SCHEMA.JOBS*` | `bigquery.readonly` |
| Cloud Logging (audit logs) | `logging.viewer` (or `logging.read` via Logging API) |
| Cloud Monitoring (metrics, alert policies) | `monitoring.viewer` (read) / `monitoring.editor` (to create alert policies) |

---

## 3. Core API calls

| Purpose | API / Call | Notes |
|---|---|---|
| Specific job status | `jobs.get` | Real-time, for a job you already have the ID for |
| Recent job history | `jobs.list` | 6-month retention, reverse chronological |
| Per-job performance stats | `region-X.INFORMATION_SCHEMA.JOBS_BY_PROJECT` (or `_BY_USER`/`_BY_FOLDER`/`_BY_ORGANIZATION`) | One row per job: slot-ms, bytes processed, duration, error, referenced tables, `user_email` |
| Slot usage over time | `region-X.INFORMATION_SCHEMA.JOBS_TIMELINE` | Time-sliced slot consumption — good for "is this query healthy right now" |
| Materialized view usage | `materialized_view_statistics` field on a job, or `INFORMATION_SCHEMA.MATERIALIZED_VIEWS` | Was a query served from a materialized view, and if not, why |
| Admin/data-access history ("who did X") | Cloud Logging `entries.list` filtered to `protoPayload.serviceName="bigquery.googleapis.com"` | Audit logs — schema changes, job creation, access events |
| Metric time series (dashboards) | Cloud Monitoring `projects.timeSeries.list` | e.g. slot utilization, query count, errors — resource types `bigquery_project`/`bigquery_dataset` |
| Alerting | Cloud Monitoring `projects.alertPolicies.{list,create,patch}` | Programmatically create/inspect alert conditions |

Note: `region-X` must match your data's region (e.g. `region-us`); cross-
region INFORMATION_SCHEMA queries aren't supported.

---

## 4. Workflow steps

1. **Classify the monitoring intent**:
   - *Job status* — single job, real-time
   - *Performance/cost analysis* — historical, aggregate
   - *Audit / "who did X"* — admin activity
   - *Alerting setup* — create/inspect alert policies
2. **Route to the right source(s)** per the table above — some questions
   need more than one (e.g. "why did this fail and who ran it" = jobs.get +
   audit logs)
3. **Fetch** with appropriate time bounds (default to last 24h unless the
   user specifies otherwise)
4. **Normalize** into the common shape
5. **Map to UI**
6. **Offer follow-ups** (often hands off to Query or Data Management skills)

---

## 5. Normalized result shape

```json
{
  "monitoringType": "JOB_STATUS | PERFORMANCE | AUDIT | ALERT",
  "timeRange": { "start": "...", "end": "..." },
  "items": [
    {
      "jobId": "job_abc123",
      "userEmail": "todd@example.com",
      "statementType": "SELECT",
      "status": "DONE | RUNNING | ERROR",
      "createTime": "...",
      "totalSlotMs": 12000,
      "totalBytesProcessed": 52428800,
      "error": null,
      "referencedTables": ["project.dataset.table"]
    }
  ],
  "summary": {
    "totalJobs": 1,
    "totalBytesProcessed": 52428800,
    "errorCount": 0
  }
}
```

For audit/alert types, `items` holds log entries or alert policy objects
instead — same envelope, different inner shape.

---

## 6. UI mapping heuristics

| Result shape | Component |
|---|---|
| Single job, status RUNNING | Live status card with progress indicator (poll for updates) |
| Single job, DONE/ERROR | Status card with duration, bytes processed, result link or error |
| List of jobs | Sortable table — status icon, user, duration, bytes, slot-ms |
| Slot usage over time | Timeline/area chart |
| Cost summary | KPI card (bytes processed → estimated cost using on-demand rate) |
| Audit log results | Activity feed (who / what / when), grouped by actor or resource |
| Errors across jobs | Grouped error cards by error type/message |
| Alert policy created | Confirmation card summarizing metric, threshold, notification channel |

---

## 7. Cross-source caveats (worth surfacing to the user)

- Cloud Monitoring metrics for a query can take **up to ~7 minutes** to
  appear after the query finishes, and **failed queries aren't reported**
  in those metrics — use `jobs.get`/INFORMATION_SCHEMA for failures instead
- Audit logs answer "who/when/what action" but not performance;
  INFORMATION_SCHEMA answers performance and *does* include `user_email`,
  so it can often answer both for query jobs specifically
- `jobs.list`/INFORMATION_SCHEMA job history is retained for **6 months**;
  for longer retention, point the user toward exporting to a sink

---

## 8. Follow-up / exploration hooks

Hand-offs below use the shared envelope (`bigquery-shared-harness-policies.md`
§B) — e.g. "cancel this job" carries the `jobId` directly so Data
Management's confirmation step doesn't need to re-look it up.

- **"Cancel this job"** → `jobs.cancel` (note: may still incur cost) —
  hands off to Data Management skill for confirmation pattern
- **"Show me the SQL for that job"** → `jobs.get`, display the query text
- **"Set up an alert for this"** → depends on what "this" refers to (§C of
  the shared policies doc has the full breakdown):
  - A *project-wide* aggregate (overall slot usage, total errors) →
    Cloud Monitoring `alertPolicies.create` directly, confirm
    threshold/metric/notification channel
  - *This specific job/schedule's* stats (e.g. "alert me if **this**
    scheduled query exceeds 50GB") → no aggregate metric targets "this
    one" — author the condition against `INFORMATION_SCHEMA.JOBS*` (e.g.
    most recent run of this transfer config) and hand off to Data Loading
    as a Tier 0/1 check, same as a data condition
  - A genuine *data* condition (row counts, freshness, custom thresholds)
    → redirect to Data Quality/Data Loading per §C, don't attempt
    `alertPolicies`
- **"Who else has run queries like this"** → audit log search scoped to
  the same table(s)
- **"Break this down by user/table"** → re-query INFORMATION_SCHEMA grouped
  differently
