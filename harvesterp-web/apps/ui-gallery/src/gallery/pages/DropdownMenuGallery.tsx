import { Button } from "@/components/primitives/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem,
} from "@/components/primitives/dropdown-menu";
import { GallerySection } from "../GallerySection";

export function DropdownMenuGallery() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Dropdown Menu</h2>
        <p className="mt-1 text-sm text-muted-foreground">shadcn/ui DropdownMenu.</p>
      </div>
      <GallerySection title="Basic">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Open menu</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </GallerySection>
      <GallerySection title="With checkboxes">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Columns</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem checked>Status</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem>Amount</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked>Date</DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </GallerySection>
    </div>
  );
}
