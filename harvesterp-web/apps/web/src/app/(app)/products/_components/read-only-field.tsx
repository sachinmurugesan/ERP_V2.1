import * as React from "react";
import { cn } from "@/lib/utils";

interface ReadOnlyFieldProps {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
  className?: string;
}

export function ReadOnlyField({
  label,
  value,
  mono = false,
  className,
}: ReadOnlyFieldProps): React.ReactElement {
  const display =
    value === null || value === undefined || value === "" ? null : String(value);
  return (
    <div className={cn("space-y-1", className)}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className={cn(
          "text-sm",
          mono && "font-mono",
          display ? "text-slate-800" : "italic text-slate-300",
        )}
      >
        {display ?? "Not set"}
      </div>
    </div>
  );
}
