"use client";

import * as React from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { Resource } from "@harvesterp/lib";
import { Button } from "@/components/primitives/button";
import { RoleGate, type RoleGateUser } from "@/components/composed/role-gate";
import { ImageGallery } from "@/components/composed/image-gallery";
import { ImageLightbox } from "@/components/composed/image-lightbox";
import { SectionCard } from "./section-card";
import { ReadOnlyField } from "./read-only-field";
import type { Product, ProductImage } from "./form-types";

interface ProductDetailViewProps {
  product: Product;
  images: ProductImage[];
  user: RoleGateUser | null;
}

export function ProductDetailView({
  product,
  images,
  user,
}: ProductDetailViewProps): React.ReactElement {
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [lightboxIndex, setLightboxIndex] = React.useState(0);

  function open(idx: number) {
    setLightboxIndex(idx);
    setLightboxOpen(true);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">
              {product.product_name}
            </h1>
            <p className="font-mono text-sm text-slate-500">
              {product.product_code}
            </p>
          </div>
          <RoleGate user={user} permission={Resource.PRODUCT_UPDATE}>
            <Link href={`/products/${product.id}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil size={14} className="mr-2" />
                Edit
              </Button>
            </Link>
          </RoleGate>
        </div>

        <SectionCard title="Product Identification">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ReadOnlyField
              label="Part Code"
              value={product.product_code}
              mono
            />
            <ReadOnlyField label="Product Name" value={product.product_name} />
            <ReadOnlyField
              label="Chinese Name"
              value={product.product_name_chinese}
            />
            <ReadOnlyField label="Part Type" value={product.part_type} />
            <ReadOnlyField label="Dimension" value={product.dimension} />
            <ReadOnlyField label="Material" value={product.material} />
            <ReadOnlyField
              label="Variant Note"
              value={product.variant_note}
              className="md:col-span-2"
            />
          </div>
        </SectionCard>

        <SectionCard title="Category">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ReadOnlyField label="Category" value={product.category} />
            <ReadOnlyField label="Subcategory" value={product.subcategory} />
          </div>
        </SectionCard>

        <SectionCard title="Specifications">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ReadOnlyField
              label="Unit Weight (kg)"
              value={product.unit_weight_kg}
            />
            <ReadOnlyField label="Unit CBM" value={product.unit_cbm} />
            <ReadOnlyField
              label="Standard Packing"
              value={product.standard_packing}
            />
            <ReadOnlyField label="MOQ" value={product.moq} />
          </div>
        </SectionCard>

        <SectionCard title="Reference Codes">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ReadOnlyField label="HS Code" value={product.hs_code} mono />
            <ReadOnlyField
              label="HS Code Description"
              value={product.hs_code_description}
            />
            <ReadOnlyField
              label="Factory Part Number"
              value={product.factory_part_number}
            />
            <ReadOnlyField label="Brand" value={product.brand} />
            <ReadOnlyField label="OEM Reference" value={product.oem_reference} />
            <ReadOnlyField label="Compatibility" value={product.compatibility} />
          </div>
        </SectionCard>

        <SectionCard title="Notes">
          <ReadOnlyField label="Notes" value={product.notes} />
        </SectionCard>
      </div>

      <aside className="lg:sticky lg:top-6">
        <SectionCard title="Product Images">
          <ImageGallery images={images} onOpen={open} readonly />
        </SectionCard>
      </aside>

      <ImageLightbox
        images={images}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}
