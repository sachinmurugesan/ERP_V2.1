# Settings

**Type:** page
**Portal:** internal
**Route:** `/settings` (`meta.roles: ['ADMIN']`)
**Vue file:** [frontend/src/views/Settings.vue](../../../frontend/src/views/Settings.vue)
**Line count:** 646
**Migration wave:** Wave 1 (ADMIN surface, but straightforward CRUD)
**Risk level:** medium (four CRUD sub-tabs, in-place row editing, native `confirm()` dialogs, and business-sensitive numbers like FX rates and markup %)

## Purpose (one sentence)
ADMIN-only global configuration console with four tabs — Exchange Rates, Categories (with markup %), Transit Times, System Defaults — each with its own inline add/edit/delete flow.

## Layout (top→bottom, left→right, exhaustive)

### Shell
A single `<div>` wrapper (no shadow card) with a `<Teleport to="body">` toast at the top.

### Zone 1 — Toast (teleported)
Slide-in-from-right (`translate-x-full → translate-x-0`) emerald-600 pill, shows `message` ref (auto-clears after 3s via `setTimeout`). Contains check-circle icon, message text, and a `×` dismiss. Used for **every** success/error across the four tabs.

### Zone 2 — Header row (`flex justify-between items-start mb-6`)
- Left: `<h1>Configuration` + subtitle `Manage global system parameters, exchange rates, and defaults.`
- Right: **Seed Data** button (outlined slate). Disabled when `saving`. Icon `pi pi-database`.

### Zone 3 — Tab bar (`border-b border-slate-200 mb-6`, `flex gap-6`)
Four pill-tabs, each `flex items-center gap-2 px-1 pb-3 text-sm font-medium border-b-2`:
| key | label | icon |
|---|---|---|
| `rates` | Exchange Rates | `pi pi-money-bill` |
| `categories` | Categories | `pi pi-th-large` |
| `transit` | Transit Times | `pi pi-truck` |
| `defaults` | Defaults | `pi pi-sliders-h` |

Active tab: `border-emerald-600 text-emerald-600`. Inactive: transparent border, slate-500.

### Zone 4 — Loading overlay (`v-if="loading"`)
A `bg-white rounded-xl shadow-sm p-12 text-center text-slate-400` block with spinner + `Loading settings...`.

### Zone 5A — `rates` tab content
Contained in `bg-white rounded-xl shadow-sm`.

**Toolbar row:** info-caption `Changes effect new calculations immediately` + **Add Currency Pair** emerald CTA (`pi pi-plus`).

**Inline "New Rate" form** (`v-if="showNewRateForm"`, slate-50 background, below toolbar):
- Three `w-40` inputs: **From Currency** (text, e.g. `CNY`), **To Currency** (text, e.g. `INR`), **Rate** (number, step 0.01).
- **Add** submit button (disabled when `saving || !from || !to`) + **Cancel**.

**Empty state (no rates):** `No exchange rates configured. Click "Seed Data" to add defaults.`

**Rates table:**
| Column | Cell |
|---|---|
| From Currency | 32px amber-circle + code + full name (via `currencyNames` map: CNY, USD, EUR, GBP, INR) |
| To Currency | Same visual as From |
| Exchange Rate | Either display `₹ {rate}` (`\u20b9`, font-mono) OR, when `editingRate === row.id`, an inline input with `₹` prefix and `INR` pill suffix |
| Last Updated | `rate.updated_at` via `toLocaleDateString()`, em-dash if null |
| Actions | **Edit** pencil → `editRate(row)` OR, while editing, a check (✓ save) + × (cancel) pair |

**Footer count:** `Showing 1 to {N} of {N} currencies`.

**Info banner** (under the card): blue `About Exchange Rates` explaining that historical rates are preserved on completed orders; edits only affect new drafts.

### Zone 5B — `categories` tab content
`bg-white rounded-xl shadow-sm`.

**Header:** `Product Categories & Default Markups` + description `Markup % applied when "Convert to Selling Price" is clicked at Stage 2. Can be overridden per product.` + **Add Category** button.

**Inline form** (`v-if="showCategoryForm"`): Category Name (full width) + Default Markup % (number, step 0.5, min 0, max 100) + **Add/Update** (submit disabled if no name) + **Cancel**. Form title flips between `New Category` and `Edit Category` based on `editingCategory`.

**Empty state:** `No categories configured. Click "Seed Default Data" or add categories manually.`

**Table:**
| Column | Cell |
|---|---|
| Category Name | `cat.name` |
| Default Markup % | amber pill: `{markup_percent}%` font-mono |
| Actions | **Edit** pencil + **Delete** trash |

Delete flow: native `window.confirm('Delete this category?')` gate (line 174), then `settingsApi.deleteCategory(id)`.

### Zone 5C — `transit` tab content
Same shape as Categories tab.

**Inline form:** Port of Loading (China) + Port of Discharge (India) + Transit Days (1–90).

**Table:**
| Column | Cell |
|---|---|
| Port of Loading | plain |
| → | arrow glyph |
| Port of Discharge | plain |
| Transit Days | cyan pill: `{days} days` |
| Actions | Edit + Delete (native confirm: `Delete this transit route?`) |

### Zone 5D — `defaults` tab content
`bg-white rounded-xl shadow-sm`.

**Header:** `System Defaults` + description `Company information, default values for forms, and system-wide settings.`

**Empty state:** `No system defaults configured. Click "Seed Default Data" to add defaults.`

**Table:**
| Column | Cell |
|---|---|
| Setting Key | human-readable (snake→Title Case) + mono `setting.key` caption |
| Value | plain text OR inline text input when `editingDefault === setting.key` |
| Type | `setting.data_type` (`string` / `number` / `boolean` / etc., lowercase) |
| Actions | Edit pencil; while editing: **Save** + **Cancel** |

**No delete on defaults** — they are system-managed rows; admin can only edit the value.

## Data displayed
| Field | Source (api/index.js export.method) | Format | Notes |
|---|---|---|---|
| Rates list | `settingsApi.getExchangeRates` | `[{id, from_currency, to_currency, rate, updated_at}]` | returns `rate` as number |
| Rate save | `settingsApi.updateExchangeRate({from_currency, to_currency, rate})` | — | Same endpoint used for both "add new" and "update existing" (see Business Rules) |
| Categories list | `settingsApi.getCategories` | `[{id, name, markup_percent}]` | |
| Category create | `settingsApi.createCategory({name, markup_percent})` | — | |
| Category update | `settingsApi.updateCategory(id, {…})` | — | |
| Category delete | `settingsApi.deleteCategory(id)` | — | |
| Transit list | `settingsApi.getTransitTimes` | `[{id, port_of_loading, port_of_discharge, transit_days}]` | |
| Transit create | `settingsApi.createTransitTime` | — | |
| Transit update | `settingsApi.updateTransitTime(id, {…})` | — | |
| Transit delete | `settingsApi.deleteTransitTime(id)` | — | |
| Defaults list | `settingsApi.getDefaultsList` | `[{id, key, value, data_type}]` | uses the `list/` variant (line 427 in api/index.js) |
| Default update | `settingsApi.updateDefault(key, value)` | PUT `/settings/defaults/` with body `{key, value}` | value is sent as-is (string) regardless of `data_type` |
| Seed | `settingsApi.seedData` | POST `/settings/seed/` | returns `{ message }` shown in toast |

## Interactions (exhaustive)
| Trigger | Action | API call | Result |
|---|---|---|---|
| Click any tab | sets `activeTab` | none | re-renders body |
| Click **Seed Data** | `seedData()` | `settingsApi.seedData` then `loadAll` | toast shows server's `message` |
| Click **Add Currency Pair** | `openNewRate()` | none | reveals inline form, resets `rateForm` to `{from: 'CNY', to: 'INR', rate: 0}` |
| Submit **Add** on new rate | `saveNewRate()` | `settingsApi.updateExchangeRate(rateForm)` | toast `Currency pair added` and `loadAll` |
| Click pencil on rate row | `editRate(rate)` | none | inline-edits that row (replaces display with input) |
| Click ✓ during rate edit | `saveRate()` | `settingsApi.updateExchangeRate(rateForm)` | toast `Rate updated`, closes edit, `loadAll` |
| Click × during rate edit | `cancelRateEdit()` | none | closes edit |
| Click **Add Category** | `openCategoryForm()` | none | shows empty form |
| Click pencil on category | `openCategoryForm(cat)` | none | shows prefilled form |
| Submit **Add/Update** category | `saveCategory()` | create or update via `settingsApi.createCategory` / `updateCategory` | toast + close form + `loadAll` |
| Click trash on category | `deleteCategory(id)` | native `confirm()` then `settingsApi.deleteCategory` | toast + `loadAll` |
| Click **Add Route** (transit) | `openTransitForm()` | none | |
| Click pencil on transit | `openTransitForm(tt)` | none | |
| Submit transit form | `saveTransit()` | create / update | |
| Click trash on transit | `deleteTransit(id)` | native `confirm()` + delete | |
| Click pencil on default | `editDefault(setting)` | none | inline edit in-row |
| Click **Save** on default | `saveDefault(setting)` | `settingsApi.updateDefault(key, value)` | toast `"{key}" updated` |
| Click **Cancel** on default edit | sets `editingDefault = null` | none | |

## Modals/dialogs triggered (inline)
The page uses **no modal overlays**. "Forms" are inline reveal-panels. Destructive ops use the **native `window.confirm()`**.

| "Dialog" | Triggered by | Purpose | API on submit |
|---|---|---|---|
| New / Edit Rate inline form | `openNewRate` / `editRate` | add or update FX rate | `settingsApi.updateExchangeRate` |
| New / Edit Category inline form | `openCategoryForm` | add or update category | `settingsApi.createCategory` / `updateCategory` |
| New / Edit Transit inline form | `openTransitForm` | add or update transit route | `settingsApi.createTransitTime` / `updateTransitTime` |
| Native `confirm()` for delete | `deleteCategory` / `deleteTransit` | confirm delete | `deleteCategory` / `deleteTransitTime` |
| Toast (Teleport) | every save/delete | success + error | — |

## API endpoints consumed (from src/api/index.js)
- `settingsApi.getExchangeRates` / `updateExchangeRate`
- `settingsApi.getCategories` / `createCategory` / `updateCategory` / `deleteCategory`
- `settingsApi.getTransitTimes` / `createTransitTime` / `updateTransitTime` / `deleteTransitTime`
- `settingsApi.getDefaultsList` / `updateDefault`
- `settingsApi.seedData`

Uses 12 of the 17 `settingsApi` methods. Untouched: `getMarkups / createMarkup / updateMarkup / getDefaults` — legacy/alternate endpoints. [UNCLEAR — needs Sachin review: are the markup endpoints deprecated in favor of categories' `markup_percent`?]

## Composables consumed
None.

## PrimeVue components consumed
None. Hand-rolled tables, toasts via Vue 3 `<Teleport>` + `<Transition>`, native `confirm()` dialogs.

## Local state (refs, reactive, computed, watch)
- `loading`, `saving`, `message`, `activeTab: ref('rates')`.
- Rates: `rates`, `editingRate`, `showNewRateForm`, `rateForm`.
- Categories: `categories`, `showCategoryForm`, `editingCategory`, `categoryForm`.
- Transit: `transitTimes`, `showTransitForm`, `editingTransit`, `transitForm`.
- Defaults: `defaults`, `editingDefault`.
- `currencyNames`: constant lookup for full currency name.
- `tabs`: constant array of tab metadata.

No computed or watch (the `watch` import at line 2 is unused — dead code).

## Permissions/role gating
- `meta.roles: ['ADMIN']` (router index). The beforeEach guard explicitly widens this to also grant SUPER_ADMIN ([router/index.js:392](../../../frontend/src/router/index.js#L392)).
- Sidebar only shows the link to ADMIN.

## Bilingual labels (Tamil + English pairs)
None.

## Empty/error/loading states
Each tab has its own empty state (`No exchange rates configured`, `No categories configured`, `No transit routes configured`, `No system defaults configured`) — each prompts the admin to `Seed Data`.

Loading state is shared across tabs (one `Loading settings...` block driven by `loading === true`).

Errors are surfaced via the teleport toast with server `detail` message.

## Business rules (the non-obvious ones)
1. **The "Add" button for exchange rates reuses the same `updateExchangeRate` endpoint as "Edit"** — the backend is upsert-style on the `{from, to}` pair. This is why `saveRate` and `saveNewRate` both call `settingsApi.updateExchangeRate(rateForm)` (lines 106, 129).
2. **Category markup is a *default* only** — per the subtitle: "Can be overridden per product." The markup is applied when an operator clicks **Convert to Selling Price** at Stage 2 of an order (see OrderItemsTab / Final PI flow).
3. **Transit times power ETA calculation** — when a container is booked (BookingTab), the `transit_days` value for the selected loading↔discharge pair is used to pre-fill ETA.
4. **Historical FX rates are preserved** — editing a rate here does NOT retroactively change completed orders. This is confirmed by the blue info banner.
5. **`formatValue(0)`-style pitfall does not apply** (rates are displayed raw: `₹ 12.34`).
6. **Native `confirm()` is blocking** — a poor UX on destructive operations. Every delete path uses it; no undo.
7. **Defaults table hides `data_type` until edit mode** — the TYPE column shows the declared type but the input is always `type="text"`. Numeric defaults are coerced at the server.
8. **Seed does not overwrite** (inferred from UX copy) — it only adds rows when tables are empty. [UNCLEAR — needs Sachin review to confirm backend idempotency.]

## Known quirks
- **Toast auto-dismiss hard-coded to 3s** (`setTimeout` in `showMessage`). There's no way to extend it for error messages, which typically need longer read time.
- **Three forms share identical state-transition logic** (`showXForm`, `editingX`, `saveX`). They're copy-pasted rather than generalized into a single `<InlineRowForm>` component — high migration value to extract.
- **`loadAll()` refetches everything every time**, even though only one tab may have changed. Fine for an ADMIN-only page but worth noting for the Next.js rebuild (maybe invalidate-per-resource with SWR / React Query).
- **Categories form has markup % range 0–100** hard-coded in the `<input>` (`min="0" max="100"`). Larger markups (>100%) are not expressible. [UNCLEAR — needs Sachin review.]
- **Transit days range 1–90** — caps at ~3 months. Atypical routes (Africa, South America) may exceed.
- **No "restore default" affordance** for system defaults — once an admin edits a value, there is no explicit revert.
- Unused `watch` import at top of file.

## Migration notes
- **Claude Design template mapping:** **Ledger** hybrid — it's a tabbed CRUD for small reference tables. Could be realized as a single "Admin Console" template that hosts multiple resource editors.
- **Layer 2 components needed:** `TabBar` (simple, not PrimeVue), `ResourceTable` (reusable for all four), `InlineRowForm`, `EditableCell` (pencil → inline input → save/cancel), `ToastHost` (already teleported; generalize), `ConfirmDialog` (replace the native `confirm()` with a proper component), `EmptyState` (consistent across tabs), `CurrencyChip` (for the FROM/TO cells with icon + code + name).
- **New Layer 1 strings to add:** Lots — tab labels (×4), table headers (×4 tables), every CTA label (`Add Currency Pair`, `Add Category`, `Add Route`, `Seed Data`, `Edit`, `Save`, `Cancel`, `Delete`), 4 empty-state strings, info-banner body, form labels (From Currency, To Currency, Rate, Category Name, Default Markup %, Port of Loading (China), Port of Discharge (India), Transit Days), confirm prompts (`Delete this category?` etc.), toast messages (`Rate updated`, `Category created`, `Category updated`, `Category deleted`, `Currency pair added`, `Transit time added`, `Transit time updated`, `Transit time deleted`, `"{key}" updated`, `Seed failed: …`), generic error prefix (`Error:`).
- **Open questions for Sachin:**
  1. Are `getMarkups` / `createMarkup` / `updateMarkup` in `settingsApi` dead code, or do they power a separate flow we should audit?
  2. Should deletes get a real confirm dialog + undo, instead of native `window.confirm()`?
  3. Markup 0–100% cap: real or accidental?
  4. Transit days 1–90 cap: real or accidental?
  5. Is seeding idempotent / additive, or does it overwrite existing rows?
  6. Should the defaults editor be typed (e.g., boolean-as-toggle, number-as-number) rather than always a text input?
  7. Do FX rate updates need an audit-log entry visible in `/audit-logs`?
