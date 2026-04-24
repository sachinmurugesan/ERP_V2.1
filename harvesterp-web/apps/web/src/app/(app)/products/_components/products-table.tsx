"use client";

import * as React from "react";
import type { ProductGroup } from "./types";
import { ProductParentRow } from "./product-parent-row";
import { ProductVariantRow } from "./product-variant-row";
import { ProductMobileCard } from "./product-mobile-card";

export interface ProductsTableProps {
  groups: ProductGroup[];
  expandedCodes: Set<string>;
  selectedCodes: Set<string>;
  selectedVariantIds: Set<string>;
  canEdit: boolean;
  canDelete: boolean;
  onToggleExpanded: (productCode: string) => void;
  onToggleSelectedParent: (productCode: string) => void;
  onToggleSelectedVariant: (variantId: string) => void;
  onAddVariant: (group: ProductGroup) => void;
  onDeleteGroup: (group: ProductGroup) => void;
  onDeleteVariant: (group: ProductGroup, variant: ProductGroup["variants"][number]) => void;
  onSetDefault: (group: ProductGroup, variant: ProductGroup["variants"][number]) => void;
}

/**
 * Desktop table (≥ 768 px). Mobile falls back to per-row cards via
 * the media-query CSS block below.
 *
 * Breakpoints:
 *   - ≥1024 px: all columns visible.
 *   - 768–1023 px: Material, Size, Variants count, Brand, HS Code hide
 *     (.orders-col-factory + .orders-col-items classes — reused from
 *     the orders-list migration to keep CSS consistent).
 *   - <768 px: table is display:none; card list renders.
 */
export function ProductsTable({
  groups,
  expandedCodes,
  selectedCodes,
  selectedVariantIds,
  canEdit,
  canDelete,
  onToggleExpanded,
  onToggleSelectedParent,
  onToggleSelectedVariant,
  onAddVariant,
  onDeleteGroup,
  onDeleteVariant,
  onSetDefault,
}: ProductsTableProps): React.ReactElement {
  return (
    <>
      <style>{TABLE_CSS}</style>

      <table
        className="tbl products-table-desktop"
        id="products-table"
        aria-label="Products"
      >
        <thead>
          <tr>
            <th scope="col" style={{ width: 36 }} aria-label="Select" />
            <th scope="col" style={{ width: 24 }} aria-label="Expand" />
            <th scope="col" style={{ width: 56 }}>
              <span className="sr-only-no-class">Image</span>
            </th>
            <th scope="col">Part Code</th>
            <th scope="col">Product Name</th>
            <th scope="col" className="orders-col-factory">
              Material
            </th>
            <th scope="col" className="orders-col-factory">
              Size
            </th>
            <th
              scope="col"
              className="orders-col-items"
              style={{ textAlign: "center" }}
            >
              Variants
            </th>
            <th scope="col">Category</th>
            <th scope="col" className="orders-col-factory">
              Brand
            </th>
            <th scope="col" className="orders-col-items">
              HS Code
            </th>
            <th scope="col" style={{ textAlign: "right" }}>
              <span className="sr-only-no-class">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const parentCode = group.parent.product_code;
            const expanded = expandedCodes.has(parentCode);
            const variantIdsInGroup = group.variants.map((v) => v.id);
            const anyChildSelected = variantIdsInGroup.some((id) =>
              selectedVariantIds.has(id),
            );
            const allChildrenSelected =
              variantIdsInGroup.length > 0 &&
              variantIdsInGroup.every((id) => selectedVariantIds.has(id));
            const parentSelected =
              selectedCodes.has(parentCode) ||
              (group.variants.length === 1 && allChildrenSelected);
            const indeterminate =
              group.variants.length > 1 &&
              !selectedCodes.has(parentCode) &&
              anyChildSelected &&
              !allChildrenSelected;

            return (
              <React.Fragment key={parentCode}>
                <ProductParentRow
                  group={group}
                  expanded={expanded}
                  selected={parentSelected}
                  indeterminate={indeterminate}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onToggleExpanded={onToggleExpanded}
                  onToggleSelected={onToggleSelectedParent}
                  onAddVariant={onAddVariant}
                  onDelete={onDeleteGroup}
                />
                {expanded &&
                  group.variants.length > 1 &&
                  group.variants.map((variant, idx) => (
                    <ProductVariantRow
                      key={variant.id}
                      variant={variant}
                      isLast={idx === group.variants.length - 1}
                      selected={
                        selectedVariantIds.has(variant.id) ||
                        selectedCodes.has(parentCode)
                      }
                      canEdit={canEdit}
                      canDelete={canDelete}
                      onToggleSelected={onToggleSelectedVariant}
                      onSetDefault={(v) => onSetDefault(group, v)}
                      onDelete={(v) => onDeleteVariant(group, v)}
                    />
                  ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      <div className="products-table-mobile" aria-label="Products (mobile)">
        {groups.map((group) => (
          <ProductMobileCard
            key={group.parent.product_code}
            group={group}
            canEdit={canEdit}
            canDelete={canDelete}
            onAddVariant={onAddVariant}
            onDelete={onDeleteGroup}
          />
        ))}
      </div>
    </>
  );
}

const TABLE_CSS = `
  .products-table-mobile { display: none; }
  @media (max-width: 767px) {
    .products-table-desktop { display: none; }
    .products-table-mobile {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px 16px 16px;
    }
  }
  @media (max-width: 1023px) and (min-width: 768px) {
    .orders-col-factory,
    .orders-col-items { display: none; }
  }
`;
