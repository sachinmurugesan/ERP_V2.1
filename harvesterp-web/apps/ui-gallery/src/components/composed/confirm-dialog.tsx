"use client";

/**
 * <ConfirmDialog> — D-003 canonical implementation.
 *
 * Replaces all native window.confirm() / window.alert() calls across the
 * migration. Every destructive operation in the Next.js rebuild MUST use
 * this component.
 *
 * Props spec: DECISIONS.md § D-003
 * String types: DECISIONS.md § D-005 / packages/lib/src/strings/
 *
 * "use client" — this component is interactive; it uses React state and
 * event handlers. Forward-compatible: keep the directive for Task 7 port.
 */

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  type DialogString,
  type InternalString,
  resolveString,
} from "@harvesterp/lib";
import { Button } from "@/components/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/primitives/dialog";
import { Input } from "@/components/primitives/input";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ConfirmDialogPreserveContext {
  /** English fallback summary shown in the context card. */
  summary: string;
  /** Optional bilingual summary (D-005 DialogString). */
  bilingualSummary?: { en: string; ta: string };
  /**
   * Affected item count or key/value pairs for the consequence table.
   * Pass a number for simple count display; pass an array for a labelled table.
   */
  affectedItems?: number | Array<{ label: string; value: string }>;
}

export interface ConfirmDialogProps {
  /** Controls dialog open state — caller owns state. */
  open: boolean;
  /** Called when the user dismisses (X, cancel, Escape). */
  onCancel: () => void;
  /** Title string (D-005 types — DialogString for portal/dialog contexts). */
  title: InternalString | DialogString;
  /** Message / description string. */
  message: InternalString | DialogString;
  /**
   * Consequence text (D-003) — "This will delete 47 line items and cannot be undone."
   * Shown beneath the message in a destructive-aware colour.
   */
  consequenceText?: InternalString | DialogString;
  /** Red confirm button variant (D-003: highest-risk operations). */
  destructive?: boolean;
  /**
   * User must type this string exactly before confirm becomes active.
   * Use for hard-delete / bulk-cancel operations (D-003: "DELETE").
   */
  requireTypedConfirmation?: string;
  /** Confirm CTA label. Defaults to "Delete" when destructive, else "Confirm". */
  confirmLabel?: string;
  /** Cancel CTA label. Default "Cancel". */
  cancelLabel?: string;
  /**
   * Optional upstream context card shown inside the dialog so the user
   * knows exactly what they're about to affect (D-003 preserveContext).
   */
  preserveContext?: ConfirmDialogPreserveContext;
  /**
   * Called when the user clicks Confirm. May return a Promise — the button
   * shows a loading spinner while the Promise is pending.
   */
  onConfirm: () => void | Promise<void>;
  /** Active locale for resolving bilingual strings. Default "en". */
  locale?: "en" | "ta";
}

// ── Component ─────────────────────────────────────────────────────────────

export function ConfirmDialog({
  open,
  onCancel,
  title,
  message,
  consequenceText,
  destructive = false,
  requireTypedConfirmation,
  confirmLabel,
  cancelLabel = "Cancel",
  preserveContext,
  onConfirm,
  locale = "en",
}: ConfirmDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [typedValue, setTypedValue] = React.useState("");

  // Reset typed value when dialog opens/closes
  React.useEffect(() => {
    if (!open) setTypedValue("");
  }, [open]);

  const resolvedTitle = resolveString(title, locale);
  const resolvedMessage = resolveString(message, locale);
  const resolvedConsequence = consequenceText
    ? resolveString(consequenceText, locale)
    : undefined;

  const effectiveConfirmLabel =
    confirmLabel ?? (destructive ? "Delete" : "Confirm");

  const typedConfirmationSatisfied = requireTypedConfirmation
    ? typedValue === requireTypedConfirmation
    : true;

  const handleConfirm = async () => {
    if (!typedConfirmationSatisfied) return;
    const result = onConfirm();
    if (result instanceof Promise) {
      setLoading(true);
      try {
        await result;
      } finally {
        setLoading(false);
      }
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && !loading) onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{resolvedTitle}</DialogTitle>
          <DialogDescription asChild>
            <div>
              <p>{resolvedMessage}</p>
              {resolvedConsequence && (
                <p
                  className={cn(
                    "mt-1 text-sm font-medium",
                    destructive ? "text-destructive" : "text-foreground",
                  )}
                >
                  {resolvedConsequence}
                </p>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* preserveContext card */}
        {preserveContext && (
          <div className="rounded-md border bg-muted/50 p-3 text-sm">
            <p className="font-medium text-foreground">
              {preserveContext.bilingualSummary
                ? locale === "ta"
                  ? preserveContext.bilingualSummary.ta
                  : preserveContext.bilingualSummary.en
                : preserveContext.summary}
            </p>
            {typeof preserveContext.affectedItems === "number" && (
              <p className="mt-1 text-muted-foreground">
                {preserveContext.affectedItems} item
                {preserveContext.affectedItems !== 1 ? "s" : ""} affected
              </p>
            )}
            {Array.isArray(preserveContext.affectedItems) &&
              preserveContext.affectedItems.length > 0 && (
                <table className="mt-2 w-full text-xs">
                  <tbody>
                    {preserveContext.affectedItems.map((item) => (
                      <tr key={item.label}>
                        <td className="py-0.5 pr-4 text-muted-foreground">
                          {item.label}
                        </td>
                        <td className="py-0.5 font-medium text-foreground">
                          {item.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>
        )}

        {/* Typed confirmation input */}
        {requireTypedConfirmation && (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Type{" "}
              <code className="rounded bg-muted px-1 font-mono text-foreground">
                {requireTypedConfirmation}
              </code>{" "}
              to confirm.
            </p>
            <Input
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              placeholder={requireTypedConfirmation}
              className="font-mono"
              aria-label="Type to confirm"
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={loading || !typedConfirmationSatisfied}
            aria-label={effectiveConfirmLabel}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {effectiveConfirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
