import { Checkbox } from "@/components/primitives/checkbox";
import { GallerySection } from "../GallerySection";

export function CheckboxGallery() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Checkbox</h2>
        <p className="mt-1 text-sm text-muted-foreground">shadcn/ui Checkbox — Radix Checkbox primitive.</p>
      </div>
      <GallerySection title="States" stacked>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox id="c1" /> Unchecked
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox id="c2" defaultChecked /> Checked
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox id="c3" disabled /> Disabled
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox id="c4" disabled defaultChecked /> Disabled checked
        </label>
      </GallerySection>
    </div>
  );
}
