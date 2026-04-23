"use client";

import React from "react";

interface AreaChartProps {
  series: number[][];
  labels?: string[];
  width?: number;
  height?: number;
  colors?: string[];
  yTicks?: number;
}

export function AreaChart({
  series,
  labels,
  width = 600,
  height = 200,
  colors = ["var(--brand-500)", "var(--info)"],
  yTicks = 4,
}: AreaChartProps): React.ReactElement {
  const all = series.flatMap((s) => s);
  const min = 0;
  const max = Math.max(...all) * 1.1;
  const pad = { l: 36, r: 12, t: 12, b: 24 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  const x = (i: number, n: number) => pad.l + (i / (n - 1)) * W;
  const y = (v: number) => pad.t + H - ((v - min) / (max - min)) * H;

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {/* grid */}
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const yy = pad.t + (i / yTicks) * H;
        const val = max - (i / yTicks) * max;
        return (
          <g key={i}>
            <line
              x1={pad.l}
              x2={width - pad.r}
              y1={yy}
              y2={yy}
              stroke="var(--border)"
              strokeDasharray={i === yTicks ? "" : "2,3"}
            />
            <text
              x={pad.l - 8}
              y={yy + 3}
              fontSize="10"
              fill="var(--fg-subtle)"
              textAnchor="end"
              fontFamily="var(--f-mono)"
            >
              {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)}
            </text>
          </g>
        );
      })}
      {/* x labels */}
      {labels &&
        labels.map((l, i) => (
          <text
            key={i}
            x={x(i, labels.length)}
            y={height - 6}
            fontSize="10"
            fill="var(--fg-subtle)"
            textAnchor="middle"
          >
            {l}
          </text>
        ))}
      {/* series */}
      {series.map((s, si) => {
        const pts = s.map((v, i) => [x(i, s.length), y(v)] as [number, number]);
        const d = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
        const area = `${d} L${pad.l + W},${pad.t + H} L${pad.l},${pad.t + H} Z`;
        const gid = `ag-${si}-${Math.random().toString(36).slice(2, 6)}`;
        return (
          <g key={si}>
            <defs>
              <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={colors[si]} stopOpacity="0.22"/>
                <stop offset="100%" stopColor={colors[si]} stopOpacity="0"/>
              </linearGradient>
            </defs>
            <path d={area} fill={`url(#${gid})`}/>
            <path
              d={d}
              fill="none"
              stroke={colors[si]}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      })}
    </svg>
  );
}
