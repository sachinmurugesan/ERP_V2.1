"use client";

import React from "react";

interface DonutSlice {
  value: number;
  color: string;
}

interface DonutProps {
  data: DonutSlice[];
  size?: number;
  stroke?: number;
  cap?: string | number;
}

export function Donut({
  data,
  size = 140,
  stroke = 18,
  cap = "",
}: DonutProps): React.ReactElement {
  const total = data.reduce((a, b) => a + b.value, 0);
  const R = (size - stroke) / 2;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <svg width={size} height={size}>
      <g transform={`translate(${size / 2},${size / 2}) rotate(-90)`}>
        <circle r={R} fill="none" stroke="var(--border)" strokeWidth={stroke}/>
        {data.map((d, i) => {
          const frac = d.value / total;
          const seg = C * frac;
          const off = -C * (acc / total);
          acc += d.value;
          return (
            <circle
              key={i}
              r={R}
              fill="none"
              stroke={d.color}
              strokeWidth={stroke}
              strokeDasharray={`${seg} ${C - seg}`}
              strokeDashoffset={off}
              strokeLinecap="butt"
            />
          );
        })}
      </g>
      <text
        x={size / 2}
        y={size / 2 - 4}
        textAnchor="middle"
        fontSize="20"
        fontWeight="700"
        fill="var(--fg)"
        fontFamily="var(--f-sans)"
      >
        {cap || total}
      </text>
      <text
        x={size / 2}
        y={size / 2 + 12}
        textAnchor="middle"
        fontSize="10"
        fill="var(--fg-muted)"
      >
        Total
      </text>
    </svg>
  );
}
