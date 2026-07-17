// src/lib/auth-context.tsx
// Firebase Auth popup sign-in with Google.
// Provides both a Firebase Auth session (for Firestore) and a Google OAuth
// access token (for BigQuery / Sheets / GCS REST calls).
//
// Token refresh is handled via a quick popup re-auth using the refreshProvider
// (no consent prompt -- auto-completes almost instantly for returning users).

'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';
import {
  setAccessToken as storeToken,
  getAccessToken,
  isTokenLikelyExpired,
} from './gis-auth';

export interface GoogleUser {
  uid: string;
  name: string;
  email: string;
  picture: string;
}

export interface AuthState {
  user: GoogleUser | null;
  accessToken: string | null;
  projects: string[];
  activeProject: string;
  isLoading: boolean;
  bqAuthorized: boolean;
  signIn: () => Promise<boolean>;
  signOut: () => void;
  refreshAccessToken: () => Promise<boolean>;
  setActiveProject: (p: string) => void;
  error: string | null;
}

const AuthContext = createContext<AuthState | null>(null);

// Provider for initial sign-in: forces consent to ensure BQ/Sheets/GCS
// scopes are granted.
const consentProvider = new GoogleAuthProvider();
consentProvider.addScope('https://www.googleapis.com/auth/bigquery');
consentProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
consentProvider.addScope('https://www.googleapis.com/auth/devstorage.read_write');
consentProvider.setCustomParameters({
  prompt: 'consent',
  include_granted_scopes: 'true',
});

// Provider for popup-based token refresh (returning users).
// No consent prompt -- auto-completes almost instantly.
const refreshProvider = new GoogleAuthProvider();
refreshProvider.addScope('https://www.googleapis.com/auth/bigquery');
refreshProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
refreshProvider.addScope('https://www.googleapis.com/auth/devstorage.read_write');
refreshProvider.setCustomParameters({
  include_granted_scopes: 'true',
});

function toGoogleUser(fbUser: User): GoogleUser {
  return {
    uid: fbUser.uid,
    name: fbUser.displayName || '',
    email: fbUser.email || '',
    picture: fbUser.photoURL || '',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(() => getAccessToken());
  const [activeProject, setActiveProjectState] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevUserRef = useRef<GoogleUser | null>(null);
  const autoRefreshAttempted = useRef(false);
  const signingIn = useRef(false);

  // Sync token to both React state and the module-level store
  const setAccessToken = useCallback((token: string | null) => {
    storeToken(token);
    setAccessTokenState(token);
  }, []);

  // Only update user state when the actual user data has changed,
  // not on every onAuthStateChanged callback (which fires on token refresh).
  const setUserStable = useCallback((next: GoogleUser | null) => {
    const prev = prevUserRef.current;
    if (prev === next) return;
    if (prev && next && prev.uid === next.uid && prev.name === next.name && prev.email === next.email && prev.picture === next.picture) return;
    prevUserRef.current = next;
    setUser(next);
  }, []);

  // Listen for Firebase Auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setUserStable(toGoogleUser(fbUser));
        // If signIn() is in progress, it will handle the token itself.
        // Skip auto-refresh to avoid opening a second popup.
        if (signingIn.current) {
          return;
        }
        // Restore token from localStorage if available and not expired
        const storedToken = getAccessToken();
        if (storedToken && !isTokenLikelyExpired()) {
          setAccessTokenState(storedToken);
          setIsLoading(false);
        } else if (!autoRefreshAttempted.current) {
          // Token missing or expired -- attempt popup-based refresh
          autoRefreshAttempted.current = true;
          try {
            const result = await signInWithPopup(auth, refreshProvider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            const oauthToken = credential?.accessToken
              || (result as any)._tokenResponse?.oauthAccessToken
              || (result as any)._tokenResponse?.access_token;
            if (oauthToken) {
              storeToken(oauthToken);
              setAccessTokenState(oauthToken);
            }
          } catch (refreshErr: any) {
            console.warn('[auth] Auto-refresh failed:', refreshErr.code, refreshErr.message);
          }
          setIsLoading(false);
        } else {
          // Auto-refresh already attempted and failed -- stop loading
          setIsLoading(false);
        }
      } else {
        setUserStable(null);
        setAccessToken(null);
        setIsLoading(false);
      }
    });
    return unsub;
  }, [setAccessToken, setUserStable]);

  // Load active project from localStorage
  useEffect(() => {
    if (!user) return;
    const saved = localStorage.getItem('bqaif_activeProject');
    if (saved) setActiveProjectState(saved);
  }, [user]);

  const signIn = useCallback(async (): Promise<boolean> => {
    signingIn.current = true;
    try {
      setIsLoading(true);
      const result = await signInWithPopup(auth, consentProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      // Try multiple ways to extract the Google OAuth access token
      const oauthToken = credential?.accessToken
        || (result as any)._tokenResponse?.oauthAccessToken
        || (result as any)._tokenResponse?.access_token;
      if (oauthToken) {
        setAccessToken(oauthToken);
        setError(null);
      } else {
        // Show debug info so we can figure out what Firebase returned
        const keys = credential ? Object.keys(credential) : [];
        const trKeys = (result as any)._tokenResponse ? Object.keys((result as any)._tokenResponse) : [];
        setError(`No access token found. credential keys: [${keys.join(',')}], _tokenResponse keys: [${trKeys.join(',')}]`);
      }
      if (result.user) {
        setUser(toGoogleUser(result.user));
      }
      return true;
    } catch (err: any) {
      console.error('[auth] Sign-in failed:', err.code, err.message);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        // User closed the popup -- not an error
      } else {
        setError(`${err.code || 'unknown'}: ${err.message || 'Sign-in failed'}`);
      }
      return false;
    } finally {
      signingIn.current = false;
      setIsLoading(false);
    }
  }, [setAccessToken]);

  // Token refresh: popup-based (no consent prompt, auto-completes for
  // returning users).
  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    try {
      const result = await signInWithPopup(auth, refreshProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const oauthToken = credential?.accessToken
        || (result as any)._tokenResponse?.oauthAccessToken
        || (result as any)._tokenResponse?.access_token;
      if (oauthToken) {
        setAccessToken(oauthToken);
        setError(null);
        return true;
      }
      return false;
    } catch (err: any) {
      console.warn('[auth] Token refresh failed:', err.code, err.message);
      return false;
    }
  }, [setAccessToken]);

  const signOut = useCallback(async () => {
    await fbSignOut(auth);
    setAccessToken(null);
    setUser(null);
    setError(null);
  }, [setAccessToken]);

  const setActiveProject = useCallback((p: string) => {
    setActiveProjectState(p);
    localStorage.setItem('bqaif_activeProject', p);
  }, []);

  const bqAuthorized = !!user && !!accessToken;

  return (
    <AuthContext.Provider value={{
      user,
      accessToken,
      projects: activeProject ? [activeProject] : [],
      activeProject,
      isLoading,
      bqAuthorized,
      signIn,
      signOut,
      refreshAccessToken,
      setActiveProject,
      error,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
