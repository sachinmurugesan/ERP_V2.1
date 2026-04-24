"use client";

import * as React from "react";
import { Icon } from "@/components/design-system/icon";

export interface ProductThumbnailProps {
  src: string | null;
  alt?: string;
  size?: number;
}

/**
 * Product thumbnail with graceful fallback.
 *
 * The backend's `thumbnail_url` is a relative path under `/api/products/file/`
 * which requires auth. In the Next.js app we proxy those image requests
 * through the existing session cookie, so rendering the URL directly works.
 * On load failure we swap to a grey tile with the `inventory` icon.
 */
export function ProductThumbnail({
  src,
  alt = "",
  size = 40,
}: ProductThumbnailProps): React.ReactElement {
  const [broken, setBroken] = React.useState(false);

  const dimensions: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "var(--r-sm)",
    flexShrink: 0,
  };

  if (!src || broken) {
    return (
      <span
        aria-hidden="true"
        style={{
          ...dimensions,
          background: "var(--bg-sunken)",
          color: "var(--fg-subtle)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid var(--border)",
        }}
      >
        <Icon name="inventory" size={Math.round(size * 0.5)} />
      </span>
    );
  }

  return (
    // Plain <img>: the backend `/api/products/file/?path=...` URLs are
    // session-cookie authenticated. next/image's default optimizer strips
    // cross-origin cookies; a custom loader is out of scope for this
    // migration.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setBroken(true)}
      style={{
        ...dimensions,
        objectFit: "cover",
        border: "1px solid var(--border)",
        background: "var(--bg-sunken)",
      }}
    />
  );
}
