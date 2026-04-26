import * as React from "react";
import { ClientAvatar } from "@/components/composed/client-avatar";
import { cn } from "@/lib/utils";
import type { ClientListItem } from "./types";

/**
 * 6-column desktop schema for the Clients List table.
 *
 * Mirrors the Vue column order: Company Name · GSTIN · Location ·
 * Contact · IEC/PAN · Actions.
 *
 * The Actions column header is rendered by the table separately
 * because it has per-row role-gated buttons; this columns module
 * defines the data columns only.
 */

export interface ClientColumn {
  id: string;
  header: string;
  cell: (row: ClientListItem) => React.ReactNode;
  align?: "left" | "right" | "center";
  headerClassName?: string;
  cellClassName?: string;
  /** Hidden below this Tailwind breakpoint (e.g. "md", "lg"). */
  hideBelow?: "md" | "lg";
}

function emDash(): React.ReactElement {
  return <span className="text-slate-300">—</span>;
}

export const CLIENT_COLUMNS: ClientColumn[] = [
  {
    id: "company",
    header: "Company Name",
    cell: (c) => (
      <div className="flex items-center gap-2 min-w-0">
        <ClientAvatar name={c.company_name} variant="hex" size="sm" />
        <span className="truncate text-sm font-medium text-slate-800">
          {c.company_name}
        </span>
      </div>
    ),
  },
  {
    id: "gstin",
    header: "GSTIN",
    cell: (c) =>
      c.gstin ? (
        <span className="font-mono text-xs text-slate-600">{c.gstin}</span>
      ) : (
        <span className="text-xs italic text-slate-400">Not provided</span>
      ),
  },
  {
    id: "location",
    header: "Location",
    hideBelow: "md",
    cell: (c) => {
      const place = [c.city, c.state].filter(Boolean).join(", ");
      if (!place && !c.pincode) return emDash();
      return (
        <div className="text-sm text-slate-600">
          {place || emDash()}
          {c.pincode ? (
            <span className="block text-xs text-slate-400">{c.pincode}</span>
          ) : null}
        </div>
      );
    },
  },
  {
    id: "contact",
    header: "Contact",
    cell: (c) => {
      if (!c.contact_name && !c.contact_phone) return emDash();
      return (
        <div className="text-sm text-slate-600">
          {c.contact_name || emDash()}
          {c.contact_phone ? (
            <span className="block text-xs text-slate-400">
              {c.contact_phone}
            </span>
          ) : null}
        </div>
      );
    },
  },
  {
    id: "iec_pan",
    header: "IEC / PAN",
    hideBelow: "md",
    cell: (c) => {
      if (!c.iec && !c.pan) return emDash();
      return (
        <div className="space-x-1">
          {c.iec ? (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-indigo-50 text-indigo-700">
              IEC: {c.iec}
            </span>
          ) : null}
          {c.pan ? (
            <span className={cn(
              "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
              "bg-slate-100 text-slate-600",
            )}>
              PAN: {c.pan}
            </span>
          ) : null}
        </div>
      );
    },
  },
];

export function hideBelowClass(col: ClientColumn): string {
  switch (col.hideBelow) {
    case "md":
      return "hidden md:table-cell";
    case "lg":
      return "hidden lg:table-cell";
    default:
      return "";
  }
}
