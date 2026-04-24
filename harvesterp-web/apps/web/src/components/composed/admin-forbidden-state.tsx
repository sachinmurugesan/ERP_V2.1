"use client";

import * as React from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/primitives/button";

/**
 * AdminForbiddenState — distinct 403 state shown when ADMIN reaches a page
 * gated to FINANCE (D-004 segregation of duties). Not a generic 403: the
 * message specifically explains the D-004 policy so Finance teams can
 * diagnose access escalations without guessing.
 */

export interface AdminForbiddenStateProps {
  /** Short page heading shown above the message (e.g. "Factory Ledger"). */
  pageTitle: string;
  /** Override the default message if needed. */
  message?: string;
  /** Where the "Return" button navigates. Defaults to /dashboard. */
  returnHref?: string;
  returnLabel?: string;
}

const DEFAULT_MESSAGE =
  "Factory ledger access is limited to Finance role to maintain segregation of duties. (Policy D-004)";

export function AdminForbiddenState({
  pageTitle,
  message = DEFAULT_MESSAGE,
  returnHref = "/dashboard",
  returnLabel = "Return to dashboard",
}: AdminForbiddenStateProps): React.ReactElement {
  return (
    <div
      role="alert"
      aria-labelledby="admin-forbidden-heading"
      className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <Lock size={24} aria-hidden="true" />
      </div>
      <h1
        id="admin-forbidden-heading"
        className="text-xl font-semibold text-slate-800"
      >
        Access restricted
      </h1>
      <p className="max-w-md text-sm text-slate-500">{message}</p>
      <p className="text-xs text-slate-400">Page: {pageTitle}</p>
      <Link href={returnHref}>
        <Button variant="outline" size="sm">
          {returnLabel}
        </Button>
      </Link>
    </div>
  );
}
