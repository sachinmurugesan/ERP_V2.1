"use client";

import * as React from "react";
import { Icon } from "@/components/design-system/icon";

const STORAGE_KEY = "dashboard_welcomed";

function subscribeToStorage(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("storage", callback);
  };
}

function readHasSeen(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return true;
  }
}

/**
 * First-login welcome card.
 *
 * Visibility is derived from `localStorage["dashboard_welcomed"]` via
 * `useSyncExternalStore`, so the component re-renders correctly if the
 * key is cleared from another tab (and stays stable across StrictMode
 * double-renders). Server snapshot always returns "seen" to avoid a
 * hydration flash of the welcome card on SSR.
 */
export function WelcomeCard({
  userName,
}: {
  userName: string;
}): React.ReactElement | null {
  const [dismissed, setDismissed] = React.useState(false);
  const hasSeen = React.useSyncExternalStore(
    subscribeToStorage,
    readHasSeen,
    () => true,
  );

  if (dismissed || hasSeen) return null;

  const handleDismiss = (): void => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore — next visit will re-render, acceptable degrade
    }
    setDismissed(true);
  };

  return (
    <div
      role="region"
      aria-label="Welcome"
      className="card card-pad"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        background:
          "linear-gradient(180deg, color-mix(in oklch, var(--brand-50) 80%, transparent), var(--bg-elev))",
      }}
    >
      <div>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: "-0.2px",
            margin: 0,
            color: "var(--fg)",
          }}
        >
          Welcome to HarvestERP, {userName}.
        </h2>
        <p
          style={{
            fontSize: 13,
            color: "var(--fg-muted)",
            margin: "4px 0 0",
          }}
        >
          Here&apos;s what&apos;s happening today.
        </p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss welcome message"
        className="btn btn-sm btn-ghost"
      >
        <Icon name="close" size={14} />
        Dismiss
      </button>
    </div>
  );
}
