"use client";

// TODO Task 7: Replace with real HarvestERP brand logo

import React from "react";

interface HarvestERPLogoProps {
  size?: number;
  color?: string;
}

export function HarvestERPLogo({ size = 28, color = "var(--brand-800)" }: HarvestERPLogoProps): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill={color}/>
      {/* Geometric "H" mark */}
      <path
        d="M8 22V10h2.5v4.75h7V10H20v12h-2.5v-4.75h-7V22H8z"
        fill="#fff"
      />
      <circle cx="23" cy="10" r="2" fill="var(--brand-400)"/>
    </svg>
  );
}
