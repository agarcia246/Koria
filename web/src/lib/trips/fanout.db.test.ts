import { describe, expect } from "vitest";
import { RANGE_MARGIN } from "@/lib/eligibility";
import { haversineNm } from "@/lib/geo";
import { searchOperatorIds } from "@/lib/search";
import { eligibleOperatorIds } from "@/lib/trips/fanout";
import { dbTest } from "@/test/db";
import {
  SEEDED_DESTINATION_ID,
  SEEDED_ORIGIN_ID,
  createAircraft,
  createAircraftModel,
  createOperator,
} from "@/test/fixtures";

const DEPART_AT = "2030-06-15T15:00:00.000Z";

describe("fan-out and search operator parity", () => {
  dbTest("eligibleOperatorIds matches searchOperatorIds, including exclusions", async (client) => {
    const origin = await client
      .from("airports")
      .select("latitude, longitude")
      .eq("id", SEEDED_ORIGIN_ID)
      .single();
    const destination = await client
      .from("airports")
      .select("latitude, longitude")
      .eq("id", SEEDED_DESTINATION_ID)
      .single();
    if (origin.error || !origin.data || destination.error || !destination.data) {
      throw new Error(origin.error?.message ?? destination.error?.message ?? "airports missing");
    }

    const distanceNm = haversineNm(
      origin.data.latitude,
      origin.data.longitude,
      destination.data.latitude,
      destination.data.longitude,
    );
    const limit = distanceNm * RANGE_MARGIN;
    const shortRangeNm = Math.floor(limit - 1e-6);
    const longRangeNm = Math.ceil(limit);
    expect(shortRangeNm).toBeGreaterThan(0);
    expect(limit).toBeGreaterThan(shortRangeNm);
    expect(limit).toBeLessThanOrEqual(longRangeNm);

    const [included, unverified, inactiveOp, blockedOp, shortOp] = await Promise.all([
      createOperator(client, { verified: true }),
      createOperator(client, { verified: false }),
      createOperator(client, { verified: true }),
      createOperator(client, { verified: true }),
      createOperator(client, { verified: true }),
    ]);
    const [longModel, shortModel] = await Promise.all([
      createAircraftModel(client, { rangeNm: longRangeNm, name: "KOR-74 long" }),
      createAircraftModel(client, { rangeNm: shortRangeNm, name: "KOR-74 short" }),
    ]);

    const blockedAircraft = await createAircraft(client, {
      operatorId: blockedOp.id,
      modelId: longModel.id,
    });
    await Promise.all([
      createAircraft(client, { operatorId: included.id, modelId: longModel.id }),
      createAircraft(client, { operatorId: unverified.id, modelId: longModel.id }),
      createAircraft(client, { operatorId: inactiveOp.id, modelId: longModel.id, isActive: false }),
      createAircraft(client, { operatorId: shortOp.id, modelId: shortModel.id }),
    ]);
    const block = await client.from("aircraft_availability").insert({
      aircraft_id: blockedAircraft.id,
      kind: "blocked",
      starts_at: "2030-06-15T14:00:00.000Z",
      ends_at: "2030-06-15T16:00:00.000Z",
    });
    if (block.error) throw new Error(block.error.message);

    const prefs = {
      pets: false,
      golf: false,
      skis: false,
      baggage: false,
    };
    const fanout = await eligibleOperatorIds(client, {
      originId: SEEDED_ORIGIN_ID,
      destinationId: SEEDED_DESTINATION_ID,
      departAt: DEPART_AT,
      passengers: 2,
      prefs,
    });
    if ("error" in fanout) throw new Error(fanout.error);
    const searched = await searchOperatorIds(client, {
      origin_id: SEEDED_ORIGIN_ID,
      destination_id: SEEDED_DESTINATION_ID,
      departure_date: DEPART_AT,
      passengers: 2,
      ...prefs,
    });

    expect([...fanout.operatorIds].sort()).toEqual([...searched].sort());
    expect(fanout.operatorIds).toContain(included.id);
    expect(searched).toContain(included.id);
    for (const excluded of [unverified.id, inactiveOp.id, blockedOp.id, shortOp.id]) {
      expect(fanout.operatorIds).not.toContain(excluded);
      expect(searched).not.toContain(excluded);
    }
  });
});
