"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

const C = {
  navy: "#0B1C3D",
  coral: "#FF6B4A",
  gray: "#9CA3AF",
  border: "#E5E7EB",
  err: "#EF4444",
  chipBg: "#EEF2F7",
  chipBgBad: "#FEE2E2",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValid = (e: string) => EMAIL_RE.test(e.trim());

interface Suggestion {
  email: string;
  name?: string;
}

export function RecipientChips({ value, onChange, placeholder, autoFocus }: Props) {
  const sb = useMemo(() => createClient(), []);
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [hoverIdx, setHoverIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Pull recent contacts from email_messages (from_email + to_emails + cc_emails).
  const contactsQ = useQuery({
    queryKey: ["email-contacts"],
    queryFn: async (): Promise<Suggestion[]> => {
      const { data } = await sb
        .from("email_messages")
        .select("from_email, to_emails, cc_emails")
        .order("sent_at", { ascending: false, nullsFirst: false })
        .limit(500);
      const seen = new Map<string, Suggestion>();
      for (const row of (data ?? []) as Array<{
        from_email: string | null;
        to_emails: string[] | null;
        cc_emails: string[] | null;
      }>) {
        const all: string[] = [];
        if (row.from_email) all.push(row.from_email);
        if (row.to_emails) all.push(...row.to_emails);
        if (row.cc_emails) all.push(...row.cc_emails);
        for (const raw of all) {
          const parsed = parseAddress(raw);
          if (!parsed) continue;
          const key = parsed.email.toLowerCase();
          if (!seen.has(key)) seen.set(key, parsed);
        }
      }
      return Array.from(seen.values());
    },
    staleTime: 60_000,
  });

  const matches = useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!q) return [] as Suggestion[];
    const list = contactsQ.data ?? [];
    return list
      .filter((s) => {
        const lc = s.email.toLowerCase();
        if (value.some((v) => v.toLowerCase() === lc)) return false;
        return lc.includes(q) || (s.name ?? "").toLowerCase().includes(q);
      })
      .slice(0, 6);
  }, [input, contactsQ.data, value]);

  useEffect(() => {
    setHoverIdx(0);
  }, [matches.length]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const commit = (raw: string) => {
    const cleaned = raw.trim().replace(/[,;]\s*$/, "");
    if (!cleaned) return;
    const next = [...value, cleaned];
    onChange(dedup(next));
    setInput("");
  };

  const remove = (idx: number) => {
    const next = value.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "Tab" || e.key === "," || e.key === ";") {
      if (matches[hoverIdx]) {
        e.preventDefault();
        commit(matches[hoverIdx].email);
        return;
      }
      if (input.trim()) {
        e.preventDefault();
        commit(input);
      }
      return;
    }
    if (e.key === "Backspace" && !input && value.length) {
      e.preventDefault();
      remove(value.length - 1);
      return;
    }
    if (e.key === "ArrowDown" && matches.length) {
      e.preventDefault();
      setHoverIdx((i) => Math.min(matches.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp" && matches.length) {
      e.preventDefault();
      setHoverIdx((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Escape" && matches.length) {
      e.preventDefault();
      setFocused(false);
      inputRef.current?.blur();
    }
  };

  const onBlur = () => {
    // Commit pending text on blur after small delay (allow click suggestion).
    setTimeout(() => {
      if (input.trim()) commit(input);
      setFocused(false);
    }, 120);
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!text || !/[,;\s\n]/.test(text)) return;
    e.preventDefault();
    const parts = text.split(/[,;\s\n]+/).filter(Boolean);
    onChange(dedup([...value, ...parts]));
    setInput("");
  };

  const showDropdown = focused && matches.length > 0;

  return (
    <div style={{ flex: 1, position: "relative" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          alignItems: "center",
          minHeight: 26,
          padding: "2px 0",
        }}
      >
        {value.map((email, i) => {
          const bad = !isValid(email);
          return (
            <span
              key={`${email}-${i}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: bad ? C.chipBgBad : C.chipBg,
                color: bad ? C.err : C.navy,
                padding: "2px 4px 2px 8px",
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 500,
                lineHeight: 1.4,
                border: bad ? `1px solid ${C.err}` : "1px solid transparent",
              }}
              title={bad ? "Invalid email" : email}
            >
              {email}
              <button
                type="button"
                onClick={() => remove(i)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "inherit",
                  fontSize: 13,
                  lineHeight: 1,
                  padding: "0 2px",
                  borderRadius: 8,
                }}
                aria-label={`Remove ${email}`}
              >
                ×
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={onBlur}
          onKeyDown={onKey}
          onPaste={onPaste}
          placeholder={value.length === 0 ? placeholder : ""}
          style={{
            flex: 1,
            minWidth: 120,
            border: "none",
            outline: "none",
            fontSize: 13,
            padding: "3px 0",
            fontFamily: "inherit",
            background: "transparent",
            color: C.navy,
          }}
        />
      </div>
      {showDropdown && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: -4,
            right: 0,
            marginTop: 4,
            background: "white",
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
            zIndex: 10,
            overflow: "hidden",
          }}
        >
          {matches.map((m, i) => (
            <button
              key={m.email}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                commit(m.email);
              }}
              onMouseEnter={() => setHoverIdx(i)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                width: "100%",
                background: i === hoverIdx ? "#F6F8FB" : "white",
                border: "none",
                padding: "7px 12px",
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "left",
              }}
            >
              {m.name && (
                <span style={{ fontSize: 12.5, fontWeight: 600, color: C.navy }}>{m.name}</span>
              )}
              <span style={{ fontSize: 11.5, color: C.gray }}>{m.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function parseAddress(raw: string): { email: string; name?: string } | null {
  if (!raw) return null;
  const m = raw.match(/^\s*(?:"?([^"<]+?)"?\s*)?<([^>]+)>\s*$/);
  if (m) {
    const email = m[2].trim();
    return isValid(email) ? { email, name: m[1]?.trim() || undefined } : null;
  }
  const trimmed = raw.trim();
  return isValid(trimmed) ? { email: trimmed } : null;
}

function dedup(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of list) {
    const key = e.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(e.trim());
  }
  return out;
}
