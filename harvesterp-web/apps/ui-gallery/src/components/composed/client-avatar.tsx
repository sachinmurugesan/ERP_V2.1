"use client";

/**
 * <ClientAvatar> — P-020 canonical implementation.
 *
 * Consolidates four independent getInitials/getAvatarColor implementations
 * across OrderList.vue, OrderItemsTab.vue, ClientOrderItemsTab.vue,
 * QueriesTab.vue into a single Layer 2 component.
 *
 * Two rendering variants:
 *   "class"  — uses getAvatarClass(role) Tailwind class pairs (default).
 *              Faster; no style= attribute; works with Tailwind JIT purging
 *              when classes are safelisted.
 *   "hex"    — uses getAvatarHexColor(name) inline style.
 *              Required when Tailwind purging would drop the dynamic class,
 *              or when a deterministic hash-based colour per name is needed.
 *
 * "use client" — uses no interactivity but is safe to render on client.
 *   Forward-compatible for Task 7 RSC/client split.
 */

import { type UserRole, getAvatarClass, getAvatarHexColor, getInitials } from "@harvesterp/lib";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

type AvatarSize = "sm" | "md" | "lg";

export interface ClientAvatarProps {
  /** Display name (or email) used for initials + colour derivation. */
  name: string;
  /** Avatar diameter. "sm"=24px "md"=32px "lg"=48px. */
  size?: AvatarSize;
  /**
   * "class" — uses role-based Tailwind class pairs from getAvatarClass().
   * "hex"   — uses name-based hex colour from getAvatarHexColor().
   * Default: "class".
   */
  variant?: "hex" | "class";
  /**
   * Required when variant="class" — the user's role drives the colour pair.
   * Ignored when variant="hex".
   */
  role?: UserRole;
  className?: string;
}

// ── Size map ──────────────────────────────────────────────────────────────

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-12 w-12 text-sm",
};

// ── Component ─────────────────────────────────────────────────────────────

export function ClientAvatar({
  name,
  size = "md",
  variant = "class",
  role,
  className,
}: ClientAvatarProps) {
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
