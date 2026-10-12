import { recordAudit, scalarDiff } from "@/lib/audit";
import { error, json } from "@/lib/api/auth";
import { isOperatorKey, requireOperatorApiKey } from "@/lib/api/operator-key";
import { airportIdByIcao, ownAircraftByTail, pricingMode } from "@/lib/operator-api/scope";
import { logError } from "@/lib/log";
import type { EmptyLegStatus } from "@/lib/database.types";

function legStatus(value: unknown): EmptyLegStatus {
  if (value === "withdrawn" || value === "booked" || value === "published") return value;
  return "published";
}

export async function GET(request: Request) {
  const auth = await requireOperatorApiKey(request);
  if (!isOperatorKey(auth)) return auth;

  const { data, error: dbError } = await auth.supabase
    .from("empty_legs")
    .select("id, aircraft_id, origin_id, destination_id, depart_at, seats_available, price, pricing_mode, status, notes, whole_aircraft")
    .eq("operator_id", auth.operatorId)
    .order("depart_at", { ascending: false });
  if (dbError) return error(dbError.message, 500);
  return json(data ?? []);
}

export async function PUT(request: Request) {
  const requestId = crypto.randomUUID();
  const auth = await requireOperatorApiKey(request);
  if (!isOperatorKey(auth)) return auth;

  let body: { legs?: unknown };
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON");
  }
  if (!Array.isArray(body.legs)) return error("legs is required");

  const ids: string[] = [];
  for (const leg of body.legs) {
    if (!leg || typeof leg !== "object") return error("Each leg must be an object");
    const item = leg as Record<string, unknown>;
    const owned = await ownAircraftByTail(auth.supabase, auth.operatorId, String(item.tail_number ?? ""));
    if (owned.error) return error(owned.error, 500);
    if (!owned.aircraft) return error("Aircraft not on this operator", 404);

    const originId = await airportIdByIcao(auth.supabase, String(item.origin_icao ?? ""));
    const destinationId = await airportIdByIcao(auth.supabase, String(item.destination_icao ?? ""));
    const depart = new Date(String(item.depart_at ?? ""));
    if (!originId || !destinationId || Number.isNaN(depart.getTime())) {
      return error("Each leg needs origin_icao, destination_icao, and depart_at");
    }

    const payload = {
      operator_id: auth.operatorId,
      aircraft_id: owned.aircraft.id,
      origin_id: originId,
      destination_id: destinationId,
      depart_at: depart.toISOString(),
      seats_available: item.seats_available == null ? null : Number(item.seats_available),
      price: item.price == null ? null : Number(item.price),
      pricing_mode: pricingMode(item.pricing_mode, "estimated"),
      status: legStatus(item.status),
      notes: typeof item.notes === "string" ? item.notes : null,
      whole_aircraft: item.whole_aircraft == null ? true : Boolean(item.whole_aircraft),
    };

    if (typeof item.id === "string" && item.id) {
      const { data: before } = await auth.supabase
        .from("empty_legs")
        .select(
          "aircraft_id, origin_id, destination_id, depart_at, seats_available, price, pricing_mode, status, whole_aircraft, notes",
        )
        .eq("id", item.id)
        .eq("operator_id", auth.operatorId)
        .maybeSingle();
      const { data, error: updateError } = await auth.supabase
        .from("empty_legs")
        .update(payload)
        .eq("id", item.id)
        .eq("operator_id", auth.operatorId)
        .select("id");
      if (updateError) {
        logError("supabase_write_failed", {
          table: "empty_legs",
          message: updateError.message,
          request_id: requestId,
        });
        return error(updateError.message, 500);
      }
      if (!data?.length) return error("Empty leg not on this operator", 404);
      ids.push(data[0].id);
      await recordAudit(auth.supabase, {
        action: "empty_leg.update",
        entityType: "empty_leg",
        entityId: data[0].id,
        summary: `Updated empty leg via operator API`,
        diff: scalarDiff(before, {
          aircraft_id: payload.aircraft_id,
          origin_id: payload.origin_id,
          destination_id: payload.destination_id,
          depart_at: payload.depart_at,
          seats_available: payload.seats_available,
          price: payload.price,
          pricing_mode: payload.pricing_mode,
          status: payload.status,
          whole_aircraft: payload.whole_aircraft,
          notes: payload.notes,
        }),
        requestId,
        actorRole: "operator",
      });
    } else {
      const { data, error: insertError } = await auth.supabase
        .from("empty_legs")
        .insert(payload)
        .select("id")
        .single();
      if (insertError || !data) {
        logError("supabase_write_failed", {
          table: "empty_legs",
          message: insertError?.message ?? "insert failed",
          request_id: requestId,
        });
        return error(insertError?.message ?? "insert failed", 500);
      }
      ids.push(data.id);
      await recordAudit(auth.supabase, {
        action: "empty_leg.create",
        entityType: "empty_leg",
        entityId: data.id,
        summary: "Created empty leg via operator API",
        diff: scalarDiff(null, {
          aircraft_id: payload.aircraft_id,
          origin_id: payload.origin_id,
          destination_id: payload.destination_id,
          depart_at: payload.depart_at,
          seats_available: payload.seats_available,
          price: payload.price,
          pricing_mode: payload.pricing_mode,
          status: payload.status,
          whole_aircraft: payload.whole_aircraft,
          notes: payload.notes,
        }),
        requestId,
        actorRole: "operator",
      });
    }
  }

  return json({ ids });
}
