// src/lib/gis-auth.ts
// Shared access-token store.
// The auth context writes tokens here after Firebase Auth sign-in;
// BigQuery/Gemini callers read the access token via getAccessToken().
//
// Access token: stored in localStorage, survives tab close / new tabs.
// Timestamp: stored alongside the access token for proactive expiry checks.

const TOKEN_KEY = 'bqaif_access_token';
const TIMESTAMP_KEY = 'bqaif_token_ts';

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

// ── One-time cleanup ──────────────────────────────────────────────────
// Purge any refresh token left over from the old server-side refresh scheme.
// Also remove any leftover sessionStorage entries from the earlier storage scheme.

if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('bqaif_refresh_token');
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

