"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ProductGroup } from "./types";
import { ProductThumbnail } from "./product-thumbnail";
import {
  ProductRowKebab,
  type KebabItem,
} from "./product-row-kebab";

export interface ProductMobileCardProps {
  group: ProductGroup;
  canEdit: boolean;
  canDelete: boolean;
  onAddVariant: (group: ProductGroup) => void;
  onDelete: (group: ProductGroup) => void;
}

/** Per-group card for mobile (<768 px). Tap anywhere to navigate. */
export function ProductMobileCard({
  group,
  canEdit,
  canDelete,
  onAddVariant,
  onDelete,
}: ProductMobileCardProps): React.ReactElement {
  const router = useRouter();
  const { parent, variants } = group;
  const displayName = variants[0]?.product_name ?? parent.product_name;
  const navigate = (): void => {
    router.push(`/products/${parent.id}/edit`);
  };
  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigate();
    }
  };

  const kebabItems: KebabItem[] = [
    { id: "view", label: "View", onSelect: navigate },
  ];
  if (canEdit) {
    kebabItems.push({
      id: "add-variant",
      label: "Add variant",
      onSelect: () => onAddVariant(group),
    });
  }
  if (canDelete) {
    kebabItems.push({
      id: "delete",
      label: "Delete\u2026",
      tone: "err",
      onSelect: () => onDelete(group),
    });
  }

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`Product ${parent.product_code}`}
      onClick={navigate}
      onKeyDown={handleKeyDown}
      className="card card-pad-sm"
      style={{ display: "flex", flexDirection: "column", gap: 10, cursor: "pointer" }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
          <ProductThumbnail src={parent.thumbnail_url} alt="" size={40} />
          <div style={{ minWidth: 0 }}>
            <div
              className="mono"
              style={{ fontWeight: 700, color: "var(--brand-700)", fontSize: 13 }}
            >
              {parent.product_code}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--fg-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {displayName}
            </div>
          </div>
        </div>
        <ProductRowKebab
          orderLabel={parent.product_code}
          items={kebabItems}
        />
      </div>

      <div
        style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}
      >
        {parent.category && (
          <span className="chip chip-info" style={{ fontSize: 11 }}>
            {parent.category}
          </span>
        )}
        <span
          className={variants.length > 1 ? "chip chip-accent" : "chip"}
          style={{ fontSize: 11 }}
        >
          {variants.length} variant{variants.length === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}
