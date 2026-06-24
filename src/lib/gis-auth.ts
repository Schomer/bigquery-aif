// src/lib/gis-auth.ts
// Shared access-token store.
// The auth context writes the token here after Firebase Auth sign-in;
// BigQuery/Gemini callers read it via getAccessToken().
// Token is also backed by sessionStorage so it survives page refresh.

const STORAGE_KEY = 'bqaif_access_token';

let _accessToken: string | null = null;

function readFromStorage(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string | null) {
  _accessToken = token;
  try {
    if (token) {
      sessionStorage.setItem(STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // sessionStorage unavailable (SSR, private mode, etc.)
  }
}

export function getAccessToken(): string | null {
  if (_accessToken) return _accessToken;
  // Restore from sessionStorage after page refresh
  const stored = readFromStorage();
  if (stored) {
    _accessToken = stored;
    return stored;
  }
  return null;
}
