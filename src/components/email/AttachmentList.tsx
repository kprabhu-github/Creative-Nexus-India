"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";

export interface UploadedAttachment {
  name: string;
  mime: string;
  size: number;
  storage_path: string;
}

export interface AttachmentListHandle {
  openPicker: () => void;
}

interface PendingItem {
  id: string;
  name: string;
  size: number;
  progress: "uploading" | "error";
  error?: string;
}

interface Props {
  attachments: UploadedAttachment[];
  onChange: (next: UploadedAttachment[]) => void;
}

const C = {
  navy: "#0B1C3D",
  coral: "#FF6B4A",
  gray: "#9CA3AF",
  border: "#E5E7EB",
  err: "#EF4444",
  ok: "#10B981",
};

const TOTAL_CAP = 25 * 1024 * 1024;
const PER_FILE_CAP = 20 * 1024 * 1024;

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const AttachmentList = forwardRef<AttachmentListHandle, Props>(
  function AttachmentList({ attachments, onChange }, ref) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [pending, setPending] = useState<PendingItem[]>([]);
    const [dragOver, setDragOver] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      openPicker: () => inputRef.current?.click(),
    }));

    const currentTotal = attachments.reduce((s, a) => s + a.size, 0);

    const upload = async (files: FileList | File[]) => {
      setError(null);
      const list = Array.from(files);
      let runningTotal = currentTotal;

      for (const file of list) {
        if (file.size > PER_FILE_CAP) {
          setError(`${file.name}: exceeds 20MB per-file limit`);
          continue;
        }
        if (runningTotal + file.size > TOTAL_CAP) {
          setError(`Adding ${file.name} would exceed 25MB total cap`);
          break;
        }
        runningTotal += file.size;

        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setPending((p) => [
          ...p,
          { id, name: file.name, size: file.size, progress: "uploading" },
        ]);

        const fd = new FormData();
        fd.append("file", file);
        try {
          const res = await fetch("/xapi/email/attachments/upload", {
            method: "POST",
            body: fd,
          });
          const json = (await res.json().catch(() => ({}))) as {
            data?: UploadedAttachment;
            error?: string;
          };
          if (!res.ok || !json.data) {
            throw new Error(json.error ?? `HTTP ${res.status}`);
          }
          const uploaded = json.data;
          onChange([...attachments, uploaded]);
          setPending((p) => p.filter((x) => x.id !== id));
        } catch (err) {
          setPending((p) =>
            p.map((x) =>
              x.id === id
                ? { ...x, progress: "error", error: (err as Error).message }
                : x,
            ),
          );
        }
      }
    };

    const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) void upload(e.target.files);
      e.target.value = ""; // allow re-picking same file
    };

    const onDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files?.length) void upload(e.dataTransfer.files);
    };

    const removeAttachment = (path: string) => {
      onChange(attachments.filter((a) => a.storage_path !== path));
    };

    const removePending = (id: string) => {
      setPending((p) => p.filter((x) => x.id !== id));
    };

    const hasAny = attachments.length > 0 || pending.length > 0;

    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        style={{
          padding: hasAny || dragOver ? "8px 16px" : 0,
          borderBottom: hasAny || dragOver ? `1px solid ${C.border}` : "none",
          background: dragOver ? "#FEF3F2" : "transparent",
          transition: "background 120ms",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={onPick}
          style={{ display: "none" }}
        />
        {dragOver && (
          <div
            style={{
              fontSize: 12,
              color: C.coral,
              fontWeight: 700,
              textAlign: "center",
              padding: 6,
            }}
          >
            Drop files to attach
          </div>
        )}

        {hasAny && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {attachments.map((a) => (
              <Pill
                key={a.storage_path}
                name={a.name}
                size={fmtSize(a.size)}
                tone="done"
                onRemove={() => removeAttachment(a.storage_path)}
              />
            ))}
            {pending.map((p) => (
              <Pill
                key={p.id}
                name={p.name}
                size={
                  p.progress === "error" ? p.error ?? "error" : fmtSize(p.size)
                }
                tone={p.progress}
                onRemove={() => removePending(p.id)}
              />
            ))}
          </div>
        )}

        {error && (
          <div style={{ fontSize: 11, color: C.err, marginTop: 6 }}>{error}</div>
        )}
      </div>
    );
  },
);

interface PillProps {
  name: string;
  size: string;
  tone: "uploading" | "done" | "error";
  onRemove: () => void;
}

function Pill({ name, size, tone, onRemove }: PillProps) {
  const bg =
    tone === "error" ? "#FEE2E2" : tone === "uploading" ? "#F3F4F6" : "#EEF2F7";
  const fg = tone === "error" ? C.err : C.navy;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: bg,
        color: fg,
        padding: "4px 6px 4px 10px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 500,
        maxWidth: 280,
      }}
      title={`${name} · ${size}`}
    >
      <span
        style={{
          display: "inline-block",
          width: 6,
          height: 6,
          borderRadius: 6,
          background:
            tone === "error" ? C.err : tone === "uploading" ? C.gray : C.ok,
        }}
      />
      <span
        style={{
          maxWidth: 180,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </span>
      <span style={{ fontSize: 10.5, color: C.gray }}>{size}</span>
      <button
        type="button"
        onClick={onRemove}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "inherit",
          fontSize: 13,
          lineHeight: 1,
          padding: "0 2px",
        }}
        aria-label={`Remove ${name}`}
      >
        ×
      </button>
    </span>
  );
}
