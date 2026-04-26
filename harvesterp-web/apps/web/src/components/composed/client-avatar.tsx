"use client";

import * as React from "react";
import {
  type UserRole,
  getAvatarClass,
  getAvatarHexColor,
  getInitials,
} from "@harvesterp/lib";
import { cn } from "@/lib/utils";

/**
 * ClientAvatar — initials-on-coloured-circle avatar (P-020).
 *
 * Ported from apps/ui-gallery/src/components/composed/client-avatar.tsx
 * with no API changes. Two rendering variants:
 *
 *  - "class" — uses getAvatarClass(role) Tailwind class pairs (default).
 *              Faster; works with Tailwind JIT purging when classes are
 *              safelisted.
 *  - "hex"   — uses getAvatarHexColor(name) inline style.
 *              Required when Tailwind purging would drop the dynamic
 *              class, OR when a deterministic hash-based colour per
 *              name is needed (e.g. company avatars in the clients list).
 *
 * Used in the Clients List Company Name cell + mobile card icon.
 */

type AvatarSize = "sm" | "md" | "lg";

export interface ClientAvatarProps {
  /** Display name (or email) used for initials + colour derivation. */
  name: string;
  /** Avatar diameter. "sm"=24px "md"=32px "lg"=48px. Default "md". */
  size?: AvatarSize | undefined;
  /**
   * "class" — uses role-based Tailwind class pairs from getAvatarClass().
   * "hex"   — uses name-based hex colour from getAvatarHexColor().
   * Default: "class".
   */
  variant?: "hex" | "class" | undefined;
  /**
   * Required when variant="class" — the user's role drives the colour pair.
   * Ignored when variant="hex".
   */
  role?: UserRole | undefined;
  className?: string | undefined;
}

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-12 w-12 text-sm",
};

export function ClientAvatar({
  name,
  size = "md",
  variant = "class",
  role,
  className,
}: ClientAvatarProps): React.ReactElement {
  const initials = getInitials(name);
  const sizeClass = SIZE_CLASSES[size];

  if (variant === "hex") {
    const hexColor = getAvatarHexColor(name);
    return (
      <span
        role="img"
        aria-label={name}
        className={cn(
          "inline-flex items-center justify-center rounded-full font-semibold text-white select-none",
          sizeClass,
          className,
        )}
        style={{ backgroundColor: hexColor }}
      >
        {initials}
      </span>
    );
  }

  // variant === "class"
  const { bg, text } = getAvatarClass(role ?? "");
  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold select-none",
        bg,
        text,
        sizeClass,
        className,
      )}
    >
      {initials}
    </span>
  );
}
