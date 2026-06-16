#!/usr/bin/env node
// scripts/setup-bq-auth.mjs
// One-time BigQuery authorization setup.
// Run this once: node scripts/setup-bq-auth.mjs
// It will open a browser, you approve access, and a permanent refresh_token
// is saved to .refresh-token — the app then works forever without re-auth.

import { createServer } from 'http';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const REFRESH_TOKEN_PATH = join(ROOT, '.refresh-token');
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

// Read credentials from .env.local
function readEnv() {
  const env = {};
  try {
    const content = readFileSync(join(ROOT, '.env.local'), 'utf-8');
    for (const line of content.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim();
    }
  } catch (e) {
    console.error('Could not read .env.local:', e.message);
    process.exit(1);
  }
  return env;
}

const env = readEnv();
const CLIENT_ID = env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_OAUTH_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('ERROR: GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be set in .env.local');
  process.exit(1);
}

const CALLBACK_PORT = 5801;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`;

const SCOPES = [
  'https://www.googleapis.com/auth/bigquery',
  'https://www.googleapis.com/auth/cloud-platform',
  'openid',
  'email',
  'profile',
].join(' ');

const params = new URLSearchParams({
  response_type: 'code',
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  scope: SCOPES,
  access_type: 'offline',
  prompt: 'consent',
});

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

// Spin up a local HTTP server to catch the OAuth callback
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${CALLBACK_PORT}`);

  if (url.pathname !== '/callback') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<h2>Authorization failed: ${error}</h2><p>Close this tab and try again.</p>`);
    server.close();
    console.error('\nAuthorization failed:', error);
    process.exit(1);
  }

  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h2>No authorization code received.</h2>');
    server.close();
    process.exit(1);
  }

  console.log('\nReceived authorization code. Exchanging for tokens...');

  try {
    const tokenRes = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        code,
      }),
    });

    const tokens = await tokenRes.json();

    if (!tokenRes.ok || tokens.error) {
      const detail = tokens.error_description || tokens.error || 'unknown';
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<h2>Token exchange failed</h2><p>${detail}</p><p>See terminal for details.</p>`);
      console.error('\nToken exchange failed:', JSON.stringify(tokens, null, 2));

      if (tokens.error === 'redirect_uri_mismatch') {
        console.error('\nFIX REQUIRED: Add this Authorized Redirect URI to your Google Cloud Console OAuth client:');
        console.error('  ' + REDIRECT_URI);
        console.error('\nGo to: https://console.cloud.google.com/apis/credentials');
      }

      server.close();
      process.exit(1);
    }

    if (!tokens.refresh_token) {
      console.warn('\nWARNING: No refresh_token in response.');
      console.warn('This usually means this Google account already authorized this app without "prompt=consent".');
      console.warn('Try revoking access at https://myaccount.google.com/permissions and running this script again.');
    } else {
      writeFileSync(REFRESH_TOKEN_PATH, tokens.refresh_token, { mode: 0o600 });
      console.log('\nSUCCESS! Refresh token saved to .refresh-token');
      console.log('The app will now auto-refresh BigQuery tokens forever.');
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <body style="font-family:sans-serif;max-width:480px;margin:60px auto;text-align:center">
          <h2 style="color:#1d4ed8">BigQuery access authorized</h2>
          <p>You can close this tab and return to the app.</p>
          ${tokens.refresh_token ? '<p style="color:#16a34a">Permanent refresh token saved.</p>' : '<p style="color:#dc2626">Warning: no refresh token. See terminal.</p>'}
        </body>
      </html>
    `);

    server.close();
    process.exit(0);
  } catch (err) {
    console.error('\nFetch error during token exchange:', err.message);
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end('<h2>Internal error</h2><p>See terminal.</p>');
    server.close();
    process.exit(1);
  }
});

server.listen(CALLBACK_PORT, () => {
  console.log('BigQuery Authorization Setup');
  console.log('============================');
  console.log('');
  console.log('IMPORTANT: Before continuing, make sure this redirect URI is registered');
  console.log('in your Google Cloud Console OAuth client:');
  console.log('');
  console.log('  ' + REDIRECT_URI);
  console.log('');
  console.log('Go to: https://console.cloud.google.com/apis/credentials');
  console.log('Edit the OAuth client -> Authorized redirect URIs -> Add URI above -> Save');
  console.log('');
  console.log('Opening browser to authorize...');
  console.log('(If browser does not open, visit this URL manually:)');
  console.log('');
  console.log(authUrl);
  console.log('');

  // Open browser
  exec(`open "${authUrl}"`, (err) => {
    if (err) {
      console.log('Could not open browser automatically. Copy the URL above into your browser.');
    }
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${CALLBACK_PORT} is in use. Kill whatever is using it and try again.`);
  } else {
    console.error('Server error:', err.message);
  }
  process.exit(1);
});
