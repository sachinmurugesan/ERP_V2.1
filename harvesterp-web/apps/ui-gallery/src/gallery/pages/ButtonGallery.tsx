import { Button } from "@/components/primitives/button";
import { GallerySection } from "../GallerySection";

export function ButtonGallery() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Button</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          shadcn/ui Button — 6 variants × 4 sizes.
        </p>
      </div>

      <GallerySection title="Variants">
        <Button>Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
        <Button variant="destructive">Destructive</Button>
      </GallerySection>

      <GallerySection title="Sizes">
        <Button size="lg">Large</Button>
        <Button size="default">Default</Button>
        <Button size="sm">Small</Button>
      </GallerySection>

      <GallerySection title="States">
        <Button disabled>Disabled</Button>
        <Button variant="outline" disabled>Outline disabled</Button>
      </GallerySection>
    </div>
  );
}
