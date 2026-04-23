"use client";

/**
 * ComposedGallery — /gallery/composed
 *
 * Aggregator page showing all 5 audit-driven composed components in
 * 2–4 state variants on a single canvas.
 *
 *   ConfirmDialog (D-003)         — 4 variants: basic, destructive, context card, async loading
 *   LedgerPage    (P-017)         — 3 variants: loaded, empty, loading skeleton
 *   HighlightScrollTarget (P-022) — 3 hash targets, click-to-navigate
 *   CarryForwardStepper   (P-005) — horizontal, vertical, blocked step
 *   RoleGate (D-004/D-009/D-010)  — 4 role × permission combos
 *
 * String props use the D-005 type system: pass `{ en: "..." }` objects,
 * not plain strings. Use `{ en: "...", ta: "..." }` when Tamil copy is available.
 */

import { useState } from "react";
import { UserRole, Resource } from "@harvesterp/lib";
import { ConfirmDialog } from "@/components/composed/confirm-dialog";
import { LedgerPage } from "@/components/composed/ledger-page";
import { HighlightScrollTarget } from "@/components/composed/highlight-scroll-target";
import { CarryForwardStepper } from "@/components/composed/carry-forward-stepper";
import { RoleGate } from "@/components/composed/role-gate";
import { Button } from "@/components/primitives/button";
import { GallerySection } from "../GallerySection";

// ── Stub data ─────────────────────────────────────────────────────────────────

const ENTITY_OPTIONS = [
  { id: "client-1", name: "Zara India" },
  { id: "client-2", name: "H&M South Asia" },
];

const LEDGER_SUMMARY = [
  { label: "Total Outstanding", value: "₹12,48,500", variant: "negative" as const },
  { label: "Total Paid",        value: "₹24,31,200", variant: "positive" as const },
  { label: "Credit Limit",      value: "₹50,00,000" },
  { label: "Overdue",           value: "₹3,12,000",  variant: "negative" as const },
];

const LEDGER_TRANSACTIONS = [
  { date: "04 Jan 2025", description: "Invoice #INV-2025-001 — Woven Cotton 60\"", debit: 428500, runningBalance: 428500 },
  { date: "06 Jan 2025", description: "Payment received", credit: 200000, runningBalance: 228500 },
  { date: "08 Jan 2025", description: "Invoice #INV-2025-002 — Jersey Knit 180g",  debit: 312000, runningBalance: 540500 },
  { date: "10 Jan 2025", description: "Payment received", credit: 150000, runningBalance: 390500 },
];

const STEPS_HORIZONTAL = [
  { id: "h1", label: "Order placed",  status: "complete" as const, timestamp: "01 Jan" },
  { id: "h2", label: "In production", status: "complete" as const, timestamp: "03 Jan" },
  { id: "h3", label: "Quality check", status: "current"  as const },
  { id: "h4", label: "Dispatch",      status: "upcoming" as const },
];

const STEPS_VERTICAL = [
  { id: "v1", label: "Request received", status: "complete" as const, timestamp: "01 Jan 10:00" },
  { id: "v2", label: "Parts sourced",    status: "complete" as const, timestamp: "02 Jan 14:30" },
  { id: "v3", label: "Assembly",         status: "current"  as const },
  { id: "v4", label: "Delivery",         status: "upcoming" as const },
];

const STEPS_BLOCKED = [
  { id: "b1", label: "Submitted",      status: "complete" as const },
  { id: "b2", label: "Customs review", status: "blocked"  as const },
  { id: "b3", label: "Clearance",      status: "upcoming" as const },
  { id: "b4", label: "Released",       status: "upcoming" as const },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type DialogVariant = "basic" | "destructive" | "context" | "loading";

// ── Component ─────────────────────────────────────────────────────────────────

export function ComposedGallery() {
  const [dialogOpen, setDialogOpen] = useState<DialogVariant | null>(null);
  const [activeHash, setActiveHash] = useState("");
  const [ledgerEntityId, setLedgerEntityId] = useState("client-1");

  const closeDialog = () => setDialogOpen(null);

  return (
    <div className="space-y-14">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-semibold">Composed — Aggregator</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All 5 audit-driven composed components (D-003, P-005, P-017, P-022, D-004) in 2–4 state variants.
        </p>
      </div>

      {/* ── 1. ConfirmDialog (D-003) ──────────────────────────────────────── */}
      <section className="space-y-4" aria-labelledby="h-confirm-dialog">
        <div>
          <h2 id="h-confirm-dialog" className="text-lg font-semibold">
            ConfirmDialog (D-003)
          </h2>
          <p className="text-sm text-muted-foreground">
            Replaces all{" "}
            <code className="rounded bg-muted px-1">window.confirm()</code> calls.
            Four variants: basic, destructive + typed confirmation, context card, async loading.
          </p>
        </div>

        <GallerySection title="Variants — click to open">
          <Button variant="outline" onClick={() => setDialogOpen("basic")}>
            Basic confirm
          </Button>
          <Button variant="outline" onClick={() => setDialogOpen("destructive")}>
            Destructive delete
          </Button>
          <Button variant="outline" onClick={() => setDialogOpen("context")}>
            With context card
          </Button>
          <Button variant="outline" onClick={() => setDialogOpen("loading")}>
            Async loading
          </Button>
        </GallerySection>

        {/* Variant 1 — Basic */}
        <ConfirmDialog
          open={dialogOpen === "basic"}
          title={{ en: "Archive order?" }}
          message={{ en: "The order will be moved to the archive. You can restore it later." }}
          confirmLabel="Archive"
          onConfirm={closeDialog}
          onCancel={closeDialog}
        />

        {/* Variant 2 — Destructive + typed confirmation */}
        <ConfirmDialog
          open={dialogOpen === "destructive"}
          title={{ en: "Permanently delete order?" }}
          message={{ en: "This order and all associated line items will be removed forever." }}
          consequenceText={{ en: "This will delete 47 line items and cannot be undone." }}
          destructive
          requireTypedConfirmation="DELETE"
          onConfirm={closeDialog}
          onCancel={closeDialog}
        />

        {/* Variant 3 — preserveContext card */}
        <ConfirmDialog
          open={dialogOpen === "context"}
          title={{ en: "Carry forward to new order?", ta: "புதிய ஆர்டருக்கு முன்னோக்கி கொண்டு செல்லவும்?" }}
          message={{ en: "The following undelivered items will be copied to the next order.", ta: "பின்வரும் பொருட்கள் அடுத்த ஆர்டரில் சேர்க்கப்படும்." }}
          preserveContext={{
            summary: "3 undelivered items from ORD-2024-0188",
            bilingualSummary: {
              en: "3 undelivered items from ORD-2024-0188",
              ta: "ORD-2024-0188 இல் இருந்து 3 பொருட்கள்",
            },
            affectedItems: [
              { label: "Harvester blade", value: "×12 pcs" },
              { label: "Drive chain",     value: "×4 sets" },
              { label: "Bearing kit",     value: "×8 pcs" },
            ],
          }}
          confirmLabel="Carry Forward"
          onConfirm={closeDialog}
          onCancel={closeDialog}
        />

        {/* Variant 4 — Async (shows loading spinner) */}
        <ConfirmDialog
          open={dialogOpen === "loading"}
          title={{ en: "Submit for approval?" }}
          message={{ en: "The order will be sent to finance for payment authorisation." }}
          confirmLabel="Submit"
          onConfirm={() =>
            new Promise<void>((resolve) => setTimeout(resolve, 1500)).then(
              closeDialog,
            )
          }
          onCancel={closeDialog}
        />
      </section>

      {/* ── 2. LedgerPage (P-017) ─────────────────────────────────────────── */}
      <section className="space-y-6" aria-labelledby="h-ledger-page">
        <div>
          <h2 id="h-ledger-page" className="text-lg font-semibold">
            LedgerPage (P-017)
          </h2>
          <p className="text-sm text-muted-foreground">
            Entity-agnostic ledger: filter bar, summary cards, transaction table, download buttons.
            Three variants: loaded, empty, and loading skeleton.
          </p>
        </div>

        {/* Variant 1 — Loaded */}
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Variant — Loaded with data
          </p>
          <LedgerPage
            title={{ en: "Client Ledger" }}
            entityType="client"
            entityId={ledgerEntityId}
            entityOptions={ENTITY_OPTIONS}
            onEntityChange={setLedgerEntityId}
            summary={LEDGER_SUMMARY}
            transactions={LEDGER_TRANSACTIONS}
            onDownloadPdf={() => undefined}
            onDownloadExcel={() => undefined}
          />
        </div>

        {/* Variant 2 — Empty */}
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Variant — Empty state
          </p>
          <LedgerPage
            title={{ en: "Factory Ledger" }}
            entityType="factory"
            entityId="factory-1"
            entityOptions={[{ id: "factory-1", name: "Rajan Textiles" }]}
            onEntityChange={() => undefined}
            summary={LEDGER_SUMMARY}
            transactions={[]}
            empty
          />
        </div>

        {/* Variant 3 — Loading skeleton */}
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Variant — Loading skeleton
          </p>
          <LedgerPage
            title={{ en: "Client Ledger" }}
            entityType="client"
            entityId="client-1"
            entityOptions={ENTITY_OPTIONS}
            onEntityChange={() => undefined}
            summary={LEDGER_SUMMARY}
            transactions={[]}
            loading
          />
        </div>
      </section>

      {/* ── 3. HighlightScrollTarget (P-022) ──────────────────────────────── */}
      <section className="space-y-4" aria-labelledby="h-highlight">
        <div>
          <h2 id="h-highlight" className="text-lg font-semibold">
            HighlightScrollTarget (P-022)
          </h2>
          <p className="text-sm text-muted-foreground">
            Click a button to scroll to and briefly flash-highlight that section.
            Replaces the Vue{" "}
            <code className="rounded bg-muted px-1">nextTick scrollIntoView</code> pattern.
          </p>
        </div>

        <GallerySection title="Navigate to section">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveHash("hst-orders")}
          >
            → Orders
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveHash("hst-payments")}
          >
            → Payments
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveHash("hst-documents")}
          >
            → Documents
          </Button>
        </GallerySection>

        <div className="space-y-3">
          <HighlightScrollTarget id="hst-orders" currentHash={activeHash}>
            <div className="rounded-md border p-4">
              <p className="text-sm font-semibold">Orders Section</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Targeted by hash{" "}
                <code className="rounded bg-muted px-1">#hst-orders</code>
              </p>
            </div>
          </HighlightScrollTarget>

          <HighlightScrollTarget id="hst-payments" currentHash={activeHash}>
            <div className="rounded-md border p-4">
              <p className="text-sm font-semibold">Payments Section</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Targeted by hash{" "}
                <code className="rounded bg-muted px-1">#hst-payments</code>
              </p>
            </div>
          </HighlightScrollTarget>

          <HighlightScrollTarget id="hst-documents" currentHash={activeHash}>
            <div className="rounded-md border p-4">
              <p className="text-sm font-semibold">Documents Section</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Targeted by hash{" "}
                <code className="rounded bg-muted px-1">#hst-documents</code>
              </p>
            </div>
          </HighlightScrollTarget>
        </div>
      </section>

      {/* ── 4. CarryForwardStepper (P-005) ────────────────────────────────── */}
      <section className="space-y-4" aria-labelledby="h-stepper">
        <div>
          <h2 id="h-stepper" className="text-lg font-semibold">
            CarryForwardStepper (P-005)
          </h2>
          <p className="text-sm text-muted-foreground">
            Merged from 4 duplicate Vue implementations. Three orientation/state variants.
          </p>
        </div>

        <GallerySection title="Horizontal — complete → current → upcoming">
          <div className="w-full min-w-0">
            <CarryForwardStepper steps={STEPS_HORIZONTAL} orientation="horizontal" />
          </div>
        </GallerySection>

        <GallerySection title="Vertical — with timestamps" stacked>
          <CarryForwardStepper steps={STEPS_VERTICAL} orientation="vertical" />
        </GallerySection>

        <GallerySection title="With blocked step — e.g. customs hold">
          <div className="w-full min-w-0">
            <CarryForwardStepper steps={STEPS_BLOCKED} orientation="horizontal" />
          </div>
        </GallerySection>
      </section>

      {/* ── 5. RoleGate (D-004/D-009/D-010) ──────────────────────────────── */}
      <section className="space-y-4" aria-labelledby="h-role-gate">
        <div>
          <h2 id="h-role-gate" className="text-lg font-semibold">
            RoleGate (D-004/D-009/D-010)
          </h2>
          <p className="text-sm text-muted-foreground">
            Frontend defence-in-depth gate. Uses{" "}
            <code className="rounded bg-muted px-1">canAccess()</code> from{" "}
            <code className="rounded bg-muted px-1">@harvesterp/lib</code>.
            Backend is the authoritative layer (D-006).
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* ADMIN + ORDER_CREATE → allowed */}
          <div className="rounded-md border p-4 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              ADMIN — ORDER_CREATE
            </p>
            <RoleGate
              user={{ role: UserRole.ADMIN }}
              permission={Resource.ORDER_CREATE}
              fallback={<span className="text-sm text-red-600">Access denied</span>}
            >
              <span className="text-sm font-medium text-green-700">
                Access granted — order creation
              </span>
            </RoleGate>
          </div>

          {/* CLIENT + ORDER_CREATE → denied */}
          <div className="rounded-md border p-4 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              CLIENT — ORDER_CREATE (denied)
            </p>
            <RoleGate
              user={{ role: UserRole.CLIENT }}
              permission={Resource.ORDER_CREATE}
              fallback={<span className="text-sm text-red-600">Access denied</span>}
            >
              <span className="text-sm font-medium text-green-700">
                Access granted — order creation
              </span>
            </RoleGate>
          </div>

          {/* FINANCE + FACTORY_LEDGER_VIEW → allowed */}
          <div className="rounded-md border p-4 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              FINANCE — FACTORY_LEDGER_VIEW
            </p>
            <RoleGate
              user={{ role: UserRole.FINANCE }}
              permission={Resource.FACTORY_LEDGER_VIEW}
              fallback={<span className="text-sm text-red-600">Access denied</span>}
            >
              <span className="text-sm font-medium text-green-700">
                Access granted — factory ledger
              </span>
            </RoleGate>
          </div>

          {/* null user → fallback (unauthenticated) */}
          <div className="rounded-md border p-4 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              null user — unauthenticated
            </p>
            <RoleGate
              user={null}
              permission={Resource.ORDER_CREATE}
              fallback={
                <span className="text-sm text-muted-foreground">
                  Not authenticated
                </span>
              }
            >
              <span className="text-sm font-medium text-green-700">
                Access granted
              </span>
            </RoleGate>
          </div>
        </div>
      </section>
    </div>
  );
}
