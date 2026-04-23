import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "@/components/composed/confirm-dialog";

const defaultProps = {
  open: true,
  onCancel: vi.fn(),
  title: { en: "Delete item?" },
  message: { en: "This action cannot be undone." },
  onConfirm: vi.fn(),
};

describe("ConfirmDialog", () => {
  it("renders title and message", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText("Delete item?")).toBeInTheDocument();
    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
  });

  it("calls onConfirm when confirm button clicked", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel button clicked", async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows loading spinner when onConfirm returns Promise", async () => {
    let resolveConfirm!: () => void;
    const onConfirm = vi.fn(
      () => new Promise<void>((r) => { resolveConfirm = r; }),
    );
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: /confirm/i }));
    // Spinner SVG appears while loading
    expect(
      screen.getByRole("button", { name: /confirm/i }),
    ).toBeDisabled();
    resolveConfirm();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /confirm/i })).not.toBeDisabled(),
    );
  });

  it("renders red button for destructive=true", () => {
    render(<ConfirmDialog {...defaultProps} destructive />);
    const btn = screen.getByRole("button", { name: /delete/i });
    expect(btn).toBeInTheDocument();
    // destructive variant class applied
    expect(btn.className).toMatch(/destructive/);
  });

  it("renders preserveContext summary card", () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        preserveContext={{
          summary: "Shipment SH-023 · 47 items",
          affectedItems: [{ label: "Items", value: "47" }],
        }}
      />,
    );
    expect(screen.getByText("Shipment SH-023 · 47 items")).toBeInTheDocument();
    expect(screen.getByText("47")).toBeInTheDocument();
  });

  it("disables confirm until typed confirmation matches", async () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        requireTypedConfirmation="DELETE"
      />,
    );
    const confirmBtn = screen.getByRole("button", { name: /confirm/i });
    expect(confirmBtn).toBeDisabled();

    const input = screen.getByRole("textbox", { name: /type to confirm/i });
    await userEvent.type(input, "DELETE");
    expect(confirmBtn).not.toBeDisabled();
  });

  it("does not render when open=false", () => {
    render(<ConfirmDialog {...defaultProps} open={false} />);
    expect(screen.queryByText("Delete item?")).not.toBeInTheDocument();
  });

  it("confirm button is keyboard-focusable", () => {
    render(<ConfirmDialog {...defaultProps} />);
    const confirmBtn = screen.getByRole("button", { name: /confirm/i });
    confirmBtn.focus();
    expect(document.activeElement).toBe(confirmBtn);
  });
});
