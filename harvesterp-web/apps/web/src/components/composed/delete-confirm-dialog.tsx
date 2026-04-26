"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * DeleteConfirmDialog — generic destructive-confirm modal.
 *
 * Replaces ad-hoc "delete <subject>" confirms across pages. Supports:
 *   - subject in title + body templating
 *   - typed-confirmation guard (D-003): user must type a token to enable
 *   - optional reason field
 *   - pending state during async confirm
 *
 * Used by clients-list (this migration) and transporters-list (next).
 * Existing per-page dialogs (e.g. ProductConfirmDialog) will migrate
 * to this in a follow-up cleanup PR — do NOT refactor them in this PR.
 */

export interface DeleteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /** Async confirm handler. Component shows pending state via isPending. */
  onConfirm: (reason?: string) => Promise<void> | void;
  title: string;
  body: string;
  /** Defaults to "Delete". */
  confirmText?: string | undefined;
  /** Defaults to "Cancel". */
  cancelText?: string | undefined;
  /** When set, the user must type this value exactly to enable Confirm. */
  requireTypedConfirmation?: string | undefined;
  /** When true, shows a Reason textarea and passes it to onConfirm. */
  reasonRequired?: boolean | undefined;
  /** Disables Confirm + shows spinner + suppresses dismissal. */
  isPending?: boolean | undefined;
}

export function DeleteConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmText = "Delete",
  cancelText = "Cancel",
  requireTypedConfirmation,
  reasonRequired = false,
  isPending = false,
}: DeleteConfirmDialogProps): React.ReactElement {
  const [typed, setTyped] = React.useState("");
  const [reason, setReason] = React.useState("");

  // Reset internal fields whenever the dialog re-opens.
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setTyped("");
      setReason("");
    }
  }

  const typedOk =
    !requireTypedConfirmation || typed.trim() === requireTypedConfirmation;
  const reasonOk = !reasonRequired || reason.trim().length > 0;
  const canConfirm = typedOk && reasonOk && !isPending;

  async function handleConfirm() {
    if (!canConfirm) return;
    await onConfirm(reasonRequired ? reason.trim() : undefined);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (isPending) return;
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl",
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle size={18} aria-hidden="true" />
            </div>
            <div className="flex-1">
              <Dialog.Title className="text-base font-semibold text-slate-800">
                {title}
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-slate-500">
                {body}
              </Dialog.Description>
            </div>
          </div>

          {requireTypedConfirmation ? (
            <div className="mt-4">
              <label
                htmlFor="delete-typed-confirmation"
                className="block text-xs font-medium uppercase tracking-wide text-slate-500"
              >
                Type{" "}
                <span className="font-mono text-slate-700">
                  {requireTypedConfirmation}
                </span>{" "}
                to confirm
              </label>
              <input
                id="delete-typed-confirmation"
                type="text"
                autoComplete="off"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                disabled={isPending}
              />
            </div>
          ) : null}

          {reasonRequired ? (
            <div className="mt-4">
              <label
                htmlFor="delete-reason"
                className="block text-xs font-medium uppercase tracking-wide text-slate-500"
              >
                Reason
              </label>
              <textarea
                id="delete-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                disabled={isPending}
              />
            </div>
          ) : null}

          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button
                type="button"
                disabled={isPending}
                className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {cancelText}
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : null}
              {confirmText}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
