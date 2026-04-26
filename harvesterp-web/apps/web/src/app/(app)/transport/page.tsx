import * as React from "react";
import { redirect } from "next/navigation";
import { type UserRole } from "@harvesterp/lib";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import { TransportClient } from "./_components/transport-client";
import type {
  RawTransportListResponse,
  TransportListResponse,
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
 * Strip fields the list page never displays. Defense-in-depth and
 * payload reduction. Same projection performed by the API proxy at
 * /api/transport — the page component performs it on the initial RSC
 * fetch so the bundle stays consistent.
 *
 * Stripped: email, address, country, bank_*, ifsc_code, notes.
 * Kept: id, name, contact_person, phone, city, state, gst_number,
 *       pan_number, roles, operating_ports, is_active, timestamps.
 */
function projectListResponse(
  raw: RawTransportListResponse,
): TransportListResponse {
  return {
    items: raw.items.map((p) => {
      const {
        email: _e,
        address: _a,
        country: _c,
        bank_name: _bn,
        bank_account: _ba,
        ifsc_code: _ic,
        notes: _n,
        ...rest
      } = p;
      void _e;
      void _a;
      void _c;
      void _bn;
      void _ba;
      void _ic;
      void _n;
      return rest;
    }),
    total: raw.total,
    page: raw.page,
    per_page: raw.per_page,
    pages: raw.pages,
  };
}

async function fetchInitialTransporters(): Promise<TransportListResponse> {
  try {
    const client = await getServerClient();
    const raw = await client.getJson<RawTransportListResponse>(
      "/api/shipping/transport/",
      { params: { page: 1, per_page: DEFAULT_PER_PAGE } },
    );
    return projectListResponse(raw);
  } catch {
    return {
      items: [],
      total: 0,
      page: 1,
      per_page: DEFAULT_PER_PAGE,
      pages: 0,
    };
  }
}

/**
 * Internal Service Providers (Transporters) List.
 *
 * Lists every service provider with search + pagination + soft-delete confirm.
 * `/transport/new` and `/transport/{id}/edit` remain on Vue (separate
 * migration). Add / Edit / Delete actions are role-gated via
 * TRANSPORT_CREATE / TRANSPORT_UPDATE / TRANSPORT_DELETE.
 */
export default async function TransportPage(): Promise<React.ReactElement> {
  const token = await getSessionToken();
  if (!token) redirect("/login?next=/transport");

  const role = await resolveUserRole();
  const initialData = await fetchInitialTransporters();

  return (
    <div className="mx-auto max-w-[1400px] py-2">
      <TransportClient initialData={initialData} role={role} />
    </div>
  );
}
