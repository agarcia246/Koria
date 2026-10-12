import { error, isAuthContext, json, requireBearerAuth } from "@/lib/api/auth";
import { logError } from "@/lib/log";
import type { TripStatus } from "@/lib/database.types";
import { enqueueNotification } from "@/lib/notifications/enqueue";
import { recordCancellationRefund } from "@/lib/payments/refund";
import { loadTripPayload } from "@/lib/trips/load";
import { canTransition } from "@/lib/trips/state";

const CANCELLABLE: TripStatus[] = [
  "requested",
  "quote_received",
  "awaiting_payment",
  "confirmed",
  "upcoming",
];

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireBearerAuth(request, { requireApprovedCustomer: true });
  if (!isAuthContext(auth)) return auth;

  const { id } = await context.params;
  let body: { reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON");
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) return error("A reason is required");

  const { data: trip } = await auth.supabase
    .from("trip_requests")
    .select("id, status")
    .eq("id", id)
    .eq("customer_id", auth.userId)
    .maybeSingle();
  if (!trip) return error("Trip not found", 404);
  if (!CANCELLABLE.includes(trip.status) || !canTransition(trip.status, "cancelled")) {
    return error("This trip cannot be cancelled", 400);
  }

  const { error: updateError } = await auth.supabase
    .from("trip_requests")
    .update({
      status: "cancelled",
      cancellation_reason: reason,
      cancelled_by: auth.userId,
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", trip.id);
  if (updateError) {
    logError("supabase_write_failed", { table: "trip_requests", message: updateError.message });
    return error(updateError.message, 500);
  }

  const { error: bookingError } = await auth.supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("trip_request_id", trip.id)
    .neq("status", "cancelled");
  if (bookingError) {
    logError("supabase_write_failed", { table: "bookings", message: bookingError.message });
    return error(bookingError.message, 500);
  }

  await recordCancellationRefund(auth.supabase, trip.id);

  enqueueNotification("trip_cancelled", {
    tripId: trip.id,
    reason,
    outcome: "cancelled",
    notify: "operators",
  });

  const serialized = await loadTripPayload(auth.supabase, trip.id);
  return json(serialized);
}
