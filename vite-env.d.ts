/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Deckify AI backend (defaults to http://localhost:8787). */
  readonly VITE_API_BASE_URL?: string;
  /** Base URL of the live x402 payment server (defaults to http://localhost:4021). */
  readonly VITE_X402_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
