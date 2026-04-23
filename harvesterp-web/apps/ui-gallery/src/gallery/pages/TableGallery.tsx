import { Badge } from "@/components/primitives/badge";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/primitives/table";
import { GallerySection } from "../GallerySection";

const ORDERS = [
  { id: "ORD-001", client: "Acme Corp", amount: "₹4,20,000", status: "PI Confirmed" },
  { id: "ORD-002", client: "Beta Ltd", amount: "₹1,80,000", status: "In Production" },
  { id: "ORD-003", client: "Gamma Inc", amount: "₹7,50,000", status: "Delivered" },
];

export function TableGallery() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Table</h2>
        <p className="mt-1 text-sm text-muted-foreground">shadcn/ui Table — used for order lists, ledger transactions, product catalogs.</p>
      </div>
      <GallerySection title="Order list table" stacked>
        <Table>
          <TableCaption>Recent orders</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ORDERS.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-xs">{o.id}</TableCell>
                <TableCell>{o.client}</TableCell>
                <TableCell className="text-right">{o.amount}</TableCell>
                <TableCell><Badge variant="secondary">{o.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </GallerySection>
    </div>
  );
}
