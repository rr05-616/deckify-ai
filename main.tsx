import "@fontsource-variable/geist";
import "@fontsource-variable/inter";
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import React, { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Projects = lazy(() => import("./pages/Projects.tsx"));
const Decks = lazy(() => import("./pages/Decks.tsx"));
const DeckView = lazy(() => import("./pages/DeckView.tsx"));
const ShareView = lazy(() => import("./pages/ShareView.tsx"));
const Catalog = lazy(() => import("./pages/Catalog.tsx"));
const Wallet = lazy(() => import("./pages/Wallet.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const TemplatesPage = lazy(() =>
  import("./pages/Placeholder.tsx").then((m) => ({ default: m.TemplatesPage })),
);
const AnalyticsPage = lazy(() =>
  import("./pages/Placeholder.tsx").then((m) => ({ default: m.AnalyticsPage })),
);
const SettingsPage = lazy(() => import("./pages/Settings.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// Branded loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[oklch(0.13_0.01_170)]">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div className="h-12 w-12 animate-spin rounded-2xl border-2 border-emerald-400/30 border-t-emerald-400" />
          <div className="absolute inset-0 grid place-items-center">
            <span className="h-3 w-3 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 shadow-[0_0_14px_rgba(0,168,107,0.8)]" />
          </div>
        </div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
          PitchForge AI
        </p>
      </div>
    </div>
  );
}

/** Hard guard so runtime errors render a message instead of a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[Deckify] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Something went wrong</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route
              path="/auth"
              element={<AuthPage redirectAfterAuth="/dashboard" />}
            />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/projects"
              element={
                <RequireAuth>
                  <Projects />
                </RequireAuth>
              }
            />
            <Route
              path="/decks"
              element={
                <RequireAuth>
                  <Decks />
                </RequireAuth>
              }
            />
            <Route
              path="/deck/:id"
              element={
                <RequireAuth>
                  <DeckView />
                </RequireAuth>
              }
            />
            <Route path="/d/:shareCode" element={<ShareView />} />
            <Route path="/catalog" element={<Catalog />} />
            <Route
              path="/templates"
              element={
                <RequireAuth>
                  <TemplatesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/analytics"
              element={
                <RequireAuth>
                  <AnalyticsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/wallet"
              element={
                <RequireAuth>
                  <Wallet />
                </RequireAuth>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <Admin />
                </RequireAuth>
              }
            />
            <Route
              path="/settings"
              element={
                <RequireAuth>
                  <SettingsPage />
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster theme="dark" richColors position="bottom-right" />
    </RootErrorBoundary>
  </StrictMode>,
);
