import { error, isAuthContext, json, requireBearerAuth } from "@/lib/api/auth";
import { BROKER_DISCLOSURE, serializeListing } from "@/lib/api/serialize";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireBearerAuth(request, { requireApprovedCustomer: true });
  if (!isAuthContext(auth)) return auth;

  const { id } = await context.params;
  const { data: aircraft } = await auth.supabase
    .from("aircraft")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!aircraft) return error("Aircraft not found", 404);

  const [{ data: model }, { data: operator }, { data: photos }, { data: rule }] =
    await Promise.all([
      auth.supabase.from("aircraft_models").select("*").eq("id", aircraft.model_id).single(),
      auth.supabase.from("operators").select("*").eq("id", aircraft.operator_id).single(),
      auth.supabase
        .from("aircraft_photos")
        .select("*")
        .eq("aircraft_id", aircraft.id)
        .order("sort_order"),
      auth.supabase
        .from("aircraft_pricing_rules")
        .select("*")
        .eq("aircraft_id", aircraft.id)
        .maybeSingle(),
    ]);

  if (!model || !operator) return error("Aircraft relations missing", 500);

  const listing = serializeListing({
    aircraft,
    model,
    operator,
    photos: photos ?? [],
  });

  return json({
    ...listing,
    price_status: rule?.mode ?? aircraft.pricing_mode_default,
    broker_disclosure: BROKER_DISCLOSURE,
  });
}
