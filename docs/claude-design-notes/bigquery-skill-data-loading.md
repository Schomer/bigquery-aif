# Skill: BigQuery Data Loading

## 1. Trigger conditions

Activate when the user's intent involves getting data **in or out** of
BigQuery, or setting up something that runs **on its own** later. This is
the most cross-API skill — it's the implementation layer for several other
skills' "make this recurring" / "export this" / "save this check" hooks.

- "export this to CSV/JSON", "download these results"
- "send this to Sheets"
- "load this file into a table"
- "schedule this query", "make this run nightly/recurring"
- "save this check" / "alert me if this happens again" (Tier 0/1 from §C
  of the shared policies doc)
- "connect to [Cloud SQL / Spanner / S3 / ...]"

---

## 2. Auth & setup

This skill touches more scopes than any other — request incrementally
(don't ask for Sheets/Connection scopes until a user action needs them).

| Capability | Scope / API |
|---|---|
| Load/extract jobs | `bigquery` (read/write) |
| Browse/read/write Cloud Storage | Cloud Storage API (`storage.objects.*`, `storage.buckets.*`) |
| Export to Sheets | `https://www.googleapis.com/auth/spreadsheets` |
| Scheduled queries (Tier 1 alerts, recurring) | BigQuery Data Transfer API — requires the API enabled on the project |
| Saved queries (Tier 0 saved checks, general) | Dataform API (`bigquery.savedqueries.*` via Dataform) |
| External connections | BigQuery Connection API |

---

## 3. Core API calls

Grouped by destination/source, since this skill is really several thin
wrappers around different APIs rather than one coherent surface.

**Export**
| Purpose | Call | Notes |
|---|---|---|
| Extract to GCS | `jobs.insert` with `extract` config | CSV/JSON/Avro/Parquet; cross-region extract incurs network egress |
| Export to Sheets | Sheets API `spreadsheets.values.update`/`append` | Write rows directly — **10 million cell limit per spreadsheet**, check result size first |
| Small inline download | No new API call — format rows already in context (from Query's result) client-side | For results small enough to already be in the conversation |

**Load**
| Purpose | Call | Notes |
|---|---|---|
| Load from GCS | `jobs.insert` with `load` config | CSV/JSON/Avro/Parquet/ORC |
| Browse source files | Cloud Storage `buckets.list`/`objects.list` | For "load this file" when the user needs to pick one |

**Scheduling (Tier 1 alerts + recurring queries)**
| Purpose | Call | Notes |
|---|---|---|
| Create schedule | Data Transfer API `transferConfigs.create` | Carries the SQL, schedule expression, and notification prefs |
| Update schedule | Data Transfer API `transferConfigs.patch` | "Update this schedule to use the new SQL/frequency" — modifies in place, preserving the config's ID and run history. Don't delete-and-recreate for what the user describes as an update |
| Inspect schedules | `transferConfigs.list`/`get`, `transferRuns`/`ListTransferLogs` | "What's scheduled" / run history — history overlaps with Monitoring |

**Saved queries (Tier 0 saved checks + general "create a saved query")**
| Purpose | Call | Notes |
|---|---|---|
| Create/list/get/update/delete | Dataform API saved-query resources | Use a naming convention (e.g. `dq_check:` prefix or a label) so checks are discoverable as a group later |

**External connections** (lower frequency — closer to one-time setup)
| Purpose | Call | Notes |
|---|---|---|
| Create/list connections | BigQuery Connection API `connections.create`/`list` | Cloud SQL, Spanner, AWS, Azure — enables `EXTERNAL_QUERY` from the Query skill afterward |

**High-throughput ingestion** (programmatic, less common in chat flows)
| Purpose | Call | Notes |
|---|---|---|
| Bulk write | BigQuery Storage Write API | For volumes where load jobs are too slow/frequent — likely triggered by an external pipeline rather than a chat turn |

---

## 4. Workflow steps

1. **Classify the operation**: `EXPORT | LOAD | SCHEDULE | SAVED_QUERY |
   CONNECTION`
2. **Resolve source/destination**:
   - Export: source is either a table (via Schema) or a prior Query result
     (`sourceResultRef` from a handoff) — don't re-run the query if the
     rows are already in context
   - Load: destination table via Schema (may not exist yet — that's fine,
     `jobs.insert` with `load` can create it); source is a GCS URI or
     user-provided file
3. **For SCHEDULE**: determine whether this is a **new** schedule or an
   **update to an existing one** — "update the schedule," "use this new
   version," "change the frequency" all imply `transferConfigs.patch`
   against the existing config (resolved via `transferConfigs.list`/`get`,
   often by name or by the table it targets), preserving its ID and run
   history. Only use `transferConfigs.create` when there's no existing
   config to update, or the user explicitly wants a new/separate schedule.
   Build the SQL per the tier (§7) either way, and set notification
   settings on create or patch as appropriate
4. **For SAVED_QUERY**: create the Dataform saved-query resource with the
   naming convention from §7
5. **Execute**
6. **Normalize**
7. **Signal Schema cache invalidation** if a LOAD created a new table or
   changed an existing one's schema (same mechanism as Data Management §7
   — loading is schema-affecting even though it's not "Data Management")
8. **Map to UI**
9. **Offer follow-ups**

---

## 5. Normalized result shape

```json
{
  "operationType": "EXPORT | LOAD | SCHEDULE | SAVED_QUERY | CONNECTION",

  "export": {
    "destinationType": "GCS_CSV | GCS_JSON | SHEETS | INLINE",
    "destination": "gs://bucket/path/*.csv | spreadsheetId | null",
    "rowsExported": 1048576
  },

  "load": {
    "sourceUris": ["gs://bucket/file.csv"],
    "destinationTable": "proj.dataset.table",
    "rowsLoaded": 1048576,
    "errors": []
  },

  "schedule": {
    "action": "CREATED | UPDATED",
    "transferConfigName": "...",
    "scheduleExpression": "every 24 hours",
    "sql": "...",
    "notification": { "email": true, "pubsubTopic": null },
    "tier": "RECURRING | ALERT_TIER1"
  },

  "savedQuery": {
    "name": "dq_check:orders:duplicates",
    "sql": "...",
    "tier": "ALERT_TIER0 | GENERAL"
  },

  "connection": {
    "connectionId": "...",
    "type": "CLOUD_SQL | SPANNER | AWS | AZURE"
  },

  "jobId": "job_abc123",
  "status": "SUCCESS | ERROR",
  "schemaInvalidation": {
    "required": true,
    "scope": "proj.dataset.new_table",
    "reason": "LOAD created table"
  }
}
```

Only the key matching `operationType` is populated.

---

## 6. UI mapping heuristics

| Result shape | Component |
|---|---|
| Export to GCS | Download link / "file ready" card |
| Export to Sheets | "Open in Sheets" link |
| Export, result too large for Sheets | Error/notice card explaining the 10M-cell limit, offer GCS export instead |
| Load complete | Summary card: rows loaded, errors if any, link to the table (→ Schema) |
| Load with row-level errors | Error list — which rows failed and why, alongside the success count |
| Schedule created (RECURRING) | Confirmation card: schedule, SQL preview, "this will run automatically" |
| Schedule created (ALERT_TIER1) | Confirmation card: schedule, the wrapped check SQL, notification method (email/Pub/Sub) |
| Schedule updated | Confirmation card framed as a diff — "was: X, now: Y" for whatever changed (SQL, frequency, notification) rather than re-stating the whole config as if new |
| Saved query created (Tier 0 / general) | Confirmation card with name + "run now" action |
| Connection created | Confirmation card with connection ID and type |

---

## 7. Implementing the alerting tiers (§C of shared policies)

This skill is where Tier 0 and Tier 1 from the shared alerting pattern
actually get built.

**Tier 0 (saved check)**: create a Dataform saved-query resource whose SQL
is exactly the check from Data Quality (no `ERROR()` wrapping needed —
it's just re-run on demand). Use a consistent naming convention, e.g.
`dq_check:<table>:<checkType>`, so "show me my saved checks" can list and
filter by this prefix later without a separate registry.

**Tier 1 (scheduled + email)**: wrap the check SQL in the `ERROR()`
pattern from §C, then create a `transferConfigs` entry with:
- `data_source_id`: scheduled query
- `params.query`: the wrapped SQL
- `schedule`: the requested cadence (Data Transfer's schedule syntax)
- `email_preferences.enable_failure_email = true` (and/or
  `notification_pubsub_topic` if the user wants programmatic routing)

In both cases, **dry run the underlying check SQL first** (cost guardrail
policy §A) — a Tier 1 check that scans 500 GB on every run, daily, is a
very different cost profile than the same check run once interactively.
Surface this to the user when proposing a schedule frequency.

---

## 8. Cost & quota considerations

- **Load jobs**: no charge for the load operation itself, only resulting
  storage — generally the cheapest operation in this skill
- **Extract jobs**: free within the same region; cross-region extract to
  GCS incurs network egress charges — worth a note if destination bucket
  region differs from the dataset's
- **Sheets export**: no BigQuery cost, but Sheets has a **10 million cell**
  limit per spreadsheet — check `rowCount × columnCount` against this
  before attempting, and suggest GCS export for larger results
- **Scheduled queries (Tier 1 / recurring)**: each run is billed like any
  query — a forgotten daily schedule on a large table compounds. This is
  the main reason §7 says to dry-run and surface cost *before* the user
  commits to a frequency
- **Storage Write API**: separate per-byte ingestion pricing — relevant
  mainly if this skill is ever invoked from an automated pipeline rather
  than a chat turn

---

## 9. Follow-up / exploration hooks

Hand-offs use the shared envelope (`bigquery-shared-harness-policies.md`
§B).

- **Export complete** → "make this recurring" — re-enters this skill as a
  `SCHEDULE`/`RECURRING` operation using the same SQL
- **Load complete** → "show me the schema" (Schema, since the table is
  new/changed) or "profile this" (Data Quality)
- **Saved query created (Tier 0)** → "run it now" hands back to Data
  Quality/Query to execute the saved SQL immediately
- **Schedule created (Tier 1)** → "show me when this last ran" hands off
  to Monitoring — job history for that transfer config's runs
- **Connection created** → "query this external source" hands off to Query
  with the connection available for `EXTERNAL_QUERY`
