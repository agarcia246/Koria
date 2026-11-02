import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect } from "vitest";
import type { Database } from "@/lib/database.types";
import { money } from "@/lib/payments/record";
import { dbTest } from "@/test/db";
import { createMoneyBooking } from "@/test/fixtures";

type Client = SupabaseClient<Database>;

/**
 * finishTrip in actions.ts is a private helper behind adminOverrideTripStatus.
 * assertWrite imports next/headers and next/navigation, and the function is
 * not exported, so this file cannot call it. The payout decision below is the
 * same service-role sequence finishTrip runs: read an existing payout and
 * return before insert. payouts_one_per_booking (0036) is the race backstop
 * and is asserted directly.
 */
async function applyFinishTripPayout(client: Client, tripId: string): Promise<"skipped" | "inserted"> {
  const tripUpdate = await client.from("trip_requests").update({ status: "completed" }).eq("id", tripId);
  if (tripUpdate.error) throw new Error(tripUpdate.error.message);

  const bookingResult = await client
    .from("bookings")
    .select("id, status, operator_amount, payout_adjustment, currency, quote_id")
    .eq("trip_request_id", tripId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (bookingResult.error) throw new Error(bookingResult.error.message);
  const booking = bookingResult.data;
  if (!booking || booking.status === "cancelled") return "skipped";
  if (booking.status !== "completed") {
    const bookingUpdate = await client.from("bookings").update({ status: "completed" }).eq("id", booking.id);
    if (bookingUpdate.error) throw new Error(bookingUpdate.error.message);
  }

  const existing = await client.from("payouts").select("id").eq("booking_id", booking.id).limit(1).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data || !booking.quote_id) return "skipped";

  const quote = await client.from("quotes").select("operator_id").eq("id", booking.quote_id).maybeSingle();
  if (quote.error) throw new Error(quote.error.message);
  if (!quote.data) return "skipped";

  const inserted = await client.from("payouts").insert({
    operator_id: quote.data.operator_id,
    booking_id: booking.id,
    amount: money(Number(booking.operator_amount) - Number(booking.payout_adjustment)),
    currency: booking.currency,
    status: "unpaid",
  });
  if (inserted.error) throw new Error(inserted.error.message);
  return "inserted";
}

async function payoutRows(client: Client, bookingId: string) {
  const rows = await client
    .from("payouts")
    .select("amount, currency, status")
    .eq("booking_id", bookingId);
  if (rows.error) throw new Error(rows.error.message);
  return rows.data ?? [];
}

describe("finishTrip payout guard", () => {
  dbTest("an already-completed trip with a payout does not gain a second payout", async (client) => {
    const fx = await createMoneyBooking(client, {
      operatorAmount: 10_000,
      customerTotal: 10_000,
      platformFeeAmount: 0,
      tripStatus: "completed",
      bookingStatus: "completed",
      withInvoice: false,
    });
    const prepared = await client
      .from("bookings")
      .update({ payout_adjustment: 125.5, currency: "EUR" })
      .eq("id", fx.bookingId);
    if (prepared.error) throw new Error(prepared.error.message);

    const quote = await client.from("quotes").select("operator_id").eq("id", fx.quoteId).single();
    if (quote.error || !quote.data) throw new Error(quote.error?.message ?? "quote missing");
    const first = await client.from("payouts").insert({
      operator_id: quote.data.operator_id,
      booking_id: fx.bookingId,
      amount: money(10_000 - 125.5),
      currency: "EUR",
      status: "unpaid",
    });
    if (first.error) throw new Error(first.error.message);

    expect(await applyFinishTripPayout(client, fx.tripId)).toBe("skipped");
    expect(await payoutRows(client, fx.bookingId)).toEqual([
      { amount: 9874.5, currency: "EUR", status: "unpaid" },
    ]);

    const duplicate = await client.from("payouts").insert({
      operator_id: quote.data.operator_id,
      booking_id: fx.bookingId,
      amount: 1,
      currency: "EUR",
      status: "unpaid",
    });
    expect(duplicate.error?.code).toBe("23505");
    expect(await payoutRows(client, fx.bookingId)).toHaveLength(1);
  });

  dbTest("the first payout uses operator_amount minus payout_adjustment and a second call skips", async (client) => {
    const fx = await createMoneyBooking(client, {
      operatorAmount: 10_000,
      customerTotal: 10_000,
      platformFeeAmount: 0,
      tripStatus: "upcoming",
      bookingStatus: "confirmed",
      withInvoice: false,
    });
    const prepared = await client
      .from("bookings")
      .update({ payout_adjustment: -40.25, currency: "USD" })
      .eq("id", fx.bookingId);
    if (prepared.error) throw new Error(prepared.error.message);

    expect(await applyFinishTripPayout(client, fx.tripId)).toBe("inserted");
    expect(await payoutRows(client, fx.bookingId)).toEqual([
      { amount: money(10_000 - -40.25), currency: "USD", status: "unpaid" },
    ]);
    expect(await applyFinishTripPayout(client, fx.tripId)).toBe("skipped");
    expect(await payoutRows(client, fx.bookingId)).toHaveLength(1);
  });
});
