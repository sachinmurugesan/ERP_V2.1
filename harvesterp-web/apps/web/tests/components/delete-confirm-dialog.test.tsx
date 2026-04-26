/**
 * delete-confirm-dialog.test.tsx — Unit tests for the shared
 * destructive-confirm modal.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { DeleteConfirmDialog } from "../../src/components/composed/delete-confirm-dialog";

describe("DeleteConfirmDialog — basic", () => {
  it("renders title + body when open", () => {
    render(
      <DeleteConfirmDialog
        open
        onClose={() => {}}
        onConfirm={() => {}}
        title="Delete client"
        body="This will soft-delete Acme Corp."
      />,
    );
    expect(screen.getByText(/delete client/i)).toBeInTheDocument();
    expect(screen.getByText(/acme corp/i)).toBeInTheDocument();
  });

  it("renders default Cancel + Delete buttons", () => {
    render(
      <DeleteConfirmDialog
        open
        onClose={() => {}}
        onConfirm={() => {}}
        title="t"
        body="b"
      />,
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("calls onConfirm when Delete clicked", async () => {
    const onConfirm = vi.fn();
    render(
      <DeleteConfirmDialog
        open
        onClose={() => {}}
        onConfirm={onConfirm}
        title="t"
        body="b"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
  });

  it("calls onClose when Cancel clicked", () => {
    const onClose = vi.fn();
    render(
      <DeleteConfirmDialog
        open
        onClose={onClose}
        onConfirm={() => {}}
        title="t"
        body="b"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("DeleteConfirmDialog — typed confirmation", () => {
  it("disables Delete until token typed exactly", () => {
    render(
      <DeleteConfirmDialog
        open
        onClose={() => {}}
        onConfirm={() => {}}
        title="Confirm"
        body="b"
        requireTypedConfirmation="DELETE"
      />,
    );
    const btn = screen.getByRole("button", { name: "Delete" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    const input = screen.getByLabelText(/type/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "delete" } });
    expect(btn.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "DELETE" } });
    expect(btn.disabled).toBe(false);
  });

  it("trims whitespace before comparing", () => {
    render(
      <DeleteConfirmDialog
        open
        onClose={() => {}}
        onConfirm={() => {}}
        title="t"
        body="b"
        requireTypedConfirmation="OK"
      />,
    );
    const btn = screen.getByRole("button", { name: "Delete" }) as HTMLButtonElement;
    const input = screen.getByLabelText(/type/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "  OK  " } });
    expect(btn.disabled).toBe(false);
  });
});

describe("DeleteConfirmDialog — reason field", () => {
  it("requires reason when reasonRequired is true", () => {
    render(
      <DeleteConfirmDialog
        open
        onClose={() => {}}
        onConfirm={() => {}}
        title="t"
        body="b"
        reasonRequired
      />,
    );
    const btn = screen.getByRole("button", { name: "Delete" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: "user requested" },
    });
    expect(btn.disabled).toBe(false);
  });

  it("passes the reason to onConfirm when provided", async () => {
    const onConfirm = vi.fn();
    render(
      <DeleteConfirmDialog
        open
        onClose={() => {}}
        onConfirm={onConfirm}
        title="t"
        body="b"
        reasonRequired
      />,
    );
    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: "duplicate" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("duplicate"));
  });
});

describe("DeleteConfirmDialog — pending state", () => {
  it("disables Confirm + Cancel when isPending=true", () => {
    render(
      <DeleteConfirmDialog
        open
        onClose={() => {}}
        onConfirm={() => {}}
        title="t"
        body="b"
        isPending
      />,
    );
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
    expect(
      (screen.getByRole("button", { name: /delete/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
