import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/primitives/select";
import { GallerySection } from "../GallerySection";

export function SelectGallery() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Select</h2>
        <p className="mt-1 text-sm text-muted-foreground">shadcn/ui Select — Radix Select primitive.</p>
      </div>
      <GallerySection title="Default">
        <Select>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </GallerySection>
      <GallerySection title="Disabled">
        <Select disabled>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Disabled" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">Option A</SelectItem>
          </SelectContent>
        </Select>
      </GallerySection>
    </div>
  );
}
