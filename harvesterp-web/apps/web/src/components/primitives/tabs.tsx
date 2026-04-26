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
 * Design intent — Vue parity (matches the active-tab look from
 * `frontend/src/views/orders/OrderDetail.vue:746-752`):
 *   - <TabsList>     horizontal flex container, transparent background, with
 *                    a single 1px slate border-bottom that the active trigger
 *                    visually punches through with its emerald underline.
 *   - <TabsTrigger>  flat (no pill, no shadow). Active state = emerald-600
 *                    bottom border (-1px overlap with list border) + emerald-50
 *                    background tint + emerald-700 text. Inactive = transparent
 *                    background, slate-500 text, hover slate-700 + slate-50 bg.
 *   - <TabsContent>  pads top, no internal border (parent card frames it).
 *
 * Updated in feat/order-detail-shell (commit 4) to match the Vue tab
 * affordance for the order-detail shell. Foundation PR (#1) shipped a
 * pill-on-grey style which read as "filter chips" rather than tabs — the
 * emerald-underline pattern reads correctly as section navigation.
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
      // Horizontal flex of triggers; subtle slate baseline that active
      // trigger overlaps with its emerald underline.
      "inline-flex items-center justify-start gap-0 border-b border-slate-200 text-slate-500",
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
      // Base: flat, transparent, 2-px transparent bottom border so the active
      // -mb-px trick lines up with the list's 1-px border-bottom precisely.
      "inline-flex items-center justify-center whitespace-nowrap border-b-2 border-transparent px-4 py-2 text-sm font-medium transition-colors -mb-px",
      // Inactive hover: subtle slate background + darker text
      "hover:bg-slate-50 hover:text-slate-700",
      // Active state — Vue parity: emerald-600 underline, emerald-50 bg tint,
      // emerald-700 text.
      "data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700",
      // Focus + disabled
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1",
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
