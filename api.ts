/**
 * Hand-authored replacement for `@/convex/_generated/api`.
 *
 * Convex generates `api.<module>.<function>` as an opaque reference that
 * `useQuery`/`useMutation`/`useAction` know how to call. This object has the
 * same shape, but each leaf is a small descriptor telling our REST shim
 * (`./react.tsx`) which HTTP request to make — so every page's
 * `useQuery(api.decks.listDecks)` / `useMutation(api.decks.createDeck)` call
 * keeps working with only the import line changed.
 *
 * `tags` drive cache invalidation: a mutation that touches "decks" causes
 * every currently-mounted `useQuery` tagged "decks" to refetch, approximating
 * Convex's automatic reactivity without a subscription protocol.
 */

export interface QueryDescriptor<Args = void, Result = unknown> {
  kind: "query";
  tags: string[];
  resolve: (args: Args) => { method: "GET"; url: string };
  __result?: Result;
}

export interface MutationDescriptor<Args = void, Result = unknown> {
  kind: "mutation" | "action";
  tags: string[];
  resolve: (args: Args) => { method: "POST" | "PATCH" | "DELETE"; url: string; body?: unknown };
  __result?: Result;
}

function query<Args = void, Result = unknown>(
  tags: string[],
  resolve: (args: Args) => { method: "GET"; url: string },
): QueryDescriptor<Args, Result> {
  return { kind: "query", tags, resolve };
}

function mutation<Args = void, Result = unknown>(
  tags: string[],
  resolve: (args: Args) => { method: "POST" | "PATCH" | "DELETE"; url: string; body?: unknown },
): MutationDescriptor<Args, Result> {
  return { kind: "mutation", tags, resolve };
}

const q = encodeURIComponent;

export const api = {
  // Not used directly by any page — `useAuth()` in src/hooks/use-auth.ts talks
  // to /api/auth/me itself so it can manage global auth state precisely.
  // Kept here only so `api.users.currentUser` still resolves if referenced.
  users: {
    currentUser: query<void, unknown>(["users"], () => ({ method: "GET", url: "/api/auth/me" })),
  },

  decks: {
    createDeck: mutation<Record<string, unknown>, { projectId: string; deckId: string }>(
      ["decks", "projects"],
      (args) => ({ method: "POST", url: "/api/decks", body: args }),
    ),
    deleteDeck: mutation<{ deckId: string }, { ok: true }>(["decks", "projects"], (args) => ({
      method: "DELETE",
      url: `/api/decks/${q(args.deckId)}`,
    })),
    listDecks: query<void, unknown[]>(["decks"], () => ({ method: "GET", url: "/api/decks" })),
    getDeck: query<{ deckId: string }, unknown>(["decks"], (args) => ({
      method: "GET",
      url: `/api/decks/${q(args.deckId)}`,
    })),
    getDeckByShareCode: query<{ shareCode: string }, unknown>(["decks"], (args) => ({
      method: "GET",
      url: `/api/decks/share/${q(args.shareCode)}`,
    })),
    setDeckTemplate: mutation<{ deckId: string; template: string }, string>(["decks"], (args) => ({
      method: "PATCH",
      url: `/api/decks/${q(args.deckId)}/template`,
      body: { template: args.template },
    })),
    publishDeck: mutation<{ deckId: string; published: boolean }, boolean>(["decks"], (args) => ({
      method: "PATCH",
      url: `/api/decks/${q(args.deckId)}/publish`,
      body: { published: args.published },
    })),
    listPublishedDecks: query<{ query?: string }, unknown[]>(["decks"], (args) => ({
      method: "GET",
      url: `/api/decks/catalog${args?.query ? `?query=${q(args.query)}` : ""}`,
    })),
    listProjects: query<void, unknown[]>(["projects"], () => ({
      method: "GET",
      url: "/api/decks/projects/mine",
    })),
    deleteProject: mutation<{ projectId: string }, { ok: true }>(["projects", "decks"], (args) => ({
      method: "DELETE",
      url: `/api/decks/projects/${q(args.projectId)}`,
    })),
  },

  payments: {
    getX402Config: query<void, unknown>(["payments"], () => ({
      method: "GET",
      url: "/api/payments/config",
    })),
    requestX402Authorization: mutation<
      { walletAddress: string; deckId?: string; memo?: string },
      unknown
    >(["payments"], (args) => ({ method: "POST", url: "/api/payments/authorize", body: args })),
    requestFounderPayment: mutation<{ walletAddress: string }, unknown>(["payments"], (args) => ({
      method: "POST",
      url: "/api/payments/founder/authorize",
      body: args,
    })),
    verifyX402Payment: mutation<{ paymentId: string; txHash: string }, unknown>(
      ["payments", "users", "billing"],
      (args) => ({ method: "POST", url: "/api/payments/verify", body: args }),
    ),
    recordX402Unlock: mutation<Record<string, unknown>, unknown>(
      ["payments", "decks"],
      (args) => ({ method: "POST", url: "/api/payments/record-unlock", body: args }),
    ),
    listPayments: query<void, unknown[]>(["payments"], () => ({
      method: "GET",
      url: "/api/payments",
    })),
    isDeckUnlocked: query<{ deckId: string }, { unlocked: boolean; verified: unknown[] }>(
      ["payments"],
      (args) => ({ method: "GET", url: `/api/payments/deck/${q(args.deckId)}/unlocked` }),
    ),
  },

  nfts: {
    recordMint: mutation<Record<string, unknown>, unknown>(["nfts"], (args) => ({
      method: "POST",
      url: "/api/nfts",
      body: args,
    })),
    getNftForDeck: query<{ deckId: string }, unknown>(["nfts"], (args) => ({
      method: "GET",
      url: `/api/nfts/deck/${q(args.deckId)}`,
    })),
    listMyNfts: query<void, unknown[]>(["nfts"], () => ({ method: "GET", url: "/api/nfts/mine" })),
  },

  comments: {
    listComments: query<{ deckId: string }, unknown[]>(["comments"], (args) => ({
      method: "GET",
      url: `/api/comments/deck/${q(args.deckId)}`,
    })),
    addComment: mutation<{ deckId: string; body: string }, string>(["comments"], (args) => ({
      method: "POST",
      url: `/api/comments/deck/${q(args.deckId)}`,
      body: { body: args.body },
    })),
    deleteComment: mutation<{ commentId: string }, { ok: true }>(["comments"], (args) => ({
      method: "DELETE",
      url: `/api/comments/${q(args.commentId)}`,
    })),
  },

  admin: {
    adminListUsers: query<void, unknown[]>(["admin-users"], () => ({
      method: "GET",
      url: "/api/admin/users",
    })),
    adminSetUser: mutation<{ userId: string; role?: string; plan?: string }, { ok: true }>(
      ["admin-users"],
      (args) => ({
        method: "PATCH",
        url: `/api/admin/users/${q(args.userId)}`,
        body: { role: args.role, plan: args.plan },
      }),
    ),
    adminListDecks: query<void, unknown[]>(["admin-decks"], () => ({
      method: "GET",
      url: "/api/admin/decks",
    })),
    adminDeleteDeck: mutation<{ deckId: string }, { ok: true }>(
      ["admin-decks", "decks"],
      (args) => ({ method: "DELETE", url: `/api/admin/decks/${q(args.deckId)}` }),
    ),
    adminListComments: query<void, unknown[]>(["admin-comments"], () => ({
      method: "GET",
      url: "/api/admin/comments",
    })),
    adminDeleteComment: mutation<{ commentId: string }, { ok: true }>(
      ["admin-comments", "comments"],
      (args) => ({ method: "DELETE", url: `/api/admin/comments/${q(args.commentId)}` }),
    ),
  },

  settings: {
    getSettings: query<void, unknown>(["settings"], () => ({ method: "GET", url: "/api/settings" })),
    updateProfile: mutation<{ name?: string; image?: string; bio?: string }, { ok: true }>(
      ["settings", "users"],
      (args) => ({ method: "PATCH", url: "/api/settings/profile", body: args }),
    ),
    saveWalletAddress: mutation<{ walletAddress: string }, { ok: true }>(
      ["settings", "users"],
      (args) => ({ method: "PATCH", url: "/api/settings/wallet", body: args }),
    ),
  },

  billing: {
    getBilling: query<void, unknown>(["billing"], () => ({ method: "GET", url: "/api/billing" })),
  },

  github: {
    fetchGithubRepo: mutation<{ url: string }, { content: string; source: string; notice: string }>(
      [],
      (args) => ({ method: "POST", url: "/api/github/fetch", body: args }),
    ),
  },
};
