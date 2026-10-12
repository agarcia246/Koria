import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Account export and deletion.
 * profiles has no phone column. display_name, email, and photo_url are the
 * personal fields on the row. Trip requests, bookings, invoices, and payments
 * stay. Passengers and notifications are removed.
 */

type ServiceClient = SupabaseClient<Database>;

export const DELETE_BLOCKED_OPERATOR = "operator_member";
export const DELETE_BLOCKED_TRIP = "open_trip";

const OPEN_TRIP_STATUSES = ["awaiting_payment", "confirmed", "upcoming"] as const;

export function anonymizedProfile(userId: string) {
  return {
    display_name: "Deleted account",
    email: `deleted+${userId}@anonymized.koria.invalid`,
    photo_url: null,
  };
}

async function rowsFor<T>(
  label: string,
  query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ ok: true; rows: T[] } | { ok: false; message: string }> {
  const { data, error } = await query;
  if (error) return { ok: false, message: `${label}: ${error.message}` };
  return { ok: true, rows: data ?? [] };
}

export async function loadAccountExport(supabase: ServiceClient, userId: string) {
  const profile = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (profile.error) return { ok: false as const, message: `profiles: ${profile.error.message}` };
  if (!profile.data) return { ok: false as const, message: "profiles: not found" };

  const trips = await rowsFor(
    "trip_requests",
    supabase.from("trip_requests").select("*").eq("customer_id", userId),
  );
  if (!trips.ok) return trips;

  const tripIds = trips.rows.map((trip) => trip.id);
  const quotes = tripIds.length
    ? await rowsFor(
        "quotes",
        supabase.from("quotes").select("*").in("trip_request_id", tripIds),
      )
    : { ok: true as const, rows: [] };
  if (!quotes.ok) return quotes;

  const bookings = tripIds.length
    ? await rowsFor(
        "bookings",
        supabase.from("bookings").select("id, trip_request_id").in("trip_request_id", tripIds),
      )
    : { ok: true as const, rows: [] };
  if (!bookings.ok) return bookings;

  const bookingIds = bookings.rows.map((booking) => booking.id);
  const invoices = bookingIds.length
    ? await rowsFor(
        "invoices",
        supabase.from("invoices").select("*").in("booking_id", bookingIds),
      )
    : { ok: true as const, rows: [] };
  if (!invoices.ok) return invoices;

  const passengers = await rowsFor(
    "passenger_profiles",
    supabase.from("passenger_profiles").select("*").eq("customer_id", userId),
  );
  if (!passengers.ok) return passengers;

  const notifications = await rowsFor(
    "notifications",
    supabase.from("notifications").select("*").eq("profile_id", userId),
  );
  if (!notifications.ok) return notifications;

  return {
    ok: true as const,
    body: {
      profile: profile.data,
      trips: trips.rows,
      quotes: quotes.rows,
      passengers: passengers.rows,
      invoices: invoices.rows,
      notifications: notifications.rows,
    },
  };
}

export async function deletionBlock(
  supabase: ServiceClient,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string } | { ok: false; message: string }> {
  const membership = await supabase
    .from("operator_members")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", userId);
  if (membership.error) return { ok: false, message: membership.error.message };
  if ((membership.count ?? 0) > 0) return { ok: false, error: DELETE_BLOCKED_OPERATOR };

  const openTrips = await supabase
    .from("trip_requests")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", userId)
    .in("status", [...OPEN_TRIP_STATUSES]);
  if (openTrips.error) return { ok: false, message: openTrips.error.message };
  if ((openTrips.count ?? 0) > 0) return { ok: false, error: DELETE_BLOCKED_TRIP };

  return { ok: true };
}
