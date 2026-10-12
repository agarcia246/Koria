import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TripStatus } from "@/lib/database.types";
import { applyCoarseAircraftFilters, applyVerifiedOperatorFilter } from "@/lib/aircraft-filters";
import { isAircraftEligible, type EligibilityRequest } from "@/lib/eligibility";
import { haversineNm } from "@/lib/geo";
import { nextStatusOnOperatorDecline } from "@/lib/trips/state";

type Client = SupabaseClient<Database>;

const EMPTY_ID = "00000000-0000-0000-0000-000000000000";

export type FanoutInput = {
  originId: string;
  destinationId: string;
  departAt: string;
  passengers: number;
  prefs: Pick<EligibilityRequest, "pets" | "wifi_preferred" | "golf" | "skis" | "baggage">;
  aircraftId?: string | null;
};

export async function eligibleOperatorIds(
  client: Client,
  input: FanoutInput,
): Promise<{ operatorIds: string[] } | { error: string }> {
  const [{ data: origin }, { data: destination }] = await Promise.all([
    client.from("airports").select("id, latitude, longitude").eq("id", input.originId).maybeSingle(),
    client
      .from("airports")
      .select("id, latitude, longitude")
      .eq("id", input.destinationId)
      .maybeSingle(),
  ]);
  if (!origin || !destination) return { error: "Invalid origin or destination" };

  const distanceNm = haversineNm(
    origin.latitude,
    origin.longitude,
    destination.latitude,
    destination.longitude,
  );

  let aircraftQuery = applyVerifiedOperatorFilter(client.from("aircraft"));
  aircraftQuery = input.aircraftId
    ? aircraftQuery.eq("id", input.aircraftId)
    : applyCoarseAircraftFilters(aircraftQuery, {
        passengers: input.passengers,
        pets: input.prefs.pets,
        wifi_preferred: input.prefs.wifi_preferred,
        golf: input.prefs.golf,
        skis: input.prefs.skis,
        baggage: input.prefs.baggage,
      });

  const { data: aircraftRows, error: aircraftError } = await aircraftQuery;
  if (aircraftError) return { error: aircraftError.message };
  if (input.aircraftId && (aircraftRows ?? []).length === 0) {
    return { error: "Aircraft not found" };
  }

  const aircraft = aircraftRows ?? [];
  const modelIds = Array.from(new Set(aircraft.map((row) => row.model_id)));
  const aircraftIds = aircraft.map((row) => row.id);

  const [{ data: models, error: modelError }, { data: blocks, error: blockError }] =
    await Promise.all([
      client
        .from("aircraft_models")
        .select("id, range_nm")
        .in("id", modelIds.length ? modelIds : [EMPTY_ID]),
      client
        .from("aircraft_availability")
        .select("aircraft_id, starts_at, ends_at")
        .eq("kind", "blocked")
        .in("aircraft_id", aircraftIds.length ? aircraftIds : [EMPTY_ID]),
    ]);
  if (modelError) return { error: modelError.message };
  if (blockError) return { error: blockError.message };

  const rangeByModel = new Map((models ?? []).map((model) => [model.id, model.range_nm]));
  const request: EligibilityRequest = {
    passengers: input.passengers,
    pets: input.prefs.pets,
    wifi_preferred: input.prefs.wifi_preferred,
    golf: input.prefs.golf,
    skis: input.prefs.skis,
    baggage: input.prefs.baggage,
    departAt: new Date(input.departAt),
    distanceNm,
  };

  const operatorIds = new Set<string>();
  for (const row of aircraft) {
    const rangeNm = rangeByModel.get(row.model_id);
    if (rangeNm == null) continue;
    if (
      !isAircraftEligible({
        aircraft: row,
        rangeNm,
        blocks: blocks ?? [],
        request,
      })
    ) {
      continue;
    }
    operatorIds.add(row.operator_id);
  }

  return { operatorIds: Array.from(operatorIds) };
}

export async function markFanoutQuoted(client: Client, tripId: string, operatorId: string) {
  return client
    .from("trip_request_operators")
    .update({ status: "quoted" })
    .eq("trip_id", tripId)
    .eq("operator_id", operatorId);
}

/**
 * Marks this operator declined. The trip becomes declined only when every
 * fan-out row is declined and no quote on the trip is still pending.
 * Uses a service-role client so one operator cannot read the other rows.
 */
export async function declineOperatorFanout(
  client: Client,
  tripId: string,
  operatorId: string,
  reason?: string | null,
  actorId?: string | null,
): Promise<{ error: { message: string } | null; tripStatus: TripStatus | null; becameDeclined: boolean }> {
  const { data: updated, error: updateError } = await client
    .from("trip_request_operators")
    .update({
      status: "declined",
      ...(reason ? { decline_reason: reason } : {}),
    })
    .eq("trip_id", tripId)
    .eq("operator_id", operatorId)
    .select("trip_id");
  if (updateError) return { error: updateError, tripStatus: null, becameDeclined: false };
  if (!updated?.length) {
    return { error: { message: "This operator is not on the request" }, tripStatus: null, becameDeclined: false };
  }

  const [{ data: rows, error: rowsError }, { data: pending, error: pendingError }, { data: trip, error: tripError }] =
    await Promise.all([
      client.from("trip_request_operators").select("status").eq("trip_id", tripId),
      client.from("quotes").select("id").eq("trip_request_id", tripId).eq("status", "pending"),
      client.from("trip_requests").select("status").eq("id", tripId).maybeSingle(),
    ]);
  const readError = rowsError ?? pendingError ?? tripError;
  if (readError) return { error: readError, tripStatus: trip?.status ?? null, becameDeclined: false };
  if (!trip) return { error: { message: "Trip not found" }, tripStatus: null, becameDeclined: false };

  const allDeclined = (rows ?? []).length > 0 && (rows ?? []).every((row) => row.status === "declined");
  const noPendingQuote = (pending ?? []).length === 0;
  if (!allDeclined || !noPendingQuote) return { error: null, tripStatus: trip.status, becameDeclined: false };
  if (trip.status !== "requested" && trip.status !== "quote_received") {
    return { error: null, tripStatus: trip.status, becameDeclined: false };
  }

  const next = nextStatusOnOperatorDecline(trip.status);
  const { error: statusError } = await client
    .from("trip_requests")
    .update({
      status: next,
      ...(reason
        ? {
            cancellation_reason: reason,
            cancelled_by: actorId ?? null,
            cancelled_at: new Date().toISOString(),
          }
        : {}),
    })
    .eq("id", tripId);
  if (statusError) return { error: statusError, tripStatus: trip.status, becameDeclined: false };
  return { error: null, tripStatus: next, becameDeclined: true };
}
