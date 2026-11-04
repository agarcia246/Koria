import { describe, expect, it } from "vitest";
import { applyCoarseAircraftFilters } from "@/lib/aircraft-filters";
import { isAircraftEligible } from "@/lib/eligibility";
import { compareResults, type SearchBody } from "@/lib/search";

const body: SearchBody = {
  origin_id: "TEB",
  destination_id: "PBI",
  departure_date: "2026-11-25",
  passengers: 2,
  wifi_preferred: true,
};

function recordingQuery() {
  const columns: string[] = [];
  const query = {
    columns,
    eq(column: string) {
      columns.push(column);
      return query;
    },
    gte(column: string) {
      columns.push(column);
      return query;
    },
    gt(column: string) {
      columns.push(column);
      return query;
    },
  };
  return query;
}

describe("Wi-Fi preference", () => {
  it("does not filter aircraft in SQL", () => {
    const query = recordingQuery();
    applyCoarseAircraftFilters(query, body);
    expect(query.columns).toEqual(["is_active", "seating"]);
  });

  it("keeps an aircraft without Wi-Fi eligible", () => {
    const eligible = isAircraftEligible({
      aircraft: {
        id: "aircraft-1",
        is_active: true,
        seating: 7,
        pets: false,
        golf: false,
        skis: false,
        baggage_cu_ft: null,
      },
      rangeNm: 2010,
      blocks: [],
      request: { ...body, departAt: new Date("2026-11-25"), distanceNm: 900 },
    });
    expect(eligible).toBe(true);
  });

  const withWifi = { _sortMode: 1, _sortPrice: 12000, _paxFit: 1, _hasWifi: true };
  const noWifi = { _sortMode: 1, _sortPrice: 9000, _paxFit: 1, _hasWifi: false };

  it("ranks Wi-Fi first when preferred", () => {
    expect([noWifi, withWifi].sort((a, b) => compareResults(a, b, true))[0]).toBe(withWifi);
  });

  it("ranks by price when not preferred", () => {
    expect([withWifi, noWifi].sort((a, b) => compareResults(a, b, false))[0]).toBe(noWifi);
  });

  it("keeps firmer pricing ahead of Wi-Fi", () => {
    const live = { ...noWifi, _sortMode: 0 };
    expect([withWifi, live].sort((a, b) => compareResults(a, b, true))[0]).toBe(live);
  });
});
