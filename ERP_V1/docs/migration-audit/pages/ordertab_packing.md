# Profile: ordertab_packing

## Metadata
- **Source file:** `frontend/src/components/order/PackingListTab.vue`
- **Lines:** 1,244
- **Type:** component (sub-tab)
- **Portal:** internal
- **Tab slug:** `packing`
- **Parent shell:** `OrderDetail.vue`
- **Wave:** Wave 8 Session B
- **Profile generated:** 2026-04-22

---

## Purpose

Manages the factory packing list for an order. Supports two creation modes (Upload Excel from factory, or Manual entry). Once a packing list exists, provides per-item editing (factory ready qty, pallet/loose assignment), item splitting across pallets (client-side before creation, server-side after), selection-based migration of unloaded items to the next order with per-item reasons, undo migration, shipping decisions for partially-ready items (SHIP_CARRY_FORWARD, SHIP_CANCEL_BALANCE, WAIT), and Excel/PDF export. Renders the packing section for 13 statuses from PLAN_PACKING through COMPLETED_EDITING; write actions (edit mode, migration, split) are gated to PLAN_PACKING only.

---

## Layout / visual structure

```
┌─────────────────────────────────────────────────────────────┐
│ Packing List — Plan Packing (purple header)                 │
│ [Edit] [Excel] [PDF] [Upload Packing List] [Delete] [Done]  │
│                                                             │
│ Upload date · Packages count                                │
│                                                             │
│ Summary Dashboard (4 stat cards + progress bar)             │
│  Total Items | Loaded | Not Ready | Migrated                │
│  [██████░░░░░░] N% loaded (loadedQty / totalQty)           │
│                                                             │
│ Filters: [Status ▾] [Pallet ▾]   N of M active items       │
│ Pallet auto-select toast (transient, dismissable)           │
│ Bulk actions bar: N items selected · [Bulk reason ▾] [Migrate to Next Order] │
│                                                             │
│ Main table (active items):                                  │
│  ☐ | Part Code | Name | Ordered | Ready | Pallet # | Status │
│    | Type | Reason ▾ | Decision ▾ (cond.) | Actions        │
│                                                             │
│ Balance Adjustments sub-table (read-only, indigo)           │
│                                                             │
│ Migration success toast                                     │
│                                                             │
│ Migrated / Unloaded Items table (red):                     │
│  ☐ | Part Code | Name | Qty | Type | Reason               │
│  Carry-forward rows (amber, no checkbox)                    │
│                                                             │
│ Empty state (no packing list, PLAN_PACKING):               │
│  [Upload Excel card]   [Create Manually card]               │
│                                                             │
│ Manual creation form (table with factory_ready_qty inputs)  │
└─────────────────────────────────────────────────────────────┘

Dialogs (custom overlay, not PrimeVue):
  - Migrate Confirmation
  - Undo Migration Confirmation
  - Split Item (qty rows per pallet + total validation)
  - Cancel Balance Reason (required text, irreversible warning)
```

---

## Data displayed

| Field | Source |
|---|---|
| Packing list metadata | `packingList.uploaded_date`, `packingList.total_packages` |
| Active items | `filteredPackingItems` (computed from `packingItems`) |
| Balance adjustment items | `balanceOnlyItems` computed |
| Migrated items | `migratedPackingItems` computed |
| Carry-forward items | `carryForwardItems[]` (from API) |
| Summary stats | `summaryStats` computed (totalItems, loadedCount, notReadyCount, migratedCount, loadedPercent) |
| Pallet filter options | `uniquePallets` computed |
| Migration reasons | `migrationReasons` ref (order_item_id → reason string) |
| Selected for migration | `selectedForMigration` Set |
| Selected for undo | `selectedForUndo` Set |
| Split rows | `splitRows[]` ref |
| Manual create items | `manualItems[]` ref |

---

## Interactions

| Action | Handler | API |
|---|---|---|
| Mount | `loadPackingList()` | `packingApi.get(orderId)` |
| Upload Excel packing list | `uploadPackingList(event)` | `packingApi.upload(orderId, file)` |
| Delete packing list | `deletePackingList()` | `packingApi.delete(orderId)` |
| Create manually | `submitManualPacking()` | `packingApi.createManual(orderId, items)` |
| Update factory ready qty (inline blur) | `updateFactoryReady(item, value)` | `packingApi.updateItem(orderId, item.id, {factory_ready_qty})` |
| Update pack type | `updatePackType(item, packType)` | `packingApi.updateItem(orderId, item.id, {package_number})` |
| Update pallet # (inline blur) | `updatePallet(item, value)` | `packingApi.updateItem(orderId, item.id, {package_number})` |
| Toggle migration checkbox | `toggleMigration(itemId)` | — |
| Toggle all migration | `toggleMigrationSelectAll()` | — |
| Set item reason (auto-selects) | `setItemReason(itemId, reason)` | — |
| Bulk set reason | `setBulkReason(reason)` | — |
| Confirm migrate | `confirmMigrate()` → `migrateItems()` | `packingApi.migrateItems(orderId, items)` |
| Confirm undo migration | `confirmUndo()` → `undoMigration()` | `packingApi.undoMigrate(orderId, itemIds)` |
| Open split dialog | `openSplit(item)` | — |
| Add/remove split row | `addSplitRow()`, `removeSplitRow(i)` | — |
| Confirm split | `confirmSplit()` | `packingApi.splitItem(orderId, item.id, rows)` |
| Unsplit item | `unsplitItem(parentId)` | `packingApi.unsplitItem(orderId, parentId)` |
| Manual create: split item | `splitManualItem(idx)` | client-side only |
| Manual create: unsplit item | `unsplitManualItem(itemId)` | client-side only |
| Set shipping decision | `setShippingDecision(item, decision)` | `packingApi.setDecision(orderId, item.id, decision)` |
| Confirm cancel balance | `confirmCancelBalance()` | `packingApi.setDecision(orderId, item.id, 'SHIP_CANCEL_BALANCE', reason)` |
| Download Excel | `downloadPackingExcel()` | `packingApi.downloadExcel(orderId)` |
| Download PDF | `downloadPackingPDF()` | `packingApi.downloadPDF(orderId)` |

---

## Modals / dialogs triggered

| Dialog | Trigger | Confirmation action |
|---|---|---|
| Migrate Confirmation (`showMigrateDialog`) | `confirmMigrate()` | `migrateItems()` — calls `packingApi.migrateItems` |
| Undo Migration Confirmation (`showUndoDialog`) | `confirmUndo()` | `undoMigration()` — calls `packingApi.undoMigrate` |
| Split Item (`showSplitDialog`) | `openSplit(item)` | `confirmSplit()` — validates qty sum, calls `packingApi.splitItem` |
| Cancel Balance Reason (`showCancelReasonDialog`) | `setShippingDecision(item, 'SHIP_CANCEL_BALANCE')` | `confirmCancelBalance()` — requires non-empty reason text |

All dialogs are custom full-screen overlays (not PrimeVue). No alert() is used for these four flows.

---

## API endpoints consumed

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/packing/{orderId}/` | GET | Load packing list + items + carry-forward items |
| `/api/packing/{orderId}/upload/` | POST | Upload Excel packing list |
| `/api/packing/{orderId}/` | DELETE | Delete packing list |
| `/api/packing/{orderId}/manual/` | POST | Create packing list manually |
| `/api/packing/{orderId}/items/{itemId}/` | PATCH | Update item (ready qty, pallet, pack type) |
| `/api/packing/{orderId}/items/{itemId}/split/` | POST | Split item across pallets |
| `/api/packing/{orderId}/items/{itemId}/unsplit/` | POST | Merge split back |
| `/api/packing/{orderId}/migrate/` | POST | Migrate unloaded items to next order |
| `/api/packing/{orderId}/undo-migrate/` | POST | Restore migrated items to active |
| `/api/packing/{orderId}/items/{itemId}/decision/` | POST | Set partial item shipping decision |
| `/api/packing/{orderId}/excel/` | GET | Download packing list as Excel |
| `/api/packing/{orderId}/pdf/` | GET | Download packing list as PDF |

---

## Composables consumed

None. Props provide all required data.

---

## PrimeVue components consumed

PrimeVue Icons (`pi-*`) for iconography only. No PrimeVue form, overlay, or data components. All inputs are native HTML `<select>`, `<input>`, `<textarea>`.

---

## Local state

```javascript
const props = defineProps({
  orderId: { type: String, required: true },
  order: { type: Object, required: true },
  highlightSection: { type: String, default: null },  // P-022 pattern
})
const emit = defineEmits(['reload'])

// Section ref for highlight-on-navigate
const uploadSectionRef = ref(null)

// Core packing list state
const packingList = ref(null)
const packingItems = ref([])
const carryForwardItems = ref([])

// Edit mode
const isEditing = ref(false)

// Upload
const uploadingPacking = ref(false)

// Migration selection
const selectedForMigration = ref(new Set())  // Set<order_item_id>
const migrationReasons = ref({})             // { [order_item_id]: reason }
const migrating = ref(false)
const migrationToast = ref('')

// Undo migration
const selectedForUndo = ref(new Set())
const undoing = ref(false)

// Filters
const packingFilterStatus = ref('')
const packingFilterPallet = ref('')

// Pallet auto-select toast
const palletToast = ref('')
const palletToastTimeout = ref(null)

// Dialogs
const showMigrateDialog = ref(false)
const showUndoDialog = ref(false)

// Split item (post-create, server-side)
const showSplitDialog = ref(false)
const splitTarget = ref(null)
const splitRows = ref([])

// Partial readiness decision
const showCancelReasonDialog = ref(false)
const cancelReasonTarget = ref(null)
const cancelReasonText = ref('')

// Manual creation mode
const showManualCreate = ref(false)
const manualItems = ref([])
const creatingManual = ref(false)

// Saved indicators
const savedReadyIds = ref(new Set())
const savedPalletIds = ref(new Set())
```

**Key computeds:**
```javascript
const isPlanPacking = computed(() => props.order?.status === 'PLAN_PACKING')

const showPackingSection = computed(() => {
  const packingStatuses = ['PLAN_PACKING', 'FINAL_PI', 'PRODUCTION_100', 'BOOKED', 'LOADED',
    'SAILED', 'ARRIVED', 'CUSTOMS_FILED', 'CLEARED', 'DELIVERED', 'AFTER_SALES',
    'COMPLETED', 'COMPLETED_EDITING']
  return packingStatuses.includes(props.order?.status)
})

const activePackingItems = computed(...)    // not UNLOADED, not is_balance_only, not SPLIT parent
const balanceOnlyItems = computed(...)      // is_balance_only = true
const migratedPackingItems = computed(...) // order_item_status === 'UNLOADED'
const filteredPackingItems = computed(...) // activePackingItems filtered by status + pallet
const uniquePallets = computed(...)         // sorted set of package_number values
const summaryStats = computed(...)          // aggregate counts and percentages
const hasPartialItems = computed(...)       // any active item is partially ready
```

---

## Permissions / role gating

No role gate within the component. Tab visibility is controlled by the parent shell's `availableTabs` computed. Write actions (edit mode, migration, split, shipping decisions) are gated only by `isPlanPacking` status — no INTERNAL role restriction. Any INTERNAL user who can see the order at PLAN_PACKING can perform all write actions including the irreversible SHIP_CANCEL_BALANCE.

---

## Bilingual labels (InternalString)

None. All labels are English-only.

---

## Empty / error / loading states

| State | Trigger | UI |
|---|---|---|
| Not in packing stage | `!showPackingSection` | Entire component renders nothing |
| No packing list at PLAN_PACKING | `!packingList && !showManualCreate` | Two-option card (Upload Excel / Create Manually) |
| Uploading | `uploadingPacking` | Button label "Uploading..." |
| Migrating | `migrating` | Button label "Migrating..." |
| Undoing migration | `undoing` | Button label "Restoring..." |
| Creating manual | `creatingManual` | Spinner + "Creating..." |
| Upload error | API failure | `alert(err.response?.data?.detail \|\| 'Upload failed')` (D-003) |
| Delete error | API failure | `alert(...)` (D-003) |
| Manual create error | API failure | `alert(...)` (D-003) |
| Migrate error | API failure | `alert(...)` (D-003) |
| Undo error | API failure | `alert(...)` (D-003) |
| Split validation error | qty mismatch | `alert(\`Total (${total}) must equal...\`)` (D-003) |
| Split API error | API failure | `alert(...)` (D-003) |
| Unsplit error | API failure | `alert(...)` (D-003) |
| Decision error | API failure | `alert(...)` (D-003) |
| Cancel balance validation | empty reason | `alert('Please provide a reason...')` (D-003) |
| Cancel balance API error | API failure | `alert(...)` (D-003) |
| Load error | `loadPackingList()` fails | `console.error` only — silent (P-002) |
| Update ready qty error | `updateFactoryReady()` fails | `console.error` only — silent (P-002) |
| Update pack type error | `updatePackType()` fails | `console.error` only — silent (P-002) |
| Update pallet error | `updatePallet()` fails | `console.error` only — silent (P-002) |
| Download Excel error | `downloadPackingExcel()` fails | `console.error` only — silent (P-002) |
| Download PDF error | `downloadPackingPDF()` fails | `console.error` only — silent (P-002) |
| Migration success | post-migrate | Green inline toast (4s auto-dismiss) |
| Pallet auto-select | NO_SPACE reason | Blue inline toast (6s auto-dismiss) |
| Inline save success | ready qty / pallet saved | 1.5s checkmark indicator per cell |

**D-003 alert() count: ~10 instances — highest count in the codebase.**

---

## Business rules

1. **Status gating**: `showPackingSection` (13 statuses) determines whether the component renders. `isPlanPacking` determines write capability. Read-only view is available from FINAL_PI onward.

2. **Item categories**:
   - **Active items**: `order_item_status !== 'UNLOADED' && !is_balance_only && packing_status !== 'SPLIT'` — the main table.
   - **Balance-only items**: `is_balance_only === true` — ledger adjustments (compensation), read-only sub-table. Not selectable for migration.
   - **Migrated items**: `order_item_status === 'UNLOADED'` — shown in red "Migrated" table.
   - **Carry-forward items**: from `carryForwardItems[]` — appear in migrated table (amber, no undo checkbox).

3. **Item types**: `item_type` field — `carried_forward` (amber badge, replay icon), `aftersales_replacement` (teal badge, sync icon), null (standard). Row background also colored by type.

4. **Packing statuses**: PALLETED (green), LOOSE (yellow), NOT_READY (red), SPLIT (parent hidden from active items).

5. **Migration reasons**: NOT_PRODUCED (item not manufactured), NO_SPACE (container capacity). Selecting NO_SPACE auto-selects all other items on the same pallet (pallet-level auto-select). A transient inline toast explains the auto-select. Reason auto-checks the item; clearing reason unchecks it.

6. **Bulk reason**: "Apply to all..." dropdown applies a reason to all currently selected items visible through the filter.

7. **Shipping decisions** (partial items only): Column shown only when `hasPartialItems`. SHIP_CARRY_FORWARD (send ready qty, carry remaining to next order), SHIP_CANCEL_BALANCE (send ready qty, permanently reduce ordered qty — **irreversible**, requires reason), WAIT (hold entire item until fully produced). SHIP_CANCEL_BALANCE triggers `cancelReasonText` dialog before API call.

8. **Item splitting**: Two code paths:
   - *Client-side* (`splitManualItem`/`unsplitManualItem`): Used in Manual Creation mode before packing list is submitted. Splits in local `manualItems[]`.
   - *Server-side* (`openSplit`/`confirmSplit`/`unsplitItem`): Used after packing list exists. `confirmSplit()` validates that split row quantities sum exactly to `splitTarget.factory_ready_qty`. Min 2 rows; rows can be added.

9. **SHIP_CANCEL_BALANCE is irreversible**: Permanently reduces ordered qty on the Final PI. Confirmation dialog states this explicitly.

10. **Saved indicators**: 1.5s check mark per row after successful inline edits to ready qty or pallet. Immutable Set updates pattern used throughout.

11. **`highlightSection` prop** (P-022): Watches for `section === 'upload'` to `scrollIntoView()` the upload section card with a 2.5s flash animation. Called from parent shell to deep-link to upload area.

12. **Order status change watcher**: On `order.status` change, `isEditing` resets to false, selections clear.

---

## Known quirks / bugs

### Q-001 — ~10 alert() instances (D-003)
This component has the highest `alert()` count in the codebase (~10 calls). Every destructive action (upload, delete, manual create, migrate, undo, split, decision) uses `alert()` for both validation errors and API errors. Replace all with `toast.error()` using the shared toast system established in Wave 0.

### Q-002 — 6 silent failures (P-002)
Load, inline update (ready qty, pack type, pallet), and download failures use `console.error` only. User sees no feedback — inline edits appear to save successfully even when they fail. Add toast notifications or inline error indicators for these.

### Q-003 — Forward reference to `savedPalletIds` (line 239 vs. 580)
`updatePackType()` at line 239 references `savedPalletIds` which is declared as `ref(new Set())` at line 580. In Vue Composition API, the `ref` is reactive and hoisted by the runtime, so this works. However, it is a readability anti-pattern. Move `savedPalletIds` declaration before `updatePackType()`.

### Q-004 — `loadPackingList()` called on every single inline edit
`updateFactoryReady()`, `updatePackType()`, and `updatePallet()` all update reactive item properties directly (mutating the item ref) rather than calling `loadPackingList()`. However, the list is fully reloaded on `migrateItems()`, `undoMigration()`, and `submitManualPacking()`. The mixed update strategy (direct mutation vs. full reload) is inconsistent.

### Q-005 — No filter reset on `isEditing` change
When `isEditing` is toggled off (Done), filters (`packingFilterStatus`, `packingFilterPallet`) are not cleared. A user might not see all items if a filter was active during edit mode.

---

## Dead code / unused state

None identified. The component is dense but all state appears in use.

---

## Duplicate or inline utilities

- **`showPackingSection` hardcoded status list**: Same pattern as `isProductionStage` in ProductionTab and `availableTabs` in OrderDetail shell — all hardcoded status arrays. Source of truth: `backend/enums.py → OrderStatus`. Migrate to a `PACKING_VISIBLE_STATUSES` constant from the Next.js SDK types. (P-001 instance)
- **`getPackingStatusBadge()` and `getItemTypeBadge()`**: Inline badge utility functions. Extract to `utils/badge-helpers.ts` for reuse in factory portal packing views.

---

## Migration notes

1. **Split into sub-components**: At 1,244 lines, this is the second-largest component in the codebase. Decompose in Next.js:
   - `<PackingTable>` — main active items table with inline edit cells
   - `<BalanceAdjustmentsTable>` — read-only balance-only items
   - `<MigratedItemsTable>` — migrated + carry-forward items
   - `<ManualPackingForm>` — manual creation mode
   - `<PackingMigrateDialog>` — typed ConfirmDialog (D-003 spec)
   - `<PackingUndoDialog>` — typed ConfirmDialog (D-003 spec)
   - `<SplitItemDialog>` — modal with dynamic rows
   - `<CancelBalanceDialog>` — typed ConfirmDialog with irreversible warning

2. **Replace all alert() with toast**: ~10 instances → `toast.error()` with shared Wave 0 toast system. (D-003)

3. **Silent failures → toast**: 6 `console.error` calls → `toast.error('Failed to update packing item')` etc. (P-002)

4. **highlightSection → URL hash**: `highlightSection === 'upload'` → `#upload` URL hash. Component scrolls to `#upload` anchor on mount/hash change. (P-022)

5. **Status constants**: `showPackingSection` status array → import `PACKING_VISIBLE_STATUSES` from `@/types/order-status.ts`. (P-001)

6. **Set state for selection**: `selectedForMigration` and `selectedForUndo` as `Set<string>` — in React, use `useState<Set<string>>(new Set())` with immutable updates (`new Set(prev).add(id)`). Pattern is already immutable in the Vue code.

7. **Inline save indicators**: 1.5s check mark after inline edits → use a `useSavedIndicator(id)` hook in Next.js.

8. **SHIP_CANCEL_BALANCE**: Must use typed `<ConfirmDialog>` with `DialogString` (D-003 spec) including a `ta` Tamil confirmation string. The irreversible nature must be communicated in both languages.

9. **`getItemTypeBadge()` and `getPackingStatusBadge()`**: Move to shared badge utility functions consumed by factory portal packing views too.

10. **Pallet auto-select toast**: The in-component `palletToast` mechanism → use the shared toast system with a longer duration (6s) and non-dismissable UX for the auto-select explanation.
