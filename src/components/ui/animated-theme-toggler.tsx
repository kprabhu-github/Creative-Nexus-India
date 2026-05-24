"use client";

// Sun ↔ moon morph theme toggle. Center circle swells into a moon body,
// a mask carves the crescent, rays shrink and rotate away. Spring physics
// throughout, optional soft click sound.
//
// Wires to next-themes so the project's existing ThemeProvider stays the
// single source of truth (no fighting class manipulation).

import { useEffect, useId, useRef, useState } from "react";
import { motion } from "motion/react";
import { useTheme } from "next-themes";

export interface AnimatedThemeTogglerProps {
  sound?: boolean;
  className?: string;
}

// ── Audio (lazy WebAudio synth — tiny click on toggle) ────────────────────

let _ctx: AudioContext | null = null;
let _buf: AudioBuffer | null = null;

function audioCtx() {
  if (!_ctx) {
    _ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)();
  }
  if (_ctx.state === "suspended") void _ctx.resume();
  return _ctx;
}

function ensureBuf(ac: AudioContext): AudioBuffer {
  if (_buf && _buf.sampleRate === ac.sampleRate) return _buf;
  const rate = ac.sampleRate;
  const len = Math.floor(rate * 0.006);
  const buf = ac.createBuffer(1, len, rate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / len;
    const sine = Math.sin(2 * Math.PI * 3400 * t);
    const noise = Math.random() * 2 - 1;
    ch[i] = (sine * 0.6 + noise * 0.4) * (1 - t) ** 3;
  }
  _buf = buf;
  return buf;
}

function tick(last: React.MutableRefObject<number>) {
  const now = performance.now();
  if (now - last.current < 80) return;
  last.current = now;
  try {
    const ac = audioCtx();
    const buf = ensureBuf(ac);
    const src = ac.createBufferSource();
    const gain = ac.createGain();
    src.buffer = buf;
    gain.gain.value = 0.08;
    src.connect(gain);
    gain.connect(ac.destination);
    src.start();
  } catch {
    // ignore — audio is optional, e.g. blocked autoplay context
  }
}

// ── Component ─────────────────────────────────────────────────────────────

export function AnimatedThemeToggler({
  sound = true,
  className,
}: AnimatedThemeTogglerProps) {
  const rawId = useId();
  const maskId = `att${rawId.replace(/:/g, "")}`;
  const lastSnd = useRef(0);
  const isFirst = useRef(true);
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    requestAnimationFrame(() => {
      isFirst.current = false;
    });
  }, []);

  // Render a placeholder of identical footprint during SSR / pre-hydration
  // to avoid a layout shift and a hydration mismatch on icon orientation.
  if (!mounted) {
    return (
      <span
        className={className}
        style={{
          display: "inline-flex",
          width: 32,
          height: 32,
          borderRadius: 8,
        }}
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  const toggle = () => {
    setTheme(isDark ? "light" : "dark");
    if (sound) tick(lastSnd);
  };

  const spring = isFirst.current
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 380, damping: 30 };

  return (
    <>
      <style>{`
        .att-btn{--at-ink:rgba(0,0,0,0.82)}
        .dark .att-btn,[data-theme="dark"] .att-btn{--at-ink:rgba(255,255,255,0.82)}
      `}</style>
      <motion.button
        type="button"
        className={`att-btn ${className ?? ""}`}
        onClick={toggle}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.86 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--at-ink)",
          borderRadius: 8,
          outline: "none",
          WebkitTapHighlightColor: "transparent",
        }}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        aria-pressed={isDark}
      >
        <motion.svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          initial={false}
          animate={{ rotate: isDark ? 270 : 0 }}
          transition={spring}
          style={{ overflow: "visible" }}
          aria-hidden="true"
        >
          <mask id={maskId}>
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <motion.circle
              initial={false}
              animate={{ cx: isDark ? 17 : 33, cy: isDark ? 8 : 0 }}
              transition={spring}
              r="9"
              fill="black"
            />
          </mask>

          <motion.circle
            cx="12"
            cy="12"
            fill="currentColor"
            stroke="none"
            mask={`url(#${maskId})`}
            initial={false}
            animate={{ r: isDark ? 9 : 5 }}
            transition={spring}
          />

          <motion.g
            initial={false}
            animate={{
              opacity: isDark ? 0 : 1,
              scale: isDark ? 0 : 1,
              rotate: isDark ? -30 : 0,
            }}
            transition={spring}
            style={{ transformOrigin: "12px 12px" }}
          >
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="5.64" y1="5.64" x2="4.22" y2="4.22" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            <line x1="5.64" y1="18.36" x2="4.22" y2="19.78" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          </motion.g>
        </motion.svg>
      </motion.button>
    </>
  );
}

export default AnimatedThemeToggler;
