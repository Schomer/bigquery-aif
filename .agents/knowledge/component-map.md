# Component Boundary Map

A guide to the codebase structure, key files, their responsibilities, and where to find things. Consult this before making changes to understand what you're touching and what might be affected.

Last updated: 2026-07-09

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
  - Scores signals from SKILL_MANIFESTS (manifest-driven)
    |
    v
Orchestrator (src/lib/chat-orchestrator.ts)
  - LLM classifier (medium/low confidence fallback)
  - Manifest-driven dispatch via SKILL_MAP
  - Self-review pass
    |
    v
Skill Handlers (src/lib/skills/handle-*.ts)
  - Each exports a `manifest: SkillManifest`
  - Barrel file: src/lib/skills/index.ts
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

### `src/lib/router.ts` (~180 lines)
**Responsibility**: Intent classification via weighted keyword scoring.
- Lines 14-38: MUTATING_VERBS array and compiled regex patterns
- Lines 42-55: `scoreSignals()` -- the scoring engine
- Lines 57-104: `getContextBoosts()` -- follow-up action pattern matching
- Lines 120-200: `classifyIntent()` -- main classification function (scores from SKILL_MANIFESTS)
- Lines 205-220: `resolveReferences()` -- pronoun resolution

**Key invariant**: Mutating verbs get checked first. High-confidence mutating verb match returns immediately unless a strong quality signal (from data-quality manifest) is also present.
**Key change (2026-07-09)**: Signal arrays moved to handler manifests. Router now iterates `SKILL_MANIFESTS` to score signals.

---

### `src/lib/chat-orchestrator.ts` (~270 lines)
**Responsibility**: Thin dispatch layer. Routes classified intents to skill handlers.
- Lines 1-28: Imports (barrel, infrastructure, types)
- Lines 30-56: `ProcessMessageArgs` and `OrchestrationResult` interfaces
- Lines 58-270: `ChatOrchestrator.processMessage()` -- main entry point
  - Lines 60-65: Confirmation handling (delegates to `executeConfirmedOperation`)
  - Lines 70-71: Reference resolution
  - Lines 75-195: Intent classification (keyword first, LLM fallback)
  - Lines 200-215: Manifest-driven dispatch via `SKILL_MAP.get(skill)`
  - Lines 220-260: Self-review pass with skip heuristics

**Key change (2026-07-09)**: Switch-case replaced with manifest-driven dispatch.

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

### `handle-pipeline.ts` (~390 lines)
- 6 operation types: LIST_SCHEDULES, SCHEDULE_DETAILS, CREATE_PIPELINE, UPDATE_SCHEDULE, DELETE_SCHEDULE, RUN_HISTORY
- BigQuery Data Transfer API for scheduled query CRUD
- LLM-assisted pipeline SQL generation
- Dry-run cost estimation per pipeline run
- Run history with success/failure tracking

### `handle-task.ts` (105 lines)
- Generic task resolver for Google Cloud data tasks
- Delegates to task framework (resolver, executor, learned plans)

### `handle-saved.ts` (184 lines)
- Runs saved artifacts from chat ("run my weekly report")
- Fuzzy-matches user message against saved artifact names
- Executes cached SQL directly without Gemini calls
- Records run count via `recordRun()`

---

### `src/lib/saved-work.ts` (~380 lines)
**Responsibility**: CRUD persistence layer for saved artifacts and spaces.
- Uses single-document Firestore pattern (`savedWork.{id}` under `users/{uid}`)
- `migrateItem()` converts legacy `SavedItem` records to new `SavedArtifact` shape on read
- Artifact API: `saveArtifact`, `getArtifacts`, `getArtifact`, `updateArtifact`, `deleteArtifact`, `searchArtifacts`, `recordRun`, `getPinnedArtifacts`
- Space API: `createSpace`, `getSpaces`, `renameSpace`, `deleteSpace`
- Utility API: `moveToSpace`, `duplicateArtifact`
- Deprecated wrappers: `saveItem`, `getItems`, etc. (for backward compat)

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
- `createDataset()` -- creates a new dataset via REST API
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

### `src/components/BriefingBlock.tsx` (~85 lines)
**Responsibility**: Renders conversational briefing above artifact cards.
- Narrative paragraph + optional key-findings bullet list
- Inline code rendering for backtick-wrapped substrings
- Styled with light blue background (#edf1f8), Neptune-inspired typography

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

### `src/components/OverviewDashboard.tsx` (~490 lines)
**Responsibility**: Landing page dashboard shown when activePage === 'overview'.
- Five sections: title, recent charts (from conversations), recently saved (from saved artifacts), recent activity (last 10 jobs table), quick actions (5 action cards)
- Recent Charts: scans conversations for envelopes with chart-type primaryArtifact, shows up to 6 clickable cards
- Recently Saved: fetches up to 6 SavedArtifacts via getArtifacts, shows clickable cards that run the item
- Recent Activity: fetches real job data from BigQuery REST API using the user's OAuth token
- Sections load independently with skeleton placeholders and graceful error fallbacks
- Uses useAuth() for user context, useConversation() for conversation navigation
- Props: project, accessToken, onNavigate, onPrompt

---

### `src/lib/types.ts` (535 lines)
**Responsibility**: All TypeScript interfaces.
- `SkillName`, `CompositionEnvelope`, `SchemaResult`, `QueryResult`
- `DataManagementResult`, `DataQualityResult`, `MonitoringResult`
- `DiscoveryResult`, `DataLoadingResult`, `AlertResult`

---

### `src/hooks/useChatOrchestration.ts` (682 lines)
**Responsibility**: Custom hook encapsulating all chat orchestration state and logic.
- All chat state: messages, loading, context, contextItems, pinnedEnvelopeId, statusText, lastError, thinkingSteps
- `sendMessage()` -- main async handler calling ChatOrchestrator.processMessage
- `handleConfirm()` / `handleCancel()` -- confirmation flow handlers
- `handleChipClick()` -- next-action chip handler with context merging
- `handleRunSql()` / `handleInlineClick()` -- inline action helpers
- Context management: `extractContextFromEnvelope`, `extractContextItems`, `removeContextItem`, `pinEnvelopeContext`, `deriveContextFromItems`
- Message editing: `startEdit`, `cancelEdit`, `submitEdit`, `rerunMessage`
- Auth retry: `withAuthRetry` wrapper
- Conversation persistence: `persistConversation`

---

## UI Components (`src/components/`)

### `src/components/chat/ChatThread.tsx` (449 lines)
**Responsibility**: Message rendering loop for the unified (single-pane) layout.
- Renders user message bubbles with edit mode
- Renders assistant envelopes via ArtifactCard
- CrystalBallThinking indicator (rotating phrases)
- ErrorCard for error display with retry
- RegenerateButton for re-running prompts
- Auto-scroll to latest message

### `src/components/chat/ChatInput.tsx` (191 lines)
**Responsibility**: Reusable input component with context chips.
- Three variants: `hero` (empty-state centered), `floating` (fixed over chat), `docked` (sidebar bottom)
- Textarea with auto-resize
- Send button
- Context chips row with dismiss

### `src/components/chat/ResultsSidebar.tsx` (564 lines)
**Responsibility**: Split-layout chat sidebar and results panel.
- Chat message list with thinking details and artifact link buttons
- Results panel rendering ArtifactCards
- Drag handle for resizing sidebar
- `artifactIcon()` and `envelopeLabel()` helper functions
- `scrollToResult()` for result navigation
- Empty-state project selection

| Component | Size | Renders |
|-----------|------|--------|
| SchemaView.tsx | 67KB | Dataset/table listings, full table schemas |
| PromptsLibrary.tsx | 33KB | Saved prompts and quick actions |
| MultistepView.tsx | 15KB | Multi-step workflow cards |
| ErDiagramView.tsx | 14KB | Entity-relationship diagrams |
| LineageDagView.tsx | 14KB | Data lineage DAG visualization |
| ArtifactCard.tsx | 28KB | Artifact rendering wrapper with two paths: default (fixed chrome) and custom (thin container, view owns layout). Includes CustomArtifact dispatcher. |
| ProvenancePanel.tsx | 14KB | Collapsible provenance panel (SQL, cost, job, tables, quality flags) |
| HowItWorksPanel.tsx | 8KB | Static trust/transparency page (security, queries, costs) |
| CostAnalysisView.tsx | 15KB | Cost breakdown visualizations |
| AccessPatternView.tsx | 15KB | Table access pattern analysis |
| StorageBreakdownView.tsx | 15KB | Storage treemaps |
| SettingsPage.tsx | 15KB | App settings UI |
| DataLoadingView.tsx | 9KB | Export/schedule confirmations |
| PipelineView.tsx | 10KB | Scheduled query list, details, run history, pipeline creation |
| DiscoveryView.tsx | 9KB | Search results |
| DataQualityView.tsx | 8KB | Quality check results |
| EmptyCanvasAnimation.tsx | 8KB | Welcome screen animation |
| AnimatedCrystalBall.tsx | 8KB | Loading animation |
| DataTable.tsx | 6KB | Generic data table renderer |
| GlobalSearch.tsx | 7KB | Command palette / global search |
| MonitoringView.tsx | 6KB | Job/resource monitoring |
| FreshnessView.tsx | 6KB | Table freshness checks |
| GovernanceView.tsx | 15KB | Access audit, security policies, PII scan, data classification. Uses CustomViewProps (presentation: 'custom') -- owns its full layout via CardParts building blocks. |
| ui/CardParts.tsx | 10KB | Composable building blocks: CardHeader, CardChips, SqlPanel, CardMeta. Used by views with presentation: 'custom'. |
| ConfirmationCard.tsx | 6KB | Destructive op confirmation UI |
| CrystalBallSpinner.tsx | 6KB | Loading spinner |
| ChartView.tsx | 3KB | Chart rendering dispatcher |
| SavedPage.tsx (SpacesPage) | 28KB | Spaces/folder management, card/list view toggle, drag-and-drop, inline rename, context menus, breadcrumb nav |
| FavoritesPage.tsx | 14KB | Starred chats + pinned artifacts grid with filter tabs |

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
- Added: `pipeline.md` for pipeline management routing

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
- `scripts/visual-test.mjs` -- Puppeteer headed-browser screenshot capture (20 tests)
- `scripts/ux-eval.mjs` (~580 lines) -- UX evaluation: 25 scenarios, screenshots + Gemini scoring on 6 dimensions. Outputs `test-results/ux-eval-report.md`. Run: `node scripts/ux-eval.mjs`
- `scripts/snapshot-test.mjs` -- Offline router classification tests (no server needed)
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

