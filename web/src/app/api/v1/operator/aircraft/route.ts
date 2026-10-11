import { error, json } from "@/lib/api/auth";
import { isOperatorKey, requireOperatorApiKey } from "@/lib/api/operator-key";
import { airportIdByIcao, pricingMode } from "@/lib/operator-api/scope";
import { logError } from "@/lib/log";

export async function GET(request: Request) {
  const auth = await requireOperatorApiKey(request);
  if (!isOperatorKey(auth)) return auth;

  const { data, error: dbError } = await auth.supabase
    .from("aircraft")
    .select("id, tail_number, model_id, seating, year, wifi, lavatory, pets, golf, skis, baggage_cu_ft, home_base_id, is_active, pricing_mode_default")
    .eq("operator_id", auth.operatorId)
    .order("tail_number");
  if (dbError) return error(dbError.message, 500);
  return json(data ?? []);
}

export async function PUT(request: Request) {
  const auth = await requireOperatorApiKey(request);
  if (!isOperatorKey(auth)) return auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON");
  }

  const tail = String(body.tail_number ?? "").trim().toUpperCase();
  const modelId = String(body.model_id ?? "");
  const seating = Number(body.seating);
  if (!tail || !modelId || !Number.isFinite(seating)) {
    return error("tail_number, model_id, and seating are required");
  }

  const { data: model } = await auth.supabase.from("aircraft_models").select("id").eq("id", modelId).maybeSingle();
  if (!model) return error("Unknown model_id", 400);

  const homeBaseId = await airportIdByIcao(
    auth.supabase,
    typeof body.home_base_icao === "string" ? body.home_base_icao : null,
  );
  if (typeof body.home_base_icao === "string" && body.home_base_icao.trim() && !homeBaseId) {
    return error("Unknown home_base_icao", 400);
  }

  const payload = {
    operator_id: auth.operatorId,
    tail_number: tail,
    model_id: modelId,
    seating,
    ...(body.year !== undefined
      ? { year: body.year == null || body.year === "" ? null : Number(body.year) }
      : {}),
    ...(body.wifi !== undefined ? { wifi: Boolean(body.wifi) } : {}),
    ...(body.lavatory !== undefined ? { lavatory: Boolean(body.lavatory) } : {}),
    ...(body.pets !== undefined ? { pets: Boolean(body.pets) } : {}),
    ...(body.golf !== undefined ? { golf: Boolean(body.golf) } : {}),
    ...(body.skis !== undefined ? { skis: Boolean(body.skis) } : {}),
    ...(body.baggage_cu_ft !== undefined
      ? { baggage_cu_ft: body.baggage_cu_ft == null || body.baggage_cu_ft === "" ? null : Number(body.baggage_cu_ft) }
      : {}),
    ...(body.home_base_icao !== undefined ? { home_base_id: homeBaseId } : {}),
    ...(body.is_active !== undefined ? { is_active: Boolean(body.is_active) } : {}),
    ...(body.pricing_mode_default !== undefined
      ? { pricing_mode_default: pricingMode(body.pricing_mode_default, "quote_required") }
      : {}),
    ...(body.cabin_notes !== undefined
      ? { cabin_notes: typeof body.cabin_notes === "string" ? body.cabin_notes : null }
      : {}),
  };

  const { data: existing } = await auth.supabase
    .from("aircraft")
    .select("id")
    .eq("operator_id", auth.operatorId)
    .eq("tail_number", tail)
    .maybeSingle();

  const write = existing
    ? await auth.supabase
        .from("aircraft")
        .update(payload)
        .eq("id", existing.id)
        .eq("operator_id", auth.operatorId)
        .select("id, tail_number")
        .single()
    : await auth.supabase.from("aircraft").insert(payload).select("id, tail_number").single();

  if (write.error) {
    logError("supabase_write_failed", { table: "aircraft", message: write.error.message });
    return error(write.error.message, 500);
  }
  return json(write.data);
}
