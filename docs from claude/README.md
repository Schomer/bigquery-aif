# README — BQ Chat Specification Set

An index of the 14 documents produced so far, how they depend on each
other, and a consolidated list of everything still soft, deferred, or
flagged for revisit — so implementation starts from an honest map rather
than 14 documents that each individually read as "done."

---

## 1. How these relate

**Schema is the foundation** — it's the only skill nothing else depends
on, and almost everything else depends on it (directly, or via its cache
contract). **Shared Harness Policies** (cost tiers, handoff contract,
alerting tiers) is the cross-cutting rulebook every skill's workflow
points to instead of restating. **Response Composition** wraps every
skill's output into the headline/artifact/provenance/next-actions
envelope. **Router & Orchestration** sits in front of all of it, deciding
which skill(s) get invoked. **Reference Dataset** grounds every example in
real table/column names.

| Skill | Primary dependencies |
|---|---|
| Schema | — (foundational; others depend on it) |
| Query | Schema (resolution), shared policies §A, response composition, visualization mapping |
| Data Management | Schema (resolution + invalidation signal back to it), shared policies §A/§B |
| Discovery | Schema (delegates comparison to it), shared policies §B |
| Data Quality | Schema (`tableConstraints`, `columns`), shared policies §A/§B/§C, Data Management (handoff) |
| Monitoring | Shared policies §B/§C, Data Loading (alerting handoff) |
| Data Loading | Shared policies §B/§C, Dataform/Data Transfer APIs (catalog §5/§8) |

---

## 2. Document index

| Document | Covers |
|---|---|
| `bigquery-capability-catalog.md` | Full BigQuery + adjacent GCP API surface by capability domain, mapped to skill modules |
| `bigquery-visualization-mapping.md` | Result-shape → chart-type mapping for all 21 visualization types |
| `task-taxonomy-coverage-map.md` | Every taxonomy task → skill, mechanism, primary artifact, catalog ref — the master cross-reference |
| `bigquery-shared-harness-policies.md` | §A cost-tier gating, §B handoff contract, §C data-condition alerting tiers |
| `bigquery-response-composition.md` | Headline/artifact/provenance/next-actions envelope, notability test, tone rules, worked examples |
| `reference-dataset.md` | Concrete schema (`orders`/`order_items`/`products`/`users`/`product_reviews`) + setup SQL |
| `bigquery-router-orchestration.md` | Intent classification, skill selection, multi-skill decomposition, continuation handling |
| `bigquery-skill-template.md` | **Query** — ad-hoc SQL, joins, aggregation |
| `bigquery-skill-schema.md` | **Schema** — metadata/structure, the caching contract others rely on |
| `bigquery-skill-discovery.md` | **Discovery** — search, comparison, lineage |
| `bigquery-skill-data-quality.md` | **Data Quality** — profiling, validation, saved checks (Tier 0) |
| `bigquery-skill-data-management.md` | **Data Management** — DML/DDL, destructive-op confirmation, dedup |
| `bigquery-skill-monitoring.md` | **Monitoring** — jobs, cost, performance, system-level alerting |
| `bigquery-skill-data-loading.md` | **Data Loading** — export/load/schedule/saved queries, Tier 0/1 alerting implementation |

---

## 3. Open items

### A. Deferred scope

- **ML/Analytics and Enrichment have no dedicated skill templates.** Simple
  cases route through Query calling `AI.*`/`ML.*` functions or external
  APIs directly (capability catalog §9/§14, coverage map, router §2).
  Build dedicated templates once usage shows which cases need their own
  trigger/routing logic.
- **Capacity Admin, Data Sharing, and Governance remain shelved** —
  config-only, build on actual need (capability catalog skill map).
- **MVP phasing across the 7 built skills isn't decided.** A real product
  call, not a design one.
- **Harness architecture isn't decided** — separate tools per skill, one
  BigQuery-execution tool plus system-prompt knowledge, or literal
  `SKILL.md` files. Shapes how everything else gets implemented.

### B. Soft judgment calls flagged for real-usage calibration

- **Turn-level lead-in for multi-card responses** (router §5/§8, response
  composition §7): no concrete trigger condition exists. The first live
  multi-card trace (the orders quality sweep) left this genuinely open —
  three related-but-independent cards, no lead-in, unresolved whether that
  reads as "one sweep" or "three outputs."
- **Next-action count per card**: composition §6 specifies a cap of 3–4,
  but live testing suggests the count should scale with how much there is
  to *act on* — "looks fine" cards naturally had 1, a decision-point card
  had 2. Not yet codified as a rule.
- **Emphasis criteria** (composition §4): live testing established that
  emphasis should locate something not obvious from the artifact's own
  structure (a sorted ranking doesn't need color to show "top 3" — the
  sort already does). This refinement was agreed but **never written back
  into the document**.
- **"Alert me" Tier 0/1 ambiguity**: resolved as "default to Tier 0, offer
  Tier 1 inline" and demonstrated live. This default-to-cheaper +
  inline-escalation pattern likely generalizes to other ambiguous
  phrasings beyond §C specifically, but that generalization isn't stated
  anywhere.

### C. Infrastructure referenced but not yet designed

- **Saved-check / schema-drift persistence** (Data Quality §8): both need
  a stored-history mechanism. Where it lives — user's project vs.
  app-managed — is undecided.
- **"Comparison view" composition mechanics**: the visualization mapping
  doc describes it as "two instances of any shape, side by side," but the
  router's default is to stack independent envelopes as separate cards.
  How two envelopes become *one* side-by-side artifact instead of two
  stacked cards isn't specified.
- **Cross-invocation parallel execution** (router §5): "runs in parallel"
  needs translation into actual harness mechanics — multiple tool calls in
  one turn vs. sequential calls.
- **Cost-tier thresholds** (shared policies §A): explicitly defaults: "make
  these configurable per deployment" — no configuration mechanism is
  specified.
- **Forecast-band / anomaly-flag visual treatment**: the coverage map
  references "line chart — history + forecast band" and "rows with
  `is_anomaly` emphasized," but the visualization mapping doc doesn't
  detail how these specific treatments render.

### D. Known limitations / accepted trade-offs (intentional, not bugs)

- **Tier 1 alerting**: a silent schedule failure looks identical to
  "nothing to report — check passed." Named explicitly; the Pub/Sub
  escalation path (Tier 2) is bring-your-own-infrastructure.
- **`tableConstraints` will often be empty** — BigQuery doesn't enforce
  FK/PK. Data Quality's fallback-to-heuristic/ask path is likely the
  *common* case for real tables, not the exception.
- **A saved check referencing a later-dropped column fails on next run**,
  discovered only then. Acceptable; a proactive warning at invalidation
  time is optional/future.
- **Discovery's lineage and cross-project search depend on APIs that may
  not be enabled.** A soft fallback exists, but "not configured" can look
  identical to "no results" — a one-time setup check might help.

### E. Verification needed before first real trace

- **`reference-dataset.md` column names are reconstructed from
  documentation, not verified against a live copy.** The first Schema
  skill call against the copied tables should confirm or correct this
  document — itself the first real trace.

---

## 4. Suggested pre-implementation activities

- **Write up the live-tested scenarios from this conversation as a named
  eval/scenario suite** (input → expected skill/mechanism/artifact/tone) —
  the dedup confirm/execute flow, the revenue-anomaly query, the top-products
  ranking, and the orders quality sweep are all already traced and close to
  free to formalize.
- **Decide MVP phasing and harness architecture** (§A above) — these gate
  how everything else gets built.
- **Run the reference dataset setup SQL for real**, then use the Schema
  skill's own output to correct §E above.
