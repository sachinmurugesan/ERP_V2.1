"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VariantCheckResponse } from "./form-types";

interface VariantResolutionDialogProps {
  open: boolean;
  productCode: string;
  check: VariantCheckResponse;
  onCancel: () => void;
  onConfirm: (action: "add_new" | "replace", replaceId?: string) => void;
}

/**
 * Opened when the user tries to CREATE a product whose part_code already
 * has existing variants. Lets them choose to add a new variant or replace
 * an existing one.
 */
export function VariantResolutionDialog({
  open,
  productCode,
  check,
  onCancel,
  onConfirm,
}: VariantResolutionDialogProps): React.ReactElement {
  const [action, setAction] = React.useState<"add_new" | "replace">("add_new");
  const [replaceId, setReplaceId] = React.useState<string>("");
  const [expanded, setExpanded] = React.useState(false);

  const canConfirm = action === "add_new" || Boolean(replaceId);

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-white shadow-2xl">
          <header className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-6 py-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle size={18} className="text-amber-600" />
            </div>
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-800">
                Existing Variants Found
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-slate-500">
                Part code{" "}
                <span className="font-mono font-medium text-amber-700">
                  {productCode}
                </span>{" "}
                already has {check.variant_count} variant
                {check.variant_count === 1 ? "" : "s"}
              </Dialog.Description>
            </div>
          </header>

          <div className="px-6 py-4">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex w-full items-center gap-2 text-left"
              aria-expanded={expanded}
            >
              {expanded ? (
                <ChevronDown size={14} className="text-slate-400" />
              ) : (
                <ChevronRight size={14} className="text-slate-400" />
              )}
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Current Variants
              </span>
              <span className="text-xs text-slate-300">
                ({check.variant_count})
              </span>
            </button>

            {expanded ? (
              <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                {check.variants.map((v, idx) => (
                  <li
                    key={v.id}
                    className="rounded-lg border border-slate-100 bg-slate-50 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">
                        {idx + 1}
                      </div>
                      <p className="flex-1 truncate text-sm font-medium text-slate-700">
                        {v.product_name}
                      </p>
                      {v.is_default ? (
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                          Default
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="px-6 pb-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
              Choose Action
            </p>
            <div className="space-y-2">
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                  action === "add_new"
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-slate-200 hover:border-slate-300",
                )}
              >
                <input
                  type="radio"
                  name="variant-action"
                  value="add_new"
                  checked={action === "add_new"}
                  onChange={() => setAction("add_new")}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    Add as New Variant
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Create an additional variant under this part code
                  </p>
                </div>
              </label>

              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                  action === "replace"
                    ? "border-amber-300 bg-amber-50"
                    : "border-slate-200 hover:border-slate-300",
                )}
              >
                <input
                  type="radio"
                  name="variant-action"
                  value="replace"
                  checked={action === "replace"}
                  onChange={() => setAction("replace")}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-700">
                    Replace Existing Variant
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Overwrite an existing variant&apos;s data with the new values
                  </p>
                  {action === "replace" ? (
                    <select
                      value={replaceId}
                      onChange={(e) => setReplaceId(e.target.value)}
                      aria-label="Select variant to replace"
                      className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm focus:border-amber-300 focus:ring-2 focus:ring-amber-300"
                    >
                      <option value="">Select variant to replace…</option>
                      {check.variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.product_name}
                          {v.material ? ` — ${v.material}` : ""}
                          {v.dimension ? ` (${v.dimension})` : ""}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              </label>
            </div>
          </div>

          <footer className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canConfirm}
              onClick={() =>
                onConfirm(action, action === "replace" ? replaceId : undefined)
              }
              className={cn(
                "rounded-lg px-5 py-2 text-sm font-medium text-white disabled:opacity-50",
                action === "replace"
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-emerald-600 hover:bg-emerald-700",
              )}
            >
              {action === "replace" ? "Replace Variant" : "Add Variant"}
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
