// src/lib/auth-context.tsx
// Firebase Auth — handles user identity and project selection.
// BigQuery access is performed server-side using App-Level Credentials (ADC).

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
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';

export interface GoogleUser {
  uid: string;
  name: string;
  email: string;
  picture: string;
}

export interface AuthState {
  user: GoogleUser | null;
  accessToken: string | null; // kept as null for TopBar compatibility
  projects: string[];
  activeProject: string;
  isLoading: boolean;
  bqAuthorized: boolean;     // always true since backend uses App-Level Credentials
  bqRefreshToken: string | null; // always null since no user token is needed
  signIn: () => void;
  signOut: () => void;
  setActiveProject: (p: string) => void;
  setBqTokenState: (refreshToken: string) => void; // no-op compatibility stub
}

const AuthContext = createContext<AuthState | null>(null);

const DEFAULT_PROJECT = process.env.NEXT_PUBLIC_GOOGLE_PROJECT_ID ?? 'malloy-data';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [activeProject, setActiveProjectState] = useState<string>(DEFAULT_PROJECT);
  const [isLoading, setIsLoading] = useState(true);

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
      setIsLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      setUser({
        uid: result.user.uid,
        name: result.user.displayName ?? '',
        email: result.user.email ?? '',
        picture: result.user.photoURL ?? '',
      });
    } catch (err) {
      console.error('Sign-in error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Sign out ───────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setActiveProjectState(DEFAULT_PROJECT);
  }, []);

  // ── Project switching ──────────────────────────────────────────────────────
  const setActiveProject = useCallback((p: string) => {
    setActiveProjectState(p);
  }, []);

  const setBqTokenState = useCallback((_refreshToken: string) => {
    // No-op compatibility stub
  }, []);

  const projects = [activeProject];

  return (
    <AuthContext.Provider value={{
      user,
      accessToken: null,
      projects,
      activeProject,
      isLoading,
      bqAuthorized: true,
      bqRefreshToken: null,
      signIn,
      signOut,
      setActiveProject,
      setBqTokenState,
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
