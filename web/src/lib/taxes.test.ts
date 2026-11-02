import { describe, expect, it } from "vitest";
import { computeTaxes, legTreatment, passengerLegs, type TaxRuleInput } from "@/lib/taxes";

/**
 * Shape of the 2026 rows in supabase/seed.sql.
 * rate 0.075 is 7.5%. Flat fees are currency amounts. effective_to is null,
 * so a later departure still matches until counsel closes the row.
 */
const seededRules: TaxRuleInput[] = [
  {
    id: "44444444-4444-4444-4444-444444440001",
    kind: "domestic_fet",
    basis: "percent",
    rate: 0.075,
    amount: null,
    currency: "USD",
    effective_from: "2026-01-01",
    effective_to: null,
    source_url: "https://www.irs.gov/publications/p510",
  },
  {
    id: "44444444-4444-4444-4444-444444440002",
    kind: "domestic_segment",
    basis: "per_passenger_segment",
    rate: null,
    amount: 5.3,
    currency: "USD",
    effective_from: "2026-01-01",
    effective_to: null,
    source_url: "https://www.irs.gov/publications/p510",
  },
  {
    id: "44444444-4444-4444-4444-444444440003",
    kind: "international_facilities",
    basis: "per_passenger",
    rate: null,
    amount: 23.4,
    currency: "USD",
    effective_from: "2026-01-01",
    effective_to: null,
    source_url: "https://www.irs.gov/publications/p510",
  },
  {
    id: "44444444-4444-4444-4444-444444440004",
    kind: "alaska_hawaii_departure",
    basis: "per_passenger",
    rate: null,
    amount: 11.7,
    currency: "USD",
    effective_from: "2026-01-01",
    effective_to: null,
    source_url: "https://www.irs.gov/publications/p510",
  },
];

const departAt = "2026-06-15T18:00:00.000Z";

function snapshot(value: unknown): { missing_kinds: string[]; taxable_amount: number; rules: { kind: string }[] } {
  return value as { missing_kinds: string[]; taxable_amount: number; rules: { kind: string }[] };
}

describe("legTreatment", () => {
  it("classifies domestic, Alaska/Hawaii, international, and outside-US legs", () => {
    expect(legTreatment({ originCountry: "US", destinationCountry: "US", originRegion: "Texas", destinationRegion: "Colorado" })).toBe(
      "domestic",
    );
    expect(legTreatment({ originCountry: "USA", destinationCountry: "United States" })).toBe("domestic");
    expect(legTreatment({ originCountry: "US", destinationCountry: "US", originRegion: "AK", destinationRegion: "Texas" })).toBe(
      "alaska_hawaii",
    );
    expect(legTreatment({ originCountry: "US", destinationCountry: "US", originRegion: "Hawaii", destinationRegion: "HI" })).toBe(
      "domestic",
    );
    expect(legTreatment({ originCountry: "US", destinationCountry: "Mexico" })).toBe("international");
    expect(legTreatment({ originCountry: "France", destinationCountry: "United Kingdom" })).toBe("outside_us");
  });
});

describe("computeTaxes", () => {
  const money = { operatorAmount: 80_000, platformFee: 20_000, departAt, rules: seededRules };

  it("charges 7.5% of operator plus platform fee, plus $5.30 per passenger per domestic leg", () => {
    const legs = passengerLegs({
      originCountry: "US",
      destinationCountry: "US",
      originRegion: "Texas",
      destinationRegion: "Colorado",
      returnAt: "2026-06-20T18:00:00.000Z",
    });
    expect(legs).toHaveLength(2);
    const result = computeTaxes({ ...money, legs, passengers: 4 });
    expect(result.taxesAmount).toBe(7_500 + 5.3 * 4 * 2);
    const snap = snapshot(result.ruleSnapshot);
    expect(snap.taxable_amount).toBe(100_000);
    expect(snap.missing_kinds).toEqual([]);
    expect(snap.rules.map((rule) => rule.kind)).toEqual(["domestic_fet", "domestic_segment"]);
  });

  it("uses the $11.70 Alaska/Hawaii departure amount instead of the domestic segment fee", () => {
    const result = computeTaxes({
      ...money,
      passengers: 4,
      legs: [{ originCountry: "US", destinationCountry: "US", originRegion: "Alaska", destinationRegion: "Texas" }],
    });
    expect(result.taxesAmount).toBe(7_500 + 11.7 * 4);
    expect(snapshot(result.ruleSnapshot).rules.map((rule) => rule.kind)).toEqual([
      "domestic_fet",
      "alaska_hawaii_departure",
    ]);
    expect(snapshot(result.ruleSnapshot).missing_kinds).toEqual([]);
  });

  it("charges $23.40 per passenger on an international leg and does not charge the 7.5%", () => {
    const oneWay = computeTaxes({
      ...money,
      passengers: 4,
      legs: [{ originCountry: "US", destinationCountry: "Mexico" }],
    });
    expect(oneWay.taxesAmount).toBe(23.4 * 4);
    expect(snapshot(oneWay.ruleSnapshot).rules.map((rule) => rule.kind)).toEqual(["international_facilities"]);

    const roundTrip = computeTaxes({
      ...money,
      passengers: 4,
      legs: passengerLegs({
        originCountry: "US",
        destinationCountry: "Mexico",
        returnAt: "2026-06-20T18:00:00.000Z",
      }),
    });
    expect(roundTrip.taxesAmount).toBe(23.4 * 4 * 2);
  });

  it("charges nothing when both ends are outside the United States and lists no missing kinds", () => {
    const result = computeTaxes({
      ...money,
      passengers: 4,
      legs: [{ originCountry: "France", destinationCountry: "United Kingdom" }],
    });
    expect(result.taxesAmount).toBe(0);
    expect(snapshot(result.ruleSnapshot).missing_kinds).toEqual([]);
    expect(snapshot(result.ruleSnapshot).rules).toEqual([]);
  });

  it("records a missing rule kind and does not invent its amount", () => {
    const legs = passengerLegs({
      originCountry: "US",
      destinationCountry: "US",
      returnAt: "2026-06-20T18:00:00.000Z",
    });
    const withoutSegment = seededRules.filter((rule) => rule.kind !== "domestic_segment");
    const result = computeTaxes({ ...money, legs, passengers: 4, rules: withoutSegment });
    expect(result.taxesAmount).toBe(7_500);
    expect(snapshot(result.ruleSnapshot).missing_kinds).toEqual(["domestic_segment"]);
  });

  it("still applies a seed rule after 2026 while effective_to is null", () => {
    const result = computeTaxes({
      ...money,
      departAt: "2027-03-01T00:00:00.000Z",
      passengers: 1,
      legs: [{ originCountry: "US", destinationCountry: "US" }],
    });
    expect(result.taxesAmount).toBe(7_500 + 5.3);
    expect(snapshot(result.ruleSnapshot).missing_kinds).toEqual([]);
  });
});
