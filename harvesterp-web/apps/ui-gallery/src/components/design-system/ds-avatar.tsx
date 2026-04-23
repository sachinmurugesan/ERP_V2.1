"use client";

import React from "react";
import {
  getInitials,
  getAvatarHexColor,
  getAvatarClass,
  getAvatarGradient,
} from "@harvesterp/lib";

interface DSAvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  /** variant controls how the background is determined */
  variant?: "gradient" | "hash" | "role";
  /** role required when variant="role" */
  role?: string;
  /** override color (CSS color string) */
  color?: string;
}

export function DSAvatar({
  name,
  size = "md",
  variant = "gradient",
  role,
  color,
}: DSAvatarProps): React.ReactElement {
  const initials = getInitials(name);

  const sizeClass =
    size === "sm" ? "av av-sm" : size === "lg" ? "av av-lg" : "av";

  if (color) {
    return (
      <span className={sizeClass} style={{ background: color }}>
        {initials}
      </span>
    );
  }

  if (variant === "role") {
    const { bg, text } = getAvatarClass(role ?? "");
    return (
      <span className={`${sizeClass} ${bg} ${text}`}>
        {initials}
      </span>
    );
  }

  if (variant === "hash") {
    const hexColor = getAvatarHexColor(name);
    return (
      <span className={sizeClass} style={{ background: hexColor }}>
        {initials}
      </span>
    );
  }

  // Default: "gradient"
  const gradient = getAvatarGradient();
  return (
    <span className={sizeClass} style={{ background: gradient }}>
      {initials}
    </span>
  );
}
