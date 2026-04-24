"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/design-system/icon";
import type { ProductGroup } from "./types";
import { dashIfEmpty, uniqueTags } from "./formatters";
import { ProductThumbnail } from "./product-thumbnail";
import { RowCheckbox } from "./row-checkbox";
import {
  ProductRowKebab,
  type KebabItem,
} from "./product-row-kebab";

const INDEPENDENT_TAG_LIMIT = 3;

export interface ProductParentRowProps {
  group: ProductGroup;
  expanded: boolean;
  selected: boolean;
  indeterminate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onToggleExpanded: (productCode: string) => void;
  onToggleSelected: (productCode: string) => void;
  onAddVariant: (group: ProductGroup) => void;
  onDelete: (group: ProductGroup) => void;
}

/**
 * Parent row of the accordion. Multi-variant parents show a chevron +
 * aggregated material/size tags + variant count badge. Single-variant
 * parents render flat (no chevron, row click navigates to edit).
 */
export function ProductParentRow({
  group,
  expanded,
  selected,
  indeterminate,
  canEdit,
  canDelete,
  onToggleExpanded,
  onToggleSelected,
  onAddVariant,
  onDelete,
}: ProductParentRowProps): React.ReactElement {
  const router = useRouter();
  const { parent, variants } = group;
  const displayName = variants[0]?.product_name ?? parent.product_name;
  const isMultiVariant = variants.length > 1;

  const materials = uniqueTags(
    variants as unknown as Array<{ [key: string]: unknown }>,
    "material",
  );
  const dimensions = uniqueTags(
    variants as unknown as Array<{ [key: string]: unknown }>,
    "dimension",
  );
  const firstVariant = variants[0];
  const category = parent.category ?? firstVariant?.category ?? null;
  const brand = firstVariant?.brand ?? null;
  const hsCode = firstVariant?.hs_code ?? null;

  const navigateToEdit = (): void => {
    router.push(`/products/${parent.id}/edit`);
  };

  const handleRowClick = (): void => {
    if (isMultiVariant) onToggleExpanded(parent.product_code);
    else navigateToEdit();
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTableRowElement>,
  ): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleRowClick();
    }
  };

  const kebabItems: KebabItem[] = [
    { id: "view", label: "View", onSelect: navigateToEdit },
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
    <tr
      tabIndex={0}
      role={isMultiVariant ? undefined : "link"}
      aria-expanded={isMultiVariant ? expanded : undefined}
      aria-label={`Product ${parent.product_code}`}
      onClick={handleRowClick}
      onKeyDown={handleKeyDown}
      style={{ cursor: "pointer", outlineOffset: -2 }}
    >
      <td onClick={(e) => e.stopPropagation()}>
        <RowCheckbox
          checked={selected}
          indeterminate={indeterminate}
          onChange={() => onToggleSelected(parent.product_code)}
          ariaLabel={`Select ${parent.product_code}`}
        />
      </td>

      <td aria-hidden="true">
        {isMultiVariant && (
          <span
            style={{
              display: "inline-flex",
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 200ms",
              color: "var(--fg-muted)",
            }}
          >
            <Icon name="chevronR" size={12} />
          </span>
        )}
      </td>

      <td>
        <ProductThumbnail src={parent.thumbnail_url} alt="" size={40} />
      </td>

      <td>
        <span className="mono" style={{ fontWeight: 700, color: "var(--brand-700)" }}>
          {parent.product_code}
        </span>
      </td>

      <td>
        <span style={{ color: "var(--fg)", fontWeight: 500, fontSize: 13 }}>
          {displayName}
        </span>
      </td>

      <td className="orders-col-factory">
        <TagList items={materials} tone="warn" emptyText="—" />
      </td>

      <td className="orders-col-factory">
        <TagList items={dimensions} tone="info" emptyText="—" />
      </td>

      <td className="orders-col-items" style={{ textAlign: "center" }}>
        <span
          className={isMultiVariant ? "chip chip-accent" : "chip"}
          style={{ fontSize: 11 }}
        >
          {variants.length}
        </span>
      </td>

      <td>
        {category ? (
          <span className="chip chip-info" style={{ fontSize: 11 }}>
            {category}
          </span>
        ) : (
          <span style={{ color: "var(--fg-subtle)" }}>{dashIfEmpty(null)}</span>
        )}
      </td>

      <td className="orders-col-factory">
        {brand ? (
          <span className="chip" style={{ fontSize: 11 }}>
            {brand}
          </span>
        ) : (
          <span style={{ color: "var(--fg-subtle)" }}>{dashIfEmpty(null)}</span>
        )}
      </td>

      <td className="orders-col-items mono" style={{ color: "var(--fg-muted)" }}>
        {dashIfEmpty(hsCode)}
      </td>

      <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
        <div
          style={{ display: "inline-flex", gap: 4, alignItems: "center" }}
        >
          {canEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigateToEdit();
              }}
              aria-label={`Edit ${parent.product_code}`}
              className="btn btn-sm btn-ghost"
              style={{ width: 28, height: 28, padding: 0 }}
            >
              <Icon name="arrowRight" size={12} />
            </button>
          )}
          <ProductRowKebab
            orderLabel={parent.product_code}
            items={kebabItems}
          />
        </div>
      </td>
    </tr>
  );
}

/** Small tag list: first N items as chips, "+ more" when truncated. */
function TagList({
  items,
  tone,
  emptyText,
}: {
  items: string[];
  tone: "warn" | "info";
  emptyText: string;
}): React.ReactElement {
  if (items.length === 0) {
    return <span style={{ color: "var(--fg-subtle)" }}>{emptyText}</span>;
  }
  const visible = items.slice(0, INDEPENDENT_TAG_LIMIT);
  const rest = items.length - visible.length;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {visible.map((item) => (
        <span
          key={item}
          className={`chip chip-${tone}`}
          style={{ fontSize: 10, height: 20, padding: "0 6px" }}
        >
          {item}
        </span>
      ))}
      {rest > 0 && (
        <span
          className="chip"
          style={{ fontSize: 10, height: 20, padding: "0 6px" }}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}
