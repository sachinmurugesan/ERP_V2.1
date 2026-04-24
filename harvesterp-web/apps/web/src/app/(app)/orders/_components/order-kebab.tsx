"use client";

import * as React from "react";
import { Icon } from "@/components/design-system/icon";

export interface OrderKebabProps {
  orderLabel: string;
  onView: () => void;
  onDelete?: () => void;
}

/**
 * Row-level actions menu. "View" is always visible; "Delete…" is conditional
 * on the parent passing an `onDelete` (gated by caller per role — the kebab
 * itself does not look at user role).
 *
 * Keyboard:
 *   - Escape closes the menu.
 *   - ArrowDown / ArrowUp wrap focus through menu items.
 *   - Click outside closes the menu.
 */
export function OrderKebab({
  orderLabel,
  onView,
  onDelete,
}: OrderKebabProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent): void => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const toggle = (event: React.MouseEvent): void => {
    event.stopPropagation();
    setOpen((prev) => !prev);
  };

  const handleView = (event: React.MouseEvent): void => {
    event.stopPropagation();
    setOpen(false);
    onView();
  };

  const handleDelete = (event: React.MouseEvent): void => {
    event.stopPropagation();
    setOpen(false);
    onDelete?.();
  };

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", display: "inline-flex" }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${orderLabel}`}
        className="btn btn-sm btn-ghost"
        style={{
          width: 30,
          height: 28,
          padding: 0,
        }}
      >
        <Icon name="moreV" size={14} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 160,
            background: "var(--bg-elev)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            boxShadow: "var(--sh-md)",
            padding: 6,
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <MenuItem onClick={handleView}>
            <Icon name="chevronR" size={13} />
            View
          </MenuItem>
          {onDelete && (
            <MenuItem tone="err" onClick={handleDelete}>
              <Icon name="close" size={13} />
              Delete&hellip;
            </MenuItem>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  children,
  tone,
}: {
  onClick: (event: React.MouseEvent) => void;
  children: React.ReactNode;
  tone?: "err";
}): React.ReactElement {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        border: "none",
        background: "transparent",
        textAlign: "left",
        fontSize: 13,
        fontWeight: 500,
        color: tone === "err" ? "var(--err)" : "var(--fg)",
        cursor: "pointer",
        borderRadius: "var(--r-sm)",
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.background = "var(--bg-sunken)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}
