"use client";

import * as React from "react";
import Link from "next/link";
import { canAccess, Resource, type UserRole } from "@harvesterp/lib";
import { Pencil, Trash2 } from "lucide-react";
import { ClientAvatar } from "@/components/composed/client-avatar";
import { ProviderRoleBadge } from "./provider-role-badge";
import type { TransporterListItem } from "./types";

/**
 * Mobile card variant — used below 768px instead of the table.
 * Same content density as the desktop row, optimised for vertical
 * scrolling. Edit + Delete actions are role-gated via TRANSPORT_UPDATE
 * and TRANSPORT_DELETE.
 */

interface TransportMobileCardProps {
  provider: TransporterListItem;
  role: UserRole | undefined;
  onDelete: (provider: TransporterListItem) => void;
}

export function TransportMobileCard({
  provider,
  role,
  onDelete,
}: TransportMobileCardProps): React.ReactElement {
  const canEdit = role ? canAccess(role, Resource.TRANSPORT_UPDATE) : false;
  const canDelete = role ? canAccess(role, Resource.TRANSPORT_DELETE) : false;

  const place = [provider.city, provider.state].filter(Boolean).join(", ");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <ClientAvatar name={provider.name} variant="hex" size="md" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-800">
            {provider.name}
          </div>
          {provider.roles.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {provider.roles.map((r) => (
                <ProviderRoleBadge key={r} role={r} />
              ))}
            </div>
          ) : (
            <div className="mt-1 text-xs italic text-slate-400">No roles</div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {canEdit ? (
            <Link
              href={`/transport/${provider.id}/edit`}
              aria-label={`Edit ${provider.name}`}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
            >
              <Pencil size={14} />
            </Link>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              aria-label={`Delete ${provider.name}`}
              onClick={() => onDelete(provider)}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={14} />
            </button>
          ) : null}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div>
          <dt className="text-slate-400">Location</dt>
          <dd className="text-slate-700">{place || "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Contact</dt>
          <dd className="text-slate-700">
            {provider.contact_person ?? "—"}
            {provider.phone ? (
              <span className="block text-slate-400">{provider.phone}</span>
            ) : null}
          </dd>
        </div>
        {provider.gst_number || provider.pan_number ? (
          <div className="col-span-2">
            <dt className="text-slate-400">GST / PAN</dt>
            <dd className="space-x-1">
              {provider.gst_number ? (
                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-indigo-50 text-indigo-700">
                  GST: {provider.gst_number}
                </span>
              ) : null}
              {provider.pan_number ? (
                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600">
                  PAN: {provider.pan_number}
                </span>
              ) : null}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
