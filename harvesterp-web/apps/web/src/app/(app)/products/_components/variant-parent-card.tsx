import * as React from "react";
import { Link2 } from "lucide-react";
import type { Product } from "./types";

interface VariantParentCardProps {
  parent: Product;
}

/**
 * Shown at the top of the variant-mode form. Displays the parent product's
 * key identifying fields so the user knows exactly what they're adding a
 * variant under.
 */
export function VariantParentCard({
  parent,
}: VariantParentCardProps): React.ReactElement {
  return (
    <div
      role="region"
      aria-label="Variant parent product"
      className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4"
    >
      <div className="flex items-center gap-2 text-emerald-800">
        <Link2 size={14} />
        <span className="text-xs font-semibold uppercase tracking-wide">
          Adding variant under
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-mono text-sm font-semibold text-slate-800">
          {parent.product_code}
        </span>
        <span className="text-sm text-slate-600">{parent.product_name}</span>
        {parent.category ? (
          <span className="text-xs text-slate-500">
            · {parent.category}
          </span>
        ) : null}
      </div>
    </div>
  );
}
