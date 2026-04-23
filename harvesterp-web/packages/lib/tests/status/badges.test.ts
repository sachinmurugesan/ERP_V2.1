import { describe, it, expect } from "vitest";
import {
  STATUS_BADGE_MAP,
  getStatusLabel,
  getStatusClassName,
} from "../../src/status/badges.js";
import { OrderStatus } from "../../src/status/order.js";

describe("STATUS_BADGE_MAP", () => {
  it("has an entry for every OrderStatus", () => {
    for (const status of Object.values(OrderStatus)) {
      expect(STATUS_BADGE_MAP).toHaveProperty(status);
    }
  });
  it("each entry has a non-empty label", () => {
    for (const [, badge] of Object.entries(STATUS_BADGE_MAP)) {
      expect(badge.label.length).toBeGreaterThan(0);
    }
  });
  it("each entry has a non-empty className", () => {
    for (const [, badge] of Object.entries(STATUS_BADGE_MAP)) {
      expect(badge.className.length).toBeGreaterThan(0);
    }
  });
  it("QC_FAILED uses red styling", () => {
    expect(STATUS_BADGE_MAP[OrderStatus.QC_FAILED].className).toContain("red");
  });
  it("SAILING uses cyan styling", () => {
    expect(STATUS_BADGE_MAP[OrderStatus.SAILING].className).toContain("cyan");
  });
  it("CANCELLED uses red styling", () => {
    expect(STATUS_BADGE_MAP[OrderStatus.CANCELLED].className).toContain("red");
  });
});

describe("getStatusLabel()", () => {
  it("returns the label for SAILING", () => {
    expect(getStatusLabel(OrderStatus.SAILING)).toBe("Sailing");
  });
  it("returns the label for CLOSED", () => {
    expect(getStatusLabel(OrderStatus.CLOSED)).toBe("Closed");
  });
  it("returns the label for ADVANCE_PAYMENT_PENDING", () => {
    expect(getStatusLabel(OrderStatus.ADVANCE_PAYMENT_PENDING)).toBe("Advance Pending");
  });
});

describe("getStatusClassName()", () => {
  it("returns a className string for QC_FAILED", () => {
    const cls = getStatusClassName(OrderStatus.QC_FAILED);
    expect(cls).toContain("bg-");
    expect(cls).toContain("text-");
  });
  it("returns a className string for DELIVERED", () => {
    const cls = getStatusClassName(OrderStatus.DELIVERED);
    expect(cls).toContain("bg-");
    expect(cls).toContain("text-");
  });
});
