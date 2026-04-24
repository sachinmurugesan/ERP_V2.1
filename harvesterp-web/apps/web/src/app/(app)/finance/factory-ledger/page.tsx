import * as React from "react";
import { redirect } from "next/navigation";
import {
  Resource,
  canAccess,
  type UserRole,
} from "@harvesterp/lib";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import { AdminForbiddenState } from "@/components/composed/admin-forbidden-state";
import { FactoryLedgerClient } from "./_components/factory-ledger-client";
import type {
  FactoriesListResponse,
  FactorySummary,
} from "./_components/types";

export const dynamic = "force-dynamic";

async function resolveUserRole(): Promise<UserRole | undefined> {
  try {
    const token = await getSessionToken();
    if (!token) return undefined;
    const client = await getServerClient();
    const result = await client.GET("/api/auth/me");
    if (!result.data) return undefined;
    return (result.data as { role?: UserRole }).role;
  } catch {
    return undefined;
  }
}

async function fetchFactories(): Promise<FactorySummary[]> {
  // Backend caps per_page at 200. For now the dropdown fits comfortably in
  // that window; paginate if factory count ever approaches the cap.
  try {
    const client = await getServerClient();
    const res = await client.getJson<FactoriesListResponse>(
      "/api/factories/",
      { params: { per_page: 200 } },
    );
    return (res.items ?? []).filter((f) => f.is_active !== false);
  } catch {
    return [];
  }
}

/**
 * Factory Ledger — internal finance page.
 *
 * Gated by FACTORY_LEDGER_VIEW (FINANCE + SUPER_ADMIN bypass). ADMIN is
 * intentionally excluded per D-004 segregation-of-duties and receives a
 * dedicated AdminForbiddenState instead of a blank 403.
 */
export default async function FactoryLedgerPage(): Promise<React.ReactElement> {
  const role = await resolveUserRole();
  if (!role) redirect("/login?next=/finance/factory-ledger");

  if (!canAccess(role, Resource.FACTORY_LEDGER_VIEW)) {
    if (role === "ADMIN") {
      return (
        <div className="mx-auto max-w-5xl py-10">
          <AdminForbiddenState pageTitle="Factory Ledger" />
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-5xl py-10">
        <AdminForbiddenState
          pageTitle="Factory Ledger"
          message="You don't have permission to view the factory ledger. Contact your administrator if you believe this is an error."
        />
      </div>
    );
  }

  const factories = await fetchFactories();

  return (
    <div className="mx-auto max-w-[1400px]">
      <FactoryLedgerClient initialFactories={factories} />
    </div>
  );
}
