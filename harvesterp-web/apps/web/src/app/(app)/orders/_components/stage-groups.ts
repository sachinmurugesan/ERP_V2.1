import type { StageGroupCounts, StatusCountsRaw } from "./types";

/**
 * 9 filter-tab groupings — id, label, chip tone, and the OrderStatus enum
 * values that fall into each group. "all" has no statuses; its count is the
 * list's total, not a status sum.
 *
 * Tone mapping comes from the Phase 2 decisions in the migration log and
 * resolves to `chip` + a tone suffix (see components.css).
 */

export type StageGroupId =
  | "all"
  | "draft"
  | "pricing"
  | "payment"
  | "production"
  | "shipping"
  | "customs"
  | "delivered"
  | "completed";

export type StageGroupTone =
  | "default"
  | "info"
  | "warn"
  | "accent"
  | "ok"
  | "muted";

export interface StageGroup {
  id: StageGroupId;
  label: string;
  tone: StageGroupTone;
  statuses: string[];
}

export const STAGE_GROUPS: ReadonlyArray<StageGroup> = [
  { id: "all", label: "All", tone: "default", statuses: [] },
  { id: "draft", label: "Draft", tone: "default", statuses: ["DRAFT"] },
  {
    id: "pricing",
    label: "Pricing",
    tone: "info",
    statuses: ["PENDING_PI", "PI_SENT"],
  },
  {
    id: "payment",
    label: "Payment",
    tone: "warn",
    statuses: ["ADVANCE_PENDING", "ADVANCE_RECEIVED"],
  },
  {
    id: "production",
    label: "Production",
    tone: "accent",
    statuses: [
      "FACTORY_ORDERED",
      "PRODUCTION_60",
      "PRODUCTION_80",
      "PRODUCTION_90",
      "PRODUCTION_100",
      "PLAN_PACKING",
      "FINAL_PI",
    ],
  },
  {
    id: "shipping",
    label: "Shipping",
    tone: "info",
    statuses: ["BOOKED", "LOADED", "SAILED", "ARRIVED"],
  },
  {
    id: "customs",
    label: "Customs",
    tone: "warn",
    statuses: ["CUSTOMS_FILED", "CLEARED"],
  },
  { id: "delivered", label: "Delivered", tone: "ok", statuses: ["DELIVERED"] },
  {
    id: "completed",
    label: "Completed",
    tone: "muted",
    statuses: ["COMPLETED", "COMPLETED_EDITING", "AFTER_SALES"],
  },
];

export function statusQueryFor(group: StageGroup): string | undefined {
  if (group.id === "all" || group.statuses.length === 0) return undefined;
  return group.statuses.join(",");
}

/**
 * Sum raw per-status counts into per-group counts. `all` is left as 0 here —
 * the UI fills it in from the list-endpoint total.
 */
export function groupCounts(raw: StatusCountsRaw | null | undefined): StageGroupCounts {
  const out: StageGroupCounts = {
    all: 0,
    draft: 0,
    pricing: 0,
    payment: 0,
    production: 0,
    shipping: 0,
    customs: 0,
    delivered: 0,
    completed: 0,
  };
  if (!raw) return out;

  for (const group of STAGE_GROUPS) {
    if (group.id === "all") continue;
    let sum = 0;
    for (const status of group.statuses) {
      const entry = raw[status];
      if (entry && typeof entry.count === "number") {
        sum += entry.count;
      }
    }
    out[group.id] = sum;
  }
  return out;
}
