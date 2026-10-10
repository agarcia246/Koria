import { error, isAuthContext, json, requireBearerAuth } from "@/lib/api/auth";
import type { Json } from "@/lib/database.types";
import { loadTripPayload } from "@/lib/trips/load";

function resolveAirportId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

export async function GET(request: Request) {
  const auth = await requireBearerAuth(request, { requireApprovedCustomer: true });
  if (!isAuthContext(auth)) return auth;

  const { data: trips } = await auth.supabase
    .from("trip_requests")
    .select("*")
    .eq("customer_id", auth.userId)
    .order("created_at", { ascending: false });

  const payload = [];
  for (const trip of trips ?? []) {
    const serialized = await loadTripPayload(auth.supabase, trip.id);
    if (serialized) payload.push(serialized);
  }
  return json(payload);
}

export async function POST(request: Request) {
  const auth = await requireBearerAuth(request, { requireApprovedCustomer: true });
  if (!isAuthContext(auth)) return auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON");
  }

  const originId =
    resolveAirportId(body.origin_id) ?? resolveAirportId(body.origin);
  const destinationId =
    resolveAirportId(body.destination_id) ?? resolveAirportId(body.destination);

  if (!originId || !destinationId || !body.departure_date || !body.passengers) {
    return error("origin, destination, departure_date, and passengers are required");
  }

  const prefs = {
    pets: Boolean(body.pets),
    wifi_preferred: Boolean(body.wifi_preferred),
    golf: Boolean(body.golf),
    skis: Boolean(body.skis),
    baggage: Boolean(body.baggage),
  } as Json;

  const { data: trip, error: insertError } = await auth.supabase
    .from("trip_requests")
    .insert({
      customer_id: auth.userId,
      origin_id: originId,
      destination_id: destinationId,
      depart_at: String(body.departure_date),
      return_at: body.return_date ? String(body.return_date) : null,
      passengers: Number(body.passengers),
      prefs,
      aircraft_id: body.aircraft_id ? String(body.aircraft_id) : null,
      empty_leg_id: body.empty_leg_id ? String(body.empty_leg_id) : null,
      notes: body.notes ? String(body.notes) : null,
      status: "requested",
    })
    .select("*")
    .single();

  if (insertError || !trip) return error(insertError?.message ?? "Failed to create trip", 500);

  const serialized = await loadTripPayload(auth.supabase, trip.id);
  return json(serialized, 201);
}
