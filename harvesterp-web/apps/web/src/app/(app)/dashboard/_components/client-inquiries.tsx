import * as React from "react";
import Link from "next/link";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import type { ClientInquiriesResponse, ClientInquiry } from "./types";
import { timeAgo } from "./formatters";

/**
 * Server component — pending Client Inquiries.
 *
 * Matches the legacy Vue behaviour of hiding the entire section when there
 * are no inquiries (treated as "nothing to review"). When present, the
 * section is rendered at the top of the page as an attention strip because
 * it is the highest-priority information a user can act on.
 *
 * Errors on this endpoint collapse the section silently — the legacy Vue
 * code treats this endpoint as best-effort (.catch → empty list), and the
 * behaviour is preserved during migration so a transient 5xx does not
 * promote a false-positive "nothing to do" message at the top of the page.
 */

async function loadInquiries(): Promise<ClientInquiry[]> {
  const token = await getSessionToken();
  if (!token) return [];
  try {
    const client = await getServerClient();
    const res = await client.getJson<ClientInquiriesResponse>(
      "/api/dashboard/client-inquiries/",
    );
    return Array.isArray(res.inquiries) ? res.inquiries : [];
  } catch {
    return [];
  }
}

export async function ClientInquiriesSection(): Promise<React.ReactElement | null> {
  const inquiries = await loadInquiries();
  if (inquiries.length === 0) return null;

  return (
    <section
      aria-label="Client inquiries awaiting review"
      className="card"
      style={{
        borderColor: "color-mix(in oklch, var(--ok) 35%, var(--border))",
      }}
    >
      <header
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--fg)" }}>
          Client Inquiries
        </h2>
        <span className="chip chip-ok">{inquiries.length} Pending</span>
      </header>

      <table className="tbl">
        <thead>
          <tr>
            <th scope="col">Client</th>
            <th scope="col">PO Reference</th>
            <th scope="col" style={{ textAlign: "right" }}>
              Items
            </th>
            <th scope="col">Submitted</th>
            <th scope="col" style={{ textAlign: "right" }}>
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {inquiries.map((inq) => (
            <tr key={inq.id}>
              <td style={{ fontWeight: 600, color: "var(--fg)" }}>
                {inq.client_name}
              </td>
              <td className="mono" style={{ color: "var(--fg-muted)" }}>
                {inq.po_reference ?? "\u2014"}
              </td>
              <td
                className="num"
                style={{ textAlign: "right", color: "var(--fg)" }}
              >
                {inq.item_count}
              </td>
              <td style={{ color: "var(--fg-subtle)", fontSize: 12 }}>
                {timeAgo(inq.created_at)}
              </td>
              <td style={{ textAlign: "right" }}>
                <Link
                  href={`/orders/${inq.id}`}
                  className="btn btn-sm btn-primary"
                >
                  Review
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
