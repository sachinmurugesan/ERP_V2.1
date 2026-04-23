"use client";

import React from "react";

interface BarGroup {
  label: string;
  values: number[];
}

interface BarChartProps {
  data: BarGroup[];
  width?: number;
  height?: number;
  colors?: string[];
}

export function BarChart({
  data,
  width = 600,
  height = 180,
  colors = ["var(--brand-500)"],
}: BarChartProps): React.ReactElement {
  const all = data.flatMap((d) => d.values);
  const max = Math.max(...all) * 1.1;
  const pad = { l: 36, r: 12, t: 12, b: 24 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  const groupW = W / data.length;
  const barW = Math.min(18, (groupW - 8) / data[0].values.length);
  return (
    <svg width={width} height={height}>
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
        <line
          key={i}
          x1={pad.l}
          x2={width - pad.r}
          y1={pad.t + f * H}
          y2={pad.t + f * H}
          stroke="var(--border)"
          strokeDasharray={f === 1 ? "" : "2,3"}
        />
      ))}
      {data.map((g, gi) => (
        <g
          key={gi}
          transform={`translate(${pad.l + gi * groupW + (groupW - barW * g.values.length - 4) / 2},0)`}
        >
          {g.values.map((v, vi) => {
            const h = (v / max) * H;
            return (
              <rect
                key={vi}
                x={vi * (barW + 2)}
                y={pad.t + H - h}
                width={barW}
                height={h}
                rx="3"
                fill={colors[vi % colors.length]}
              />
            );
          })}
          <text
            x={(barW * g.values.length) / 2}
            y={height - 6}
            fontSize="10"
            fill="var(--fg-subtle)"
            textAnchor="middle"
          >
            {g.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
