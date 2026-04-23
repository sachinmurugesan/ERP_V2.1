import * as React from "react";

function Bar({
  width,
  height = 10,
}: {
  width: string | number;
  height?: number;
}): React.ReactElement {
  return (
    <div
      aria-hidden="true"
      className="animate-erp-pulse"
      style={{
        width,
        height,
        borderRadius: "var(--r-sm)",
        background: "var(--bg-sunken)",
      }}
    />
  );
}

export function KpiSkeleton(): React.ReactElement {
  return (
    <div className="card card-pad" aria-hidden="true">
      <Bar width={80} height={10} />
      <div style={{ marginTop: 12 }}>
        <Bar width={100} height={28} />
      </div>
      <div style={{ marginTop: 10 }}>
        <Bar width={120} height={10} />
      </div>
    </div>
  );
}

export function TableRowsSkeleton({
  rows = 4,
}: {
  rows?: number;
}): React.ReactElement {
  return (
    <div style={{ padding: 20, display: "grid", gap: 14 }} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}
        >
          <Bar width="80%" height={12} />
          <Bar width="60%" height={12} />
          <Bar width="40%" height={12} />
        </div>
      ))}
    </div>
  );
}

export function FeedRowsSkeleton({
  rows = 5,
}: {
  rows?: number;
}): React.ReactElement {
  return (
    <div
      style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}
      aria-hidden="true"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: "flex", gap: 12 }}>
          <Bar width={8} height={8} />
          <div style={{ flex: 1, display: "grid", gap: 6 }}>
            <Bar width={80} height={10} />
            <Bar width="70%" height={12} />
            <Bar width="50%" height={10} />
          </div>
        </div>
      ))}
    </div>
  );
}
