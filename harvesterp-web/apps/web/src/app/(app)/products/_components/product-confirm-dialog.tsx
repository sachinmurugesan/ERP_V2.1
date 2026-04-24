"use client";

import * as React from "react";
import { Icon } from "@/components/design-system/icon";

export type ConfirmScenario = "single" | "bulk" | "bin-permanent";

export interface ProductConfirmDialogProps {
  open: boolean;
  scenario: ConfirmScenario;
  /** Single-delete: the product code being deleted. Bulk: ignored. Bin-permanent: the product code required as typed confirmation. */
  productCode?: string | null;
  /** Single-delete: product display name. Bulk: count. */
  productName?: string | null;
  /** Bulk: number of products to delete. */
  count?: number;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

/**
 * Unified three-scenario confirmation dialog.
 *
 * A — Single delete: no typed confirmation.
 * B — Bulk delete: user must type "DELETE".
 * C — Bin permanent delete: user must type the product's part code —
 *     highest-stakes action, highest-friction confirmation.
 *
 * Outer component returns null when !open. Inner Body always mounts
 * fresh so the typed-confirmation input resets between openings.
 */
export function ProductConfirmDialog(
  props: ProductConfirmDialogProps,
): React.ReactElement | null {
  if (!props.open) return null;
  return <ProductConfirmDialogBody {...props} />;
}

function ProductConfirmDialogBody({
  scenario,
  productCode,
  productName,
  count,
  onCancel,
  onConfirm,
}: ProductConfirmDialogProps): React.ReactElement {
  const [typed, setTyped] = React.useState("");
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

  const requiredWord =
    scenario === "bulk"
      ? "DELETE"
      : scenario === "bin-permanent"
        ? (productCode ?? "")
        : null;

  const needsTyped = requiredWord !== null;
  const typedMatches = needsTyped
    ? typed.trim() === requiredWord
    : true;
  const canConfirm = typedMatches && !submitting;

  const title =
    scenario === "single"
      ? `Delete ${productCode ?? "this product"}?`
      : scenario === "bulk"
        ? `Delete ${count ?? 0} products?`
        : `Permanently delete ${productCode ?? "this product"}?`;

  const description =
    scenario === "single"
      ? `${productName ?? "This product"} will be moved to the bin. You can restore it later.`
      : scenario === "bulk"
        ? `This will move ${count ?? 0} products to the bin. You can restore them later.`
        : "This product will be deleted forever and cannot be recovered.";

  const confirmLabel =
    scenario === "single"
      ? "Delete"
      : scenario === "bulk"
        ? `Delete ${count ?? 0}`
        : "Delete forever";

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (!canConfirm) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
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
        aria-labelledby="product-confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="card card-pad"
        style={{
          width: "100%",
          maxWidth: 460,
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
              background:
                "color-mix(in oklch, var(--err) 12%, transparent)",
              color: "var(--err)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="warning" size={16} />
          </span>
          <h2
            id="product-confirm-title"
            style={{
              fontSize: 15,
              fontWeight: 700,
              margin: 0,
              color: "var(--fg)",
            }}
          >
            {title}
          </h2>
        </div>

        <p
          style={{
            fontSize: 13,
            color: "var(--fg-muted)",
            margin: 0,
          }}
        >
          {description}
        </p>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          {needsTyped && (
            <label
              style={{ display: "flex", flexDirection: "column", gap: 6 }}
            >
              <span
                className="label"
                style={{ color: "var(--fg)", textTransform: "none" }}
              >
                Type <strong className="mono">{requiredWord}</strong> to confirm
              </span>
              <input
                ref={inputRef}
                type="text"
                className="input"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                aria-label={`Type ${requiredWord} to confirm`}
                disabled={submitting}
              />
            </label>
          )}

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
              disabled={!canConfirm}
              className="btn btn-sm btn-danger"
              style={{
                opacity: canConfirm ? 1 : 0.5,
                cursor: canConfirm ? "pointer" : "not-allowed",
              }}
            >
              {submitting ? "Deleting\u2026" : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
