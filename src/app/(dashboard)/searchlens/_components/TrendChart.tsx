"use client";

// Pure-SVG line chart used by the Overview tab to show how share-of-voice
// and sentiment have moved across the last N scans. No chart lib — keeps the
// /searchlens bundle lean. Designed for a dark canvas (parent supplies bg).

import { useEffect, useRef, useState } from "react";

interface TrendPoint { x: string; y: number }
interface TrendSeries { name: string; color: string; data: TrendPoint[] }
interface TrendChartProps {
  series: TrendSeries[];
  height?: number;
  yMax?: number;
  className?: string;
}
interface HoverState { seriesIdx: number; pointIdx: number }

const PADDING = { top: 12, right: 16, bottom: 28, left: 32 };
const FALLBACK_WIDTH = 600;
const GRIDLINE_COUNT = 5;

export function TrendChart({
  series,
  height = 200,
  yMax = 100,
  className,
}: TrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(FALLBACK_WIDTH);
  const [hover, setHover] = useState<HoverState | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;
    const el = containerRef.current;
    const update = () => setWidth(el.clientWidth || FALLBACK_WIDTH);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const maxLen = series.reduce((m, s) => Math.max(m, s.data.length), 0);

  if (maxLen === 0) {
    return (
      <div className={className}>
        <div className="text-[12px] text-foreground-tertiary py-8 text-center">
          No trend data yet — run scans over multiple days to see trends.
        </div>
      </div>
    );
  }

  const innerW = Math.max(0, width - PADDING.left - PADDING.right);
  const innerH = Math.max(0, height - PADDING.top - PADDING.bottom);
  const stepX = maxLen > 1 ? innerW / (maxLen - 1) : 0;
  const yToPx = (y: number) =>
    PADDING.top + innerH - (Math.max(0, Math.min(yMax, y)) / yMax) * innerH;
  const xToPx = (i: number) =>
    maxLen === 1 ? PADDING.left + innerW / 2 : PADDING.left + i * stepX;

  const xLabels: string[] =
    series.find((s) => s.data.length === maxLen)?.data.map((p) => p.x) ?? [];
  const xTickStep = Math.max(1, Math.ceil(maxLen / 6));

  return (
    <div ref={containerRef} className={className}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Trend chart"
        className="block"
      >
        {/* Gridlines */}
        {Array.from({ length: GRIDLINE_COUNT + 1 }).map((_, i) => {
          const y = PADDING.top + (innerH * i) / GRIDLINE_COUNT;
          const value = Math.round(yMax - (yMax * i) / GRIDLINE_COUNT);
          return (
            <g key={`grid-${i}`}>
              <line
                x1={PADDING.left}
                x2={PADDING.left + innerW}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
              <text
                x={PADDING.left - 6}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                fill="rgba(255,255,255,0.4)"
              >
                {value}
              </text>
            </g>
          );
        })}

        {/* X-axis labels */}
        {xLabels.map((label, i) =>
          i % xTickStep === 0 || i === maxLen - 1 ? (
            <text
              key={`xl-${i}`}
              x={xToPx(i)}
              y={height - PADDING.bottom + 14}
              textAnchor="middle"
              fontSize={10}
              fill="rgba(255,255,255,0.4)"
            >
              {label}
            </text>
          ) : null,
        )}

        {/* Series polylines + dots */}
        {series.map((s, sIdx) => {
          if (s.data.length === 0) return null;
          const pts = s.data.map((p, i) => `${xToPx(i)},${yToPx(p.y)}`).join(" ");
          return (
            <g key={`s-${sIdx}`}>
              {s.data.length > 1 && (
                <polyline
                  points={pts}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {s.data.map((p, i) => (
                <circle
                  key={`d-${sIdx}-${i}`}
                  cx={xToPx(i)}
                  cy={yToPx(p.y)}
                  r={hover && hover.seriesIdx === sIdx && hover.pointIdx === i ? 4.5 : 3}
                  fill={s.color}
                  stroke="rgba(0,0,0,0.6)"
                  strokeWidth={1}
                  onMouseEnter={() => setHover({ seriesIdx: sIdx, pointIdx: i })}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: "pointer" }}
                />
              ))}
            </g>
          );
        })}

        {/* Tooltip */}
        {hover && series[hover.seriesIdx]?.data[hover.pointIdx] && (() => {
          const s = series[hover.seriesIdx];
          const p = s.data[hover.pointIdx];
          const cx = xToPx(hover.pointIdx);
          const cy = yToPx(p.y);
          const text = `${s.name}: ${p.y} (${p.x})`;
          const tw = Math.min(220, text.length * 6 + 16);
          const tx = Math.max(PADDING.left, Math.min(cx - tw / 2, width - tw - 4));
          const ty = Math.max(PADDING.top, cy - 28);
          return (
            <g pointerEvents="none">
              <rect x={tx} y={ty} width={tw} height={20} rx={4} fill="rgba(10,22,40,0.95)" stroke={s.color} strokeWidth={1} />
              <text x={tx + tw / 2} y={ty + 14} textAnchor="middle" fontSize={11} fill="#fff">
                {text}
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 px-1">
        {series.map((s, i) => (
          <div key={`lg-${i}`} className="flex items-center gap-1.5 text-[11px] text-foreground-tertiary">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: s.color }}
              aria-hidden="true"
            />
            <span>{s.name}</span>
          </div>
        ))}
      </div>

      {maxLen === 1 && (
        <div className="mt-1 text-[11px] text-foreground-tertiary text-center">
          Run more scans to build trend.
        </div>
      )}
    </div>
  );
}
