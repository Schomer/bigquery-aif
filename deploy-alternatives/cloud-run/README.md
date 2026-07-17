# Cloud Run Deployment (Abandoned)

These files describe an SSR deployment to Cloud Run that is **incompatible with the current static export** (`output: 'export'` in `next.config.ts`).

The project now uses:
- **Firebase Hosting** for the static site (built to `out/`)
- **Firebase Cloud Functions** for the Gemini API proxy

These files are kept for historical reference only. Do not use them without first removing `output: 'export'` from `next.config.ts` and restructuring the deployment pipeline.

## Files

- `Dockerfile` -- Multi-stage Node 22 build for Cloud Run
- `apphosting.yaml` -- Firebase App Hosting config (references a different domain)
- `.dockerignore` -- Docker build exclusions
- `iam-policy.json` -- Cloud Run IAM policy for public access
