# Response Composition

How a skill's normalized result becomes the thing the user actually sees.
This is the Composer step's responsibility (per the original harness
sketch — Intent → Skill → Compose → Render → Explore), formalized here as a
contract every skill's output passes through on the way to the screen.

---

## 1. The four-part anatomy

Every response, regardless of which skill produced it, has up to four
parts:

1. **Headline** — the takeaway, in plain language. What happened, or what
   matters about the result. Not always present as a distinct sentence for
   trivial cases, but always *considered*.
2. **Primary artifact** — the actual content: a chart, table, confirmation
   card, status card. Selected per the visualization mapping doc, or a
   skill-specific card type (confirmation, schedule summary, etc.)
3. **Provenance** — SQL, cost, time range, freshness, cache status. Present
   for almost everything, but collapsed by default — it's what makes the
   other parts trustworthy without dominating them.
4. **Next actions** — handoff chips per the shared handoff contract
   (`bigquery-shared-harness-policies.md` §B).

The headline is the only part that requires *judgment* rather than
*selection* — picking a chart type or formatting provenance is mostly
mechanical given the normalized result, but deciding what's worth saying
in a sentence is a reasoning step. Most of this doc is about that step.

---

## 2. The composition envelope

```json
{
  "headline": {
    "text": "Looks healthy overall, but customer_email is missing on about 1 in 8 orders.",
    "tone": "NEUTRAL | POSITIVE | ATTENTION",
    "basis": "STATUS | DEVIATION | THRESHOLD | COMPARISON | DIRECT_ANSWER"
  },
  "primaryArtifact": {
    "type": "TABLE | LINE_CHART | CONFIRMATION_CARD | ...",
    "data": { },
    "emphasis": {
      "highlight": ["customer_email"],
      "deemphasize": []
    }
  },
  "provenance": {
    "visibility": "COLLAPSED | VISIBLE",
    "sql": "...",
    "cost": { "totalBytesProcessed": 52428800, "tier": 1 },
    "freshness": "...",
    "sourceResultRef": "result_xyz"
  },
  "nextActions": [ ]
}
```

- `data` in `primaryArtifact` is the skill's own normalized result —
  this envelope wraps it, doesn't replace it
- `emphasis` lets the Composer mark specific rows/columns/series within the
  artifact as worth attention, independent of the headline — see §4
- `provenance.visibility` defaults to `COLLAPSED` except where §5 says
  otherwise
- `nextActions` is a list of handoff envelopes (§B of the shared policies
  doc), capped per §6

---

## 3. Headline guidance

### The notability test

A finding is headline-worthy if **at least one** is true:

1. **Deviation** — it differs from a baseline: other peers in the same
   result (other columns in a profile, other jobs in a cost report), a
   prior period, or a prior run of the same saved check
2. **Threshold** — it crosses a defined line: a Data Quality `severity` of
   `WARNING`/`ISSUE`, a `COST_CONFIRM` tier, an anomaly flag from
   `AI.DETECT_ANOMALIES`
3. **Direct answer** — it's the actual answer to the implicit question,
   even if not the literal data requested (a type change in a schema diff
   that "could affect rounding" is the *point* of the comparison, not just
   a row in a diff table)
4. **Unexpected given the operation** — 0 rows affected by an `UPDATE`
   that should have matched something, an export that hit a size limit,
   a saved check whose result flipped since last run, or **a result that
   differs from a number stated earlier in the same flow** — e.g. a
   confirmed dedup preview of 18 rows resulting in 16 removed. For this
   last case, just state both numbers in one sentence: "Removed 16 of the
   18 rows — the other 2 no longer matched by the time this ran." Don't
   speculate about *why* beyond that.

If **none** apply, the headline is a **status statement** — concise
confirmation of what ran. If the *absence* of a finding is itself
reassuring, frame it that way ("No duplicates found — looks clean") rather
than as a flat non-event.

### Computing a baseline isn't free

"Deviation" and "Comparison" bases often imply a second query (prior
period, prior run). That query goes through the same cost-tier guardrails
(§A of the shared policies doc) as any other — don't silently double the
cost of every interaction to chase a comparison. Prefer baselines
derivable from data already in hand (e.g., comparing columns *within* one
profile result needs no extra query) before reaching for a new one, and
treat an explicit comparison query as its own cost-aware step when it is
needed.

### Anti-patterns

- **Restating the request**: "Here are the results for revenue by month" —
  the user knows what they asked; say something about the *answer*
- **Leading with operation metadata**: "Query completed in 1.2s, scanned
  50MB, returned 12 rows" — this is provenance, not a headline
- **Vague hedging**: "There might be some interesting patterns here" —
  either name the pattern or say nothing
- **Over-narrating routine success**: "Great! I've successfully completed
  your request!" — proportional enthusiasm; a routine export doesn't need
  celebration

### Tone → visual treatment

| `tone` | When | Treatment |
|---|---|---|
| `NEUTRAL` | Status statements, routine results | Default styling, no accent |
| `POSITIVE` | Good-news framing of an absence-of-finding | Subtle positive accent (a checkmark, light tint) — not celebratory |
| `ATTENTION` | `WARNING`/`ISSUE` severity, threshold crossed, notable deviation | Subtle warm accent — reserve stronger/red treatment for `ISSUE`-level or destructive-op contexts specifically, not all `ATTENTION` |

This keeps "calm design" (§7) concrete: `ATTENTION` is a spectrum, not a
single alarm state.

---

## 4. Primary artifact: selection and emphasis

**Selection** follows the visualization mapping doc — result shape →
component, as already specified there.

**Emphasis** is the part that's new here: within the chosen artifact, the
Composer can mark specific elements as worth attention without changing
the artifact type. This is *how* a headline finding becomes visible in the
artifact itself, not just in a sentence above it:

- A flagged column in a profile table: pinned to the top, or visually
  distinguished (the other columns aren't hidden, just quieter)
- An anomalous point in a time series: a different marker/color on that
  one point, not a redesign of the chart
- The job responsible for a cost spike: highlighted row in a sortable table
  rather than a separate callout

The artifact stays recognizable as "a table" / "a line chart" — emphasis
is a layer on top, not a different component. This is also what makes the
**de-emphasized** elements not disappear: a user who wants to verify "is
everything else really fine?" can still see everything else, just quieter.

**When emphasis earns its place vs. when it's redundant**: emphasis is
useful when it helps *locate* something that isn't otherwise
distinguishable from its neighbors — an anomalous point among many similar
ones in a time series, a flagged row in an unordered table. It's redundant
when the artifact's own structure already makes the relevant item obvious
— a sorted Top-N bar chart doesn't need its top bars colored differently,
because the sort order and bar length already show "these are the top
ones." Don't add emphasis just because something was mentioned in the
headline; add it only when the artifact wouldn't otherwise reveal it.

---

## 5. Provenance

**Contents**: SQL executed, `totalBytesProcessed` + cost tier, time range
covered, freshness/cache status (e.g., "from Schema cache, refreshed 4 min
ago"), `sourceResultRef`.

**Default visibility**: `COLLAPSED` — one click/tap away, never the first
thing seen.

**Exceptions** (`VISIBLE` by default):

- Anything at `COST_NOTICE` tier or above (shared policy §A) — cost is
  shown prominently per that policy regardless of this doc's defaults
- Any `COST_CONFIRM`-gated operation — the estimate is part of the
  confirmation itself, not provenance to dig for
- Results explicitly *about* provenance (Monitoring's job-status results,
  Discovery's lineage) — here the "provenance" *is* the primary artifact,
  so this section is moot for those result types

---

## 6. Next actions

- **Source**: handoff envelopes per `bigquery-shared-harness-policies.md`
  §B — each carries prefilled `context` so accepting one doesn't require
  re-stating anything
- **Count**: cap at **3–4** visible actions. More than that and it stops
  being "suggestions" and starts being "a menu" — if a skill's follow-up
  hooks list has more candidates than that, the Composer picks the most
  relevant given what was notable in the headline, not just the first N in
  the template
- **Ordering**: the action most related to whatever the headline called
  out goes first — if the headline flagged `customer_email` nulls, "show
  me orders missing an email" outranks generic "break down by X" suggestions
- **Confirmation contexts**: for destructive operations, "next actions" in
  the normal sense don't apply yet — Confirm/Cancel *are* the actions,
  rendered per Data Management's own UI mapping, not this section. Once
  confirmed and executed, normal next-action rules resume

---

## 7. Cross-cutting principles

**Progressive disclosure is the default.** One headline, one primary
artifact, provenance and secondary findings one tap away. The
visualization mapping doc's "when in doubt, table" is the artifact-level
version of this; "when in doubt, say less and let them ask" is the
response-level version.

**Visual threading via `sourceResultRef`.** When a response is a direct
consequence of a prior one (a Data Management confirmation following a
Data Quality finding, a Discovery comparison following a search result),
it should *look* connected — not a fresh unrelated card. Exact treatment
(connecting line, "from your duplicate check" tag, nested/indented card) is
a UI implementation choice, but the data to support it
(`sourceResultRef`) already exists in the handoff contract.

**Calm design for confirmation/destructive paths.** Per §3's tone table,
reduce anxiety through *specificity*, not warning chrome. The dedup example
in §8 below is the model: showing one concrete example group (these exact
rows, this exact tiebreaker) does more for trust than a louder "ARE YOU
SURE?" around an abstract count.

**Empty and error states are designed, not defaulted.** "No duplicates
found" is good news (§3, `POSITIVE` tone) — it shouldn't render identically
to "no rows match your filter" (neutral) or "this query failed" (error).
Each of these is a distinct moment with a distinct appropriate framing, not
three variations of an empty `<table>`.

---

## 8. Worked examples (generic vs. smart)

Each pair shows the same underlying normalized result, composed two ways.

### Query — "revenue by month" with one anomalous month

| | Generic | Smart |
|---|---|---|
| Headline | "Here is revenue by month (12 rows)." | "Revenue grew steadily through the year except March, which dropped to near zero — worth checking for a data gap." |
| Tone / basis | `NEUTRAL` / `STATUS` | `ATTENTION` / `DEVIATION` |
| Artifact | Line chart, all months equal weight | Same line chart, March's point visually distinguished (emphasis, not redesign) |
| Next actions | "Break down by category", "Compare to last year" | "Show me March's daily breakdown" (Query), "Check March's data completeness" (Data Quality) — March-specific actions ranked first |

### Data Quality — table profile

| | Generic | Smart |
|---|---|---|
| Headline | "Profile complete: 8 columns analyzed across 1,048,576 rows." | "Looks healthy — 7 of 8 columns are complete and in range. `customer_email` is null on about 12% of rows." |
| Tone / basis | `NEUTRAL` / `STATUS` | `ATTENTION` / `THRESHOLD` |
| Artifact | Full column table, uniform | Same table; `customer_email` row pinned/highlighted, others present but quieter |
| Next actions | Generic re-run/export options | "Show me orders missing an email" (Query), "Fill these in" (Data Management) |

### Data Management — deduplication confirmation

| | Generic | Smart |
|---|---|---|
| Headline | "12 duplicate groups found, 18 rows would be removed. Confirm?" | "Found 18 duplicate rows across 12 orders — for each, I'll keep the most recently updated copy." |
| Tone / basis | `NEUTRAL` / `STATUS` | `NEUTRAL` / `DIRECT_ANSWER` |
| Artifact | Confirmation card, numbers only | Confirmation card showing **one concrete example group** — the actual key value, the row being kept (with its `updated_at`) vs. the row(s) being removed — plus "and 11 more groups like this" |
| Next actions | Confirm / Cancel | Confirm / Cancel (unchanged — but trust is built by the artifact, not extra actions) |

### Monitoring — cost analysis

| | Generic | Smart |
|---|---|---|
| Headline | "Here are your top 10 queries by bytes processed this month." | "Costs are up about 40% vs. last month, mostly from one query that started running daily two weeks ago." |
| Tone / basis | `NEUTRAL` / `STATUS` | `ATTENTION` / `COMPARISON` |
| Artifact | Sortable table, all jobs equal | Same table; the identified job pinned to top/highlighted |
| Next actions | "Break down by user/table" | "Show me that query's SQL" (Monitoring), "Can this be optimized?" (Monitoring → Query) — ranked first |

### Schema — describe a table

| | Generic | Smart |
|---|---|---|
| Headline | "`orders` has 14 columns, 1,048,576 rows, last modified 2026-06-13." | "`orders` is partitioned by `order_date` and clustered by `customer_id` — filtering on these keeps queries cheap." |
| Tone / basis | `NEUTRAL` / `STATUS` | `NEUTRAL` / `DIRECT_ANSWER` (structure framed as actionable, not just listed) |
| Artifact | Flat column table | Same table, with partition/cluster columns visually marked |
| Next actions | "Show sample rows" | "Show sample rows" (Query), "Profile this table" (Data Quality) |

### Discovery — table comparison

| | Generic | Smart |
|---|---|---|
| Headline | "Comparing `orders_v1` and `orders_v2`: schema diff below." | "`orders_v2` adds `discount_code` and changes `total` from `FLOAT64` to `NUMERIC` — that type change could affect rounding in existing queries against `total`." |
| Tone / basis | `NEUTRAL` / `STATUS` | `ATTENTION` / `DIRECT_ANSWER` |
| Artifact | Diff table | Same diff table; the type change row highlighted |
| Next actions | none specific | "Find queries that reference `total`" (Discovery search) — ranked first |

### Data Loading — export

| | Generic | Smart |
|---|---|---|
| Headline | "Export complete. 1,048,576 rows written to `gs://bucket/orders.csv`." | "Done — `orders.csv` is ready (1.05M rows, ~80MB)." *(routine — concise, not expanded)* |
| Tone / basis | `NEUTRAL` / `STATUS` | `NEUTRAL` / `STATUS` — **the "smart" version here is restraint**, not added insight |
| Artifact | Download link | Download link |
| When notable | — | If a Sheets export is near the 10M-cell limit: "Done, but this is close to Sheets' limit (9.2M of 10M cells) — larger exports will need GCS." `ATTENTION` / `THRESHOLD` |

The Data Loading example is the reminder that "smart" doesn't mean "every
response gets a finding" — most routine operations should stay exactly
that routine, and the skill of the Composer is knowing *which* responses
warrant more.
