"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Label — accessible form label.
 * Thin wrapper around <label> styled to match shadcn/ui conventions.
 * No @radix-ui/react-label dep needed for this project.
 */
const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className,
    )}
    {...props}
  />
));
Label.displayName = "Label";

export { Label };
