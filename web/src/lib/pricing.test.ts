import { describe, expect, it } from "vitest";
import { computeOperatorAmount, legBlockMinutes, pricedBlockMinutes } from "@/lib/pricing";

describe("pricedBlockMinutes", () => {
  it("sums reposition, live, and return minutes and keeps a short leg at 1 minute", () => {
    expect(legBlockMinutes(0, 400)).toBe(0);
    expect(legBlockMinutes(1, 400)).toBe(1);
    expect(legBlockMinutes(400, 400)).toBe(60);
    expect(
      pricedBlockMinutes({ repositionNm: 0, liveNm: 400, returnNm: 200 }, 400),
    ).toBe(90);
  });
});

describe("computeOperatorAmount", () => {
  const rule = { hourly_rate: 5_000, minimum: 10_000, positioning_fee: 1_500, mode: "estimated" as const };

  it("charges the positioning floor when the aircraft is already at the origin, then rounds to 500", () => {
    const priced = computeOperatorAmount({
      rule,
      cruiseSpeedKtas: 400,
      repositionNm: 0,
      liveNm: 400,
      returnNm: 200,
    });
    // reposition = max(1500, 0) = 1500
    // flown = max(10000, 5000 * 1.5h) = 10000
    // raw 11500, already on a 500 boundary
    expect(priced).toEqual({ mode: "estimated", amount: 11_500, blockMinutes: 90 });
  });

  it("rounds a raw amount that is not on a 500 boundary", () => {
    const priced = computeOperatorAmount({
      rule: { hourly_rate: 4_800, minimum: 0, positioning_fee: 0, mode: "live" },
      cruiseSpeedKtas: 400,
      liveNm: 400,
    });
    expect(priced.amount).toBe(5_000);
    expect(priced.blockMinutes).toBe(60);
  });

  it("uses hourly reposition time when that exceeds the positioning fee", () => {
    const priced = computeOperatorAmount({
      rule: { hourly_rate: 5_000, minimum: 0, positioning_fee: 1_500, mode: "estimated" },
      cruiseSpeedKtas: 400,
      repositionNm: 800,
      liveNm: 400,
    });
    // reposition 2h * 5000 = 10000, flown 1h * 5000 = 5000, raw 15000
    expect(priced).toEqual({ mode: "estimated", amount: 15_000, blockMinutes: 180 });
  });

  it("returns a null amount for quote_required and for a missing rule", () => {
    expect(
      computeOperatorAmount({
        rule: { hourly_rate: 5_000, minimum: 0, positioning_fee: 0, mode: "quote_required" },
        cruiseSpeedKtas: 400,
        liveNm: 400,
      }),
    ).toEqual({ mode: "quote_required", amount: null, blockMinutes: 60 });
    expect(computeOperatorAmount({ rule: null, cruiseSpeedKtas: 400, liveNm: 400 }).amount).toBeNull();
  });
});
