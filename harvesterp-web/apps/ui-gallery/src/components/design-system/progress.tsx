"use client";

import React from "react";

interface ProgressProps {
  value: number;
  max?: number;
  color?: string;
  height?: number;
}

export function Progress({
  value,
  max = 100,
  color = "var(--brand-500)",
  height = 6,
}: ProgressProps): React.ReactElement {
  return (
    <div
      style={{
        background: "var(--border)",
        borderRadius: 999,
        height,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${Math.min(100, (value / max) * 100)}%`,
          background: color,
          height: "100%",
          borderRadius: 999,
        }}
      />
    </div>
  );
}
