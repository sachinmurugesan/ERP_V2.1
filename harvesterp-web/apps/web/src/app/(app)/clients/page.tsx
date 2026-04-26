import * as React from "react";
import { redirect } from "next/navigation";
import { type UserRole } from "@harvesterp/lib";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import { ClientsClient } from "./_components/clients-client";
import type {
  ClientsListResponse,
  RawClientsListResponse,
} from "./_components/types";

export const dynamic = "force-dynamic";

const DEFAULT_PER_PAGE = 50;

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

/**
 * Strip Cluster D fields from each row.
 *
 * `factory_markup_percent` and `sourcing_commission_percent` are
 * sensitive internal margin fields not rendered by the UI. The Vue
 * source fetched them and ignored them — we strip server-side so they
 * never reach the browser.
 */
function projectListResponse(raw: RawClientsListResponse): ClientsListResponse {
  return {
    items: raw.items.map((c) => {
      const {
        factory_markup_percent: _m,
        sourcing_commission_percent: _s,
        ...rest
      } = c;
      void _m;
      void _s;
      return rest;
    }),
    total: raw.total,
    page: raw.page,
    per_page: raw.per_page,
    pages: raw.pages,
  };
}

async function fetchInitialClients(): Promise<ClientsListResponse> {
  try {
    const client = await getServerClient();
    const raw = await client.getJson<RawClientsListResponse>(
      "/api/clients/",
      { params: { page: 1, per_page: DEFAULT_PER_PAGE } },
    );
    return projectListResponse(raw);
  } catch {
    return { items: [], total: 0, page: 1, per_page: DEFAULT_PER_PAGE, pages: 0 };
  }
}

/**
 * Internal Clients List.
 *
 * Lists every client with search + pagination + soft-delete confirm.
 * `/clients/new` and `/clients/{id}/edit` remain on Vue (separate
 * migration). Edit + Delete row actions are role-gated via
 * CLIENT_UPDATE / CLIENT_DELETE.
 */
export default async function ClientsPage(): Promise<React.ReactElement> {
  const token = await getSessionToken();
  if (!token) redirect("/login?next=/clients");

  const role = await resolveUserRole();
  const initialData = await fetchInitialClients();

  return (
    <div className="mx-auto max-w-[1400px] py-2">
      <ClientsClient initialData={initialData} role={role} />
    </div>
  );
}
