# Profile: ordertab_after_sales

## Metadata
- **Source file:** `frontend/src/components/order/AfterSalesTab.vue`
- **Lines:** 953
- **Type:** component (sub-tab)
- **Portal:** internal
- **Tab slug:** `after-sales`
- **Parent shell:** `OrderDetail.vue`
- **Wave:** Wave 8 Session C
- **Profile generated:** 2026-04-22

---

## Purpose

After-sales quality review for a completed shipment. INTERNAL staff verify received quantities against sent quantities, flag issues (missing items, mismatches, quality problems, price discrepancies), record resolutions, and upload photo/video evidence. Computes claim values using `selling_price_inr`. Includes a photo lightbox with keyboard navigation and an Excel export for claims documentation. Visible only at AFTER_SALES / COMPLETED / COMPLETED_EDITING (gated by shell).

---

## Layout / visual structure

```
┌────────────────────────────────────────────────────────┐
│ After-Sales Review                  [Export Report]    │
│                                                        │
│ [Missing ₹X] [Mismatch ₹X] [Price ₹X] [Quality ₹X]   │
│ [Total Claim ₹X]    ← shown only when complaints exist │
│                                                        │
│ Total: N  Issues: N  Resolved: N  Carry-forward: N     │
│ [success toast]                                        │
│                                                        │
│ Table (sticky header):                                 │
│  Code | Name | Type | Sent | Received* | Issue | Desc  │
│  | Resolution+Save | ClaimQty | Evidence | Status      │
│                                                        │
│ Balance Adjustments (indigo section, read-only)        │
│                                                        │
│ Issued Parts & Resolutions (rose section, summary)     │
│                                                        │
│                               [Save Changes]           │
└────────────────────────────────────────────────────────┘
```
*Received Qty is an editable number input per row.

**Lightbox** (Teleport to body, z-9999):
- Full-screen backdrop
- Image or `<video>` element
- Left/right navigation arrows + keyboard (←/→/Esc)
- Delete button in header
- Thumbnail strip (multi-photo items)

---

## Data displayed

| Field | Source |
|---|---|
| Item list | `items[]` from `afterSalesApi.getForOrder(orderId)` |
| Physical items | `physicalItems` = items where `!is_balance_only` |
| Balance items | `balanceItems` = items where `is_balance_only` |
| Product code / name | `item.product_code`, `item.product_name` |
| Item type badge | `item.item_type` (carried_forward / aftersales_replacement / null) |
| Sent qty | `item.sent_qty` |
| Received qty | `item.received_qty` (editable, defaults to `sent_qty`) |
| Issue type | `item.objection_type` (editable select) |
| Resolution type | `item.resolution_type` (editable select) |
| Affected qty | `item.affected_quantity` (editable, auto-set for PRODUCT_MISSING) |
| Claim value | `item.affected_quantity × item.selling_price_inr` (computed inline) |
| Photos | `item.photos[]` — filenames, URL via `getPhotoUrl()` |
| Carry-forward status | `item.carry_forward_status` (PENDING / ADDED_TO_ORDER / FULFILLED) |

**Issue types:** `PRODUCT_MISSING`, `PRODUCT_MISMATCH`, `PRICE_MISMATCH`, `QUALITY_ISSUE`

**Resolution types per issue:**
- PRODUCT_MISMATCH / PRODUCT_MISSING → REPLACE_NEXT_ORDER, COMPENSATE_BALANCE
- QUALITY_ISSUE → REPLACE_NEXT_ORDER, COMPENSATE_BALANCE, PARTIAL_COMPENSATE, PARTIAL_REPLACEMENT
- PRICE_MISMATCH → COMPENSATE_BALANCE

---

## Interactions

| Action | Handler | API |
|---|---|---|
| Mount | `loadItems()` | `afterSalesApi.getForOrder(orderId)` |
| Save resolution (per-item) | `saveResolution(item)` | `afterSalesApi.resolveItem(orderId, item.id, payload)` |
| Save all | `saveAll()` | `afterSalesApi.saveForOrder(orderId, payload)` |
| Upload photo | `handlePhotoUpload(event, item)` | `afterSalesApi.uploadPhoto(orderId, item.id, file)` |
| Delete photo | `deletePhoto(item, filename)` | `afterSalesApi.deletePhoto(orderId, item.id, filename)` |
| Download Excel | `downloadExcel()` | `afterSalesApi.downloadExcel(orderId)` |
| Open lightbox | `openLightbox(item, index)` | — |
| Close lightbox | `closeLightbox()` | — |
| Delete from lightbox | `deletePhoto(item, photos[index])` | same delete API |
| Issue type change | `onIssueTypeChange(item)` | — (local auto-fill) |
| Resolution change | `onResolutionChange(item)` | — (local auto-fill) |
| Received qty change | `onReceivedQtyChange(item)` | — (auto-updates claim qty) |

---

## Modals / dialogs triggered

**Photo Lightbox** (Teleport to body, `z-[9999]`):
- `v-if="lightbox.show"`
- Backdrop click → `closeLightbox()`
- Keyboard: Escape → close, ←/→ → prev/next photo
- Contains image or video depending on `isVideo(filename)`
- Delete button calls `deletePhoto(lightbox.item, lightbox.photos[lightbox.index])`
- Thumbnail strip for multi-photo items

No other modals. File input triggered programmatically via `triggerFileInput(itemId)` → `document.getElementById('photo-input-' + itemId).click()`.

---

## API endpoints consumed

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/after-sales/{orderId}/` | GET | List after-sales items |
| `/api/after-sales/{orderId}/resolve/{itemId}/` | POST | Resolve single item |
| `/api/after-sales/{orderId}/` | PUT | Save all items (bulk) |
| `/api/after-sales/{orderId}/photo/{itemId}/` | POST | Upload photo evidence |
| `/api/after-sales/{orderId}/photo/{itemId}/{filename}/` | DELETE | Delete photo |
| `/api/after-sales/{orderId}/export/` | GET | Download Excel report (blob) |

---

## Composables consumed

- `formatCurrency` from `../../utils/formatters` (correctly imported — not inline)

---

## PrimeVue components consumed

PrimeVue Icons (`pi-*`). No PrimeVue form or overlay components. Lightbox is hand-rolled with `<Teleport>`.

---

## Local state

```javascript
const props = defineProps({
  orderId: { type: String, required: true },
  order: { type: Object, required: true },
})
const emit = defineEmits(['reload'])

const loading = ref(false)
const saving = ref(false)
const items = ref([])
const toast = ref('')
const lightbox = ref({ show: false, photos: [], index: 0, productName: '', item: null })

// Per-item save tracking
const savingItemId = ref(null)    // which item is being resolved
const savedItemIds = ref(new Set()) // shows green check tick for 2 seconds
```

**Key computeds:**
```javascript
const physicalItems = computed(() => items.value.filter(i => !i.is_balance_only))
const balanceItems = computed(() => items.value.filter(i => i.is_balance_only))
const totalItems = computed(() => physicalItems.value.length)
const issuesFlagged = computed(() => physicalItems.value.filter(i => i.objection_type).length)
const resolvedCount = computed(() => physicalItems.value.filter(i =>
  i.objection_type && i.resolution_type && i.status === 'RESOLVED').length)
const pendingCarryForward = computed(() => physicalItems.value.filter(i =>
  i.carry_forward_status === 'PENDING').length)
const totalClaimValue = computed(() => missingValue + mismatchValue + priceValue + qualityValue)
```

---

## Permissions / role gating

No component-level role gate. All INTERNAL roles that can see this tab can flag issues, record resolutions, upload and delete photos, and save changes. Shell controls tab visibility (AFTER_SALES / COMPLETED / COMPLETED_EDITING).

---

## Bilingual labels (InternalString)

None. All labels are English-only.

---

## Empty / error / loading states

| State | Trigger | UI |
|---|---|---|
| Loading | `loading` | Spinner centered |
| No items | `physicalItems.length === 0 && balanceItems.length === 0` | Icon + "No shipped items found" |
| No complaints | `!hasComplaints` | Issue value cards hidden |
| Success toast | `showToast()` call | Green banner, auto-hides after 4s |
| Save error | `saveAll()` fails | `alert()` — D-003 violation (Q-002) |
| Upload error | `handlePhotoUpload()` fails | `alert()` — D-003 violation (Q-002) |
| Delete error | `deletePhoto()` fails | `alert()` — D-003 violation (Q-002) |
| Resolution error | `saveResolution()` fails | `alert()` — D-003 violation (Q-002) |
| Saving | `saving` | Save button shows spinner + "Saving..." |

---

## Business rules

1. **`selling_price_inr` for claim values**: Claim value = `affected_quantity × selling_price_inr`. This is the client-facing selling price, not factory pricing. No `*_cny` or `factory_price` fields are present.

2. **PRODUCT_MISSING auto-fill**: When issue type is set to PRODUCT_MISSING, `affected_quantity` is auto-set to `max(0, sent_qty - received_qty)`. Also recalculates on `received_qty` change.

3. **COMPENSATE_BALANCE auto-fill**: `compensation_amount = selling_price_inr × affected_quantity`. For partial types, amounts are left blank for manual entry.

4. **Dual save paths**: `saveResolution(item)` saves resolution fields for one item. `saveAll()` saves all physical items (received_qty + issue fields) in bulk. Both paths co-exist in the UI. See Q-004 for state desync risk.

5. **Saved tick animation**: `saveResolution()` adds item.id to `savedItemIds` (shows green tick), then removes after 2 seconds via `setTimeout(() => {...}, 2000)`. Not a polling concern — single-use timeout.

6. **Balance items read-only**: `balanceItems` (compensation items from prior-order carry-forward) are displayed in a separate indigo section. No edit controls.

7. **Photo file trigger**: Hidden `<input type="file">` per item with id `photo-input-{itemId}`. Triggered by `document.getElementById(...)` — not using Vue ref map. Direct DOM access is used intentionally for the hidden input pattern.

8. **Excel export**: Blob URL pattern — creates `<a>` element, clicks it, revokes URL. Same pattern as LandedCostTab. Correct.

9. **Lightbox keyboard handling**: `@keydown.escape`, `@keydown.left`, `@keydown.right` on the wrapper div with `tabindex="0"`. Requires focus to work — no auto-focus after open. May not fire if keyboard focus is elsewhere.

---

## Known quirks / bugs

### Q-001 — `getPhotoUrl()` constructs bare `/uploads/` URL — **FIXED (G-019 / Patch 14, 2026-04-22)**

```javascript
function getPhotoUrl(filename) {
  return `/uploads/orders/${props.orderId}/aftersales/${filename}`
}
```

Used in: thumbnail `<img :src="getPhotoUrl(photo)">` (table), `<img :src="getPhotoUrl(photo)">` (lightbox), `<video :src="getPhotoUrl(photo)">` (lightbox video).

**Fix applied (Patch 14, 2026-04-22):** `getPhotoUrl()` updated to use the authenticated backend endpoint `GET /api/after-sales/{orderId}/photos/{filename}/download/`. The bare `/uploads/` path is no longer used. Backend endpoint is auth-gated with `Depends(get_current_user)` and order ownership verification. StaticFiles mount removed; nginx `/uploads/` location set to `internal;`. See G-019 in SECURITY_BACKLOG.md for full scope.

### Q-002 — D-003 violations: 1× `confirm()` + 3× `alert()`

```javascript
// confirm() in deletePhoto()
if (!confirm('Delete this photo?')) return

// alert() in deletePhoto() catch
alert(err.response?.data?.detail || 'Delete failed')

// alert() in handlePhotoUpload() catch
alert(err.response?.data?.detail || 'Photo upload failed')

// alert() in saveResolution() catch
alert(err.response?.data?.detail || 'Failed to save resolution')

// alert() in saveAll() catch
alert(err.response?.data?.detail || 'Save failed')
```

4 D-003 instances. Replace with `<ConfirmDialog>` and inline error banners in Next.js port.

### Q-003 — No tab-level stage guard in component

AfterSalesTab renders without any internal `isSailingStage`/status check. The component assumes the parent shell only renders it at the correct stage. This is consistent with the shell-gates architecture, but if mounted standalone, it would render without the stage check. Document this in migration notes.

### Q-004 — Dual save path state desync risk

`saveResolution(item)` saves `{resolution_type, resolution_notes, affected_quantity, compensation_amount}` for a single item and sets `item.status = 'RESOLVED'` locally. `saveAll()` then sends all physical items' full payload including `received_qty`, `objection_type`, `resolution_type` etc. If `saveResolution()` was called for an item and then `saveAll()` is called with the same item data, it re-sends everything — which should be idempotent. However, if `saveAll()` runs concurrently with `saveResolution()`, there's a race condition risk. The `saving` flag (for saveAll) and `savingItemId` (for saveResolution) are separate — no mutual exclusion.

### Q-005 — Excel download fails silently

```javascript
async function downloadExcel() {
  try {
    // ...blob download
  } catch (err) {
    console.error('Download after-sales Excel failed:', err)
    // No user-facing error — only console.error
  }
}
```

Silent failure — user clicks "Export Report" and nothing happens if the API fails.

### Q-006 — Lightbox keyboard events require manual focus

The lightbox wrapper has `tabindex="0"` and keyboard handlers, but no programmatic `.focus()` call after the lightbox opens. If keyboard focus is on a table cell, keyboard navigation will not work. Add `lightboxEl.value?.focus()` after `lightbox.show = true`.

---

## Dead code / unused state

None. 953 lines are all actively used.

---

## Duplicate or inline utilities

- **`isVideo(filename)`** — inline regex check. Extract to `utils/file-helpers.ts`. Same pattern as in `QueriesTab.vue` (`isVideoAttachment()`). Two instances — P-001 ×2, different implementations.
- **`resolutionsByIssue`, `issueLabels`, `resolutionLabels`** — local constant maps. Extract to `src/lib/after-sales.ts` for reuse in future after-sales views (client portal, factory portal).
- **`formatCurrency`** — correctly imported from utils/formatters. ✓

---

## Migration notes

1. **Authenticated photo access** ✅ **DONE (G-019 / Patch 14, 2026-04-22)**: `getPhotoUrl()` updated to use the authenticated backend endpoint `GET /api/after-sales/{orderId}/photos/{filename}/download/`. For Next.js migration, proxy through `GET /api/internal/after-sales/[orderId]/photos/[filename]/download` or call the backend endpoint directly with the session cookie. No unauthenticated path exposure remains. (Q-001 resolved)

2. **D-003 replacement**: Replace `confirm('Delete this photo?')` with `<ConfirmDialog>` component. Replace all 3 error `alert()` calls with inline error state per-action or a toast notification queue.

3. **Dual save consolidation**: In Next.js port, consider collapsing to a single save model. Options: (a) only `saveAll()` — remove per-item save button; (b) only per-item save — remove bulk save; (c) keep both but add mutual exclusion and clearer UX labels.

4. **Lightbox → React**: Port to React with `useEffect` for keyboard handler + `autoFocus` on mount. `Teleport` → React portal via `ReactDOM.createPortal`.

5. **`savedItemIds` tick animation**: Replace `setTimeout` + Set mutation with a simple `useTimeout` hook:
   ```typescript
   const [savedIds, addSavedId] = useSavedTick(2000)
   ```

6. **Issue/resolution constants**: Move to `src/lib/after-sales.ts`. Export `ISSUE_LABELS`, `RESOLUTION_LABELS`, `RESOLUTIONS_BY_ISSUE` for reuse.

7. **Excel download error**: Add catch handler that sets an `error` state and shows inline error message.

8. **Component size**: 953 lines. Consider extracting `<AfterSalesLightbox>` (lightbox + keyboard logic) and `<AfterSalesIssueRow>` (per-row form controls). Main component would reduce to ~500 lines.
