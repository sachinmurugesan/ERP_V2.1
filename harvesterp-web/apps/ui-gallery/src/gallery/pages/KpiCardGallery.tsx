"use client";

import { GallerySection } from "@/gallery/GallerySection";
import { KpiCard } from "@/components/composed/kpi-card";

const SPARK_REVENUE   = [42, 48, 44, 52, 58, 55, 63, 61, 68, 72];
const SPARK_ORDERS    = [120, 135, 128, 142, 155, 148, 162, 170, 165, 180];
const SPARK_OVERDUE   = [8, 10, 9, 12, 14, 13, 16, 18, 17, 20];
const SPARK_RETURNS   = [5, 4, 6, 5, 3, 7, 4, 5, 6, 3];
const SPARK_FLAT      = [30, 31, 30, 32, 31, 30, 32, 31, 30, 31];

export function KpiCardGallery() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>KpiCard</h2>
        <p style={{ color: "var(--fg-muted)", fontSize: 13 }}>
          Metric cards used across ERP dashboards. Composes SparkLine, Icon, and .kpi-* CSS classes.
        </p>
      </div>

      {/* Standard */}
      <GallerySection title="Standard metrics">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
          <KpiCard
            label="Total Revenue"
            value="₹4.2 Cr"
            delta="+12.4%"
            deltaDirection="up"
            subtext="vs last month"
            spark={SPARK_REVENUE}
            icon="finance"
          />
          <KpiCard
            label="Orders Dispatched"
            value="1,284"
            delta="+8.3%"
            deltaDirection="up"
            subtext="this month"
            spark={SPARK_ORDERS}
            icon="box"
          />
          <KpiCard
            label="Overdue Receivables"
            value="₹18.4 L"
            delta="+23%"
            deltaDirection="down"
            subtext="vs last month"
            spark={SPARK_OVERDUE}
            icon="warning"
          />
          <KpiCard
            label="Returns"
            value="32"
            delta="−4"
            deltaDirection="up"
            subtext="fewer than last week"
            spark={SPARK_RETURNS}
            icon="refresh"
          />
        </div>
      </GallerySection>

      {/* Tones */}
      <GallerySection title="Explicit tones">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
          <KpiCard label="On-time delivery" value="96.2%" tone="ok" delta="+1.4%" deltaDirection="up" icon="check" />
          <KpiCard label="Pending approvals" value="14" tone="warn" delta="8 new" icon="clock" />
          <KpiCard label="Failed payments" value="3" tone="err" delta="+1" deltaDirection="down" icon="credit" />
          <KpiCard label="Open inquiries" value="67" tone="info" delta="+12" deltaDirection="up" icon="crm" />
          <KpiCard label="Inventory utilisation" value="78%" tone="neutral" spark={SPARK_FLAT} icon="inventory" />
        </div>
      </GallerySection>

      {/* No icon / no spark */}
      <GallerySection title="Without icon or sparkline">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
          <KpiCard label="Active Clients" value="248" />
          <KpiCard label="Active Factories" value="12" delta="+2" deltaDirection="up" subtext="this quarter" />
          <KpiCard label="Avg. Lead Time" value="9.4 days" delta="−0.6 days" deltaDirection="up" subtext="vs last month" />
        </div>
      </GallerySection>
    </div>
  );
}
