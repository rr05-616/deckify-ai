/**
 * Low-level REST client — the one place that knows about `fetch`, the
 * backend's base URL, and the bearer token.
 *
 * Every error is thrown as a plain `Error` whose `.message` is the server's
 * `{ error: "..." }` body, so existing `catch (error) { error.message }` /
 * `toast.error(error instanceof Error ? error.message : ...)` code across
 * the app keeps working unchanged — that's exactly how a thrown Convex
 * mutation error used to surface.
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8787";

const TOKEN_KEY = "deckify_token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // localStorage can throw in locked-down/private-browsing contexts;
    // auth just won't persist across reloads there.
  }
  notifyAuthChange();
}

type AuthListener = () => void;
const authListeners = new Set<AuthListener>();

export function onAuthChange(listener: AuthListener): () => void {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}

function notifyAuthChange(): void {
  for (const listener of authListeners) listener();
}

export async function apiFetch<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Could not reach the server — check your connection and try again.");
  }

  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : null) ?? `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export { BASE_URL };
