# BigQuery AIF

A conversational AI assistant for Google BigQuery. Ask questions about your data in natural language and get SQL queries, visualizations, schema exploration, data management operations, and more -- all without leaving the browser.

## Architecture

```
User Message
    |
    v
  Router (src/lib/router.ts)        -- keyword + signal scoring -> skill selection
    |
    v
  Orchestrator (src/lib/chat-orchestrator.ts)  -- dispatches to skill handlers
    |
    v
  Skill Handlers (src/lib/skills/)   -- query, schema, data-management, etc.
    |                                   Uses Gemini via /gemini-proxy (Cloud Function)
    v
  Composer (src/lib/composer.ts)     -- shapes results into display envelopes
    |
    v
  UI Components (src/components/)    -- renders charts, tables, schema views
```

Everything except the Gemini proxy runs **client-side** in the browser. The app is a static export (`output: 'export'`) deployed to Firebase Hosting. A Cloud Function (`functions/src/index.ts`) proxies Gemini API calls with a server-side API key.

## Required Environment Variables

Create a `.env.local` file in the project root:

| Variable | Where Used | Description |
|----------|-----------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `src/lib/firebase.ts` | Firebase project API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `src/lib/firebase.ts` | Firebase Auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `src/lib/firebase.ts` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `src/lib/firebase.ts` | Firebase app ID |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `src/lib/firebase.ts` | FCM sender ID |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Map visualizations | Maps JavaScript API key |
| `GEMINI_API_KEY` | Cloud Function secret | Set via `firebase functions:secrets:set GEMINI_API_KEY` |

For server-side scripts (`scripts/ux-eval.mjs`, etc.), also set:
- `GEMINI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY` -- direct Gemini API access for test harnesses.

## OAuth Client Setup

The app uses Google OAuth via Firebase Auth popup sign-in.

**Scopes requested:**
- `https://www.googleapis.com/auth/bigquery` -- BigQuery queries, jobs, datasets, tables, Data Transfer
- `https://www.googleapis.com/auth/spreadsheets` -- Google Sheets export
- `https://www.googleapis.com/auth/devstorage.read_write` -- GCS export

**GCP Console configuration:**
1. Create an OAuth 2.0 Web Client in the GCP console.
2. Set authorized JavaScript origins: `https://bigqueryaif.web.app`, `http://localhost:5800`
3. Set authorized redirect URIs: `https://bigqueryaif.web.app/__/auth/handler`, `http://localhost:5800/__/auth/handler`
4. Add the client ID to the Firebase Auth console under Sign-in Providers > Google.

## Firebase Setup

- **Project:** `malloy-data`
- **Firestore:** Uses a named database `bigquery-aif` (not the default `(default)` database)
- **Hosting:** Site name `bigqueryaif` (serves from `out/`)
- **Cloud Functions:** `geminiProxy` in `us-central1`

Deploy Firestore rules:
```bash
npx -y firebase-tools@latest deploy --only firestore:rules --project malloy-data
```

Deploy Cloud Functions:
```bash
npx -y firebase-tools@latest deploy --only functions --project malloy-data
```

## Local Development

```bash
# Install dependencies
npm install
cd functions && npm install && cd ..

# Start dev server on port 5800
npm run dev
```

The dev server runs at `http://localhost:5800`. Note that the Gemini proxy Cloud Function is not available locally -- AI features require the deployed function or a local emulator setup.

## Testing

```bash
# Fast unit tests (router, sql-guard, format, composer)
npm test

# TypeScript type check
npx tsc --noEmit

# Router regression snapshot test
node scripts/snapshot-test.mjs

# Full build (static export)
npm run build
```

## Deploy

```bash
# Build the static export
npm run build

# Deploy hosting + functions
npx -y firebase-tools@latest deploy --only hosting,functions --project malloy-data
```

The deployed app is available at: https://bigqueryaif.web.app

## Project Structure

```
src/
  app/            -- Next.js pages (page.tsx, layout.tsx, globals.css)
  components/     -- React UI components (40+)
  lib/            -- Core logic
    router.ts         -- Intent classification
    chat-orchestrator.ts -- Skill dispatch
    skills/           -- 14 skill handlers
    composer.ts       -- Response composition
    gemini-client.ts  -- Gemini API client (via proxy)
    bigquery-client.ts -- BigQuery REST client
    gis-auth.ts       -- OAuth token management
    auth-context.tsx  -- React auth context
    firebase.ts       -- Firebase initialization
    sql-guard.ts      -- SQL type-check guard
    format-value.ts   -- Value formatting
    format.ts         -- Result formatting
    types.ts          -- Shared type definitions
functions/
  src/index.ts    -- Gemini proxy Cloud Function
scripts/          -- Test harnesses, deployment, screenshots
.agents/          -- Agent rules, skills, and knowledge base
docs/             -- Design documents and research
```
