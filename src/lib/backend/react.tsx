/**
 * Drop-in replacement for `convex/react`'s `useQuery` / `useMutation` /
 * `useAction`, backed by plain REST calls instead of Convex's subscription
 * protocol.
 *
 * Call-site behavior is preserved:
 *   - `useQuery(descriptor, args?)` returns `undefined` while loading, then
 *     the resolved value (or `null` if the server returned null) — same as
 *     Convex, so `decks === undefined` loading checks across the app still
 *     work.
 *   - `useMutation(descriptor)` returns an async function; on success it
 *     invalidates every currently-mounted query that shares a tag, which is
 *     what stands in for Convex's automatic reactivity (e.g. creating a
 *     deck refreshes any mounted `listDecks` query without a manual refetch
 *     call at the call site).
 *   - `useAction(descriptor)` is mechanically identical to `useMutation`
 *     here — the query/mutation/action split only matters to Convex's
 *     transaction semantics, not to a REST backend.
 *
 * `args === "skip"` is supported for parity with Convex even though nothing
 * in this app currently uses it.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "./client";
import type { MutationDescriptor, QueryDescriptor } from "./api";

type Skip = "skip";

const tagListeners = new Map<string, Set<() => void>>();

function subscribe(tags: string[], listener: () => void): () => void {
  for (const tag of tags) {
    if (!tagListeners.has(tag)) tagListeners.set(tag, new Set());
    tagListeners.get(tag)!.add(listener);
  }
  return () => {
    for (const tag of tags) tagListeners.get(tag)?.delete(listener);
  };
}

function invalidate(tags: string[]): void {
  const seen = new Set<() => void>();
  for (const tag of tags) {
    for (const listener of tagListeners.get(tag) ?? []) {
      if (!seen.has(listener)) {
        seen.add(listener);
        listener();
      }
    }
  }
}

/** Stable key for "did the args change" without requiring callers to memoize. */
function argsKey(args: unknown): string {
  if (args === "skip") return "skip";
  try {
    return JSON.stringify(args ?? null);
  } catch {
    return String(args);
  }
}

export function useQuery<Args, Result>(
  descriptor: QueryDescriptor<Args, Result>,
  args?: Args | Skip,
): Result | undefined {
  const [state, setState] = useState<{ key: string; value: Result | undefined }>({
    key: "",
    value: undefined,
  });
  const argsRef = useRef(args);
  argsRef.current = args;

  const key = argsKey(args);

  const fetchNow = useCallback(async () => {
    if (argsRef.current === "skip") return;
    try {
      const { method, url } = descriptor.resolve(argsRef.current as Args);
      const result = await apiFetch<Result>(method, url);
      setState({ key: argsKey(argsRef.current), value: result });
    } catch (error) {
      console.error("[useQuery] request failed:", error);
      setState({ key: argsKey(argsRef.current), value: undefined });
    }
  }, [descriptor]);

  useEffect(() => {
    if (args === "skip") {
      setState({ key: "skip", value: undefined });
      return;
    }
    setState((prev) => (prev.key === key ? prev : { key: "", value: undefined }));
    fetchNow();
    return subscribe(descriptor.tags, fetchNow);
    // `key` (derived from args) and `fetchNow` (derived from descriptor) are
    // the only two things a re-fetch should depend on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fetchNow]);

  return state.key === key || (args === "skip" && state.key === "skip") ? state.value : undefined;
}

export function useMutation<Args, Result>(
  descriptor: MutationDescriptor<Args, Result>,
): (args: Args) => Promise<Result> {
  return useCallback(
    async (args: Args) => {
      const { method, url, body } = descriptor.resolve(args);
      const result = await apiFetch<Result>(method, url, body);
      invalidate(descriptor.tags);
      return result;
    },
    [descriptor],
  );
}

export const useAction = useMutation;
