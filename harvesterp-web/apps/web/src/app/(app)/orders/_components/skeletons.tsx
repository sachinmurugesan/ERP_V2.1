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

export function OrderRowsSkeleton({
  rows = 8,
}: {
  rows?: number;
}): React.ReactElement {
  return (
    <div
      aria-hidden="true"
      style={{ display: "flex", flexDirection: "column" }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(120px, 1.2fr) minmax(140px, 1.5fr) minmax(120px, 1fr) minmax(140px, 1fr) 60px minmax(100px, 1fr) minmax(110px, 1fr) 48px",
            gap: 12,
            padding: "14px 12px",
            borderBottom: "1px solid var(--border)",
            alignItems: "center",
          }}
        >
          <Bar width="75%" height={12} />
          <Bar width="80%" height={12} />
          <Bar width="60%" height={10} />
          <Bar width={84} height={18} />
          <Bar width={24} height={10} />
          <Bar width="70%" height={12} />
          <Bar width="60%" height={10} />
          <Bar width={16} height={16} />
        </div>
      ))}
    </div>
  );
}

export function FilterTabsSkeleton(): React.ReactElement {
  return (
    <div
      aria-hidden="true"
      style={{ display: "flex", gap: 8, padding: "12px 16px" }}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <Bar key={i} width={72} height={26} />
      ))}
    </div>
  );
}
