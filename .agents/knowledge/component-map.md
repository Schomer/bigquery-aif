# Component Boundary Map

A guide to the codebase structure, key files, their responsibilities, and where to find things. Consult this before making changes to understand what you're touching and what might be affected.

Last updated: 2026-07-07

---

## Architecture Overview

```
User Message
    |
    v
API Route (src/app/api/chat/route.ts)
    |
    v
Router (src/lib/router.ts)
  - Keyword scoring: classifyIntent()
  - Reference resolution: resolveReferences()
    |
    v
Orchestrator (src/lib/chat-orchestrator.ts) -- 307 lines, dispatch only
  - LLM classifier (medium/low confidence fallback)
  - Skill dispatch (switch on skill name)
  - Self-review pass
    |
    v
Skill Handlers (src/lib/skills/handle-*.ts)
  - handle-schema, handle-query, handle-data-management,
    handle-data-quality, handle-monitoring, handle-discovery,
    handle-data-loading, handle-task
    |
    v
Infrastructure (src/lib/{gemini-client,orchestrator-utils,self-review}.ts)
  - Gemini API client, dataset resolution, self-review pass
    |
    v
Composer (src/lib/composer.ts)
  - compose(skill, result) -> CompositionEnvelope
    |
    v
UI Components (src/components/)
  - Render envelopes as cards/charts/tables
```

---

## Core Files

### `src/lib/router.ts` (456 lines)
**Responsibility**: Intent classification via weighted keyword scoring.
- Lines 14-231: Signal lists (MUTATING_VERBS, DATA_QUALITY_SIGNALS, SCHEMA_SIGNALS, etc.)
- Lines 233-253: `scoreSignals()` -- the scoring engine
- Lines 255-302: `getContextBoosts()` -- follow-up action pattern matching
- Lines 316-433: `classifyIntent()` -- main classification function
- Lines 440-455: `resolveReferences()` -- pronoun resolution

**Key invariant**: Mutating verbs get checked first (line 328). High-confidence mutating verb match returns immediately unless a strong quality signal is also present.

---

### `src/lib/chat-orchestrator.ts` (307 lines)
**Responsibility**: Thin dispatch layer. Routes classified intents to skill handlers.
- Lines 1-40: Imports (handler modules, infrastructure, types)
- Lines 42-68: `ProcessMessageArgs` and `OrchestrationResult` interfaces
- Lines 70-307: `ChatOrchestrator.processMessage()` -- main entry point
  - Lines 72-77: Confirmation handling (delegates to `executeConfirmedOperation`)
  - Lines 82-83: Reference resolution
  - Lines 87-165: Intent classification (keyword first, LLM fallback)
  - Lines 177-200: Skill dispatch switch (8 handlers)
  - Lines 205-256: Self-review pass with skip heuristics

---

### `src/lib/gemini-client.ts` (~330 lines)
**Responsibility**: Gemini API client and response schemas.
- `callGemini()` -- structured output with retry logic
- `callGeminiWithSchema<T>()` -- typed wrapper for structured output (used by task resolver)
- `loadSkillDoc()` -- loads skill .md files from /public/skills/
- All response schemas: `SchemaResponseSchema`, `QueryResponseSchema`, `DataManagementResponseSchema`, `MonitoringIntentSchema`, `DqIntentSchema`, `DiscoveryResponseSchema`, `DataLoadingIntentSchema`, `IntentClassifierSchema`, `SelfReviewResponseSchema`, `EnrichedSchemaQuerySchema`

---

### `src/lib/orchestrator-utils.ts` (182 lines)
**Responsibility**: Shared utility functions used across handlers.
- `bqConsoleUrl()` -- generates BigQuery Console deep links
- `stepWithLink()` -- creates status step with Console link
- `getAvailableDatasets()` -- lists datasets via BigQuery API
- `resolveDefaultDatasetFromList()` / `resolveDefaultDataset()` -- picks default dataset
- `extractDatasetFromMessage()` -- scans message text for dataset names
- `buildConversationStateSummary()` -- context summary for LLM prompts
- `buildSchemaContext()` -- loads table columns for SQL generation context

---

### `src/lib/self-review.ts` (192 lines)
**Responsibility**: LLM review pass that evaluates and improves composed output.
- `buildReviewSnapshot()` -- extracts reviewable fields from envelope
- `selfReviewEnvelope()` -- single Gemini pass across 4 dimensions (comprehension, completeness, presentation, visual design)

---

## Skill Handlers (`src/lib/skills/`)

### `handle-schema.ts` (420 lines)
- Keyword-based scope classifier (DATASET_LIST_SIGNALS, TABLE_LIST_SIGNALS, TABLE_DESCRIBE_SIGNALS)
- Enrichment patterns and fast-path SQL generation (`tryFastEnrichment`)
- Regex entity extraction (`extractSchemaIdentifiers`)
- Main handler: `handleSchema()` -- scope resolution, enrichment, metadata fetch
- Cross-dataset table search fallback

### `handle-query.ts` (259 lines)
- Plan cache check (`findReusablePlan` / `cachePlan`)
- SQL generation via Gemini with full visualization type catalog
- Dry-run cost check
- Auto-retry on SQL errors (sends error back to Gemini for fix)
- Result quality analysis via `analyzeResultQuality()`

### `handle-data-management.ts` (275 lines)
- DML plan generation (INSERT, UPDATE, DELETE, CREATE, ALTER, etc.)
- Preview/confirm flow with safety net
- Safety-net redirect to query handler via lazy `await import('./handle-query')`
- `executeConfirmedOperation()` -- runs confirmed DML statements

### `handle-data-quality.ts` (489 lines)
- 8 check types: PROFILE, NULLS, DUPLICATES, FRESHNESS, COMPLETENESS, RANGE_VALIDATION, REFERENTIAL_INTEGRITY, SCHEMA_DRIFT
- Batched column profiling with cost gate (dry-run before execution)
- Auto-retry with safe query on GEOGRAPHY/STRUCT column errors
- LLM-assisted range expectations and FK relationship detection

### `handle-monitoring.ts` (770 lines)
- 9 sub-types: JOBS, STORAGE, SLOTS, QUERY_PLAN, ALERT, STORAGE_BREAKDOWN, ACCESS_PATTERNS, COST_ANALYSIS, FRESHNESS
- Alert three-way classification (PROJECT_WIDE, JOB_SPECIFIC, DATA_CONDITION)
- Save/schedule check actions via handoff context
- Keyword fast-path for cost and freshness to avoid LLM misrouting
- `normalizeTimestamp()` helper for BigQuery timestamp formats

### `handle-discovery.ts` (386 lines)
- 4 discovery types: SEARCH, COMPARISON, LINEAGE, ER_DIAGRAM
- Table search across datasets
- Column-level lineage via INFORMATION_SCHEMA.JOBS
- ER diagram generation from FK/naming conventions

### `handle-data-loading.ts` (232 lines)
- 5 operation types: EXPORT_CSV, EXPORT_SHEETS, SCHEDULE, SAVED_QUERY, SHARE
- Google Sheets export via BigQuery extract
- Scheduled query creation via Data Transfer API
- Query save to Firestore

### `handle-task.ts` (105 lines)
- Generic task resolver for Google Cloud data tasks
- Delegates to task framework (resolver, executor, learned plans)


---

### `src/lib/composer.ts` (~865 lines)
**Responsibility**: Transforms skill results into CompositionEnvelopes.
- Each skill has a dedicated `compose[Skill]` function
- Determines headline text and tone
- Selects artifact type
- Generates next-action handoff chips (including from quality flag suggested actions)
- Formats provenance metadata
- Accepts optional `qualityFlags` parameter, attaches to envelope for query results

---

### `src/lib/plan-cache.ts` (174 lines)
**Responsibility**: Session-scoped cache of recent query plans.
- `findReusablePlan(message, dataset)` -- checks cache for reusable SQL template
- `cachePlan(skill, dataset, sql, ...)` -- stores a new plan entry
- `clearPlanCache()` -- clears on session reset
- FIFO eviction at 20 entries
- Parameter substitution handles date literals, LIMIT values

---

### `src/lib/result-quality.ts` (~200 lines)
**Responsibility**: Heuristic data quality checks on query result sets. No model calls.
- `analyzeResultQuality(columns, rows, sql)` -- main entry point
- Checks: null rates >20%, categorical near-duplicates, zero-row results, single-value columns
- Single-value check suppresses columns that appear in WHERE clauses
- Returns `QualityFlag[]` (capped at 5)

---

### `src/lib/skills/schema.ts` (305 lines)
**Responsibility**: Direct BigQuery REST API calls for metadata.
- The ONLY skill extracted into its own file
- `fetchSchema()` -- public entry point, delegates to scope-specific functions
- `fetchProjectSchema()` -- lists datasets with table counts
- `fetchDatasetSchema()` -- lists tables in a dataset
- `fetchTableSchema()` -- full table metadata
- `fetchTableConstraints()` -- PK/FK via INFORMATION_SCHEMA

---

### `src/lib/bigquery-client.ts` (~15KB)
**Responsibility**: BigQuery REST API wrapper.
- `executeQuery()` -- runs read-only queries
- `dryRun()` -- cost estimation
- `executeDml()` -- runs DML statements
- `exportToSheets()` -- Google Sheets export
- `createScheduledQuery()` -- Data Transfer API
- `detectBqRegion()` -- region detection for INFORMATION_SCHEMA
- `parseQueryResponse()` -- coerces cell values to native JS types using BigQuery schema field types
- `coerceValue()` -- type-specific coercion (NUMERIC -> Number, BOOLEAN -> boolean, etc.)

---

### `src/lib/format-value.ts` (~100 lines)
**Responsibility**: Smart numeric formatting with currency detection.
- `formatDisplayValue(value, columnName)` -- full display formatting with `$` for currency columns
- `formatCompactValue(value, columnName)` -- compact notation (e.g., `$509.4M`) for chart axes
- `isCurrencyColumn(columnName)` -- heuristic check against `CURRENCY_PATTERNS` regex
- `CURRENCY_PATTERNS` -- regex matching sale, revenue, price, cost, amount, spend, etc.
- `NON_CURRENCY_SUFFIXES` -- exclusion regex preventing false positives (cost_tier, price_count, etc.)
---

### `src/lib/format.ts` (~60 lines)
**Responsibility**: Shared formatting utilities used across many components.
- `formatBytes(bytes)` -- human-readable byte formatting (B through PB)
- `truncateLabel(str, maxLen)` -- truncate with ellipsis, default 30 chars
- `truncateEmail(email, maxLen)` -- truncate email to local part
- `relativeTime(dateStr)` -- relative time strings ("2h ago", "3d ago")

---

### `src/components/ui/StatCard.tsx` (~90 lines)
**Responsibility**: Reusable stat card for displaying label/value pairs.
- Replaces local StatCard/KpiCard/Stat definitions in AccessPatternView, StorageBreakdownView, CostAnalysisView, MonitoringView, SchemaView
- Props: label, value, subtitle, trend, trendValue, mono, color, highlight, accent

### `src/components/ui/Badge.tsx` (~45 lines)
**Responsibility**: Reusable badge/pill component.
- Variants: default, info, success, warning, error
- Sizes: sm, md

### `src/components/ui/Tooltip.tsx` (~95 lines)
**Responsibility**: Reusable tooltip with fixed positioning and keyboard accessibility.
- Wraps a trigger element, shows content on hover/focus
- Placement: top (default), bottom

---

### `src/lib/types.ts` (502 lines)
**Responsibility**: All TypeScript interfaces.
- `SkillName`, `CompositionEnvelope`, `SchemaResult`, `QueryResult`
- `DataManagementResult`, `DataQualityResult`, `MonitoringResult`
- `DiscoveryResult`, `DataLoadingResult`, `AlertResult`

---

## UI Components (`src/components/`)

| Component | Size | Renders |
|-----------|------|--------|
| SchemaView.tsx | 67KB | Dataset/table listings, full table schemas |
| PromptsLibrary.tsx | 33KB | Saved prompts and quick actions |
| MultistepView.tsx | 15KB | Multi-step workflow cards |
| ErDiagramView.tsx | 14KB | Entity-relationship diagrams |
| LineageDagView.tsx | 14KB | Data lineage DAG visualization |
| ArtifactCard.tsx | 17KB | Generic artifact rendering wrapper, includes pin-to-context button |
| CostAnalysisView.tsx | 15KB | Cost breakdown visualizations |
| AccessPatternView.tsx | 15KB | Table access pattern analysis |
| StorageBreakdownView.tsx | 15KB | Storage treemaps |
| SettingsPage.tsx | 15KB | App settings UI |
| DataLoadingView.tsx | 9KB | Export/schedule confirmations |
| DiscoveryView.tsx | 9KB | Search results |
| DataQualityView.tsx | 8KB | Quality check results |
| EmptyCanvasAnimation.tsx | 8KB | Welcome screen animation |
| AnimatedCrystalBall.tsx | 8KB | Loading animation |
| DataTable.tsx | 6KB | Generic data table renderer |
| GlobalSearch.tsx | 7KB | Command palette / global search |
| MonitoringView.tsx | 6KB | Job/resource monitoring |
| FreshnessView.tsx | 6KB | Table freshness checks |
| ConfirmationCard.tsx | 6KB | Destructive op confirmation UI |
| CrystalBallSpinner.tsx | 6KB | Loading spinner |
| ChartView.tsx | 3KB | Chart rendering dispatcher |

---

## Skill Documentation

### Build-time skill definitions (`skills/`)
- `schema.md` -- Schema skill prompt (~140 lines)
- `query.md` -- Query skill prompt (~210 lines)  
- `data-management.md` -- Data management skill prompt (~260 lines)

### Runtime skill docs (`public/skills/`)
- Loaded by `loadSkillDoc()` in orchestrator
- Cached in memory (`_skillDocCache`)
- 8 files: one per skill + `intent-routing.md`

### Design specs (`docs from claude/`)
- 15 files, ~145KB total
- Aspirational specifications, not implementation docs
- See `docs from claude/README.md` for index

---

## Test Infrastructure

- `scripts/test-loop.mjs` -- End-to-end test harness (sends messages to API, evaluates responses)
- `scripts/task-catalog.mjs` -- Test scenario definitions
- `scripts/token-manager.mjs` -- OAuth token management for tests
- `scripts/generate-report.mjs` -- Markdown report generator
- No unit tests exist. No jest/vitest configuration.

---

## Task Framework (`src/lib/tasks/`)

New subsystem for autonomously resolving and executing Google Cloud data tasks.

### `src/lib/tasks/types.ts` (~85 lines)
**Responsibility**: Type definitions for the task framework.
- `ResolvedPlan`, `ResolvedStep`, `ApiCallSpec`, `DynamicInput`
- `TaskStepResult`, `TaskArtifact`
- `LearnedPlan` (Firestore persistence shape)
- `TaskResult` (top-level result type for the app)

### `src/lib/tasks/executor.ts` (~155 lines)
**Responsibility**: Generic API executor for structured call specs.
- `ALLOWED_API_HOSTS` -- googleapis.com domain allowlist
- `executeApiCall()` -- substitutes placeholders, validates host, sends fetch with Bearer auth
- `substitutePlaceholders()`, `substituteBody()` -- recursive template resolution
- `validateHost()` -- URL host check against allowlist

### `src/lib/tasks/learned-plans.ts` (~130 lines)
**Responsibility**: Firestore persistence for learned plans.
- Uses top-level `learnedPlans` collection (shared across users, scoped by project)
- In-memory cache per session per project
- `getLearnedPlans()`, `saveLearnedPlan()`, `updateLearnedPlan()`, `deleteLearnedPlan()`
- `extractKeywords()` -- stop-word-filtered keyword extraction

### `src/lib/tasks/resolver.ts` (~370 lines)
**Responsibility**: The brain. Resolves NL requests into executable plans.
- `resolveTask()` -- main entry: shortcut check -> learned plan check -> API identification -> plan construction
- `findMatchingLearnedPlan()` -- keyword overlap + Gemini semantic scoring
- `onTaskSuccess()`, `onTaskFailure()` -- learned plan feedback loop
- `diagnoseError()` -- Gemini-powered error diagnosis with optional plan fix
- Uses `callGeminiWithSchema` from gemini-client.ts with OpenAPI JSON schemas
- Resolution priority: action shortcuts (instant) -> learned plans (1 LLM call) -> full 2-phase (2 LLM calls)

### `src/lib/tasks/actions/index.ts` (~340 lines)
**Responsibility**: Pre-coded action shortcuts that bypass the full resolver.
- `matchShortcut(message)` -- keyword-based matching against registered shortcuts
- `getShortcuts()` -- returns all registered shortcuts (for UI display)
- 7 shortcuts: create-dataset, create-table-from-query, export-to-gcs, schedule-query, copy-table, delete-table, grant-access
- Each shortcut builds a ResolvedPlan directly with no LLM call

