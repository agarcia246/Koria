import type { PricingMode } from "@/lib/database.types";
import { roundToNearest500 } from "@/lib/geo";

export type PricingRuleLike = {
  hourly_rate: number | null;
  minimum: number | null;
  positioning_fee: number | null;
  mode: PricingMode;
};

export function estimateBlockMinutes(distanceNm: number, cruiseSpeedKtas: number): number {
  const speed = Math.max(cruiseSpeedKtas || 1, 1);
  return Math.max(1, Math.round((distanceNm / speed) * 60));
}

export function computeOperatorAmount(args: {
  rule: PricingRuleLike | null | undefined;
  distanceNm: number;
  cruiseSpeedKtas: number;
}): { mode: PricingMode; amount: number | null } {
  const { rule, distanceNm, cruiseSpeedKtas } = args;
  if (!rule || rule.mode === "quote_required") {
    return { mode: "quote_required", amount: null };
  }
  if (rule.mode === "live" || rule.mode === "estimated") {
    const speed = Math.max(cruiseSpeedKtas || 1, 1);
    const blockHours = distanceNm / speed;
    const hourly = Number(rule.hourly_rate ?? 0);
    const minimum = Number(rule.minimum ?? 0);
    const positioning = Number(rule.positioning_fee ?? 0);
    const raw = Math.max(minimum, hourly * blockHours) + positioning;
    return { mode: rule.mode, amount: roundToNearest500(raw) };
  }
  return { mode: "quote_required", amount: null };
}
