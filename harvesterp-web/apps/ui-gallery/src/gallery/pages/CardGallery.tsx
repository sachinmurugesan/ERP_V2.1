import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/primitives/card";
import { Button } from "@/components/primitives/button";
import { GallerySection } from "../GallerySection";

export function CardGallery() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Card</h2>
        <p className="mt-1 text-sm text-muted-foreground">shadcn/ui Card — used for summary panels, ledger totals, order stats.</p>
      </div>
      <GallerySection title="Basic card" stacked>
        <Card className="w-[360px]">
          <CardHeader>
            <CardTitle>Order #ORD-2024-001</CardTitle>
            <CardDescription>Placed 12 Jan 2026 · Stage 4</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Total value: ₹4,20,000</p>
          </CardContent>
          <CardFooter>
            <Button size="sm">View details</Button>
          </CardFooter>
        </Card>
      </GallerySection>
      <GallerySection title="Stat card" stacked>
        <Card className="w-[200px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Outstanding Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">₹1,20,500</p>
          </CardContent>
        </Card>
      </GallerySection>
    </div>
  );
}
