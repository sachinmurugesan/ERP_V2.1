import { Button } from "@/components/primitives/button";
import { PageShell } from "@/components/composed/page-shell";
import { GallerySection } from "../GallerySection";

export function PageShellGallery() {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-xl font-semibold">PageShell</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Standard page chrome — replaces inline header patterns in every Vue page.
          At Task 7, breadcrumb hrefs wire to Next.js{" "}
          <code className="rounded bg-muted px-1">&lt;Link&gt;</code>.
        </p>
      </div>

      <GallerySection title="Variant 1 — Title only" stacked>
        <div className="w-full border rounded-lg p-6 bg-card">
          <PageShell title="Orders">
            <p className="text-sm text-muted-foreground">Page content area.</p>
          </PageShell>
        </div>
      </GallerySection>

      <GallerySection title="Variant 2 — With breadcrumbs" stacked>
        <div className="w-full border rounded-lg p-6 bg-card">
          <PageShell
            title="Order #ORD-2024-001"
            breadcrumbs={[
              { label: "Orders", href: "/orders" },
              { label: "ORD-2024-001" },
            ]}
          >
            <p className="text-sm text-muted-foreground">Order detail content.</p>
          </PageShell>
        </div>
      </GallerySection>

      <GallerySection title="Variant 3 — With actions slot" stacked>
        <div className="w-full border rounded-lg p-6 bg-card">
          <PageShell
            title="Settings"
            breadcrumbs={[{ label: "Settings" }]}
            actions={
              <>
                <Button variant="outline" size="sm">Export</Button>
                <Button size="sm">Save changes</Button>
              </>
            }
          >
            <p className="text-sm text-muted-foreground">Settings content area.</p>
          </PageShell>
        </div>
      </GallerySection>

      <GallerySection title="Variant 4 — Factory ledger (D-009-A2 context)" stacked>
        <div className="w-full border rounded-lg p-6 bg-card">
          <PageShell
            title="Factory Ledger"
            breadcrumbs={[
              { label: "Finance", href: "/finance" },
              { label: "Factory Ledger" },
            ]}
            actions={
              <>
                <Button variant="outline" size="sm">Download PDF</Button>
                <Button variant="outline" size="sm">Download Excel</Button>
              </>
            }
          >
            <p className="text-sm text-muted-foreground">
              This page is gated by RoleGate with permission="FACTORY_LEDGER_VIEW".
              Only SUPER_ADMIN and FINANCE can reach it (D-009-A2).
            </p>
          </PageShell>
        </div>
      </GallerySection>
    </div>
  );
}
