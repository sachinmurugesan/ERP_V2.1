"use client";

import * as React from "react";
import Link from "next/link";
import { canAccess, Resource, type UserRole } from "@harvesterp/lib";
import { Pencil, Trash2 } from "lucide-react";
import { ClientAvatar } from "@/components/composed/client-avatar";
import type { ClientListItem } from "./types";

/**
 * Mobile card variant — used below 768px instead of the table.
 * Same content density as the desktop row, optimised for vertical
 * scrolling. Edit + Delete actions are role-gated.
 */

interface ClientMobileCardProps {
  client: ClientListItem;
  role: UserRole | undefined;
  onDelete: (client: ClientListItem) => void;
}

export function ClientMobileCard({
  client,
  role,
  onDelete,
}: ClientMobileCardProps): React.ReactElement {
  const canEdit = role ? canAccess(role, Resource.CLIENT_UPDATE) : false;
  const canDelete = role ? canAccess(role, Resource.CLIENT_DELETE) : false;

  const place = [client.city, client.state].filter(Boolean).join(", ");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <ClientAvatar name={client.company_name} variant="hex" size="md" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-800">
            {client.company_name}
          </div>
          {client.gstin ? (
            <div className="font-mono text-xs text-slate-500">{client.gstin}</div>
          ) : (
            <div className="text-xs italic text-slate-400">No GSTIN</div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {canEdit ? (
            <Link
              href={`/clients/${client.id}/edit`}
              aria-label="Edit client"
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
            >
              <Pencil size={14} />
            </Link>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              aria-label="Delete client"
              onClick={() => onDelete(client)}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={14} />
            </button>
          ) : null}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div>
          <dt className="text-slate-400">Contact</dt>
          <dd className="text-slate-700">
            {client.contact_name ?? "—"}
            {client.contact_phone ? (
              <span className="block text-slate-400">{client.contact_phone}</span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">Location</dt>
          <dd className="text-slate-700">
            {place || "—"}
            {client.pincode ? (
              <span className="block text-slate-400">{client.pincode}</span>
            ) : null}
          </dd>
        </div>
        {client.iec || client.pan ? (
          <div className="col-span-2">
            <dt className="text-slate-400">IEC / PAN</dt>
            <dd className="space-x-1">
              {client.iec ? (
                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-indigo-50 text-indigo-700">
                  IEC: {client.iec}
                </span>
              ) : null}
              {client.pan ? (
                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600">
                  PAN: {client.pan}
                </span>
              ) : null}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
