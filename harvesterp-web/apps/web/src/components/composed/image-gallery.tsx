"use client";

import * as React from "react";
import { Upload, Trash2, ImageOff, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ImageGallery — thumbnail grid for product images with upload + delete.
 *
 * Ported from Vue ProductForm.vue image section. Consumes a ProductImage
 * list and emits onUpload / onDelete callbacks. The lightbox is a separate
 * composed component — the parent controls open state and passes through.
 */

export interface ProductImage {
  id: string;
  image_url: string;
  thumbnail_url?: string | null;
  width?: number | null;
  height?: number | null;
  file_size?: number | null;
  source_type?: string | null;
}

export interface ImageGalleryProps {
  images: ProductImage[];
  onDelete?: (imageId: string) => void;
  onUpload?: (files: File[]) => void;
  onOpen?: (index: number) => void;
  readonly?: boolean;
  loading?: boolean;
  className?: string;
}

export function ImageGallery({
  images,
  onDelete,
  onUpload,
  onOpen,
  readonly = false,
  loading = false,
  className,
}: ImageGalleryProps): React.ReactElement {
  const [broken, setBroken] = React.useState<Record<string, true>>({});
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0 && onUpload) {
      onUpload(Array.from(files));
    }
    e.target.value = "";
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">
          {images.length > 0
            ? `${images.length} image${images.length === 1 ? "" : "s"}`
            : "No images"}
        </div>
        {!readonly && onUpload ? (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700"
            >
              <Upload size={14} />
              Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
              aria-label="Upload product image"
            />
          </>
        ) : null}
      </div>

      {loading ? (
        <div className="py-6 text-center text-sm text-slate-400">
          Loading images…
        </div>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 py-10 text-center">
          <ImageOff className="text-slate-300" size={32} />
          <p className="text-sm text-slate-500">No images for this product</p>
          <p className="text-xs text-slate-400">
            Images are extracted from Factory Excel uploads
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
          {images.map((img, idx) => (
            <div
              key={img.id}
              className="group relative cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
              onClick={() => onOpen?.(idx)}
              role="button"
              tabIndex={0}
              aria-label={`View image ${idx + 1}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen?.(idx);
                }
              }}
            >
              {broken[img.id] ? (
                <div className="flex h-28 w-full items-center justify-center bg-slate-100">
                  <ImageOff className="text-slate-300" size={24} />
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- Images are served by the FastAPI backend, not optimized via next/image.
                <img
                  src={img.thumbnail_url || img.image_url}
                  alt={`Product image ${idx + 1}`}
                  className="h-28 w-full object-cover"
                  loading="lazy"
                  onError={() =>
                    setBroken((prev) => ({ ...prev, [img.id]: true }))
                  }
                />
              )}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-colors group-hover:bg-black/20 group-hover:opacity-100">
                <span className="pointer-events-none rounded-full bg-white/90 p-1.5 text-slate-700">
                  <ZoomIn size={12} />
                </span>
                {!readonly && onDelete ? (
                  <button
                    type="button"
                    aria-label={`Delete image ${idx + 1}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(img.id);
                    }}
                    className="pointer-events-auto rounded-full bg-red-600 p-1.5 text-white hover:bg-red-700"
                  >
                    <Trash2 size={12} />
                  </button>
                ) : null}
              </div>
              {img.width && img.height ? (
                <div className="px-2 py-1 text-[10px] text-slate-400">
                  {img.width}x{img.height}
                  {img.file_size
                    ? ` · ${Math.round((img.file_size || 0) / 1024)}KB`
                    : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
