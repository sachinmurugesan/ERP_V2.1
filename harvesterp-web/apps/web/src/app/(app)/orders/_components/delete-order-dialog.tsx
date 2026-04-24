"use client";

import * as React from "react";
import { Icon } from "@/components/design-system/icon";

const CONFIRM_WORD = "DELETE";

export interface DeleteOrderDialogProps {
  open: boolean;
  orderNumber: string;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}

/**
 * Local delete confirmation dialog with typed confirmation (user must type
 * "DELETE" to enable the destructive button) + optional reason textarea.
 *
 * Built inline rather than porting the ui-gallery `confirm-dialog` to keep
 * this migration self-contained (Phase 2 decision #4).
 *
 * Keyboard:
 *   - Escape closes the dialog (if not mid-submit).
 *   - Focus is captured on mount to the typed-confirmation input.
 *   - Overlay click cancels; dialog click does not.
 */
export function DeleteOrderDialog({
  open,
  orderNumber,
  onCancel,
  onConfirm,
}: DeleteOrderDialogProps): React.ReactElement | null {
  if (!open) return null;
  return (
    <DeleteOrderDialogBody
      orderNumber={orderNumber}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

/**
 * Inner component — always renders fresh when the dialog opens because the
 * parent only mounts this when `open=true`. Keeps state reset clean without
 * needing a useEffect-based reset.
 */
function DeleteOrderDialogBody({
  orderNumber,
  onCancel,
  onConfirm,
}: {
  orderNumber: string;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}): React.ReactElement {
  const [typed, setTyped] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(id);
    };
  }, []);

  React.useEffect(() => {
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && !submitting) onCancel();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [submitting, onCancel]);

  const confirmEnabled = typed.trim().toUpperCase() === CONFIRM_WORD;

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (!confirmEnabled || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
    } catch (err) {
      setSubmitting(false);
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Delete failed. Please try again.",
      );
    }
  };

  return (
    <div
      role="presentation"
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11, 13, 15, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 100,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-order-title"
        aria-describedby="delete-order-description"
        onClick={(e) => e.stopPropagation()}
        className="card card-pad"
        style={{
          width: "100%",
          maxWidth: 440,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            aria-hidden="true"
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--r-sm)",
              background: "color-mix(in oklch, var(--err) 12%, transparent)",
              color: "var(--err)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="warning" size={16} />
          </span>
          <h2
            id="delete-order-title"
            style={{
              fontSize: 15,
              fontWeight: 700,
              margin: 0,
              color: "var(--fg)",
            }}
          >
            Delete order {orderNumber}?
          </h2>
        </div>

        <p
          id="delete-order-description"
          style={{
            fontSize: 13,
            color: "var(--fg-muted)",
            margin: 0,
          }}
        >
          This action soft-deletes the order. The order can be restored from
          audit logs, but all downstream references will break until restore.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span
              className="label"
              style={{ color: "var(--fg)", textTransform: "none" }}
            >
              Type <strong className="mono">{CONFIRM_WORD}</strong> to confirm
            </span>
            <input
              ref={inputRef}
              type="text"
              className="input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              aria-label={`Type ${CONFIRM_WORD} to confirm`}
              disabled={submitting}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span
              className="label"
              style={{ color: "var(--fg)", textTransform: "none" }}
            >
              Reason (optional)
            </span>
            <textarea
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              disabled={submitting}
              style={{ minHeight: 72, padding: 10, resize: "vertical" }}
            />
          </label>

          {error && (
            <p
              role="alert"
              style={{
                fontSize: 12,
                color: "var(--err)",
                margin: 0,
                fontWeight: 500,
              }}
            >
              {error}
            </p>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 4,
            }}
          >
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="btn btn-sm btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!confirmEnabled || submitting}
              className="btn btn-sm btn-danger"
              style={{
                opacity: !confirmEnabled || submitting ? 0.5 : 1,
                cursor:
                  !confirmEnabled || submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Deleting\u2026" : "Delete order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
