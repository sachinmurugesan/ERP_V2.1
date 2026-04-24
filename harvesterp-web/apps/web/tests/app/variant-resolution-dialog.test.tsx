/**
 * variant-resolution-dialog.test.tsx — Unit tests for the variant dialog.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { VariantResolutionDialog } from "../../src/app/(app)/products/_components/variant-resolution-dialog";
import type { VariantCheckResponse } from "../../src/app/(app)/products/_components/form-types";

const check: VariantCheckResponse = {
  parent_id: "parent-1",
  variant_count: 2,
  parent_code: "ABC-1",
  parent_category: "Engine",
  parent_hs_code: null,
  parent_brand: null,
  variants: [
    {
      id: "v1",
      product_name: "Primary",
      material: "Steel",
      dimension: "10x5",
      part_type: "Original",
      variant_note: null,
      is_default: true,
      category: "Engine",
      hs_code: null,
      brand: null,
      oem_reference: null,
    },
    {
      id: "v2",
      product_name: "Secondary",
      material: null,
      dimension: null,
      part_type: "Copy",
      variant_note: null,
      is_default: false,
      category: "Engine",
      hs_code: null,
      brand: null,
      oem_reference: null,
    },
  ],
};

describe("VariantResolutionDialog", () => {
  it("renders title and subject part code", () => {
    render(
      <VariantResolutionDialog
        open
        productCode="ABC-1"
        check={check}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(
      screen.getByRole("heading", { name: /existing variants found/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("ABC-1")).toBeInTheDocument();
  });

  it("shows variant count in the header", () => {
    render(
      <VariantResolutionDialog
        open
        productCode="ABC-1"
        check={check}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText(/already has 2 variants/i)).toBeInTheDocument();
  });

  it("expands and lists variants", () => {
    render(
      <VariantResolutionDialog
        open
        productCode="ABC-1"
        check={check}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    fireEvent.click(screen.getByText(/current variants/i));
    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(screen.getByText("Secondary")).toBeInTheDocument();
    expect(screen.getByText(/default/i)).toBeInTheDocument();
  });

  it("defaults to add_new and confirms with no replaceId", () => {
    const onConfirm = vi.fn();
    render(
      <VariantResolutionDialog
        open
        productCode="ABC-1"
        check={check}
        onCancel={() => {}}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /add variant/i }));
    expect(onConfirm).toHaveBeenCalledWith("add_new", undefined);
  });

  it("disables confirm button when replace selected but no variant chosen", () => {
    render(
      <VariantResolutionDialog
        open
        productCode="ABC-1"
        check={check}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    fireEvent.click(screen.getByLabelText(/replace existing variant/i));
    const confirmBtn = screen.getByRole("button", {
      name: /replace variant/i,
    }) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
  });

  it("confirms with replaceId when replace selected", () => {
    const onConfirm = vi.fn();
    render(
      <VariantResolutionDialog
        open
        productCode="ABC-1"
        check={check}
        onCancel={() => {}}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByLabelText(/replace existing variant/i));
    fireEvent.change(screen.getByLabelText(/select variant to replace/i), {
      target: { value: "v2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /replace variant/i }));
    expect(onConfirm).toHaveBeenCalledWith("replace", "v2");
  });

  it("cancel calls onCancel", () => {
    const onCancel = vi.fn();
    render(
      <VariantResolutionDialog
        open
        productCode="ABC-1"
        check={check}
        onCancel={onCancel}
        onConfirm={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
