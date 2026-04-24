"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { OrderListItem } from "./types";
import { StageChip } from "@/components/composed/stage-chip";
import { OrderKebab } from "./order-kebab";
import {
  avatarBackgroundFor,
  formatCNY,
  formatDate,
  initialsFor,
} from "./formatters";

export interface OrderMobileCardProps {
  order: OrderListItem;
  canDelete: boolean;
  onRequestDelete: (order: OrderListItem) => void;
}

/**
 * Per-order card for the mobile layout (<768 px) — replaces horizontal
 * table scroll. Tap anywhere on the card to open the order; kebab for
 * secondary actions.
 */
export function OrderMobileCard({
  order,
  canDelete,
  onRequestDelete,
}: OrderMobileCardProps): React.ReactElement {
  const router = useRouter();
  const orderHref = `/orders/${order.id}`;
  const orderLabel = order.order_number ?? "DRAFT";

  const navigate = (): void => {
    router.push(orderHref);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigate();
    }
  };

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`Open order ${orderLabel}`}
      onClick={navigate}
      onKeyDown={handleKeyDown}
      className="card card-pad-sm"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        cursor: "pointer",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
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
            <div
              className="mono"
              style={{ fontWeight: 600, color: "var(--fg)", fontSize: 13 }}
            >
              {orderLabel}
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
              {order.client_name ?? "\u2014"}
            </div>
          </div>
        </div>
        <OrderKebab
          orderLabel={orderLabel}
          onView={navigate}
          {...(canDelete
            ? { onDelete: () => onRequestDelete(order) }
            : {})}
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <StageChip
          stageNumber={order.stage_number}
          stageName={order.stage_name}
        />
        <span
          className="num"
          style={{ fontWeight: 600, fontSize: 13, color: "var(--fg)" }}
        >
          {formatCNY(order.total_value_cny)}
        </span>
      </div>

      <div
        style={{
          fontSize: 11,
          color: "var(--fg-subtle)",
        }}
      >
        {formatDate(order.created_at)}
      </div>
    </div>
  );
}
