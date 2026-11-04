import { error, isAuthContext, json, requireBearerAuth } from "@/lib/api/auth";
import { recordAudit, scalarDiff } from "@/lib/audit";
import type { TripStatus } from "@/lib/database.types";
import { brokerDisclosureTextFromSnapshot } from "@/lib/disclosures";
import { haversineNm } from "@/lib/geo";
import { createInvoiceForBooking } from "@/lib/invoices/create";
import { logError } from "@/lib/log";
import { enqueueNotification } from "@/lib/notifications/enqueue";
import { DEFAULT_DEPOSIT_PERCENT } from "@/lib/payments/deposit";
import { pricedBlockMinutes } from "@/lib/pricing";
import { loadTripPayload } from "@/lib/trips/load";
import { nextStatusOnCustomerAccept } from "@/lib/trips/state";

const UNIQUE_VIOLATION = "23505";

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
  // The expire-quotes job runs every five minutes. Reject in the gap so a
  // stale pending row cannot become a booking.
  if (quote.valid_until && new Date(quote.valid_until).getTime() < Date.now()) {
    return error("quote_expired", 409);
  }

  const { data: operator } = await auth.supabase
    .from("operators")
    .select("*")
    .eq("id", quote.operator_id)
    .single();

  let nextTripStatus: TripStatus;
  try {
    nextTripStatus = nextStatusOnCustomerAccept(trip.status);
  } catch (e) {
    return error(e instanceof Error ? e.message : "Invalid transition", 400);
  }

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

  // Booking first. bookings_one_live_per_trip rejects a second live booking,
  // including a concurrent accept. A failed insert leaves the quote pending
  // and the trip on quote_received.
  const { data: booking, error: bookingError } = await auth.supabase
    .from("bookings")
    .insert({
      trip_request_id: trip.id,
      quote_id: quote.id,
      status: "pending",
      operator_amount: quote.operator_amount,
      platform_fee_amount: quote.platform_fee_amount,
      taxes_amount: quote.taxes_amount,
      customer_total: quote.customer_total,
      currency: quote.currency,
      deposit_percent: DEFAULT_DEPOSIT_PERCENT,
      tax_rule_snapshot: quote.tax_rule_snapshot,
      operating_carrier_legal_name:
        (snapshot.legal_name as string) ?? operator?.legal_name ?? null,
      operating_carrier_dba: (snapshot.dba as string) ?? operator?.dba ?? null,
      certificate_number:
        (snapshot.certificate_number as string) ?? operator?.certificate_number ?? null,
      broker_role_disclosure: brokerDisclosureTextFromSnapshot(snapshot),
      fbo: trip.fbo,
      estimated_block_minutes: estimatedBlockMinutes,
    })
    .select("id")
    .single();

  if (bookingError || !booking) {
    if (isUniqueViolation(bookingError)) {
      return error("already_booked", 409);
    }
    logError("supabase_write_failed", {
      table: "bookings",
      message: bookingError?.message ?? "Booking insert failed",
    });
    return error("Booking could not be created", 500);
  }

  // Quote, then siblings, then the trip. A failure here is logged and left
  // in place: the booking row is the recoverable record.
  const { error: acceptError } = await auth.supabase
    .from("quotes")
    .update({ status: "accepted" })
    .eq("id", quote.id);
  if (acceptError) {
    logError("supabase_write_failed", { table: "quotes", message: acceptError.message });
  }

  const { error: declineError } = await auth.supabase
    .from("quotes")
    .update({ status: "declined" })
    .eq("trip_request_id", trip.id)
    .eq("status", "pending")
    .neq("id", quote.id);
  if (declineError) {
    logError("supabase_write_failed", { table: "quotes", message: declineError.message });
  }

  const { error: tripError } = await auth.supabase
    .from("trip_requests")
    .update({ status: nextTripStatus })
    .eq("id", trip.id);
  if (tripError) {
    logError("supabase_write_failed", { table: "trip_requests", message: tripError.message });
  }

  await recordAudit(auth.supabase, {
    actorRole: "customer",
    actorProfileId: auth.userId,
    action: "quote.accept",
    entityType: "trip_request",
    entityId: trip.id,
    summary: "Customer accepted a quote",
    diff: scalarDiff(
      { status: trip.status },
      {
        status: nextTripStatus,
        quote_id: quote.id,
        booking_id: booking.id,
        operator_id: quote.operator_id,
        customer_total: Number(quote.customer_total),
      },
    ),
  });

  if (!acceptError && !declineError && !tripError) {
    enqueueNotification("quote_accepted", {
      tripId: trip.id,
      quoteId: quote.id,
      operatorId: quote.operator_id,
    });
  }

  // Invoice failure leaves the booking and the awaiting_payment trip. Admin
  // retries with adminCreateTripInvoice, which calls createInvoiceForBooking.
  const invoice = await createInvoiceForBooking(auth.supabase, booking.id);
  if (invoice.ok) {
    await recordAudit(auth.supabase, {
      actorRole: "system",
      actorProfileId: null,
      action: "invoice.create",
      entityType: "trip_request",
      entityId: trip.id,
      summary: `Created invoice ${invoice.number}`,
      diff: scalarDiff(null, { invoice_id: invoice.invoiceId, number: invoice.number, status: "issued" }),
    });
  }
  const serialized = await loadTripPayload(auth.supabase, trip.id);
  if (!serialized) return error("Trip not found", 404);
  if (!invoice.ok) {
    logError("invoice_create_failed", {
      table: "invoices",
      message: invoice.message,
      booking_id: booking.id,
    });
    return json({ ...serialized, invoice: null });
  }

  return json(serialized);
}

function isUniqueViolation(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return err.code === UNIQUE_VIOLATION || (err.message ?? "").includes("bookings_one_live_per_trip");
}
