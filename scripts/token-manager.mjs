// scripts/token-manager.mjs
// Provides and auto-refreshes Google OAuth2 access tokens for the test loop.
//
// Priority order:
//   1. .oauth-credentials.json with refresh_token → auto-refresh forever (best)
//   2. .token-cache.json written by the running app → good while browser is open
//   3. GOOGLE_ACCESS_TOKEN in .env.local → manual fallback (~55 min)

import { readFileSync, writeFileSync, existsSync, watchFile } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OAUTH_CREDS_PATH = join(ROOT, '.oauth-credentials.json');
const TOKEN_CACHE_PATH = join(ROOT, '.token-cache.json');
const ENV_PATH = join(ROOT, '.env.local');

const REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadEnv() {
  const lines = readFileSync(ENV_PATH, 'utf-8').split('\n');
  const env = {};
  for (const line of lines) {
    const [k, ...v] = line.split('=');
    if (k && !k.startsWith('#') && k.trim()) env[k.trim()] = v.join('=').trim();
  }
  return env;
}

// ─── State ────────────────────────────────────────────────────────────────────

let _creds = null;   // parsed .oauth-credentials.json (has refresh_token)
let _token = null;
let _expiresAt = 0;
let _source = 'none';

// ─── Refresh via refresh_token ────────────────────────────────────────────────

async function refreshViaRefreshToken() {
  if (!_creds?.refresh_token) throw new Error('No refresh_token available');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: _creds.client_id,
      client_secret: _creds.client_secret,
      refresh_token: _creds.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(`Refresh failed: ${data.error} — ${data.error_description}`);

  _token = data.access_token;
  _expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
  _source = 'oauth-refresh';

  // Save updated creds
  _creds.access_token = _token;
  _creds.expires_at = _expiresAt;
  if (data.refresh_token) _creds.refresh_token = data.refresh_token; // token rotation
  writeFileSync(OAUTH_CREDS_PATH, JSON.stringify(_creds, null, 2));

  // Also sync to .env.local
  const envContent = readFileSync(ENV_PATH, 'utf-8');
  writeFileSync(ENV_PATH, envContent.replace(/^GOOGLE_ACCESS_TOKEN=.*$/m, `GOOGLE_ACCESS_TOKEN=${_token}`));

  return _token;
}

// ─── Read token-cache.json ────────────────────────────────────────────────────

function readTokenCache() {
  if (!existsSync(TOKEN_CACHE_PATH)) return null;
  try {
    const data = JSON.parse(readFileSync(TOKEN_CACHE_PATH, 'utf-8'));
    if (data.access_token && data.expires_at && Date.now() < data.expires_at - REFRESH_BUFFER_MS) {
      return data;
    }
  } catch { /* ignore */ }
  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function initTokenManager() {

  // ── Priority 1: .oauth-credentials.json with refresh_token ──────────────────
  if (existsSync(OAUTH_CREDS_PATH)) {
    try {
      _creds = JSON.parse(readFileSync(OAUTH_CREDS_PATH, 'utf-8'));
      if (_creds.refresh_token) {
        _source = 'oauth-refresh';
        // Reuse existing access token if still fresh
        if (_creds.access_token && _creds.expires_at && Date.now() < _creds.expires_at - REFRESH_BUFFER_MS) {
          _token = _creds.access_token;
          _expiresAt = _creds.expires_at;
          const mins = Math.round((_expiresAt - Date.now()) / 60000);
          console.log(`  🔑 Token: saved credentials with refresh_token (${mins} min remaining)`);
          console.log(`     Mode: ✨ auto-refresh forever`);
        } else {
          console.log('  🔑 Token: refreshing via refresh_token...');
          await refreshViaRefreshToken();
          const mins = Math.round((_expiresAt - Date.now()) / 60000);
          console.log(`  ✅ Token refreshed (${mins} min remaining)`);
          console.log(`     Mode: ✨ auto-refresh forever`);
        }
        return true;
      }
    } catch (err) {
      console.warn(`  ⚠ .oauth-credentials.json load failed: ${err.message}`);
      _creds = null;
    }
  }

  // ── Priority 2: .token-cache.json from the running app ──────────────────────
  const cached = readTokenCache();
  if (cached) {
    _token = cached.access_token;
    _expiresAt = cached.expires_at;
    _source = 'app-cache';
    const mins = Math.round((_expiresAt - Date.now()) / 60000);
    console.log(`  🔑 Token: app token cache (${mins} min remaining)`);
    console.log(`     Mode: auto-refresh via browser (keep tab open)`);
    // Watch for app-driven refreshes
    watchFile(TOKEN_CACHE_PATH, { interval: 10000 }, () => {
      const updated = readTokenCache();
      if (updated && updated.access_token !== _token) {
        _token = updated.access_token;
        _expiresAt = updated.expires_at;
        console.log(`\n  🔄 Token refreshed from app cache\n`);
      }
    });
    return true;
  }

  // ── Priority 3: GOOGLE_ACCESS_TOKEN in .env.local ────────────────────────────
  const env = loadEnv();
  const envToken = env.GOOGLE_ACCESS_TOKEN;
  if (envToken && envToken.startsWith('ya29.')) {
    _token = envToken;
    _expiresAt = Date.now() + 55 * 60 * 1000;
    _source = 'env-local';
    console.log('  🔑 Token: GOOGLE_ACCESS_TOKEN from .env.local');
    console.log('  ⚠  No auto-refresh. Run `npm run test:auth` for permanent setup.');
    return true;
  }

  return false;
}

export async function getToken() {
  // If we have a refresh_token, use it when token is near expiry
  if (_creds?.refresh_token && Date.now() >= _expiresAt - REFRESH_BUFFER_MS) {
    const mins = Math.round((_expiresAt - Date.now()) / 60000);
    console.log(`\n  🔄 Token expiring in ${mins} min — auto-refreshing...`);
    try {
      await refreshViaRefreshToken();
      console.log(`  ✅ Token refreshed (${Math.round((_expiresAt - Date.now()) / 60000)} min remaining)\n`);
    } catch (err) {
      console.error(`  ❌ Refresh failed: ${err.message}`);
    }
  }

  if (_token && Date.now() < _expiresAt) return _token;

  // Check app cache and .env.local as fallbacks
  const cached = readTokenCache();
  if (cached) { _token = cached.access_token; _expiresAt = cached.expires_at; return _token; }

  const env = loadEnv();
  const envToken = env.GOOGLE_ACCESS_TOKEN;
  if (envToken && envToken.startsWith('ya29.') && envToken !== _token) {
    _token = envToken; _expiresAt = Date.now() + 55 * 60 * 1000;
    console.log('\n  🔄 Picked up new token from .env.local\n');
    return _token;
  }

  if (_token) return _token; // return what we have, may be slightly expired
  throw new Error('No token available. Run: npm run test:auth');
}

export function tokenStatus() {
  const minsLeft = Math.round((_expiresAt - Date.now()) / 60000);
  return {
    hasToken: !!_token,
    source: _source,
    expiresInMins: minsLeft,
    mode: _creds?.refresh_token ? 'auto-refresh forever' : _source === 'app-cache' ? 'auto-refresh via browser' : 'manual',
  };
}

export function hasRefreshToken() {
  return !!_creds?.refresh_token;
}
