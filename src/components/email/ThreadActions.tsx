"use client";

// Thread-level action buttons + Task Shortcuts panel.
// Used in the inbox thread header (compact icon row) and below the composer
// in reply mode (labelled "Task Shortcuts" panel).

import { useState } from "react";
import {
  Star,
  Archive,
  MailOpen,
  Trash2,
  Clock,
  Tags,
  type LucideIcon,
} from "lucide-react";

interface ThreadActionsProps {
  threadId: string;
  starred: boolean;
  archived: boolean;
  unreadCount: number;
  onChange: (
    patch: Partial<{
      starred: boolean;
      archived: boolean;
      read: boolean;
      trashed: boolean;
    }>,
  ) => void;
}

const C = {
  navy: "#0B1C3D",
  coral: "#FF6B4A",
  gray: "#6B7280",
  border: "#E5E7EB",
  star: "#F59E0B",
  bg: "#FAFAFA",
  err: "#EF4444",
};

async function patchThread(
  threadId: string,
  body: { starred?: boolean; archived?: boolean; read?: boolean },
): Promise<void> {
  const res = await fetch(`/xapi/email/threads/${threadId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `HTTP ${res.status}`);
  }
}

async function trashThread(threadId: string): Promise<void> {
  const res = await fetch(`/xapi/email/threads/${threadId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `HTTP ${res.status}`);
  }
}

// Compact icon-button row for the thread header.
export function ThreadHeaderActions({
  threadId,
  starred,
  archived,
  unreadCount,
  onChange,
}: ThreadActionsProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (
    action: string,
    fn: () => Promise<void>,
    optimistic: () => void,
  ) => {
    setError(null);
    setBusy(action);
    optimistic();
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const toggleStar = () =>
    run(
      "star",
      () => patchThread(threadId, { starred: !starred }),
      () => onChange({ starred: !starred }),
    );

  const toggleArchive = () =>
    run(
      "archive",
      () => patchThread(threadId, { archived: !archived }),
      () => onChange({ archived: !archived }),
    );

  const markUnread = () =>
    run(
      "unread",
      () => patchThread(threadId, { read: false }),
      () => onChange({ read: false }),
    );

  const doDelete = () => {
    if (!window.confirm("Move this thread to Trash?")) return;
    return run(
      "delete",
      () => trashThread(threadId),
      () => onChange({ trashed: true }),
    );
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <IconButton
        Icon={Star}
        label={starred ? "Unstar" : "Star"}
        active={starred}
        activeColor={C.star}
        loading={busy === "star"}
        onClick={toggleStar}
      />
      <IconButton
        Icon={Archive}
        label={archived ? "Unarchive" : "Archive"}
        active={archived}
        loading={busy === "archive"}
        onClick={toggleArchive}
      />
      <IconButton
        Icon={MailOpen}
        label="Mark unread"
        loading={busy === "unread"}
        disabled={unreadCount > 0}
        onClick={markUnread}
      />
      <IconButton
        Icon={Trash2}
        label="Delete"
        loading={busy === "delete"}
        danger
        onClick={doDelete}
      />
      {error && (
        <span style={{ fontSize: 11, color: C.err, marginLeft: 8 }}>
          {error}
        </span>
      )}
    </div>
  );
}

// Larger labelled tiles for the "Task Shortcuts" panel.
export function ThreadShortcutsPanel({
  threadId,
  starred,
  archived,
  unreadCount,
  onChange,
}: ThreadActionsProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (
    action: string,
    fn: () => Promise<void>,
    optimistic: () => void,
  ) => {
    setError(null);
    setBusy(action);
    optimistic();
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const items: Array<{
    key: string;
    Icon: LucideIcon;
    label: string;
    onClick?: () => void;
    active?: boolean;
    disabled?: boolean;
    title?: string;
  }> = [
    {
      key: "star",
      Icon: Star,
      label: starred ? "Unstar" : "Star Thread",
      active: starred,
      onClick: () =>
        run(
          "star",
          () => patchThread(threadId, { starred: !starred }),
          () => onChange({ starred: !starred }),
        ),
    },
    {
      key: "archive",
      Icon: Archive,
      label: archived ? "Unarchive" : "Archive",
      active: archived,
      onClick: () =>
        run(
          "archive",
          () => patchThread(threadId, { archived: !archived }),
          () => onChange({ archived: !archived }),
        ),
    },
    {
      key: "unread",
      Icon: MailOpen,
      label: "Mark Unread",
      disabled: unreadCount > 0,
      title: unreadCount > 0 ? "Already unread" : undefined,
      onClick: () =>
        run(
          "unread",
          () => patchThread(threadId, { read: false }),
          () => onChange({ read: false }),
        ),
    },
    {
      key: "snooze",
      Icon: Clock,
      label: "Snooze",
      disabled: true,
      title: "Coming soon",
    },
    {
      key: "labels",
      Icon: Tags,
      label: "Add Labels",
      disabled: true,
      title: "Coming soon",
    },
  ];

  return (
    <section
      style={{
        borderTop: `1px solid ${C.border}`,
        background: "white",
        padding: "12px 28px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: C.gray,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          marginBottom: 8,
        }}
      >
        Task Shortcuts
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {items.map((it) => (
          <ShortcutTile
            key={it.key}
            Icon={it.Icon}
            label={it.label}
            active={!!it.active}
            disabled={!!it.disabled}
            loading={busy === it.key}
            title={it.title}
            onClick={it.onClick}
          />
        ))}
      </div>
      {error && (
        <div style={{ fontSize: 11, color: C.err, marginTop: 8 }}>{error}</div>
      )}
    </section>
  );
}

interface IconButtonProps {
  Icon: LucideIcon;
  label: string;
  onClick?: () => void;
  active?: boolean;
  activeColor?: string;
  loading?: boolean;
  disabled?: boolean;
  danger?: boolean;
}

function IconButton({
  Icon,
  label,
  onClick,
  active,
  activeColor,
  loading,
  disabled,
  danger,
}: IconButtonProps) {
  const color = active
    ? (activeColor ?? C.coral)
    : disabled
      ? "#D1D5DB"
      : danger
        ? C.err
        : C.navy;
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      disabled={disabled || loading}
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        border: `1px solid ${C.border}`,
        background: "white",
        cursor: disabled || loading ? "default" : "pointer",
        color,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        opacity: loading ? 0.5 : 1,
        transition: "background 120ms, color 120ms",
      }}
      onMouseEnter={(e) => {
        if (!disabled && !loading)
          (e.currentTarget as HTMLButtonElement).style.background = "#F6F8FB";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "white";
      }}
    >
      <Icon size={16} strokeWidth={1.8} fill={active ? color : "none"} />
    </button>
  );
}

interface ShortcutTileProps {
  Icon: LucideIcon;
  label: string;
  active: boolean;
  disabled: boolean;
  loading: boolean;
  title?: string;
  onClick?: () => void;
}

function ShortcutTile({
  Icon,
  label,
  active,
  disabled,
  loading,
  title,
  onClick,
}: ShortcutTileProps) {
  const color = active ? C.coral : disabled ? "#D1D5DB" : C.navy;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      aria-label={label}
      disabled={disabled || loading}
      style={{
        minWidth: 88,
        minHeight: 64,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        background: "white",
        color,
        cursor: disabled || loading ? "default" : "pointer",
        padding: "10px 12px",
        fontFamily: "inherit",
        fontSize: 11,
        fontWeight: 600,
        opacity: loading ? 0.55 : 1,
        transition: "background 120ms, transform 120ms, border-color 120ms",
      }}
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.background = "#F6F8FB";
          el.style.borderColor = "#D7DCE3";
        }
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background = "white";
        el.style.borderColor = C.border;
      }}
    >
      <Icon size={20} strokeWidth={1.8} fill={active ? color : "none"} />
      <span style={{ whiteSpace: "nowrap" }}>{label}</span>
    </button>
  );
}
