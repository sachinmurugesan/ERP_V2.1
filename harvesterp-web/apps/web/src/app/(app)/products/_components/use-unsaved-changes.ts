"use client";

import { useEffect } from "react";

/**
 * useUnsavedChanges — guard against leaving a dirty form.
 *
 * Covers browser close/reload via `beforeunload` (native prompt text is
 * fixed by Chromium; the prompt uses the browser default). Next.js App
 * Router navigation can also be guarded by capturing anchor clicks that
 * target internal links — browser back/forward and router.push calls from
 * our own UI already pass through visible `Cancel` buttons, which respect
 * the form's own `submitting` state.
 *
 * The hook is a no-op when `dirty` is false — skip listener overhead
 * unless the form is actually dirty.
 */
export function useUnsavedChanges(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;

    function beforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }

    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank") return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      const ok = window.confirm(
        "You have unsaved changes. Are you sure you want to leave?",
      );
      if (!ok) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, { capture: true });

    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, { capture: true });
    };
  }, [dirty]);
}
