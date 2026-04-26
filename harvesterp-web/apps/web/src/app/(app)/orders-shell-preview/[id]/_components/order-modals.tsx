"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AlertDialog } from "@/components/primitives/alert-dialog";
import { DeleteConfirmDialog } from "@/components/composed/delete-confirm-dialog";
import { Textarea } from "@/components/primitives/textarea";
import { Label } from "@/components/primitives/label";
import type { StageOption } from "./types";

/**
 * Six page-level modals for the order-detail shell.
 *
 * Mirrors `OrderDetail.vue:830-954`:
 *   1. DeleteOrderModal       — typed "DELETE" guard + Cancel/Delete
 *   2. ReopenOrderModal       — required reason textarea + Cancel/Re-open
 *   3. TransitionConfirmModal — "Advance to S{n}?" + Cancel/Confirm
 *   4. GoBackConfirmModal     — "Revert to S{n}?" + Cancel/Go Back
 *   5. WarningAckModal        — list + required reason + Proceed Anyway
 *   6. JumpToStageModal       — forward / backward variant
 *
 * Built on the existing primitives:
 *   - <DeleteConfirmDialog>  for delete + reopen (it supports typed
 *     confirmation + reason out of the box)
 *   - <AlertDialog>          for transition + goback + jump-to-stage
 *     (simple confirm/cancel)
 *   - Direct Radix Dialog    for the warning-ack modal (richer content)
 *
 * NO Vue blocking `confirm()` / `alert()` patterns survive the port.
 */

// ── 1. Delete confirmation ──────────────────────────────────────────────────

interface DeleteOrderModalProps {
  open: boolean;
  onClose: () => void;
  orderNumber: string;
  onConfirm: () => Promise<void> | void;
  isPending: boolean;
}

export function DeleteOrderModal({
  open,
  onClose,
  orderNumber,
  onConfirm,
  isPending,
}: DeleteOrderModalProps): React.ReactElement {
  return (
    <DeleteConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={`Delete draft order ${orderNumber}?`}
      body="This permanently removes the draft and all its line items. The action cannot be undone."
      confirmText="Delete"
      requireTypedConfirmation="DELETE"
      isPending={isPending}
    />
  );
}

// ── 2. Re-open ──────────────────────────────────────────────────────────────

interface ReopenOrderModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void> | void;
  isPending: boolean;
}

export function ReopenOrderModal({
  open,
  onClose,
  onConfirm,
  isPending,
}: ReopenOrderModalProps): React.ReactElement {
  return (
    <DeleteConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Re-open this completed order?"
      body="The order will move to COMPLETED_EDITING. The reason is recorded in the audit history."
      confirmText="Re-open"
      reasonRequired
      isPending={isPending}
    />
  );
}

// ── 3. Transition confirm ───────────────────────────────────────────────────

interface TransitionConfirmModalProps {
  target: StageOption | null;
  onCancel: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function TransitionConfirmModal({
  target,
  onCancel,
  onConfirm,
}: TransitionConfirmModalProps): React.ReactElement {
  return (
    <AlertDialog
      open={target !== null}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
      title={
        target ? `Advance to S${target.stage} · ${target.name}?` : "Advance"
      }
      description="The order's status will change immediately. The transition is recorded in the timeline."
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      onConfirm={onConfirm}
    />
  );
}

// ── 4. Go-back confirm ──────────────────────────────────────────────────────

interface GoBackConfirmModalProps {
  prevStage: StageOption | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function GoBackConfirmModal({
  prevStage,
  onCancel,
  onConfirm,
}: GoBackConfirmModalProps): React.ReactElement {
  return (
    <AlertDialog
      open={prevStage !== null}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
      title={
        prevStage
          ? `Go back to S${prevStage.stage} · ${prevStage.name}?`
          : "Go back"
      }
      description="The order's status will revert. Use this only when an advance was recorded in error."
      confirmLabel="Go back"
      cancelLabel="Cancel"
      variant="destructive"
      onConfirm={onConfirm}
    />
  );
}

// ── 5. Warning acknowledge (custom — needs list + textarea) ─────────────────

interface WarningAckModalProps {
  open: boolean;
  warnings: string[];
  onCancel: () => void;
  onProceed: (reason: string) => void;
  isPending: boolean;
}

export function WarningAckModal({
  open,
  warnings,
  onCancel,
  onProceed,
  isPending,
}: WarningAckModalProps): React.ReactElement {
  // Inner form is keyed by `open` so it remounts (and resets local state)
  // on each open() — avoids setState-in-effect anti-pattern.
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl",
          )}
          data-testid="warning-ack-modal"
        >
          {open ? (
            <WarningAckForm
              warnings={warnings}
              onProceed={onProceed}
              isPending={isPending}
            />
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface WarningAckFormProps {
  warnings: string[];
  onProceed: (reason: string) => void;
  isPending: boolean;
}

function WarningAckForm({
  warnings,
  onProceed,
  isPending,
}: WarningAckFormProps): React.ReactElement {
  const [reason, setReason] = React.useState("");
  const ready = reason.trim().length > 0 && !isPending;

  return (
    <>
      <Dialog.Title className="flex items-center gap-2 text-base font-semibold text-amber-700">
        <AlertTriangle size={18} />
        Stage transition has warnings
      </Dialog.Title>
      <Dialog.Description className="mt-2 text-sm text-slate-500">
        The backend flagged the following before allowing this transition:
      </Dialog.Description>
      <ul className="mt-3 space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        {warnings.map((w, i) => (
          <li key={i}>• {w}</li>
        ))}
      </ul>
      <div className="mt-3">
        <Label htmlFor="warning-reason">
          Reason for proceeding (required)
        </Label>
        <Textarea
          id="warning-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain why you're overriding these warnings"
          rows={3}
          disabled={isPending}
        />
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Dialog.Close asChild>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            disabled={isPending}
          >
            Cancel
          </button>
        </Dialog.Close>
        <button
          type="button"
          onClick={() => onProceed(reason.trim())}
          disabled={!ready}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : null}
          Proceed Anyway
        </button>
      </div>
    </>
  );
}

// ── 6. Jump-to-stage confirm ────────────────────────────────────────────────

interface JumpToStageModalProps {
  target: StageOption | null;
  isBackward: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function JumpToStageModal({
  target,
  isBackward,
  onCancel,
  onConfirm,
}: JumpToStageModalProps): React.ReactElement {
  return (
    <AlertDialog
      open={target !== null}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
      title={
        target
          ? isBackward
            ? `Jump back to S${target.stage} · ${target.name}?`
            : `Return to S${target.stage} · ${target.name}?`
          : ""
      }
      description={
        isBackward
          ? "The order will revert to this earlier stage. Subsequent stage history is preserved."
          : "The order will jump back to this stage so you can re-do the work between here and the current stage."
      }
      confirmLabel={isBackward ? "Jump Back" : "Return"}
      cancelLabel="Cancel"
      variant={isBackward ? "destructive" : "default"}
      onConfirm={onConfirm}
    />
  );
}
