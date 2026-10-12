import { error, isAuthContext, json, requireBearerAuth } from "@/lib/api/auth";
import { brokerDisclosureTextFromSnapshot } from "@/lib/disclosures";
import { haversineNm } from "@/lib/geo";
import { logError } from "@/lib/log";
import { enqueueNotification } from "@/lib/notifications/enqueue";
import { pricedBlockMinutes } from "@/lib/pricing";
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
  // Fan-out can leave several pending quotes. Accepting one declines the rest
  // and the insert below is the only booking.
  await auth.supabase
    .from("quotes")
    .update({ status: "declined" })
    .eq("trip_request_id", trip.id)
    .eq("status", "pending")
    .neq("id", quote.id);

  const snapshot = (quote.carrier_disclosure_snapshot ?? {}) as Record<string, unknown>;

  const [{ data: aircraft }, { data: origin }, { data: destination }] = await Promise.all([
    auth.supabase
      .from("aircraft")
      .select("model_id, home_base_id")
      .eq("id", quote.aircraft_id)
      .maybeSingle(),
    auth.supabase.from("airports").select("id, latitude, longitude").eq("id", trip.origin_id).maybeSingle(),
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
      const liveNm = haversineNm(
        origin.latitude,
        origin.longitude,
        destination.latitude,
        destination.longitude,
      );
      let repositionNm = 0;
      if (aircraft.home_base_id && aircraft.home_base_id !== origin.id) {
        const { data: homeBase } = await auth.supabase
          .from("airports")
          .select("latitude, longitude")
          .eq("id", aircraft.home_base_id)
          .maybeSingle();
        if (homeBase) {
          repositionNm = haversineNm(
            homeBase.latitude,
            homeBase.longitude,
            origin.latitude,
            origin.longitude,
          );
        }
      }
      // Same legs and the same legBlockMinutes clock as computeOperatorAmount.
      estimatedBlockMinutes = pricedBlockMinutes(
        {
          repositionNm,
          liveNm,
          returnNm: trip.return_at ? liveNm : 0,
        },
        model.cruise_speed_ktas,
      );
    }
  }

  const { error: bookingError } = await auth.supabase.from("bookings").insert({
    trip_request_id: trip.id,
    quote_id: quote.id,
    status: "pending",
    operator_amount: quote.operator_amount,
    platform_fee_amount: quote.platform_fee_amount,
    taxes_amount: quote.taxes_amount,
    customer_total: quote.customer_total,
    currency: quote.currency,
    tax_rule_snapshot: quote.tax_rule_snapshot,
    operating_carrier_legal_name:
      (snapshot.legal_name as string) ?? operator?.legal_name ?? null,
    operating_carrier_dba: (snapshot.dba as string) ?? operator?.dba ?? null,
    certificate_number:
      (snapshot.certificate_number as string) ?? operator?.certificate_number ?? null,
    broker_role_disclosure: brokerDisclosureTextFromSnapshot(snapshot),
    fbo: trip.fbo,
    estimated_block_minutes: estimatedBlockMinutes,
  });

  const { error: tripError } = await auth.supabase
    .from("trip_requests")
    .update({ status: "awaiting_payment" })
    .eq("id", trip.id);

  if (bookingError) {
    logError("supabase_write_failed", { table: "bookings", message: bookingError.message });
  } else if (tripError) {
    logError("supabase_write_failed", { table: "trip_requests", message: tripError.message });
  } else {
    enqueueNotification("quote_accepted", {
      tripId: trip.id,
      quoteId: quote.id,
      operatorId: quote.operator_id,
    });
  }

  const serialized = await loadTripPayload(auth.supabase, trip.id);
  return json(serialized);
}
