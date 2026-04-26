import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { type UserRole } from "@harvesterp/lib";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import { Button } from "@/components/primitives/button";
import { OrderShellClient } from "./_components/order-shell-client";
import type { OrderDetail } from "./_components/types";

export const dynamic = "force-dynamic";

/**
 * Sandbox page for the order-detail shell migration.
 *
 * Lives at `/orders-shell-preview/{id}` (NOT `/orders/{id}`) — the real
 * route takeover happens in Phase 2 alongside at least one migrated tab
 * (per Phase 2 §2.4 decision B3 in the migration log). This sandbox lets
 * us validate the shell + transition flow + tab nav without disrupting
 * production users.
 *
 * Renders an explicit error / 404 / 403 state — fixes the Vue gap where
 * `OrderDetail.vue` would silently render an empty <div> on initial-load
 * failure.
 */

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

type FetchOutcome =
  | { kind: "ok"; order: OrderDetail }
  | { kind: "not-found" }
  | { kind: "forbidden" }
  | { kind: "error"; message: string };

async function fetchOrder(id: string): Promise<FetchOutcome> {
  try {
    const client = await getServerClient();
    const order = await client.getJson<OrderDetail>(
      `/api/orders/${encodeURIComponent(id)}/`,
    );
    return { kind: "ok", order };
  } catch (err) {
    const status =
      err instanceof Error && "status" in err
        ? Number((err as { status?: number }).status ?? 0)
        : 0;
    if (status === 404) return { kind: "not-found" };
    if (status === 403) return { kind: "forbidden" };
    return {
      kind: "error",
      message:
        err instanceof Error && err.message
          ? err.message
          : "Failed to load order",
    };
  }
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderShellPreviewPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const token = await getSessionToken();
  const { id } = await params;
  if (!token) redirect(`/login?next=/orders-shell-preview/${id}`);

  const [role, outcome] = await Promise.all([
    resolveUserRole(),
    fetchOrder(id),
  ]);

  if (outcome.kind === "not-found") {
    return <NotFoundCard id={id} />;
  }
  if (outcome.kind === "forbidden") {
    return <ForbiddenCard id={id} />;
  }
  if (outcome.kind === "error") {
    return <ErrorCard id={id} message={outcome.message} />;
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-4">
      <SandboxNotice />
      <OrderShellClient initialOrder={outcome.order} role={role} />
    </div>
  );
}

// ── State cards (replace Vue's silent empty-div failure mode) ───────────────

function SandboxNotice(): React.ReactElement {
  return (
    <div
      className="mb-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800"
      role="status"
    >
      <strong>Sandbox preview.</strong> This is a Phase 1 sandbox of the
      order-detail shell at <code>/orders-shell-preview/[id]</code>. The real
      route at <code>/orders/[id]</code> still serves the Vue page. Tab content
      panels are deliberately deferred — clicking any tab redirects to the Vue
      legacy view.
    </div>
  );
}

function NotFoundCard({ id }: { id: string }): React.ReactElement {
  return (
    <div className="mx-auto max-w-md p-12 text-center" data-testid="state-not-found">
      <h1 className="text-xl font-semibold text-slate-800">Order not found</h1>
      <p className="mt-2 text-sm text-slate-500">
        No order with id <code>{id}</code> exists, or it has been deleted.
      </p>
      <div className="mt-6">
        <Link href="/orders">
          <Button>Back to orders list</Button>
        </Link>
      </div>
    </div>
  );
}

function ForbiddenCard({ id }: { id: string }): React.ReactElement {
  return (
    <div className="mx-auto max-w-md p-12 text-center" data-testid="state-forbidden">
      <h1 className="text-xl font-semibold text-slate-800">Access denied</h1>
      <p className="mt-2 text-sm text-slate-500">
        You don&apos;t have permission to view order <code>{id}</code>. Ask an
        administrator to grant access.
      </p>
      <div className="mt-6">
        <Link href="/orders">
          <Button>Back to orders list</Button>
        </Link>
      </div>
    </div>
  );
}

function ErrorCard({
  id,
  message,
}: {
  id: string;
  message: string;
}): React.ReactElement {
  return (
    <div className="mx-auto max-w-md p-12 text-center" data-testid="state-error">
      <h1 className="text-xl font-semibold text-slate-800">
        Could not load order
      </h1>
      <p className="mt-2 text-sm text-slate-500">{message}</p>
      <p className="mt-1 text-xs text-slate-400">Order id: {id}</p>
      <div className="mt-6 flex justify-center gap-2">
        <Link href={`/orders-shell-preview/${id}`}>
          <Button variant="outline">Retry</Button>
        </Link>
        <Link href="/orders">
          <Button>Back to orders list</Button>
        </Link>
      </div>
    </div>
  );
}

