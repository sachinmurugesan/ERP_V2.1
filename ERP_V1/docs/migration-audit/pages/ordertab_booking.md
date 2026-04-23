# Profile: ordertab_booking

## Metadata
- **Source file:** `frontend/src/components/order/BookingTab.vue`
- **Lines:** 861
- **Type:** component (sub-tab)
- **Portal:** internal
- **Tab slug:** `booking`
- **Parent shell:** `OrderDetail.vue`
- **Wave:** Wave 8 Session B
- **Profile generated:** 2026-04-22

---

## Purpose

Manages container booking for an order. Provides a two-step wizard to create or edit shipment (container) records: Step 1 assigns service providers (Freight Forwarder, CHA, CFS, Transport) and Step 2 captures container type, ports, ETD/ETA, and HBL (House Bill of Lading) content fields (Shipper, Consignee, Notify Party, Description of Goods). On save, all active packing items are auto-allocated to the container. Existing containers are displayed as expandable cards with a read-only detail panel. Auto-starts the wizard on mount if no shipments exist.

---

## Layout / visual structure

```
┌──────────────────────────────────────────────────────┐
│ Container Booking (amber header)                      │
│ [Book Container] / [Add Container] / [Cancel]        │
│                                                       │
│ ── WIZARD MODE ───────────────────────────────────── │
│                                                       │
│  Step indicator: [1] ──── [2]                        │
│  (clickable; completed steps show green check)       │
│                                                       │
│  STEP 1: Assign Service Providers                    │
│  ┌──────────────┐ ┌──────────────┐                   │
│  │ FF           │ │ CHA          │                   │
│  │ [select ▾]   │ │ [select ▾]   │                   │
│  └──────────────┘ └──────────────┘                   │
│  ┌──────────────┐ ┌──────────────┐                   │
│  │ CFS          │ │ Transport    │                   │
│  │ [select ▾]   │ │ [select ▾]   │                   │
│  └──────────────┘ └──────────────┘                   │
│  [Next: Container Details →]                         │
│                                                       │
│  STEP 2: Container & HBL Details                     │
│  Container Type* | Port of Loading* | Port of Discharge* │
│  ETD | ETA | Freight Terms                           │
│  HBL Content:                                        │
│    Shipper [Fill from Factory] | Consignee [Fill from Client] │
│    Notify Party [Client] [Self] | Description of Goods │
│  [← Back]    [Create Booking / Save Changes]         │
│                                                       │
│ ── LIST MODE ─────────────────────────────────────── │
│                                                       │
│  Container cards (click to expand):                  │
│  ┌──────────────────────────────────────────────┐   │
│  │ [40HC] Shanghai → Chennai                    │   │
│  │ FF: ABC | CHA: XYZ | ETD: Jan-15 | ETA: Feb-1│   │
│  │ 25 items       [✏ Edit] [🗑 Delete]          │   │
│  └──────────────────────────────────────────────┘   │
│                                                       │
│  Selected container detail panel:                    │
│    Service Providers | Container Info                │
│    HBL Content | Allocated Items table               │
│                                                       │
│  Empty state: "No containers booked yet"            │
└──────────────────────────────────────────────────────┘
```

---

## Data displayed

| Field | Source |
|---|---|
| Shipment list | `shipments[]` from `shipmentsApi.list` |
| Transport providers | `allProviders[]` from `transportApi.list` |
| Packing items (for auto-alloc) | `packingItems[]` from `packingApi.get` |
| Factory address (HBL shipper) | `factoryDetails` from `factoriesApi.get(order.factory_id)` |
| Client address (HBL consignee) | `clientDetails` from `clientsApi.get(order.client_id)` |
| Company settings (HBL self) | `companySettings` from `settingsApi.getDefaults()` |
| Selected container detail | `selectedShipment` |
| Allocated items per container | `selectedShipment.items[]` |

---

## Interactions

| Action | Handler | API |
|---|---|---|
| Mount | Parallel: `loadShipments()`, `loadProviders()`, `loadPackingItems()`, `loadAddressData()` | shipmentsApi.list, transportApi.list, packingApi.get, factoriesApi.get + clientsApi.get + settingsApi.getDefaults |
| Start wizard (new) | `startWizard()` | — |
| Start wizard (edit) | `startWizard(existingShipment)` | — |
| Cancel wizard | `cancelWizard()` | — |
| Provider selection | `handleProviderChange(card)` | — (client-side auto-fill) |
| Add new provider | `handleProviderChange` catches `__ADD_NEW__` | `bookingRouter.push('/transport/new')` |
| Step forward | `wizardStep = 2` | — |
| Step backward | `wizardStep = 1` | — |
| Fill shipper from factory | `fillShipperFromFactory()` | — (local address format) |
| Fill consignee from client | `fillConsigneeFromClient()` | — |
| Fill notify party from client | `fillNotifyFromClient()` | — |
| Fill notify party from self | `fillNotifyFromSelf()` | — |
| Save container + allocations | `saveContainerAndAllocations()` | `shipmentsApi.create/update` + `shipmentsApi.allocateItems` |
| Delete container | `deleteContainer(id)` | `shipmentsApi.delete(id)` |
| Select container for detail | `selectContainer(shipment)` | — (toggle) |
| Order status change | watcher | Resets wizard, clears selection |

---

## Modals / dialogs triggered

None. Delete uses `confirm()` (D-003 pattern). No overlay dialogs.

---

## API endpoints consumed

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/shipments/?order_id={orderId}` | GET | List shipments (containers) |
| `/api/shipments/` | POST | Create new shipment |
| `/api/shipments/{id}/` | PUT | Update existing shipment |
| `/api/shipments/{id}/` | DELETE | Delete shipment |
| `/api/shipments/{id}/allocate/` | POST | Allocate packing items to shipment |
| `/api/transport/providers/` | GET | Load all transport providers |
| `/api/packing/{orderId}/` | GET | Load packing items for auto-allocation |
| `/api/factories/{id}/` | GET | Factory details for HBL shipper auto-fill |
| `/api/clients/{id}/` | GET | Client details for HBL consignee auto-fill |
| `/api/settings/defaults/` | GET | Company settings for HBL self-fill |

---

## Composables consumed

- `useRouter` (Vue Router) — for `bookingRouter.push('/transport/new')` navigation.
- `formatDate` from `../../utils/formatters`

---

## PrimeVue components consumed

PrimeVue Icons (`pi-*`) for iconography. No PrimeVue form, overlay, or data components. All inputs are native HTML `<select>`, `<input>`, `<textarea>`.

---

## Local state

```javascript
const props = defineProps({
  orderId: { type: String, required: true },
  order: { type: Object, required: true },
})
const emit = defineEmits(['reload'])
const bookingRouter = useRouter()

const loading = ref(false)
const saving = ref(false)
const shipments = ref([])
const selectedShipment = ref(null)
const allProviders = ref([])
const packingItems = ref([])
const error = ref('')                 // inline error banner

// Address data for HBL auto-fill
const factoryDetails = ref(null)
const clientDetails = ref(null)
const companySettings = ref({})

// Wizard state
const wizardActive = ref(false)
const wizardStep = ref(1)             // 1=Providers, 2=Container+HBL
const editingShipmentId = ref(null)   // null = new, id = editing existing

// Container form
const form = ref(defaultForm())       // all container fields
const itemAllocations = ref([])       // auto-populated from packingItems
```

**Key computeds:**
```javascript
const isBookingStage = computed(() => {
  const s = ['BOOKED', 'LOADED', 'SAILED', 'ARRIVED', 'CUSTOMS_FILED',
    'CLEARED', 'DELIVERED', 'AFTER_SALES', 'COMPLETED', 'COMPLETED_EDITING']
  return s.includes(props.order?.status)
})
const activeProviders = computed(() => allProviders.value.filter(p => p.is_active !== false))
const canProceedStep1 = computed(() => !!(form.freight_forwarder_id || form.cha_id || form.cfs_id || form.transport_id))
const canProceedStep2 = computed(() => form.container_type && form.port_of_loading && form.port_of_discharge)
const providersByRole = computed(() => ({  // all roles show all providers; tags are hints only
  FREIGHT_FORWARDER: activeProviders.value,
  CHA: activeProviders.value,
  CFS: activeProviders.value,
  TRANSPORT: activeProviders.value,
}))
```

---

## Permissions / role gating

No role gate within the component. Tab visibility is controlled by the parent shell. All INTERNAL roles that can see the tab can create, edit, and delete container bookings. No write-action role restriction observed.

---

## Bilingual labels (InternalString)

None. All labels are English-only. HBL fields (Shipper, Consignee, Notify Party) typically contain English company addresses.

---

## Empty / error / loading states

| State | Trigger | UI |
|---|---|---|
| Loading | `loading` ref | Amber spinner centered |
| Save error | API failure in `saveContainerAndAllocations()` | Inline `error` banner (dismissable) — includes structured FastAPI validation errors (array of `{msg}`) joined with `;` |
| Load error | `loadShipments()` fails | `error` ref shown in banner |
| Delete error | `deleteContainer()` fails | `error` ref shown in banner |
| Provider/address load error | `loadProviders/loadAddressData()` fails | `console.error` only — silent (P-002) |
| Delete confirm | Before delete | `confirm('Delete this container booking?')` (D-003) |
| Empty (no containers) | `!shipments.length` | "No containers booked yet" text + wizard auto-starts |
| Wizard active + no containers | `wizardActive && !shipments.length` | Wizard shown (auto-start on mount) |

---

## Business rules

1. **`isBookingStage` guard**: Booking tab renders from BOOKED onward (not PLAN_PACKING). Note: BOOKED is also included in PackingListTab's `showPackingSection`. Both tabs are simultaneously visible at BOOKED.

2. **Auto-start wizard**: If no shipments exist when the tab mounts, `startWizard()` is called automatically. The user cannot see the empty state — they land directly in the wizard.

3. **`SELF` sentinel**: The value `'SELF'` represents "handled internally by Harvest." Converted to `null` before sending to backend (`fkFields.includes(fk) && payload[fk] === 'SELF' → null`). Shown in the provider label as "Self."

4. **Provider auto-fill**: When a multi-role provider is selected (e.g., a company that is both FREIGHT_FORWARDER and CHA), the other empty role dropdowns are auto-populated with the same provider ID. Logic in `onProviderSelect()`.

5. **Provider persistence for additional containers**: When creating a second container, `startWizard()` pre-fills providers and ports from the last existing shipment.

6. **`canProceedStep1`**: At least one of the four provider roles must be non-null before advancing to Step 2.

7. **`canProceedStep2`**: `container_type`, `port_of_loading`, and `port_of_discharge` are all required before saving.

8. **Auto-allocation**: All active packing items (non-UNLOADED) from `packingApi.get` are auto-allocated with their full `factory_ready_qty` when the wizard saves. No manual item selection step. This simplification is intentional.

9. **`formatAddress()` function**: Builds multiline address strings for HBL textarea fields. Factory format includes Chinese company name, address, city/province/country, and contact. Client format includes GSTIN, IEC, state/pincode. Self format reads from `companySettings` (`company_name`, `company_address`, `company_phone`, `company_email`, `company_gstin`).

10. **HBL auto-fill buttons**: One-click population of textarea fields from factory/client/self data. User can still manually edit after auto-fill.

11. **`__ADD_NEW__` sentinel**: Selecting "+ Add New Provider" from any dropdown triggers `bookingRouter.push('/transport/new')` — navigates the entire page away from the order. Not a modal.

12. **Step indicator clickable**: Clicking the step indicators allows backwards navigation without validation. Useful for corrections in step 1 after reaching step 2.

13. **Empty string → null for date fields**: `etd` and `eta` are cleared to `null` before API call if empty string, because the backend expects date or null.

---

## Known quirks / bugs

### Q-001 — `confirm()` for delete (D-003)
`deleteContainer()` uses `confirm('Delete this container booking?')` before calling the API. Replace with typed `<ConfirmDialog>` (D-003 spec).

### Q-002 — `bookingRouter.push('/transport/new')` navigates away from order (UX loss)
Selecting "+ Add New Provider" causes full page navigation to `/transport/new`, losing the entire order detail context including the partially-filled wizard form. In Next.js, should open a provider creation slide-over or modal, or open `/transport/new` in a new browser tab via `window.open`.

### Q-003 — `settingsApi.getDefaults()` fetched per-component-mount
Company settings are global and rarely change. Fetching them on every BookingTab mount is wasteful. Should be loaded once at layout/session level and provided via React context.

### Q-004 — Provider load and address load failures are silent (P-002)
`loadProviders()` and `loadAddressData()` catch errors with `console.error` only. If providers fail to load, all four provider dropdowns appear empty. If address data fails, auto-fill buttons produce empty strings. Neither failure is surfaced to the user.

### Q-005 — No validation that ETD < ETA
`canProceedStep2` only checks required fields, not date ordering. A booking can be saved with ETA before ETD.

### Q-006 — Provider dropdown shows all providers for all roles
`providersByRole` returns the same `activeProviders` list for all four roles. A company tagged as FREIGHT_FORWARDER appears in the Transport dropdown too. Role tags are shown as badges (hints) but not used to filter. This matches the business logic comment "All roles show all providers — tags are just hints" but may confuse users.

---

## Dead code / unused state

None identified.

---

## Duplicate or inline utilities

- **`isBookingStage` hardcoded status list**: Same pattern as other tabs. Source of truth: `backend/enums.py → OrderStatus`. Extract `BOOKING_VISIBLE_STATUSES` constant. (P-001 instance)
- **`formatAddress()` function**: Full address block formatter for factory, client, and self. Should be extracted to `utils/formatting.ts` for reuse (also needed when generating HBL PDFs in Next.js).
- **`containerTypeLabel` map**: `{20FT, 40FT, 40HC}` display labels. Move to shared constants.
- **`roleColorMap` and `roleLabelMap`**: Role badge styling — could be shared if provider role badges appear elsewhere.

---

## Migration notes

1. **Two-step wizard → react-hook-form**: Use a `<MultiStepForm>` pattern with react-hook-form, one form schema per step. Zod validation per step before advancing.

2. **Replace `confirm()` with `<ConfirmDialog>`** (D-003 spec): `DialogString` with `ta` Tamil translation.

3. **`bookingRouter.push('/transport/new')` → modal or new tab**: Open provider creation in a modal dialog (preferred) or `window.open('/transport/new', '_blank')`. Do not navigate away from the order.

4. **`settingsApi.getDefaults()` → context/layout provider**: Load company settings once at the app level and inject via React context. Eliminates per-tab fetch.

5. **`formatAddress()` → `utils/formatting.ts`**: Export `formatFactoryAddress(factory)`, `formatClientAddress(client)`, `formatSelfAddress(settings)` as named functions.

6. **Auto-allocation**: Document explicitly that item allocation is automatic (no user step). In Next.js, confirm this matches expected UX before porting. Consider showing allocation summary before saving.

7. **`SELF` sentinel → `null` + checkbox**: Replace the `SELF` string sentinel with a boolean `isSelf` checkbox per provider card. Cleaner type safety.

8. **Step navigation validation**: Add a `canGoBackFromStep2` guard if the form has been partially filled — warn user that going back will not clear step 2 data.

9. **`canProceedStep2` → add ETD < ETA validation**: Add `!etd || !eta || etd < eta` check.

10. **Provider role filtering**: Consider adding an optional `showOnlyRoleMatch` toggle per provider card for clarity.
