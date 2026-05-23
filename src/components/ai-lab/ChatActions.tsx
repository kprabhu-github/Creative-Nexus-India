"use client";

// Chat-level (whole conversation) action bar. Lives next to "+ New Chat" in
// the agent header. Mirrors per-message MessageActions visually but operates
// on the entire transcript.

import { useEffect, useRef, useState } from "react";
import {
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Share2,
  RefreshCw,
  MoreHorizontal,
  MessageCircle,
  Mail,
  Link2,
  Download,
  Trash2,
  Pencil,
  FileText,
} from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface Props {
  messages: ChatMessage[];
  agentName: string;
  onRegenerate: () => void;
  onClear: () => void;
  onRename?: () => void;
  disabled?: boolean;
}

export function ChatActions({
  messages,
  agentName,
  onRegenerate,
  onClear,
  onRename,
  disabled,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const shareRef = useRef<HTMLDivElement | null>(null);
  const moreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (shareOpen && shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareOpen(false);
      }
      if (moreOpen && moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [shareOpen, moreOpen]);

  const transcript = (): string =>
    messages
      .map(
        (m) =>
          `**${m.role === "user" ? "You" : agentName}** _(${new Date(m.timestamp).toLocaleString()})_:\n\n${m.content}`,
      )
      .join("\n\n---\n\n");

  const copyAll = async () => {
    const text = transcript();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const shareTo = (
    channel: "whatsapp" | "email" | "twitter" | "link" | "download",
  ) => {
    const text = transcript();
    const subject = `Conversation with ${agentName} — Creative Nexus AI Lab`;
    const enc = encodeURIComponent;
    switch (channel) {
      case "whatsapp":
        window.open(`https://wa.me/?text=${enc(text)}`, "_blank", "noopener");
        break;
      case "email":
        window.location.href = `mailto:?subject=${enc(subject)}&body=${enc(text)}`;
        break;
      case "twitter": {
        const snippet = text.slice(0, 270);
        window.open(
          `https://twitter.com/intent/tweet?text=${enc(snippet)}`,
          "_blank",
          "noopener",
        );
        break;
      }
      case "link":
        void navigator.clipboard?.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
        break;
      case "download": {
        const blob = new Blob([text], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${agentName.toLowerCase().replace(/\s+/g, "-")}-chat-${Date.now()}.md`;
        a.click();
        URL.revokeObjectURL(url);
        break;
      }
    }
    setShareOpen(false);
  };

  const empty = messages.length === 0;
  const btn =
    "h-8 w-8 inline-flex items-center justify-center rounded-md text-foreground-tertiary hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed";

  return (
    <div className="flex items-center gap-0 select-none">
      <button
        type="button"
        onClick={copyAll}
        disabled={empty || disabled}
        className={btn}
        title={copied ? "Copied!" : "Copy conversation"}
        aria-label="Copy whole conversation"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={2.2} />
        ) : (
          <Copy className="w-3.5 h-3.5" strokeWidth={1.8} />
        )}
      </button>
      <button
        type="button"
        onClick={() => setFeedback("up")}
        disabled={empty || disabled}
        className={btn}
        title="Good conversation"
        aria-label="Mark conversation helpful"
        aria-pressed={feedback === "up"}
      >
        <ThumbsUp
          className="w-3.5 h-3.5"
          strokeWidth={1.8}
          fill={feedback === "up" ? "currentColor" : "none"}
        />
      </button>
      <button
        type="button"
        onClick={() => setFeedback("down")}
        disabled={empty || disabled}
        className={btn}
        title="Bad conversation"
        aria-label="Mark conversation not helpful"
        aria-pressed={feedback === "down"}
      >
        <ThumbsDown
          className="w-3.5 h-3.5"
          strokeWidth={1.8}
          fill={feedback === "down" ? "currentColor" : "none"}
        />
      </button>

      <div className="relative" ref={shareRef}>
        <button
          type="button"
          onClick={() => setShareOpen((o) => !o)}
          disabled={empty || disabled}
          className={btn}
          title="Share conversation"
          aria-label="Share whole conversation"
          aria-haspopup="menu"
          aria-expanded={shareOpen}
        >
          <Share2 className="w-3.5 h-3.5" strokeWidth={1.8} />
        </button>
        {shareOpen && (
          <div
            role="menu"
            className="absolute z-30 right-0 mt-1 min-w-[200px] rounded-lg border border-divider bg-background shadow-lg py-1 text-[12.5px]"
          >
            <ShareItem
              Icon={MessageCircle}
              label="WhatsApp"
              onClick={() => shareTo("whatsapp")}
              accent="#25D366"
            />
            <ShareItem
              Icon={Mail}
              label="Email"
              onClick={() => shareTo("email")}
            />
            <ShareItem
              Icon={XLogo}
              label="X / Twitter"
              onClick={() => shareTo("twitter")}
            />
            <ShareItem
              Icon={Link2}
              label="Copy page link"
              onClick={() => shareTo("link")}
            />
            <ShareItem
              Icon={Download}
              label="Download transcript .md"
              onClick={() => shareTo("download")}
            />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onRegenerate}
        disabled={empty || disabled}
        className={btn}
        title="Regenerate last response"
        aria-label="Regenerate last response"
      >
        <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.8} />
      </button>

      <div className="relative" ref={moreRef}>
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          className={btn}
          title="More"
          aria-label="More actions"
          aria-haspopup="menu"
          aria-expanded={moreOpen}
        >
          <MoreHorizontal className="w-4 h-4" strokeWidth={1.8} />
        </button>
        {moreOpen && (
          <div
            role="menu"
            className="absolute z-30 right-0 mt-1 min-w-[200px] rounded-lg border border-divider bg-background shadow-lg py-1 text-[12.5px]"
          >
            {onRename && (
              <ShareItem
                Icon={Pencil}
                label="Rename chat"
                onClick={() => {
                  setMoreOpen(false);
                  onRename();
                }}
              />
            )}
            <ShareItem
              Icon={FileText}
              label="Export transcript .md"
              onClick={() => {
                setMoreOpen(false);
                shareTo("download");
              }}
            />
            <ShareItem
              Icon={Trash2}
              label="Clear chat"
              onClick={() => {
                setMoreOpen(false);
                if (window.confirm("Clear this conversation? This cannot be undone.")) {
                  onClear();
                }
              }}
              accent="#EF4444"
            />
          </div>
        )}
      </div>
    </div>
  );
}

type IconLike = React.ComponentType<{
  className?: string;
  strokeWidth?: number | string;
  style?: React.CSSProperties;
}>;

interface ShareItemProps {
  Icon: IconLike;
  label: string;
  onClick: () => void;
  accent?: string;
}

function ShareItem({ Icon, label, onClick, accent }: ShareItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="menuitem"
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-foreground/5 transition-colors"
    >
      <Icon
        className="w-3.5 h-3.5"
        strokeWidth={1.8}
        style={accent ? { color: accent } : undefined}
      />
      <span>{label}</span>
    </button>
  );
}

function XLogo({
  className,
  strokeWidth,
}: {
  className?: string;
  strokeWidth?: number | string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? 1.8}
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
