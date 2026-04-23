import { Badge } from "@/components/primitives/badge";
import { GallerySection } from "../GallerySection";

export function BadgeGallery() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Badge</h2>
        <p className="mt-1 text-sm text-muted-foreground">shadcn/ui Badge — all variants.</p>
      </div>
      <GallerySection title="Variants">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="destructive">Destructive</Badge>
        <Badge variant="success">Success</Badge>
        <Badge variant="warning">Warning</Badge>
      </GallerySection>
      <GallerySection title="In context — order statuses">
        <Badge variant="warning">Pending PI</Badge>
        <Badge variant="default">PI Confirmed</Badge>
        <Badge variant="success">Delivered</Badge>
        <Badge variant="destructive">Cancelled</Badge>
      </GallerySection>
    </div>
  );
}
