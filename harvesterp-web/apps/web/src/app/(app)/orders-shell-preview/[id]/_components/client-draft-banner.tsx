"use client";

import * as React from "react";
import { canAccess, Resource, type UserRole } from "@harvesterp/lib";
import { Inbox } from "lucide-react";
import { Button } from "@/components/primitives/button";
import { Label } from "@/components/primitives/label";

/**
 * <ClientDraftBanner> — only renders when status === "CLIENT_DRAFT".
 *
 * Mirrors `OrderDetail.vue:476-536`: factory <select> (lazy-loaded),
 * currency <select>, "Approve & Create Order" button.
 *
 * Role-gated to ORDER_APPROVE_INQUIRY (matches backend "any INTERNAL"
 * scope = ADMIN | OPERATIONS | FINANCE | SUPER_ADMIN bypass).
 *
 * Errors surface as toasts via the parent's onError callback (no
 * blocking alert() — fixes Vue's biggest DX gap).
 */

interface FactoryOption {
  id: string;
  name: string;
}

interface ClientDraftBannerProps {
  role: UserRole | undefined;
  factories: FactoryOption[];
  factoriesLoading: boolean;
  onFactoriesNeeded: () => void;
  onApprove: (factoryId: string, currency: string) => void;
  isPending: boolean;
}

export function ClientDraftBanner({
  role,
  factories,
  factoriesLoading,
  onFactoriesNeeded,
  onApprove,
  isPending,
}: ClientDraftBannerProps): React.ReactElement {
  const [factoryId, setFactoryId] = React.useState("");
  const [currency, setCurrency] = React.useState("USD");

  const canApprove = role
    ? canAccess(role, Resource.ORDER_APPROVE_INQUIRY)
    : false;

  return (
    <section
      className="rounded-lg border border-amber-200 bg-amber-50 p-4"
      aria-label="Client draft inquiry"
      data-testid="client-draft-banner"
    >
      <div className="flex items-start gap-3">
        <Inbox size={18} className="mt-0.5 text-amber-700" aria-hidden="true" />
        <div className="flex-1 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-amber-900">
              Client inquiry — needs approval
            </h2>
            <p className="text-xs text-amber-700">
              Assign a factory + select dealing currency, then approve to move
              this order into the workflow.
            </p>
          </div>

          {canApprove ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="cd-factory">Factory</Label>
                <select
                  id="cd-factory"
                  value={factoryId}
                  onChange={(e) => setFactoryId(e.target.value)}
                  onFocus={onFactoriesNeeded}
                  className="mt-1 w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm"
                  disabled={isPending}
                  data-testid="cd-factory-select"
                >
                  <option value="">
                    {factoriesLoading ? "Loading…" : "Select a factory"}
                  </option>
                  {factories.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="cd-currency">Currency</Label>
                <select
                  id="cd-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="mt-1 w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm"
                  disabled={isPending}
                  data-testid="cd-currency-select"
                >
                  <option value="USD">USD</option>
                  <option value="CNY">CNY</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="JPY">JPY</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => onApprove(factoryId, currency)}
                  disabled={!factoryId || isPending}
                  aria-label="Approve and create order"
                >
                  {isPending ? "Approving…" : "Approve & Create Order"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-amber-700">
              Only ADMIN, OPERATIONS, FINANCE, or SUPER_ADMIN can approve client
              inquiries.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
