"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { OrderListItem } from "./types";
import { StageChip } from "@/components/composed/stage-chip";
import { OrderKebab } from "./order-kebab";
import {
  avatarBackgroundFor,
  formatCNY,
  formatCount,
  formatDate,
  initialsFor,
} from "./formatters";

export interface OrderRowProps {
  order: OrderListItem;
  canDelete: boolean;
  onRequestDelete: (order: OrderListItem) => void;
}

/**
 * Single orders-table row. Entire row is keyboard-activatable; the per-row
 * kebab menu owns the secondary actions (view + optional delete).
 *
 * Factory and Items cells carry CSS classes that the parent table hides at
 * the tablet breakpoint (<1024 px). Cells stay in the DOM for consistent
 * layout; they're just display-none'd by the responsive stylesheet.
 */
export function OrderRow({
  order,
  canDelete,
  onRequestDelete,
}: OrderRowProps): React.ReactElement {
  const router = useRouter();
  const orderHref = `/orders/${order.id}`;

  const navigate = (): void => {
    router.push(orderHref);
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTableRowElement>,
  ): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigate();
    }
  };

  const orderLabel = order.order_number ?? "DRAFT";

  return (
    <tr
      tabIndex={0}
      role="link"
      aria-label={`Open order ${orderLabel}`}
      onClick={navigate}
      onKeyDown={handleKeyDown}
      style={{ cursor: "pointer", outlineOffset: -2 }}
    >
      <td>
        <div className="mono" style={{ fontWeight: 600, color: "var(--fg)" }}>
          {orderLabel}
        </div>
        {order.po_reference && (
          <div
            style={{
              fontSize: 11,
              color: "var(--fg-subtle)",
              marginTop: 2,
            }}
          >
            {order.po_reference}
          </div>
        )}
      </td>

      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            aria-hidden="true"
            style={{
              width: 28,
              height: 28,
              borderRadius: "var(--r-full)",
              background: avatarBackgroundFor(order.client_name),
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {initialsFor(order.client_name)}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: "var(--fg)", fontWeight: 500 }}>
              {order.client_name ?? "\u2014"}
            </div>
            {order.client_location && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--fg-subtle)",
                  marginTop: 2,
                }}
              >
                {order.client_location}
              </div>
            )}
          </div>
        </div>
      </td>

      <td className="orders-col-factory" style={{ color: "var(--fg-muted)" }}>
        {order.factory_name ?? "\u2014"}
      </td>

      <td>
        <StageChip
          stageNumber={order.stage_number}
          stageName={order.stage_name}
        />
      </td>

      <td
        className="orders-col-items num"
        style={{ textAlign: "right", color: "var(--fg)" }}
      >
        {formatCount(order.item_count)}
      </td>

      <td
        className="num"
        style={{
          textAlign: "right",
          fontWeight: 600,
          color: "var(--fg)",
        }}
      >
        {formatCNY(order.total_value_cny)}
      </td>

      <td style={{ color: "var(--fg-muted)" }}>
        {formatDate(order.created_at)}
      </td>

      <td style={{ textAlign: "right" }}>
        <OrderKebab
          orderLabel={orderLabel}
          onView={navigate}
          {...(canDelete
            ? { onDelete: () => onRequestDelete(order) }
            : {})}
        />
      </td>
    </tr>
  );
}
