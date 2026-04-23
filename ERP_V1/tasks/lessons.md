# HarvestERP - Lessons Learned

## Credit System Design Patterns

### 1. CREDIT payments are internal reallocations, NOT real money
**Context**: When a credit is applied from Order A's overpayment to Order B, a CREDIT-method payment is created on Order B. This is an internal accounting entry, not actual money received/sent.

**Rules**:
- **Ledgers** must exclude `method == "CREDIT"` payments. The original overpayment is already in the ledger as a real payment on the source order. Including the CREDIT payment double-counts.
- **Surplus/credit recalculation** (`_recalculate_credit`, `_recalculate_factory_credit`) must exclude CREDIT payments from `total_paid`. Only count real money (`method != "CREDIT"`).
- **Order payment summary** SHOULD include CREDIT payments (they DO reduce the order's balance from the order's perspective).

### 2. Applied credits must be subtracted from available surplus
**Context**: When recalculating surplus for an order, the raw surplus = real_payments - bill. But some of that surplus may have already been consumed (APPLIED credits). If not subtracted, the system recreates credits that were already used.

**Rule**: `target_available = surplus - applied_total` where `applied_total = sum of APPLIED credits from this source order`.

### 3. Self-referential credit guard
**Context**: When a credit sourced from Order X is applied to Order X itself, and _recalculate_credit creates a surplus credit on Order X, it becomes available for re-application on the same order, creating an infinite loop of payments.

**Rule**: Two-layer defense:
- Frontend: Filter `source_order_id !== orderId` in available credits list
- Backend: Guard `if credit.source_order_id == order_id: raise 400`

### 4. Partial credit application
**Context**: When applying a credit larger than the remaining balance, only apply what's needed.

**Rule**: `apply_amount = min(credit.amount, balance)`. If partial:
- Reduce credit amount by apply_amount, keep status AVAILABLE
- If full: mark status APPLIED, set applied_to_order_id

### 5. Credit banner UX
**Context**: Available credits banner should inform the user but not offer actions that aren't possible.

**Rule**:
- Always show the banner when credits exist (informational)
- Use `v-if` on the Apply button: only show when bill is NOT fully paid
- For same-order credits: show "Credit from this order" label instead of button

## Windows/OneDrive Development Issues

### 6. Stale Python bytecache
**Context**: On Windows with OneDrive sync, `--reload` flag on uvicorn frequently serves old code from `__pycache__`.

**Fix**: Kill ALL Python processes, delete `__pycache__` and `*.pyc` files, then restart. May need to repeat.

```powershell
Get-Process python* | Stop-Process -Force
Remove-Item -Recurse -Force backend\__pycache__, backend\routers\__pycache__
```

### 7. UnicodeEncodeError on Windows
**Context**: Special characters (arrows, emojis) in Python print statements fail on Windows console.

**Fix**: Add `sys.stdout.reconfigure(encoding='utf-8')` at top of scripts, or avoid non-ASCII characters in print statements.

## General Patterns

### 8. Credit payment deletion must restore properly
**Context**: When deleting a CREDIT-method payment, the original credit should be restored. But partial applications change the credit amount, so matching by `amount == payment.amount_inr` can fail.

**Current limitation**: Deletion handler matches on amount + status, which breaks for partial applications. The `_recalculate_*_credit` function compensates by recomputing surplus on the next trigger.

### 9. Test with realistic flows
**Context**: Credit system bugs only surface with multi-step flows: overpay Order A, apply credit to Order B, add more payments to B, check ledger.

**Rule**: Always trace the full lifecycle when testing financial features. Check both order-level views AND cross-order views (ledgers, credit lists).

## SQLite Schema Migration Patterns

### 10. SQLite `create_all()` does NOT update existing tables
**Context**: When the model changes FK references (e.g., `shipments.freight_forwarder_id` changed from `REFERENCES freight_forwarders` to `REFERENCES service_providers`), `Base.metadata.create_all()` only creates missing tables. It does NOT alter existing table schemas.

**Rule**: When changing FK references on existing tables, add an explicit migration in `main.py` that rebuilds the table (rename → create → copy → drop). Always check FK definitions with `_insp.get_foreign_keys()` at startup.

### 11. SQLite RENAME TABLE rewrites FKs in ALL child tables
**Context**: When you `ALTER TABLE foo RENAME TO foo_old`, SQLite silently rewrites FK references in ALL other tables that pointed to `foo` to now point to `foo_old`. This corrupts every child table — not just one. E.g., renaming `shipments` corrupted FKs in `shipment_items`, `shipping_documents`, and any other table with `REFERENCES shipments(id)`.

**Rule**: Always use `PRAGMA legacy_alter_table=ON` before renaming tables during migrations. When fixing a previous corruption, check ALL tables that reference the renamed table (not just the first one you find). Pattern:
```sql
PRAGMA foreign_keys=OFF;
PRAGMA legacy_alter_table=ON;
ALTER TABLE target RENAME TO _target_old;
CREATE TABLE target (...corrected FKs...);
INSERT INTO target SELECT ... FROM _target_old;
DROP TABLE _target_old;
PRAGMA legacy_alter_table=OFF;
PRAGMA foreign_keys=ON;
```

### 12. Always check the actual error response body for 500s
**Context**: User reported persistent 500 error on booking save. Direct API tests succeeded because the backend had just restarted. The actual error was `IntegrityError: FOREIGN KEY constraint failed` — visible only in the response body.

**Rule**: When debugging 500 errors:
1. Add a global exception handler that includes the error type and message in the response
2. Check the actual response body (not just the status code)
3. Reproduce in the actual browser, not just via curl (timing matters)

## Stage/Status Guard Patterns

### 13. When adding a new order status, update ALL component-level status arrays
**Context**: When the `AFTER_SALES` status was added, the `OrderDetail.vue` parent's `availableTabs` computed was correctly updated to include `'AFTER_SALES'` in all stage check arrays. However, each individual tab component (PaymentsTab, PackingListTab, BookingTab, SailingTab, ShippingDocsTab, CustomsTab) has its OWN duplicate status arrays for internal v-if guards. These were NOT updated, causing all 6 tabs to render blank when the order was in AFTER_SALES status.

**Rule**: Status arrays are duplicated across components. When adding a new status:
1. Update `OrderDetail.vue` → `availableTabs` computed and all `isXxxStage` computeds
2. Update EVERY individual tab component's internal stage check (`isPostPI`, `isStage4Plus`, `isStage6Plus`, `showPackingSection`, `isBookingStage`, `isSailingStage`, `isCustomsStage`, etc.)
3. The new status should be inserted in chronological order: `'DELIVERED', 'AFTER_SALES', 'COMPLETED', 'COMPLETED_EDITING'`
4. Search for `'DELIVERED', 'COMPLETED'` across all frontend files to find arrays that need updating

## After-Sales Items: Zero/Negative Price Edge Cases

### 14. After-sales items break EVERY place that checks `!price` or sums totals
**Context**: After-sales carry-forward items have intentional 0 (REPLACEMENT) or negative (COMPENSATION) prices. JavaScript `!0` is `true` and `0 ? x : y` returns `y`. Python `not 0` is `True` and `0 or fallback` returns `fallback`. These falsy/truthy patterns are used throughout the codebase for "has price" checks.

**Places that broke (fixed)**:
- `saveItemPrice()`: `item.selling_price_inr ? parseFloat(...) : null` → sent `null` instead of `0` → Fix: use `!= null`
- `Copy from Last Order`: didn't skip after-sales items → overwrote 0 price with old positive price
- `Apply Markup`: applied markup to after-sales items → overwrote 0 price
- Missing price warnings: `!i.selling_price_inr` flagged 0 as "missing" → Fix: exclude after-sales items
- Stage transition validation: `not i.selling_price_inr` blocked progression → Fix: exclude after-sales items
- PI total stored in DB: generated with wrong prices, then payment system used stale total → Fix: recalculate from active items
- Apply Credit: `balance <= 0` because PI total was 0 → Fix: use effective total from items
- Excel price upload: overwrote after-sales items' factory_price_cny → Fix: skip after-sales items
- Read-only price display: `item.price ? formatted : '—'` showed em-dash for 0 → Fix: use `!= null`
- Price input min="0": prevented entering negative values for COMPENSATION items → Fix: disable inputs for after-sales
- Save indicator: showed "not saved" circle for 0 price → Fix: show lock icon for after-sales

**Rule**: When adding ANY code that touches item prices:
1. Check: "What happens when `selling_price_inr = 0`?" (REPLACEMENT)
2. Check: "What happens when `selling_price_inr < 0`?" (COMPENSATION)
3. Check: "What happens when `factory_price_cny = 0`?" (all after-sales)
4. Use `!= null` or `!== null` instead of truthiness for price checks
5. Exclude after-sales items from validation that requires positive prices
6. Disable/lock price inputs for after-sales items (they have fixed pricing)
7. When storing totals (PI total), recalculate from items if they may have changed

### 15. Financial flow must use effective totals, not stored PI totals
**Context**: The PI total stored in `ProformaInvoice.total_inr` can become stale when after-sales item prices are corrected or items are unloaded. The payment system (Apply Credit, balance calculation, isOrderFullyPaid) relies on this total.

**Rule**: Always compare stored PI total with recalculated total from active items. If they differ (`has_divergence`), use the recalculated total. This covers:
- After-sales price corrections (reset endpoint)
- Unloaded items reducing the effective total
- Any future scenario where item prices change after PI generation

Pattern in `list_payments()`:
```python
revised_client_total = sum((i.selling_price_inr or 0) * i.quantity for i in active_items)
has_divergence = unloaded_count > 0 or round(revised_client_total, 2) != round(pi_total_inr, 2)
effective_total = round(revised_client_total, 2) if has_divergence else pi_total_inr
```

## Image Upload Patterns

### 16. Excel image "replace" must only delete old images ONCE per product
**Context**: When the Excel apply endpoint extracts images, the "replace" conflict resolution deletes old images and saves new ones. But the delete-then-save logic runs inside a loop over ALL images in the Excel. If a product appears in multiple Excel rows, the second iteration re-queries the DB and finds (then deletes) the image just saved by the first iteration.

**Root cause**: The `existing_pids` set was checked on every iteration, but never updated after the first replace. So subsequent images for the same product re-triggered the delete-all block, which now found and deleted the freshly saved image.

**Fix**: Track `replaced_pids = set()`. After the first replace for a product, add it to `replaced_pids`. Guard the replace block with `pid not in replaced_pids`.

**Rule**: When a loop iteration modifies DB state that a subsequent iteration queries, ensure idempotency with a "already processed" guard set.

### 17. Product image files can vanish — always have a re-extract path
**Context**: Product image files stored at `C:/HarvestERP/uploads/products/<uuid>/` disappeared from disk while DB records remained. Root cause unclear (possibly OneDrive sync, antivirus, or the replace bug above). The backend disk-existence check then hid all images.

**Rule**:
- Backend must validate file existence before returning thumbnail URLs (done)
- Frontend must handle broken `<img>` with `@error` fallback (done)
- Keep the `/api/products/re-extract-images/` endpoint as a recovery tool
- The original Excel files in temp directory are the source of truth for images

## Carry-Forward Lifecycle Patterns

### 18. Carry-forward items need AfterSalesItem in the destination order
**Context**: When carry-forward claims (REPLACEMENT/COMPENSATION) are added to a new order as OrderItems, the system only tracked `carry_forward_status=ADDED_TO_ORDER` on the original claim. There was no AfterSalesItem in the new order to track whether the replacement was actually delivered OK.

**Rule**: When auto-adding carry-forward OrderItems during order creation, also create an AfterSalesItem in the new order with `source_aftersales_id` pointing back to the original claim. This enables:
- FULFILLED trigger: when new order's ASI is CLOSED → original claim becomes FULFILLED
- Re-objection chain: if replacement has issues → new resolution → chains forward
- Audit trail: every claim resolution has end-to-end tracking

### 19. Three item types at packing — each needs different handling
**Context**: After carry-forward, the packing list can contain three types of items:
1. Regular paid items (selling_price > 0) → fully packable
2. Replacement carry-forward (selling_price = 0) → packable, but unload reverts original claim to PENDING
3. Compensation balance (selling_price < 0) → NOT physical, read-only on packing list

**Rule**: Always classify items by selling_price before applying packing operations:
- `selling_price < 0` → skip from migration, show as read-only balance adjustment
- `selling_price = 0 + "After-Sales" in notes` → packable but revert original claim on unload
- `selling_price > 0` → normal packing behavior

## Code Deduplication & Dead Code Cleanup

### 20. Unicode characters break Python string replacement
**Context**: When using Python scripts to replace inline JavaScript functions containing Unicode characters (₹ U+20B9, ¥ U+00A5, — U+2014), Python triple-quoted string literals don't match the file content. The `str.replace()` silently returns the original string unchanged.

**Fix**: Use regex-based or line-number-based removal instead of exact string matching. The `re.compile` + brace-counting approach works reliably:
```python
pattern = re.compile(r'function\s+' + re.escape(func_name) + r'\s*\([^)]*\)\s*\{')
# Then count braces to find the matching close
```

**Rule**: Never use `str.replace()` for code blocks containing non-ASCII characters. Always use regex + structural matching.

### 21. Shared utility extraction — import before removing duplicates
**Context**: When deduplicating functions across 12+ Vue components, the workflow is: (1) create shared utility file, (2) add imports to each component, (3) remove inline definitions. If step 3 fails silently (e.g., Unicode mismatch), the build breaks with "Identifier already declared" errors.

**Rule**: After adding imports, always run `vite build` BEFORE considering the task complete. "Import added" ≠ "duplicate removed". Check each file individually if build fails.

### 22. Dead code should be DELETED, not commented out
**Context**: When commenting out 4 legacy model classes in models.py, overlapping `sed` + Python passes created double-commented lines (`# # class...`), messy blank lines, and 120+ lines of visual noise. The "clean" approach is deletion with a 2-line tombstone note.

**Rule**: For dead code that's been superseded by a replacement (e.g., 4 tables replaced by unified ServiceProvider):
- DELETE the code entirely
- Leave a 1-2 line comment noting what was removed and why
- The code is in git history if ever needed

### 23. Edit tool EEXIST errors on Windows — use Python pathlib instead
**Context**: The Claude Code `Edit` tool intermittently fails with `EEXIST: file already exists, mkdir` on Windows when editing files in existing directories. This appears to be a tool-level issue, not a filesystem problem.

**Fix**: Use Python `pathlib.Path.read_text()` / `write_text()` via Bash as a reliable alternative when the Edit tool fails.

### 24. Status arrays are the #1 duplication risk (Lesson #13 extended)
**Context**: The code review found 29+ duplicate definitions across 18+ files for formatDate, formatCurrency, indianStates, stageStyles, and status arrays. Status arrays were the worst — 7+ locations with subtle differences (some included AFTER_SALES, some didn't; some used CLEARED vs CUSTOMS_CLEARED).

**Rule**: The shared constants created in this cleanup:
- `frontend/src/utils/formatters.js` — formatDate, formatCurrency, formatINR, formatNumber
- `frontend/src/utils/constants.js` — STAGE_MAP, 9 status group Sets, INDIAN_STATES, getStageInfo()

When adding ANY new status or stage: update `constants.js` ONLY. All components import from there.

### 25. Parallel code review with 4 specialized agents catches 3x more issues
**Context**: Running Python, Security, Frontend, and Database reviewers in parallel produced 96 raw findings (52 after deduplication). Each reviewer caught issues the others missed. The overlap on critical issues (e.g., Float for money flagged by 3 of 4 agents) confirmed the most important findings.

**Rule**: For comprehensive review, always run at least: Python + Security + Database reviewers. Add Frontend reviewer for full-stack apps. Deduplicate results into a single prioritized report.
