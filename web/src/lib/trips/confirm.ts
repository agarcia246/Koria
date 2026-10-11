import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { enqueueNotification } from "@/lib/notifications/enqueue";
import { nextStatusOnMarkPaid } from "@/lib/trips/state";

type Client = SupabaseClient<Database>;

/**
 * Moves a booking and its trip from awaiting_payment to confirmed, then emits
 * booking_confirmed. M5 records the wire and calls this only when the recorded
 * payments cover customer_total. This helper does not look at payments.
 */
export async function confirmTripAfterPayment(
  client: Client,
  bookingId: string,
): Promise<{ ok: true; tripId: string } | { ok: false; table: string; error: { message: string } }> {
  const { data: booking, error: bookingReadError } = await client
    .from("bookings")
    .select("id, trip_request_id, quote_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (bookingReadError) return { ok: false, table: "bookings", error: bookingReadError };
  if (!booking) return { ok: false, table: "bookings", error: { message: "Booking not found" } };

  const { data: trip, error: tripReadError } = await client
    .from("trip_requests")
    .select("id, status")
    .eq("id", booking.trip_request_id)
    .maybeSingle();
  if (tripReadError) return { ok: false, table: "trip_requests", error: tripReadError };
  if (!trip) return { ok: false, table: "trip_requests", error: { message: "Trip not found" } };

  const next = nextStatusOnMarkPaid(trip.status);
  const { data: quote, error: quoteError } = await client
    .from("quotes")
    .select("operator_id")
    .eq("id", booking.quote_id)
    .maybeSingle();
  if (quoteError) return { ok: false, table: "quotes", error: quoteError };
  if (!quote) return { ok: false, table: "quotes", error: { message: "Quote not found" } };

  const { error: bookingError } = await client
    .from("bookings")
    .update({ status: "confirmed" })
    .eq("id", bookingId);
  if (bookingError) return { ok: false, table: "bookings", error: bookingError };

  const { error: tripError } = await client.from("trip_requests").update({ status: next }).eq("id", trip.id);
  if (tripError) return { ok: false, table: "trip_requests", error: tripError };

  enqueueNotification("booking_confirmed", { tripId: trip.id, operatorId: quote.operator_id });
  return { ok: true, tripId: trip.id };
}
