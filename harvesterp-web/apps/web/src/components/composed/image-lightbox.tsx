"use client";

import * as React from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import type { ProductImage } from "./image-gallery";

/**
 * ImageLightbox — fullscreen image viewer with prev/next nav.
 *
 * Controlled component — parent owns open state + current index. Supports
 * keyboard nav (Arrow keys + Escape) and click-outside-to-close.
 */

export interface ImageLightboxProps {
  images: ProductImage[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}

export function ImageLightbox({
  images,
  initialIndex,
  open,
  onClose,
}: ImageLightboxProps): React.ReactElement | null {
  const [index, setIndex] = React.useState(initialIndex);
  const [prevInitial, setPrevInitial] = React.useState(initialIndex);
  const [prevOpen, setPrevOpen] = React.useState(open);

  // Reset to initialIndex when the lightbox is (re)opened or initialIndex
  // changes. Uses the derived-state-in-render pattern per React docs, not
  // a useEffect (avoids cascading renders).
  if (prevInitial !== initialIndex || (open && !prevOpen)) {
    setPrevInitial(initialIndex);
    setPrevOpen(open);
    setIndex(initialIndex);
  } else if (prevOpen !== open) {
    setPrevOpen(open);
  }

  const navigate = React.useCallback(
    (direction: -1 | 1) => {
      if (images.length <= 1) return;
      setIndex((prev) => {
        const next = prev + direction;
        if (next < 0) return images.length - 1;
        if (next >= images.length) return 0;
        return next;
      });
    },
    [images.length],
  );

  React.useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        navigate(-1);
      } else if (e.key === "ArrowRight") {
        navigate(1);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose, navigate]);

  if (!open || images.length === 0) return null;

  const current = images[index];
  if (!current) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Product image viewer"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative mx-4 max-h-[90vh] max-w-4xl">
        <button
          type="button"
          aria-label="Close viewer"
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg hover:bg-slate-100"
        >
          <X size={16} className="text-slate-600" />
        </button>

        {/* eslint-disable-next-line @next/next/no-img-element -- Backend-served image, not a static asset. */}
        <img
          src={current.image_url}
          alt={`Product image ${index + 1} of ${images.length}`}
          className="max-h-[85vh] max-w-full rounded-lg bg-white object-contain shadow-2xl"
        />

        <div className="mt-2 text-center text-sm text-white/80">
          {current.width && current.height
            ? `${current.width}x${current.height}`
            : null}
          {current.file_size
            ? ` · ${Math.round((current.file_size || 0) / 1024)}KB`
            : null}
          {current.source_type ? ` · ${current.source_type}` : null}
        </div>

        {images.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={(e) => {
                e.stopPropagation();
                navigate(-1);
              }}
              className="absolute top-1/2 -left-12 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/40"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={(e) => {
                e.stopPropagation();
                navigate(1);
              }}
              className="absolute top-1/2 -right-12 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/40"
            >
              <ChevronRight size={16} />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
