# Router & Orchestration Layer

The piece that sits between an incoming message (plus conversation state)
and one or more skill invocations. Everything built so far assumes "the
right skill has already been selected with the right context" — this
defines how that happens.

---

## 1. Role and output shape

The router's output is **one or more handoff envelopes** — the same
structure already defined in `bigquery-shared-harness-policies.md` §B, just
with a different producer. Normally an envelope is constructed by a prior
skill's Composer (`sourceSkill: "DataQuality"`, context pre-filled from a
result). The router constructs the same shape from a fresh message
(`sourceSkill: "user"`, context derived from the message + conversation
state). No new data structure — the router is a new *source* of an
existing one.

This keeps the boundary narrow. The router does **not**:
- Generate SQL (each skill's workflow does that)
- Choose chart types (visualization mapping / Composer)
- Apply cost gates (shared policy §A — happens inside the dispatched skill)

The router decides: **which skill(s)**, **how many invocations**, and
**what context** each one starts with.

---

## 2. Skill-selection reference

A condensed version of each skill's §1 trigger conditions — full detail
lives in the named template.

| Skill | Signal | Hard exclusion |
|---|---|---|
| Query | Analytical questions: "show me / what's / how many / group by / join / trend / compare" | — |
| Data Management | **Explicit mutating verbs**: delete, remove, update, fix, merge, dedupe, alter, create table/view, partition, cluster, copy | Never selected from a request that only *sounds* like it might involve a change — see §3 |
| Schema | Structure questions about a known object: "what columns/schema of X / describe X" | — |
| Discovery | Finding or relating objects across a wider scope: "search for / find a table with / compare X and Y / where does this come from / what depends on" | — |
| Data Quality | Health-of-data questions: "profile / quality / duplicates / nulls / validate / freshness / completeness / drift" | — |
| Monitoring | System/job-state questions: "what's running / why slow / cost / expensive / slot usage / failed job / who ran" | — |
| Data Loading | "export / download / schedule / recurring / save this query / send to Sheets / connect to / load" | — |
| ML/Analytics (deferred) | "forecast / predict / classify / sentiment / anomaly / cluster / train a model" — routed to Query calling `AI.*`/`ML.*` | — |
| Enrichment (deferred) | "translate / geocode" — routed to Query calling external API or `AI.GENERATE` | — |

"Alert me if..." is **not** in this table — it's a special pattern, §4.

---

## 3. Hard rule: ambiguous read/write defaults to read

"Show me the duplicates" → Data Quality. "Remove the duplicates" → Data
Management. "Are there any duplicates" → Data Quality. The distinguishing
signal is an **explicit mutating verb** — its absence means Data Quality
(or Query), never Data Management.

This isn't just a heuristic preference — it's the thing that makes Data
Management's destructive-operation gates (§5 of that template) meaningful.
Those gates assume Data Management is only ever entered *deliberately*. The
sanctioned path from "look at a problem" to "fix it" is Data Quality's
"remove these" handoff (which seeds Data Management's `operationHint` per
§B's context-shape table) — never the router landing on Data Management
directly from an ambiguous read-shaped request.

---

## 4. Special routing pattern: alerting (§C)

"Alert me if X" doesn't map to one skill — it requires the three-way
classification from `bigquery-shared-harness-policies.md` §C **at routing
time**, because the answer determines which skill(s) get invoked at all:

1. **Project-wide aggregate condition** → Monitoring, `alertPolicies`
   directly
2. **This specific job/schedule's stats** → Monitoring authors the check,
   Data Loading executes it as Tier 0/1
3. **Row-content/data condition** → Data Quality authors the check, Data
   Loading executes it as Tier 0/1

The router applies this classification itself (the question from §C: *does
an existing aggregate metric already mean what's being asked, or does this
need to scope to one specific job/table/schedule?*) rather than dispatching
to Monitoring and hoping it redirects. For cases 2 and 3, this produces
**two envelopes**: one to the authoring skill (Monitoring or Data Quality)
to produce the check SQL, and one to Data Loading with that SQL in its
`context` — see the worked example in §7.

---

## 5. Multi-skill decomposition within a turn

A single message can require multiple invocations. The rule for *when*:

- **Explicit multi-part requests** ("profile orders and check for
  duplicates") → decompose into multiple invocations **this turn**
- **Skill-suggested follow-ups** (a skill's own next-actions) → offered as
  handoff chips for the **next** turn, never auto-executed

For invocations within one turn:

- **Schema resolution is shared** — if two invocations reference the same
  table, Schema resolves once (per its own cache contract, §7/§8 of that
  template) and both consume the same result
- **Independent invocations run in parallel** when neither's context
  depends on the other's output (the common case — most "X and Y" requests
  are two independent reads)
- **Dependent invocations run sequentially** when one's context is derived
  from another's result — e.g., an alerting envelope (§4 case 3) whose
  `context.sql` comes from a Data Quality invocation's output

**Composing the response**: each invocation produces its own envelope per
`bigquery-response-composition.md` — its own headline, artifact,
provenance, next actions. The renderer stacks them in invocation order.
A turn-level lead-in sentence above the stack is the exception, not the
default — only when there's a genuine relationship between the cards worth
naming (itself a notability judgment, §3 of that doc), not a summary
generated for every multi-card turn.

---

## 6. Continuation, referential resolution, and handoff-originated messages

Three cases for how a message relates to what came before:

- **Handoff-originated** (the message is a chip click): `context` is
  already populated by the originating skill's Composer. The router's job
  shrinks to confirming `targetSkill` and dispatching — no fresh
  classification needed. `sourceResultRef` carries forward for visual
  threading (`bigquery-response-composition.md` §7).
- **Referential free text** ("undo that," "what about for Q2," "show me
  those rows") — resolve "that"/"those"/"it" against the most recent
  result's `sourceResultRef` before classifying, so the skill invocation
  starts with the right object already in scope.
- **Fresh topic** — no referential language, doesn't match recent context.
  Treat as new: fresh Schema resolution, no inherited `sourceResultRef`.

---

## 7. Redirect (soft, suggestion-based)

Occasionally a dispatched skill discovers mid-flow that it isn't the right
owner — e.g., Discovery's search returns nothing because the user actually
named a column that exists on a table they already know about (a Schema
question, not a Discovery one). This is **not** a silent re-route. The
skill's response surfaces it the same way any next-action would: "I didn't
find a match for that — did you mean the `orders` table's `status`
column?" as a handoff chip to Schema. The user confirms; nothing executes
behind their back based on a guess about what they "really" meant.

---

## 8. Worked example

**Message**: *"Profile the orders table, check it for duplicates, and
alert me if duplicates show up again."*

1. **Decompose** (§5): three asks — profile, duplicate check, alert —
   none of which depend on each other's *input*, though the third depends
   on the second's *output*.

2. **Envelope 1** → Data Quality, `checkType: PROFILE`,
   `context: { table: "PROJECT.ecommerce.orders" }`

3. **Envelope 2** → Data Quality, `checkType: DUPLICATES`,
   `context: { table: "PROJECT.ecommerce.orders" }`
   — runs in parallel with #1 (independent, same table — Schema resolves
   once and both consume it)

4. **Alert classification** (§4): "duplicates show up again" is a
   row-content condition → case 3. This produces:

   **Envelope 3** → Data Loading, `destination.type: SAVED_CHECK` (Tier 0
   default, per the shared policy's pull-before-push framing),
   `context: { sql: <the DUPLICATES check SQL from envelope 2's result>,
   alertCondition: { description: "duplicates found in orders" } }`
   — sequential after #2, since its `context.sql` *is* #2's output

**Response**: three cards stacked — profile (likely `POSITIVE`/`STATUS` if
clean), duplicate-check results (table of groups or `POSITIVE` empty
state), and a Tier 0 confirmation ("Saved — ask me to re-check this
anytime"). No turn-level lead-in unless the profile and duplicate-check
results turn out to be related in some notable way (e.g., the duplicated
rows are concentrated in the column the profile flagged) — in the normal
case, three independent cards is the right amount of synthesis.
