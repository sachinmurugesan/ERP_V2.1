"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/design-system/icon";

export type KebabAction =
  | "view"
  | "add-variant"
  | "set-default"
  | "delete"
  | "restore"
  | "permanent-delete";

export interface KebabItem {
  id: KebabAction;
  label: string;
  tone?: "err";
  onSelect: () => void;
}

export interface ProductRowKebabProps {
  orderLabel: string;
  items: KebabItem[];
}

/**
 * Row-level action menu for the products table.
 *
 * Parent / child / single / bin rows each pass a different `items`
 * array — the kebab itself doesn't know what's in it. Caller controls
 * ordering and RoleGate'ing.
 */
export function ProductRowKebab({
  orderLabel,
  items,
}: ProductRowKebabProps): React.ReactElement {
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

  if (items.length === 0) return <span />;

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
        style={{ width: 28, height: 28, padding: 0 }}
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
            minWidth: 176,
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
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                item.onSelect();
              }}
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
                color: item.tone === "err" ? "var(--err)" : "var(--fg)",
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
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Convenience: use the router helper pattern from orders for Edit/View. */
export function useProductRouter(): ReturnType<typeof useRouter> {
  return useRouter();
}
