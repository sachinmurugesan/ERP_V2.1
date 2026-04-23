import { Textarea } from "@/components/primitives/textarea";
import { GallerySection } from "../GallerySection";

export function TextareaGallery() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Textarea</h2>
        <p className="mt-1 text-sm text-muted-foreground">shadcn/ui Textarea.</p>
      </div>
      <GallerySection title="Variants" stacked>
        <Textarea placeholder="Add a note..." className="max-w-sm" />
        <Textarea placeholder="Disabled" disabled className="max-w-sm" />
      </GallerySection>
    </div>
  );
}
