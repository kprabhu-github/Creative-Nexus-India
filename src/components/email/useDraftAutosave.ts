"use client";

import { useEffect, useRef, useState } from "react";

// Draft autosave hook. Persists composer state to localStorage so a closed
// window or crashed tab does not lose work. Keyed by stable identifier
// (account + thread + context) so reopening the same reply restores its draft.

interface DraftState {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  savedAt: number;
}

const STORAGE_PREFIX = "cnx-email-draft:";
const DEBOUNCE_MS = 1200;

export function buildDraftKey(parts: {
  accountId?: string;
  threadId?: string;
  contextType?: string;
  contextId?: string;
}): string {
  return `${STORAGE_PREFIX}${parts.accountId ?? "_"}|${parts.threadId ?? "_"}|${parts.contextType ?? "_"}|${parts.contextId ?? "_"}`;
}

export function loadDraft(key: string): DraftState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as DraftState;
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

interface UseAutosaveArgs {
  key: string;
  enabled: boolean;
  state: Omit<DraftState, "savedAt">;
}

export function useDraftAutosave({ key, enabled, state }: UseAutosaveArgs): {
  savedAt: number | null;
} {
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");

  useEffect(() => {
    if (!enabled) return;
    const isEmpty =
      state.to.length === 0 &&
      state.cc.length === 0 &&
      state.bcc.length === 0 &&
      !state.subject.trim() &&
      !plainText(state.body).trim();

    if (isEmpty) return; // never persist empty drafts (avoids clobbering on first mount)

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const payload: DraftState = { ...state, savedAt: Date.now() };
      const serialized = JSON.stringify(payload);
      if (serialized === lastSavedRef.current) return;
      try {
        window.localStorage.setItem(key, serialized);
        lastSavedRef.current = serialized;
        setSavedAt(payload.savedAt);
      } catch {
        // localStorage may be full or disabled — silent failure is acceptable.
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, key, state]);

  return { savedAt };
}

function plainText(html: string): string {
  if (typeof window === "undefined") return html.replace(/<[^>]*>/g, "");
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent ?? "";
}
