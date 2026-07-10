// src/lib/gis-auth.ts
// Shared access-token store.
// The auth context writes the token here after Firebase Auth sign-in;
// BigQuery/Gemini callers read it via getAccessToken().
// Token is backed by localStorage so it survives tab closes and new tabs.
// A timestamp is stored alongside the token to enable proactive expiry checks.

const TOKEN_KEY = 'bqaif_access_token';
const TIMESTAMP_KEY = 'bqaif_token_ts';

// Google OAuth access tokens expire after 3600s. We consider them "likely
// expired" after 50 minutes to give a 10-minute buffer for proactive refresh.
const TOKEN_LIFETIME_MS = 50 * 60 * 1000;

let _accessToken: string | null = null;

function readFromStorage(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function readTimestamp(): number | null {
  try {
    const raw = localStorage.getItem(TIMESTAMP_KEY);
    return raw ? Number(raw) : null;
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
  const stored = readFromStorage();
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
  const ts = readTimestamp();
  if (ts === null) return true;
  return Date.now() - ts > TOKEN_LIFETIME_MS;
}

/**
 * Migrate: remove any leftover sessionStorage entries from the old storage
 * scheme. Called once on module load.
 */
function migrateFromSessionStorage() {
  try {
    const old = sessionStorage.getItem('bqaif_access_token');
    if (old) {
      // If localStorage doesn't have a token yet, migrate it over
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
