import { error, isAuthContext, json, requireBearerAuth } from "@/lib/api/auth";
import { BROKER_DISCLOSURE } from "@/lib/disclosures";
import { haversineNm } from "@/lib/geo";
import { estimateBlockMinutes } from "@/lib/pricing";
import { loadTripPayload } from "@/lib/trips/load";
import { nextStatusOnCustomerAccept } from "@/lib/trips/state";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireBearerAuth(request, { requireApprovedCustomer: true });
  if (!isAuthContext(auth)) return auth;

  const { id } = await context.params;
  const { data: quote } = await auth.supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!quote) return error("Quote not found", 404);
  if (quote.status !== "pending") return error("Quote is not pending", 400);

  const { data: trip } = await auth.supabase
    .from("trip_requests")
    .select("*")
    .eq("id", quote.trip_request_id)
    .eq("customer_id", auth.userId)
    .maybeSingle();
  if (!trip) return error("Trip not found", 404);

  const { data: operator } = await auth.supabase
    .from("operators")
    .select("*")
    .eq("id", quote.operator_id)
    .single();

  try {
    nextStatusOnCustomerAccept(trip.status);
  } catch (e) {
    return error(e instanceof Error ? e.message : "Invalid transition", 400);
  }

  await auth.supabase.from("quotes").update({ status: "accepted" }).eq("id", quote.id);
  await auth.supabase
    .from("quotes")
    .update({ status: "declined" })
    .eq("trip_request_id", trip.id)
    .eq("status", "pending")
    .neq("id", quote.id);

  const snapshot = (quote.carrier_disclosure_snapshot ?? {}) as Record<string, unknown>;

  const [{ data: aircraft }, { data: origin }, { data: destination }] = await Promise.all([
    auth.supabase.from("aircraft").select("model_id").eq("id", quote.aircraft_id).maybeSingle(),
    auth.supabase.from("airports").select("latitude, longitude").eq("id", trip.origin_id).maybeSingle(),
    auth.supabase
      .from("airports")
      .select("latitude, longitude")
      .eq("id", trip.destination_id)
      .maybeSingle(),
  ]);
  let estimatedBlockMinutes: number | null = null;
  if (aircraft && origin && destination) {
    const { data: model } = await auth.supabase
      .from("aircraft_models")
      .select("cruise_speed_ktas")
      .eq("id", aircraft.model_id)
      .maybeSingle();
    if (model) {
      const distanceNm = haversineNm(
        origin.latitude,
        origin.longitude,
        destination.latitude,
        destination.longitude,
      );
      // Same airborne estimate pricing uses (distance / cruise speed). There is
      // no filed block time on the aircraft.
      estimatedBlockMinutes = estimateBlockMinutes(distanceNm, model.cruise_speed_ktas);
    }
  }

  await auth.supabase.from("bookings").insert({
    trip_request_id: trip.id,
    quote_id: quote.id,
    status: "pending",
    operator_amount: quote.operator_amount,
    platform_fee_amount: quote.platform_fee_amount,
    taxes_amount: quote.taxes_amount,
    customer_total: quote.customer_total,
    currency: quote.currency,
    operating_carrier_legal_name:
      (snapshot.legal_name as string) ?? operator?.legal_name ?? null,
    operating_carrier_dba: (snapshot.dba as string) ?? operator?.dba ?? null,
    certificate_number:
      (snapshot.certificate_number as string) ?? operator?.certificate_number ?? null,
    broker_role_disclosure: BROKER_DISCLOSURE,
    fbo: trip.fbo,
    estimated_block_minutes: estimatedBlockMinutes,
  });

  await auth.supabase
    .from("trip_requests")
    .update({ status: "awaiting_payment" })
    .eq("id", trip.id);

  const serialized = await loadTripPayload(auth.supabase, trip.id);
  return json(serialized);
}
