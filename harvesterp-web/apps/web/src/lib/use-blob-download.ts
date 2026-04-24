"use client";

import * as React from "react";

/**
 * useBlobDownload — fetch a blob from the server and trigger a browser
 * download with a proper filename.
 *
 * - Authenticated via the session cookie (same-origin fetch; no token handling
 *   on the client — the Next.js proxy route injects the JWT server-side).
 * - Extracts filename from the `Content-Disposition` header when present;
 *   falls back to `defaultFilename` when not.
 * - Surfaces errors to the caller via the returned `error` state instead of
 *   swallowing them (P-002 fix).
 *
 * Consumers render download buttons and call `download(url)` on click.
 */

export interface UseBlobDownloadResult {
  download: (url: string, defaultFilename: string) => Promise<void>;
  isDownloading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useBlobDownload(): UseBlobDownloadResult {
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const download = React.useCallback(
    async (url: string, defaultFilename: string): Promise<void> => {
      setIsDownloading(true);
      setError(null);
      try {
        const response = await fetch(url, {
          method: "GET",
          credentials: "include",
        });
        if (!response.ok) {
          const message = await readErrorMessage(response);
          throw new Error(message);
        }
        const filename = extractFilename(response) ?? defaultFilename;
        const blob = await response.blob();
        if (blob.size === 0) {
          throw new Error("Download is empty");
        }
        triggerDownload(blob, filename);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Download failed";
        setError(message);
        throw err;
      } finally {
        setIsDownloading(false);
      }
    },
    [],
  );

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  return { download, isDownloading, error, clearError };
}

function extractFilename(response: Response): string | null {
  const header = response.headers.get("Content-Disposition");
  if (!header) return null;
  // Prefer RFC 5987 filename* parameter, fall back to filename=
  const starMatch = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (starMatch && starMatch[1]) {
    try {
      return decodeURIComponent(starMatch[1]);
    } catch {
      return starMatch[1];
    }
  }
  const plain = /filename=\"?([^\";]+)\"?/i.exec(header);
  if (plain && plain[1]) return plain[1];
  return null;
}

async function readErrorMessage(response: Response): Promise<string> {
  if (response.status === 401) return "Please sign in again.";
  if (response.status === 403) return "You don't have permission to download this file.";
  if (response.status === 404) return "File not found.";
  try {
    const body = (await response.json()) as { error?: string; detail?: string };
    return body.error ?? body.detail ?? `Download failed (${response.status})`;
  } catch {
    return `Download failed (${response.status})`;
  }
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    window.URL.revokeObjectURL(url);
  }
}
