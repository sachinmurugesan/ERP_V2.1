"use client";

import * as React from "react";
import { ImageGallery } from "@/components/composed/image-gallery";
import { ImageLightbox } from "@/components/composed/image-lightbox";
import { AlertDialog } from "@/components/primitives/alert-dialog";
import { SectionCard } from "./section-card";
import type { ProductImage } from "./form-types";

interface ProductImageSidebarProps {
  productId: string;
  images: ProductImage[];
  onUpload: (files: File[]) => Promise<void>;
  onDelete: (imageId: string) => Promise<void>;
  loading?: boolean;
}

/**
 * EDIT-mode sidebar wrapping the ImageGallery composed component and adding
 * upload/delete wiring + an AlertDialog confirmation for deletes (replaces
 * Vue's window.confirm — Vue bug fix #3).
 */
export function ProductImageSidebar({
  images,
  onUpload,
  onDelete,
  loading,
}: ProductImageSidebarProps): React.ReactElement {
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [lightboxIndex, setLightboxIndex] = React.useState(0);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function handleUpload(files: File[]) {
    setBusy(true);
    try {
      await onUpload(files);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmDelete() {
    if (!confirmId) return;
    setBusy(true);
    try {
      await onDelete(confirmId);
    } finally {
      setConfirmId(null);
      setBusy(false);
    }
  }

  return (
    <>
      <SectionCard title="Product Images">
        <ImageGallery
          images={images}
          onUpload={handleUpload}
          onDelete={(id) => setConfirmId(id)}
          onOpen={(idx) => {
            setLightboxIndex(idx);
            setLightboxOpen(true);
          }}
          loading={loading || busy}
        />
      </SectionCard>

      <ImageLightbox
        images={images}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />

      <AlertDialog
        open={confirmId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmId(null);
        }}
        title="Delete this image?"
        description="This can't be undone. The image will be removed from the product permanently."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
