---
name: orchestrator-skills
description: Guide for implementing or modifying BigQuery skill handlers in the orchestrator. Use when adding new skills, modifying existing handlers, or debugging skill dispatch.
---

# Orchestrator Skill Development

How to add, modify, or debug skill handlers in the BigQuery AIF orchestrator.

---

## Required reading before changes

1. `.agents/knowledge/invariants.md` -- does your change violate any rule?
2. `.agents/knowledge/component-map.md` -- understand boundaries and line ranges
3. `.agents/knowledge/test-cases.md` -- will your change break any canonical scenario?
4. `.agents/knowledge/prompt-versions.md` -- if changing any LLM prompt

Full design specs live in `docs from claude/`. Key references:
- `bigquery-router-orchestration.md` -- routing and dispatch architecture
- `bigquery-response-composition.md` -- how results become user-facing output
- `bigquery-capability-catalog.md` -- full API inventory by skill domain

---

## Skill handler contract

Every skill handler receives these inputs:

```
message:         string              -- the user's current message
context:         ConversationContext  -- history, lastSkill, lastTable, lastDataset
enrichedContext: {
  resolvedProject:    string         -- active GCP project ID
  resolvedDataset:    string | null  -- resolved dataset (may be null)
  resolvedTable:      string | null  -- resolved table (may be null)
  availableDatasets:  string[]       -- fetched once per turn, shared across handlers
}
```

Every handler must return a skill result object (typed per skill in `src/lib/types.ts`). That result gets passed to `compose()` in `src/lib/composer.ts`, which wraps it in a `CompositionEnvelope`. The handler does not render UI directly.

Key result types: `SchemaResult`, `QueryResult`, `DataManagementResult`, `DataQualityResult`, `MonitoringResult`, `DiscoveryResult`, `DataLoadingResult`.

---

## Schema context rules

`buildSchemaContext()` fetches column metadata to include in the LLM prompt:

- **Max 5 tables** from the active dataset
- **Priority table always included**: when the user names a specific table, it occupies the first slot. The remaining 4 are filled from other tables in the dataset.
- **Sample values**: for the priority table, up to 3 `DISTINCT` sample values are fetched for up to 3 `STRING` columns. These samples run as lightweight `LIMIT 3` queries in parallel. Failures are silently ignored.
- **The LLM prompt must include a `CRITICAL` instruction** naming the target table. Without this, the LLM will hallucinate a table from its training data when the target is not among the first 5 alphabetically.

---

## How to register a new skill

### Step 1: Add routing signals in `src/lib/router.ts`

Add keyword signals to the appropriate signal list (or create a new one). Follow the existing pattern:
- Use `\\b` word-boundary matching for verbs that could appear in table names
- Assign weights (1-5) reflecting signal strength
- Add counterbalancing signals to competing skills if words are ambiguous
- See invariant: "Ambiguous words need counterbalancing signals"

### Step 2: Add response schema in `src/lib/chat-orchestrator.ts`

Add a JSON Schema definition in the response schemas section (lines ~189-327) that structures the LLM's output for this skill. This schema is passed to `callGemini()` as the `responseSchema` parameter for structured output.

### Step 3: Create handler in `src/lib/chat-orchestrator.ts` or `src/lib/skills/`

Currently, only the schema skill has been extracted to its own file (`src/lib/skills/schema.ts`). All other handlers are inline in the orchestrator. For new skills:
- Add to the dispatch switch in `processMessage()` (lines ~536-560)
- Implement the handler function following the contract above
- Use `buildSchemaContext()` if the handler needs table metadata
- Use `callGemini()` for any LLM calls (it handles retries and structured output)
- Return the appropriate result type

### Step 4: Add compose function in `src/lib/composer.ts`

Add a `compose[SkillName]()` function that transforms the handler's result into a `CompositionEnvelope`. The function must determine:
- Headline text and tone (`NEUTRAL`, `POSITIVE`, `ATTENTION`)
- Primary artifact type and data
- Provenance (SQL, cost, jobId)
- Next-action handoff chips (capped at 4, as `HandoffEnvelope[]`)
- Quality flags (if applicable, capped at 5)

### Step 5: Add UI component or extend `ArtifactCard`

`ArtifactCard.tsx` routes `CompositionEnvelope` to view components based on `primaryArtifact.type`. Either:
- Extend an existing view component to handle the new artifact type
- Create a new view component in `src/components/`
- Wire it into `ArtifactCard`'s type routing

### Step 6: Add test cases

- Add canonical scenarios to `.agents/knowledge/test-cases.md`
- Run `node scripts/snapshot-test.mjs` to validate routing
- Consider adding entries to `scripts/task-catalog.mjs` for end-to-end testing

---

## Self-review integration

The orchestrator runs a self-review pass after skill dispatch (lines ~1019-1197):

- **When it runs**: data-management confirmations, complex queries (100+ rows), monitoring/quality reports, LLM-classified requests (medium/low confidence)
- **When it is skipped**: schema PROJECT/DATASET scope, KPI_CARD artifacts, high-confidence keyword-routed queries with <100 rows
- **What it can change**: headline text/tone, emphasis highlights, next-action ordering. It cannot change the primary artifact data or type.
- **Non-fatal**: if self-review throws, the original envelope is returned unchanged. Never make self-review failures block response delivery.

---

## Required actions after changes

1. **Update ops-ledger**: add entry to `.agents/knowledge/ops-ledger.md` with what worked, what broke, root cause, derived rule
2. **Update changelog**: add session entry to `.agents/knowledge/changelog.md`
3. **Update prompt versions**: if any LLM prompt changed, log in `.agents/knowledge/prompt-versions.md`
4. **Update invariants**: if a new invariant was discovered, add to `.agents/knowledge/invariants.md`
5. **Update component map**: if line ranges shifted significantly, update `.agents/knowledge/component-map.md`
6. **Run snapshot tests**: `node scripts/snapshot-test.mjs`
7. **Build**: `npm run build`
8. **Deploy**: `git add -A && git commit -m "..." && git push` then `node scripts/deploy.mjs`
