import { toast } from "sonner";
import { Button } from "@/components/primitives/button";
import { GallerySection } from "../GallerySection";

export function ToastGallery() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Toast</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sonner toast — used for all non-destructive feedback. Replaces{" "}
          <code className="rounded bg-muted px-1">window.alert()</code> (D-003).
        </p>
      </div>
      <GallerySection title="Variants">
        <Button variant="outline" onClick={() => toast("Payment recorded")}>
          Default
        </Button>
        <Button variant="outline" onClick={() => toast.success("Payment verified")}>
          Success
        </Button>
        <Button variant="outline" onClick={() => toast.error("Failed to save — check your connection")}>
          Error
        </Button>
        <Button variant="outline" onClick={() => toast.warning("Packing list incomplete")}>
          Warning
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            toast("Delete 47 line items?", {
              action: { label: "Undo", onClick: () => toast.success("Restored") },
            })
          }
        >
          With action
        </Button>
      </GallerySection>
    </div>
  );
}
