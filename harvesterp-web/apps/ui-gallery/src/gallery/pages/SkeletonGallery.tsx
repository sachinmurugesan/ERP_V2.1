import { Skeleton } from "@/components/primitives/skeleton";
import { Card, CardContent, CardHeader } from "@/components/primitives/card";
import { GallerySection } from "../GallerySection";

export function SkeletonGallery() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Skeleton</h2>
        <p className="mt-1 text-sm text-muted-foreground">shadcn/ui Skeleton — loading placeholder. Used in LedgerPage loading state.</p>
      </div>
      <GallerySection title="Card loading" stacked>
        <Card className="w-[360px]">
          <CardHeader>
            <Skeleton className="h-4 w-[200px]" />
            <Skeleton className="h-3 w-[150px]" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      </GallerySection>
      <GallerySection title="Table row loading" stacked>
        <div className="w-[500px] space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </GallerySection>
    </div>
  );
}
