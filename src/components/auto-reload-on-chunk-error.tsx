"use client";

import { useEffect } from "react";

// On a fresh deploy, browsers holding old HTML reference chunk hashes that
// no longer exist on disk. Lazy chunks then fail with ChunkLoadError. Catch
// that and force a hard reload so the user lands on the new build with no
// manual refresh required.
//
// Single-shot per session via sessionStorage so we don't infinite-loop if
// the error is genuine (e.g. CDN actually missing files).

const RELOAD_KEY = "cnx:chunk-error-reloaded";

export function AutoReloadOnChunkError() {
  useEffect(() => {
    function isChunkError(message: string | undefined): boolean {
      if (!message) return false;
      return (
        message.includes("ChunkLoadError") ||
        message.includes("Loading chunk") ||
        message.includes("Loading CSS chunk") ||
        message.includes("failed to fetch dynamically imported")
      );
    }

    function maybeReload(reason: string) {
      if (typeof window === "undefined") return;
      try {
        if (sessionStorage.getItem(RELOAD_KEY)) return;
        sessionStorage.setItem(RELOAD_KEY, "1");
        // eslint-disable-next-line no-console
        console.warn("[auto-reload] Detected stale build:", reason);
        window.location.reload();
      } catch {
        // private mode / quota — best effort
        window.location.reload();
      }
    }

    function onError(e: ErrorEvent) {
      if (isChunkError(e.message) || isChunkError(e.error?.message)) {
        maybeReload(e.message || "ErrorEvent");
      }
    }

    function onUnhandledRejection(e: PromiseRejectionEvent) {
      const msg =
        typeof e.reason === "string"
          ? e.reason
          : e.reason?.message || e.reason?.toString();
      if (isChunkError(msg)) {
        maybeReload(msg || "PromiseRejection");
      }
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
