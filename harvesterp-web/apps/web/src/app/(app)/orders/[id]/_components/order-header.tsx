"use client";

import * as React from "react";
import Link from "next/link";
import {
  canAccess,
  Resource,
  type UserRole,
} from "@harvesterp/lib";
import { ArrowLeft, Eye, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/primitives/button";
import { StageChip } from "@/components/composed/stage-chip";
import type { OrderDetail } from "./types";

/**
 * <OrderHeader> — the page-identity row.
 *
 * Mirrors `OrderDetail.vue:441-473`:
 *   - Back arrow → /orders
 *   - Order number (or "DRAFT ORDER" fallback) + StageChip + Transparency badge
 *   - Client name · Factory name · PO reference (each conditional)
 *   - Delete button (DRAFT only + ORDER_UPDATE)
 *   - Re-open button (COMPLETED only + ORDER_REOPEN)
 *
 * NOT sticky — header scrolls naturally; only the tab bar below is sticky.
 */

interface OrderHeaderProps {
  order: OrderDetail;
  role: UserRole | undefined;
  onDeleteClick: () => void;
  onReopenClick: () => void;
}

export function OrderHeader({
  order,
  role,
  onDeleteClick,
  onReopenClick,
}: OrderHeaderProps): React.ReactElement {
  const isDraft = order.status === "DRAFT";
  const isCompleted = order.status === "COMPLETED";

  // Role gates
  const canSeeTransparency = role
    ? role === "SUPER_ADMIN" || role === "ADMIN"
    : false;
  const canDelete = role ? canAccess(role, Resource.ORDER_UPDATE) : false;
  const canReopen = role ? canAccess(role, Resource.ORDER_REOPEN) : false;

  // Transparency badge: SuperAdmin only AND TRANSPARENCY client
  const showTransparencyBadge =
    canSeeTransparency && order.client_type === "TRANSPARENCY";

  return (
    <header className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
      <div className="flex min-w-0 items-start gap-3">
        <Link
          href="/orders"
          aria-label="Back to orders list"
          className="mt-0.5 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold text-slate-800">
              {order.order_number ?? "DRAFT ORDER"}
            </h1>
            <StageChip
              stageNumber={order.stage_number}
              stageName={order.stage_name}
            />
            {showTransparencyBadge ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
                data-testid="transparency-badge"
              >
                <Eye size={11} aria-hidden="true" />
                Transparency Client
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
            {order.client_name ? (
              <span data-testid="header-client">{order.client_name}</span>
            ) : null}
            {order.factory_name ? (
              <>
                <span aria-hidden="true">·</span>
                <span data-testid="header-factory">{order.factory_name}</span>
              </>
            ) : null}
            {order.po_reference ? (
              <>
                <span aria-hidden="true">·</span>
                <span data-testid="header-po">PO: {order.po_reference}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {isDraft && canDelete ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onDeleteClick}
            aria-label="Delete draft order"
          >
            <Trash2 size={14} />
            Delete
          </Button>
        ) : null}
        {isCompleted && canReopen ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onReopenClick}
            aria-label="Re-open order"
          >
            <RotateCcw size={14} />
            Re-open
          </Button>
        ) : null}
      </div>
    </header>
  );
}
