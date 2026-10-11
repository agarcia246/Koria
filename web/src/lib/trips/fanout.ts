import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { isAircraftEligible, type EligibilityRequest } from "@/lib/eligibility";
import { haversineNm } from "@/lib/geo";

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

  let aircraftQuery = client.from("aircraft").select("*");
  aircraftQuery = input.aircraftId
    ? aircraftQuery.eq("id", input.aircraftId)
    : aircraftQuery.eq("is_active", true);

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
