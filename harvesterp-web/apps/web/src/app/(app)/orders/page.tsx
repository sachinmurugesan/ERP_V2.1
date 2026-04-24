import * as React from "react";
import Link from "next/link";
import { Icon } from "@/components/design-system/icon";
import { RoleGate } from "@/components/composed/role-gate";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import { Resource, canAccess, type UserRole } from "@harvesterp/lib";
import { OrdersClient } from "./_components/orders-client";

export const dynamic = "force-dynamic";

async function resolveUserRole(): Promise<UserRole | undefined> {
  try {
    const token = await getSessionToken();
    if (!token) return undefined;
    const client = await getServerClient();
    const result = await client.GET("/api/auth/me");
    if (!result.data) return undefined;
    const u = result.data as { role?: UserRole };
    return u.role;
  } catch {
    return undefined;
  }
}

/**
 * Internal orders list.
 *
 * RSC wrapper reads the session role and flags whether the user can
 * create / delete orders. The interactive surface (filter tabs, table,
 * pagination, delete dialog) lives in the "use client" OrdersClient.
 *
 * See docs/migration/logs/2026-04-23-orders-list.md for migration notes.
 */
export default async function OrdersPage(): Promise<React.ReactElement> {
  const role = await resolveUserRole();
  const user = role ? { role } : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <header
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: -0.3,
              margin: 0,
              color: "var(--fg)",
            }}
          >
            Orders
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "var(--fg-muted)",
              margin: "4px 0 0",
            }}
          >
            Every internal order. Filter by stage, search by order or PO
            reference, open any row.
          </p>
        </div>

        <RoleGate user={user} permission={Resource.ORDER_CREATE}>
          <Link
            href="/orders/new"
            className="btn btn-sm btn-primary"
            aria-label="Create new order"
          >
            <Icon name="plus" size={13} />
            New order
          </Link>
        </RoleGate>
      </header>

      <OrdersClient
        canCreate={role ? canAccess(role, Resource.ORDER_CREATE) : false}
        canDelete={role ? canAccess(role, Resource.ORDER_UPDATE) : false}
      />
    </div>
  );
}
