import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/database.types";
import { isAircraftEligible } from "@/lib/eligibility";
import { haversineNm } from "@/lib/geo";
import { computeOperatorAmount } from "@/lib/pricing";
import { serializeAirport, serializeListing } from "@/lib/api/serialize";

type Client = SupabaseClient<Database>;

export type SearchBody = {
  origin_id: string;
  destination_id: string;
  departure_date: string;
  return_date?: string | null;
  passengers: number;
  pets?: boolean;
  wifi_preferred?: boolean;
  golf?: boolean;
  skis?: boolean;
  baggage?: boolean;
  flexible_days?: number;
  nearby_airports?: boolean;
};

/** Nearby-airport radius. Passed to airports_within_nm; the search does not read the full table. */
export const NEARBY_RADIUS_NM = 50;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadAirport(client: Client, idOrCode: string) {
  const value = idOrCode.trim();
  if (!value) return null;

  if (UUID_RE.test(value)) {
    const { data } = await client.from("airports").select("*").eq("id", value).maybeSingle();
    return data;
  }

  const code = value.replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (!code) return null;

  const { data: byIata } = await client
    .from("airports")
    .select("*")
    .ilike("iata", code)
    .maybeSingle();
  if (byIata) return byIata;

  const { data: byIcao } = await client
    .from("airports")
    .select("*")
    .ilike("icao", code)
    .maybeSingle();
  return byIcao;
}

export async function runSearch(
  client: Client,
  customerId: string | null,
  body: SearchBody,
) {
  const origin = await loadAirport(client, body.origin_id);
  const destination = await loadAirport(client, body.destination_id);

  if (!origin || !destination) {
    throw new Error("Invalid origin or destination");
  }

  let originIds = [origin.id];
  let destinationIds = [destination.id];

  if (body.nearby_airports) {
    const [{ data: nearbyOrigin, error: originError }, { data: nearbyDest, error: destError }] =
      await Promise.all([
        client.rpc("airports_within_nm", {
          p_lat: origin.latitude,
          p_lng: origin.longitude,
          p_nm: NEARBY_RADIUS_NM,
        }),
        client.rpc("airports_within_nm", {
          p_lat: destination.latitude,
          p_lng: destination.longitude,
          p_nm: NEARBY_RADIUS_NM,
        }),
      ]);
    if (originError) throw new Error(originError.message);
    if (destError) throw new Error(destError.message);
    originIds = Array.from(new Set([origin.id, ...(nearbyOrigin ?? []).map((a) => a.id)]));
    destinationIds = Array.from(new Set([destination.id, ...(nearbyDest ?? []).map((a) => a.id)]));
  }

  const distanceNm = haversineNm(
    origin.latitude,
    origin.longitude,
    destination.latitude,
    destination.longitude,
  );

  const { data: aircraftRows } = await client
    .from("aircraft")
    .select("*")
    .eq("is_active", true);

  const aircraft = aircraftRows ?? [];
  const modelIds = Array.from(new Set(aircraft.map((a) => a.model_id)));
  const operatorIds = Array.from(new Set(aircraft.map((a) => a.operator_id)));
  const aircraftIds = aircraft.map((a) => a.id);
  const homeBaseIds = Array.from(
    new Set(aircraft.map((a) => a.home_base_id).filter((id): id is string => Boolean(id))),
  );

  const [{ data: models }, { data: operators }, { data: photos }, { data: rules }, { data: blocks }, { data: emptyLegs }, { data: homeBases }] =
    await Promise.all([
      client.from("aircraft_models").select("*").in("id", modelIds.length ? modelIds : ["00000000-0000-0000-0000-000000000000"]),
      client.from("operators").select("*").in("id", operatorIds.length ? operatorIds : ["00000000-0000-0000-0000-000000000000"]),
      client.from("aircraft_photos").select("*").in("aircraft_id", aircraftIds.length ? aircraftIds : ["00000000-0000-0000-0000-000000000000"]),
      client.from("aircraft_pricing_rules").select("*").in("aircraft_id", aircraftIds.length ? aircraftIds : ["00000000-0000-0000-0000-000000000000"]),
      client
        .from("aircraft_availability")
        .select("*")
        .eq("kind", "blocked")
        .in("aircraft_id", aircraftIds.length ? aircraftIds : ["00000000-0000-0000-0000-000000000000"]),
      client
        .from("empty_legs")
        .select("*")
        .eq("status", "published")
        .in("origin_id", originIds)
        .in("destination_id", destinationIds),
      client
        .from("airports")
        .select("id, latitude, longitude")
        .in("id", homeBaseIds.length ? homeBaseIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);

  const modelMap = new Map((models ?? []).map((m) => [m.id, m]));
  const operatorMap = new Map((operators ?? []).map((o) => [o.id, o]));
  const ruleMap = new Map((rules ?? []).map((r) => [r.aircraft_id, r]));
  const homeBaseMap = new Map((homeBases ?? []).map((airport) => [airport.id, airport]));
  const photosByAircraft = new Map<string, Tables<"aircraft_photos">[]>();
  for (const p of photos ?? []) {
    const list = photosByAircraft.get(p.aircraft_id) ?? [];
    list.push(p);
    photosByAircraft.set(p.aircraft_id, list);
  }

  const depart = new Date(body.departure_date);
  const flexibleDays = body.flexible_days ?? 0;

  type Result = {
    id: string;
    listing: ReturnType<typeof serializeListing>;
    origin: ReturnType<typeof serializeAirport>;
    destination: ReturnType<typeof serializeAirport>;
    departure_date: string;
    passengers: number;
    distance_nm: number;
    price: { mode: string; amount: { amount: number; currency: string } | null };
    tradeoff: string | null;
    rank_tags: string[];
    _sortMode: number;
    _sortPrice: number;
    _paxFit: number;
    _cabin: number;
    _hasWifi: boolean;
    _emptyLeg: boolean;
  };

  const results: Result[] = [];

  for (const ac of aircraft) {
    const model = modelMap.get(ac.model_id);
    const operator = operatorMap.get(ac.operator_id);
    if (!model || !operator) continue;

    if (
      !isAircraftEligible({
        aircraft: ac,
        rangeNm: model.range_nm,
        blocks: blocks ?? [],
        request: {
          passengers: body.passengers,
          pets: body.pets,
          wifi_preferred: body.wifi_preferred,
          golf: body.golf,
          skis: body.skis,
          baggage: body.baggage,
          departAt: depart,
          distanceNm,
        },
      })
    ) {
      continue;
    }

    const matchingEmpty = (emptyLegs ?? []).find((el) => {
      if (el.aircraft_id !== ac.id) return false;
      if (flexibleDays <= 0) {
        return sameDay(new Date(el.depart_at), depart);
      }
      const elDate = new Date(el.depart_at);
      const diffDays = Math.abs(elDate.getTime() - depart.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= flexibleDays;
    });

    const homeBase = ac.home_base_id ? homeBaseMap.get(ac.home_base_id) : undefined;
    const repositionNm = homeBase
      ? haversineNm(homeBase.latitude, homeBase.longitude, origin.latitude, origin.longitude)
      : 0;
    const priced = computeOperatorAmount({
      rule: ruleMap.get(ac.id),
      cruiseSpeedKtas: model.cruise_speed_ktas,
      repositionNm,
      liveNm: distanceNm,
      returnNm: body.return_date ? distanceNm : 0,
    });

    const listing = serializeListing({
      aircraft: ac,
      model,
      operator,
      photos: photosByAircraft.get(ac.id) ?? [],
    });

    results.push({
      id: crypto.randomUUID(),
      listing,
      origin: serializeAirport(origin),
      destination: serializeAirport(destination),
      departure_date: body.departure_date,
      passengers: body.passengers,
      distance_nm: Math.round(distanceNm),
      price: {
        mode: priced.mode,
        amount:
          priced.amount == null
            ? null
            : { amount: priced.amount, currency: "USD" },
      },
      tradeoff: describeTradeoff({
        category: model.category,
        cruiseSpeedKtas: model.cruise_speed_ktas,
        wifi: ac.wifi,
        passengers: body.passengers,
        distanceNm,
        wifiPreferred: Boolean(body.wifi_preferred),
      }),
      rank_tags: [],
      _sortMode: priced.mode === "live" ? 0 : priced.mode === "estimated" ? 1 : 2,
      _sortPrice: priced.amount ?? Number.POSITIVE_INFINITY,
      _paxFit: ac.seating - body.passengers,
      _cabin: Number(model.cabin_length_ft ?? 0),
      _hasWifi: ac.wifi,
      _emptyLeg: Boolean(matchingEmpty),
    });
  }

  // Rank tags
  if (results.length) {
    const priced = results.filter((r) => r.price.amount != null);
    if (priced.length) {
      const lowest = priced.reduce((a, b) =>
        (a.price.amount?.amount ?? Infinity) <= (b.price.amount?.amount ?? Infinity) ? a : b,
      );
      lowest.rank_tags.push("Lowest Price");
    }

    const withWifi = results.filter((r) => r._hasWifi);
    if (withWifi.length) {
      const bestValue = withWifi.reduce((a, b) => (a._paxFit <= b._paxFit ? a : b));
      if (!bestValue.rank_tags.includes("Best Value")) bestValue.rank_tags.push("Best Value");
    }

    const bestExp = results.reduce((a, b) => (a._cabin >= b._cabin ? a : b));
    if (!bestExp.rank_tags.includes("Best Experience")) bestExp.rank_tags.push("Best Experience");

    for (const r of results) {
      if (r._emptyLeg && !r.rank_tags.includes("Empty Leg")) r.rank_tags.push("Empty Leg");
    }
  }

  results.sort((a, b) => {
    if (a._sortMode !== b._sortMode) return a._sortMode - b._sortMode;
    if (a._sortPrice !== b._sortPrice) return a._sortPrice - b._sortPrice;
    return a._paxFit - b._paxFit;
  });

  const cleaned = results.map(({ _sortMode, _sortPrice, _paxFit, _cabin, _hasWifi, _emptyLeg, ...rest }) => rest);

  await client.from("searches").insert({
    customer_id: customerId,
    query: body as unknown as Database["public"]["Tables"]["searches"]["Insert"]["query"],
    result_count: cleaned.length,
  });

  return cleaned;
}

function describeTradeoff(args: {
  category: string;
  cruiseSpeedKtas: number;
  wifi: boolean;
  passengers: number;
  distanceNm: number;
  wifiPreferred: boolean;
}) {
  if (args.category === "ultra_long_range") {
    return "Ocean-crossing cabin. Quote from the operator.";
  }
  if (args.cruiseSpeedKtas >= 500) {
    return "Fastest aircraft that covers this sector.";
  }
  if (args.wifiPreferred && args.wifi) {
    return `Cabin Wi-Fi confirmed. Right-sized for ${args.passengers}.`;
  }
  if (args.distanceNm < 900 && (args.category === "light" || args.category === "very_light")) {
    return "Right-sized for a short hop. No extra cabin you will not use.";
  }
  if (args.category === "super_midsize" || args.category === "heavy") {
    return "Stand-up cabin, quieter for the time in the air.";
  }
  return "Capable of the mission, with a cabin that matches the passenger count.";
}

function sameDay(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}
