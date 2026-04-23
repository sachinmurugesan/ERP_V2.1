import { Input } from "@/components/primitives/input";
import { GallerySection } from "../GallerySection";

export function InputGallery() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Input</h2>
        <p className="mt-1 text-sm text-muted-foreground">shadcn/ui Input.</p>
      </div>
      <GallerySection title="Default" stacked>
        <Input placeholder="Search orders..." className="max-w-sm" />
        <Input type="email" placeholder="name@example.com" className="max-w-sm" />
        <Input type="password" placeholder="Password" className="max-w-sm" />
        <Input disabled placeholder="Disabled input" className="max-w-sm" />
      </GallerySection>
    </div>
  );
}
