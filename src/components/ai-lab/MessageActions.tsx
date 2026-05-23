"use client";

// Per-message action bar for assistant messages: Copy · Share · Regenerate · 👍 👎.
// Share opens a small menu with WhatsApp, Email, X/Twitter, Copy link, Download .md.

import { useEffect, useRef, useState } from "react";
import {
  Copy,
  Check,
  Share2,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Mail,
  Link2,
  Download,
} from "lucide-react";

interface Props {
  content: string;
  agentName: string;
  onRegenerate?: () => void;
  onFeedback?: (rating: "up" | "down") => void;
}

export function MessageActions({
  content,
  agentName,
  onRegenerate,
  onFeedback,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const shareRef = useRef<HTMLDivElement | null>(null);

  // Close the share menu when clicking outside.
  useEffect(() => {
    if (!shareOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [shareOpen]);

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // older browsers / non-secure context — best-effort fallback
      const ta = document.createElement("textarea");
      ta.value = content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  const shareTo = (channel: "whatsapp" | "email" | "twitter" | "link" | "download") => {
    const text = content;
    const subject = `From ${agentName} (Creative Nexus AI Lab)`;
    const enc = encodeURIComponent;

    switch (channel) {
      case "whatsapp":
        window.open(`https://wa.me/?text=${enc(text)}`, "_blank", "noopener");
        break;
      case "email":
        window.location.href = `mailto:?subject=${enc(subject)}&body=${enc(text)}`;
        break;
      case "twitter":
        window.open(
          `https://twitter.com/intent/tweet?text=${enc(text.slice(0, 270))}`,
          "_blank",
          "noopener",
        );
        break;
      case "link":
        void navigator.clipboard?.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
        break;
      case "download": {
        const blob = new Blob([content], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${agentName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.md`;
        a.click();
        URL.revokeObjectURL(url);
        break;
      }
    }
    setShareOpen(false);
  };

  const giveFeedback = (rating: "up" | "down") => {
    setFeedback(rating);
    onFeedback?.(rating);
  };

  const btn =
    "h-7 w-7 inline-flex items-center justify-center rounded-md text-foreground-tertiary hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-50";

  return (
    <div className="mt-1.5 flex items-center gap-0.5 select-none">
      <button
        type="button"
        onClick={doCopy}
        className={btn}
        title={copied ? "Copied!" : "Copy message"}
        aria-label="Copy message"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={2.2} />
        ) : (
          <Copy className="w-3.5 h-3.5" strokeWidth={1.8} />
        )}
      </button>

      <div className="relative" ref={shareRef}>
        <button
          type="button"
          onClick={() => setShareOpen((o) => !o)}
          className={btn}
          title="Share"
          aria-label="Share message"
          aria-haspopup="menu"
          aria-expanded={shareOpen}
        >
          <Share2 className="w-3.5 h-3.5" strokeWidth={1.8} />
        </button>
        {shareOpen && (
          <div
            role="menu"
            className="absolute z-20 left-0 mt-1 min-w-[180px] rounded-lg border border-divider bg-background shadow-lg py-1 text-[12.5px]"
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
              label="Download .md"
              onClick={() => shareTo("download")}
            />
          </div>
        )}
      </div>

      {onRegenerate && (
        <button
          type="button"
          onClick={onRegenerate}
          className={btn}
          title="Regenerate"
          aria-label="Regenerate response"
        >
          <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.8} />
        </button>
      )}

      <span className="mx-1 h-3.5 w-px bg-divider" />

      <button
        type="button"
        onClick={() => giveFeedback("up")}
        className={btn}
        title="Helpful"
        aria-label="Mark as helpful"
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
        onClick={() => giveFeedback("down")}
        className={btn}
        title="Not helpful"
        aria-label="Mark as not helpful"
        aria-pressed={feedback === "down"}
      >
        <ThumbsDown
          className="w-3.5 h-3.5"
          strokeWidth={1.8}
          fill={feedback === "down" ? "currentColor" : "none"}
        />
      </button>
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

// Inline X (Twitter) glyph because lucide-react no longer ships the Twitter
// bird icon under that export name.
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
