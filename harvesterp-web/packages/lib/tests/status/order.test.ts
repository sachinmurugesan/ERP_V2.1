import { describe, it, expect } from "vitest";
import {
  OrderStatus,
  STATUS_STAGE_MAP,
  POST_PI_STATUSES,
  STAGE_4_PLUS,
  STAGE_6_PLUS,
  TERMINAL_STATUSES,
  BOOKING_STATUSES,
  SHIPPING_DOC_STATUSES,
  PACKING_STATUSES,
  getStage,
  isTerminal,
  isStage4Plus,
} from "../../src/status/order.js";

describe("OrderStatus enum", () => {
  it("has exactly 23 values", () => {
    expect(Object.keys(OrderStatus)).toHaveLength(23);
  });
  it("includes PI_REQUESTED", () => {
    expect(OrderStatus.PI_REQUESTED).toBe("PI_REQUESTED");
  });
  it("includes CLOSED", () => {
    expect(OrderStatus.CLOSED).toBe("CLOSED");
  });
  it("includes special statuses", () => {
    expect(OrderStatus.ON_HOLD).toBeDefined();
    expect(OrderStatus.CANCELLED).toBeDefined();
    expect(OrderStatus.DISPUTE).toBeDefined();
    expect(OrderStatus.REFUND_ISSUED).toBeDefined();
  });
});

describe("STATUS_STAGE_MAP", () => {
  it("has an entry for every OrderStatus", () => {
    for (const status of Object.values(OrderStatus)) {
      expect(STATUS_STAGE_MAP).toHaveProperty(status);
    }
  });
  it("assigns stage 1 to PI_REQUESTED", () => {
    expect(STATUS_STAGE_MAP[OrderStatus.PI_REQUESTED].stage).toBe(1);
  });
  it("assigns stage 7 to CLOSED", () => {
    expect(STATUS_STAGE_MAP[OrderStatus.CLOSED].stage).toBe(7);
  });
  it("assigns stage 0 to special statuses", () => {
    expect(STATUS_STAGE_MAP[OrderStatus.CANCELLED].stage).toBe(0);
    expect(STATUS_STAGE_MAP[OrderStatus.ON_HOLD].stage).toBe(0);
    expect(STATUS_STAGE_MAP[OrderStatus.DISPUTE].stage).toBe(0);
    expect(STATUS_STAGE_MAP[OrderStatus.REFUND_ISSUED].stage).toBe(0);
  });
  it("assigns stage 5 to SAILING", () => {
    expect(STATUS_STAGE_MAP[OrderStatus.SAILING].stage).toBe(5);
  });
});

describe("Status group Sets", () => {
  it("POST_PI_STATUSES does not contain PI_REQUESTED", () => {
    expect(POST_PI_STATUSES.has(OrderStatus.PI_REQUESTED)).toBe(false);
  });
  it("POST_PI_STATUSES contains CLOSED", () => {
    expect(POST_PI_STATUSES.has(OrderStatus.CLOSED)).toBe(true);
  });
  it("STAGE_4_PLUS contains DISPATCHED", () => {
    expect(STAGE_4_PLUS.has(OrderStatus.DISPATCHED)).toBe(true);
  });
  it("STAGE_4_PLUS does not contain IN_PRODUCTION", () => {
    expect(STAGE_4_PLUS.has(OrderStatus.IN_PRODUCTION)).toBe(false);
  });
  it("STAGE_6_PLUS contains ARRIVED and DELIVERED", () => {
    expect(STAGE_6_PLUS.has(OrderStatus.ARRIVED)).toBe(true);
    expect(STAGE_6_PLUS.has(OrderStatus.DELIVERED)).toBe(true);
  });
  it("TERMINAL_STATUSES contains CLOSED, CANCELLED, REFUND_ISSUED", () => {
    expect(TERMINAL_STATUSES.has(OrderStatus.CLOSED)).toBe(true);
    expect(TERMINAL_STATUSES.has(OrderStatus.CANCELLED)).toBe(true);
    expect(TERMINAL_STATUSES.has(OrderStatus.REFUND_ISSUED)).toBe(true);
  });
  it("BOOKING_STATUSES contains BOOKING_CONFIRMED and SAILING", () => {
    expect(BOOKING_STATUSES.has(OrderStatus.BOOKING_CONFIRMED)).toBe(true);
    expect(BOOKING_STATUSES.has(OrderStatus.SAILING)).toBe(true);
  });
  it("SHIPPING_DOC_STATUSES contains relevant statuses", () => {
    expect(SHIPPING_DOC_STATUSES.has(OrderStatus.BOOKING_CONFIRMED)).toBe(true);
    expect(SHIPPING_DOC_STATUSES.has(OrderStatus.CUSTOMS_CLEARED)).toBe(true);
    expect(SHIPPING_DOC_STATUSES.has(OrderStatus.IN_PRODUCTION)).toBe(false);
  });
  it("PACKING_STATUSES contains QC_PASSED and DISPATCHED", () => {
    expect(PACKING_STATUSES.has(OrderStatus.QC_PASSED)).toBe(true);
    expect(PACKING_STATUSES.has(OrderStatus.DISPATCHED)).toBe(true);
  });
});

describe("getStage()", () => {
  it("returns 1 for PI_REQUESTED", () => {
    expect(getStage(OrderStatus.PI_REQUESTED)).toBe(1);
  });
  it("returns 7 for PAYMENT_RECEIVED", () => {
    expect(getStage(OrderStatus.PAYMENT_RECEIVED)).toBe(7);
  });
  it("returns 0 for ON_HOLD", () => {
    expect(getStage(OrderStatus.ON_HOLD)).toBe(0);
  });
});

describe("isTerminal()", () => {
  it("returns true for CLOSED", () => {
    expect(isTerminal(OrderStatus.CLOSED)).toBe(true);
  });
  it("returns true for CANCELLED", () => {
    expect(isTerminal(OrderStatus.CANCELLED)).toBe(true);
  });
  it("returns false for SAILING", () => {
    expect(isTerminal(OrderStatus.SAILING)).toBe(false);
  });
  it("returns false for IN_PRODUCTION", () => {
    expect(isTerminal(OrderStatus.IN_PRODUCTION)).toBe(false);
  });
});

describe("isStage4Plus()", () => {
  it("returns true for DISPATCHED", () => {
    expect(isStage4Plus(OrderStatus.DISPATCHED)).toBe(true);
  });
  it("returns true for CLOSED", () => {
    expect(isStage4Plus(OrderStatus.CLOSED)).toBe(true);
  });
  it("returns false for IN_PRODUCTION", () => {
    expect(isStage4Plus(OrderStatus.IN_PRODUCTION)).toBe(false);
  });
  it("returns false for PI_CONFIRMED", () => {
    expect(isStage4Plus(OrderStatus.PI_CONFIRMED)).toBe(false);
  });
});
