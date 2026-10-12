import type { Json } from "@/lib/database.types";

/**
 * Counsel question: whether IRC 4261's taxable amount is the operator's
 * charter charge alone, or that charge plus KORIA's platform fee.
 * `customer_total` means the pre-tax customer charge (operator amount +
 * platform fee). The tax itself is not part of the base.
 */
export const TAXABLE_BASE = "customer_total" as const;
export const TAXABLE_BASE_IS_COUNSEL_QUESTION = true;

export type TaxableBase = typeof TAXABLE_BASE | "operator_amount";

export type TaxLeg = {
  originCountry: string;
  destinationCountry: string;
  originRegion?: string | null;
  destinationRegion?: string | null;
};

export type TaxRuleInput = {
  id: string;
  kind: string;
  basis: string;
  rate: number | null;
  amount: number | null;
  currency: string;
  effective_from: string;
  effective_to: string | null;
  source_url: string;
};

export type TaxTreatment = "domestic" | "alaska_hawaii" | "international" | "outside_us";

const US_COUNTRIES = new Set(["US", "USA", "UNITED STATES"]);

function isUnitedStates(country: string | null | undefined): boolean {
  return US_COUNTRIES.has((country ?? "").trim().toUpperCase());
}

function regionZone(region: string | null | undefined): "alaska" | "hawaii" | "continental" {
  const value = (region ?? "").trim().toUpperCase();
  if (value === "ALASKA" || value === "AK") return "alaska";
  if (value === "HAWAII" || value === "HI") return "hawaii";
  return "continental";
}

export function legTreatment(leg: TaxLeg): TaxTreatment {
  const originUS = isUnitedStates(leg.originCountry);
  const destinationUS = isUnitedStates(leg.destinationCountry);
  if (!originUS && !destinationUS) return "outside_us";
  if (!originUS || !destinationUS) return "international";
  const originZone = regionZone(leg.originRegion);
  const destinationZone = regionZone(leg.destinationRegion);
  if (originZone !== destinationZone) return "alaska_hawaii";
  return "domestic";
}

function departureDay(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function activeRule(rules: TaxRuleInput[], kind: string, day: string): TaxRuleInput | null {
  const matches = rules.filter((rule) => {
    if (rule.kind !== kind) return false;
    const from = rule.effective_from.slice(0, 10);
    const to = rule.effective_to ? rule.effective_to.slice(0, 10) : null;
    return from <= day && (to == null || to >= day);
  });
  matches.sort((a, b) => b.effective_from.localeCompare(a.effective_from));
  return matches[0] ?? null;
}

function taxableAmount(operatorAmount: number, platformFee: number): number {
  if (TAXABLE_BASE === "customer_total") return operatorAmount + platformFee;
  return operatorAmount;
}

/**
 * Domestic FET plus a segment fee, or the international facilities tax when
 * a passenger leg begins or ends outside the United States. Alaska/Hawaii
 * departures that connect to the other state or the continental US use the
 * published departure amount instead of the domestic segment fee. The
 * percentage still applies because that transportation is domestic.
 */
export function computeTaxes(input: {
  legs: TaxLeg[];
  passengers: number;
  operatorAmount: number;
  platformFee: number;
  departAt: string | Date;
  rules: TaxRuleInput[];
}): { taxesAmount: number; ruleSnapshot: Json } {
  const day = departureDay(input.departAt);
  const passengers = Number.isFinite(input.passengers) ? Math.max(0, Math.trunc(input.passengers)) : 0;
  const base = money(taxableAmount(input.operatorAmount, input.platformFee));
  const treatments = input.legs.map((leg) => legTreatment(leg));
  const domesticLegs = treatments.filter((treatment) => treatment === "domestic").length;
  const alaskaLegs = treatments.filter((treatment) => treatment === "alaska_hawaii").length;
  const internationalLegs = treatments.filter((treatment) => treatment === "international").length;
  const percentageLegs = domesticLegs + alaskaLegs;

  const applied: {
    id: string;
    kind: string;
    basis: string;
    rate: number | null;
    amount: number | null;
    currency: string;
    effective_from: string;
    effective_to: string | null;
    source_url: string;
    units: number;
    applied_amount: number;
  }[] = [];
  const missing: string[] = [];

  const apply = (kind: string, units: number) => {
    const rule = activeRule(input.rules, kind, day);
    if (!rule || units <= 0) {
      if (units > 0 && !rule) missing.push(kind);
      return 0;
    }
    const raw =
      rule.basis === "percent"
        ? base * Number(rule.rate ?? 0)
        : Number(rule.amount ?? 0) * units;
    const appliedAmount = money(raw);
    applied.push({
      id: rule.id,
      kind: rule.kind,
      basis: rule.basis,
      rate: rule.rate,
      amount: rule.amount,
      currency: rule.currency,
      effective_from: rule.effective_from,
      effective_to: rule.effective_to,
      source_url: rule.source_url,
      units,
      applied_amount: appliedAmount,
    });
    return appliedAmount;
  };

  const taxesAmount = money(
    apply("domestic_fet", percentageLegs > 0 ? 1 : 0) +
      apply("domestic_segment", domesticLegs * passengers) +
      apply("alaska_hawaii_departure", alaskaLegs * passengers) +
      apply("international_facilities", internationalLegs * passengers),
  );

  const ruleSnapshot: Json = {
    taxable_base: TAXABLE_BASE,
    taxable_base_counsel_question: TAXABLE_BASE_IS_COUNSEL_QUESTION,
    taxable_amount: base,
    passengers,
    depart_at: day,
    legs: input.legs.map((leg, index) => ({
      origin_country: leg.originCountry,
      destination_country: leg.destinationCountry,
      origin_region: leg.originRegion ?? null,
      destination_region: leg.destinationRegion ?? null,
      treatment: treatments[index],
    })),
    rules: applied,
    missing_kinds: missing,
  };

  return { taxesAmount, ruleSnapshot };
}

export function passengerLegs(args: {
  originCountry: string;
  destinationCountry: string;
  originRegion?: string | null;
  destinationRegion?: string | null;
  returnAt: string | null;
}): TaxLeg[] {
  const live: TaxLeg = {
    originCountry: args.originCountry,
    destinationCountry: args.destinationCountry,
    originRegion: args.originRegion,
    destinationRegion: args.destinationRegion,
  };
  if (!args.returnAt) return [live];
  return [
    live,
    {
      originCountry: args.destinationCountry,
      destinationCountry: args.originCountry,
      originRegion: args.destinationRegion,
      destinationRegion: args.originRegion,
    },
  ];
}
