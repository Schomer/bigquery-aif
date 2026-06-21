// src/lib/auth-context.tsx
// Firebase Auth — handles user identity and Google OAuth scopes for client-side API calls.

'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';

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
  bqRefreshToken: string | null;
  signIn: () => void;
  signOut: () => void;
  setActiveProject: (p: string) => void;
  setBqTokenState: (refreshToken: string) => void;
  error: string | null;
}

const AuthContext = createContext<AuthState | null>(null);

const DEFAULT_PROJECT = process.env.NEXT_PUBLIC_GOOGLE_PROJECT_ID ?? 'malloy-data';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [activeProject, setActiveProjectState] = useState<string>(DEFAULT_PROJECT);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load token on mount & listen to changes
  useEffect(() => {
    const handleTokenChange = () => {
      try {
        const stored = sessionStorage.getItem('google_access_token');
        const expiresAtStr = sessionStorage.getItem('google_access_token_expires_at');
        const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : 0;
        if (stored && expiresAt > Date.now()) {
          setAccessToken(stored);
        } else {
          sessionStorage.removeItem('google_access_token');
          sessionStorage.removeItem('google_access_token_expires_at');
          setAccessToken(null);
        }
      } catch {}
    };

    handleTokenChange();

    window.addEventListener('storage', handleTokenChange);
    window.addEventListener('bq-auth-error', handleTokenChange);
    return () => {
      window.removeEventListener('storage', handleTokenChange);
      window.removeEventListener('bq-auth-error', handleTokenChange);
    };
  }, []);

  // ── Firebase auth state listener ──────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      if (!firebaseUser) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      setUser({
        uid: firebaseUser.uid,
        name: firebaseUser.displayName ?? '',
        email: firebaseUser.email ?? '',
        picture: firebaseUser.photoURL ?? '',
      });
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  // ── Sign in ───────────────────────────────────────────────────────────────
  const signIn = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/bigquery');
      provider.addScope('https://www.googleapis.com/auth/cloud-platform');
      provider.setCustomParameters({ prompt: 'select_account consent' });
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        sessionStorage.setItem('google_access_token', credential.accessToken);
        const expiresAt = Date.now() + 3500 * 1000;
        sessionStorage.setItem('google_access_token_expires_at', String(expiresAt));
        setAccessToken(credential.accessToken);
      } else {
        throw new Error('Google OAuth access token was not returned. Please make sure Google authentication is configured correctly in the Firebase Console and that scopes are approved.');
      }
      setUser({
        uid: result.user.uid,
        name: result.user.displayName ?? '',
        email: result.user.email ?? '',
        picture: result.user.photoURL ?? '',
      });
    } catch (err: any) {
      console.error('Sign-in error:', err);
      setError(err?.message || String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Sign out ───────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    sessionStorage.removeItem('google_access_token');
    sessionStorage.removeItem('google_access_token_expires_at');
    setAccessToken(null);
    setUser(null);
    setActiveProjectState(DEFAULT_PROJECT);
    setError(null);
  }, []);

  // ── Project switching ──────────────────────────────────────────────────────
  const setActiveProject = useCallback((p: string) => {
    setActiveProjectState(p);
  }, []);

  const setBqTokenState = useCallback((_refreshToken: string) => {
    // Stub
  }, []);

  const projects = [activeProject];

  return (
    <AuthContext.Provider value={{
      user,
      accessToken,
      projects,
      activeProject,
      isLoading,
      bqAuthorized: !!accessToken,
      bqRefreshToken: null,
      signIn,
      signOut,
      setActiveProject,
      setBqTokenState,
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
