import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/primitives/tabs";
import { GallerySection } from "../GallerySection";

export function TabsGallery() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Tabs</h2>
        <p className="mt-1 text-sm text-muted-foreground">shadcn/ui Tabs — Radix Tabs primitive.</p>
      </div>
      <GallerySection title="Basic tabs" stacked>
        <Tabs defaultValue="orders" className="w-full max-w-lg">
          <TabsList>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="production">Production</TabsTrigger>
          </TabsList>
          <TabsContent value="orders" className="p-4 border rounded-lg mt-2">
            Orders content here.
          </TabsContent>
          <TabsContent value="payments" className="p-4 border rounded-lg mt-2">
            Payments content here.
          </TabsContent>
          <TabsContent value="production" className="p-4 border rounded-lg mt-2">
            Production content here.
          </TabsContent>
        </Tabs>
      </GallerySection>
      <GallerySection title="Disabled tab" stacked>
        <Tabs defaultValue="a" className="w-full max-w-lg">
          <TabsList>
            <TabsTrigger value="a">Active</TabsTrigger>
            <TabsTrigger value="b" disabled>Disabled</TabsTrigger>
          </TabsList>
          <TabsContent value="a" className="p-4 border rounded-lg mt-2">Tab A content.</TabsContent>
        </Tabs>
      </GallerySection>
    </div>
  );
}
