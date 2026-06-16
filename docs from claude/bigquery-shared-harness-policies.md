# Shared Harness Policies

Two cross-cutting contracts referenced by all skill templates, pulled out
here so they're defined once rather than reinvented per skill. Every skill
template's cost-related language and "hands off to X" hooks should point
back to this doc rather than restating their own version.

---

## A. Cost guardrail policy

Every skill that can trigger a query (Query, Data Management, Data Quality,
and indirectly Discovery/ML-Analytics via their delegation to Query) uses
the **same bytes-processed tiers** to decide how loudly to talk about cost.
Get the tier from a `dryRun: true` call's `totalBytesProcessed` before
executing anything non-trivial.

| Tier | `totalBytesProcessed` | Gate | Behavior |
|---|---|---|---|
| 0 — Negligible | < 100 MB | none | Run silently, no cost mention |
| 1 — Small | 100 MB – 1 GB | `COST_NOTICE` | Run, but include bytes processed in the result (visible, not blocking) |
| 2 — Moderate | 1 GB – 100 GB | `COST_NOTICE` + `SAMPLING_SUGGESTED` (Data Quality only) | Run by default, cost shown prominently; Data Quality additionally offers `TABLESAMPLE` |
| 3 — Large | 100 GB – 1 TB | `COST_CONFIRM` | **Pause** — show estimate, require explicit go-ahead before executing |
| 4 — Huge | > 1 TB | `COST_CONFIRM` + suggest narrowing | Pause as Tier 3, and proactively suggest filters/date ranges/sampling before offering to proceed as-is |

Notes:

- These thresholds are defaults — make them configurable per deployment
  (a team with a large budget may want Tier 3 to start at 1 TB, not
  100 GB)
- `COST_CONFIRM` is a **gate that blocks execution** until the user
  responds; `COST_NOTICE` is informational and doesn't block
- **Combining gates**: Data Management's destructive-operation confirmation
  (its own §5) and `COST_CONFIRM` are independent gates that can both fire
  on the same operation (e.g., a `DELETE` that's both destructive *and*
  scans 200 GB). When both fire, show **one combined confirmation card**
  with both pieces of information (preview/row-count + cost estimate) and
  one confirm action — never stack two separate confirmation prompts for
  the same operation
- Tier 0/1 still technically call `dryRun` first — the tiers describe what
  happens *after* you have the estimate, not whether to estimate at all.
  Always estimate before executing anything beyond a trivial
  `SELECT ... LIMIT N` preview

---

## B. Skill handoff contract

Every "hands off to X" / "→ Skill: Y" hook across the templates produces
the same envelope, so the harness can route it without the receiving skill
re-deriving context from chat history.

```json
{
  "handoff": {
    "targetSkill": "Query | DataManagement | DataQuality | Schema | Discovery | Monitoring | DataLoading | MLAnalytics | Enrichment",
    "label": "Show me these rows",
    "context": { },
    "sourceSkill": "DataQuality",
    "sourceResultRef": "result_abc123"
  }
}
```

- **`label`**: short user-facing text for the suggested action (rendered as
  a button/chip in the UI)
- **`context`**: structured, target-skill-specific data — concrete
  identifiers (table refs, column names, filter expressions, key values),
  never just "figure it out from what was discussed"
- **`sourceResultRef`**: pointer back to the originating normalized result,
  so the UI can visually thread the new result to where it came from

### Common context shapes by target skill

| Target skill | Typical `context` contents |
|---|---|
| Query | `{ "table": "proj.ds.t", "filter": "col = 'x'", "rowKeys": [...] }` — enough to build a `WHERE` clause without re-asking |
| Data Management | `{ "table": "proj.ds.t", "operationHint": "DEDUPE \| FILL_NULLS \| DELETE_ORPHANS", "filter": "..." }` — Data Management still runs its own classify/preview/confirm flow (§4 of that skill), this just seeds it |
| Schema | `{ "table": "proj.ds.t", "scope": "TABLE" }` |
| Discovery | `{ "left": "proj.ds.a", "right": "proj.ds.b" }` for comparison, or `{ "target": "proj.ds.t" }` for lineage |
| Monitoring | `{ "metricDefinition": {...}, "checkType": "FRESHNESS \| COST \| SLOT_USAGE \| ERRORS" }` — for **system/job** conditions only; data-condition alerts route to Data Loading per §C |
| Data Quality | `{ "table": "proj.ds.t", "checkType": "PROFILE \| DUPLICATES \| ..." }` |
| Data Loading *(provisional)* | `{ "source": { "table": "proj.ds.t" } \| { "sql": "SELECT ..." }, "destination": { "type": "CSV \| JSON \| SHEETS \| SAVED_CHECK \| SCHEDULED_QUERY", "target": "gs://... \| spreadsheetId \| saved-query name \| schedule expression" }, "alertCondition": { "sql": "...", "description": "..." } }` — `SAVED_CHECK` (Tier 0) and `SCHEDULED_QUERY` w/ `alertCondition` (Tier 1) cover "alert me if..." per §C; also covers plain "export this", "make this recurring", "send to Sheets" |
| ML/Analytics *(provisional)* | `{ "table": "proj.ds.t" \| "sql": "...", "task": "FORECAST \| ANOMALY_DETECTION \| CLASSIFY \| SENTIMENT \| CLUSTER", "params": { "dateColumn": "...", "valueColumn": "...", "idColumns": [...] } }` — e.g. Query's "forecast this trend" or Data Quality's "is this an anomaly" |
| Enrichment *(provisional)* | `{ "table": "proj.ds.t", "column": "address", "operation": "GEOCODE \| TRANSLATE \| SENTIMENT", "params": { "targetLanguage": "es" } }` — e.g. Query's "translate this column", "geocode these addresses" |

The three rows marked *(provisional)* are derived from the capability
catalog and task taxonomy coverage map rather than a built skill template —
treat them as a starting contract to validate (and likely adjust) once
each of those skills is actually templated, rather than as settled.

A handoff is a **suggestion with prefilled context**, not an automatic
execution — the target skill still runs its normal workflow (including any
confirmation gates from §A), just without having to ask "which table did
you mean?" again.

---

## C. Data-condition alerting pattern

Cloud Monitoring `alertPolicies` (what Monitoring uses for "set up an
alert") watch **metrics that already exist** — slot utilization, query
error counts, bytes processed. "Alert me if duplicates show up in `orders`"
has no corresponding metric, and creating one the "proper" way means a
custom-metric-writing component (e.g. a Cloud Function on a schedule
calling `monitoring.timeSeries.create`) — real infrastructure beyond API
calls the chat app makes on the user's behalf.

Instead of one pattern, this is a **spectrum from pull to push** — default
to the cheapest tier and only move up if the user actually wants proactive
notification.

### Tier 0 — Saved check (pull, default)

1. The **originating skill** — typically **Data Quality** (row-content
   conditions: duplicates, nulls, freshness) but sometimes **Monitoring**
   (per-job/per-schedule statistics — see the third routing case below) —
   defines the check as a boolean SQL condition (same query it would run
   directly)
2. **Data Loading** saves it via the Dataform-based saved-query mechanism
   (catalog §5/§8 — same API as "create a saved query"), using a naming
   convention or label (e.g. `dq_check:` prefix) so it's discoverable as a
   group later
3. User re-runs on demand: "run my saved checks", "has the orders dedup
   check changed?" — the originating skill re-executes the saved SQL and
   reports current status

**What the user gets**: a one-word "run it again" later, without
re-describing the check. **What this doesn't give**: anything proactive —
if the user never asks, nothing happens. This is the right default for
"I'd like to be able to check this again easily" and the wrong one for "I
need to know the moment this happens."

Note: "did this get *worse* since last time" (not just "what's the current
state") needs a stored prior result — same persistence question as schema
drift in Data Quality §8. If that metadata table gets built, Tier 0 checks
can share it.

### Tier 1 — Scheduled check + failure email (push)

For when the user wants to be told without asking:

1. Same SQL condition as Tier 0
2. **Data Loading** wraps it in a scripting query that fails when the
   condition is true:
   ```sql
   IF (<condition>) THEN
     SELECT ERROR(FORMAT('Data quality check failed: %s', '<description>'));
   END IF;
   ```
3. **Data Loading** schedules this via the **Data Transfer API**, with
   `email_preferences.enable_failure_email = true` (and/or
   `notification_pubsub_topic` for programmatic routing)

**What the user gets**: an email when the check fails. No email = check
passed. **What this doesn't give**: a dashboard, severity levels, multiple
channels, or detection of "the schedule itself stopped running" (a silent
schedule failure looks identical to "nothing to report").

### Tier 2 — Full Cloud Monitoring integration (BYO infrastructure)

If `notification_pubsub_topic` is set in Tier 1, a Cloud Function
subscribed to that topic could write to Cloud Logging or call
`timeSeries.create`, bridging into the full `alertPolicies` path Monitoring
already supports for system metrics. Worth documenting as "how to go
further" but not something the app deploys/manages.

### Routing rule

Three cases, not two — the middle one is easy to miss because it *sounds*
like the first:

- **"Alert me if X" where X is a project-wide system/job condition**
  (overall slot usage, total query errors, total storage growth) →
  **Monitoring** skill, Cloud Monitoring `alertPolicies` directly against
  an existing aggregate metric — no new infrastructure, works as originally
  templated
- **"Alert me if X" where X is about a *specific* job/schedule's stats**
  (e.g. "alert me if *this* scheduled query ever exceeds 50GB",
  "tell me if *this* query gets slower than usual") — Cloud Monitoring's
  BigQuery metrics are aggregated at project/dataset level, **not** per
  named job or transfer config, so `alertPolicies` can't target "this one."
  **Monitoring** authors the check as a boolean SQL condition against
  `INFORMATION_SCHEMA.JOBS*` (e.g. "most recent run of transfer config X
  processed > 50GB"), then routes through **Tier 0/1 like a data
  condition** — same mechanism as the row below, different author
- **"Alert me if X" where X is a data/row-content condition** (row counts,
  duplicates, freshness, custom thresholds, anomaly flags from §9):
  - Default to **Tier 0** (saved check) — "I'll save this so you can ask me
    to re-check it anytime"
  - Offer **Tier 1** (scheduled + email) only if the user's phrasing implies
    proactive notification ("notify me", "email me", "let me know without
    asking") rather than just "I'd like to check this again later"

The harness should classify "alert me if..." requests against this split
*before* routing — Monitoring shouldn't accept data-condition alert
requests it can't actually fulfill via `alertPolicies`. The distinguishing
question for the second vs. first case: **does an existing aggregate
metric already mean what the user is asking about, or would the alert need
to be scoped to one specific job/table/schedule?** If the latter,
it's Tier 0/1 regardless of whether Monitoring or Data Quality authors it.
