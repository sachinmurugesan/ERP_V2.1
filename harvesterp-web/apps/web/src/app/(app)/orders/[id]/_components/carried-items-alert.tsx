"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, X } from "lucide-react";

/**
 * <CarriedItemsAlert> — dismissable amber banner shown after creating an
 * order with carry-forward items.
 *
 * Mirrors `OrderDetail.vue:720-735` + onMounted handler at lines 411-414.
 *
 * - Reads `?carried=N` from the URL on mount.
 * - Renders an alert with the count.
 * - Strips the `carried` query param when dismissed (or on first navigation).
 *
 * Self-contained — the parent doesn't need to thread any state through.
 */

export function CarriedItemsAlert(): React.ReactElement | null {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dismissed, setDismissed] = React.useState(false);

  // Read once on mount — subsequent URL changes shouldn't re-trigger.
  const initialCount = React.useMemo(() => {
    const raw = searchParams.get("carried");
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [searchParams]);

  function handleDismiss() {
    setDismissed(true);
    // Strip ?carried=N from URL.
    const params = new URLSearchParams(searchParams.toString());
    params.delete("carried");
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  if (initialCount === 0 || dismissed) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
      data-testid="carried-items-alert"
    >
      <div className="flex items-center gap-2">
        <CheckCircle size={16} className="shrink-0" />
        <span>
          {initialCount} carry-forward {initialCount === 1 ? "item was" : "items were"}{" "}
          attached to this order. Review them in the Items tab.
        </span>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss carry-forward notice"
        className="rounded-md p-1 hover:bg-amber-100"
      >
        <X size={14} />
      </button>
    </div>
  );
}
