# Deckify AI (PitchForge AI)

Turn a GitHub repo or README into an investor-ready pitch deck, with premium
generation gated behind a real Algorand x402 payment.

## Overview

Tech stack:
- Vite + React 19 + TypeScript
- React Router v7 (`react-router`, not `react-router-dom`)
- Tailwind v4 + shadcn/ui + Lucide icons
- Framer Motion
- **Backend: a small Node/Hono server (`server/`)** — see "Migrating from
  Convex" below if you're familiar with the previous version of this project
- **Payments: `x402-demo-server/`** (Hono) — a separate, independent x402
  payment gateway on Algorand, unchanged by the backend migration

All frontend code lives in `src/`.

## Architecture — three backend layers

Two are ours (the app server + the x402 server); one is external (Algorand).

```
┌──────────────────────────── FRONTEND (React + Vite) ───────────────────────────┐
│  Dashboard · DeckView (pitch editor + premium gate) · Wallet · Settings · Admin │
└───────┬──────────────────────────────┬─────────────────────────────────────────┘
        │ auth, decks, ingestion        │ payment gate (X402Gate)
        ▼                               ▼
┌────────────────────────┐   ┌────────────────────────────────────────────┐
│ APP SERVER (server/)   │   │ x402-demo-server/ (payment gateway)        │
│ Hono + TS · port 8787  │   │ Hono + TS · port 4021 · Docker/Fly.io      │
│                        │   │                                            │
│ • auth (email OTP,     │   │ POST /generate-deck   $1.00 USDC           │
│   guest, Google/GitHub)│   │ GET  /weather         $0.005 USDC          │
│ • decks (CRUD, share)  │   │ POST /ai-analysis     $0.001 USDC          │
│ • github repo ingest   │   │ ... (endpoints.config.ts)                  │
│ • payments (ALGO       │   │  402 → USDC quote (receiver, ASA, amount)  │
│   wallet-connect path) │   │  Payment-Signature → on-chain verify       │
│ • settings / comments  │   └───────────────┬────────────────────────────┘
│ • admin / nfts         │                   │ indexer lookups (AlgoNode)
│ • JSON file storage    │                   ▼
│   (server/data/db.json)│    ┌──────────────────────────────┐
└────────────┬───────────┘    │ ALGORAND (settlement layer)  │
             │                │ • TestNet/MainNet USDC (ASA) │
             │                │ • AlgoNode API + indexer     │
             │                │ • Pera / Defly wallet signs  │
             │                └──────────────────────────────┘
             ▼
┌───────────────────────────────────────────────────────────────────────┐
│  EXTERNAL: GitHub API (repo metadata + README via /api/github/fetch)  │
└───────────────────────────────────────────────────────────────────────┘
```

### Who owns what

| Concern | Owner | Where |
| ------- | ----- | ----- |
| Auth + user data + decks | App server | `server/routes/`, data in `server/data/db.json` |
| GitHub ingestion (README, repo scan, branch detection) | App server | `server/lib/github.ts` |
| USDC payment quotes + on-chain verification | x402 server | `x402-demo-server/` |
| Unlock persistence (deck premium state) | App server | `server/routes/payments.ts` → `/record-unlock` |
| Founder-plan / single-deck ALGO payment + verification | App server | `server/routes/payments.ts`, `server/lib/algorand.ts` |
| Transaction settlement + confirmation | Algorand | TestNet/MainNet via AlgoNode indexer |

### Payment flow (end to end) — USDC per-generation path

```
User clicks "Premium deck" in DeckView (X402Gate)
  → wallet connects (Pera / Defly)
  → POST {x402-server}/generate-deck            (no payment header)
  → 402 + USDC quote: { amountUsd, receiver, assetId, algodUrl }
  → wallet signs & submits USDC asset transfer (payUsdcWithWallet)
  → POST /generate-deck with Payment-Signature: {"txId": "..."}
  → server verifies on-chain (indexer: confirmed, receiver, ASA, amount)
  → 200 + generation receipt
  → POST /api/payments/record-unlock (app server) → deck is premium, exports unlocked
```

There is a second, independent ALGO-denominated payment path (Wallet →
Founder upgrade, and the per-deck unlock dialog) that connects a wallet,
authorizes a payment with the app server, submits it on-chain, then asks the
app server to verify it against the AlgoNode indexer. See
`server/routes/payments.ts`.

### Environment variables (aligned across backends)

The app server and the x402 server must agree on **who receives payments**.
Point both at the same wallet.

| Purpose | App server (`server/.env`) | x402 server (`.env` / Fly secrets) |
| ------- | --------------------------- | ----------------------------------- |
| Network | `ALGORAND_NETWORK` (`testnet`/`mainnet`) | `AVM_NETWORK` |
| Receiver wallet | `ALGORAND_RECEIVER_ADDRESS` | `AVM_ADDRESS` |
| Algod API (optional) | `ALGORAND_ALGOD_URL` | (derived from network) |
| Indexer (optional) | `ALGORAND_INDEXER_URL` | `AVM_INDEXER_URL` |
| Deck price (USDC) | — | `DECK_PRICE_USD` |
| Verification mode | — (always indexer) | `X402_VERIFY` (`indexer`/`demo`) |
| Payment server URL for the gate | `VITE_X402_SERVER_URL` (frontend `.env`) | — |

> If the receiver address is left unset, both servers fall back to a shared
> demo testnet address. Set your own funded wallet before taking real payments.

## Running everything locally

Three processes, three terminals:

```bash
# 1. Frontend
npm install   # or: bun install
cp .env.example .env   # defaults already point at localhost:8787 / :4021
npm run dev             # → http://localhost:5173

# 2. App server (replaces Convex)
cd server
npm install
cp .env.example .env    # set SESSION_SECRET at minimum
npm run dev              # → http://localhost:8787

# 3. x402 payment server (unchanged)
cd x402-demo-server
cp .env.example .env    # AVM_ADDRESS=YOUR_ALGORAND_ADDRESS
npm install && npm run dev     # → http://localhost:4021
```

Full deployment instructions for the x402 server (Docker, Fly.io, Render)
live in [`x402-demo-server/README.md`](x402-demo-server/README.md). The app
server (`server/`) is a plain Node/Hono app — deploy it anywhere that runs
`npm start` (Fly.io, Render, a VPS, etc.) and give it a writable disk for
`server/data/db.json`.

## Auth

Auth is handled entirely by the app server (`server/routes/auth.ts`) via
bearer tokens (stored in `localStorage`), not cookies — no CORS/cookie
configuration needed regardless of where each piece is deployed.

Three sign-in methods, matching the existing `/auth` page exactly:

- **Email OTP** — a 6-digit code, valid 15 minutes. No email provider is
  wired in by default: the code is logged to the server console and, outside
  `NODE_ENV=production`, echoed back to the browser console too, so the flow
  is fully testable without SMTP. Wire a real provider in
  `server/routes/auth.ts::sendOtpEmail` before deploying somewhere the
  console isn't visible to the user.
- **Guest** — instant anonymous account, no email required.
- **Google / GitHub OAuth** — real, standard authorization-code flow, active
  as soon as you set `GOOGLE_CLIENT_ID`/`SECRET` or
  `GITHUB_CLIENT_ID`/`SECRET` in `server/.env`. Left unset, the existing
  "isn't configured yet" toast on the Auth page fires exactly as before —
  nothing crashes either way.

Use the hook, same as before:

```typescript
import { useAuth } from "@/hooks/use-auth";

const { isLoading, isAuthenticated, user, signIn, signOut } = useAuth();
```

`RequireAuth` still guards protected routes and redirects signed-out users to
`/auth?returnTo=<current route>`.

## Migrating from Convex

This project originally ran on Convex + Convex Auth (and some
platform-specific scaffolding from the app builder it was created on). Both
have been fully replaced; the UI, routes, and page components are unchanged.

**What replaced what:**

| Before | After |
| ------ | ----- |
| `src/convex/` (schema + Convex functions) | `server/` — a Hono + Node REST API |
| Convex's document DB | `server/data/db.json` (auto-generated; every record still carries `_id` / `_creationTime` so page code needed zero changes) |
| `@convex-dev/auth` (email OTP, anonymous, Google/GitHub) | `server/routes/auth.ts` — hand-rolled signed session tokens, zero new npm dependencies |
| `convex/react`'s `useQuery` / `useMutation` / `useAction` | `src/lib/backend/react.tsx` — a drop-in shim with the same call signature, backed by `fetch` |
| `@/convex/_generated/api` | `src/lib/backend/api.ts` — hand-authored descriptors mapping each function to a REST endpoint |
| `@/convex/_generated/dataModel`'s `Id<T>` | `src/lib/backend/types.ts` |
| `vly-toolbar-readonly.tsx`, `src/instrumentation.tsx`, root `main.ts` (Deno), `sst-env.d.ts`, `src/lib/vly-integrations.ts`, `integrations.md` | Deleted — these were dev-sandbox/platform scaffolding (element picker, error-reporting-to-platform, Deno static server) with no product behavior |
| Stripe checkout (`src/convex/billing.ts`) | Not ported — it was never called from any page. The app's only real upgrade path is the Algorand Founder payment, which already grants the Pro plan on verification. |

**Known limitations of the replacement backend**, by design given its scope:

- `server/data/db.json` is a single JSON file — fine for a demo or small
  deployment, not a concurrent-write-heavy production database. Swap
  `server/lib/db.ts` for a real database without touching any route file's
  logic if you outgrow it.
- Email OTP has no email provider wired by default (see "Auth" above).
- No admin UI for rotating `SESSION_SECRET` or revoking a single token —
  tokens are stateless and expire after 30 days.

This backend was written and syntax-validated (via the TypeScript compiler's
parser) without network access to run `npm install`, so `npm install` +
`npm run dev` in both `server/` and the frontend is the first thing to try,
and the place to look first if something doesn't compile.
