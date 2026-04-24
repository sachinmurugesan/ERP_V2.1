/**
 * use-blob-download.test.ts — unit tests for the useBlobDownload hook.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useBlobDownload } from "../../src/lib/use-blob-download";

beforeEach(() => {
  vi.restoreAllMocks();
  // jsdom lacks URL.createObjectURL / revokeObjectURL
  const createURL = vi.fn(() => "blob:fake");
  const revokeURL = vi.fn();
  Object.defineProperty(window.URL, "createObjectURL", { value: createURL, configurable: true });
  Object.defineProperty(window.URL, "revokeObjectURL", { value: revokeURL, configurable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockResponse(
  init: { ok: boolean; status: number; blob: Blob; headers?: Record<string, string>; jsonError?: unknown },
): Response {
  const headers = new Headers(init.headers ?? {});
  return {
    ok: init.ok,
    status: init.status,
    headers,
    blob: async () => init.blob,
    json: async () => {
      if (init.jsonError !== undefined) return init.jsonError;
      throw new Error("no body");
    },
  } as unknown as Response;
}

describe("useBlobDownload", () => {
  it("downloads a blob successfully and uses Content-Disposition filename", async () => {
    const blob = new Blob(["hello"], { type: "text/plain" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        mockResponse({
          ok: true,
          status: 200,
          blob,
          headers: { "Content-Disposition": 'attachment; filename="real.xlsx"' },
        }),
      ),
    );
    const { result } = renderHook(() => useBlobDownload());

    await act(async () => {
      await result.current.download("/api/x", "fallback.xlsx");
    });
    expect(result.current.isDownloading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("falls back to defaultFilename when no Content-Disposition header", async () => {
    const blob = new Blob(["hello"]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockResponse({ ok: true, status: 200, blob })),
    );
    const { result } = renderHook(() => useBlobDownload());

    await act(async () => {
      await result.current.download("/api/x", "fallback.xlsx");
    });
    expect(result.current.error).toBeNull();
  });

  it("surfaces a 403 as a user-visible error", async () => {
    const blob = new Blob([]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockResponse({ ok: false, status: 403, blob })),
    );
    const { result } = renderHook(() => useBlobDownload());

    await act(async () => {
      await expect(
        result.current.download("/api/x", "f.xlsx"),
      ).rejects.toThrow();
    });
    expect(result.current.error).toMatch(/permission/i);
  });

  it("surfaces a network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    const { result } = renderHook(() => useBlobDownload());

    await act(async () => {
      await expect(
        result.current.download("/api/x", "f.xlsx"),
      ).rejects.toThrow(/network down/);
    });
    expect(result.current.error).toMatch(/network down/i);
  });

  it("surfaces an empty blob as an error (not silent)", async () => {
    const blob = new Blob([], { type: "application/octet-stream" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockResponse({ ok: true, status: 200, blob })),
    );
    const { result } = renderHook(() => useBlobDownload());

    await act(async () => {
      await expect(
        result.current.download("/api/x", "f.xlsx"),
      ).rejects.toThrow(/empty/i);
    });
    expect(result.current.error).toMatch(/empty/i);
  });

  it("extracts RFC 5987 filename* when present", async () => {
    const blob = new Blob(["hello"]);
    const created = vi.fn(() => "blob:fake");
    Object.defineProperty(window.URL, "createObjectURL", {
      value: created,
      configurable: true,
    });
    let downloadedName = "";
    const origAppend = document.body.appendChild.bind(document.body);
    vi.spyOn(document.body, "appendChild").mockImplementation(
      ((node: Node) => {
        const el = node as HTMLAnchorElement;
        if (el.tagName === "A") downloadedName = el.download;
        return origAppend(node);
      }) as never,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        mockResponse({
          ok: true,
          status: 200,
          blob,
          headers: {
            "Content-Disposition":
              "attachment; filename*=UTF-8''ledger%20report.pdf",
          },
        }),
      ),
    );
    const { result } = renderHook(() => useBlobDownload());
    await act(async () => {
      await result.current.download("/api/x", "fallback.pdf");
    });
    expect(downloadedName).toBe("ledger report.pdf");
  });

  it("clearError resets the error state", async () => {
    const blob = new Blob([]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockResponse({ ok: false, status: 403, blob })),
    );
    const { result } = renderHook(() => useBlobDownload());

    await act(async () => {
      try {
        await result.current.download("/api/x", "f.xlsx");
      } catch {
        // expected
      }
    });
    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });
});
