import { useState } from "react";
import { Button } from "@/components/primitives/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/primitives/dialog";
import { GallerySection } from "../GallerySection";

export function DialogGallery() {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Dialog</h2>
        <p className="mt-1 text-sm text-muted-foreground">shadcn/ui Dialog — Radix Dialog primitive.</p>
      </div>
      <GallerySection title="Basic dialog">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit profile</DialogTitle>
              <DialogDescription>Make changes to your profile here.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="submit">Save changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </GallerySection>
      <GallerySection title="Controlled dialog">
        <Button variant="outline" onClick={() => setOpen(true)}>Open controlled</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Controlled dialog</DialogTitle>
              <DialogDescription>State managed by parent.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </GallerySection>
    </div>
  );
}
