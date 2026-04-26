"use client";

import * as React from "react";
import { AlertCircle, X } from "lucide-react";

/**
 * <TransitionErrorBanner> — clickable red banner for transition / go-back /
 * jump-to-stage errors returned by the backend.
 *
 * Mirrors `OrderDetail.vue:634-647` + `navigateToFix(error)` (lines 95-115).
 * Maps known backend error substrings to a `tab` + `highlightSection` so
 * clicking the banner switches the user to the relevant tab and scrolls
 * to the offending section.
 *
 * Mapping (preserve Vue logic):
 *   "Client is required"           → tab="items"     section="client"
 *   "missing selling prices"       → tab="items"     section="pricing"
 *   "payment must be recorded"     → tab="payments"  section="add-payment"
 *   "Order must have at least one item" → tab="items" section="add-item"
 *   "PI not generated"             → tab="items"     section="pi"
 *   (anything else)                → no jump, just show error
 */

interface NavigateToFix {
  tab: string;
  highlightSection: string;
}

const ERROR_MAP: Array<[RegExp, NavigateToFix]> = [
  [/client is required/i, { tab: "items", highlightSection: "client" }],
  [/missing selling prices/i, { tab: "items", highlightSection: "pricing" }],
  [
    /payment must be recorded/i,
    { tab: "payments", highlightSection: "add-payment" },
  ],
  [
    /at least one item/i,
    { tab: "items", highlightSection: "add-item" },
  ],
  [/pi not generated/i, { tab: "items", highlightSection: "pi" }],
  [/factory not assigned/i, { tab: "dashboard", highlightSection: "factory" }],
];

export function navigateToFix(message: string): NavigateToFix | null {
  for (const [pattern, target] of ERROR_MAP) {
    if (pattern.test(message)) return target;
  }
  return null;
}

interface TransitionErrorBannerProps {
  error: string | null;
  onDismiss: () => void;
  onJumpToFix: (target: NavigateToFix) => void;
}

export function TransitionErrorBanner({
  error,
  onDismiss,
  onJumpToFix,
}: TransitionErrorBannerProps): React.ReactElement | null {
  if (!error) return null;

  const fix = navigateToFix(error);

  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      data-testid="transition-error-banner"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <AlertCircle size={16} aria-hidden="true" className="shrink-0" />
        {fix ? (
          <button
            type="button"
            onClick={() => onJumpToFix(fix)}
            className="text-left underline-offset-2 hover:underline"
          >
            {error}{" "}
            <span className="text-xs italic text-red-600">— click to fix</span>
          </button>
        ) : (
          <span>{error}</span>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="rounded-md p-1 hover:bg-red-100"
      >
        <X size={14} />
      </button>
    </div>
  );
}
