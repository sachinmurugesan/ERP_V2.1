import { useState } from "react";
import { Button } from "@/components/primitives/button";
import { HighlightScrollTarget } from "@/components/composed/highlight-scroll-target";
import { GallerySection } from "../GallerySection";

const SECTIONS = [
  { id: "items", label: "Items section" },
  { id: "payment-upload", label: "Payment upload" },
  { id: "packing", label: "Packing list" },
];

export function HighlightScrollTargetGallery() {
  const [activeHash, setActiveHash] = useState("");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">HighlightScrollTarget (P-022)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Replaces <code className="rounded bg-muted px-1">highlightSection</code> prop + nextTick scrollIntoView
          pattern from OrderItemsTab, PaymentsTab, PackingListTab. Deep-link format:{" "}
          <code className="rounded bg-muted px-1">/orders/123?tab=packing#upload</code>
        </p>
      </div>

      <GallerySection title="Trigger highlights">
        {SECTIONS.map((s) => (
          <Button key={s.id} variant="outline" size="sm" onClick={() => setActiveHash(s.id)}>
            Highlight #{s.id}
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={() => setActiveHash("")}>
          Clear
        </Button>
      </GallerySection>

      <div className="space-y-4">
        {SECTIONS.map((s) => (
          <HighlightScrollTarget
            key={s.id}
            id={s.id}
            currentHash={activeHash}
            className="border rounded-lg p-6"
          >
            <h3 className="text-sm font-semibold">{s.label}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              id="{s.id}" — when hash matches, scrolls into view + flashes background.
            </p>
          </HighlightScrollTarget>
        ))}
      </div>
    </div>
  );
}
