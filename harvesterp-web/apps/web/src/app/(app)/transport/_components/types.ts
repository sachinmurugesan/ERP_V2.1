/**
 * Local response shapes for /api/transport endpoints.
 *
 * The Next.js API proxy at /api/transport projects the raw upstream
 * `ServiceProvider` (20 fields) DOWN to `TransporterListItem` (13 fields)
 * by stripping fields the list page never displays:
 *   email, address, country, bank_name, bank_account, ifsc_code, notes
 *
 * The list page only renders Name + Roles + Location (city/state) +
 * Contact (contact_person/phone) + GST/PAN. Stripping the rest server-side
 * keeps banking + addressing details out of the client bundle (defense-
 * in-depth — no role gates the bank fields today, but we don't need them
 * here either) and reduces payload size.
 *
 * OpenAPI types the upstream as `unknown` (untyped FastAPI route), so
 * per CONVENTIONS Section 10 (local-interface rule) the consuming page
 * declares this local interface and consumes via the SDK escape hatch
 * `client.getJson<RawTransportListResponse>(...)`.
 */

/** Service-provider categories from backend G-014 enum. Multi-valued. */
export type ServiceProviderRole =
  | "FREIGHT_FORWARDER"
  | "CHA"
  | "CFS"
  | "TRANSPORT";

/**
 * Transporter list item — projected shape sent over the wire to the browser.
 *
 * Stripped fields (kept on backend, dropped in proxy):
 *   email, address, country, bank_name, bank_account, ifsc_code, notes
 */
export interface TransporterListItem {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  gst_number: string | null;
  pan_number: string | null;
  roles: ServiceProviderRole[];
  operating_ports: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface TransportListResponse {
  items: TransporterListItem[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface TransportListParams {
  page: number;
  per_page: number;
  search?: string | undefined;
}

/**
 * Raw upstream shape (what FastAPI returns on /api/shipping/transport/).
 * Used only inside the Next.js API proxy to type the response before
 * projection. NOT exported across the network boundary.
 */
export interface RawServiceProvider extends TransporterListItem {
  email: string | null;
  address: string | null;
  country: string | null;
  bank_name: string | null;
  bank_account: string | null;
  ifsc_code: string | null;
  notes: string | null;
}

export interface RawTransportListResponse {
  items: RawServiceProvider[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}
