import * as React from "react";
import { ClientAvatar } from "@/components/composed/client-avatar";
import { cn } from "@/lib/utils";
import { ProviderRolesCell } from "./provider-role-badge";
import type { TransporterListItem } from "./types";

/**
 * 6-column desktop schema for the Transporters List table.
 *
 * Column order (Phase 2 §2.2 + decision #1):
 *   Name | Roles | Location | Contact | GST/PAN | Actions
 *
 * Differs from the Vue source order — Location swaps ahead of Contact
 * because Location is the second-most-discriminating field (after Roles)
 * for an OPERATIONS user scanning the list.
 *
 * The Actions column header is rendered separately by `<TransportClient>`
 * because it has per-row role-gated buttons; this module defines data
 * columns only.
 */

export interface TransportColumn {
  id: string;
  header: string;
  cell: (row: TransporterListItem) => React.ReactNode;
  align?: "left" | "right" | "center";
  headerClassName?: string;
  cellClassName?: string;
  /** Hidden below this Tailwind breakpoint (e.g. "md", "lg"). */
  hideBelow?: "md" | "lg";
}

function emDash(): React.ReactElement {
  return <span className="text-slate-300">—</span>;
}

export const TRANSPORT_COLUMNS: TransportColumn[] = [
  {
    id: "name",
    header: "Name",
    cell: (p) => (
      <div className="flex items-center gap-2 min-w-0">
        <ClientAvatar name={p.name} variant="hex" size="sm" />
        <span className="truncate text-sm font-medium text-slate-800">
          {p.name}
        </span>
      </div>
    ),
  },
  {
    id: "roles",
    header: "Roles",
    cell: (p) => <ProviderRolesCell roles={p.roles} />,
  },
  {
    id: "location",
    header: "Location",
    hideBelow: "md",
    cell: (p) => {
      const place = [p.city, p.state].filter(Boolean).join(", ");
      if (!place) return emDash();
      return <span className="text-sm text-slate-600">{place}</span>;
    },
  },
  {
    id: "contact",
    header: "Contact",
    cell: (p) => {
      if (!p.contact_person && !p.phone) return emDash();
      return (
        <div className="text-sm text-slate-600">
          {p.contact_person ?? emDash()}
          {p.phone ? (
            <span className="block text-xs text-slate-400">{p.phone}</span>
          ) : null}
        </div>
      );
    },
  },
  {
    id: "gst_pan",
    header: "GST / PAN",
    hideBelow: "lg",
    cell: (p) => {
      if (!p.gst_number && !p.pan_number) return emDash();
      return (
        <div className="space-x-1">
          {p.gst_number ? (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-indigo-50 text-indigo-700">
              GST: {p.gst_number}
            </span>
          ) : null}
          {p.pan_number ? (
            <span className={cn(
              "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
              "bg-slate-100 text-slate-600",
            )}>
              PAN: {p.pan_number}
            </span>
          ) : null}
        </div>
      );
    },
  },
];

export function hideBelowClass(col: TransportColumn): string {
  switch (col.hideBelow) {
    case "md":
      return "hidden md:table-cell";
    case "lg":
      return "hidden lg:table-cell";
    default:
      return "";
  }
}
