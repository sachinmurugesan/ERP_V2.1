"use client";

/**
 * tabs.tsx — Radix UI Tabs primitive.
 *
 * Built (not lifted) for the Orders Foundation PR — there's no
 * existing Tabs in apps/ui-gallery to port from. Wraps
 * @radix-ui/react-tabs with HarvestERP design-system styling so
 * future order-detail / client-detail / factory-detail pages all
 * consume the same tab affordance.
 *
 * Design intent (matches `Design/screens/settings.jsx` chip-style triggers):
 *   - <TabsList>     horizontal flex container, subtle background
 *   - <TabsTrigger>  pill-shaped buttons; active state uses --brand
 *                    palette (brand-100 background + brand-800 text)
 *                    and a soft shadow (--sh-xs)
 *   - <TabsContent>  pads top, no internal border (the parent card
 *                    already provides framing)
 *
 * Keyboard navigation (←/→/Home/End) is handled by Radix automatically.
 *
 * Usage:
 *
 *   <Tabs defaultValue="items">
 *     <TabsList>
 *       <TabsTrigger value="items">Items</TabsTrigger>
 *       <TabsTrigger value="payments">Payments</TabsTrigger>
 *     </TabsList>
 *     <TabsContent value="items">…</TabsContent>
 *     <TabsContent value="payments">…</TabsContent>
 *   </Tabs>
 */

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-start gap-1 rounded-lg bg-slate-50 p-1 text-slate-500",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      // Base: pill-shaped, transparent
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all",
      // Hover (inactive): subtle slate
      "hover:text-slate-700",
      // Active state: brand-100 background, brand-800 text, subtle shadow
      // (mirrors the chip-accent pattern used in settings.jsx reference)
      "data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm",
      // Focus + disabled
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
      "disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
