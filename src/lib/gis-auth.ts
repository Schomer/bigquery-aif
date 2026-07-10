// src/lib/gis-auth.ts
// Shared access-token and refresh-token store.
// The auth context writes tokens here after Firebase Auth sign-in;
// BigQuery/Gemini callers read the access token via getAccessToken().
//
// Access token: stored in localStorage, survives tab close / new tabs.
// Refresh token: stored in localStorage, long-lived (until user revokes).
//   Used by /api/auth/refresh for popup-free token renewal.
// Timestamp: stored alongside the access token for proactive expiry checks.

const TOKEN_KEY = 'bqaif_access_token';
const TIMESTAMP_KEY = 'bqaif_token_ts';
const REFRESH_TOKEN_KEY = 'bqaif_refresh_token';

// Google OAuth access tokens expire after 3600s. We consider them "likely
// expired" after 50 minutes to give a 10-minute buffer for proactive refresh.
const TOKEN_LIFETIME_MS = 50 * 60 * 1000;

let _accessToken: string | null = null;

function readFromStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string | null) {
  _accessToken = token;
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(TIMESTAMP_KEY, String(Date.now()));
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TIMESTAMP_KEY);
    }
  } catch {
    // localStorage unavailable (SSR, private mode, etc.)
  }
}

export function getAccessToken(): string | null {
  if (_accessToken) return _accessToken;
  // Restore from localStorage after page refresh / new tab
  const stored = readFromStorage(TOKEN_KEY);
  if (stored) {
    _accessToken = stored;
    return stored;
  }
  return null;
}

/**
 * Returns true if the stored token is older than 50 minutes (Google OAuth
 * tokens expire at 60 min). Used to trigger proactive refresh before a 401.
 * Returns true if no timestamp is stored (token age unknown -- treat as expired).
 */
export function isTokenLikelyExpired(): boolean {
  const ts = readFromStorage(TIMESTAMP_KEY);
  if (ts === null) return true;
  return Date.now() - Number(ts) > TOKEN_LIFETIME_MS;
}

// ── Refresh token ─────────────────────────────────────────────────────

export function setRefreshToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {
    // localStorage unavailable
  }
}

export function getRefreshToken(): string | null {
  return readFromStorage(REFRESH_TOKEN_KEY);
}

/**
 * Calls the server-side /api/auth/refresh endpoint to exchange the stored
 * refresh token for a new access token. Returns the new access token or null.
 * This is fully silent -- no popup, no redirect, no user interaction.
 */
export async function refreshAccessTokenSilently(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      console.warn('[gis-auth] Server-side refresh failed:', res.status);
      return null;
    }

    const data = await res.json();
    if (data.access_token) {
      setAccessToken(data.access_token);
      return data.access_token;
    }
    return null;
  } catch (err) {
    console.warn('[gis-auth] Server-side refresh error:', err);
    return null;
  }
}

// ── Migration ─────────────────────────────────────────────────────────

/**
 * Migrate: remove any leftover sessionStorage entries from the old storage
 * scheme. Called once on module load.
 */
function migrateFromSessionStorage() {
  try {
    const old = sessionStorage.getItem('bqaif_access_token');
    if (old) {
      if (!localStorage.getItem(TOKEN_KEY)) {
        localStorage.setItem(TOKEN_KEY, old);
        localStorage.setItem(TIMESTAMP_KEY, String(Date.now()));
      }
      sessionStorage.removeItem('bqaif_access_token');
    }
  } catch {
    // ignore -- SSR or storage unavailable
  }
}

// Run migration on first import
if (typeof window !== 'undefined') {
  migrateFromSessionStorage();
}
