# Component Boundary Map

A guide to the codebase structure, key files, their responsibilities, and where to find things. Consult this before making changes to understand what you're touching and what might be affected.

Last updated: 2026-07-27

---

## Architecture Overview

```
User Message
    |
    v
Orchestrator (src/lib/chat-orchestrator.ts)
  - Confirmation handling (executeConfirmedOperation)
  - Delegates request processing to processWithAgentLoop()
    |
    v
Agent Loop (src/agent/index.ts)
  - processWithAgentLoop()
  - Manages agent loop, tool calls, and execution steps
    |
    v
Agent Tools (src/agent/tools/)
  - Tools: get_schema, run_query, list_resources, plan_tool, present_result, etc.
  - Interacts with BigQuery REST API and schema helpers (src/lib/skills/schema.ts)
    |
    v
Composer (src/lib/composer.ts)
  - compose(type, result) -> CompositionEnvelope
    |
    v
UI Components (src/components/)
  - Render envelopes as cards/charts/tables
```

---

## Core Files

### `src/lib/chat-orchestrator.ts` (~80 lines)
**Responsibility**: Entry point dispatch layer.
- Confirmation handling: delegates to `executeConfirmedOperation` in `src/lib/skills/execute-confirmed.ts`
- Active request routing: delegates to `processWithAgentLoop` in `src/agent/index.ts`

---

### `src/lib/gemini-client.ts` (~120 lines)
**Responsibility**: Gemini API client.
- `callGemini()` -- structured output with retry logic
- `callGeminiWithSchema<T>()` -- typed wrapper for structured output (used by task resolver)
- `loadSkillDoc()` -- loads skill .md files from /public/skills/
- Retained response schemas (`QueryResponseSchema`, `EnrichedSchemaQuerySchema`, etc.). Dead schemas removed (`SchemaResponseSchema`, `SelfReviewResponseSchema`, `DataManagementResponseSchema`, `MonitoringIntentSchema`, `DqIntentSchema`, `DiscoveryResponseSchema`, `DataLoadingIntentSchema`, `IntentClassifierSchema`, etc.)
- `SKILL_NAMES` import removed

---

### `src/lib/orchestrator-utils.ts` (182 lines)
**Responsibility**: Shared utility functions.
- `bqConsoleUrl()` -- generates BigQuery Console deep links
- `stepWithLink()` -- creates status step with Console link
- `getAvailableDatasets()` -- lists datasets via BigQuery API
- `resolveDefaultDatasetFromList()` / `resolveDefaultDataset()` -- picks default dataset
- `extractDatasetFromMessage()` -- scans message text for dataset names
- `buildConversationStateSummary()` -- context summary for LLM prompts
- `buildSchemaContext()` -- loads table columns for SQL generation context

---

## Skills Subsystem (`src/lib/skills/`)

- `schema.ts`: Direct BigQuery REST API calls for dataset/table metadata (`fetchSchema`, `fetchProjectSchema`, `fetchDatasetSchema`, `fetchTableSchema`, `fetchTableConstraints`). Used by agent tools.
- `execute-confirmed.ts`: Executes confirmed DML operations (`executeConfirmedOperation`), extracted from legacy data management skill. Used by `chat-orchestrator.ts`.
- `index.ts`: Barrel file re-exporting `fetchSchema` and `executeConfirmedOperation`.

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

### `src/lib/composer.ts` (~1998 lines)
**Responsibility**: Transforms skill results into CompositionEnvelopes.
- Each skill has a dedicated `compose[Skill]` function
- Added `composeClarification()` for creating CLARIFICATION_CARD envelopes
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

### `src/lib/types.ts` (1001 lines)
**Responsibility**: All TypeScript interfaces.
- `SkillName`, `CompositionEnvelope`, `SchemaResult`, `QueryResult`
- `DataManagementResult`, `DataQualityResult`, `MonitoringResult`
- `DiscoveryResult`, `DataLoadingResult`, `AlertResult`
- Added 2026-07-11: `briefing` field on `CompositionEnvelope`
- Added 2026-07-12: `SavedDashboard`, `DashboardTile`, `JoinDefinition`
- Added 2026-07-13: `CsvUploadPreview`, `UPLOAD_PREVIEW`, `UPLOAD_CSV`, `CSV_UPLOAD_VIEW`
- Added 2026-07-15: `PLAN_CARD` artifact type, `InteractiveWidgetData`
- Added 2026-07-26: `ExecutionTraceEntry`, `ClarificationOption`, `ClarificationResult`, `AlertSimulation`, `CLARIFICATION_CARD` artifact type, `executionTrace` provenance, `simulation` on `AlertResult`

---

### `src/lib/conversation-state.ts` [Added 2026-07-15]
**Responsibility**: Cross-turn conversational memory.
- `ConversationState` type: `queriedTables` (max 20), `appliedFilters`, `mentionedEntities`, `activeTable/Dataset`, `queryHistory` (last 5 SQL)
- `updateState()` -- accumulates from each `CompositionEnvelope`
- `extractFiltersFromSql()` -- parses WHERE clauses for =, !=, >, <, LIKE, IN, BETWEEN
- `formatStateForPrompt()` -- produces ~200-400 token compact block for LLM injection

### `src/lib/sql-guard.ts` [Added ~2026-07-15]
**Responsibility**: Pre-execution SQL type-safety auto-correction.
- `checkAndFixTypes()` -- detects and auto-corrects INT64 = 'string' and BOOL = 'string' type mismatches before query execution
- Zero-row retry support: relaxes EXTRACT(YEAR) filters and exact string matches

### `src/lib/column-classifier.ts` [Added ~2026-07-12]
**Responsibility**: Column type classification for chart rendering.
- `classifyColumns(columns, rows)` -- returns classification per column: 'measure', 'dimension', 'date', 'id'
- Used by `resolveAxes()` in `chart-utils.ts` to exclude non-numeric columns from yKeys

### `src/lib/viz-intent.ts` [Added 2026-07-12]
**Responsibility**: Explicit user visualization intent extraction.
- `extractVisualizationIntent(message)` -- returns a `VizType` or null
- `EXPLICIT_INTENT_MAP` array: ordered first-match-wins (explicit chart types before geographic patterns)
- 6 generic map patterns, 45 full country names for geo detection
- Result threads through `enrichedContext.userIntent` → `handleQuery()` → `compose()` → `inferVisualizationType()` as the highest-priority signal

### `src/lib/monitoring-history.ts` [Added 2026-07-12]
**Responsibility**: Firestore persistence for data quality check history.
- `saveMonitoringSnapshot()` -- fire-and-forget write after FRESHNESS/COMPLETENESS DQ checks
- `getMonitoringHistory(tableRef, limit?)` -- reads last N snapshots for sparkline rendering
- Collection: `monitoringHistory/{tableRef}/snapshots`

### `src/lib/preview-client.ts` [Added 2026-07-15]
**Responsibility**: Paginated and filtered row fetching for the Sample tab.
- `fetchTablePage(project, dataset, table, token, {page, pageSize, filter})` -- builds SELECT + COUNT(*) queries
- Filter uses SQL LIKE on CAST(...AS STRING); excludes GEOGRAPHY/STRUCT/ARRAY/JSON columns from the filter clause

### `src/lib/result-insights.ts` [Added ~2026-07-11]
**Responsibility**: Heuristic insights computed from query result data.
- `computeInsights(columns, rows)` -- returns severity-ranked findings
- Used for BAR, SCATTER, PIE, FUNNEL chart types
- Medium/high severity insights surfaced as briefing findings

### `src/lib/chat-run-state-context.tsx` [Added 2026-07-12]
**Responsibility**: Cross-chat running status tracking.
- `ChatRunStateProvider` wraps `ShellLayout`
- `runningId: string | null` -- set to conversation ID while a query is in flight
- Read by `ChatSidebar` to show pulsing blue dot on the running conversation

### `src/lib/preferences-context.tsx` [Added 2026-07-11]
**Responsibility**: User display preferences persisted to localStorage.
- `showProvenance: boolean` -- controls ProvenancePanel visibility in ArtifactCard
- `showSuggestions: boolean` -- controls suggestion chips visibility
- Toggled via kebab menu in TopBar

### `src/lib/page-context.tsx` [Added/extended ~2026-07-15]
**Responsibility**: Tab system for the main content area.
- Extended from single `activePage` string to full tab system: `tabs: AppTab[]`, `activeTabId`
- Chat tab is always present and not closeable
- Dashboard tabs stored by id `dashboard:{dashboardId}`
- `TabBar` renders only when `tabs.length > 1`

### `src/lib/layout-context.tsx`
**Responsibility**: Shared layout state.
- `chatListOpen`, `setChatListOpen`, `toggleChatList` -- overlay chat list in unified mode
- Layout mode: 'unified' | 'chat-left' | 'chat-right'
- `historyVisible` / `setHistoryVisible` -- history toggle in TopBar

### `src/lib/firestore-service.ts`
**Responsibility**: Thin Firestore abstraction layer.
- Wraps Firebase Firestore SDK calls used across multiple modules
- Prevents direct SDK calls from being scattered across the codebase



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

### `src/components/chat/ChatThread.tsx` (~630 lines)
**Responsibility**: Message rendering loop for the unified (single-pane) layout.
- Renders user message bubbles with edit mode
- Renders assistant envelopes via ArtifactCard
- CONVERSATION envelopes rendered via ConversationRenderer (not raw text)
- CrystalBallThinking indicator (rotating phrases)
- ErrorCard for error display with retry
- RegenerateButton for re-running prompts
- Auto-scroll to latest message

### `src/components/chat/ConversationRenderer.tsx` (~310 lines)
**Responsibility**: Rich rendering of CONVERSATION text envelopes.
- Parses text into segments: paragraphs, bullet lists, inline code, bold
- EntityChip: clickable pill for backtick-wrapped entity names (datasets, tables)
- EntityCardList: grid of clickable rows for entity lists (matching SchemaView ClickableRow style)
- StyledList: bordered list items for non-entity bullet points
- isEntityName: heuristic distinguishing BQ identifiers from SQL keywords and code snippets
- Sends follow-up messages via onSendMessage when entities are clicked

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
| SchemaView.tsx | 67KB | Dataset/table listings, full table schemas, Sample tab with pagination/filter (added 2026-07-15) |
| PromptsLibrary.tsx | 33KB | Saved prompts and quick actions |
| MultistepView.tsx | 15KB | Multi-step workflow cards |
| ErDiagramView.tsx | 14KB | Entity-relationship diagrams |
| LineageDagView.tsx | 14KB | Data lineage DAG visualization |
| ArtifactCard.tsx | 28KB (982 lines) | Artifact rendering wrapper with two paths: default (fixed chrome) and custom (thin container, view owns layout). Includes CustomArtifact dispatcher. Added dispatchers for: CSV_UPLOAD_VIEW (2026-07-13), INTERACTIVE_WIDGET (2026-07-14), PLAN_CARD (2026-07-15), DASHBOARD_VIEW (2026-07-15), CLARIFICATION_CARD (2026-07-26). |
| ProvenancePanel.tsx | 14KB (440 lines) | Collapsible provenance panel (SQL, cost, job, tables, quality flags, step-by-step executionTrace timeline) |
| HowItWorksPanel.tsx | 8KB | Static trust/transparency page (security, queries, costs) |
| CostAnalysisView.tsx | 15KB | Cost breakdown visualizations |
| AccessPatternView.tsx | 15KB | Table access pattern analysis |
| StorageBreakdownView.tsx | 15KB | Storage treemaps |
| SettingsPage.tsx | 15KB | App settings UI |
| DataLoadingView.tsx | 9KB | Export/schedule confirmations |
| CsvUploadView.tsx | 8KB | CSV upload: file drop zone, preview table, upload confirm. Added 2026-07-13. |
| InteractiveWidgetView.tsx | ~10KB | Date range picker + multi-select filter widget. Apply/Clear buttons re-run parameterized SQL client-side. Added 2026-07-14. |
| PipelineView.tsx | 10KB | Scheduled query list, details, run history, pipeline creation |
| DiscoveryView.tsx | 9KB | Search results |
| DataQualityView.tsx | 8KB | Quality check results. Added QualityTrendSparkline (2026-07-12). |
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
| TaskWorkflowView.tsx | ~10KB | Task framework UI -- shows resolved plan, step-by-step execution progress, results. Added ~2026-07-11. |
| TabBar.tsx | ~3KB | Tab bar for main content area; renders when >1 tab open. Tabs: chat (always present), dashboard tabs. Added 2026-07-15. |
| DashboardArtifactCard.tsx | ~8KB | Dashboard tile card used in the dashboard page. Added 2026-07-15. |
| SavedWorkLibrary.tsx | ~10KB | Alternate saved items view. |
| chat/PlanCard.tsx | ~6KB | PLAN_CARD artifact: title, summary, numbered steps, Cancel/Comment/Proceed actions. Comment mode has inline textarea for amendments. Added 2026-07-15. |
| chat/InlineConfirmation.tsx | ~3KB | Inline confirmation prompt for low-stakes confirmations within the chat thread. |
| CrystalBallOracle.tsx | ~5KB | Enhanced crystal ball loading animation variant. |
| SparkSpinner.tsx | ~2KB | Lightweight spinner used in compact contexts. |
| StatRowCard.tsx | ~3KB | Horizontal stat row card variant. |
| ClarificationCard.tsx | ~6KB (192 lines) | Inline clarification card component rendering clickable options and text input for disambiguation. Added 2026-07-26. |
| AlertView.tsx | ~6KB (189 lines) | Historical alert simulation display component with zero-fire dual-interpretation framing. Added 2026-07-26. |
| ErrorBoundary.tsx | ~3KB | React error boundary wrapping skill-specific views. |

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

---

## Agent v2 (src/agent/)

New architecture components, behind feature flag `bqaif_agent_v2`.

| File | Lines (approx) | Purpose |
|------|----------------|--------|
| model-adapter.ts | 50 | ModelAdapter interface (model-agnostic LLM calls) |
| firebase-ai-adapter.ts | 120 | FirebaseAiLogicAdapter (wraps Firebase AI Logic SDK) |
| prompts/flash.ts | 116 | Flash-optimized system prompt with planning and tool selection instructions |
| step-events.ts | 150 | StepEvent protocol + emitter + StatusCallback bridge |
| trace-recorder.ts | 165 | Trace recording for golden set evaluation |
| context.ts | 170 | LoopContext assembly, history truncation, result summarization |
| loop.ts | 300 | The agent loop (stall detection, interruption, gates, parallel reads) |
| action-classes.ts | 185 | Action-class taxonomy (read/reversible/destructive) |
| result-cache.ts | 160 | IndexedDB result store (200MB LRU) |
| index.ts | 612 | Entry point, feature flag, processWithAgentLoop(), executionTrace collection, plan ambiguity detection |
| tools/types.ts | 45 | ToolDef, ToolCall, ToolResult |
| tools/run-query.ts | 115 | run_query tool (execute + dry_run + cache) |
| tools/get-schema.ts | 180 | get_schema tool (project/dataset/table scope + fuzzy match) |
| tools/list-resources.ts | 85 | list_resources tool (datasets/tables) |
| tools/plan-tool.ts | 102 | plan_analysis tool (pre-execution plan analysis & ambiguity detection) |

---

## Builder Subsystem (Added 2026-07-29)

The builder allows users to compose reusable documents (dashboards, apps, reports, recipes) from chat output. Users click "Add to..." on any artifact card to add it as a tile to a builder document. Builder documents open as tabs in the TabBar.

| File | Lines (approx) | Purpose |
|------|----------------|---------|
| src/lib/builder-types.ts | 68 | `BuilderDocument`, `BuilderTile`, `DocumentType` types, `envelopeToTile()` converter |
| src/lib/builder-context.tsx | 195 | React context: document lifecycle, tile CRUD, dirty tracking, auto-placement |
| src/lib/builder-persistence.ts | 37 | Firestore CRUD for `users/{uid}/documents/{docId}` |
| src/components/BuilderPage.tsx | 420 | Document editor canvas: grid layout, editable tile names, save/discard toolbar |

**Key integration points:**
- `src/lib/page-context.tsx`: `openBuilderTab()` creates `builder:{id}` tabs
- `src/components/ArtifactCard.tsx`: "Add to..." button + `AddToBuilderMenu` dropdown
- `src/app/page.tsx`: Renders `BuilderPage` for builder tabs
- `src/components/shell/ShellLayout.tsx`: Wraps app with `BuilderProvider`
- `src/components/TabBar.tsx`: `dashboard_customize` icon + unsaved-changes dot for builder tabs
