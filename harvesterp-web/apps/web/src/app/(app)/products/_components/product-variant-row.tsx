"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/design-system/icon";
import type { Product } from "./types";
import { dashIfEmpty } from "./formatters";
import { ProductThumbnail } from "./product-thumbnail";
import { RowCheckbox } from "./row-checkbox";
import {
  ProductRowKebab,
  type KebabItem,
} from "./product-row-kebab";

export interface ProductVariantRowProps {
  variant: Product;
  isLast: boolean;
  selected: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onToggleSelected: (variantCode: string) => void;
  onSetDefault: (variant: Product) => void;
  onDelete: (variant: Product) => void;
}

/**
 * Child variant row (rendered only when parent is expanded).
 * Indented via the tree-connector in the expand-chevron column; row
 * cells match the parent's column structure so alignment stays clean.
 */
export function ProductVariantRow({
  variant,
  isLast,
  selected,
  canEdit,
  canDelete,
  onToggleSelected,
  onSetDefault,
  onDelete,
}: ProductVariantRowProps): React.ReactElement {
  const router = useRouter();
  const connector = isLast ? "\u2514\u2500" : "\u251c\u2500"; // └─ / ├─
  const navigateToEdit = (): void => {
    router.push(`/products/${variant.id}/edit`);
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTableRowElement>,
  ): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigateToEdit();
    }
  };

  const kebabItems: KebabItem[] = [
    { id: "view", label: "View", onSelect: navigateToEdit },
  ];
  if (canEdit && !variant.is_default) {
    kebabItems.push({
      id: "set-default",
      label: "Set as default",
      onSelect: () => onSetDefault(variant),
    });
  }
  if (canDelete) {
    kebabItems.push({
      id: "delete",
      label: "Delete\u2026",
      tone: "err",
      onSelect: () => onDelete(variant),
    });
  }

  return (
    <tr
      tabIndex={0}
      role="link"
      aria-label={`Variant ${variant.product_name ?? variant.id}`}
      onClick={navigateToEdit}
      onKeyDown={handleKeyDown}
      style={{
        cursor: "pointer",
        outlineOffset: -2,
        background: "var(--bg-sunken)",
      }}
    >
      <td onClick={(e) => e.stopPropagation()}>
        <RowCheckbox
          checked={selected}
          onChange={() => onToggleSelected(variant.id)}
          ariaLabel={`Select variant ${variant.product_name ?? variant.id}`}
        />
      </td>

      <td aria-hidden="true">
        <span
          className="mono"
          style={{
            color: "var(--fg-subtle)",
            fontSize: 11,
            display: "inline-block",
            paddingLeft: 8,
          }}
        >
          {connector}
        </span>
      </td>

      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ProductThumbnail src={variant.thumbnail_url} alt="" size={32} />
          {variant.is_default && (
            <span
              aria-label="Default variant"
              title="Default variant"
              style={{ color: "var(--warn)", display: "inline-flex" }}
            >
              <Icon name="star" size={12} />
            </span>
          )}
        </div>
      </td>

      <td>
        <span
          className="mono"
          style={{ color: "var(--fg-subtle)", fontSize: 11 }}
        >
          V-{variant.id.slice(0, 4)}
        </span>
      </td>

      <td>
        <span style={{ color: "var(--fg-muted)", fontSize: 12 }}>
          {dashIfEmpty(variant.product_name)}
        </span>
      </td>

      <td className="orders-col-factory">
        {variant.material ? (
          <span className="chip chip-warn" style={{ fontSize: 10, height: 20, padding: "0 6px" }}>
            {variant.material}
          </span>
        ) : (
          <span style={{ color: "var(--fg-subtle)" }}>{dashIfEmpty(null)}</span>
        )}
      </td>

      <td className="orders-col-factory">
        {variant.dimension ? (
          <span className="chip chip-info" style={{ fontSize: 10, height: 20, padding: "0 6px" }}>
            {variant.dimension}
          </span>
        ) : (
          <span style={{ color: "var(--fg-subtle)" }}>{dashIfEmpty(null)}</span>
        )}
      </td>

      <td className="orders-col-items" style={{ textAlign: "center" }}>
        {variant.part_type ? (
          <span className="chip" style={{ fontSize: 10, height: 20, padding: "0 6px" }}>
            {variant.part_type}
          </span>
        ) : (
          <span style={{ color: "var(--fg-subtle)" }}>{dashIfEmpty(null)}</span>
        )}
      </td>

      <td>
        <span style={{ color: "var(--fg-subtle)", fontSize: 11 }}>
          {dashIfEmpty(variant.category)}
        </span>
      </td>

      <td className="orders-col-factory">
        {variant.brand ? (
          <span className="chip" style={{ fontSize: 10, height: 20, padding: "0 6px" }}>
            {variant.brand}
          </span>
        ) : (
          <span style={{ color: "var(--fg-subtle)" }}>{dashIfEmpty(null)}</span>
        )}
      </td>

      <td className="orders-col-items mono" style={{ color: "var(--fg-subtle)", fontSize: 11 }}>
        {dashIfEmpty(variant.hs_code)}
      </td>

      <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
        <ProductRowKebab
          orderLabel={variant.product_name ?? variant.id}
          items={kebabItems}
        />
      </td>
    </tr>
  );
}
