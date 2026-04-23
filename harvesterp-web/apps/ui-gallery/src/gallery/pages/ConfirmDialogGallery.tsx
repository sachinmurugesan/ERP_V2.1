import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/primitives/button";
import { ConfirmDialog } from "@/components/composed/confirm-dialog";
import { GallerySection } from "../GallerySection";

type Variant = "basic" | "destructive" | "context" | "typed";

export function ConfirmDialogGallery() {
  const [open, setOpen] = useState<Variant | null>(null);

  const close = () => setOpen(null);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">ConfirmDialog (D-003)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Replaces all <code className="rounded bg-muted px-1">window.confirm()</code> /
          <code className="rounded bg-muted px-1 ml-1">window.alert()</code> calls.
          25–40+ sites across the migration.
        </p>
      </div>

      <GallerySection title="Variant 1 — Basic confirmation">
        <Button variant="outline" onClick={() => setOpen("basic")}>
          Basic confirm
        </Button>
        <ConfirmDialog
          open={open === "basic"}
          onCancel={close}
          title={{ en: "Save changes?" }}
          message={{ en: "Your changes will be saved to the order." }}
          onConfirm={() => {
            toast.success("Changes saved");
            close();
          }}
        />
      </GallerySection>

      <GallerySection title="Variant 2 — Destructive (D-003: red CTA)">
        <Button variant="destructive" onClick={() => setOpen("destructive")}>
          Delete category
        </Button>
        <ConfirmDialog
          open={open === "destructive"}
          onCancel={close}
          title={{ en: "Delete category", ta: "வகையை நீக்கவும்" }}
          message={{
            en: "Are you sure you want to delete this category?",
            ta: "இந்த வகையை நீக்க விரும்புகிறீர்களா?",
          }}
          consequenceText={{
            en: "This will remove all products in this category. This cannot be undone.",
            ta: "இந்த வகையில் உள்ள அனைத்து தயாரிப்புகளும் அகற்றப்படும். இதை மீட்டெடுக்க முடியாது.",
          }}
          destructive
          onConfirm={() => {
            toast.success("Category deleted");
            close();
          }}
        />
      </GallerySection>

      <GallerySection title="Variant 3 — With preserveContext card">
        <Button variant="outline" onClick={() => setOpen("context")}>
          Cancel shipment
        </Button>
        <ConfirmDialog
          open={open === "context"}
          onCancel={close}
          title={{ en: "Cancel shipment SH-023?", ta: "ஏற்றுமதி SH-023 ஐ ரத்து செய்யவும்?" }}
          message={{
            en: "This shipment will be cancelled and returned to draft.",
            ta: "இந்த ஏற்றுமதி ரத்து செய்யப்பட்டு வரைவாக திரும்பும்.",
          }}
          destructive
          preserveContext={{
            summary: "Shipment SH-023 · 47 line items · ETD 2026-05-02",
            bilingualSummary: {
              en: "Shipment SH-023 · 47 line items · ETD 2026-05-02",
              ta: "ஏற்றுமதி SH-023 · 47 வரிசைகள் · ETD 2026-05-02",
            },
            affectedItems: [
              { label: "Line items", value: "47" },
              { label: "Total value", value: "₹12,40,000" },
              { label: "ETD", value: "2026-05-02" },
            ],
          }}
          onConfirm={async () => {
            await new Promise((r) => setTimeout(r, 1500));
            toast.success("Shipment cancelled");
            close();
          }}
        />
      </GallerySection>

      <GallerySection title='Variant 4 — requireTypedConfirmation ("DELETE")'>
        <Button variant="destructive" onClick={() => setOpen("typed")}>
          Hard delete user
        </Button>
        <ConfirmDialog
          open={open === "typed"}
          onCancel={close}
          title={{ en: "Permanently delete user account?" }}
          message={{ en: "This action is irreversible. All data will be purged." }}
          consequenceText={{ en: "The user will lose access immediately and all records will be deleted." }}
          destructive
          requireTypedConfirmation="DELETE"
          onConfirm={() => {
            toast.success("User deleted");
            close();
          }}
        />
      </GallerySection>
    </div>
  );
}
