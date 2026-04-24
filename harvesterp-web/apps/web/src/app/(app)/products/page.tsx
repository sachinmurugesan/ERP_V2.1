import * as React from "react";
import Link from "next/link";
import { Icon } from "@/components/design-system/icon";
import { RoleGate } from "@/components/composed/role-gate";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import { Resource, canAccess, type UserRole } from "@harvesterp/lib";
import { ProductsClient } from "./_components/products-client";

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
 * Internal products list.
 *
 * Lists every product grouped by part code (parent + variants), with
 * search / category / per-page filters, bulk edit, bulk delete, and a
 * same-page Bin tab for soft-deleted products.
 *
 * `/products/new`, `/products/{id}/edit`, and `/products/upload-excel`
 * remain on Vue (nginx fall-through) until their own migrations land.
 *
 * See docs/migration/logs/2026-04-24-products-list.md.
 */
export default async function ProductsPage(): Promise<React.ReactElement> {
  const role = await resolveUserRole();
  const user = role ? { role } : null;
  const canCreate = role ? canAccess(role, Resource.PRODUCT_CREATE) : false;
  const canEditOrDelete = role ? canAccess(role, Resource.PRODUCT_UPDATE) : false;

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
            Products
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "var(--fg-muted)",
              margin: "4px 0 0",
            }}
          >
            Catalogue search, filter, and bulk edit. Grouped by part code.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <RoleGate user={user} permission={Resource.PRODUCT_CREATE}>
            <Link
              href="/products/upload-excel"
              className="btn btn-sm btn-secondary"
              aria-label="Import products from Excel"
            >
              <Icon name="upload" size={13} />
              Import Excel
            </Link>
            <Link
              href="/products/new"
              className="btn btn-sm btn-primary"
              aria-label="Add new product"
            >
              <Icon name="plus" size={13} />
              Add product
            </Link>
          </RoleGate>
        </div>
      </header>

      <ProductsClient
        canCreate={canCreate}
        canEdit={canEditOrDelete}
        canDelete={canEditOrDelete}
      />
    </div>
  );
}
