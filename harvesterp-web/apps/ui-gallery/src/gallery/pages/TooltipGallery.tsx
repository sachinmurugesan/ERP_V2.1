import { Button } from "@/components/primitives/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/primitives/tooltip";
import { GallerySection } from "../GallerySection";

export function TooltipGallery() {
  return (
    <TooltipProvider>
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold">Tooltip</h2>
          <p className="mt-1 text-sm text-muted-foreground">shadcn/ui Tooltip — Radix Tooltip primitive.</p>
        </div>
        <GallerySection title="Basic">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">Hover me</Button>
            </TooltipTrigger>
            <TooltipContent>Download as PDF</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Info">ℹ</Button>
            </TooltipTrigger>
            <TooltipContent>Factory cost visibility: SUPER_ADMIN / FINANCE only (D-004)</TooltipContent>
          </Tooltip>
        </GallerySection>
      </div>
    </TooltipProvider>
  );
}
