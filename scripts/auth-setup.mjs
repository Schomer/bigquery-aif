#!/usr/bin/env node
// scripts/auth-setup.mjs
// One-time setup: opens a browser for OAuth2 authorization, catches the
// callback on a local loopback server, and saves a refresh_token permanently.
//
// Usage (run once):
//   npm run test:auth
//
// Works with any OAuth2 "Web application" client that has
// http://localhost:9876 in its authorized redirect URIs.

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { exec } from 'child_process';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CREDS_PATH = join(ROOT, '.oauth-credentials.json');
const ENV_PATH = join(ROOT, '.env.local');

// Loopback port for the OAuth redirect
const REDIRECT_PORT = 9876;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}`;

// Load .env.local
const envLines = readFileSync(ENV_PATH, 'utf-8').split('\n');
const env = {};
for (const line of envLines) {
  const [k, ...v] = line.split('=');
  if (k && !k.startsWith('#') && k.trim()) env[k.trim()] = v.join('=').trim();
}

// Prefer the Desktop app client (auto-allows localhost redirects, no URI registration needed)
// Fall back to the web app client + secret if desktop client not set
const CLIENT_ID = env.GOOGLE_DESKTOP_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID || env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_DESKTOP_CLIENT_SECRET || env.GOOGLE_OAUTH_CLIENT_SECRET || '';
const IS_DESKTOP_CLIENT = !!(env.GOOGLE_DESKTOP_CLIENT_ID && env.GOOGLE_DESKTOP_CLIENT_SECRET);

// BigQuery + Cloud Platform scopes
const SCOPES = [
  'https://www.googleapis.com/auth/bigquery',
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'offline_access',
].join(' ');

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!CLIENT_ID) {
    console.error('ERROR: GOOGLE_OAUTH_CLIENT_ID not found in .env.local');
    process.exit(1);
  }

  if (!CLIENT_SECRET) {
    console.error('ERROR: GOOGLE_OAUTH_CLIENT_SECRET not found in .env.local');
    console.error('Add it and re-run: npm run test:auth');
    process.exit(1);
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  BigQuery AIF — OAuth2 Setup (Loopback Flow)             ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log(`  Client type: ${IS_DESKTOP_CLIENT ? '✅ Desktop app (localhost auto-allowed)' : '⚠  Web app (may need redirect URI in GCP console)'}`);
  console.log(`  Client ID:   ${CLIENT_ID.substring(0, 40)}...`);
  console.log(`  Scopes:      bigquery, cloud-platform\n`);

  // ── STEP 0: Make sure http://localhost:9876 is in the GCP console ──────────
  console.log('  ⚠  IMPORTANT: Before continuing, verify in GCP Console that');
  console.log(`     http://localhost:${REDIRECT_PORT} is an authorized redirect URI.`);
  console.log('     Go to: console.cloud.google.com → APIs & Services → Credentials');
  console.log('     → edit your OAuth client → add the redirect URI if missing.\n');

  // Generate PKCE-like state token
  const state = randomBytes(16).toString('hex');

  // Build the authorization URL
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', [
    'https://www.googleapis.com/auth/bigquery',
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/userinfo.email',
  ].join(' '));
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');  // forces refresh_token
  authUrl.searchParams.set('state', state);

  // ── STEP 1: Start local callback server ────────────────────────────────────
  const code = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);

      // Accept any path — Google redirects to root or /oauth/callback
      if (!url.searchParams.has('code') && !url.searchParams.has('error')) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<p>Waiting for OAuth callback...</p>');
        return;
      }

      const returnedState = url.searchParams.get('state');
      const error = url.searchParams.get('error');
      const authCode = url.searchParams.get('code');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<h1>Authorization failed: ${error}</h1><p>You can close this tab.</p>`);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (returnedState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>State mismatch — possible CSRF attack.</h1>');
        server.close();
        reject(new Error('State mismatch'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html><body style="font-family:sans-serif;padding:40px;max-width:500px;margin:auto">
          <h1 style="color:#1a73e8">✅ Authorization successful!</h1>
          <p>The BigQuery AIF test loop now has permanent access.</p>
          <p><strong>You can close this tab.</strong></p>
        </body></html>
      `);
      server.close();
      resolve(authCode);
    });

    server.listen(REDIRECT_PORT, '127.0.0.1', () => {
      console.log(`  Local callback server ready on port ${REDIRECT_PORT}\n`);
      console.log('  ┌─────────────────────────────────────────────────────┐');
      console.log('  │  Opening browser for authorization...               │');
      console.log('  │  If it doesn\'t open, paste this URL manually:      │');
      console.log('  └─────────────────────────────────────────────────────┘\n');
      console.log(`  \x1b[36m${authUrl.toString()}\x1b[0m\n`);

      // Open the browser
      exec(`open "${authUrl.toString()}"`);
      console.log('  Waiting for you to sign in and authorize...\n');
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${REDIRECT_PORT} is already in use. Kill any other process using it and retry.`));
      } else {
        reject(err);
      }
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authorization timed out after 5 minutes'));
    }, 5 * 60 * 1000);
  });

  // ── STEP 2: Exchange code for tokens ───────────────────────────────────────
  console.log('  Authorization code received. Exchanging for tokens...');

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    }),
  });

  const tokens = await tokenRes.json();

  if (tokens.error) {
    console.error(`\nToken exchange failed: ${tokens.error} — ${tokens.error_description}`);
    process.exit(1);
  }

  if (!tokens.refresh_token) {
    console.warn('\n⚠  No refresh_token returned.');
    console.warn('   This usually means you already authorized this app previously.');
    console.warn('   Go to myaccount.google.com/permissions and revoke access, then retry.\n');
    if (!tokens.access_token) {
      console.error('No access_token either — aborting.');
      process.exit(1);
    }
  }

  // ── STEP 3: Save credentials ───────────────────────────────────────────────
  const creds = {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || null,
    token_type: tokens.token_type,
    expires_at: Date.now() + (tokens.expires_in || 3600) * 1000,
    scope: tokens.scope,
    saved_at: new Date().toISOString(),
  };
  writeFileSync(CREDS_PATH, JSON.stringify(creds, null, 2));

  // Update .env.local with fresh access token
  const envContent = readFileSync(ENV_PATH, 'utf-8');
  const updated = envContent.replace(
    /^GOOGLE_ACCESS_TOKEN=.*$/m,
    `GOOGLE_ACCESS_TOKEN=${tokens.access_token}`
  );
  writeFileSync(ENV_PATH, updated);

  // ── Done ───────────────────────────────────────────────────────────────────
  console.log('\n✅ Setup complete!\n');
  console.log('   .oauth-credentials.json  — saved (refresh_token: ' +
    (tokens.refresh_token ? '✅ yes' : '❌ missing — see warning above') + ')');
  console.log('   .env.local               — updated (GOOGLE_ACCESS_TOKEN written)');
  console.log('');
  if (tokens.refresh_token) {
    console.log('   ✨ The test loop will auto-refresh tokens forever. No more manual steps!\n');
  } else {
    console.log('   ⚠  Revoke access at myaccount.google.com/permissions and retry to get a refresh_token.\n');
  }
}

main().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
