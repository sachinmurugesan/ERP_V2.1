import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/primitives/alert";
import { GallerySection } from "../GallerySection";

export function AlertGallery() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Alert</h2>
        <p className="mt-1 text-sm text-muted-foreground">shadcn/ui Alert — 4 variants.</p>
      </div>
      <GallerySection title="Variants" stacked>
        <Alert className="max-w-lg">
          <Info className="h-4 w-4" />
          <AlertTitle>Info</AlertTitle>
          <AlertDescription>Factory ledger access restricted to SUPER_ADMIN and FINANCE roles.</AlertDescription>
        </Alert>
        <Alert variant="success" className="max-w-lg">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Payment confirmed</AlertTitle>
          <AlertDescription>₹2,40,000 payment has been verified and recorded.</AlertDescription>
        </Alert>
        <Alert variant="warning" className="max-w-lg">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Incomplete packing list</AlertTitle>
          <AlertDescription>3 items have not been packed. Review before booking.</AlertDescription>
        </Alert>
        <Alert variant="destructive" className="max-w-lg">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Permission denied</AlertTitle>
          <AlertDescription>Your role does not have access to factory cost data (D-004).</AlertDescription>
        </Alert>
      </GallerySection>
    </div>
  );
}
