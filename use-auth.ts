/**
 * Replaces `useConvexAuth()` + `useQuery(api.users.currentUser)` +
 * `useAuthActions()` with one hook backed by the new REST backend.
 *
 * Auth state lives in a module-level store (not React context) so every
 * component calling `useAuth()` re-renders on sign-in/sign-out without a
 * provider wrapping the app — `main.tsx` no longer needs a
 * `<ConvexAuthProvider>` at all.
 */

import { useCallback, useEffect, useState } from "react";
import { apiFetch, getToken, onAuthChange, setToken } from "@/lib/backend/client";
import type { AuthUser } from "@/lib/backend/types";

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
}

let state: AuthState = { isLoading: true, isAuthenticated: false, user: null };
const listeners = new Set<(state: AuthState) => void>();
let initialized = false;
let inFlight: Promise<void> | null = null;

function setState(next: Partial<AuthState>): void {
  state = { ...state, ...next };
  for (const listener of listeners) listener(state);
}

async function refreshUser(): Promise<void> {
  if (!getToken()) {
    setState({ isLoading: false, isAuthenticated: false, user: null });
    return;
  }
  try {
    const { user } = await apiFetch<{ user: AuthUser | null }>("GET", "/api/auth/me");
    setState({ isLoading: false, isAuthenticated: Boolean(user), user });
  } catch {
    // An expired/invalid token — treat as signed out rather than surfacing
    // an error the user has no way to act on.
    setToken(null);
    setState({ isLoading: false, isAuthenticated: false, user: null });
  }
}

function ensureInitialized(): void {
  if (initialized) return;
  initialized = true;

  // Google/GitHub OAuth callbacks land back on the app with ?token=... —
  // pick it up once, store it, and scrub it from the visible URL.
  const url = new URL(window.location.href);
  const tokenFromRedirect = url.searchParams.get("token");
  if (tokenFromRedirect) {
    setToken(tokenFromRedirect);
    url.searchParams.delete("token");
    window.history.replaceState({}, "", url.toString());
  }

  onAuthChange(() => {
    inFlight = refreshUser();
  });
  inFlight = refreshUser();
}

async function emailOtp(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const code = formData.get("code") ? String(formData.get("code")) : undefined;

  const result = await apiFetch<{ ok: true; token?: string; devCode?: string }>(
    "POST",
    "/api/auth/email-otp",
    { email, code },
  );

  if (result.devCode) {
    console.info(`[dev] Verification code for ${email}: ${result.devCode}`);
  }
  if (result.token) {
    setToken(result.token);
    await refreshUser();
  }
}

async function guest(): Promise<void> {
  const result = await apiFetch<{ token: string }>("POST", "/api/auth/guest");
  setToken(result.token);
  await refreshUser();
}

async function oauth(provider: "google" | "github", redirectTo: string): Promise<void> {
  const { configured } = await apiFetch<{ configured: boolean }>(
    "GET",
    `/api/auth/oauth/${provider}/status`,
  );
  if (!configured) {
    const label = provider === "google" ? "Google" : "GitHub";
    throw new Error(
      `${label} sign-in isn't configured yet. Add ${
        provider === "google" ? "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET" : "GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET"
      } to the backend's .env, then try again. Email login works right now.`,
    );
  }
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8787";
  window.location.href = `${base}/api/auth/oauth/${provider}/start?redirectTo=${encodeURIComponent(redirectTo)}`;
}

/**
 * Matches the original `signIn` call sites exactly:
 *   signIn("email-otp", formData)
 *   signIn("anonymous")
 *   signIn("google" | "github", { redirectTo })
 */
async function signIn(
  provider: "email-otp" | "anonymous" | "google" | "github",
  arg?: FormData | { redirectTo?: string },
): Promise<void> {
  if (provider === "email-otp") {
    return emailOtp(arg as FormData);
  }
  if (provider === "anonymous") {
    return guest();
  }
  const redirectTo = (arg as { redirectTo?: string } | undefined)?.redirectTo ?? "/dashboard";
  return oauth(provider, redirectTo);
}

async function signOut(): Promise<void> {
  try {
    await apiFetch("POST", "/api/auth/logout");
  } catch {
    // Token may already be invalid/expired — signing out locally still
    // succeeds either way.
  }
  setToken(null);
  setState({ isLoading: false, isAuthenticated: false, user: null });
}

export function useAuth() {
  const [local, setLocal] = useState(state);

  useEffect(() => {
    ensureInitialized();
    listeners.add(setLocal);
    setLocal(state);
    return () => {
      listeners.delete(setLocal);
    };
  }, []);

  const stableSignIn = useCallback(signIn, []);
  const stableSignOut = useCallback(signOut, []);

  return {
    isLoading: local.isLoading,
    isAuthenticated: local.isAuthenticated,
    user: local.user,
    signIn: stableSignIn,
    signOut: stableSignOut,
  };
}

// Exposed for main.tsx to await the very first auth check before the first
// render of a route guard, avoiding a flash of the signed-out state.
export function authReadyPromise(): Promise<void> {
  ensureInitialized();
  return inFlight ?? Promise.resolve();
}
