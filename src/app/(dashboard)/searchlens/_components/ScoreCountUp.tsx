"use client";

import { useEffect, useRef, useState } from "react";

interface ScoreCountUpProps {
  target: number;
  suffix?: string;
  className?: string;
}

/**
 * Animates a numeric value from 0 to `target` over ~1.2s using rAF.
 * Re-runs whenever `target` changes. Output is rounded to integer.
 */
export function ScoreCountUp({ target, suffix = "", className }: ScoreCountUpProps) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const duration = 1200;
    const start = performance.now();
    const from = 0;
    const to = Number.isFinite(target) ? target : 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target]);

  return <span className={className}>{value}{suffix}</span>;
}
