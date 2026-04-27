"use client";

import * as React from "react";
import { canAccess, Resource, type UserRole } from "@harvesterp/lib";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/primitives/button";
import { Label } from "@/components/primitives/label";

/**
 * <FactoryNotAssignedBanner> — only renders when:
 *   status === "DRAFT" AND factory_id === null.
 *
 * Mirrors `OrderDetail.vue:650-677`: amber warning + inline factory picker
 * + Assign button.
 *
 * Role-gated to ORDER_UPDATE (matches matrix.ts: ADMIN | OPERATIONS).
 */

interface FactoryOption {
  id: string;
  name: string;
}

interface FactoryNotAssignedBannerProps {
  role: UserRole | undefined;
  factories: FactoryOption[];
  factoriesLoading: boolean;
  onFactoriesNeeded: () => void;
  onAssign: (factoryId: string) => void;
  isPending: boolean;
}

export function FactoryNotAssignedBanner({
  role,
  factories,
  factoriesLoading,
  onFactoriesNeeded,
  onAssign,
  isPending,
}: FactoryNotAssignedBannerProps): React.ReactElement {
  const [factoryId, setFactoryId] = React.useState("");
  const canAssign = role ? canAccess(role, Resource.ORDER_UPDATE) : false;

  return (
    <section
      className="rounded-lg border border-amber-200 bg-amber-50 p-4"
      aria-label="Factory not assigned"
      data-testid="factory-not-assigned-banner"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          size={18}
          className="mt-0.5 text-amber-700"
          aria-hidden="true"
        />
        <div className="flex-1 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-amber-900">
              Factory not assigned
            </h2>
            <p className="text-xs text-amber-700">
              You can&apos;t advance this order until a factory is selected.
            </p>
          </div>

          {canAssign ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1">
                <Label htmlFor="fna-factory">Factory</Label>
                <select
                  id="fna-factory"
                  value={factoryId}
                  onChange={(e) => setFactoryId(e.target.value)}
                  onFocus={onFactoriesNeeded}
                  className="mt-1 w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm"
                  disabled={isPending}
                  data-testid="fna-factory-select"
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
              <Button
                size="sm"
                onClick={() => onAssign(factoryId)}
                disabled={!factoryId || isPending}
                aria-label="Assign factory to this order"
              >
                {isPending ? "Assigning…" : "Assign factory"}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-amber-700">
              Only ADMIN, OPERATIONS, or SUPER_ADMIN can assign a factory.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
