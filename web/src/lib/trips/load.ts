import type { createServiceClient } from "@/lib/supabase/admin";
import { serializeTrip } from "@/lib/api/serialize";

type Client = ReturnType<typeof createServiceClient>;

export async function loadTripPayload(supabase: Client, tripId: string) {
  const { data: trip } = await supabase
    .from("trip_requests")
    .select("*")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) return null;

  const [{ data: origin }, { data: destination }, { data: booking }] = await Promise.all([
    supabase.from("airports").select("*").eq("id", trip.origin_id).single(),
    supabase.from("airports").select("*").eq("id", trip.destination_id).single(),
    supabase
      .from("bookings")
      .select("*")
      .eq("trip_request_id", trip.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!origin || !destination) return null;
  return serializeTrip(trip, origin, destination, booking);
}
