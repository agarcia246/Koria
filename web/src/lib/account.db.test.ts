import { describe, expect } from "vitest";
import { DELETE_BLOCKED_OPERATOR, DELETE_BLOCKED_TRIP, deletionBlock } from "@/lib/account";
import { dbTest } from "@/test/db";
import { SEEDED_DESTINATION_ID, SEEDED_ORIGIN_ID, createCustomer, createOperator } from "@/test/fixtures";

describe("deletionBlock against trip rows", () => {
  dbTest("blocks open trip statuses and an operator membership, and allows completed or cancelled", async (client) => {
    const customer = await createCustomer(client);
    expect(await deletionBlock(client, customer.id)).toEqual({ ok: true });

    const trip = await client
      .from("trip_requests")
      .insert({
        customer_id: customer.id,
        origin_id: SEEDED_ORIGIN_ID,
        destination_id: SEEDED_DESTINATION_ID,
        depart_at: new Date(Date.now() + 30 * 24 * 3_600_000).toISOString(),
        passengers: 1,
        status: "awaiting_payment",
      })
      .select("id")
      .single();
    if (trip.error || !trip.data) throw new Error(trip.error?.message ?? "no trip");

    expect(await deletionBlock(client, customer.id)).toEqual({ ok: false, error: DELETE_BLOCKED_TRIP });

    for (const status of ["confirmed", "upcoming"] as const) {
      const updated = await client.from("trip_requests").update({ status }).eq("id", trip.data.id);
      if (updated.error) throw new Error(updated.error.message);
      expect(await deletionBlock(client, customer.id)).toEqual({ ok: false, error: DELETE_BLOCKED_TRIP });
    }

    for (const status of ["completed", "cancelled"] as const) {
      const updated = await client.from("trip_requests").update({ status }).eq("id", trip.data.id);
      if (updated.error) throw new Error(updated.error.message);
      expect(await deletionBlock(client, customer.id)).toEqual({ ok: true });
    }

    const operator = await createOperator(client);
    const member = await client.from("operator_members").insert({
      operator_id: operator.id,
      profile_id: customer.id,
      role: "member",
    });
    if (member.error) throw new Error(member.error.message);
    expect(await deletionBlock(client, customer.id)).toEqual({ ok: false, error: DELETE_BLOCKED_OPERATOR });
  });
});
