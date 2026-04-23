"use client";

/**
 * DSAvatar — ported from apps/ui-gallery.
 * Displays user initials with gradient, hash-based, or role-based colouring.
 */

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
  variant?: "gradient" | "hash" | "role";
  role?: string;
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
      <span className={`${sizeClass} ${bg} ${text}`}>{initials}</span>
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

  // Default: gradient
  const gradient = getAvatarGradient();
  return (
    <span className={sizeClass} style={{ background: gradient }}>
      {initials}
    </span>
  );
}
