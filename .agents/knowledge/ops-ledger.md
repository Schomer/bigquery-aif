# Operations Ledger

## 2026-07-13: COMPLETION_CARD type mismatch crash

**What happened**: CSV upload to a new table crashed with "Cannot read properties of undefined (reading 'toLocaleString')".

**Root cause**: The composer used `COMPLETION_CARD` artifact type for upload completion, but `CompletionCard` component expects `DataManagementCompleteResult` (with `rowsAffected`, `operation`). Upload results are `DataLoadingResult` (with `message`, `rowCount`). The component accessed `result.rowsAffected` which was `undefined`.

**Fix**: Changed upload completion to use `DATA_LOADING_VIEW` instead of `COMPLETION_CARD`.

**Rule**: Never reuse `COMPLETION_CARD` for non-data-management results. Each artifact type is tightly coupled to a specific result interface. Use `DATA_LOADING_VIEW` for all `DataLoadingResult` types.

---

A reverse-chronological log of changes, fixes, and lessons learned. Read this before making code changes to avoid repeating past mistakes.

## How to use this file
- **Before coding**: Scan recent entries for relevant context
- **After coding**: Add a new entry for any non-trivial change
- **When debugging**: Search for similar symptoms in past entries

## How to write an entry
Every entry should answer: What changed? What worked? What broke? Why? What's the generalizable lesson?

## 2026-07-13: Fix "+ New" button requiring double-click

**What changed**: SideNav's "+ New" button now also navigates to the chat page and closes the chat list overlay (in unified mode).

**Root cause**: The onClick handler only called `newConversation()` which creates a new conversation ID in context, but did not call `setActivePage('chat')`. If the user was on any other page, or if the chat list overlay was covering the chat view, the new conversation was created invisibly. The user had to click a second time (or click "AI") to actually see it.

**Derived rule**: Any UI action that creates or switches conversations must also ensure the chat view is visible -- call `setActivePage('chat')` and manage overlay state as needed.

## 2026-07-13: Conversational AI + Routing Fixes

**What changed**: Added `conversation` skill for natural dialogue + fixed three routing bugs.

**What worked**: 
- Safety net fix (high-confidence-only redirect) immediately unblocks "make a new dataset" and similar prompts that were being silently redirected to query.
- Conversation skill picks up greetings, questions, and help requests that previously either failed or produced wrong data results.
- Empty `signals: []` on the conversation manifest means it never steals routing from task skills in the keyword scorer.
- 19/19 snapshot routing tests pass without modification -- existing routing is not disturbed.

**Root cause (dataset verbs)**: "make a new dataset" had no matching pattern in MUTATING_VERBS, so the keyword router returned no-signal default (query at medium confidence). Even when the LLM classifier correctly identified data-management, the safety net in `handleDataManagement()` re-ran the keyword router which returned query, causing a redirect. Two bugs compounded: missing verbs + too-strict safety net.

**Derived rule**: The safety net should only override the LLM when the keyword router has **high confidence** that the skill is wrong. Medium/low confidence means the keyword router is unsure, so the LLM's judgment should stand.

## 2026-07-12: User Q&A Session -- A/B/C/D + Bug Fixes

**What changed**: Addressed four open design questions and fixed four confirmed bugs.

**A -- Shared link page** (`/shared`):
- Built `/shared` static page that reads share ID from URL hash (`#share_xyz`) to avoid dynamic route segment incompatibility with `output: 'export'`.
- ShareLinkButton URL updated from `/shared/${id}` to `/shared#${id}`.
- Auth-gated: signed-in users see headline + SQL; others see sign-in prompt. 7-day expiry shown.

**B -- Live-executing dashboard**:
- Rewrote `/dashboard/page.tsx` from skeleton to functional dashboard.
- Tiles re-run their `cachedSql` on open; show `lastSnapshot` instantly then update.
- Added artifact picker modal, width/height span controls, refresh button, save to Firestore.
- Extended `DashboardTile` type in `types.ts` with `cachedSql` and `lastSnapshot` fields.

**C -- Quality trend sparkline**:
- Added `QualityTrendSparkline` component to `DataQualityView.tsx`.
- Reads last 30 snapshots from `monitoringHistory/{tableRef}/snapshots` via `getMonitoringHistory()`.
- Renders SVG line chart (green = improving, red = worsening) with +/- delta. Hidden when < 2 points.
- Fixed `getMonitoringHistory()` call: signature is `(tableRef, limit)` not `(tableRef, checkType, limit)`. Filter checkType client-side.

**D -- Dashboard in sidebar**:
- Added `{ label: 'Dashboards', icon: 'dashboard', page: 'dashboard' }` to SideNav top-level items.
- Wired `activePage === 'dashboard'` in `page.tsx` with dynamic import and hide-list conditions for both unified and split layouts.

**Bug: Top-N without metric**:
- Strengthened `query.md` with explicit rule: "Top N entity with NO metric specified" must GROUP BY entity, pick best numeric column (revenue/price/amount), ORDER BY DESC LIMIT N. Never return scalar COUNT(*). Added wrong/correct examples.

**Bug: CSV export dataset resolution**:
- `handle-data-loading.ts` line 46: changed `if (!dataset && intent.dataset)` to `if (intent.dataset)`.
- Root cause: when user named a specific dataset ("orders in ecomm"), the LLM-extracted dataset was ignored if context already had a dataset from a prior turn.

**W1-14: Save as Workflow**:
- `saveChatAsWorkflow()` was already implemented in `useChatOrchestration.ts` but had no UI entry point.
- Added "Save as Workflow" button to `page.tsx` above ChatThread (visible only when `hasChat`).
- Reuses `SaveModal` with `artifactType='workflow'`, wired to `chat.saveChatAsWorkflow`.

**W1-12: Grain inference**:
- Added `inferGrainStatement(result: SchemaResult): string | null` pure function to `SchemaView.tsx`.
- Priority order: (1) explicit PK columns, (2) table name pattern + partition field, (3) table name pattern alone, (4) single _id column heuristic.
- Renders as a subtle banner between stats row and tab bar. Returns null (no banner) for ambiguous cases.

**Rules derived**:
1. `output: 'export'` Next.js static config prohibits dynamic route segments like `[id]`. Use hash-based routing (`/page#id`) as the workaround for user-generated content URLs.
2. `generateStaticParams` cannot be in a `'use client'` file. If needed, split into server wrapper + client component.
3. Always prefer LLM-extracted explicit values over context when the user names something specific in their request (dataset, table, project).
4. `getMonitoringHistory()` signature: `(tableRef: string, limit?: number)` — no checkType param. Filter client-side.
5. New pages that replace the chat area must be added to BOTH the unified-layout hide condition AND the split-layout hide condition in `page.tsx`.

## 2026-07-12: Wave 3 — All Items Implemented

**Items completed in this session**: W3-05, W3-08, W3-11, W3-12, W3-13, W3-14, W3-15, W3-16, W3-17, W3-18, W3-19, W3-20 (previous session covered W3-01 through W3-10).

**Key changes**:
- **W3-05 (Annotation write-back)**: Added annotation verbs to MUTATING_VERBS router (`annotate`, `describe column`, `set description`, etc.). Added `ALTER TABLE ... ALTER COLUMN SET OPTIONS (description=...)` DDL to data-management skill doc. Routed to existing LLM-driven DML handler.
- **W3-08 (Calendar heatmap)**: Added monthly coverage grid inside `DateRangeVizLarge` in `SchemaView.tsx`. Computes month buckets from min/max dates, renders 12-col grid with intensity gradient.
- **W3-11/12 (Firestore types)**: Added `SavedDashboard`, `DashboardTile`, `JoinDefinition` types to `types.ts`.
- **W3-13 (Join discovery)**: Added `JOIN_DISCOVERY` to discovery LLM prompt and handler. Extracts overlapping column names, prefers *_id/*_key patterns, runs match rate SQL against top candidate.
- **W3-14 (Query parameterization UI)**: Extended `SaveModal` with `sql` prop, auto-detects `@param` patterns, shows collapsible parameter editor with type/default fields.
- **W3-15 (Dashboard editor)**: New `/dashboard` page with split-panel layout: saved dashboard list + artifact picker on left, CSS grid tile canvas on right. Saves to `users/{uid}/savedDashboards` Firestore collection.
- **W3-16 (URL sharing)**: Added `ShareLinkButton` to ArtifactCard kebab menu. Writes to `sharedArtifacts/{id}` Firestore collection, copies URL to clipboard.
- **W3-17 (Pipeline DAG)**: Added pipeline flow diagram to `ScheduleDetails`. Extracts source tables from SQL via FROM/JOIN regex, renders source → schedule job → destination node flow.
- **W3-18 (Slot utilization)**: Changed SLOTS monitoring handler to return `LINE_CHART` `QueryResult` instead of `JOB_LIST`. Reuses existing chart infrastructure.
- **W3-19 (Monitoring history)**: New `src/lib/monitoring-history.ts` module with `saveMonitoringSnapshot()` / `getMonitoringHistory()`. Wired fire-and-forget calls into FRESHNESS and COMPLETENESS DQ handlers.

**Rules derived**:
1. `DiscoveryResult.query` must be optional (`?`) when adding new discoveryType variants that don't use a query string.
2. `ParameterDef` type uses lowercase type values (`'string'`, `'number'`, `'date'`) and `default` field (not `defaultValue`).
3. When adding new Firestore collections to client-side code, use dynamic `import()` to avoid server-side SSR errors.
4. `getArtifacts(userId)` in `saved-work.ts` only accepts `(userId, type?)` — no limit parameter.
5. The monitoring SLOTS handler can reuse the existing `compose('query', ...)` path with `LINE_CHART` suggestion — no new chart component needed.

### 2026-07-12: Batch 3-6 Bug Fixes from Visual Test Suite

**What changed**: Four bugs found from the 20-prompt Puppeteer test suite and fixed:

**Bug A (query skill)**: "Show me orders by status" returned raw rows (SELECT ... LIMIT 10) instead of an aggregation (SELECT status, COUNT(*) GROUP BY status). Root cause: query.md lacked explicit rules for "by X" questions. Fixed by adding a CRITICAL aggregation section with wrong/correct examples for 5 common patterns. Also fixed "top 10 products" which was returning a COUNT(*) KPI.

**Bug B (W1-15)**: No inline optimization tips on cost analysis. Fixed by adding data-driven tips computed from bucket data: high avg bytes/job (>1GB suggests missing partition filter), single user domination (>80% of cost), and single-day cost spike (>3x daily avg). Each tip has an "Investigate" chip.

**Bug C (maps)**: USA_MAP rendered an empty placeholder ("Google Maps API key not configured") when no API key is set. Fixed by falling back to BarChartRenderer when `error.includes('not configured')`. Applied to all three map renderers (USAMap, WorldMap, GeoPointMap).

**Bug D (charts)**: DATE_TRUNC results returned from BigQuery serialize as Unix epoch SECONDS (e.g., 1577836800), which rendered as raw numbers on the x-axis. Fixed by adding `xTickFmt()` to `useChartSetup()` that detects epoch seconds (1e8–2e10) and epoch milliseconds (1e11–2e13) and formats them as "Jan '20" style labels. Applied to LineChart, ColumnChart, AreaChart.

**Rules derived**:
1. "By X" in user queries ALWAYS means GROUP BY X -- add explicit few-shot examples to skill prompts to prevent raw-row responses.
2. Map charts need a graceful data-showing fallback when the API key is absent -- never show empty on good data.
3. BigQuery TIMESTAMP and DATE_TRUNC results serialize as epoch SECONDS (not milliseconds) when returned through the jobs API. Always check the magnitude range to distinguish seconds vs milliseconds.
4. Test promptly after each batch deploy; visual test suite caught issues that code review would not.

### 2026-07-12: Visualization Intelligence Overhaul (Five-Layer Decision System)

**What changed**: Replaced the 6-case `inferVisualizationType` heuristic with a full 13-step expert decision tree. Added LLM semantic hint via `visualizationHint` parameter on the `run_query` tool. Added explicit user intent extraction via `extractVisualizationIntent()` in `viz-intent.ts`. Threaded `columnTypes` (authoritative BigQuery field types) from `parseQueryResponse` all the way to the decision tree.

**What worked**: Using authoritative BQ column types (DATE, TIMESTAMP, INTEGER, etc.) as the primary type signal instead of re-deriving from sample values eliminated false positives on numeric-looking date strings. The 13-step tree now correctly identifies HEATMAP (2 categoricals + 1 numeric), FUNNEL (monotonically decreasing stages), DONUT_CHART (parts-of-whole by semantic signal), COMPOSED_CHART (dual-scale series), AREA_CHART (cumulative columns), COLUMN_CHART vs BAR_CHART by actual label length, HISTOGRAM (single numeric with many rows), and geographic maps.

**What broke**: Nothing -- clean build, no TypeScript errors.

**Rules derived**:
1. ALWAYS use authoritative schema types (from the database) rather than re-deriving types from sample values. Sample values can mislead (numeric strings, sparse columns).
2. Explicit user intent must be the highest-priority layer -- never let a heuristic override a user's explicit request.
3. Self-review must NOT override a visualization that is already correct. Add explicit rules to the review prompt to prevent it.
4. The LLM's `visualizationHint` (from tool call args) is a semantic signal, not authority. Use it as a tiebreaker when the data shape is ambiguous, not as the primary signal.

### 2026-07-12: Chart Renderer Bug Fixes

**What changed**: Fixed three renderer bugs: (1) ScatterChart X-axis was categorical (type not set), so points plotted at equal intervals instead of by value. Fixed by setting `type="number"` on both axes. (2) Treemap had no Tooltip, making it non-interactive visually. Added `<Tooltip>` inside `<Treemap>`. (3) DensityPlot had no `onClick` handler despite the UI showing a "Click to drill down" tip. Added an SVG onClick that sends a drillDownMessage for the closest data point.

**What broke**: Gauge had a bug where `drillDownMessage` was passed `currentValue` (a number) instead of `label` (the category identifier). Fixed.

**Rule**: After adding a new chart type to the rendering system, verify all interactive contracts: hover tooltip, click drill-down, and axis types. Missing any one of these makes the chart feel broken even if it renders correctly.

### 2026-07-12: Map Drill-Down Clicks

**What changed**: Added `marker.addListener('click', ...)` to all three Google Maps renderers (GeoPointMap, USAMap, WorldMap). Clicking a map marker now sends a `drillDownMessage` to the chat, consistent with clicking bars, pie slices, and treemap cells in other chart types.

**Rule**: All chart types must support the same click-to-drill-down contract. When adding marker-based maps, the Google Maps AdvancedMarkerElement click uses `addListener('click', cb)` not an `onClick` prop.

### 2026-07-12: Query Skill Doc -- visualizationHint Guidance

**What changed**: Added a new section to `public/skills/query.md` instructing the LLM to always set the `visualizationHint` parameter on the `run_query` tool call. This is the LLM's semantic contribution to the five-layer decision system.

**Rule**: Whenever a new tool parameter is added that the LLM needs to use, the skill doc MUST be updated to explain when and how to fill it in. Tool schema declarations alone are insufficient.

### 2026-07-12: viz-intent.ts -- Explicit User Intent Extraction

**What changed**: Created `src/lib/viz-intent.ts` with `extractVisualizationIntent()` and `isVizMutationOnly()`. These functions are used in `chat-orchestrator.ts` to detect when the user has explicitly requested a chart type and when a message is a pure chart-type-change (no new query needed).

**Rule**: Explicit user visualization requests must be extracted BEFORE routing, not after. The intent needs to flow through the entire pipeline: orchestrator -> enrichedContext -> handleQuery -> compose -> inferVisualizationType.

### 2026-07-11: Follow-up queries redundantly called get_table_schema

**What broke**: After a schema-view turn ("Show me ecomm.order_items"), the next query turn ("show totals for order status") still called `get_table_schema` in its thinking steps, even though the schema was already fetched and visible on screen.

**Root cause**: The schema columns were never threaded through the context object between turns. `handleQuery` could pre-fetch and inject schema into the system prompt via the existing `context.lastTable` path (which triggered a cached `fetchSchema` call), but the LLM still called `get_table_schema` anyway because the prompt instruction wasn't forceful enough ("do not call get_table_schema first" is soft). Additionally, `context.lastTableSchema` didn't exist, so the pre-fetched columns weren't distinguishable from a fresh fetch.

**Fix**:
- Added `lastTableSchema` to `ChatContext` and `ProcessMessageArgs`.
- `extractContextFromEnvelope()` now populates `lastTableSchema` from `SCHEMA_VIEW` artifact columns (table scope only).
- `handleQuery` checks `context.lastTableSchema` first; if present and non-empty, uses it directly (no fetch, not even a cache lookup).
- Strengthened the system prompt instruction: when schema is pre-injected, the LLM now reads "it is complete and authoritative. Do NOT call get_table_schema under any circumstances."
- `deriveContextFromItems()` carries `lastTableSchema` forward automatically via `...context` spread.

**Rule**: Schema columns fetched in any prior turn should be stored in context and passed to subsequent turns. Any instruction telling an LLM "you don't need to call this tool" must be absolute and name the tool explicitly -- hedged language like "you don't need to do this first" leaves room for the model to rationalize a call anyway.

### 2026-07-11: Query handler wasted iterations on list_tables/list_datasets

**What broke**: Simple questions like "which drivers had the most points" burned through all 10 tool-call iterations without answering the question. The LLM spent iterations on list_datasets, list_tables, and exploratory queries before reaching the real query.

**Root cause**: The system prompt included the dataset name and available datasets, but NOT the table list for the active dataset. The LLM had to call list_tables to discover what tables existed, then get_table_schema, then run_query -- burning 3-4 iterations before any SQL ran. With schema exploration and retries, it hit the 10-iteration cap.

**Fix**: Pre-fetch the table list via `fetchSchema(dataset)` (already cached) and include it in the system prompt. Updated efficiency rules to say "Do NOT call list_tables or list_datasets" and "Do NOT run exploratory or summary queries." Also filtered system plumbing strings ("Reached maximum tool-call iterations", "No results to display") from the clean-summary check so they never appear as headlines.

**Rule**: When an LLM agent has tools that the system could pre-populate context for, prefer pre-populating. Every eliminated tool call saves an iteration and reduces the chance of the LLM going off-track.

### 2026-07-11: Query briefing showed generic "I ran your query and got N rows"

**What broke**: When asking "which countries have had the most races?", the chat briefing text above the artifact card said "I ran your query against malloy and got 10 rows" instead of a meaningful summary like "Countries with the most races".

**Root cause**: The heuristic briefing in `composeQuery()` (composer.ts lines 390-398) used a generic template that ignored the headline text and LLM summary. Self-review would normally replace this with an LLM-generated briefing, but self-review is skipped for high-confidence keyword matches with <100 rows -- the most common case.

**Fix**: Changed the heuristic briefing to use `headlineText` as the narrative. The headline already contains a meaningful data description (either the LLM `resultSummary` or `buildQueryHeadline()`'s column-aware summary). Zero-row results keep the diagnostic message.

**Rule**: When self-review is skipped (the common path for simple queries), the heuristic briefing IS the final user-facing text. It must be as good as possible on its own, not a placeholder waiting for self-review to fix it.

### 2026-07-11: "show me a map" rendered as schema table, not GEO_POINT_MAP

**What broke**: Prompting "show me a map with pins on each racetrack location" returned a SCHEMA_VIEW table listing instead of an interactive Google Maps view with pins.

**Root cause (routing)**: The query manifest had signals for "chart", "visualize", "histogram", etc. but no signal for "map". The word "map" didn't score for query, so the router matched schema's "show me" signals.

**Root cause (inference)**: `inferVisualizationType` in composer.ts had no lat/lng column detection. Even if query ran, results with `lat`/`lng` columns defaulted to TABLE. The `GeoPointMapRenderer` existed and worked but was never auto-selected.

**Fix**: Added `map`, `map with pins`, `on a map` signals (weight 3-4) to query manifest. Added early lat/lng column name detection in `inferVisualizationType` to return `GEO_POINT_MAP` when both lat and lng columns are present.

**Rule**: When adding a new visualization renderer, also add: (1) routing signals in the query manifest, (2) auto-detection logic in `inferVisualizationType`. Without both, the renderer exists but is unreachable.

### 2026-07-11: splitView not synced on layout switch

**What broke**: Clicking a chat in unified mode, then switching to split layout (Chat left/Chat right) showed the chat list instead of the loaded chat thread.

**Root cause**: `splitView` state in page.tsx was initialized to `'list'` and only changed to `'thread'` by the `onSelectChat` callback. Since the chat was selected in unified mode (which doesn't use `splitView`), the state was never updated.

**Fix**: Added an effect: `if (isSplit && hasChat) setSplitView('thread')`. This ensures that entering split mode with an active conversation immediately shows the thread.

**Rule**: Any state that governs split-layout behavior must be synced when the layout mode changes, not just when the triggering action happens within split mode.

### 2026-07-11: Conversational briefings on every response

**What changed**: Added a `briefing` field to `CompositionEnvelope` containing a narrative string and optional key findings. Self-review generates LLM briefings; composer generates heuristic briefings as fallback. New `BriefingBlock.tsx` renders above artifact cards in both layouts.

**What worked**: Piggybacking on the existing self-review Gemini call for LLM-quality briefings -- no extra latency or cost for complex responses. Heuristic briefings for simple responses (schema, KPI, small queries) are instant.

**What to watch for**: The self-review prompt is now larger (added ~200 chars for BRIEFING dimension + rules). If self-review starts timing out, this would be one factor. Monitor response times.

**Derived rule**: When adding a new field to the response envelope, always populate it in both the heuristic path (composer) and the LLM path (self-review). Relying on only one path leaves gaps depending on self-review gating.

### 2026-07-11: Polymorphic response rendering

**What changed**: Added `presentation: 'custom'` mode to `CompositionEnvelope`. ArtifactCard now has two paths: default (existing chrome) and custom (thin container, view owns layout). Created `CardParts.tsx` with composable building blocks (`CardHeader`, `CardChips`, `SqlPanel`, `CardMeta`). Migrated GovernanceView as the first custom-mode view.

**What worked**: Governance views now render context-appropriate layouts. Zero-result access audit is 3 lines instead of a full card with stat boxes showing zeroes. With-data cases still show tables and badges but skip the redundant SCOPE stat box.

**What broke**: React rules of hooks -- the initial implementation called `useState`/`useEffect` after a conditional early return in ArtifactCard. Fixed by moving all hooks above the conditional.

**Rule**: When adding an early-return rendering path to a React component, all hooks MUST be called before the conditional. Move hooks above the branch, even if only one path uses them.

**Rule**: To migrate a view to custom mode: (1) set `presentation: 'custom'` in the compose function, (2) update the view to accept `CustomViewProps`, (3) add a case in `CustomArtifact` dispatcher, (4) update the old `Artifact` case to a fallback.

### 2026-07-11: UX evaluation -- systemic fixes

**What changed**: 8 fixes based on a 25-scenario UX evaluation with screenshot analysis.

**What worked**: Data-driven headlines now surface actual values instead of generic "X rows from table". Chart routing signals prevent visualization queries from being misrouted to schema. Chronological time-series sorting fixes reversed line charts.

**What broke previously**: `inferVisualizationType()` was charting `SELECT * FROM table LIMIT 20` sample queries because it saw numeric columns and assumed aggregation data. Fixed with an `isSampleQuery` pattern check.

**Root cause (generic headlines)**: `buildQueryHeadline()` only had access to `rowCount` and `sql`. Added `columns` and `rows` parameters so it can inspect actual data values.

**Rule**: Sample/preview queries (SELECT * ... LIMIT N) should always render as TABLE, never charts. Chart inference is for aggregated/analytical results only.

**Rule**: Time-series charts must sort x-axis data chronologically. The SQL ORDER BY may produce newest-first but charts should always read left-to-right oldest-to-newest.

**Rule**: Help/capability intents ("what can you do?") need a static handler with example prompts, not a Gemini round-trip that produces irrelevant query results.

### 2026-07-10 (late): Double sign-in popup race condition

**What changed**: Added a `signingIn` ref to `auth-context.tsx` that guards the `onAuthStateChanged` callback from triggering auto-refresh while `signIn()` is still in progress.

**What broke**: Users were seeing two Google sign-in popups when logging in.

**Root cause**: `signIn()` calls `signInWithPopup()` which causes Firebase to fire `onAuthStateChanged` mid-flow -- before `signIn()` stores the OAuth access token. The `onAuthStateChanged` callback sees the user is logged in but finds no stored token, so it enters the auto-refresh branch and opens a second popup via `signInWithPopup(auth, refreshProvider)`.

**Derived rule**: Any async Firebase Auth state change handler must check whether a manual sign-in flow is already in progress before attempting token refresh or re-authentication.

### 2026-07-10 (late): Tailwind 4 -body class name collision

**What changed**: Renamed `.gc-project-dropdown-body` to `.gc-project-dropdown-list` and `.chat-sidebar-thinking-body` to `.chat-sidebar-thinking-content` in globals.css, TopBar.tsx, and ResultsSidebar.tsx.

**What broke**: The entire app was capped at 320px tall and could not scale with window resize.

**Root cause**: Tailwind 4's CSS processor (`@import "tailwindcss"`) was extracting `body` from class names ending in `-body` and generating bare `body{}` rules in the compiled CSS. `.gc-project-dropdown-body { max-height: 320px }` compiled to `body { max-height: 320px }`, limiting the page height. `.chat-sidebar-thinking-body { border-left: 2px; flex-direction: column }` compiled to another spurious `body{}` rule.

**Rule**: Never use CSS class names that end with `-body` when Tailwind 4 (`@import "tailwindcss"`) is active. The Tailwind CSS processor treats the suffix as the `body` element selector. Use alternatives like `-list`, `-content`, `-wrap`, `-container`, `-inner`.

**Verification**: After build, check `grep -o 'body{[^}]*}' .next/static/chunks/*.css` -- should return only one rule with the expected properties (height, background, overflow, font-family, margin).

### 2026-07-10 (late): browser-testing skill correction

**What changed**: Rewrote `.agents/skills/browser-testing/SKILL.md` to document that the `browser_subagent` tool works on macOS. The old skill file stated `browser_subagent` / `open_browser_url` "do not work on macOS -- they require Linux" and had a "Do NOT Use" section explicitly blocking those tools. This caused every new conversation to refuse browser-based visual testing.

**What broke before**: New conversations would read the skill file and tell the user that browser testing is not possible on Mac, despite the `browser_subagent` tool being fully functional and having been used successfully in prior sessions.

**Root cause**: The original skill file was written with an incorrect assumption about macOS compatibility. The "Do NOT Use" section at the bottom was authoritative enough that every new conversation treated it as a hard constraint.

**Derived rule**: The `browser_subagent` tool works on macOS. Use it for ad-hoc visual checks (screenshots, verifying UI elements, interactive testing). Use the Puppeteer script (`scripts/visual-test.mjs`) for the full automated 20-test suite. The Puppeteer approach is still valuable for auth-protected pages since it uses a persistent Chrome profile.

---

### 2026-07-10 (night): Zero-row query experience improvement

**What changed**: When a query returns 0 rows, the app now (1) blocks the LLM-generated summary headline, using a SQL-aware diagnostic headline instead, (2) generates recovery next-action chips (sample table, view schema), (3) forces TABLE artifact type to prevent empty charts, (4) shows "No rows returned" in DataTable, (5) shows "--" in KpiCard for undefined values, (6) produces SQL-aware quality flag messages, and (7) instructs self-review not to generate optimistic headlines for empty results.

**What broke before**: The LLM summary was written assuming data would be returned, producing misleading headlines like "Discover and optimize your malloy-data storage footprint" for a 0-row INFORMATION_SCHEMA.TABLE_STORAGE query. No recovery chips were generated. DataTable rendered an empty tbody. KpiCard showed undefined.

**Root cause**: The composer's headline logic checked `isCleanSummary` before checking `rowCount === 0`, so the LLM summary always won. Next-action chip generation was gated on `rowCount > 0` with no zero-row alternative. No UI components had empty-state handling.

**Derived rule**: For zero-row results, always use the diagnostic headline builder, never the LLM summary. The LLM summary is written at query-generation time before results are known, so it cannot account for empty results.

### 2026-07-10 (late): Composer now infers chart type from data shape

**What changed**: Replaced `vizTypeToArtifactType()` (a passthrough of the LLM hint) with `inferVisualizationType()` that classifies columns as numeric/date/categorical and picks the right chart. Also improved `buildQueryHeadline()` to generate descriptive summaries from column names.

**What worked**: The existing `ChartWithToggle` component immediately started rendering charts with the toggle pill once the composer returned non-TABLE types. Zero UI changes needed.

**Root cause**: The query handler hardcodes `suggestedVisualization: 'TABLE'`. The self-review pass could override it, but self-review is skipped for high-confidence keyword-matched queries with <100 rows (the most common case). So the composer invariant "chart type by data shape" was documented but never actually implemented.

**Rule**: When an invariant says behavior X should happen, verify it in code. Documented-but-not-implemented invariants are bugs.

---



**What changed**: Renamed "Saved" to "Spaces" in sidebar. Created SpacesPage with folder-like spaces, drag-and-drop, card/list view switcher, inline rename, context menus, and breadcrumb navigation. Created dedicated FavoritesPage showing favorited chats and pinned artifacts. Rewrote OverviewDashboard to remove broken KPI StatCards and replace with Recent Charts and Recently Saved sections. Added Space type, spaceId to SavedArtifact, and space CRUD operations to saved-work.ts.

**What worked**: Using subagents in parallel to write the three large page components (Overview, Favorites, Spaces) while the main agent handled types, data layer, routing, and sidebar changes. All three compiled cleanly.

**What to watch**: The `onLoadConversation` callback in FavoritesPage receives a favorite item ID, not a conversation ID. FavoriteItem doesn't store the originating conversation ID, so loading the actual conversation may not work as expected.

**Derived rule**: When a saved concept (like FavoriteItem) is created to reference another entity (like a conversation), always store the source entity's ID at creation time.

---

### 2026-07-10: Fix "Suggest next steps" error after table schema view
**Scope**: composer.ts, handle-governance.ts, handle-query.ts, ArtifactCard.tsx
**What broke**: Clicking "Suggest next steps" after viewing a table schema produced `Not found: Dataset malloy-data:ecomm.INFORMATION_SCHEMA was not found in location US`.
**Root cause (3 compounding bugs)**:
1. `composeSchema()` returned empty `nextActions` for TABLE scope, triggering a generic fallback chip that sent the vague message "What can I do next with these results?" -- no keyword signals, fell to LLM classifier, which routed unpredictably.
2. `handle-governance.ts` had 7 INFORMATION_SCHEMA references with INFORMATION_SCHEMA *inside* the backtick-quoted identifier (`` `project.dataset.INFORMATION_SCHEMA.VIEW` `` instead of `` `project.dataset`.INFORMATION_SCHEMA.VIEW ``). BigQuery interprets the former as a dataset name.
3. The query handler's LLM prompt didn't warn about INFORMATION_SCHEMA being an exception to the backtick rule, so Gemini extended the "wrap everything in backticks" instruction to INFORMATION_SCHEMA paths.
**Fix**:
- Added 3 contextual next-action chips for TABLE scope schemas (Query, Profile, Check freshness)
- Fixed all 7 governance INFORMATION_SCHEMA backtick references
- Added INFORMATION_SCHEMA exception to the query handler's LLM prompt
- Made the fallback chip message context-aware (references actual table name)
**Rule**: INFORMATION_SCHEMA views must always be OUTSIDE backtick-quoted identifiers. The correct pattern is `` `project.dataset`.INFORMATION_SCHEMA.VIEW_NAME ``. Added to invariants.

---

### 2026-07-10: Backtick-quote region identifier in overview JOBS_BY_PROJECT query
**Scope**: OverviewDashboard.tsx
**What broke**: Overview page showed "Could not load recent activity: Syntax error: Expected end of input but got '-' at [11:34]".
**Root cause**: The SQL for fetching recent jobs used `region-${region}` unquoted. The hyphen in `region-us` was parsed as a minus operator. This violates the existing invariant about backtick-wrapping identifiers containing hyphens.
**Fix**: Changed to `` \`region-${region}\` `` (backtick-quoted).
**Rule**: Already documented in invariants -- all identifiers containing hyphens must be backtick-quoted. This was a missed instance.

---

### 2026-07-10: Replace rigid query pipeline with Gemini tool-calling agent
**Scope**: handle-query.ts, gemini-client.ts, bq-tools.ts (new)
**What broke**: Simple queries like "show first 10 rows" took minutes due to ~30 BigQuery API calls in `buildSchemaContext()` fetching schema for all tables in the dataset.
**Root cause**: `handleQuery()` always ran a fixed pipeline: buildSchemaContext (fetch all table schemas) -> callGemini (generate SQL) -> dryRun -> executeQuery. No matter how simple the query, it fetched column lists for 5 tables + sample values + constraint queries.
**Fix**: Replaced with `callGeminiWithTools()` loop. The LLM gets 4 tools (run_query, get_table_schema, list_tables, list_datasets) and decides what context to fetch. Simple queries go directly to `run_query` (1 LLM call + 1 BQ call).
**Results**: Simple preview: 9s. Analytical query: 32s. Ambiguous query: 24s. All 4/4 test scenarios pass.
**Tuning applied**: (1) System prompt with explicit efficiency rules -- "don't call list_tables if the user named a table". (2) maxIterations increased from 6 to 10 -- analytical queries need 7+ iterations for schema exploration + SQL retry. (3) The LLM self-corrects errors naturally (tried `orders`, got 404, found `order_items` via list_tables).
**Rule**: The query handler must use tool-calling, not a fixed pipeline. Do not re-add buildSchemaContext or dryRun to handle-query.ts. maxIterations cap of 10 balances latency vs capability.

---

### 2026-07-10: Auth tokens stored in localStorage with expiry tracking
**Scope**: gis-auth.ts, auth-context.tsx
**What broke**: App showed the sign-in page on every tab close, new tab, or reload after ~1hr token expiry. Blocked Antigravity automated testing.
**Root cause**: OAuth access token was stored in `sessionStorage` (tab-scoped, dies on close). Firebase Auth itself persists via IndexedDB, so the *identity* survived but the *BigQuery token* did not. `bqAuthorized` requires both.
**Fix**: Moved to `localStorage`. Added `bqaif_token_ts` timestamp alongside the token. Added `isTokenLikelyExpired()` (50-min threshold). On `onAuthStateChanged`, if user exists but token is missing/expired, auto-trigger `signInWithPopup(refreshProvider)` which auto-closes in <1s.
**Rule**: OAuth token storage must use `localStorage`, not `sessionStorage`. Token freshness must be tracked via a companion timestamp key. Auto-refresh must be gated by a ref (`autoRefreshAttempted`) to prevent popup storms.

---

### 2026-07-09: Fix basic aggregation queries routed to multistep instead of single-step query
**Scope**: router.ts, chat-orchestrator.ts, intent-routing.md
**What broke**: "show me how many total sales there was for the store BARMUDA DISTRIBUTION" produced a 3-step multistep workflow (list tables, describe table, calculate total sales) instead of a single query skill producing a KPI card.
**Root cause**: Two compounding issues: (1) no keyword signals existed for basic aggregation phrases ("how many", "total", "sum of", etc.) so the router defaulted to `query` with `medium` confidence, forcing a round-trip to the LLM intent classifier; (2) the LLM classifier returned `isMultistep: true` with 3 steps despite the prompt saying single-verb requests are never multistep, and the existing guard only caught exactly 2-step schema+query patterns.
**Fix**: Added 27 analytical/aggregation phrases to `QUERY_SIGNALS` in router.ts (e.g., "how many" weight 3, "total" weight 2). This gives the target prompt a query score of 5, producing `high` confidence and bypassing the LLM classifier entirely. Also generalized the multistep collapse guard from `steps.length === 2 && steps[0].skill === 'schema' && steps[1].skill === 'query'` to `lastStep.skill === 'query' && allOtherSteps.every(s => s.skill === 'schema')`.
**Rule 1**: Any common analytical phrase that should obviously route to query must have a keyword signal. If users can express it in plain English and it unambiguously means "run a query", it needs a signal.
**Rule 2**: The multistep collapse guard must handle N-step patterns, not just exactly 2 steps.

---

### 2026-07-09: Inline chat confirmations
**Scope**: InlineConfirmation.tsx (new), ChatThread.tsx, ResultsSidebar.tsx
**What changed**: Moved COST_CONFIRM_CARD and CONFIRMATION_CARD rendering from ArtifactCard (results panel in split layout) into lightweight inline chat messages with action buttons. Created InlineConfirmation.tsx with InlineCostConfirm and InlineDmlConfirm components. InlineDmlConfirm has a `compact` prop -- full detail (with DEDUPE preview table) in unified ChatThread layout, simplified summary in split-layout sidebar.
**What worked**: Intercepting confirmation envelopes in the message rendering loop (before they reach ArtifactCard) and filtering them from `allEnvelopes` in ResultsSidebar is clean and requires no backend changes.
**Rule**: Confirmation envelopes should render inline in the chat, not in the results panel. The existing handleConfirm/handleCancel state management in useChatOrchestration.ts did not need changes -- only the rendering location changed.

---

### 2026-07-09: Conversation continuity + export expansion
**Scope**: ConversationSummary.tsx, conversation-context.tsx, ChatThread.tsx, DataLoadingView.tsx, types.ts, useChatOrchestration.ts
**What changed**: Added ConversationSummary component that derives operation history from messages array. Enhanced conversation-context with operation log tracking. Expanded DataLoadingView with Create View DDL, Looker Studio links, Copy as Table, and Export Format Selector. Fixed duplicate PipelineResult type definition.
**What worked**: Deriving ConversationSummary entirely from the messages array avoids new state coordination. The scrollContainerRef approach for jump-to-message is clean. The `extractTable` utility reuse between ConversationSummary and the hook is consistent.
**Gotcha**: There were two `PipelineResult` interfaces in types.ts -- interface merging made the first definition's stricter `pipelineType: string` override the second's union literal, and the required `sql: string` in confirmation override the optional `sql?: string`. Removing the first (stricter) definition fixed all type errors.
**Rule**: Never define the same interface name twice in one file. TypeScript interface merging picks the intersection of property types, which can silently narrow optionals to required and break downstream consumers.

### 2026-07-09: Added governance skill (access audit, security, PII, classification)

**What worked**: Following the established skill handler pattern (router signals -> gemini-client schema -> handler -> composer -> view -> artifact card) made integration straightforward. All INFORMATION_SCHEMA queries are wrapped in try/catch because views like ROW_ACCESS_POLICIES and COLUMN_FIELD_PATHS may not be accessible in all projects.

**What to watch**: The PII scan is heuristic and samples only 1,000 rows. Phone number pattern (10-11 digits) may false-positive on numeric IDs. Credit card pattern (13-16 digits) may false-positive on large integers. The DLP recommendation banner makes this clear to users.

**Derived rule**: When adding INFORMATION_SCHEMA-based queries, always wrap in try/catch -- not all views are available in all projects/regions, and missing permissions should fail gracefully, not crash the handler.

---

### 2026-07-09: ML read-path routing and saved work system

**What**: Added QUERY_SIGNALS to the keyword router for ML function phrases (predict, evaluate, forecast, etc.), created a saved work system with Firestore persistence and a library UI, added save chips to query and data quality results.

**Worked**: ML-related queries now score into the query skill via the scoring engine instead of falling through to the no-signal default. Save action interception in handleChipClick uses dynamic import to lazy-load saved-work.ts, avoiding bundle bloat for users who never save. The existing Firestore user-document pattern (merge writes into `users/{uid}`) works cleanly for saved work items.

**Design decision**: Save actions are intercepted in handleChipClick before reaching the orchestrator. This avoids a round-trip through the LLM classifier and keeps saves instant. The `saveAction` flag in the chip context acts as a discriminator.

**Lesson**: When adding a new signal list to the scoring engine, the key in the scores Record must match an existing SkillName value. 'query' was not previously in the scored map because query was the default fallback. Adding it explicitly means ML phrases now outcompete weak signals from other skills.

### 2026-07-09: Auth retry now re-sends original request after sign-in
**Scope**: `src/app/page.tsx` L479-492
**What changed**: The auth error retry function was `signIn` alone, which opened the sign-in popup but dropped the user's original request. Changed it to an async function that calls `signIn()`, and if successful, removes the failed message pair (user + empty assistant) from state and calls `sendMessage(text)` to replay the original request.
**What worked**: Capturing `text` in the closure at error time preserves the exact user input. Removing 2 messages (user + empty assistant) before calling `sendMessage` avoids duplicate user messages since `sendMessage` always appends a fresh user message.
**Gotcha**: Must remove the user message too (not just the empty assistant), because `sendMessage` unconditionally appends a new user message at the start.
**Rule**: When retrying after auth refresh, always clean up the messages added by the failed attempt before re-invoking the send function.

### 2026-07-07: Consolidated format utils and shared UI primitives
**Scope**: `src/lib/format.ts` (new), `src/components/ui/` (new), 12 consumer files
**What changed**: Extracted `formatBytes`, `truncateLabel`, `truncateEmail`, and `relativeTime` from 10 components into a single shared module. Created reusable `StatCard`, `Badge`, and `Tooltip` components to replace 5 local stat card variants and provide reusable UI primitives.
**What worked**: All builds passed on first attempt. The shared `formatBytes` uses log-based unit selection which is the superset of all existing variants.
**Gotcha**: Two components (LineageDagView, StorageBreakdownView) had `truncateLabel` functions that accepted pixel widths and internally converted to character counts. The shared `truncateLabel` takes character counts directly. The conversion was moved inline at the call sites (`Math.floor(px / 6.5)` for StorageBreakdownView, `Math.floor(px / 7)` for LineageDagView).
**Rule**: When consolidating functions with similar names but different parameter semantics, keep the simpler (more primitive) interface in the shared module and push domain-specific conversions to the call sites.

### 2026-07-07: Scientific notation in KPI cards for monetary aggregates
**Scope**: `src/lib/bigquery-client.ts`, `src/lib/format-value.ts` (new), `src/components/KpiCard.tsx`, `src/components/DataTable.tsx`, chart components
**What broke**: "Total sales" KPI displayed `5.0938588796004164E8` instead of `$509,385,888`. All numeric values rendered as raw strings throughout the app.
**Root cause**: BigQuery REST API returns all cell values as strings (including numbers). `parseQueryResponse` passed `cell.v` through without type coercion, so `typeof value === 'number'` checks always failed. Additionally, no formatting layer existed to detect monetary columns and apply currency symbols.
**Fix**: (1) Added `coerceValue()` in `parseQueryResponse` that uses BigQuery schema field types to convert strings to native JS numbers/booleans. (2) Created `format-value.ts` with `formatDisplayValue()` (detects currency columns via column name heuristics like `sale`, `revenue`, `price`, `cost`) and `formatCompactValue()` (compact notation for chart axes). (3) Updated all display components.
**Rule**: BigQuery REST API values are always strings. Any new data path from BigQuery must coerce types using the schema's field type metadata. Currency detection is heuristic-based on column names -- if a monetary column has an unusual name, add it to the `CURRENCY_PATTERNS` regex in `format-value.ts`.

---

### 2026-07-07: String entity filters returning zero rows due to exact match
**Scope**: `public/skills/query.md`, `src/lib/chat-orchestrator.ts` (`buildSchemaContext`)
**What broke**: "total sales for HY-VEE FOOD STORE" returned a KPI card with zero/null total. The SQL used `WHERE store_name = 'HY-VEE FOOD STORE'` but actual values have location suffixes (e.g., "HY-VEE FOOD STORE / IOWA FALLS").
**Root cause**: Two issues: (1) No prompt guidance for fuzzy/partial string matching -- the LLM defaulted to `=` for all string filters. (2) `buildSchemaContext()` only sent column names and types, not sample values, so the LLM had no visibility into actual data patterns.
**Fix**: (1) Added a "String filtering" section to `query.md` instructing the LLM to use `UPPER(column) LIKE UPPER('%value%')` by default for entity name filters, reserving `=` for short enumerated values. (2) Enhanced `buildSchemaContext()` to fetch 3 sample DISTINCT values for up to 3 STRING columns of the priority/target table via lightweight queries.
**Rule**: Entity name string filters must default to LIKE, not =. The LLM needs sample values to understand data patterns -- schema context must include them for the target table.

---

### 2026-07-07: Cost confirm card not dismissed on Run Anyway / Cancel
**Scope**: `src/app/page.tsx` (`handleConfirm`)
**What broke**: Clicking "Run anyway" on a `COST_CONFIRM_CARD` executed the query but left the confirmation card visible in the chat. The card never disappeared.
**Root cause**: `handleConfirm` appended the new response to `messages` via `[...messages, assistantMsg]` but never removed the old envelope containing the `COST_CONFIRM_CARD`. The `handleCancel` function already had the correct removal logic; `handleConfirm` was missing it.
**Fix**: Before appending the new response, filter out the confirmed envelope from existing messages using the same pattern as `handleCancel`.
**Rule**: Any handler that replaces a confirmation card with a new response must also remove the original confirmation envelope from messages.

---

### 2026-07-01: OAuth token expiration breaks app mid-session
**Scope**: `src/lib/auth-context.tsx`, `src/lib/bigquery-client.ts`, `src/app/page.tsx`
**What broke**: The Google OAuth access token (for BigQuery/Cloud Platform) expires after ~1 hour. Firebase Auth stays signed in but all API calls fail with 401. The user sees "Session Expired" and has to manually re-authenticate, losing their in-progress query.
**Root cause**: Three problems: (1) No automatic token refresh mechanism. (2) `handleAuthError()` did a hard page redirect, blowing away app state. (3) The error catch block only showed a banner, never attempted to recover.
**Fix**: (1) Added `refreshAccessToken()` using a Google provider without `prompt: 'consent'` -- popup auto-completes instantly. (2) Removed the hard redirect from `handleAuthError()`. (3) Added `withAuthRetry()` wrapper around all orchestrator call sites that catches auth errors, refreshes token, and retries once.
**Rule**: All orchestrator calls must go through `withAuthRetry()`. `handleAuthError()` must never redirect.

### 2026-07-01: Follow-up prompts treated as fresh requests (redundant schema+query multistep)
**Scope**: `src/lib/chat-orchestrator.ts` (LLM classifier prompt), `src/lib/router.ts` (filter regex)
**What broke**: When a table schema was displayed and the user asked to "filter the table down to only rum categories," the system created a 2-step workflow: (1) re-fetch the schema (redundant), (2) run the filter query. This caused double cost confirmations and a frustrating UX.
**Root cause**: The LLM intent classifier prompt received no conversational state. It knew the project, dataset, and available datasets, but not what the user was currently looking at (lastSkill, lastTable). Without this, it treated every prompt as a fresh start and decomposed it into schema-fetch + query. Additionally, the keyword router's filter regex only matched "filter" followed by {where, by, the, this, that}, missing natural phrasings like "filter it down", "filter to only".
**Fix**:
1. Added `buildConversationStateSummary()` -- a skill-agnostic function that describes the full conversational state (what the user is viewing, which skill produced it, which table/dataset) and injects it into the classifier prompt.
2. Added a structural guard: if the LLM decomposes into schema+query, collapse to single-step query. `handleQuery()` calls `buildSchemaContext()` internally, so a separate schema step is always redundant.
3. Expanded the filter regex to include {it, down, out, only, to} as defense-in-depth.
**Rule**: The LLM classifier must always receive the full conversational state. Every prompt is a continuation of the conversation unless the user explicitly changes subject. Schema+query multistep decomposition is structurally redundant and must be collapsed.

### 2026-07-01: LLM generates SQL against wrong table (liquor_backup -> faa.airports)
**Scope**: `src/lib/chat-orchestrator.ts` (`buildSchemaContext`, `handleQuery`, `handleDataManagement`)
**What broke**: When the user asked to "filter the liquor_backup table for rum categories," the system generated SQL against `malloy-data.faa.airports` -- a completely different table. The subtitle correctly identified the target table, but the SQL was wrong.
**Root cause**: Two compounding issues:
1. `buildSchemaContext()` only sent schemas for the first 5 tables (alphabetically) in the dataset. If the target table wasn't in the first 5, the LLM never saw its schema.
2. `handleQuery()` accepted `context.lastTable` in its signature but never used it. The system instruction sent to the LLM contained no explicit mention of which table the user was asking about, leaving the LLM to guess from whatever schemas it received -- or hallucinate from training data (faa.airports is a well-known BigQuery public dataset).
**Fix**: (1) `buildSchemaContext()` now accepts a `priorityTable` parameter. When set, that table's schema is always fetched first, and the remaining 4 slots are filled with other tables. (2) `handleQuery()` extracts the target table from the message (by matching against the dataset's actual table names) or from `context.lastTable`, then passes it to `buildSchemaContext` and adds a `CRITICAL` instruction to the LLM prompt: "You MUST use this exact table in your SQL query." Same fix applied to `handleDataManagement()`.
**Rule**: When the user references a specific table by name, the LLM prompt must (a) always include that table's schema in the context and (b) explicitly name the target table in the system instruction. Never rely on the LLM to pick the right table from an incomplete list of schemas.

### 2026-07-01: Session expired "Try again" was looping instead of re-authenticating
**Scope**: `src/app/page.tsx`, `src/lib/bigquery-client.ts`
**What broke**: After the OAuth access token expired (~1 hour), the "Session Expired" banner appeared with a "Try again" button. Clicking it retried the same message with the same expired token, failing again immediately. Two separate issues:
1. The `retryFn` for auth errors was `() => sendMessage(text)` -- it retried the message instead of calling `signIn()`.
2. `handleAuthError()` in `bigquery-client.ts` did `window.location.href = '/'` without clearing the stale token from sessionStorage. The redirect landed back on the app (not the sign-in page) because `bqAuthorized` still evaluated to true.
**Fix**: (1) Auth errors now set `retryFn = signIn` and the button label changes to "Sign in again". (2) `handleAuthError()` now clears `bqaif_access_token` from sessionStorage before redirecting.
**Rule**: When an auth error occurs, the recovery action must obtain a new token, not retry with the old one. Any auth error handler that redirects must also clear cached credentials.

### 2026-07-01: Plan caching, conditional self-review, and result quality flags
**Scope**: `src/lib/plan-cache.ts` [NEW], `src/lib/result-quality.ts` [NEW], `src/lib/chat-orchestrator.ts`, `src/lib/composer.ts`, `src/lib/types.ts`, `src/components/ArtifactCard.tsx`
**What changed**: Three latency and quality improvements:
1. **Plan cache**: Session-scoped cache of recent query plans. When the user iterates on the same question with different parameters (dates, filters, LIMIT), the cached SQL template is reused with parameter substitution, skipping the Gemini SQL generation call entirely. FIFO eviction at 20 entries.
2. **Conditional self-review**: The self-review Gemini call is now skipped for: (a) schema results at PROJECT/DATASET scope, (b) KPI_CARD results, (c) high-confidence keyword-routed queries with <100 rows. Saves 1-3s on ~40-60% of requests.
3. **Result quality flags**: After query execution, `analyzeResultQuality()` scans result rows for null rates >20%, categorical near-duplicates, zero-row results, and single-value columns. Flags appear as dismissible banners in the UI with context-aware next-action chips.
**Design decision**: Single-value column detection suppresses columns that appear in WHERE clauses, since a single value is expected when the user explicitly filtered on that column.
**Rule**: When adding new heuristic flags, cap total flags at 5 per result and next-action chips at 4 per envelope (existing invariant). Plan cache entries are keyed by dataset, not table -- SQL template substitution handles the rest.

### 2026-07-01: Freshness monitoring handler treating project name as dataset name
**Scope**: `src/lib/chat-orchestrator.ts` (handleMonitoring FRESHNESS block), `src/lib/types.ts`, `src/lib/composer.ts`, `src/components/FreshnessView.tsx`
**What broke**: "check data freshness" returned "No tables found in the 'malloy-data' dataset" -- but malloy-data is a project, not a dataset.
**Root cause**: `handleMonitoring()`'s context type only accepted `project`, `uid`, and `handoffContext`. The FRESHNESS handler's dataset resolution (`const dataset = (hc?.dataset as string) || ''`) only checked handoff context, ignoring `context.resolvedDataset` and `context.dataset` from the enriched context. When dataset was empty, it set `result.dataset = dataset || project`, making the project name appear as a dataset name in the UI.
**Fix**: (1) Expanded `handleMonitoring` context type to include `resolvedDataset`, `dataset`, `availableDatasets`. (2) Changed FRESHNESS dataset resolution to fall through: `hc.dataset -> context.resolvedDataset -> context.dataset -> extractDatasetFromMessage()`. (3) Made `FreshnessResult.dataset` nullable (null = project scope). (4) Updated composer and FreshnessView to distinguish project-scope vs dataset-scope labeling.
**Rule**: Every skill handler that needs dataset context MUST accept and use `resolvedDataset` from the enriched context, not just handoff context. When a result can be at project scope, the `dataset` field should be null/empty, with a separate `project` field for labeling.

### 2026-06-30: Data lineage visualization implementation
**Scope**: `src/components/LineageDagView.tsx`, `src/lib/chat-orchestrator.ts` -- `handleDiscovery()`
**What worked**: Built a DAG visualization using JOBS_BY_PROJECT INFORMATION_SCHEMA to extract source->destination table relationships from job history.
**Rule**: Lineage data comes from `INFORMATION_SCHEMA.JOBS_BY_PROJECT` -- filter for `statement_type` in ('SELECT', 'CREATE_TABLE_AS_SELECT', 'INSERT', 'MERGE') and extract referenced/destination tables.

### 2026-06-30: Dataset table listing returning all datasets instead of tables in dataset
**Scope**: `src/lib/chat-orchestrator.ts` -- `handleSchema()` / `extractSchemaIdentifiers()`
**What worked**: The schema handler needed to check if the extracted name matches a known dataset name before defaulting to TABLE scope. Added dataset name validation against available datasets list.
**What broke on first attempt**: Changed the conditional but didn't account for unqualified names (no project prefix). Entity resolution in the router doesn't distinguish dataset names from table names when no qualifier is present.
**Root cause**: `extractSchemaIdentifiers()` was using `TABLE_DESCRIBE_SIGNALS` matches without checking if the extracted name was actually a dataset. When user says "what's in analytics", "analytics" is a dataset, not a table.
**Rule**: Always check extracted identifiers against the `availableDatasets` list before deciding scope. A name that matches a known dataset should route to DATASET scope, not TABLE scope.

### 2026-06-30: Infinite refresh loop after session expiration
**Scope**: `src/app/layout.tsx`, `src/app/page.tsx`, authentication middleware
**What worked**: Added proper session state guards to prevent re-render cycles when auth token expires.
**What broke on first attempt**: The auth context was triggering a re-render which triggered auth check which triggered re-render.
**Root cause**: The auth state change handler was calling setState unconditionally, causing a render loop when the token was expired.
**Rule**: Auth state handlers must be idempotent -- only call setState when the new state actually differs from current state. Use a ref to track the previous auth state and compare before updating.

### 2026-06-26: Table duplication task routing
**Scope**: `src/lib/router.ts` -- `MUTATING_VERBS`
**What worked**: Added 'duplicate', 'copy', 'replicate', 'make a copy' to mutating verbs list.
**What broke on first attempt**: 'duplicate' as a noun ("find duplicates") was now routing to data-management instead of data-quality.
**Root cause**: The word 'duplicate' is ambiguous -- as a verb it means 'copy this table', as a noun/adjective it means 'find duplicate rows'.
**Rule**: When adding ambiguous words to MUTATING_VERBS, also add the full-phrase counterpart to DATA_QUALITY_SIGNALS with high weight (>=3). The scoring system resolves conflicts by checking if a multi-word quality phrase is present alongside the verb match.

### 2026-06-24: Dataset listing performance issues
**Scope**: `src/lib/skills/schema.ts` -- `fetchProjectSchema()`
**What worked**: Added pagination support and parallel table count fetching.
**Root cause**: Was fetching all datasets sequentially without pagination. Large projects with many datasets would timeout.
**Rule**: All BigQuery list operations must support pagination (check for `nextPageToken`). Use `Promise.all()` for independent per-dataset fetches.

### 2026-06-24: App flashing on reload
**Scope**: `src/app/page.tsx`, `src/app/globals.css`
**What worked**: Ensured initial render state matches server-side render to prevent hydration flash.
**Root cause**: Client-side state initialization differed from server-side, causing a visible flash during hydration.
**Rule**: Initial state for any component that renders on first paint must produce the same HTML on server and client. Use CSS to hide content until hydrated if necessary, not conditional rendering.

## 2026-07-12 — Profile tab: lazy-load behind Generate button

**What changed:** `SchemaView.tsx` + `preview-client.ts`

**Problem:** `fetchTablePreview` was called eagerly on mount, firing a full-table-scan profile query (COUNT DISTINCT, MIN, MAX, NULL rates for every column + top-values GROUP BY per string column) against the table/view immediately. On large views like `formula_1_all_data_view` this hung the UI for 30–60 seconds.

**Fix:**
- Added `sampleOnly = false` flag to `fetchTablePreview`. When true, only `SELECT * LIMIT 20` runs and profile is returned as an empty array.
- Split `TableSchemaView` state: `sampleData` (fetched eagerly with `sampleOnly=true`) and `profileData` (fetched on demand).
- `ProfileTab` now shows an analytics icon + "Generate Profile" button when no profile data exists. Clicking triggers `generateProfile()`, shows skeleton while running, then renders cards in-place.
- Pulse dot in Profile tab header only shows while profile is actively generating.

**Derived rule:** Never fire expensive full-table-scan queries eagerly on schema view load. Always gate them behind user intent.
