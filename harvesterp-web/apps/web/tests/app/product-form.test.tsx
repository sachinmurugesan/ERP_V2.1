/**
 * product-form.test.tsx — Unit tests for the shared ProductForm component.
 *
 * Covers form rendering, required-field validation, mode-specific UI, and
 * successful submit across CREATE / EDIT / VARIANT modes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh, replace: vi.fn(), back: vi.fn() }),
}));

import { ProductForm } from "../../src/app/(app)/products/_components/product-form";
import type { Product } from "../../src/app/(app)/products/_components/types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CATEGORIES = ["Engine", "Chassis", "Cabin Spare Parts"];

const parent: Product = {
  id: "parent-1",
  product_code: "AH-ENG-001",
  product_name: "[AH-ENG-001]",
  product_name_chinese: null,
  part_type: null,
  dimension: null,
  material: null,
  variant_note: null,
  category: "Engine",
  subcategory: null,
  unit_weight_kg: null,
  unit_cbm: null,
  standard_packing: null,
  moq: 1,
  hs_code: "84159000",
  hs_code_description: null,
  factory_part_number: null,
  brand: "Acme",
  oem_reference: null,
  compatibility: null,
  notes: null,
  replace_variant_id: null,
  is_active: true,
  parent_id: null,
  is_default: false,
  thumbnail_url: null,
  variant_count: 3,
};

const onSubmitOk = async () => ({ ok: true as const });

// ── Rendering ────────────────────────────────────────────────────────────────

describe("ProductForm — rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all 5 Card sections", () => {
    render(
      <ProductForm mode="create" categories={CATEGORIES} onSubmit={onSubmitOk} />,
    );
    expect(
      screen.getByRole("heading", { name: /product identification/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^category$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /specifications/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /reference codes/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^notes$/i })).toBeInTheDocument();
  });

  it("renders the 20 form fields", () => {
    render(
      <ProductForm mode="create" categories={CATEGORIES} onSubmit={onSubmitOk} />,
    );
    expect(screen.getByLabelText(/part code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/product name(?!.*chinese)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/chinese name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/part type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/dimension/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/material/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/variant note/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/subcategory/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/unit weight/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/unit cbm/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/standard packing/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/moq/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^hs code$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hs code description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/factory part number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^brand/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/oem reference/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/compatibility/i)).toBeInTheDocument();
    expect(screen.getAllByLabelText(/^notes/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows Create Product label in CREATE mode", () => {
    render(
      <ProductForm mode="create" categories={CATEGORIES} onSubmit={onSubmitOk} />,
    );
    expect(
      screen.getByRole("button", { name: /create product/i }),
    ).toBeInTheDocument();
  });

  it("shows Save Changes label in EDIT mode", () => {
    render(
      <ProductForm
        mode="edit"
        categories={CATEGORIES}
        onSubmit={onSubmitOk}
        productId="p1"
      />,
    );
    expect(
      screen.getByRole("button", { name: /save changes/i }),
    ).toBeInTheDocument();
  });

  it("shows Add Variant label and parent card in VARIANT mode", () => {
    render(
      <ProductForm
        mode="variant"
        categories={CATEGORIES}
        onSubmit={onSubmitOk}
        parentProduct={parent}
        initialData={{ product_code: parent.product_code }}
      />,
    );
    expect(
      screen.getByRole("button", { name: /add variant/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: /variant parent product/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(parent.product_code)).toBeInTheDocument();
  });

  it("readonly part code in VARIANT mode", () => {
    render(
      <ProductForm
        mode="variant"
        categories={CATEGORIES}
        onSubmit={onSubmitOk}
        parentProduct={parent}
        initialData={{ product_code: parent.product_code }}
      />,
    );
    const partCode = screen.getByLabelText(/part code/i) as HTMLInputElement;
    expect(partCode).toHaveProperty("readOnly", true);
  });

  it("populates category dropdown with the provided options", () => {
    render(
      <ProductForm mode="create" categories={CATEGORIES} onSubmit={onSubmitOk} />,
    );
    for (const cat of CATEGORIES) {
      expect(screen.getByRole("option", { name: cat })).toBeInTheDocument();
    }
  });

  it("includes the 4 hardcoded part types", () => {
    render(
      <ProductForm mode="create" categories={CATEGORIES} onSubmit={onSubmitOk} />,
    );
    expect(screen.getByRole("option", { name: "Original" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Copy" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "OEM" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Aftermarket" }),
    ).toBeInTheDocument();
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe("ProductForm — validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows required errors for part code and product name", async () => {
    const onSubmit = vi.fn(async () => ({ ok: true as const }));
    render(
      <ProductForm mode="create" categories={CATEGORIES} onSubmit={onSubmit} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /create product/i }));
    await waitFor(() => {
      expect(screen.getByText(/part code is required/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/product name is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects negative weight", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => ({ ok: true as const }));
    render(
      <ProductForm mode="create" categories={CATEGORIES} onSubmit={onSubmit} />,
    );
    await user.type(screen.getByLabelText(/part code/i), "X1");
    await user.type(
      screen.getByLabelText(/product name(?!.*chinese)/i),
      "Widget",
    );
    const weight = screen.getByLabelText(/unit weight/i);
    await user.clear(weight);
    await user.type(weight, "-5");
    fireEvent.click(screen.getByRole("button", { name: /create product/i }));
    await waitFor(() => {
      expect(screen.getByText(/weight cannot be negative/i)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects MOQ below 1", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => ({ ok: true as const }));
    render(
      <ProductForm mode="create" categories={CATEGORIES} onSubmit={onSubmit} />,
    );
    await user.type(screen.getByLabelText(/part code/i), "X2");
    await user.type(
      screen.getByLabelText(/product name(?!.*chinese)/i),
      "Widget",
    );
    const moq = screen.getByLabelText(/moq/i);
    await user.clear(moq);
    await user.type(moq, "0");
    fireEvent.click(screen.getByRole("button", { name: /create product/i }));
    await waitFor(() => {
      expect(screen.getByText(/moq must be at least 1/i)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

// ── Submit ────────────────────────────────────────────────────────────────────

describe("ProductForm — submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls onSubmit with typed data on valid CREATE", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => ({ ok: true as const }));
    render(
      <ProductForm mode="create" categories={CATEGORIES} onSubmit={onSubmit} />,
    );
    await user.type(screen.getByLabelText(/part code/i), "ABC-1");
    await user.type(
      screen.getByLabelText(/product name(?!.*chinese)/i),
      "Thermostat",
    );
    fireEvent.click(screen.getByRole("button", { name: /create product/i }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.data.product_code).toBe("ABC-1");
    expect(payload.data.product_name).toBe("Thermostat");
  });

  it("displays general error from submit handler", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => ({
      ok: false as const,
      error: "Backend says no",
    }));
    render(
      <ProductForm mode="create" categories={CATEGORIES} onSubmit={onSubmit} />,
    );
    await user.type(screen.getByLabelText(/part code/i), "X3");
    await user.type(
      screen.getByLabelText(/product name(?!.*chinese)/i),
      "Widget",
    );
    fireEvent.click(screen.getByRole("button", { name: /create product/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/backend says no/i);
    });
  });

  it("routes field error to the specific field", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => ({
      ok: false as const,
      error: "Product name already exists",
      fieldError: "product_name" as const,
    }));
    render(
      <ProductForm mode="create" categories={CATEGORIES} onSubmit={onSubmit} />,
    );
    await user.type(screen.getByLabelText(/part code/i), "X4");
    await user.type(
      screen.getByLabelText(/product name(?!.*chinese)/i),
      "Existing",
    );
    fireEvent.click(screen.getByRole("button", { name: /create product/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/product name already exists/i),
      ).toBeInTheDocument();
    });
  });
});

// ── Category / subcategory bug fix ───────────────────────────────────────────

describe("ProductForm — category/subcategory interaction", () => {
  it("clears subcategory when category changes (Vue bug fix)", async () => {
    const onSubmit = vi.fn(async () => ({ ok: true as const }));
    render(
      <ProductForm
        mode="edit"
        productId="p1"
        categories={CATEGORIES}
        initialData={{
          product_code: "X",
          product_name: "Y",
          moq: 1,
          category: "Engine",
          subcategory: "SubA",
        }}
        onSubmit={onSubmit}
      />,
    );
    const subcat = screen.getByLabelText(/subcategory/i) as HTMLInputElement;
    expect(subcat.value).toBe("SubA");
    const cat = screen.getByLabelText(/^category/i) as HTMLSelectElement;
    fireEvent.change(cat, { target: { value: "Chassis" } });
    await waitFor(() => {
      const s = screen.getByLabelText(/subcategory/i) as HTMLInputElement;
      expect(s.value).toBe("");
    });
  });
});
