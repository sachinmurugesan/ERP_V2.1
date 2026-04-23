# Internal Warehouse Stock

**Type:** stub (unimplemented placeholder)
**Portal:** internal (`user_type === 'INTERNAL'`)
**Route:** `/warehouse` → `WarehouseStock` (meta.title: `'Warehouse Stock'`, meta.icon: `'pi-warehouse'`)
**Vue file:** [frontend/src/views/WarehouseStock.vue](../../../frontend/src/views/WarehouseStock.vue)
**Line count:** 11
**Migration wave:** Wave 5 (internal tracking)
**Risk level:** low — placeholder only; no API calls, no data, no mutations

---

## Purpose

Unimplemented placeholder page for warehouse stock tracking that displays a static card with a heading and description; no API calls, no interactive elements, and no script logic.

---

## Layout

### Outer container
`div`

**Zone 1 — Static card** (`bg-white rounded-xl shadow-sm p-6`)
- `h2` "Warehouse Stock"
- `p` static description: "Items in transit and in warehouse — status tracking from loading to delivery (IN_TRANSIT, AT_PORT, CLEARED, DISPATCHED, DELIVERED)."

---

## Data displayed

None. All content is static text.

**P-007 checklist:** No API fields present. N/A.

---

## Interactions

None.

---

## Modals/dialogs triggered

None.

---

## API endpoints consumed

None.

---

## Composables consumed

None.

---

## PrimeVue components consumed

None.

---

## Local state

None — `<script setup>` block is empty.

---

## Permissions / role gating

- Route `/warehouse` has **no `meta.roles`** — all INTERNAL users reach this page.
- `router.beforeEach` blocks CLIENT/FACTORY users from the internal portal.
- No backend calls — no backend permission surface to audit.

---

## Bilingual labels (`InternalString`)

All strings are English-only. No i18n infrastructure.

| Key | en | ta | Type |
|---|---|---|---|
| `internal.warehouse.title` | "Warehouse Stock" | "" | `InternalString` |
| `internal.warehouse.description` | "Items in transit and in warehouse — status tracking from loading to delivery (IN_TRANSIT, AT_PORT, CLEARED, DISPATCHED, DELIVERED)." | "" | `InternalString` |

[D-005: Tamil can remain `""` for internal pages.]

---

## Empty / error / loading states

None applicable — no data-dependent states.

---

## Business rules

None — no business logic implemented.

---

## Known quirks

- **Entire page is a stub.** The static description text enumerates statuses (IN_TRANSIT, AT_PORT, CLEARED, DISPATCHED, DELIVERED) that appear to describe a planned shipping/warehouse tracking feature. No backend model, router, or API endpoint exists for these statuses.
- **Route is registered in the sidebar navigation.** Any INTERNAL user can navigate to `/warehouse` and sees only the placeholder card — there is no visual indication that the feature is under development.

---

## Dead code / unused state

None — there is no code to evaluate.

---

## Duplicate or inline utilities

None observed.

---

## Migration notes

1. **[UNCLEAR] — Implementation scope unknown.** The planned statuses (IN_TRANSIT, AT_PORT, CLEARED, DISPATCHED, DELIVERED) partially overlap with existing `OrderStatus` values (CLEARED, DELIVERED). It is unclear whether this is intended to be a new `WarehouseItem` model, a filtered view of existing orders, or a separate inventory tracking system. Clarify before implementing in Wave 0.
2. **Do not migrate the stub as-is.** In the Next.js rebuild, either implement the feature or remove the route from navigation. A registered route that renders a static card with no functionality should not be carried forward.
3. **D-001:** No API to migrate — define endpoints when implementing.
4. **D-005:** All `InternalString`; Tamil can remain `""`.
