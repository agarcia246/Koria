import { describe, expect, it } from "vitest";
import { refundAmount, refundPercent, sumRefundLiability, type RefundPolicy } from "@/lib/payments/refund";

/** Same schedule as supabase/seed.sql: 336h 100%, 168h 50%, 0h 0%. */
const seeded: RefundPolicy[] = [
  { hours_before_departure: 336, refund_percent: 100, effective_from: "2026-01-01", effective_to: null },
  { hours_before_departure: 168, refund_percent: 50, effective_from: "2026-01-01", effective_to: null },
  { hours_before_departure: 0, refund_percent: 0, effective_from: "2026-01-01", effective_to: null },
];

const on = new Date("2026-06-01T12:00:00.000Z");

describe("refundPercent", () => {
  it("uses the greatest threshold still less than or equal to the hours remaining", () => {
    expect(refundPercent(400, seeded, on)).toBe(100);
    expect(refundPercent(336, seeded, on)).toBe(100);
    expect(refundPercent(335.999, seeded, on)).toBe(50);
    expect(refundPercent(168, seeded, on)).toBe(50);
    expect(refundPercent(167.999, seeded, on)).toBe(0);
    expect(refundPercent(0, seeded, on)).toBe(0);
  });

  it("returns 0 when no policy is in effect on that day", () => {
    expect(refundPercent(400, seeded, new Date("2025-12-31T00:00:00.000Z"))).toBe(0);
  });

  it("ignores a policy whose window has closed", () => {
    const closed: RefundPolicy[] = [
      { hours_before_departure: 0, refund_percent: 100, effective_from: "2026-01-01", effective_to: "2026-05-31" },
    ];
    expect(refundPercent(10, closed, on)).toBe(0);
  });

  it("keeps a policy whose effective_to is the cancellation day", () => {
    const closesToday: RefundPolicy[] = [
      { hours_before_departure: 0, refund_percent: 25, effective_from: "2026-01-01", effective_to: "2026-06-01" },
    ];
    expect(refundPercent(1, closesToday, on)).toBe(25);
  });
});

describe("refundAmount", () => {
  it("caps the refund at the amount actually paid", () => {
    expect(refundAmount(100_000, 100, 40_000)).toBe(40_000);
    expect(refundAmount(100_000, 50, 100_000)).toBe(50_000);
    expect(refundAmount(100_000, 50, 10_000)).toBe(10_000);
  });

  it("is zero when the percent or the paid balance is zero", () => {
    expect(refundAmount(100_000, 0, 40_000)).toBe(0);
    expect(refundAmount(100_000, 100, 0)).toBe(0);
  });
});

describe("sumRefundLiability", () => {
  it("counts refund_due and refund_sent as a positive total", () => {
    expect(
      sumRefundLiability([
        { amount: -40_000, status: "refund_due" },
        { amount: -1_000, status: "refund_sent" },
        { amount: 100_000, status: "paid" },
      ]),
    ).toBe(41_000);
  });
});
