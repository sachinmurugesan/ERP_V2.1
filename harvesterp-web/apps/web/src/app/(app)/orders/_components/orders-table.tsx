"use client";

import * as React from "react";
import type { OrderListItem } from "./types";
import { OrderRow } from "./order-row";
import { OrderMobileCard } from "./mobile-card";

export interface OrdersTableProps {
  orders: OrderListItem[];
  canDelete: boolean;
  onRequestDelete: (order: OrderListItem) => void;
}

/**
 * Responsive container for the orders list:
 *   - ≥ 1024 px: full table with 8 columns.
 *   - 768–1023 px: compact table — Factory + Items hidden.
 *   - < 768 px: per-row card list.
 *
 * Breakpoints are enforced with inline container queries via `@media` in a
 * single injected style block, since the design system's CSS doesn't expose
 * page-specific breakpoint classes.
 */
export function OrdersTable({
  orders,
  canDelete,
  onRequestDelete,
}: OrdersTableProps): React.ReactElement {
  return (
    <>
      <style>{TABLE_CSS}</style>

      <table
        className="tbl orders-table-desktop"
        id="orders-table"
        aria-label="Orders"
      >
        <thead>
          <tr>
            <th scope="col">Order #</th>
            <th scope="col">Client</th>
            <th scope="col" className="orders-col-factory">
              Factory
            </th>
            <th scope="col">Stage</th>
            <th
              scope="col"
              className="orders-col-items"
              style={{ textAlign: "right" }}
            >
              Items
            </th>
            <th scope="col" style={{ textAlign: "right" }}>
              Value
            </th>
            <th scope="col">Created</th>
            <th scope="col" style={{ textAlign: "right" }}>
              <span className="sr-only-no-class">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              canDelete={canDelete}
              onRequestDelete={onRequestDelete}
            />
          ))}
        </tbody>
      </table>

      <div className="orders-table-mobile" aria-label="Orders (mobile)">
        {orders.map((order) => (
          <OrderMobileCard
            key={order.id}
            order={order}
            canDelete={canDelete}
            onRequestDelete={onRequestDelete}
          />
        ))}
      </div>
    </>
  );
}

const TABLE_CSS = `
  .orders-table-mobile { display: none; }
  @media (max-width: 767px) {
    .orders-table-desktop { display: none; }
    .orders-table-mobile {
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
