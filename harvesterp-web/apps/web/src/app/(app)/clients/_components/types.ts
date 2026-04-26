/**
 * Local response shapes for /api/clients endpoints.
 *
 * The Next.js API proxy at /api/clients projects the raw ClientResponse
 * (17 fields) DOWN to ClientListItem (15 fields) by stripping Cluster D
 * margin fields (`factory_markup_percent`, `sourcing_commission_percent`).
 * Those fields are sensitive internal margin data and were never rendered
 * by the Vue source — keeping them out of the client bundle eliminates
 * the bandwidth + accidental-leak risk noted in the audit profile.
 *
 * OpenAPI types the upstream as `$ref`, but the projection means the
 * Next.js types must be local (Section 10 local-interface rule).
 */

export type ClientType = "REGULAR" | "PRIORITY" | "INACTIVE" | string;

/**
 * Client list item — projected shape sent over the wire to the browser.
 *
 * Cluster D fields (`factory_markup_percent`, `sourcing_commission_percent`)
 * are intentionally omitted from this type. They live on the backend
 * ClientResponse but are stripped server-side in the API proxy.
 */
export interface ClientListItem {
  id: string;
  company_name: string;
  gstin: string | null;
  iec: string | null;
  pan: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  notes: string | null;
  is_active: boolean;
  client_type: ClientType | null;
}

export interface ClientsListResponse {
  items: ClientListItem[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface ClientsListParams {
  page: number;
  per_page: number;
  search?: string | undefined;
}

/**
 * Raw upstream shape (what FastAPI returns on /api/clients/). Used only
 * inside the Next.js API proxy to type the response before projection.
 * NOT exported across the network boundary.
 */
export interface RawClientResponse extends ClientListItem {
  factory_markup_percent: number | null;
  sourcing_commission_percent: number | null;
}

export interface RawClientsListResponse {
  items: RawClientResponse[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}
