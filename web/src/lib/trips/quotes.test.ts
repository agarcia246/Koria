import { describe, expect, it } from "vitest";
import { hasMatchingPendingQuote } from "@/lib/trips/quotes";
import { isOpenForOperatorResponse, TRIP_STATUSES } from "@/lib/trips/state";

const now = new Date("2026-11-04T20:00:00Z");
const candidate = { aircraftId: "aircraft-1", operatorAmount: 9000 };
const pending = {
  aircraft_id: "aircraft-1",
  operator_amount: 9000,
  status: "pending",
  valid_until: "2026-11-06T20:00:00Z",
};

describe("hasMatchingPendingQuote", () => {
  it("matches the same aircraft and amount", () => {
    expect(hasMatchingPendingQuote([pending], candidate, now)).toBe(true);
  });

  it("allows a different amount or aircraft", () => {
    expect(hasMatchingPendingQuote([pending], { ...candidate, operatorAmount: 9500 }, now)).toBe(false);
    expect(hasMatchingPendingQuote([pending], { ...candidate, aircraftId: "aircraft-2" }, now)).toBe(false);
  });

  it("ignores expired and settled quotes", () => {
    const expired = { ...pending, valid_until: "2026-11-03T20:00:00Z" };
    const declined = { ...pending, status: "declined" };
    expect(hasMatchingPendingQuote([expired, declined], candidate, now)).toBe(false);
  });
});

describe("isOpenForOperatorResponse", () => {
  it("is open only until the customer accepts", () => {
    const open = TRIP_STATUSES.filter(isOpenForOperatorResponse);
    expect(open.sort()).toEqual(["quote_received", "requested"]);
  });
});
