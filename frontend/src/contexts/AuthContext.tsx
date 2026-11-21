import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  BASIC_MODULES,
  daysLeft,
  type ModuleKey,
  type Plan,
} from '../lib/plan';
import { api, ApiError, unwrap } from '../services/api';
import type { ApiResult } from '../types';

/**
 * Auth, trial and plan state backed by the ClinicCash API.
 * The session token lives in localStorage under TOKEN_KEY; the user profile is
 * fetched from GET /auth/me on load.
 */

export type AuthStatus = 'trialing' | 'pro' | 'expired' | 'signed-out';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  trialEndsAt: string;
  plan: Plan | null;
}

interface AuthPayload {
  token: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  trialDaysLeft: number;
  status: AuthStatus;
  hasFullAccess: boolean;
  canAccess: (module: ModuleKey) => boolean;
  signUp: (input: { name: string; email: string; password: string }) => Promise<void>;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  startSubscription: (plan: Plan) => Promise<void>;
  signOut: () => Promise<void>;
}

/* ---------- Google Identity Services (GIS) typings ---------- */

interface GoogleCredentialResponse {
  credential: string;
  select_by?: string;
}

interface GooglePromptNotification {
  isNotDisplayed(): boolean;
  isSkippedMoment(): boolean;
  isDismissedMoment(): boolean;
  getNotDisplayedReason(): string;
}

interface GoogleIdentityId {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    cancel_on_tap_outside?: boolean;
  }): void;
  prompt(listener?: (notification: GooglePromptNotification) => void): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentityId } };
  }
}

const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const TOKEN_KEY = 'cliniccash.token';
// Keys written by the previous local-storage prototype; removed on load.
const LEGACY_AUTH_KEY = 'cliniccash.auth';
const LEGACY_USERS_KEY = 'cliniccash.users';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

function writeStoredToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

function authHeaders(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

let gsiScriptPromise: Promise<void> | null = null;

/** Loads the GIS client script once and resolves when `google.accounts.id` exists. */
function loadGoogleScript(): Promise<void> {
  if (typeof window !== 'undefined' && window.google?.accounts?.id) {
    return Promise.resolve();
  }
  if (!gsiScriptPromise) {
    gsiScriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GSI_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        gsiScriptPromise = null;
        reject(new Error('Could not load Google sign-in. Check your connection and try again.'));
      };
      document.head.appendChild(script);
    });
  }
  return gsiScriptPromise;
}

/** Opens the Google One Tap prompt and resolves with the ID token credential. */
function requestGoogleCredential(clientId: string): Promise<string> {
  return loadGoogleScript().then(
    () =>
      new Promise<string>((resolve, reject) => {
        const identity = window.google?.accounts.id;
        if (!identity) {
          reject(new Error('Google sign-in could not start. Please try again.'));
          return;
        }
        identity.initialize({
          client_id: clientId,
          cancel_on_tap_outside: false,
          callback: (response) => {
            if (response.credential) {
              resolve(response.credential);
            } else {
              reject(new Error('Google did not return a sign-in credential. Please try again.'));
            }
          },
        });
        identity.prompt((notification) => {
          if (notification.isNotDisplayed()) {
            reject(
              new Error(
                `Google sign-in was blocked (${notification.getNotDisplayedReason()}). Allow Google sign-in for this site and try again.`,
              ),
            );
          } else if (notification.isSkippedMoment() || notification.isDismissedMoment()) {
            reject(new Error('Google sign-in was closed. Please try again.'));
          }
        });
      }),
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  // Hold rendering until a stored token has been checked against /auth/me,
  // so guarded routes do not redirect to sign-in during a page refresh.
  const [ready, setReady] = useState<boolean>(() => readStoredToken() === null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(LEGACY_AUTH_KEY);
      window.localStorage.removeItem(LEGACY_USERS_KEY);
    }

    const stored = readStoredToken();
    if (!stored) return;

    let cancelled = false;
    unwrap(api.get<ApiResult<AuthUser>>('/auth/me', { headers: authHeaders(stored) }))
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          writeStoredToken(null);
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const trialDaysLeft = user ? daysLeft(user.trialEndsAt) : 0;

  let status: AuthStatus = 'signed-out';
  if (user) {
    if (user.plan === 'pro') status = 'pro';
    else if (trialDaysLeft > 0) status = 'trialing';
    else status = 'expired';
  }

  const hasFullAccess = status === 'trialing' || status === 'pro';

  const canAccess = (module: ModuleKey): boolean =>
    hasFullAccess || (BASIC_MODULES as readonly ModuleKey[]).includes(module);

  const persistSession = (payload: AuthPayload) => {
    writeStoredToken(payload.token);
    setUser(payload.user);
  };

  const signUp: AuthContextValue['signUp'] = async ({ name, email, password }) => {
    const payload = await unwrap(
      api.post<ApiResult<AuthPayload>>('/auth/signup', {
        name: name.trim(),
        email: normalizeEmail(email),
        password,
      }),
    );
    persistSession(payload);
  };

  const signIn: AuthContextValue['signIn'] = async ({ email, password }) => {
    const payload = await unwrap(
      api.post<ApiResult<AuthPayload>>('/auth/signin', {
        email: normalizeEmail(email),
        password,
      }),
    );
    persistSession(payload);
  };

  const signInWithGoogle: AuthContextValue['signInWithGoogle'] = async () => {
    const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
    if (!clientId) {
      throw new Error('Google sign-in is not configured. Add VITE_GOOGLE_CLIENT_ID to frontend/.env.');
    }
    const credential = await requestGoogleCredential(clientId);
    const payload = await unwrap(
      api.post<ApiResult<AuthPayload>>('/auth/google', { credential }),
    );
    persistSession(payload);
  };

  const startSubscription: AuthContextValue['startSubscription'] = async (plan) => {
    const token = readStoredToken();
    if (!token) {
      throw new Error('Sign in before choosing a plan.');
    }
    const updated = await unwrap(
      api.post<ApiResult<AuthUser>>('/auth/plan', { plan }, { headers: authHeaders(token) }),
    );
    setUser(updated);
  };

  const signOut: AuthContextValue['signOut'] = async () => {
    const token = readStoredToken();
    try {
      if (token) {
        await api.post<ApiResult<null>>('/auth/logout', null, { headers: authHeaders(token) });
      }
    } catch {
      // The local session is cleared even if the server call fails.
    } finally {
      writeStoredToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        trialDaysLeft,
        status,
        hasFullAccess,
        canAccess,
        signUp,
        signIn,
        signInWithGoogle,
        startSubscription,
        signOut,
      }}
    >
      {ready ? children : null}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
