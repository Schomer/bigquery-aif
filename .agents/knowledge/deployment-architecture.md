# Deployment Architecture

Last updated: 2026-07-07

## Stack

- **Framework**: Next.js 16 (server-side rendering)
- **Hosting**: Firebase App Hosting (auto-deploys on git push)
- **Database**: Cloud Firestore (conversations, saved work, learned plans)
- **Auth**: Google Identity Services (OAuth 2.0, client-side)
- **LLM**: Gemini 3.5 Flash via REST API (API key auth)
- **Data**: BigQuery REST API (OAuth token from user's session)

## Environment Variables

Defined in `apphosting.yaml` and `.env.local`:
- `GEMINI_API_KEY` -- API key for Gemini calls
- `NEXT_PUBLIC_FIREBASE_*` -- Firebase project config
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` -- OAuth client ID
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` -- Maps API for geo charts

## Build & Deploy Pipeline

1. Make code changes
2. `npm run build` -- validates compilation (required before deploy)
3. `git add -A && git commit -m "..." && git push` -- pushes to remote
4. `node scripts/deploy.mjs` -- triggers Firebase App Hosting deployment
5. Firebase App Hosting builds from the pushed commit and serves via CDN

## Auth Flow

1. User clicks "Sign in with Google" on SignedOutPage
2. Google Identity Services returns an OAuth access token
3. Token stored in memory (not localStorage) via auth-context
4. Token passed to BigQuery REST API calls as Bearer header
5. Token passed to Sheets API, Data Transfer API as needed
6. On 401, `withAuthRetry` refreshes the token once without prompting
7. If refresh fails, user is prompted to sign in again

## Client-Side Architecture

All orchestration runs in the browser. The API route (`/api/chat/route.ts`) exists only for the test harness script. In production:
- page.tsx calls ChatOrchestrator.processMessage() directly
- ChatOrchestrator calls Gemini API via REST (API key, not OAuth)
- ChatOrchestrator calls BigQuery REST API via OAuth token from user session
- Results rendered client-side by component tree

## Key Constraints

- No server-side job queue -- everything must complete within a browser request
- OAuth tokens expire; all API calls wrapped in withAuthRetry
- Gemini API key is public (embedded in client); API key restrictions must be configured in GCP Console
- BigQuery operations are scoped to what the user's Google account has access to
