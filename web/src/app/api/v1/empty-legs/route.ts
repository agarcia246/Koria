import { error, isAuthContext, json, requireBearerAuth } from "@/lib/api/auth";
import { serializeAirport, serializeListing } from "@/lib/api/serialize";

export async function GET(request: Request) {
  const auth = await requireBearerAuth(request, { requireApprovedCustomer: true });
  if (!isAuthContext(auth)) return auth;

  const { data: legs, error: dbError } = await auth.supabase
    .from("empty_legs")
    .select("*")
    .eq("status", "published")
    .order("depart_at", { ascending: true });

  if (dbError) return error(dbError.message, 500);
  if (!legs?.length) return json([]);

  const aircraftIds = Array.from(new Set(legs.map((l) => l.aircraft_id)));
  const airportIds = Array.from(
    new Set(legs.flatMap((l) => [l.origin_id, l.destination_id])),
  );

  const [{ data: aircraft }, { data: airports }, { data: photos }] = await Promise.all([
    auth.supabase.from("aircraft").select("*").in("id", aircraftIds),
    auth.supabase.from("airports").select("*").in("id", airportIds),
    auth.supabase.from("aircraft_photos").select("*").in("aircraft_id", aircraftIds),
  ]);

  const aircraftMap = new Map((aircraft ?? []).map((a) => [a.id, a]));
  const airportMap = new Map((airports ?? []).map((a) => [a.id, a]));
  const photosByAc = new Map<string, typeof photos>();
  for (const p of photos ?? []) {
    const list = photosByAc.get(p.aircraft_id) ?? [];
    list!.push(p);
    photosByAc.set(p.aircraft_id, list);
  }

  const modelIds = Array.from(new Set((aircraft ?? []).map((a) => a.model_id)));
  const operatorIds = Array.from(new Set((aircraft ?? []).map((a) => a.operator_id)));
  const [{ data: models }, { data: operators }] = await Promise.all([
    auth.supabase.from("aircraft_models").select("*").in("id", modelIds),
    auth.supabase.from("operators").select("*").in("id", operatorIds),
  ]);
  const modelMap = new Map((models ?? []).map((m) => [m.id, m]));
  const operatorMap = new Map((operators ?? []).map((o) => [o.id, o]));

  const payload = [];
  for (const leg of legs) {
    const ac = aircraftMap.get(leg.aircraft_id);
    const origin = airportMap.get(leg.origin_id);
    const destination = airportMap.get(leg.destination_id);
    if (!ac || !origin || !destination) continue;
    const model = modelMap.get(ac.model_id);
    const operator = operatorMap.get(ac.operator_id);
    if (!model || !operator) continue;

    payload.push({
      id: leg.id,
      listing: serializeListing({
        aircraft: ac,
        model,
        operator,
        photos: photosByAc.get(ac.id) ?? [],
      }),
      origin: serializeAirport(origin),
      destination: serializeAirport(destination),
      departure_date: leg.depart_at,
      seats_available: leg.seats_available,
      whole_aircraft: leg.whole_aircraft,
      price:
        leg.price == null
          ? null
          : { mode: leg.pricing_mode, amount: { amount: Number(leg.price), currency: "USD" } },
      notes: leg.notes,
    });
  }

  return json(payload);
}
