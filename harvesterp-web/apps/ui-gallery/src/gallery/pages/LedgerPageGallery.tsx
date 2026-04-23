import { useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/primitives/tabs";
import { LedgerPage } from "@/components/composed/ledger-page";

const CLIENT_OPTIONS = [
  { id: "c1", name: "Acme Corp" },
  { id: "c2", name: "Beta Ltd" },
  { id: "c3", name: "Gamma Inc" },
];

const FACTORY_OPTIONS = [
  { id: "f1", name: "Shenzhen Textiles Co." },
  { id: "f2", name: "Guangzhou Manufacturing" },
];

const TRANSACTIONS = [
  { date: "2026-03-01", description: "Invoice #INV-001 — Order ORD-001", debit: 420000, runningBalance: -420000 },
  { date: "2026-03-10", description: "Payment received — NEFT", credit: 200000, runningBalance: -220000 },
  { date: "2026-03-18", description: "Invoice #INV-002 — Order ORD-002", debit: 180000, runningBalance: -400000 },
  { date: "2026-04-02", description: "Payment received — RTGS", credit: 400000, runningBalance: 0 },
];

export function LedgerPageGallery() {
  const [clientId, setClientId] = useState("c1");
  const [factoryId, setFactoryId] = useState("f1");
  const [loading, setLoading] = useState(false);

  const simulateLoading = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">LedgerPage (P-017)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Shared structure extracted from ClientLedger.vue + FactoryLedger.vue.
          Entity-agnostic — consumer provides data props.
        </p>
      </div>

      <Tabs defaultValue="client">
        <TabsList>
          <TabsTrigger value="client">Client ledger</TabsTrigger>
          <TabsTrigger value="factory">Factory ledger</TabsTrigger>
          <TabsTrigger value="loading" onClick={simulateLoading}>Loading state</TabsTrigger>
        </TabsList>

        <TabsContent value="client" className="mt-6">
          <LedgerPage
            title={{ en: "Client Ledger" }}
            entityType="client"
            entityId={clientId}
            entityOptions={CLIENT_OPTIONS}
            onEntityChange={setClientId}
            summary={[
              { label: "Total Invoiced", value: "₹6,00,000" },
              { label: "Total Paid", value: "₹6,00,000", variant: "positive" },
              { label: "Outstanding", value: "₹0", variant: "positive" },
              { label: "Advance", value: "₹0" },
            ]}
            transactions={TRANSACTIONS}
            onDownloadPdf={() => toast("Downloading PDF...")}
            onDownloadExcel={() => toast("Downloading Excel...")}
          />
        </TabsContent>

        <TabsContent value="factory" className="mt-6">
          <LedgerPage
            title={{ en: "Factory Ledger" }}
            entityType="factory"
            entityId={factoryId}
            entityOptions={FACTORY_OPTIONS}
            onEntityChange={setFactoryId}
            summary={[
              { label: "Total Orders", value: "¥1,24,000", },
              { label: "Paid", value: "¥80,000", variant: "positive" },
              { label: "Due", value: "¥44,000", variant: "negative" },
              { label: "Credits", value: "¥0" },
            ]}
            transactions={TRANSACTIONS.map((t) => ({ ...t, currency: "CNY" }))}
            onDownloadPdf={() => toast("Downloading PDF...")}
            onDownloadExcel={() => toast("Downloading Excel...")}
          />
        </TabsContent>

        <TabsContent value="loading" className="mt-6">
          <LedgerPage
            title={{ en: "Client Ledger" }}
            entityType="client"
            entityId="c1"
            entityOptions={CLIENT_OPTIONS}
            onEntityChange={() => {}}
            summary={[
              { label: "Total Invoiced", value: "..." },
              { label: "Total Paid", value: "..." },
              { label: "Outstanding", value: "..." },
              { label: "Advance", value: "..." },
            ]}
            transactions={[]}
            loading={loading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
