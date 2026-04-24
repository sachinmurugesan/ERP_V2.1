/**
 * product-detail-view.test.tsx — Unit tests for the DETAIL mode view.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { ProductDetailView } from "../../src/app/(app)/products/_components/product-detail-view";
import type { Product } from "../../src/app/(app)/products/_components/types";
import type { ProductImage } from "../../src/components/composed/image-gallery";

const product: Product = {
  id: "p1",
  product_code: "ABC-1",
  product_name: "Thermostat",
  product_name_chinese: "恒温器",
  part_type: "Original",
  dimension: "10x5",
  material: "Steel",
  variant_note: null,
  category: "Engine",
  subcategory: null,
  unit_weight_kg: 0.2,
  unit_cbm: 0.001,
  standard_packing: null,
  moq: 5,
  hs_code: "84159000",
  hs_code_description: "Thermostatic valves",
  factory_part_number: null,
  brand: "Acme",
  oem_reference: null,
  compatibility: null,
  notes: "A scanner test note",
  replace_variant_id: null,
  is_active: true,
  parent_id: null,
  is_default: true,
  thumbnail_url: null,
  variant_count: null,
};

const images: ProductImage[] = [
  { id: "i1", image_url: "/a.jpg", width: 800, height: 600 },
];

describe("ProductDetailView", () => {
  it("renders product name and code in header", () => {
    render(<ProductDetailView product={product} images={images} user={null} />);
    expect(
      screen.getByRole("heading", { name: /thermostat/i }),
    ).toBeInTheDocument();
    // Part code appears twice: header + Part Code field. Both good.
    expect(screen.getAllByText("ABC-1").length).toBeGreaterThanOrEqual(1);
  });

  it("renders all product fields read-only", () => {
    render(<ProductDetailView product={product} images={images} user={null} />);
    expect(screen.getByText("恒温器")).toBeInTheDocument();
    expect(screen.getByText("Original")).toBeInTheDocument();
    expect(screen.getByText("10x5")).toBeInTheDocument();
    expect(screen.getByText("Steel")).toBeInTheDocument();
    expect(screen.getByText("Engine")).toBeInTheDocument();
    expect(screen.getByText("0.2")).toBeInTheDocument();
    expect(screen.getByText("0.001")).toBeInTheDocument();
    expect(screen.getByText("84159000")).toBeInTheDocument();
    expect(screen.getByText("Thermostatic valves")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText(/scanner test note/i)).toBeInTheDocument();
  });

  it("shows 'Not set' for null fields", () => {
    const withNulls: Product = { ...product, brand: null, hs_code: null };
    render(
      <ProductDetailView product={withNulls} images={images} user={null} />,
    );
    const notSet = screen.getAllByText(/not set/i);
    expect(notSet.length).toBeGreaterThan(1);
  });

  it("hides Edit button when user lacks PRODUCT_UPDATE permission", () => {
    render(
      <ProductDetailView
        product={product}
        images={images}
        user={{ role: "CLIENT" }}
      />,
    );
    expect(screen.queryByRole("link", { name: /edit/i })).toBeNull();
  });

  it("shows Edit button for SUPER_ADMIN", () => {
    render(
      <ProductDetailView
        product={product}
        images={images}
        user={{ role: "SUPER_ADMIN" }}
      />,
    );
    expect(screen.getByRole("link", { name: /edit/i })).toBeInTheDocument();
  });

  it("renders image gallery (readonly) and hides delete/upload", () => {
    render(
      <ProductDetailView product={product} images={images} user={null} />,
    );
    expect(screen.getByAltText(/product image 1/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /delete image/i }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /^upload$/i })).toBeNull();
  });

  it("does NOT render an editable input anywhere", () => {
    render(
      <ProductDetailView product={product} images={images} user={null} />,
    );
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
