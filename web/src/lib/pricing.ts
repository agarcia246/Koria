import type { PricingMode } from "@/lib/database.types";
import { roundToNearest500 } from "@/lib/geo";

export type PricingRuleLike = {
  hourly_rate: number | null;
  minimum: number | null;
  positioning_fee: number | null;
  mode: PricingMode;
};

export type PricedLegs = {
  /** Nautical miles from the aircraft home base to the origin. 0 if unknown or already there. */
  repositionNm: number;
  /** Nautical miles from origin to destination. */
  liveNm: number;
  /** Nautical miles from destination back to origin. 0 when the trip has no return. */
  returnNm: number;
};

/**
 * Airborne minutes for one leg: round(distance / cruise speed × 60).
 * Zero distance is 0 minutes. A positive leg is at least 1 minute.
 * Pricing divides these minutes by 60, so the dollar amount and
 * bookings.estimated_block_minutes cannot use different clocks.
 */
export function legBlockMinutes(distanceNm: number, cruiseSpeedKtas: number): number {
  if (!(distanceNm > 0)) return 0;
  const speed = Math.max(cruiseSpeedKtas || 1, 1);
  return Math.max(1, Math.round((distanceNm / speed) * 60));
}

export function pricedBlockMinutes(legs: PricedLegs, cruiseSpeedKtas: number): number {
  return (
    legBlockMinutes(legs.repositionNm, cruiseSpeedKtas) +
    legBlockMinutes(legs.liveNm, cruiseSpeedKtas) +
    legBlockMinutes(legs.returnNm, cruiseSpeedKtas)
  );
}

function legHours(distanceNm: number, cruiseSpeedKtas: number): number {
  return legBlockMinutes(distanceNm, cruiseSpeedKtas) / 60;
}

/**
 * Operator charter amount. Taxes are not included (M5).
 *
 * Legs, each timed by legBlockMinutes:
 *   reposition  home base → origin
 *   live        origin → destination
 *   return      destination → origin when return_at is set, otherwise omitted
 *
 * reposition charge = max(positioning_fee, hourly_rate × reposition hours)
 *   positioning_fee is the minimum reposition charge. It still applies when the
 *   aircraft is already at the origin (reposition hours are 0).
 * flown = max(minimum, hourly_rate × (live hours + return hours))
 * raw = flown + reposition charge
 * amount = raw rounded to the nearest 500 (Math.round, halves away from zero)
 *
 * mode quote_required, or a missing rule, returns amount null.
 * Unknown home base uses reposition miles 0, so only the positioning_fee minimum applies.
 */
export function computeOperatorAmount(args: {
  rule: PricingRuleLike | null | undefined;
  cruiseSpeedKtas: number;
  repositionNm?: number;
  liveNm: number;
  returnNm?: number;
}): { mode: PricingMode; amount: number | null; blockMinutes: number } {
  const legs: PricedLegs = {
    repositionNm: args.repositionNm ?? 0,
    liveNm: args.liveNm,
    returnNm: args.returnNm ?? 0,
  };
  const blockMinutes = pricedBlockMinutes(legs, args.cruiseSpeedKtas);
  const rule = args.rule;
  if (!rule || rule.mode === "quote_required") {
    return { mode: "quote_required", amount: null, blockMinutes };
  }
  if (rule.mode === "live" || rule.mode === "estimated") {
    const hourly = Number(rule.hourly_rate ?? 0);
    const minimum = Number(rule.minimum ?? 0);
    const positioningFloor = Number(rule.positioning_fee ?? 0);
    const repositionCharge = Math.max(positioningFloor, hourly * legHours(legs.repositionNm, args.cruiseSpeedKtas));
    const flown = Math.max(
      minimum,
      hourly * (legHours(legs.liveNm, args.cruiseSpeedKtas) + legHours(legs.returnNm, args.cruiseSpeedKtas)),
    );
    return {
      mode: rule.mode,
      amount: roundToNearest500(flown + repositionCharge),
      blockMinutes,
    };
  }
  return { mode: "quote_required", amount: null, blockMinutes };
}
