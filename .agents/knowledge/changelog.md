# Session Changelog

A record of what changed in each coding session. Read this to understand recent changes without digging through git diffs.

---

## 2026-07-11: UX evaluation pass -- 8 systemic fixes

**Context**: Ran a 25-scenario UX evaluation with browser screenshots and Gemini scoring. Identified 10 systemic issues and implemented the top 8 fixes.

**What changed**:
1. **Chart routing**: Added chart/visualization signals (pie chart, bar chart, line chart, graph, plot, histogram) to the query manifest with high weights (3-4).
2. **Data-driven headlines**: Rewrote `buildQueryHeadline()` to produce context-aware headlines using actual data values.
3. **Sample data forced TABLE view**: `isSampleQuery` check prevents charting random sample data.
4. **Schema tab auto-switch**: When preview has zero rows, auto-switches to Schema tab.
5. **Chronological time-series sorting**: `useChartSetup` sorts date-like x-axis data chronologically.
6. **Capability overview**: Help intent detection returns structured capability table with example prompts.
7. **Human-readable timestamps**: `normalizeTimestamp()` outputs "Jul 11, 2026 3:25 AM" format.
8. **Additional query signals**: Added "revenue", "by status", "busiest" to query manifest.

**Files touched**: `handle-query.ts`, `composer.ts`, `chat-orchestrator.ts`, `SchemaView.tsx`, `recharts-charts.tsx`, `handle-monitoring.ts`.

---

## 2026-07-10 (night): Fix double sign-in popup

**What changed**: Added a `signingIn` ref guard in `auth-context.tsx` so that `onAuthStateChanged` skips auto-refresh while `signIn()` is still in progress. This prevents the race condition where Firebase fires the auth state change before the OAuth token is stored, causing a second popup.

**Files touched**: `src/lib/auth-context.tsx`.

---

## 2026-07-10 (night): Chat title = latest prompt, sidebar toggle removed, layout-aware chat selection

**What changed**:
- Chat conversation titles in the sidebar now reflect the most recent user prompt, not the first message. The `persistConversation` function in `useChatOrchestration.ts` was changed to always use `autoTitle(lastUserMsg)`.
- Removed the ability to hide/show the chat sidebar: removed the close button from `ChatSidebar.tsx` header, the toggle button from `page.tsx`, and the history toggle from `TopBar.tsx`.
- ChatSidebar now uses CSS transition animation (`width`/`min-width` with `overflow: hidden`) to smoothly animate in/out instead of hard show/hide.
- When clicking a chat in the list:
  - Unified layout: sidebar animates out completely
  - Split layout (chat-left/chat-right): sidebar animates out and ResultsSidebar takes its place
- Sidebar automatically reappears when starting a new conversation (no messages).
- `historyHiddenBefore` is now always 0 (all history visible).

**Files touched**: `useChatOrchestration.ts`, `ChatSidebar.tsx`, `page.tsx`, `TopBar.tsx`.

---

## 2026-07-10 (night): Revert ChatSidebar to list-only mode

**What changed**:
- Removed the "detail view" from ChatSidebar that was replacing the conversation list with an inline chat thread when a conversation was selected.
- The sidebar now always shows the conversation list. Selecting a conversation loads it in the main content area (ChatThread) where the full chat interface with prompt, results, artifacts, "show thinking", etc. is displayed.
- Removed all chat-state props (messages, input, loading, contextItems, onSend, etc.) from ChatSidebar's interface since it no longer renders chat content.

**Files touched**: `ChatSidebar.tsx`, `page.tsx`.

---

## 2026-07-10 (night): Fix app not scaling with window resize

**What changed**:
- Renamed `.gc-project-dropdown-body` to `.gc-project-dropdown-list` and `.chat-sidebar-thinking-body` to `.chat-sidebar-thinking-content`.
- Tailwind 4's CSS processor was extracting `body` from these class names and generating bare `body{}` rules in the compiled output. The `.gc-project-dropdown-body` rule compiled to `body{max-height:320px}`, capping the entire app at 320px tall.

**Files touched**: `globals.css`, `TopBar.tsx`, `ResultsSidebar.tsx`.

---

## 2026-07-10 (night): Table click prompt simplified

**What changed**:
- All table-click handlers across 6 UI components now send `Show me <table>` instead of `Show me the schema for <table>`.
- Aligns with user mental model: clicking a table means "show me the table" (data, profile, schema), not just schema.
- Added `show me` (weight 2) signal to the schema skill manifest to help the router classify these shorter prompts.
- Updated `task-catalog.mjs` test prompt to match.

**Files touched**: `page.tsx`, `DataQualityView.tsx`, `ErDiagramView.tsx`, `FreshnessView.tsx`, `StorageBreakdownView.tsx`, `ResultsSidebar.tsx`, `handle-schema.ts`, `task-catalog.mjs`.

---

## 2026-07-10 (night): ChatSidebar redesigned to match Neptune

**What changed**:
- Rewrote `ChatSidebar.tsx` to match the Neptune project sidebar design.
- Added blue dot status indicators for each conversation (filled dot for completed, spinning `progress_activity` for active).
- Added pin/unpin support: context menu option, pin icon on pinned items, pinned items sorted first.
- "All chats" is now a dropdown filter with options for "All chats" and "Pinned".
- Title font weight increased to 600 to match Neptune's bolder style.
- Added `@keyframes chat-sidebar-spin` animation in `globals.css` for the active chat spinner.
- Pin state is persisted in `localStorage` under key `bqaif_pinned_chats`.
- Replaced preview text (second line) with relative timestamps (e.g. "3h ago", "2d ago").
- Added two-state sidebar: list view and detail view. Clicking a chat or creating a new one navigates into the detail view showing the conversation's messages and a docked prompt input at the bottom. Back arrow returns to list.
- `ChatSidebar` now receives chat orchestration props (`messages`, `chatLoading`, `input`, `setInput`, `activeProject`, `contextItems`, `onSend`, `onRemoveContext`, `onKeyDown`) from `page.tsx`.

**Files**:
- `src/components/ChatSidebar.tsx` -- full rewrite (two-state list/detail view)
- `src/app/page.tsx` -- updated ChatSidebar usage to pass chat state props
- `src/app/globals.css` -- added spinner animation

---

## 2026-07-10 (late): browser-testing skill correction

**What changed**:
- Rewrote `.agents/skills/browser-testing/SKILL.md` to remove the false claim that `browser_subagent` does not work on macOS.
- Added `browser_subagent` as the primary method for ad-hoc visual testing (screenshots, UI verification, interactive exploration).
- Retained the Puppeteer script documentation as Method 2 for the full automated test suite.
- Removed the "Do NOT Use" section that was blocking `browser_subagent` and `open_browser_url` tools.

**Files**:
- `.agents/skills/browser-testing/SKILL.md` -- full rewrite

---

## 2026-07-10 (night): Zero-row query experience improvement

**What changed**:
- **Diagnostic headlines** (composer.ts): Zero-row results now always use `buildQueryHeadline()` instead of the LLM summary. Headlines are SQL-aware: INFORMATION_SCHEMA queries get "No metadata returned -- check region and permissions", WHERE-filtered queries get "No rows matched your filter criteria", and generic queries get "Query returned no results -- the table may be empty or filters too restrictive".
- **Recovery chips** (composer.ts): Zero-row results generate "Sample [table]" and "View [table] schema" next-action chips instead of the previous empty chip set.
- **Force TABLE artifact** (composer.ts): Zero-row results force TABLE artifact type regardless of LLM suggestion, preventing chart components from receiving empty data.
- **SQL-aware quality flags** (result-quality.ts): `checkLowRowCount()` now produces different diagnostic messages for INFORMATION_SCHEMA queries, filtered queries, and generic queries.
- **Self-review zero-row awareness** (self-review.ts): Added `zeroRows` flag to review snapshot and a CRITICAL instruction preventing the self-review from generating optimistic headlines for empty results.
- **DataTable empty state** (DataTable.tsx): Shows "No rows returned." in a styled row instead of blank tbody.
- **KpiCard empty guard** (KpiCard.tsx): Shows "--" instead of displaying undefined.

**Files**:
- `src/lib/composer.ts` -- zero-row headline guard, recovery chips, TABLE type force, `extractFullTableRef()` helper
- `src/lib/result-quality.ts` -- SQL-aware `checkLowRowCount()` messages
- `src/lib/self-review.ts` -- `zeroRows` snapshot flag, review prompt addition
- `src/components/DataTable.tsx` -- empty-state row
- `src/components/KpiCard.tsx` -- undefined value guard

**Derived rule**: For zero-row results, always use the diagnostic headline builder, never the LLM summary.

---

## 2026-07-10 (late): Chart-first visualization and descriptive headlines

**What changed**:
- **Data-shape chart inference** (composer.ts): Replaced `vizTypeToArtifactType()` passthrough with `inferVisualizationType()` that analyzes actual column types and row count to pick the best chart. The query handler hardcodes `suggestedVisualization: 'TABLE'`, and self-review (the only prior override) is often skipped for high-confidence results. Now the composer itself picks BAR_CHART, LINE_CHART, PIE_CHART, KPI_CARD, or SCATTER based on column classification (numeric vs date vs categorical).
- **Descriptive headlines** (composer.ts): `buildQueryHeadline()` now analyzes column structure to produce headlines like "Order count by status" or "Revenue over time" instead of the generic "5 rows from `malloy`". Falls back to the old pattern for ambiguous shapes.
- **No UI changes needed**: `ChartWithToggle` in ArtifactCard.tsx already supports the chart/table toggle pill -- it just never activated because the composer always said TABLE.

**Files**:
- `src/lib/composer.ts` -- replaced `vizTypeToArtifactType` with `inferVisualizationType`, improved `buildQueryHeadline`, added `humanizeColumnName`, `isDateColumn`, `isNumericValue` helpers

**Derived rule**: The composer must enforce the "chart type by data shape" invariant directly in code, not rely on LLM hints or optional self-review passes.

---



**What changed**:
- Ran full 25-test UX evaluation against deployed app
- **Baseline**: 2.8 avg score, 8/25 passing (32%)
- Fixed three critical issues:
  1. **Fuzzy table name resolution** (handle-schema.ts, bq-tools.ts): When a table isn't found, search the same dataset for similar names (e.g., "orders" -> "order_items"). Fixes 10 test failures.
  2. **Data-driven suggestion chips** (composer.ts): Query results now generate contextual chips (chart, drill-down, profile, schema) instead of generic "Suggest next steps" / "Generate insights" fallbacks.
  3. **Query system prompt update** (handle-query.ts): LLM now verifies table names via get_table_schema before writing SQL, uses corrected table names from fuzzy matching.
- **Post-fix**: 3.7 avg score, 17/25 passing (68%)
- Improved ux-eval.mjs: frame detachment recovery, JSON repair for truncated Gemini responses, page.reload instead of page.goto for conversation reset

**Files**:
- `src/lib/skills/handle-schema.ts` -- fuzzy matching in same-dataset fallback
- `src/lib/bq-tools.ts` -- fuzzy matching in get_table_schema tool
- `src/lib/skills/handle-query.ts` -- updated system prompt for table verification
- `src/lib/composer.ts` -- data-driven chip generation for query results
- `scripts/ux-eval.mjs` -- evaluation harness improvements

---


## 2026-07-10: UX Evaluation Script

**What changed**:
- Created `scripts/ux-eval.mjs` -- a 25-scenario test suite that evaluates the app from the user's perspective
- Sends real-world prompts to the deployed app via Puppeteer, takes screenshots, extracts DOM metadata, and sends both to Gemini for critical evaluation across 6 dimensions (task completion, headline quality, visual clarity, data insight, suggestion quality, overall intelligence)
- Scores 1-5 per dimension; minimum passing score is 4
- Covers all 12 skills: schema (F1-F5), query (Q1-Q6), data quality (DQ1-DQ3), monitoring (M1-M3), discovery (D1-D2), visualization (V1-V2), governance (G1), data loading (DL1), pipeline (P1), conversation (C1)
- Generates markdown report at `test-results/ux-eval-report.md` and raw JSON at `test-results/ux-eval-results.json`
- Updated `.agents/knowledge/test-cases.md` with UX evaluation reference

**Why**:
- Existing tests (snapshot-test.mjs, test-loop.mjs) verify internal mechanics (routing, API responses) but don't evaluate whether the output is genuinely good from the user's perspective
- The app works for basic tasks but more complex queries produce generic headlines, unhelpful suggestions, and visually uninformative results
- This evaluation pass identifies exactly what needs fixing to make the app feel smart, not just functional

---



**What changed**:
- Completely rewrote `src/components/SavedPage.tsx`. Export renamed from `SavedPage` to `SpacesPage`.
- Added Spaces (folders): users can create named spaces, drag items into them, navigate via breadcrumb.
- Card/list view toggle: two-button toggle in the header switches between grid cards and a table-like list view.
- Context menus: three-dot "..." button on each item/space shows Rename, Duplicate, Move to Space, Delete actions.
- Inline rename: clicking any item or space name turns it into an editable input.
- Drag and drop: HTML5 drag-and-drop for moving items into spaces (or out via breadcrumb drop target).
- Filter tabs: added "Apps" tab alongside existing All/Queries/Workflows/Pipelines.
- Uses `createSpace`, `getSpaces`, `renameSpace`, `deleteSpace`, `moveToSpace`, `duplicateArtifact` from `saved-work.ts`.

**Files changed**: `src/components/SavedPage.tsx` (full rewrite, ~920 lines)
**Knowledge updated**: component-map.md (SpacesPage entry, saved-work line count)

---

## 2026-07-10: Rewrite OverviewDashboard -- replace KPI cards with Recent Charts and Recently Saved

**What changed**:
- Removed the top-level KPI section (4 StatCards: Datasets, Tables, Storage, Jobs 24h) and all associated BigQuery fetch logic (`fetchSummary`, `ProjectSummary` interface, `bqQuery`/`bqGet` for summary).
- Added "Recent Charts" section: scans user's conversations for assistant envelopes with chart artifacts (`primaryArtifact.type` containing 'chart'). Shows up to 6 cards with headline, conversation title, and relative time. Clicking navigates to the conversation.
- Added "Recently Saved" section: fetches up to 6 saved artifacts via `getArtifacts`. Shows cards with type icon, name, description, and relative time. Clicking runs the item via `onPrompt`.
- Uses `useAuth()` for user context and `useConversation()` for conversation navigation.
- Section order: Title, Recent Charts, Recently Saved, Recent Activity (kept), Quick Actions (kept).

**Why**: KPI StatCards were unreliable due to BigQuery INFORMATION_SCHEMA permission/region issues. The new sections surface actionable content users have already created.

---

## 2026-07-10: Add FavoritesPage component

**What changed**:
- New file `src/components/FavoritesPage.tsx`: Dedicated page showing cards for favorited chats (from `getFavorites`) and pinned saved artifacts (from `getPinnedArtifacts`).
- Features: filter tabs (All/Chats/Queries/Workflows/Pipelines), card grid, unfavorite/unpin actions, Run button on artifact cards, loading skeleton, empty state.
- Already imported by `page.tsx` (line 18) -- no wiring changes needed.

**Why**: The app needed a consolidated view for starred/pinned items, previously scattered across the sidebar and SavedPage.

---

## 2026-07-10: Fix "Suggest next steps" error after table schema view

**What changed**:
- `composer.ts`: TABLE scope schemas now generate 3 next-action chips (Query, Profile, Check freshness) instead of returning an empty array. The generic fallback "Suggest next steps" button no longer appears for table schema results.
- `handle-governance.ts`: Fixed 7 INFORMATION_SCHEMA SQL references where INFORMATION_SCHEMA was incorrectly wrapped inside backtick-quoted identifiers. Changed from `` `project.dataset.INFORMATION_SCHEMA.VIEW` `` to `` `project.dataset`.INFORMATION_SCHEMA.VIEW ``.
- `handle-query.ts`: Added an INFORMATION_SCHEMA exception to the LLM system prompt so Gemini doesn't wrap INFORMATION_SCHEMA inside backtick-quoted identifiers.
- `ArtifactCard.tsx`: Made the fallback "Suggest next steps" chip context-aware -- it now references the actual table/dataset name instead of sending a vague "What can I do next with these results?".

**Why**: The combination of empty chips, a vague fallback message, and incorrect INFORMATION_SCHEMA backtick patterns caused the error `Not found: Dataset malloy-data:ecomm.INFORMATION_SCHEMA was not found in location US`.

---

## 2026-07-10: Move export action from suggestion chips to kebab overflow menu

**What changed**:
- Removed "Export results" and "Save this query" from `nextActions` in `composer.ts` (lines 222-238).
- Added a kebab (three-dot) overflow menu button to the ArtifactCard header in `ArtifactCard.tsx`, positioned after the pin button.
- The kebab menu contains a single "Export results" item that triggers the same `onChipClick` handoff as the old chip.
- The kebab only appears when the card has exportable data (SQL + rows) and is not a confirmation card.
- "Save this query" was dropped entirely since a dedicated save button already exists in the header.

**Why**: Export and save chips cluttered the suggestion area, which should focus on analytical follow-up actions. The kebab menu is a standard pattern for secondary actions.

---

## 2026-07-10: Move insights from auto-display to on-demand chip

**What changed**:
- Removed the purple "INSIGHT" section that appeared in every response card (ArtifactCard.tsx lines 140-176).
- Added a "Generate insights" suggestion chip in the nextActions area for query, schema, data-quality, and monitoring results.
- Clicking the chip sends "Generate insights about these results" as a follow-up message, which produces a new response card with insights.
- The `insight` field on `CompositionEnvelope` is preserved for the save modal default description, but no longer rendered inline.

**Why**: The purple insight box added visual noise to every response. Making insights on-demand gives users control over when they want analysis.

---

## 2026-07-10: Fix overview recent activity SQL syntax error

**What changed**: Backtick-quoted the `region-XX` identifier in the JOBS_BY_PROJECT query in `OverviewDashboard.tsx`. The hyphen was being parsed as a minus operator, causing "Expected end of input but got '-'" errors.

---

## 2026-07-10: Adaptive Query Pipeline (Tool-Calling Agent)

**What changed**:
- Replaced the rigid query pipeline in `handle-query.ts` with a Gemini tool-calling agent loop.
- Created `bq-tools.ts` with 4 BigQuery tools: `run_query`, `get_table_schema`, `list_tables`, `list_datasets`.
- Added `callGeminiWithTools()` to `gemini-client.ts` -- a generic function-calling loop with iteration cap.
- The LLM now decides what context it needs. Simple queries (e.g., "show first 10 rows") go directly to `run_query` without fetching schemas for 5 tables first.
- Removed dry run step entirely (per user directive).
- Removed `buildSchemaContext()` call from query handler (function still exists for data-management skill).
- SQL auto-retry is now handled naturally by the agent loop -- errors feed back to the LLM.
- Visualization selection delegated to composer post-processing.
- Plan cache fast path preserved (cache hits skip the agent loop).

**Why**: The old pipeline always made ~30 BigQuery API calls regardless of query complexity, causing multi-minute response times for trivial queries. The tool-calling approach reduces a simple preview to 1 LLM call + 1 BQ query.

**Follow-up fixes**:
- Sharpened the system prompt with explicit efficiency rules ("don't call list_tables if the user named a table", "STOP after run_query succeeds").
- Increased maxIterations from 6 to 10 -- analytical queries need 7+ iterations for schema exploration + SQL retry.
- Fixed composer headline to reject raw JSON from `resultSummary` -- the agent loop's textResponse can contain structured data dumps that should not be displayed as the headline.
- Created `.agents/skills/browser-testing/SKILL.md` documenting the Puppeteer-based testing approach.

**Files touched**:
- `src/lib/bq-tools.ts` (new)
- `src/lib/gemini-client.ts` (added `callGeminiWithTools`)
- `src/lib/skills/handle-query.ts` (rewritten)
- `src/lib/composer.ts` (headline guard)
- `.agents/skills/browser-testing/SKILL.md` (new)

---

## 2026-07-10: Auth Session Persistence + Server-Side Token Refresh

**What changed**:
- Switched OAuth access token storage from `sessionStorage` to `localStorage` in `gis-auth.ts`. Tokens now survive tab close, new tabs, and browser restarts.
- Added token timestamp tracking (`bqaif_token_ts` in localStorage) and `isTokenLikelyExpired()` helper (50-minute threshold) for proactive expiry detection.
- Added `access_type: 'offline'` to the consent provider so Google returns a refresh token on sign-in. Refresh token stored in localStorage (`bqaif_refresh_token`).
- Created `/api/auth/refresh` server-side endpoint that exchanges the refresh token for a new access token using the OAuth client secret. No popup or user interaction needed.
- `refreshAccessToken()` now tries server-side refresh first, falls back to popup-based refresh only when no refresh token is stored.
- Auto-refresh on page load uses `refreshAccessTokenSilently()` (server-side) before falling back to popup.
- Added `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars (server-only) in `.env.local` and `deploy.mjs`.
- Updated `deploy.mjs` PROD_ENV to use the correct OAuth client credentials.

**Why**: App was showing the sign-in page too frequently. Popup-based refresh blocked Antigravity automated testing. Server-side refresh enables indefinite automated test sessions.

**One-time action**: Existing users must sign out and sign back in once to capture the refresh token. After that, all token renewals are silent and automatic.

---

## 2026-07-10: Saved Artifacts System (Phase 1)

**What changed**:
- Added `SavedArtifact`, `SavedArtifactType`, `ParameterDef`, `ArtifactStep` types to `types.ts`.
- Added `extractedParameters` field to `CompositionEnvelope` and `QueryResult`.
- Rewrote `saved-work.ts`: new CRUD functions (`saveArtifact`, `getArtifacts`, `deleteArtifact`, `searchArtifacts`, `recordRun`, etc.) with backward-compatible deprecated wrappers for old `SavedItem` API.
- Added `parameters` array to `QueryResponseSchema` in `gemini-client.ts` so Gemini extracts reusable parameters alongside SQL generation.
- Updated `handle-query.ts` system prompt to instruct parameter extraction; threads `extractedParameters` through to `QueryResult`.
- Updated `composer.ts` `composeQuery` to include `extractedParameters` on the envelope.
- Created `handle-saved.ts` skill handler: matches "run my X" phrases, fuzzy-matches against saved artifacts, executes cached SQL directly (no Gemini calls).
- Registered `saved` skill in `skills/index.ts`.
- Created `SaveModal.tsx`: native `<dialog>` modal for naming/describing/tagging artifacts before saving.
- Created `SavedPage.tsx`: full-page library view with search, filter tabs (All/Queries/Workflows/Pipelines), sort (Recent/Name/Most Used/Type), card grid with SQL preview, metadata, pin toggle, delete confirmation.
- Updated `ArtifactCard.tsx`: added save button (bookmark icon) next to pin button.
- Updated `ChatThread.tsx` and `ResultsSidebar.tsx`: pass `onSave` prop through to ArtifactCard.
- Updated `useChatOrchestration.ts`: added `saveEnvelopeAsArtifact`, `handleSaveConfirm`, `saveChatAsWorkflow`, `runSavedArtifact` functions and `saveModalState`.
- Updated `page.tsx`: replaced `SavedWorkLibrary` with `SavedPage`, wired SaveModal, passes `onSave` to chat components.
- Updated `SideNav.tsx`: renamed "Saved Work" to "Saved", page key from `saved-work` to `saved`.

**Files added**: `handle-saved.ts`, `SavedPage.tsx`, `SaveModal.tsx`, `public/icons/save.svg`
**Files modified**: `types.ts`, `saved-work.ts`, `gemini-client.ts`, `handle-query.ts`, `composer.ts`, `skills/index.ts`, `ArtifactCard.tsx`, `ChatThread.tsx`, `ResultsSidebar.tsx`, `useChatOrchestration.ts`, `page.tsx`, `SideNav.tsx`

---

## 2026-07-09: Self-Registering Skill Manifest Refactoring

**What changed**:
- Added `SkillManifest` interface to `types.ts`: declares skill name, label, routing signals array, and handler function for each skill.
- Added `manifest` export to all 10 handler files in `src/lib/skills/`: each handler now co-locates its routing signals with its handler function.
- Standardized all handler signatures to 4 arguments: `(message, history, context, onStatus)` for uniform dispatch.
- Created `src/lib/skills/index.ts` barrel file: aggregates manifests into `SKILL_MANIFESTS`, `SKILL_MAP`, `SKILL_NAMES`, and `SKILL_LABELS`.
- Refactored `router.ts`: removed ~330 lines of hardcoded signal constant declarations. The scoring loop now iterates `SKILL_MANIFESTS` to build scores dynamically.
- Refactored `chat-orchestrator.ts`: replaced 10-case switch statement and hardcoded labels with `SKILL_MAP.get(skill)` lookup and `SKILL_LABELS`.
- Refactored `gemini-client.ts`: `IntentClassifierSchema` skill enum now derives from `SKILL_NAMES`. Uses lazy Proxy initialization to avoid circular import timing issues.
- All 19 routing snapshot tests pass -- zero behavior changes.

**Collision hotspots eliminated**: Previously adding a skill required editing 6 shared files. Now: create handler file + add one line to barrel.

**Files modified**: types.ts, router.ts, chat-orchestrator.ts, gemini-client.ts, handle-schema.ts, handle-query.ts, handle-data-management.ts, handle-data-quality.ts, handle-monitoring.ts, handle-discovery.ts, handle-data-loading.ts, handle-pipeline.ts, handle-task.ts, handle-governance.ts, invariants.md, component-map.md
**Files created**: src/lib/skills/index.ts

---

## 2026-07-09: Fix aggregation queries misrouted to multistep workflows

**What changed**:
- Added 27 analytical/aggregation keyword signals to `QUERY_SIGNALS` in `router.ts`: "how many" (weight 3), "total" (2), "sum of" (3), "average" (2), "count of" (3), "top" (2), "trend" (2), "over time" (2), time-period phrases like "per month"/"by year" (3), and others.
- Generalized the multistep collapse guard in `chat-orchestrator.ts` from a 2-step check (`steps.length === 2 && steps[0]=schema && steps[1]=query`) to an N-step pattern (`lastStep=query && allOtherSteps.every(schema)`).
- Added filtered aggregation examples and an "Aggregation Anti-Pattern" section to `intent-routing.md`.
- Added test case R13 for filtered aggregation routing.
- Added two new invariants for aggregation keyword routing and the generalized collapse guard.

**Why**: "show me how many total sales there was for the store BARMUDA DISTRIBUTION" was producing a 3-step multistep workflow instead of a single KPI card. Root cause was (1) no keyword signals for basic aggregation phrases, and (2) the LLM classifier incorrectly decomposing the query, with the existing guard only catching 2-step patterns.

---

## 2026-07-09: Conversation Continuity + Export Expansion (Phase 4B/4C)

**What changed**:
- Created `ConversationSummary.tsx`: collapsible panel at top of ChatThread for conversations with 6+ messages. Derives operations, tables touched, key results, and current context from the messages array. Each operation is clickable to scroll to that message.
- Enhanced `conversation-context.tsx`: added `OperationLogEntry[]` state, `addOperation`, `getOperationLog`, `clearOperationLog` methods. Operation log clears on new/load conversation.
- Added `OperationLogEntry` type to `types.ts`: tracks messageIndex, skill, operation, table, timestamp, and undoable flag.
- Updated `useChatOrchestration.ts`: added `logOperationsFromEnvelopes` function that classifies operations from composition envelopes and logs them to conversation context after each successful response.
- Wired ConversationSummary into ChatThread with `scrollContainerRef` for jump-to-message with highlight flash.
- Expanded `DataLoadingView.tsx` with four new features:
  - "Create View from Query": collapsible DDL preview with copy button (available when result has SQL)
  - "Looker Studio" link: generates URL to create new Looker Studio report with table as data source
  - "Copy as Table": copies small results (<50 rows) as markdown table to clipboard
  - `ExportFormatSelector` component: segmented button for CSV/JSON/Avro/Parquet selection
- Updated `public/skills/data-loading.md` with documentation for CREATE_VIEW, LOOKER_STUDIO, COPY_AS_TABLE sub-types and export format guidance.
- Fixed duplicate `PipelineResult` type definition that caused type errors.

**Files modified**: conversation-context.tsx, useChatOrchestration.ts, ChatThread.tsx, DataLoadingView.tsx, types.ts, public/skills/data-loading.md
**Files created**: ConversationSummary.tsx

---

## 2026-07-09: BigQuery ML read path + Saved Work system


**What changed**:
- Added QUERY_SIGNALS array to router.ts with 17 ML-specific weighted phrases (ML.PREDICT, ML.EVALUATE, ML.EXPLAIN_PREDICT, AI.GENERATE_TEXT, AI.FORECAST, AI.DETECT_ANOMALIES, etc.)
- Added 'query' key to the scored classification engine so ML queries route to the query skill with proper confidence
- Rewrote the ML section in skills/query.md: replaced mixed training+inference section with a structured reference table of read-path-only ML functions, added CRITICAL guard against CREATE MODEL, added ML.EVALUATE visualization guidance, added INFORMATION_SCHEMA.MODELS query for listing models
- Copied updated query.md to public/skills/query.md
- Created src/lib/saved-work.ts: unified Firestore persistence layer for saved items (queries, views, checks, setups, pipelines) with saveItem, getItems, getItem, updateItem, deleteItem, getPinnedItems, searchItems
- Created src/components/SavedWorkLibrary.tsx: full library view with tab filters (All/Queries/Views/Checks/Setups/Pipelines), search bar, sort options, item cards with type badge, SQL preview, pin/unpin, delete with confirmation, and load action
- Wired SavedWorkLibrary into page.tsx as activePage === 'saved-work' route
- Added 'Saved Work' nav item in SideNav with 'bookmark' icon (changed Prompts icon to 'bookmarks' to differentiate)
- Added 'Save this query' chip to query results in composer.ts (via saveAction context flag)
- Added 'Save this check' chip to data quality results in composer.ts
- Added save action interception in useChatOrchestration.ts handleChipClick: detects saveAction in chip context, calls saved-work.ts directly, shows confirmation message
- Fixed pre-existing PipelineView.tsx type errors: Badge children->label prop, confirmation type assertion

**Files modified**: router.ts, skills/query.md, public/skills/query.md, composer.ts, useChatOrchestration.ts, page.tsx, SideNav.tsx, PipelineView.tsx
**Files created**: saved-work.ts, SavedWorkLibrary.tsx

---

## 2026-07-09: Add data governance skill

**What changed**:
- Added new `governance` skill with four sub-handlers: ACCESS_AUDIT, TABLE_SECURITY, SENSITIVE_DATA_SCAN, DATA_CLASSIFICATION
- All operations are read-only -- queries INFORMATION_SCHEMA views and metadata only
- ACCESS_AUDIT: queries OBJECT_PRIVILEGES for entity/role access information
- TABLE_SECURITY: checks ROW_ACCESS_POLICIES, COLUMN_FIELD_PATHS with policy tags
- SENSITIVE_DATA_SCAN: heuristic PII detection via regex sampling (emails, phones, SSNs, IPs, credit cards) with DLP recommendation
- DATA_CLASSIFICATION: documentation coverage from COLUMNS/TABLE_OPTIONS
- Added GovernanceView component with stat cards, badge components, progress bars, and tabular displays
- Added governance routing signals (25 phrases) to keyword router
- Added governance to LLM intent classifier schema
- Created public/skills/governance.md runtime prompt
- Updated intent-routing.md with governance row

**Files created**:
- `src/lib/skills/handle-governance.ts` (governance handler)
- `src/components/GovernanceView.tsx` (governance view component)
- `public/skills/governance.md` (skill prompt)

**Files modified**:
- `src/lib/types.ts` (GovernanceResult interface, GOVERNANCE_VIEW artifact type, governance in SkillName)
- `src/lib/router.ts` (GOVERNANCE_SIGNALS, added to scoring)
- `src/lib/composer.ts` (composeGovernance function, governance case)
- `src/lib/chat-orchestrator.ts` (import, dispatch case, skill label)
- `src/lib/gemini-client.ts` (governance in IntentClassifierSchema enum)
- `src/components/ArtifactCard.tsx` (GovernanceView import and case)
- `public/skills/intent-routing.md` (governance row)
- `.agents/knowledge/test-cases.md` (G1-G10 test cases)

---

## 2026-07-09: Add Pipeline Management skill

**What changed**:
- New skill: `pipeline` for managing scheduled queries and data pipelines via BigQuery Data Transfer API
- 6 sub-types: LIST_SCHEDULES, SCHEDULE_DETAILS, CREATE_PIPELINE, UPDATE_SCHEDULE, DELETE_SCHEDULE, RUN_HISTORY
- New handler: `src/lib/skills/handle-pipeline.ts` (~390 lines)
- New component: `src/components/PipelineView.tsx` (~350 lines) with schedule list table, detail cards, run history, and pipeline creation confirmation
- New skill doc: `public/skills/pipeline.md`
- Router: added PIPELINE_SIGNALS with high-weight phrases for schedule/pipeline management, moved `etl` and `set up a pipeline` from TASK_SIGNALS to PIPELINE_SIGNALS
- Composer: added `composePipeline()` function with context-specific headlines and next-action chips
- Orchestrator: added `handlePipeline` import and dispatch case
- ArtifactCard: added PIPELINE_VIEW routing to PipelineView component
- ResultsSidebar: added `schedule` icon and `Pipelines` label for PIPELINE_VIEW artifacts
- IntentClassifierSchema: added `pipeline` to both skill enum arrays
- intent-routing.md: added pipeline skill row and disambiguation entries
- types.ts: added `pipeline` to SkillName, `PIPELINE_VIEW` to ArtifactType, PipelineResult interface
- test-cases.md: added P1-P5 pipeline routing test cases

**Files created**:
- `src/lib/skills/handle-pipeline.ts`
- `src/components/PipelineView.tsx`
- `public/skills/pipeline.md`

**Files modified**:
- `src/lib/router.ts` (PIPELINE_SIGNALS, scoring)
- `src/lib/types.ts` (SkillName, ArtifactType, PipelineResult)
- `src/lib/composer.ts` (composePipeline, import, switch case)
- `src/lib/chat-orchestrator.ts` (import, dispatch, skill label)
- `src/lib/gemini-client.ts` (IntentClassifierSchema enum)
- `src/components/ArtifactCard.tsx` (PIPELINE_VIEW case)
- `src/components/chat/ResultsSidebar.tsx` (icon, label)
- `public/skills/intent-routing.md` (pipeline row, disambiguation)
- `.agents/knowledge/test-cases.md` (P1-P5)
- `.agents/knowledge/component-map.md` (handler, component, skill doc entries)
- `.agents/knowledge/changelog.md` (this entry)

---

## 2026-07-09: Restyle artifact link chips to neutral colors

**What changed**:
- Changed `.chat-sidebar-artifact-link` from green tint (#f0fdf4 bg, #166534 text, #22c55e icon) to neutral white/gray (#ffffff bg, #d1d5db border, #4b5563 text, #6b7280 icon)
- Updated dark theme overrides to matching neutral dark grays
- Updated responsive overrides to match new color scheme

**Files modified**:
- `src/app/globals.css` (artifact link styles at ~lines 2135-2161, responsive ~2645-2658, dark theme ~2821-2823)

---

## 2026-07-09: Redesign thinking section in sidebar

**What changed**:
- Replaced chevron_right icon with a blue sparkle SVG icon in the thinking toggle header
- Toggle text now switches between "Show thinking" (collapsed) and "Hide thinking" (expanded) via CSS `::after` pseudo-element
- Steps now display green checkmark SVGs instead of numbered list format
- Removed "Steps" section label and "Task:" prefix from envelope groups
- Added light background card (surface-2 with border) around thinking body
- Envelope details indented under their parent step with new `thinking-step-details` class

**Files modified**:
- `src/components/chat/ResultsSidebar.tsx` (lines 368-463)
- `src/app/globals.css` (thinking section styles, ~lines 1937-2100)

---

## 2026-07-09: Add OverviewDashboard landing page

**What changed**:
- Created `src/components/OverviewDashboard.tsx` -- project overview dashboard with 3 sections:
  - Project Summary: 4 StatCards showing dataset count, table count, storage used, and jobs in last 24h. Data from BigQuery REST API (datasets.list + INFORMATION_SCHEMA queries)
  - Recent Activity: compact table of last 10 jobs with status icon, query snippet, type badge, duration, bytes processed, relative time. Clickable rows inject monitoring prompts
  - Quick Actions: 5 action cards (Ask a question, Browse datasets, Check data quality, View costs, Export data) that navigate or inject prompts
- Wired into `page.tsx` as `activePage === 'overview'` route. Hidden behind both unified and split layout containers
- Added `accessToken` to the useAuth destructure in page.tsx
- Added skeleton pulse keyframe animation to globals.css
- Fixed pre-existing `JSX.Element` type error in ProvenancePanel.tsx (namespace not available in newer TS -- replaced with `React.JSX.Element`)

**Files created**:
- `src/components/OverviewDashboard.tsx`

**Files modified**:
- `src/app/page.tsx` -- import, routing, display:none conditions, auth destructure
- `src/app/globals.css` -- added `@keyframes pulse`
- `src/components/ProvenancePanel.tsx` -- fixed JSX namespace type error

---

## 2026-07-09: Add ProvenancePanel and HowItWorksPanel trust features

**What changed**:
- Created `ProvenancePanel.tsx` -- collapsible panel attached to each ArtifactCard showing SQL (syntax-highlighted), cost breakdown with tier badge, job ID, referenced tables, skill used, quality flags, and freshness. Includes copy-SQL button and BigQuery Console link.
- Created `HowItWorksPanel.tsx` -- static informational page with 5 collapsible sections: data security, query execution, data changes, AI capabilities (can/cannot table), and cost controls (tier table with dry-run explanation).
- Wired ProvenancePanel into ArtifactCard bottom. Defaults to collapsed, but expands for monitoring/discovery results.
- Wired HowItWorksPanel as a nav page via SideNav bottom utility ("How it works" with info icon) and page.tsx routing.
- Fixed SideNav settings link to properly call setActivePage via onClick handler.

**Files created**:
- `src/components/ProvenancePanel.tsx`
- `src/components/HowItWorksPanel.tsx`

**Files modified**:
- `src/components/ArtifactCard.tsx` -- added ProvenancePanel import and render
- `src/components/shell/SideNav.tsx` -- added "How it works" nav item, fixed settings onClick
- `src/app/page.tsx` -- added HowItWorksPanel import, routing, and display-none conditions

---

## 2026-07-09: Decompose page.tsx monolith into focused components

**What changed**:
- Extracted the 1,832-line `src/app/page.tsx` into 4 focused modules, reducing it to 399 lines.
- Created `src/hooks/useChatOrchestration.ts` (682 lines) -- custom hook encapsulating all chat state, message handlers (send/confirm/cancel/chip click/edit/rerun), context management, auth retry, and conversation persistence.
- Created `src/components/chat/ChatThread.tsx` (449 lines) -- message rendering loop with auto-scroll, edit mode, regenerate buttons, error cards, and CrystalBallThinking indicator.
- Created `src/components/chat/ChatInput.tsx` (191 lines) -- reusable input component with three variants (hero, floating, docked) covering both unified and split layouts.
- Created `src/components/chat/ResultsSidebar.tsx` (564 lines) -- split-layout chat sidebar with thinking details, artifact links, and results panel with drag-to-resize.
- Pure refactoring: zero behavior changes.

**Files created**:
- `src/hooks/useChatOrchestration.ts`
- `src/components/chat/ChatThread.tsx`
- `src/components/chat/ChatInput.tsx`
- `src/components/chat/ResultsSidebar.tsx`

**Files modified**:
- `src/app/page.tsx` -- reduced from 1,832 to 399 lines

---

## 2026-07-09: Expand query, schema, data-management skill prompts

**What changed**:
- Expanded all three runtime skill prompt files (`skills/*.md` and `public/skills/*.md`) to cover the full capability set from the design specs in `docs from claude/`.
- `query.md`: Added follow-up context handling (using prior SQL as base), multi-step query chaining, TABLESAMPLE guidance at Tier 2+, enhanced visualization mapping (heatmap, funnel, geographic, area chart, column chart), DML detection with Data Management handoff, EXTERNAL_QUERY for federated sources, window functions guidance, GEOGRAPHY/STRUCT/ARRAY column handling, headline anti-patterns, and expanded next-action chips.
- `schema.md`: Added table constraints display (PK/FK), table/dataset labels, partition/clustering actionable guidance, row count and size estimates, routine/UDF listing via INFORMATION_SCHEMA.ROUTINES, schema cache invalidation signals, "show me sample rows" handoff to Query, ER diagram generation from foreign keys, and scope-specific response shapes (PROJECT/DATASET/TABLE/ROUTINE).
- `data-management.md`: Added full DDL coverage (CREATE TABLE/VIEW/MATERIALIZED VIEW, ALTER TABLE, DROP TABLE/VIEW), dedup pattern with ROW_NUMBER + snapshot-based execution, column operations (ADD/DROP/RENAME/change type), row operations (UPDATE/DELETE with WHERE), MERGE/upsert, table copy/clone, snapshot operations, re-partitioning via CTAS, two-phase execution flow (dry-run, confirmation card, execute), confirmation card format spec, and enriched schema cache invalidation rules.

**Files modified**:
- `skills/query.md` -- expanded from 84 to ~210 lines
- `skills/schema.md` -- expanded from 67 to ~140 lines
- `skills/data-management.md` -- expanded from 106 to ~260 lines
- `public/skills/query.md` -- copy of skills/query.md
- `public/skills/schema.md` -- copy of skills/schema.md
- `public/skills/data-management.md` -- copy of skills/data-management.md

---

## 2026-07-09: Unify task framework LLM integration, add action shortcuts

**What changed**:
- Replaced `@ai-sdk/google` + `generateObject` in `resolver.ts` with the shared `callGeminiWithSchema` from `gemini-client.ts`. All 5 Zod schemas converted to OpenAPI-style JSON schemas matching the format `callGemini` already uses for every other LLM call in the app.
- Added `callGeminiWithSchema<T>()` to `gemini-client.ts` -- a thin typed wrapper around `callGemini` for structured output.
- Built out the action shortcuts system in `src/lib/tasks/actions/index.ts` with 7 pre-coded shortcuts: create-dataset, create-table-from-query, export-to-gcs, schedule-query, copy-table, delete-table, grant-access. These build a ResolvedPlan directly without any LLM call.
- Updated `resolveTask()` in resolver.ts to check action shortcuts first (before learned plans and the 2-phase LLM resolution).
- The `@ai-sdk/google` and `ai` packages are no longer imported anywhere in the codebase (they remain in package.json as deps for now).

**Files modified**:
- `src/lib/gemini-client.ts` -- added `callGeminiWithSchema<T>()` wrapper
- `src/lib/tasks/resolver.ts` -- full rewrite to use `callGeminiWithSchema`, added shortcut check step
- `src/lib/tasks/actions/index.ts` -- full rewrite with 7 action shortcuts and `matchShortcut()` function

---

## 2026-07-09: Auth retry preserves user request

**What changed**:
- When a BigQuery API call fails due to expired auth, the "Sign in and continue" button now signs the user in and then automatically re-sends their original request.
- Previously, the button only called `signIn`, losing the user's request and requiring them to re-type it.
- Error text updated from "Please sign in again" to "Sign in to continue where you left off."
- Button label changed from "Sign in again" to "Sign in and continue."

**Files modified**:
- `src/app/page.tsx` -- auth error retry function, error text, button label, retryFn type

---

## 2026-07-07 (session 4): Consolidate format utils and shared UI primitives

**What changed**:
- Created `src/lib/format.ts` -- single source for `formatBytes`, `truncateLabel`, `truncateEmail`, `relativeTime`
- Created `src/components/ui/StatCard.tsx` -- reusable stat card replacing 5 local copies (AccessPatternView, StorageBreakdownView, CostAnalysisView KpiCard, MonitoringView Stat, SchemaView Stat)
- Created `src/components/ui/Badge.tsx` -- reusable badge/pill component with variant and size support
- Created `src/components/ui/Tooltip.tsx` -- reusable tooltip with fixed positioning and keyboard accessibility
- Updated 12 consumer files to import from shared modules instead of defining local copies

**Files created**:
- `src/lib/format.ts` -- formatBytes, truncateLabel, truncateEmail, relativeTime
- `src/components/ui/StatCard.tsx` -- StatCard component
- `src/components/ui/Badge.tsx` -- Badge component
- `src/components/ui/Tooltip.tsx` -- Tooltip component

**Files modified** (removed local utility functions/components, added imports):
- `src/components/AccessPatternView.tsx` -- removed formatBytes, truncate, StatCard
- `src/components/CostAnalysisView.tsx` -- removed formatBytes, truncateEmail, KpiCard
- `src/components/StorageBreakdownView.tsx` -- removed formatBytes, truncateLabel, StatCard
- `src/components/MonitoringView.tsx` -- removed formatBytes, relativeTime, Stat
- `src/components/SchemaView.tsx` -- removed formatBytes, Stat
- `src/components/ArtifactCard.tsx` -- removed formatBytes
- `src/components/ConfirmationCard.tsx` -- removed formatBytes
- `src/components/CostConfirmCard.tsx` -- removed formatBytes
- `src/components/ErDiagramView.tsx` -- removed truncate
- `src/components/LineageDagView.tsx` -- removed truncateLabel
- `src/lib/composer.ts` -- removed formatBytes
- `src/app/page.tsx` -- removed formatBytesCompact, replaced with formatBytes

---

## 2026-07-07 (session 3): Material Design 3 dark theme + design tokens

**What changed**:
- Added Material Design 3 dark theme to `globals.css` (appended ~500 lines, no existing styles modified)
- Dark theme activates via `@media (prefers-color-scheme: dark)` or `.dark-theme` class on `<html>`/`<body>`
- Overrides all `:root` custom properties (--bg, --surface, --text, --accent, --positive, --attention, --issue) and all `--gc-*` shell properties
- Hardcoded colors in 30+ component classes also overridden for dark mode (sql blocks, chips, nav items, avatar menus, sign-out page, prompt container, artifact links, context chips, layout controls)
- Added spacing scale tokens (`--space-1` through `--space-12`)
- Added typography scale tokens (`--text-xs` through `--text-2xl`, `--line-height-*`)
- Added transition presets (`--transition-fast`, `--transition-normal`, `--transition-slow`)

**Files modified**:
- `src/app/globals.css` -- appended design tokens and dark theme blocks (lines 2264+)

**Design decisions**:
- No UI toggle added; CSS supports both automatic (OS preference) and manual (`.dark-theme` class) activation
- Dark surface palette uses deep navy-blacks (#121218, #1e1e2e, #252540) for Material 3 feel, not pure black
- Accent blue shifted from #1a73e8 to #8ab4f8 for WCAG contrast on dark backgrounds
- Semantic colors (positive/attention/issue) use Google-standard dark-mode tones (#81c995, #fdd663, #f28b82)
- Shadows reduced on dark backgrounds per Material 3 guidance

## 2026-07-07 (session 2): Orchestrator decomposition -- monolith to modules

**What changed**:
- Decomposed the 3,835-line `chat-orchestrator.ts` monolith into 12 focused modules
- The orchestrator is now a 307-line thin dispatch layer
- All handler logic moved to `src/lib/skills/handle-*.ts` (8 handler files)
- Infrastructure extracted to `gemini-client.ts` (316 lines), `orchestrator-utils.ts` (182 lines), `self-review.ts` (192 lines)

**Files created**:
- `src/lib/gemini-client.ts` -- Gemini API client, response schemas, loadSkillDoc
- `src/lib/orchestrator-utils.ts` -- dataset resolution, BQ console URLs, schema context builder
- `src/lib/self-review.ts` -- LLM review pass (buildReviewSnapshot, selfReviewEnvelope)
- `src/lib/skills/handle-schema.ts` -- Schema handler (420 lines)
- `src/lib/skills/handle-query.ts` -- Query handler (259 lines)
- `src/lib/skills/handle-data-management.ts` -- Data management handler (275 lines)
- `src/lib/skills/handle-data-quality.ts` -- Data quality handler (489 lines)
- `src/lib/skills/handle-monitoring.ts` -- Monitoring handler (770 lines)
- `src/lib/skills/handle-discovery.ts` -- Discovery handler (386 lines)
- `src/lib/skills/handle-data-loading.ts` -- Data loading handler (232 lines)
- `src/lib/skills/handle-task.ts` -- Task handler (105 lines)

**Files modified**:
- `src/lib/chat-orchestrator.ts` -- rewritten from 3,835 lines to 307 lines (dispatch only)

**Key decisions**:
- Handlers are stateless functions, not classes. They import infrastructure from shared modules.
- Circular dependency between data-management and query is broken via lazy `await import('./handle-query')`.
- Inline type imports replaced with static top-level imports.
- Dynamic `await import('./bigquery-client')` calls replaced with static imports.
- No behavior changes -- pure refactoring.

---

## 2026-07-07: Add runtime skill prompts for data-quality, discovery, monitoring, data-loading

**What changed**:
- Created 4 new skill prompt files in `skills/` and copied to `public/skills/`
- Each condensed from full spec docs in `docs from claude/` into the concise, directive format matching existing query/schema/data-management skills
- data-quality.md: 8 check types, read-only constraint, batch column queries, TABLESAMPLE guidance, severity rules (INFO/WARNING/ISSUE), findings array shape
- discovery.md: 3 sub-types (SEARCH, COMPARISON, LINEAGE), INFORMATION_SCHEMA queries, permission fallbacks, Knowledge Catalog and Data Lineage API
- monitoring.md: 9 sub-types, 3-way alert classification (project-wide vs job-specific vs data-condition), data sources table, default 24h time range
- data-loading.md: 5 operation types, Sheets 10M cell limit, Data Transfer API create vs update, Tier 0/1 alerting, schema cache invalidation

**Files created**:
- `skills/data-quality.md`, `skills/discovery.md`, `skills/monitoring.md`, `skills/data-loading.md`

**Files overwritten** (in public/skills/):
- `public/skills/data-quality.md`, `public/skills/discovery.md`, `public/skills/monitoring.md`, `public/skills/data-loading.md`

---

## 2026-07-07: Fix numeric type coercion and add currency-aware formatting

**Problem**: KPI cards displayed raw scientific notation (e.g., `5.0938588796004164E8` instead of `$509,385,888`) for monetary aggregate queries like "what are my total sales".

**Root cause**: Two issues: (1) BigQuery REST API returns all cell values as strings. `parseQueryResponse` passed them through as-is, so `typeof value === 'number'` checks in UI components always failed. (2) No currency-aware formatting existed anywhere -- even with proper numbers, `toLocaleString()` produces `509,385,888` without a `$` prefix.

**Fix**: (1) Added `coerceValue()` in `bigquery-client.ts` that converts cell values to native JS types based on BigQuery schema field types (INTEGER/FLOAT/NUMERIC -> Number, BOOLEAN -> boolean). (2) Created `src/lib/format-value.ts` with `formatDisplayValue()` (full formatting with `$` for currency columns), `formatCompactValue()` (compact like `$509.4M`), and `isCurrencyColumn()` (heuristic pattern matching on column names). (3) Updated KpiCard, DataTable, chart-utils, custom-charts, and recharts-charts to use these formatters.

**Files changed**: `src/lib/bigquery-client.ts`, `src/lib/format-value.ts` (new), `src/components/KpiCard.tsx`, `src/components/DataTable.tsx`, `src/components/charts/chart-utils.ts`, `src/components/charts/custom-charts.tsx`, `src/components/charts/recharts-charts.tsx`

---

## 2026-07-07: Fix string filtering to use fuzzy matching instead of exact match

**Problem**: Asking "total sales for HY-VEE FOOD STORE" returned zero results because the LLM generated `WHERE store_name = 'HY-VEE FOOD STORE'` (exact match). Actual values contain location suffixes like "HY-VEE FOOD STORE / IOWA FALLS".

**Root cause**: (1) The query skill prompt had no guidance about using LIKE/partial matching for entity name filters. (2) The schema context sent to the LLM contained only column names and types, not sample values, so the LLM had no way to know the actual data format.

**Fix**: (1) Added a "String filtering" section to `public/skills/query.md` instructing the LLM to default to `UPPER(column) LIKE UPPER('%value%')` for entity name filters. (2) Enhanced `buildSchemaContext()` to fetch 3 sample distinct values for up to 3 string columns of the target/priority table, so the LLM can see actual data patterns.

**Files changed**: `public/skills/query.md`, `src/lib/chat-orchestrator.ts`

---

## 2026-07-07: Fix cost confirm card not dismissing on button click

**Problem**: The `COST_CONFIRM_CARD` (large query confirmation) stayed visible after clicking "Run anyway" or "Cancel".

**Fix**: `handleConfirm` in `page.tsx` now removes the confirmed envelope from messages before appending the new response, matching the existing `handleCancel` logic.

**Files changed**: `src/app/page.tsx`

---

## 2026-07-01: Enforce Google Sans as sole non-code font

**Problem**: Table data cells (sample rows, query results) used monospace (`var(--font-mono)`) for all content. Various CSS declarations used Inter or Roboto as fallbacks. User directive: only Google Sans for all UI text; monospace only for actual code.

**What changed**:
- SchemaView SampleTab: removed mono font from th/td elements; bumped cell font-size from 11 to 12
- DataTable: removed conditional mono font from numeric cells
- globals.css: body fallback simplified; all Roboto and Inter fallbacks removed
- page.tsx, CrystalBallOracle.tsx, EmptyCanvasAnimation.tsx: removed Inter from inline styles

**Files modified**: SchemaView.tsx, DataTable.tsx, globals.css, page.tsx, CrystalBallOracle.tsx, EmptyCanvasAnimation.tsx

---

## 2026-07-01: Flatten dataset/table list rows to single-line layout

**Problem**: List rows for datasets and tables used a two-line layout (name on top, details below). User wanted a more compact single-row format with name and metadata inline.

**What changed**:
- PROJECT scope (datasets): name and table count now on same row, with TypePill badge
- DATASET scope (tables): name and metadata (row count, size, date) on same row separated by middle dots
- DiscoveryView SearchResultRow: same treatment -- ref and matched-on details on one line
- Gap between rows reduced from 5px to 3px for tighter list appearance

**Files modified**:
- `src/components/SchemaView.tsx` -- flattened PROJECT and DATASET list row layouts
- `src/components/DiscoveryView.tsx` -- flattened search result row layout

---

## 2026-07-01: History toggle in top bar

**Problem**: Users wanted a way to hide previous conversation output so the latest result sits at the top of the viewport, rather than scrolling past old exchanges.

**What changed**:
- Added `historyVisible` / `setHistoryVisible` to `layout-context.tsx`, persisted to localStorage
- Added a `history` icon button to the right side of `TopBar.tsx` (before the layout switcher). When history is off, the icon gets a diagonal strikethrough overlay and reduced opacity
- In `page.tsx`, computed `historyHiddenBefore` index: when history is off, everything before the last user message is hidden via `display: none`. Uses index-based hiding (not array slicing) so `editingIdx`, `submitEdit`, `thinkingSteps` etc. keep working
- `allEnvelopes` in split layout also filters by the same threshold

**Files modified**:
- `src/lib/layout-context.tsx` -- added historyVisible state + localStorage persistence
- `src/components/shell/TopBar.tsx` -- added toggle button
- `src/app/page.tsx` -- added historyHiddenBefore, display:none on hidden messages, filtered allEnvelopes
- `src/app/globals.css` -- added `.gc-history-toggle` / `.gc-history-toggle--off` styles

---

## 2026-07-01: Auto-refresh expired OAuth token

**Problem**: The Google OAuth access token expires after ~1 hour. Users see "Session Expired" mid-session and have to manually re-sign-in, losing their in-progress query.

**What changed**:
- Added `refreshAccessToken()` to `auth-context.tsx` -- uses a Google provider without `prompt: 'consent'` so the popup auto-completes almost instantly when consent was already granted
- Removed the hard `window.location.href = '/'` redirect from `handleAuthError()` in `bigquery-client.ts` -- now just clears the stale token
- Added `withAuthRetry()` wrapper in `page.tsx` that wraps all 5 orchestrator call sites. On auth error: refreshes token via quick popup, retries the call once
- If refresh fails, falls through to existing error banner with "Sign in again" button

**Files modified**:
- `src/lib/auth-context.tsx` -- added `refreshProvider`, `refreshAccessToken()`, changed `signIn` return type to `Promise<boolean>`
- `src/lib/bigquery-client.ts` -- `handleAuthError()` calls `setAccessToken(null)` instead of redirecting
- `src/app/page.tsx` -- added `withAuthRetry`, `looksLikeAuthError`, wrapped all orchestrator calls

---

## 2026-07-01: Give LLM classifier full conversational state

**Problem**: Follow-up prompts were treated as fresh requests. Asking to "filter the table" while viewing a table schema created a redundant 2-step workflow (re-fetch schema + query), causing double cost confirmations.

**What changed**:
- Added `buildConversationStateSummary()` in `chat-orchestrator.ts` -- a skill-agnostic function that describes what the user is currently viewing (schema, query results, quality report, etc.) and injects it into the LLM classifier prompt as `CONVERSATION STATE`
- Added a structural guard: if the LLM decomposes a request into schema+query multistep, collapse it to a single query step (since `handleQuery()` loads schema internally via `buildSchemaContext()`)
- Expanded the keyword router's filter regex to catch more natural phrasings ("filter it down", "filter to only", etc.)
- Added Design Philosophy section to `invariants.md` codifying the principle that this app is a conversational data tool, not a collection of pre-canned experiences

**Files modified**:
- `src/lib/chat-orchestrator.ts` -- `buildConversationStateSummary()`, classifier prompt, multistep guard
- `src/lib/router.ts` -- expanded `hasFilterPhrase` regex
- `.agents/knowledge/invariants.md` -- Design Philosophy section, schema+query invariant
- `.agents/knowledge/test-cases.md` -- R9, R10 test cases
- `.agents/knowledge/ops-ledger.md` -- fix entry

---

## 2026-07-01: Fix LLM hallucinating wrong table in SQL generation

**What changed**:
- `buildSchemaContext()` now accepts a `priorityTable` parameter that ensures the user's target table is always included in the first 5 schemas sent to the LLM (even if the dataset has many tables)
- `handleQuery()` now extracts the target table from the user's message (by word-boundary matching against the dataset's actual table names) or from `context.lastTable`, then: (a) passes it to `buildSchemaContext` and (b) adds a CRITICAL instruction to the LLM system prompt naming the exact table to query
- Same fix applied to `handleDataManagement()`

**Files modified**:
- `src/lib/chat-orchestrator.ts` -- `buildSchemaContext()` priority table logic, `handleQuery()` target table extraction and LLM prompt, `handleDataManagement()` same pattern

**Root cause**: When a user asked to "filter the liquor_backup table," the LLM received schemas for only the first 5 tables alphabetically and no explicit instruction about which table to use. With the target table missing from the context, the LLM hallucinated a table from its training data (faa.airports).

---

## 2026-07-01: Core task framework

**What changed**:
- Created `src/lib/tasks/` with 5 files: types.ts, executor.ts, learned-plans.ts, resolver.ts, actions/index.ts
- Installed `@ai-sdk/google`, `ai`, and `zod` (v4) as dependencies
- The resolver uses a two-phase Gemini approach via `generateObject` with Zod v4 schemas
- Learned plans are stored in a top-level `learnedPlans` Firestore collection, shared across users (scoped by project)
- The executor validates API call hosts against a googleapis.com allowlist
- Fixed pre-existing type error in `TaskWorkflowView.tsx` where `getAccessToken()` null return was not guarded
- Added `onStatus` callback parameter to `resolveTask()` to match orchestrator call site

**Files created**:
- `src/lib/tasks/types.ts` -- ResolvedPlan, ResolvedStep, ApiCallSpec, DynamicInput, TaskStepResult, TaskArtifact, LearnedPlan, TaskResult
- `src/lib/tasks/executor.ts` -- executeApiCall with placeholder substitution and host validation
- `src/lib/tasks/learned-plans.ts` -- Firestore CRUD with in-memory cache and keyword extraction
- `src/lib/tasks/resolver.ts` -- resolveTask, findMatchingLearnedPlan, onTaskSuccess, onTaskFailure, diagnoseError
- `src/lib/tasks/actions/index.ts` -- setupTaskActions no-op placeholder

**Files modified**:
- `src/components/TaskWorkflowView.tsx` -- added null guard on getAccessToken() result
- `package.json` -- added @ai-sdk/google, ai, zod dependencies

**Tricky parts**:
- Zod v4 requires `z.record(keySchema, valueSchema)` -- two args, not one. The Zod v3 `z.record(z.string())` pattern does not compile.
- The `@ai-sdk/google` default provider expects `GOOGLE_GENERATIVE_AI_API_KEY` env var. This project uses `NEXT_PUBLIC_GEMINI_API_KEY`, so the resolver uses `createGoogle({ apiKey })` explicitly.
- The orchestrator was already calling `resolveTask` with 4 args (including onStatus). The resolver signature had to match.

---

## 2026-07-01: Orbiting stars and particles on signed-out page

**What changed**:
- Added three concentric orbit rings around the crystal ball on the signed-out page
- Ring 1 (240px, 18s) has 3 twinkling 4-point stars
- Ring 2 (360px, 28s, reverse) has 1 star and 3 glowing dot particles
- Ring 3 (520px, 40s) has 2 stars and 3 particles
- Stars use clip-path for a 4-point sparkle shape, particles are soft glowing circles
- Each element twinkles/pulses at staggered delays for a layered feel

**Files modified**:
- `src/components/shell/SignedOutPage.tsx` -- wrapped icon-ring in orbit-container, added orbit ring divs with star/particle children
- `src/app/globals.css` -- added `.so-orbit-container`, `.so-orbit-*`, `.so-star-*`, `.so-particle-*` styles and `so-spin`, `so-twinkle`, `so-pulse` keyframes

---

## 2026-07-01: Project selection CTA with Firestore-backed favorites

**What changed**:
- Removed the small info-field with icon that said "Select a GCP project from the sidebar to get started"
- Replaced with a larger call-to-action area that displays two sections: Favorites (starred projects from TopBar) and Recent Projects
- Both sections render clickable buttons that call `setActiveProject()` directly
- Migrated favorite projects from localStorage-only to Firestore-backed persistence (`users/{uid}.favoriteProjects`)
- localStorage still used as a synchronous cache for instant UI on mount; Firestore is the authoritative source
- TopBar `toggleFavorite` now writes to both localStorage and Firestore
- Added `getFavoriteProjects()` and `saveFavoriteProjects()` to firestore-service
- Recent projects still tracked in localStorage (`hdn_recent_projects`), updated on project switch

**Files modified**:
- `src/lib/firestore-service.ts` -- added `getFavoriteProjects()` and `saveFavoriteProjects()`
- `src/components/shell/TopBar.tsx` -- load favorites from Firestore on mount, persist toggles to Firestore
- `src/app/page.tsx` -- load favorites from Firestore, added `getFavoriteProjects` import

---

## 2026-07-01: BQ Console deep-links in thinking steps

**What changed**:
- Thinking steps with dataset/table/project context now show a small external-link icon on hover that opens the corresponding view in BigQuery Cloud Console
- Added `StepInfo` type and `StatusCallback` alias to `types.ts` -- `onStatus` now accepts `string | StepInfo`
- Added `bqConsoleUrl()` and `stepWithLink()` helpers to orchestrator
- Key orchestrator steps enriched: "Building SQL...", "Dry-running query...", schema lookups, data management operations
- Dataset and table names in the thinking metadata section are now clickable links to BQ Console
- Hover-reveal link icon uses `opacity: 0` -> `1` transition on `.thinking-step:hover`
- Entity links use dotted underline styling via `.thinking-entity-link`

**Files modified**:
- `src/lib/types.ts` -- added `StepInfo` interface and `StatusCallback` type alias
- `src/lib/chat-orchestrator.ts` -- added `bqConsoleUrl()`/`stepWithLink()`, updated all 9 handler signatures to `StatusCallback`, enriched 7 key onStatus call sites
- `src/app/page.tsx` -- updated state types, onStatus callbacks, step rendering, and metadata entity links
- `src/app/globals.css` -- added `.step-link` and `.thinking-entity-link` styles

---

## 2026-07-01: Editable SQL block with re-run

**What changed**:
- SQL blocks now wrap multi-line (`pre-wrap`) instead of scrolling off-screen horizontally
- Added `max-height: 240px` with vertical scrolling for long queries
- SQL in query result cards can be edited inline: click "Edit" to switch to a textarea, modify the SQL, then click "Run" to re-execute the modified query
- "Reset" link reverts edits to the original SQL
- Re-run uses the existing chip-click orchestration path (`forcedSkill: 'query'` with SQL context)

**Files modified**:
- `src/app/globals.css` -- updated `.sql-block`, added `.sql-block-editor`, `.sql-action-btn`, `.sql-run-btn`
- `src/components/ArtifactCard.tsx` -- replaced static SQL div with editable textarea + action bar
- `src/app/page.tsx` -- added `handleRunSql()` and passed `onRunSql` prop to ArtifactCard
- `src/components/AlertView.tsx` -- added pre-wrap and max-height to Check SQL block

---

## 2026-07-01: Fix session expired sign-in loop

**What changed**:
- "Session Expired" error banner now shows "Sign in again" button (was "Try again") that opens the Google sign-in popup to get a fresh OAuth token, instead of retrying the message with the expired token
- `handleAuthError()` in `bigquery-client.ts` now clears the stale token from sessionStorage before redirecting, so the redirect lands on the sign-in page instead of the app with a broken token

**Files modified**:
- `src/app/page.tsx` -- pull `signIn` from useAuth, use it as retryFn for auth errors, change button label
- `src/lib/bigquery-client.ts` -- clear sessionStorage before hard redirect

---

## 2026-07-01: Auto-scroll shows result top instead of overshooting

**What changed**:
- When a prompt returns results, the chat now scrolls to the top of the last assistant message instead of scrolling past it to a bottom sentinel div
- User messages still scroll to the bottom (to keep the loading spinner visible)
- Added `data-msg-idx` data attributes to message wrapper divs in both center and sidebar layouts so the scroll logic can find the target element
- Used `requestAnimationFrame` to let DOM render the new content before scrolling

**Files modified**:
- `src/app/page.tsx` -- updated auto-scroll `useEffect`, added `data-msg-idx` attributes to message divs

---

## 2026-07-01: Context chips in the prompt area

**What changed**:
- Added visual context indicator above the textarea in the prompt area
- Context chips auto-populate from the last response (dataset, table, result row count)
- Chips are dismissable -- removing a chip excludes that piece from the next orchestrator call
- Any previous ArtifactCard result can be pinned as context via a "chat" icon button in the card footer
- Pinning replaces the current context chips with the pinned result's context
- All orchestrator calls now derive context from the visible chips (source of truth)
- Context resets on new conversation
- Works in all three prompt bar locations: empty state, floating bar, split-mode sidebar

**Files modified**:
- `src/lib/types.ts` -- added `ContextItem` interface
- `src/app/page.tsx` -- `contextItems` state, `extractContextItems()`, `deriveContextFromItems()`, `pinEnvelopeContext()`, chips row rendering, ArtifactCard wiring
- `src/components/ArtifactCard.tsx` -- added `onPin`/`isPinned` props, chat icon button in footer
- `src/app/globals.css` -- `.context-chips-row`, `.context-chip`, `.context-chip-dismiss`, `.context-action-btn` styles

---

## 2026-07-01: Plan caching, conditional self-review, and result quality flags

**What changed**:
- Added session-scoped query plan cache (`plan-cache.ts`) that reuses SQL templates on iterative queries
- Made self-review Gemini call conditional -- skipped for schema listings, KPI cards, and high-confidence small results
- Added heuristic result quality analysis (`result-quality.ts`) for null rates, categorical near-duplicates, zero rows, and single-value columns
- Quality flags render as dismissible banners in `ArtifactCard.tsx` with amber/gray severity styling
- Quality flag suggested actions convert to next-action chips via the composer
- Single-value column detection suppresses WHERE-clause-filtered columns per user feedback

**Files created**:
- `src/lib/plan-cache.ts` -- session-scoped cache with parameter diffing and FIFO eviction
- `src/lib/result-quality.ts` -- pure heuristic checks, no model calls

**Files modified**:
- `src/lib/chat-orchestrator.ts` -- plan cache integration in `handleQuery()`, `routerConfidence` tracking, conditional self-review gate
- `src/lib/composer.ts` -- accepts and folds `qualityFlags` into envelopes, converts suggested actions to chips
- `src/lib/types.ts` -- added `qualityFlags` to `CompositionEnvelope`, re-exported `QualityFlag` type
- `src/components/ArtifactCard.tsx` -- dismissible quality flag banner rendering

---

## 2026-07-01: Freshness monitoring project-vs-dataset fix

**What changed**:
- Fixed `handleMonitoring` FRESHNESS handler to resolve dataset from enriched context, not just handoff context
- Made `FreshnessResult.dataset` nullable (null = project scope), added `project` field
- Updated composer and FreshnessView to correctly label project-scope vs dataset-scope results

**Files modified**:
- `src/lib/chat-orchestrator.ts` -- expanded monitoring handler context type, fixed dataset resolution chain
- `src/lib/types.ts` -- `FreshnessResult.dataset` now `string | null`, added `project?: string`
- `src/lib/composer.ts` -- `composeFreshness` handles empty entries and project-scope labeling
- `src/components/FreshnessView.tsx` -- empty state and summary badges distinguish project vs dataset

---

## 2026-06-30: Knowledge System Implementation

**What changed**:
- Created `.agents/knowledge/` directory with 7 knowledge files
- Updated `AGENTS.md` to reference knowledge system and enforce pre-change checks
- Established operational memory for the project

**Files created**:
- `.agents/knowledge/ops-ledger.md` -- operations log (pre-populated from history)
- `.agents/knowledge/invariants.md` -- system rules that must hold
- `.agents/knowledge/data-encyclopedia.md` -- BigQuery domain knowledge
- `.agents/knowledge/test-cases.md` -- canonical regression test cases
- `.agents/knowledge/component-map.md` -- codebase structure guide
- `.agents/knowledge/prompt-versions.md` -- LLM prompt tracking
- `.agents/knowledge/changelog.md` -- this file

**Why**: The project had no institutional memory. Each coding session started from scratch, leading to regressions and oscillating fixes. This knowledge system gives future sessions context about what works, what doesn't, and why.

---

## 2026-06-30: Data Lineage Visualization

**What changed**:
- Added `LineageDagView.tsx` component for DAG visualization
- Updated discovery handler to support LINEAGE sub-type
- Lineage data sourced from `INFORMATION_SCHEMA.JOBS_BY_PROJECT`

---

## 2026-06-30: Dataset Table Listing Fix

**What changed**:
- Fixed `handleSchema()` to correctly distinguish dataset scope vs table scope
- Added dataset name validation against `availableDatasets` list
- Fixed `extractSchemaIdentifiers()` to check known datasets before defaulting to TABLE scope

**Root cause**: The schema handler treated all unqualified names as table names, even when they matched known dataset names.

---

## 2026-06-30: Infinite Refresh Loop Fix

**What changed**:
- Fixed auth state handler to be idempotent
- Added state comparison before calling setState in auth context

**Root cause**: Auth token expiration triggered setState which triggered re-render which re-checked auth in a loop.

---

## 2026-06-26: Table Duplication Support

**What changed**:
- Added copy/duplicate/replicate verbs to `MUTATING_VERBS` in router
- Added counterbalancing "find duplicates" / "check for duplicates" phrases to `DATA_QUALITY_SIGNALS`
- Updated data-management handler to support COPY_TABLE operation

**Lesson learned**: Ambiguous words added to MUTATING_VERBS need high-weight counterparts in quality signals to prevent misrouting.

---

## 2026-06-24: UI Styling and Controls

**What changed**:
- Flat segmented control styling
- Header control repositioning
- Regenerate button repositioning

---

## Template for Future Entries

Copy this when adding a new entry:

```
## YYYY-MM-DD: [Short Description]

**What changed**:
- [List of changes]

**Files modified**:
- [List of files]

**Root cause** (if fixing a bug):
- [Why the bug existed]

**Lesson learned** (if applicable):
- [What to remember for next time]
```
