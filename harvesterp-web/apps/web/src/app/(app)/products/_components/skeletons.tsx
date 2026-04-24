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

export function ProductRowsSkeleton({
  rows = 10,
}: {
  rows?: number;
}): React.ReactElement {
  return (
    <div aria-hidden="true" style={{ display: "flex", flexDirection: "column" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns:
              "32px 24px 48px minmax(110px, 1.1fr) minmax(160px, 1.6fr) minmax(100px, 1fr) minmax(100px, 1fr) 60px minmax(120px, 1fr) minmax(100px, 1fr) minmax(110px, 1fr) 80px",
            gap: 10,
            padding: "14px 12px",
            borderBottom: "1px solid var(--border)",
            alignItems: "center",
          }}
        >
          <Bar width={16} height={16} />
          <Bar width={12} height={12} />
          <Bar width={40} height={40} />
          <Bar width="80%" height={12} />
          <Bar width="80%" height={12} />
          <Bar width="60%" height={10} />
          <Bar width="60%" height={10} />
          <Bar width={28} height={18} />
          <Bar width="70%" height={10} />
          <Bar width="50%" height={10} />
          <Bar width="60%" height={10} />
          <Bar width={40} height={14} />
        </div>
      ))}
    </div>
  );
}
