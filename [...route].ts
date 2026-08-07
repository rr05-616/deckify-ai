/**
 * Vercel entrypoint for the Deckify AI backend.
 *
 * The `[...route]` filename is a catch-all: every request to /api/* is
 * handed to this one function, and Hono does the real routing from there.
 *
 * The existing app already registers full paths ("/api/auth", "/api/decks",
 * ...), so it is mounted at the root here rather than under a basePath.
 *
 * The wrapper app exists purely to run db.reload() before the handler and
 * db.flush() after it. Middleware in Hono only wraps routes registered after
 * it, so this cannot be added inside server/index.ts without reordering that
 * file — mounting the finished app inside a fresh one is the clean way.
 */

import { Hono } from "hono";
import { handle } from "hono/vercel";

import app from "../server/index.js";
import { flush, reload } from "../server/lib/db.js";

const vercelApp = new Hono();

vercelApp.use("*", async (_c, next) => {
  await reload();
  try {
    await next();
  } finally {
    // Flush even when a handler throws — a partial write is still a write,
    // and HttpError responses (402 payment required, etc.) often follow a
    // legitimate mutation.
    await flush();
  }
});

vercelApp.route("/", app);

export default handle(vercelApp);
