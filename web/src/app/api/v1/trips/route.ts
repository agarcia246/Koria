import { error, isAuthContext, json, requireBearerAuth } from "@/lib/api/auth";
import type { Json } from "@/lib/database.types";
import { logError } from "@/lib/log";
import { enqueueNotification } from "@/lib/notifications/enqueue";
import { sameOperatorIds, searchOperatorIds } from "@/lib/search";
import { eligibleOperatorIds } from "@/lib/trips/fanout";
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
  };

  const aircraftId = body.aircraft_id ? String(body.aircraft_id) : null;
  const eligible = await eligibleOperatorIds(auth.supabase, {
    originId,
    destinationId,
    departAt: String(body.departure_date),
    passengers: Number(body.passengers),
    prefs,
    aircraftId,
  });
  if ("error" in eligible) return error(eligible.error);

  // Fan-out and search share the coarse SQL filter plus isAircraftEligible.
  // A pinned aircraft is a subset on purpose, so the check is only for an open request.
  if (!aircraftId) {
    const searched = await searchOperatorIds(auth.supabase, {
      origin_id: originId,
      destination_id: destinationId,
      departure_date: String(body.departure_date),
      passengers: Number(body.passengers),
      pets: prefs.pets,
      wifi_preferred: prefs.wifi_preferred,
      golf: prefs.golf,
      skis: prefs.skis,
      baggage: prefs.baggage,
      nearby_airports: false,
    });
    if (!sameOperatorIds(eligible.operatorIds, searched)) {
      logError("fanout_search_mismatch", {
        message: `fan-out operators (${eligible.operatorIds.length}) differ from search operators (${searched.length})`,
      });
    }
  }

  const { data: trip, error: insertError } = await auth.supabase.rpc("create_trip_with_fanout", {
    p_customer_id: auth.userId,
    p_origin_id: originId,
    p_destination_id: destinationId,
    p_depart_at: String(body.departure_date),
    p_return_at: body.return_date ? String(body.return_date) : null,
    p_passengers: Number(body.passengers),
    p_prefs: prefs as Json,
    p_aircraft_id: aircraftId,
    p_empty_leg_id: body.empty_leg_id ? String(body.empty_leg_id) : null,
    p_notes: body.notes ? String(body.notes) : null,
    p_operator_ids: eligible.operatorIds,
  });

  if (insertError || !trip) {
    logError("supabase_write_failed", {
      table: "trip_requests",
      message: insertError?.message ?? "Failed to create trip",
    });
    return error(insertError?.message ?? "Failed to create trip", 500);
  }

  enqueueNotification("request_received", {
    tripId: trip.id,
    operatorIds: eligible.operatorIds,
  });

  const serialized = await loadTripPayload(auth.supabase, trip.id);
  return json(serialized, 201);
}
