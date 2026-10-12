"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { requireOperatorContext } from "@/lib/portal/operator";
import { resolvePlatformFee } from "@/lib/fees";
import { computeOperatorAmount } from "@/lib/pricing";
import { computeTaxes, passengerLegs, type TaxRuleInput } from "@/lib/taxes";
import { haversineNm } from "@/lib/geo";
import { AGREEMENT_REQUIRED_MESSAGE, CURRENT_OPERATOR_AGREEMENT, operatorHasCurrentAgreement } from "@/lib/agreements";
import { brokerDisclosureFields } from "@/lib/disclosures";
import { sendEmail } from "@/lib/email";
import { enqueueNotification } from "@/lib/notifications/enqueue";
import { sendOperatorInvite } from "@/lib/operators/invite";
import { declineOperatorFanout, markFanoutQuoted } from "@/lib/trips/fanout";
import { recordCancellationRefund } from "@/lib/payments/refund";
import { money, recordWirePayment, sumPaidPayments } from "@/lib/payments/record";
import { depositIsCovered } from "@/lib/payments/deposit";
import { TRIP_STATUSES, canTransition, nextStatusOnQuoteSent } from "@/lib/trips/state";
import { confirmTripAfterPayment } from "@/lib/trips/confirm";
import { createInvoiceForBooking } from "@/lib/invoices/create";
import type { PricingMode, AvailabilityKind, TripStatus } from "@/lib/database.types";
import { parseAvailabilityFile } from "@/lib/availability/parse";
import { assertWrite } from "@/lib/portal/write";
import { recordAudit, scalarDiff } from "@/lib/audit";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

async function rejectIfActivatingWithoutAgreement(
  supabase: Awaited<ReturnType<typeof requireOperatorContext>>["supabase"],
  operatorId: string,
  activating: boolean,
  returnPath: string,
) {
  if (!activating) return;
  const agreement = await operatorHasCurrentAgreement(supabase, operatorId);
  if (!agreement.ok) {
    await assertWrite("operators", { message: agreement.message }, returnPath);
    return;
  }
  if (!agreement.current) {
    await assertWrite("aircraft", { message: AGREEMENT_REQUIRED_MESSAGE }, returnPath);
  }
}

export async function acceptOperatorAgreement() {
  const ctx = await requireOperatorContext();
  if (!ctx.operatorId) throw new Error("No operator membership");
  const { data: membership } = await ctx.supabase
    .from("operator_members")
    .select("role")
    .eq("operator_id", ctx.operatorId)
    .eq("profile_id", ctx.userId)
    .maybeSingle();
  if (membership?.role !== "admin") {
    await assertWrite(
      "operators",
      { message: "Only an operator admin can accept the agreement." },
      "/operator/agreement",
    );
  }
  const { data: before } = await ctx.supabase
    .from("operators")
    .select("agreement_version, agreement_accepted_at, agreement_accepted_by")
    .eq("id", ctx.operatorId)
    .maybeSingle();
  const acceptedAt = new Date().toISOString();
  const { error } = await ctx.supabase
    .from("operators")
    .update({
      agreement_version: CURRENT_OPERATOR_AGREEMENT.version,
      agreement_accepted_at: acceptedAt,
      agreement_accepted_by: ctx.userId,
    })
    .eq("id", ctx.operatorId);
  await assertWrite("operators", error, "/operator/agreement");
  await recordAudit(ctx.supabase, {
    action: "operator.agreement_accept",
    entityType: "operator",
    entityId: ctx.operatorId,
    summary: `Accepted operator agreement ${CURRENT_OPERATOR_AGREEMENT.version}`,
    diff: scalarDiff(before, {
      agreement_version: CURRENT_OPERATOR_AGREEMENT.version,
      agreement_accepted_at: acceptedAt,
      agreement_accepted_by: ctx.userId,
    }),
  });
  revalidatePath("/operator/agreement");
  revalidatePath("/operator/fleet");
}

function aircraftScalars(formData: FormData) {
  return {
    model_id: String(formData.get("model_id")),
    tail_number: String(formData.get("tail_number")),
    year: formData.get("year") ? Number(formData.get("year")) : null,
    seating: Number(formData.get("seating")),
    interior_configuration: String(formData.get("interior_configuration") || "") || null,
    baggage_cu_ft: formData.get("baggage_cu_ft") ? Number(formData.get("baggage_cu_ft")) : null,
    wifi: formData.get("wifi") === "on",
    lavatory: formData.get("lavatory") === "on",
    pets: formData.get("pets") === "on",
    golf: formData.get("golf") === "on",
    skis: formData.get("skis") === "on",
    cabin_notes: String(formData.get("cabin_notes") || "") || null,
    home_base_id: String(formData.get("home_base_id") || "") || null,
    is_active: formData.get("is_active") === "on",
    pricing_mode_default: (String(formData.get("pricing_mode_default") || "quote_required") as PricingMode),
  };
}

export async function createAircraft(formData: FormData) {
  const ctx = await requireOperatorContext();
  if (!ctx.operatorId) throw new Error("No operator membership");

  const activating = formData.get("is_active") === "on";
  await rejectIfActivatingWithoutAgreement(ctx.supabase, ctx.operatorId, activating, "/operator/fleet/new");

  const aircraftValues = aircraftScalars(formData);
  const { data, error } = await ctx.supabase
    .from("aircraft")
    .insert({
      operator_id: ctx.operatorId,
      ...aircraftValues,
    })
    .select("id")
    .single();

  await assertWrite("aircraft", error, "/operator/fleet/new");
  if (!data) throw new Error("Failed to create aircraft");
  await recordAudit(ctx.supabase, {
    action: "aircraft.create",
    entityType: "aircraft",
    entityId: data.id,
    summary: `Created aircraft ${aircraftValues.tail_number}`,
    diff: scalarDiff(null, { operator_id: ctx.operatorId, ...aircraftValues }),
  });
  revalidatePath("/operator/fleet");
  redirect(`/operator/fleet/${data.id}`);
}

export async function updateAircraft(aircraftId: string, formData: FormData) {
  const ctx = await requireOperatorContext();
  const returnPath = `/operator/fleet/${aircraftId}`;
  const { data: existing, error: existingError } = await ctx.supabase
    .from("aircraft")
    .select(
      "operator_id, model_id, tail_number, year, seating, interior_configuration, baggage_cu_ft, wifi, lavatory, pets, golf, skis, cabin_notes, home_base_id, is_active, pricing_mode_default",
    )
    .eq("id", aircraftId)
    .maybeSingle();
  await assertWrite("aircraft", existingError, returnPath);
  if (!existing) throw new Error("Aircraft not found");
  await rejectIfActivatingWithoutAgreement(
    ctx.supabase,
    existing.operator_id,
    formData.get("is_active") === "on",
    returnPath,
  );

  const aircraftValues = aircraftScalars(formData);
  const { error } = await ctx.supabase.from("aircraft").update(aircraftValues).eq("id", aircraftId);

  await assertWrite("aircraft", error, `/operator/fleet/${aircraftId}`);
  await recordAudit(ctx.supabase, {
    action: "aircraft.update",
    entityType: "aircraft",
    entityId: aircraftId,
    summary: `Updated aircraft ${aircraftValues.tail_number}`,
    diff: scalarDiff(existing, aircraftValues),
  });
  revalidatePath(`/operator/fleet/${aircraftId}`);
  revalidatePath("/operator/fleet");
}

export async function uploadAircraftPhoto(aircraftId: string, formData: FormData) {
  const ctx = await requireOperatorContext();
  const file = formData.get("photo") as File | null;
  if (!file || !file.size) throw new Error("No file");

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${aircraftId}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await ctx.supabase.storage
    .from("aircraft-photos")
    .upload(path, buffer, { contentType: file.type, upsert: false });
  await assertWrite("aircraft-photos", uploadError, `/operator/fleet/${aircraftId}`);

  const { error: photoError } = await ctx.supabase.from("aircraft_photos").insert({
    aircraft_id: aircraftId,
    storage_path: path,
    sort_order: Number(formData.get("sort_order") || 0),
  });
  await assertWrite("aircraft_photos", photoError, `/operator/fleet/${aircraftId}`);

  revalidatePath(`/operator/fleet/${aircraftId}`);
}

export async function upsertPricing(aircraftId: string, formData: FormData) {
  const ctx = await requireOperatorContext();
  const payload = {
    aircraft_id: aircraftId,
    hourly_rate: formData.get("hourly_rate") ? Number(formData.get("hourly_rate")) : null,
    minimum: formData.get("minimum") ? Number(formData.get("minimum")) : null,
    per_nm: formData.get("per_nm") ? Number(formData.get("per_nm")) : null,
    positioning_fee: formData.get("positioning_fee")
      ? Number(formData.get("positioning_fee"))
      : null,
    mode: String(formData.get("mode") || "quote_required") as PricingMode,
  };

  const { data: existing } = await ctx.supabase
    .from("aircraft_pricing_rules")
    .select("id")
    .eq("aircraft_id", aircraftId)
    .maybeSingle();

  const { error } = existing
    ? await ctx.supabase.from("aircraft_pricing_rules").update(payload).eq("id", existing.id)
    : await ctx.supabase.from("aircraft_pricing_rules").insert(payload);
  await assertWrite("aircraft_pricing_rules", error, `/operator/fleet/${aircraftId}/pricing`);

  revalidatePath(`/operator/fleet/${aircraftId}/pricing`);
}

async function requireOperatorAdmin() {
  const ctx = await requireOperatorContext();
  if (!ctx.operatorId) throw new Error("No operator");
  if (ctx.isAdmin) return ctx;
  const { data: membership } = await ctx.supabase
    .from("operator_members")
    .select("role")
    .eq("operator_id", ctx.operatorId)
    .eq("profile_id", ctx.userId)
    .maybeSingle();
  if (membership?.role !== "admin") {
    await assertWrite("operator_api_keys", { message: "Only an operator admin can manage API keys." }, "/operator/api-keys");
  }
  return ctx;
}

export async function dismissOperatorApiKey() {
  const jar = await cookies();
  jar.delete("operator_api_key");
  redirect("/operator/api-keys");
}

/** Shows the plaintext once, in a short-lived httpOnly cookie. The database stores the hash. */
export async function createOperatorApiKey() {
  const ctx = await requireOperatorAdmin();
  if (!ctx.operatorId) return;
  const plaintext = `koria_${randomBytes(32).toString("base64url")}`;
  const { error } = await ctx.supabase.from("operator_api_keys").insert({
    operator_id: ctx.operatorId,
    key_hash: createHash("sha256").update(plaintext).digest("hex"),
    key_prefix: plaintext.slice(0, 12),
    created_by: ctx.userId,
  });
  await assertWrite("operator_api_keys", error, "/operator/api-keys");
  const jar = await cookies();
  jar.set("operator_api_key", plaintext, {
    httpOnly: true,
    path: "/operator/api-keys",
    maxAge: 60,
    sameSite: "lax",
  });
  revalidatePath("/operator/api-keys");
  redirect("/operator/api-keys");
}

export async function revokeOperatorApiKey(formData: FormData) {
  const ctx = await requireOperatorAdmin();
  if (!ctx.operatorId) return;
  const id = String(formData.get("id") || "");
  const { error } = await ctx.supabase
    .from("operator_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("operator_id", ctx.operatorId)
    .is("revoked_at", null);
  await assertWrite("operator_api_keys", error, "/operator/api-keys");
  revalidatePath("/operator/api-keys");
}

export async function createAvailability(formData: FormData) {
  const ctx = await requireOperatorContext();
  const { error } = await ctx.supabase.from("aircraft_availability").insert({
    aircraft_id: String(formData.get("aircraft_id")),
    starts_at: String(formData.get("starts_at")),
    ends_at: String(formData.get("ends_at")),
    kind: String(formData.get("kind") || "blocked") as AvailabilityKind,
    based_at_id: String(formData.get("based_at_id") || "") || null,
    notes: String(formData.get("notes") || "") || null,
    source: "manual",
  });
  await assertWrite("aircraft_availability", error, "/operator/availability");
  revalidatePath("/operator/availability");
}

/**
 * iCal VEVENTs are blocked windows. CSV rows use the kind column (default blocked).
 * Replaces this aircraft's source = import rows only. Manual and api rows stay.
 */
export async function importAvailability(formData: FormData) {
  const ctx = await requireOperatorContext();
  if (!ctx.operatorId) throw new Error("No operator");
  const aircraftId = String(formData.get("aircraft_id") || "");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    await assertWrite("aircraft_availability", { message: "Choose an iCal or CSV file." }, "/operator/availability");
    return;
  }
  if (file.size > 1_000_000) {
    await assertWrite("aircraft_availability", { message: "File must be 1 MB or smaller." }, "/operator/availability");
    return;
  }

  const { data: aircraft } = await ctx.supabase
    .from("aircraft")
    .select("id")
    .eq("id", aircraftId)
    .eq("operator_id", ctx.operatorId)
    .maybeSingle();
  if (!aircraft) {
    await assertWrite("aircraft_availability", { message: "Aircraft not on this operator." }, "/operator/availability");
    return;
  }

  const parsed = parseAvailabilityFile(file.name, await file.text());
  if (parsed.errors.length) {
    await assertWrite("aircraft_availability", { message: parsed.errors[0] }, "/operator/availability");
    return;
  }

  const batchId = crypto.randomUUID();
  const { error: deleteError } = await ctx.supabase
    .from("aircraft_availability")
    .delete()
    .eq("aircraft_id", aircraftId)
    .eq("source", "import");
  await assertWrite("aircraft_availability", deleteError, "/operator/availability");

  if (parsed.rows.length) {
    const { error } = await ctx.supabase.from("aircraft_availability").insert(
      parsed.rows.map((row) => ({
        aircraft_id: aircraftId,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        kind: row.kind,
        notes: row.notes,
        source: "import" as const,
        import_batch_id: batchId,
      })),
    );
    await assertWrite("aircraft_availability", error, "/operator/availability");
  }
  revalidatePath("/operator/availability");
}

export async function createEmptyLeg(formData: FormData) {
  const ctx = await requireOperatorContext();
  if (!ctx.operatorId) throw new Error("No operator");

  const { error } = await ctx.supabase.from("empty_legs").insert({
    operator_id: ctx.operatorId,
    aircraft_id: String(formData.get("aircraft_id")),
    origin_id: String(formData.get("origin_id")),
    destination_id: String(formData.get("destination_id")),
    depart_at: String(formData.get("depart_at")),
    seats_available: formData.get("seats_available")
      ? Number(formData.get("seats_available"))
      : null,
    whole_aircraft: formData.get("whole_aircraft") === "on",
    price: formData.get("price") ? Number(formData.get("price")) : null,
    pricing_mode: String(formData.get("pricing_mode") || "estimated") as PricingMode,
    notes: String(formData.get("notes") || "") || null,
    status: "published",
  });
  await assertWrite("empty_legs", error, "/operator/empty-legs");
  revalidatePath("/operator/empty-legs");
}

export async function updateEmptyLeg(id: string, formData: FormData) {
  const ctx = await requireOperatorContext();
  const { error } = await ctx.supabase
    .from("empty_legs")
    .update({
      aircraft_id: String(formData.get("aircraft_id")),
      origin_id: String(formData.get("origin_id")),
      destination_id: String(formData.get("destination_id")),
      depart_at: String(formData.get("depart_at")),
      seats_available: formData.get("seats_available")
        ? Number(formData.get("seats_available"))
        : null,
      whole_aircraft: formData.get("whole_aircraft") === "on",
      price: formData.get("price") ? Number(formData.get("price")) : null,
      pricing_mode: String(formData.get("pricing_mode") || "estimated") as PricingMode,
      notes: String(formData.get("notes") || "") || null,
    })
    .eq("id", id);
  await assertWrite("empty_legs", error, "/operator/empty-legs");
  revalidatePath("/operator/empty-legs");
}

export async function withdrawEmptyLeg(id: string) {
  const ctx = await requireOperatorContext();
  const { error } = await ctx.supabase.from("empty_legs").update({ status: "withdrawn" }).eq("id", id);
  await assertWrite("empty_legs", error, "/operator/empty-legs");
  revalidatePath("/operator/empty-legs");
}

async function carrierSnapshot(supabase: Awaited<ReturnType<typeof requireOperatorContext>>["supabase"], operatorId: string) {
  const { data: op } = await supabase.from("operators").select("*").eq("id", operatorId).single();
  return {
    legal_name: op?.legal_name,
    dba: op?.dba,
    certificate_number: op?.certificate_number,
    certificate_type: op?.certificate_type,
    operational_control_disclosure: op?.operational_control_disclosure,
    ...brokerDisclosureFields(),
  };
}

async function taxesForQuote(
  supabase: Awaited<ReturnType<typeof requireOperatorContext>>["supabase"],
  args: {
    originCountry: string;
    destinationCountry: string;
    originRegion: string | null;
    destinationRegion: string | null;
    returnAt: string | null;
    passengers: number;
    operatorAmount: number;
    platformFee: number;
    departAt: string;
    returnPath: string;
  },
) {
  const { data, error } = await supabase.from("tax_rules").select("*");
  await assertWrite("tax_rules", error, args.returnPath);
  const rules: TaxRuleInput[] = (data ?? []).map((rule) => ({
    id: rule.id,
    kind: rule.kind,
    basis: rule.basis,
    rate: rule.rate,
    amount: rule.amount,
    currency: rule.currency,
    effective_from: rule.effective_from,
    effective_to: rule.effective_to,
    source_url: rule.source_url,
  }));
  return computeTaxes({
    legs: passengerLegs({
      originCountry: args.originCountry,
      destinationCountry: args.destinationCountry,
      originRegion: args.originRegion,
      destinationRegion: args.destinationRegion,
      returnAt: args.returnAt,
    }),
    passengers: args.passengers,
    operatorAmount: args.operatorAmount,
    platformFee: args.platformFee,
    departAt: args.departAt,
    rules,
  });
}

export async function acceptPrice(tripId: string) {
  const ctx = await requireOperatorContext();
  if (!ctx.operatorId) throw new Error("No operator");

  const { data: trip } = await ctx.supabase
    .from("trip_requests")
    .select("*")
    .eq("id", tripId)
    .single();
  if (!trip?.aircraft_id) throw new Error("Trip has no aircraft");

  const [{ data: aircraft }, { data: origin }, { data: destination }, { data: rule }] =
    await Promise.all([
      ctx.supabase.from("aircraft").select("*").eq("id", trip.aircraft_id).single(),
      ctx.supabase.from("airports").select("*").eq("id", trip.origin_id).single(),
      ctx.supabase.from("airports").select("*").eq("id", trip.destination_id).single(),
      ctx.supabase
        .from("aircraft_pricing_rules")
        .select("*")
        .eq("aircraft_id", trip.aircraft_id)
        .maybeSingle(),
    ]);

  if (!aircraft || !origin || !destination) throw new Error("Missing trip data");
  const { data: model } = await ctx.supabase
    .from("aircraft_models")
    .select("*")
    .eq("id", aircraft.model_id)
    .single();
  if (!model) throw new Error("Missing model");

  const distanceNm = haversineNm(
    origin.latitude,
    origin.longitude,
    destination.latitude,
    destination.longitude,
  );
  let repositionNm = 0;
  if (aircraft.home_base_id && aircraft.home_base_id !== origin.id) {
    const { data: homeBase } = await ctx.supabase
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
  const priced = computeOperatorAmount({
    rule,
    cruiseSpeedKtas: model.cruise_speed_ktas,
    repositionNm,
    liveNm: distanceNm,
    returnNm: trip.return_at ? distanceNm : 0,
  });
  if (priced.amount == null) throw new Error("No live/estimated price available");

  const fee = await resolvePlatformFee(ctx.supabase, {
    operatorAmount: priced.amount,
    operatorId: ctx.operatorId,
  });
  const pricedTaxes = await taxesForQuote(ctx.supabase, {
    originCountry: origin.country,
    destinationCountry: destination.country,
    originRegion: origin.region,
    destinationRegion: destination.region,
    returnAt: trip.return_at,
    passengers: trip.passengers,
    operatorAmount: priced.amount,
    platformFee: fee.platformFeeAmount,
    departAt: trip.depart_at,
    returnPath: `/operator/requests/${tripId}`,
  });
  const taxes = pricedTaxes.taxesAmount;
  const customerTotal = priced.amount + fee.platformFeeAmount + taxes;
  const snapshot = await carrierSnapshot(ctx.supabase, ctx.operatorId);

  const { data: quote, error: quoteError } = await ctx.supabase.from("quotes").insert({
    trip_request_id: tripId,
    operator_id: ctx.operatorId,
    aircraft_id: aircraft.id,
    operator_amount: priced.amount,
    platform_fee_amount: fee.platformFeeAmount,
    taxes_amount: taxes,
    customer_total: customerTotal,
    currency: "USD",
    valid_until: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    notes: "Accepted published price",
    status: "pending",
    pricing_mode: priced.mode,
    carrier_disclosure_snapshot: snapshot,
    tax_rule_snapshot: pricedTaxes.ruleSnapshot,
  })
    .select("id")
    .single();
  await assertWrite("quotes", quoteError, `/operator/requests/${tripId}`);
  if (quote?.id) {
    await recordAudit(ctx.supabase, {
      action: "quote.accept_price",
      entityType: "trip_request",
      entityId: tripId,
      summary: `Accepted published price on ${aircraft.tail_number}`,
      diff: scalarDiff(null, {
        quote_id: quote.id,
        aircraft_id: aircraft.id,
        operator_amount: priced.amount,
        customer_total: customerTotal,
        status: "pending",
      }),
    });
  }

  const { error: fanoutError } = await markFanoutQuoted(ctx.supabase, tripId, ctx.operatorId);
  await assertWrite("trip_request_operators", fanoutError, `/operator/requests/${tripId}`);

  const next = nextStatusOnQuoteSent(trip.status);
  if (next !== trip.status) {
    const { error: statusError } = await ctx.supabase
      .from("trip_requests")
      .update({ status: next })
      .eq("id", tripId);
    await assertWrite("trip_requests", statusError, `/operator/requests/${tripId}`);
  }

  if (quote?.id) {
    enqueueNotification("quote_sent", { tripId, quoteId: quote.id });
  }
  revalidatePath(`/operator/requests/${tripId}`);
  revalidatePath("/operator/requests");
}

export async function sendQuote(tripId: string, formData: FormData) {
  const ctx = await requireOperatorContext();
  if (!ctx.operatorId) throw new Error("No operator");

  const { data: trip } = await ctx.supabase
    .from("trip_requests")
    .select("*")
    .eq("id", tripId)
    .single();
  if (!trip) throw new Error("Trip not found");

  const aircraftId = String(formData.get("aircraft_id") || trip.aircraft_id || "");
  if (!aircraftId) throw new Error("Aircraft required");

  const operatorAmount = Number(formData.get("operator_amount"));
  const parentQuoteId = String(formData.get("parent_quote_id") || "") || null;
  const isCounter = Boolean(parentQuoteId);

  const [{ data: origin }, { data: destination }] = await Promise.all([
    ctx.supabase.from("airports").select("country, region").eq("id", trip.origin_id).maybeSingle(),
    ctx.supabase.from("airports").select("country, region").eq("id", trip.destination_id).maybeSingle(),
  ]);
  if (!origin || !destination) throw new Error("Missing airports");

  const fee = await resolvePlatformFee(ctx.supabase, {
    operatorAmount,
    operatorId: ctx.operatorId,
  });
  const pricedTaxes = await taxesForQuote(ctx.supabase, {
    originCountry: origin.country,
    destinationCountry: destination.country,
    originRegion: origin.region,
    destinationRegion: destination.region,
    returnAt: trip.return_at,
    passengers: trip.passengers,
    operatorAmount,
    platformFee: fee.platformFeeAmount,
    departAt: trip.depart_at,
    returnPath: `/operator/requests/${tripId}`,
  });
  const taxes = pricedTaxes.taxesAmount;
  const customerTotal = operatorAmount + fee.platformFeeAmount + taxes;
  const snapshot = await carrierSnapshot(ctx.supabase, ctx.operatorId);

  const { data: quote, error: quoteError } = await ctx.supabase.from("quotes").insert({
    trip_request_id: tripId,
    operator_id: ctx.operatorId,
    aircraft_id: aircraftId,
    operator_amount: operatorAmount,
    platform_fee_amount: fee.platformFeeAmount,
    taxes_amount: taxes,
    customer_total: customerTotal,
    currency: "USD",
    valid_until: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    notes: String(formData.get("notes") || "") || null,
    status: "pending",
    parent_quote_id: parentQuoteId,
    pricing_mode: "quote_required",
    carrier_disclosure_snapshot: snapshot,
    tax_rule_snapshot: pricedTaxes.ruleSnapshot,
  })
    .select("id")
    .single();
  await assertWrite("quotes", quoteError, `/operator/requests/${tripId}`);
  if (quote?.id) {
    await recordAudit(ctx.supabase, {
      action: "quote.send",
      entityType: "trip_request",
      entityId: tripId,
      summary: isCounter ? "Sent a counter quote" : "Sent a quote",
      diff: scalarDiff(null, {
        quote_id: quote.id,
        aircraft_id: aircraftId,
        operator_amount: operatorAmount,
        customer_total: customerTotal,
        status: "pending",
      }),
    });
  }

  const { error: fanoutError } = await markFanoutQuoted(ctx.supabase, tripId, ctx.operatorId);
  await assertWrite("trip_request_operators", fanoutError, `/operator/requests/${tripId}`);

  if (isCounter && parentQuoteId) {
    const { error: counterError } = await ctx.supabase
      .from("quotes")
      .update({ status: "countered" })
      .eq("id", parentQuoteId);
    await assertWrite("quotes", counterError, `/operator/requests/${tripId}`);
  }

  const next = nextStatusOnQuoteSent(trip.status);
  if (next !== trip.status) {
    const { error: statusError } = await ctx.supabase
      .from("trip_requests")
      .update({ status: next })
      .eq("id", tripId);
    await assertWrite("trip_requests", statusError, `/operator/requests/${tripId}`);
  }

  if (quote?.id) {
    enqueueNotification("quote_sent", { tripId, quoteId: quote.id });
  }
  revalidatePath(`/operator/requests/${tripId}`);
  revalidatePath("/operator/requests");
}

export async function declineRequest(tripId: string) {
  const ctx = await requireOperatorContext();
  if (!ctx.operatorId) throw new Error("No operator");

  const service = createServiceClient();
  const { error, becameDeclined } = await declineOperatorFanout(service, tripId, ctx.operatorId);
  await assertWrite("trip_request_operators", error, `/operator/requests/${tripId}`);
  if (becameDeclined) {
    enqueueNotification("trip_cancelled", {
      tripId,
      reason: null,
      outcome: "declined",
      notify: "customer",
    });
  }
  revalidatePath(`/operator/requests/${tripId}`);
  revalidatePath("/operator/requests");
}

export async function cancelOperatorTrip(tripId: string, formData: FormData) {
  const ctx = await requireOperatorContext();
  if (!ctx.operatorId) throw new Error("No operator");
  const reason = String(formData.get("reason") || "").trim();
  if (!reason) throw new Error("A reason is required");

  const service = createServiceClient();
  const { data: trip, error: tripError } = await service
    .from("trip_requests")
    .select("status")
    .eq("id", tripId)
    .maybeSingle();
  await assertWrite("trip_requests", tripError, `/operator/requests/${tripId}`);
  if (!trip) throw new Error("Trip not found");

  const open = trip.status === "requested" || trip.status === "quote_received";
  const booked =
    trip.status === "awaiting_payment" || trip.status === "confirmed" || trip.status === "upcoming";
  if (!open && !booked) throw new Error("This trip cannot be cancelled");

  if (open) {
    const { error, becameDeclined } = await declineOperatorFanout(
      service,
      tripId,
      ctx.operatorId,
      reason,
      ctx.userId,
    );
    await assertWrite("trip_request_operators", error, `/operator/requests/${tripId}`);
    if (becameDeclined) {
      enqueueNotification("trip_cancelled", {
        tripId,
        reason,
        outcome: "declined",
        notify: "customer",
      });
    }
    revalidatePath(`/operator/requests/${tripId}`);
    revalidatePath("/operator/requests");
    return;
  }

  const { data: accepted, error: quoteError } = await service
    .from("quotes")
    .select("operator_id")
    .eq("trip_request_id", tripId)
    .eq("status", "accepted")
    .maybeSingle();
  await assertWrite("quotes", quoteError, `/operator/requests/${tripId}`);
  if (accepted?.operator_id !== ctx.operatorId) {
    throw new Error("Only the operating carrier can cancel this trip");
  }

  const { error: cancelError } = await service
    .from("trip_requests")
    .update({
      status: "cancelled",
      cancellation_reason: reason,
      cancelled_by: ctx.userId,
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", tripId);
  await assertWrite("trip_requests", cancelError, `/operator/requests/${tripId}`);

  const { error: bookingError } = await service
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("trip_request_id", tripId)
    .neq("status", "cancelled");
  await assertWrite("bookings", bookingError, `/operator/requests/${tripId}`);
  await recordCancellationRefund(service, tripId);

  enqueueNotification("trip_cancelled", {
    tripId,
    reason,
    outcome: "cancelled",
    notify: "customer",
  });
  revalidatePath(`/operator/requests/${tripId}`);
  revalidatePath("/operator/requests");
  revalidatePath("/operator/bookings");
}

export async function uploadTripDocument(tripId: string, formData: FormData) {
  const ctx = await requireOperatorContext();
  if (!ctx.operatorId) throw new Error("No operator");

  const requestedReturn = String(formData.get("return_path") || "");
  const returnPath = requestedReturn.startsWith("/operator/")
    ? requestedReturn
    : `/operator/requests/${tripId}`;

  const { data: trip, error: tripError } = await ctx.supabase
    .from("trip_requests")
    .select("id")
    .eq("id", tripId)
    .maybeSingle();
  await assertWrite("trip_requests", tripError, returnPath);
  if (!trip) throw new Error("Trip not found");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("A file is required");
  const title = String(formData.get("title") || file.name).trim() || file.name;
  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80) || "document";
  const storagePath = `${tripId}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await ctx.supabase.storage
    .from("trip-documents")
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  await assertWrite("trip_documents", uploadError, returnPath);

  const { error: insertError } = await ctx.supabase.from("trip_documents").insert({
    trip_request_id: tripId,
    title,
    storage_path: storagePath,
  });
  await assertWrite("trip_documents", insertError, returnPath);

  enqueueNotification("documents_uploaded", { tripId, documentTitle: title });
  revalidatePath(`/operator/requests/${tripId}`);
  revalidatePath("/operator/bookings");
}

export async function adminReviewAccess(
  requestId: string,
  decision: "approved" | "declined",
  formData: FormData,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") throw new Error("Admin only");

  const { data: req } = await service
    .from("access_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (!req) throw new Error("Not found");

  const submittedNote = String(formData.get("decision_note") || "").trim();
  const decisionNote =
    decision === "declined" ? submittedNote || req.decision_note || null : null;

  const { error: reviewError } = await service
    .from("access_requests")
    .update({
      status: decision,
      reviewed_by: user.id,
      ...(decision === "declined" && submittedNote ? { decision_note: submittedNote } : {}),
    })
    .eq("id", requestId);
  await assertWrite("access_requests", reviewError, "/admin/access");
  await recordAudit(service, {
    action: decision === "approved" ? "access.approve" : "access.decline",
    entityType: "access_request",
    entityId: requestId,
    summary: decision === "approved" ? `Approved access for ${req.email}` : `Declined access for ${req.email}`,
    diff: scalarDiff(
      { status: req.status, decision_note: req.decision_note },
      {
        status: decision,
        decision_note: decision === "declined" ? decisionNote : req.decision_note,
      },
    ),
  });

  if (req.user_id) {
    const { error: profileError } = await service
      .from("profiles")
      .update({ access_status: decision })
      .eq("id", req.user_id);
    await assertWrite("profiles", profileError, "/admin/access");
  }

  if (decision === "approved") {
    await sendEmail("access_approved", req.email, { email: req.email });
  } else if (decisionNote) {
    await sendEmail("access_declined", req.email, { email: req.email, decisionNote });
  }

  revalidatePath("/admin/access");
}

export async function adminInviteAccess(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") throw new Error("Admin only");

  const email = String(formData.get("email")).trim().toLowerCase();
  const { data: inviteRow, error: inviteRowError } = await service
    .from("access_requests")
    .insert({
      email,
      status: "invited",
      reviewed_by: user.id,
      invite_code: crypto.randomUUID().slice(0, 8),
      note: "Invited by admin",
    })
    .select("id")
    .single();
  await assertWrite("access_requests", inviteRowError, "/admin/access");
  if (inviteRow) {
    await recordAudit(service, {
      action: "access.invite",
      entityType: "access_request",
      entityId: inviteRow.id,
      summary: `Invited ${email}`,
      diff: scalarDiff(null, { email, status: "invited" }),
    });
  }

  // If user already exists, approve immediately
  const { data: existing } = await service
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    const { error: approveError } = await service
      .from("profiles")
      .update({ access_status: "approved" })
      .eq("id", existing.id);
    await assertWrite("profiles", approveError, "/admin/access");
  }

  await sendEmail("access_invited", email, { email });
  revalidatePath("/admin/access");
}

export async function adminCreateOperator(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") throw new Error("Admin only");

  const { data: operator, error } = await service
    .from("operators")
    .insert({
      name: String(formData.get("name")),
      code: String(formData.get("code")),
      city: String(formData.get("city") || "") || null,
      legal_name: String(formData.get("legal_name")),
      dba: String(formData.get("dba") || "") || null,
      certificate_number: String(formData.get("certificate_number")),
      certificate_type: String(formData.get("certificate_type") || "Part 135"),
      operational_control_disclosure:
        String(formData.get("operational_control_disclosure") || "") || null,
      contact_email: String(formData.get("contact_email") || "") || null,
      contact_phone: String(formData.get("contact_phone") || "") || null,
      default_fee_bps: formData.get("default_fee_bps")
        ? Number(formData.get("default_fee_bps"))
        : null,
    })
    .select("*")
    .single();

  await assertWrite("operators", error, "/admin/operators");
  if (!operator) throw new Error("Failed to create operator");

  const inviteEmail = String(formData.get("invite_email") || "").trim().toLowerCase();
  if (inviteEmail) {
    const { data: invited, error: inviteError } = await service.auth.admin.createUser({
      email: inviteEmail,
      email_confirm: true,
      user_metadata: { display_name: formData.get("name") },
    });
    if (inviteError) {
      // User may already exist — look up by email
      const { data: list } = await service.auth.admin.listUsers({ perPage: 1000 });
      const found = list?.users?.find((u) => u.email?.toLowerCase() === inviteEmail);
      if (!found) throw new Error(inviteError.message);
      const { error: roleError } = await service
        .from("profiles")
        .update({ role: "operator", access_status: "approved" })
        .eq("id", found.id);
      await assertWrite("profiles", roleError, "/admin/operators");
      const { error: memberError } = await service.from("operator_members").insert({
        operator_id: operator.id,
        profile_id: found.id,
        role: "admin",
      });
      await assertWrite("operator_members", memberError, "/admin/operators");
      await sendOperatorInvite({
        email: inviteEmail,
        operatorName: operator.name,
        role: "admin",
        account: "existing",
      });
    } else if (invited.user) {
      const { error: roleError } = await service
        .from("profiles")
        .update({ role: "operator", access_status: "approved" })
        .eq("id", invited.user.id);
      await assertWrite("profiles", roleError, "/admin/operators");
      const { error: memberError } = await service.from("operator_members").insert({
        operator_id: operator.id,
        profile_id: invited.user.id,
        role: "admin",
      });
      await assertWrite("operator_members", memberError, "/admin/operators");
      await sendOperatorInvite({
        email: inviteEmail,
        operatorName: operator.name,
        role: "admin",
        account: "new",
      });
    }
  }

  revalidatePath("/admin/operators");
}

async function requirePlatformAdmin(returnPath: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") {
    await assertWrite("operators", { message: "Admin only" }, returnPath);
  }
  return { supabase, userId: user.id };
}

export async function adminSaveCertificateReview(operatorId: string, formData: FormData) {
  const returnPath = `/admin/operators/${operatorId}`;
  const { supabase } = await requirePlatformAdmin(returnPath);
  const notes = String(formData.get("certificate_review_notes") || "").trim();
  const { error } = await supabase
    .from("operators")
    .update({
      certificate_review_notes: notes || null,
      certificate_reviewed_at: new Date().toISOString(),
    })
    .eq("id", operatorId);
  await assertWrite("operators", error, returnPath);
  revalidatePath(returnPath);
  revalidatePath("/admin/operators");
}

export async function adminUploadInsuranceCertificate(operatorId: string, formData: FormData) {
  const returnPath = `/admin/operators/${operatorId}`;
  const { supabase } = await requirePlatformAdmin(returnPath);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    await assertWrite("operator-documents", { message: "A certificate file is required" }, returnPath);
    return;
  }
  const upload = file;
  const safeName = upload.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80) || "certificate";
  const storagePath = `${operatorId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from("operator-documents").upload(storagePath, upload, {
    contentType: upload.type || "application/octet-stream",
    upsert: false,
  });
  await assertWrite("operator-documents", uploadError, returnPath);
  const { error } = await supabase
    .from("operators")
    .update({ insurance_certificate_path: storagePath })
    .eq("id", operatorId);
  await assertWrite("operators", error, returnPath);
  revalidatePath(returnPath);
}

export async function adminMarkOperatorVerified(operatorId: string) {
  const returnPath = `/admin/operators/${operatorId}`;
  const { supabase, userId } = await requirePlatformAdmin(returnPath);
  const { data: before } = await supabase
    .from("operators")
    .select("verified_at, verified_by")
    .eq("id", operatorId)
    .maybeSingle();
  const verifiedAt = new Date().toISOString();
  const { error } = await supabase
    .from("operators")
    .update({
      verified_at: verifiedAt,
      verified_by: userId,
    })
    .eq("id", operatorId);
  await assertWrite("operators", error, returnPath);
  await recordAudit(supabase, {
    action: "operator.verify",
    entityType: "operator",
    entityId: operatorId,
    summary: "Marked operator verified",
    diff: scalarDiff(before, { verified_at: verifiedAt, verified_by: userId }),
  });
  revalidatePath(returnPath);
  revalidatePath("/admin/operators");
}

export async function adminClearOperatorVerification(operatorId: string) {
  const returnPath = `/admin/operators/${operatorId}`;
  const { supabase } = await requirePlatformAdmin(returnPath);
  const { data: before } = await supabase
    .from("operators")
    .select("verified_at, verified_by")
    .eq("id", operatorId)
    .maybeSingle();
  const { error } = await supabase
    .from("operators")
    .update({
      verified_at: null,
      verified_by: null,
    })
    .eq("id", operatorId);
  await assertWrite("operators", error, returnPath);
  await recordAudit(supabase, {
    action: "operator.unverify",
    entityType: "operator",
    entityId: operatorId,
    summary: "Cleared operator verification",
    diff: scalarDiff(before, { verified_at: null, verified_by: null }),
  });
  revalidatePath(returnPath);
  revalidatePath("/admin/operators");
}

export async function adminRecordPayment(bookingId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") throw new Error("Admin only");

  const amount = Number(formData.get("amount"));
  const paidAt = String(formData.get("paid_at") || "");
  const providerRef = String(formData.get("provider_ref") || "").trim();
  const recorded = await recordWirePayment(service, {
    bookingId,
    amount,
    paidAt,
    providerRef,
  });
  if (!recorded.ok) {
    await assertWrite(recorded.table, { message: recorded.message }, `/admin/bookings/${bookingId}`);
    return;
  }

  await recordAudit(service, {
    action: "payment.record",
    entityType: "booking",
    entityId: bookingId,
    summary: `Recorded a wire payment of ${amount}`,
    diff: scalarDiff(null, {
      payment_id: recorded.paymentId,
      amount,
      paid_at: paidAt,
      provider_ref: providerRef,
      status: "paid",
      confirmed: recorded.confirmed,
    }),
  });

  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
}

export async function adminSetDepositPercent(bookingId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Admin only");

  const returnPath = `/admin/bookings/${bookingId}`;
  const percent = Number(formData.get("deposit_percent"));
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    await assertWrite("bookings", { message: "Deposit percent must be between 0 and 100" }, returnPath);
  }

  const { data: booking, error: bookingError } = await service
    .from("bookings")
    .select("id, customer_total, deposit_percent, deposit_received_at")
    .eq("id", bookingId)
    .maybeSingle();
  await assertWrite("bookings", bookingError, returnPath);
  if (!booking) throw new Error("Booking not found");

  const { data: payments, error: paymentsError } = await service
    .from("payments")
    .select("amount, status")
    .eq("booking_id", bookingId);
  await assertWrite("payments", paymentsError, returnPath);

  const paid = sumPaidPayments(payments ?? []);
  const covered = depositIsCovered(Number(booking.customer_total), percent, paid);
  const { error } = await service
    .from("bookings")
    .update({
      deposit_percent: percent,
      deposit_received_at: covered ? (booking.deposit_received_at ?? new Date().toISOString()) : null,
    })
    .eq("id", bookingId);
  await assertWrite("bookings", error, returnPath);
  await recordAudit(service, {
    action: "booking.deposit_override",
    entityType: "booking",
    entityId: bookingId,
    summary: `Set deposit percent to ${percent}`,
    diff: scalarDiff(
      { deposit_percent: booking.deposit_percent },
      { deposit_percent: percent },
    ),
  });

  revalidatePath("/admin/bookings");
  revalidatePath(returnPath);
}

export async function adminMarkPayoutSent(payoutId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Admin only");

  const sentAt = String(formData.get("sent_at") || "");
  const reference = String(formData.get("reference") || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sentAt) || !reference) {
    await assertWrite("payouts", { message: "Date and reference are required" }, "/admin/payouts");
  }

  const { data: before } = await service
    .from("payouts")
    .select("status, sent_at, reference")
    .eq("id", payoutId)
    .maybeSingle();
  const sentAtIso = `${sentAt}T00:00:00.000Z`;
  const { data: updated, error } = await service
    .from("payouts")
    .update({
      status: "sent",
      sent_at: sentAtIso,
      reference,
    })
    .eq("id", payoutId)
    .eq("status", "unpaid")
    .select("id");
  await assertWrite("payouts", error, "/admin/payouts");
  if (updated?.length) {
    await recordAudit(service, {
      action: "payout.sent",
      entityType: "payout",
      entityId: payoutId,
      summary: "Marked payout sent",
      diff: scalarDiff(before, { status: "sent", sent_at: sentAtIso, reference }),
    });
  }
  revalidatePath("/admin/payouts");
  revalidatePath("/operator/bookings");
}

export async function adminMarkRefundSent(paymentId: string, bookingId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Admin only");

  const returnPath = `/admin/bookings/${bookingId}`;
  const sentAt = String(formData.get("sent_at") || "");
  const reference = String(formData.get("reference") || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sentAt) || !reference) {
    await assertWrite("payments", { message: "Date and reference are required" }, returnPath);
  }

  const { data: before } = await service
    .from("payments")
    .select("status, paid_at, provider_ref")
    .eq("id", paymentId)
    .maybeSingle();
  const sentAtIso = `${sentAt}T00:00:00.000Z`;
  const { data: updated, error } = await service
    .from("payments")
    .update({
      status: "refund_sent",
      paid_at: sentAtIso,
      provider_ref: reference,
    })
    .eq("id", paymentId)
    .eq("status", "refund_due")
    .select("id");
  await assertWrite("payments", error, returnPath);
  if (updated?.length) {
    await recordAudit(service, {
      action: "refund.sent",
      entityType: "payment",
      entityId: paymentId,
      summary: "Marked refund sent",
      diff: scalarDiff(before, { status: "refund_sent", paid_at: sentAtIso, provider_ref: reference }),
    });
  }
  revalidatePath(returnPath);
}

type ServiceClient = ReturnType<typeof createServiceClient>;

async function paymentsCoverInvoice(service: ServiceClient, bookingId: string, customerTotal: number) {
  const { data: invoice, error: invoiceError } = await service
    .from("invoices")
    .select("id")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (invoiceError) return { ok: false as const, message: invoiceError.message };
  const { data: payments, error: paymentsError } = await service
    .from("payments")
    .select("amount, status")
    .eq("booking_id", bookingId);
  if (paymentsError) return { ok: false as const, message: paymentsError.message };
  const paid = sumPaidPayments(payments ?? []);
  return { ok: true as const, covered: Boolean(invoice) && paid + 0.001 >= money(Number(customerTotal)) };
}

/** Same booking and payout result as the rollover job, for an admin who already decided the trip is done. */
async function finishTrip(service: ServiceClient, tripId: string, returnPath: string) {
  const { error: tripError } = await service.from("trip_requests").update({ status: "completed" }).eq("id", tripId);
  await assertWrite("trip_requests", tripError, returnPath);

  const { data: booking, error: bookingError } = await service
    .from("bookings")
    .select("id, status, operator_amount, payout_adjustment, currency, quote_id")
    .eq("trip_request_id", tripId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  await assertWrite("bookings", bookingError, returnPath);
  if (!booking || booking.status === "cancelled") return;
  if (booking.status !== "completed") {
    const { error: bookingUpdateError } = await service
      .from("bookings")
      .update({ status: "completed" })
      .eq("id", booking.id);
    await assertWrite("bookings", bookingUpdateError, returnPath);
  }

  const { data: existingPayout, error: payoutReadError } = await service
    .from("payouts")
    .select("id")
    .eq("booking_id", booking.id)
    .limit(1)
    .maybeSingle();
  await assertWrite("payouts", payoutReadError, returnPath);
  if (existingPayout || !booking.quote_id) return;

  const { data: quote, error: quoteError } = await service
    .from("quotes")
    .select("operator_id")
    .eq("id", booking.quote_id)
    .maybeSingle();
  await assertWrite("quotes", quoteError, returnPath);
  if (!quote) return;

  const { error: payoutError } = await service.from("payouts").insert({
    operator_id: quote.operator_id,
    booking_id: booking.id,
    amount: money(Number(booking.operator_amount) - Number(booking.payout_adjustment)),
    currency: booking.currency,
    status: "unpaid",
  });
  await assertWrite("payouts", payoutError, returnPath);
}

export async function adminOverrideTripStatus(tripId: string, formData: FormData) {
  const returnPath = `/admin/trips/${tripId}`;
  const { userId } = await requirePlatformAdmin(returnPath);
  const service = createServiceClient();
  const next = String(formData.get("status") || "");
  const note = String(formData.get("note") || "").trim();
  if (!note) {
    await assertWrite("trip_requests", { message: "A note is required" }, returnPath);
  }
  if (!(TRIP_STATUSES as string[]).includes(next)) {
    await assertWrite("trip_requests", { message: "Unknown status" }, returnPath);
    return;
  }
  const status = next as TripStatus;

  const { data: trip, error: tripError } = await service
    .from("trip_requests")
    .select("id, status")
    .eq("id", tripId)
    .maybeSingle();
  await assertWrite("trip_requests", tripError, returnPath);
  if (!trip) throw new Error("Trip not found");
  if (!canTransition(trip.status, status)) {
    await assertWrite("trip_requests", { message: `Cannot move ${trip.status} to ${status}` }, returnPath);
    return;
  }

  if (status === "confirmed") {
    const { data: booking, error: bookingError } = await service
      .from("bookings")
      .select("id, customer_total, status")
      .eq("trip_request_id", tripId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    await assertWrite("bookings", bookingError, returnPath);
    const coverage = booking ? await paymentsCoverInvoice(service, booking.id, Number(booking.customer_total)) : null;
    if (coverage && !coverage.ok) {
      await assertWrite("invoices", { message: coverage.message }, returnPath);
      return;
    }
    if (booking && booking.status !== "cancelled" && coverage?.ok && coverage.covered) {
      const confirmed = await confirmTripAfterPayment(service, booking.id);
      if (!confirmed.ok) {
        await assertWrite(confirmed.table, confirmed.error, returnPath);
        return;
      }
      await recordAudit(service, {
        action: "trip.status_override",
        entityType: "trip_request",
        entityId: tripId,
        summary: `Override ${trip.status} → confirmed. ${note}`,
        diff: scalarDiff({ status: trip.status }, { status: "confirmed" }),
      });
    } else {
      const { error } = await service.from("trip_requests").update({ status: "confirmed" }).eq("id", tripId);
      await assertWrite("trip_requests", error, returnPath);
      await recordAudit(service, {
        action: "trip.status_override",
        entityType: "trip_request",
        entityId: tripId,
        summary: `finance_override: payments do not cover the invoice. Status set to confirmed without booking_confirmed. ${note}`,
        diff: scalarDiff({ status: trip.status }, { status: "confirmed" }),
      });
    }
    revalidatePath(returnPath);
    revalidatePath("/admin/trips");
    revalidatePath("/admin/bookings");
    return;
  }

  if (status === "completed") {
    await finishTrip(service, tripId, returnPath);
    await recordAudit(service, {
      action: "trip.status_override",
      entityType: "trip_request",
      entityId: tripId,
      summary: `Override ${trip.status} → completed. ${note}`,
      diff: scalarDiff({ status: trip.status }, { status: "completed" }),
    });
    revalidatePath(returnPath);
    revalidatePath("/admin/trips");
    return;
  }

  if (status === "cancelled") {
    const { error } = await service
      .from("trip_requests")
      .update({
        status: "cancelled",
        cancellation_reason: note,
        cancelled_by: userId,
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", tripId);
    await assertWrite("trip_requests", error, returnPath);
    const { error: bookingError } = await service
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("trip_request_id", tripId)
      .neq("status", "cancelled");
    await assertWrite("bookings", bookingError, returnPath);
    await recordCancellationRefund(service, tripId);
  } else {
    const { error } = await service.from("trip_requests").update({ status }).eq("id", tripId);
    await assertWrite("trip_requests", error, returnPath);
  }

  await recordAudit(service, {
    action: "trip.status_override",
    entityType: "trip_request",
    entityId: tripId,
    summary: `Override ${trip.status} → ${status}. ${note}`,
    diff: scalarDiff({ status: trip.status }, { status }),
  });
  revalidatePath(returnPath);
  revalidatePath("/admin/trips");
  revalidatePath("/admin/bookings");
}

export async function adminReassignTripAircraft(tripId: string, formData: FormData) {
  const returnPath = `/admin/trips/${tripId}`;
  await requirePlatformAdmin(returnPath);
  const service = createServiceClient();
  const aircraftId = String(formData.get("aircraft_id") || "");
  if (!aircraftId) {
    await assertWrite("aircraft", { message: "Choose an aircraft" }, returnPath);
    return;
  }

  const [{ data: trip, error: tripError }, { data: fanout }, { data: quotes }] = await Promise.all([
    service.from("trip_requests").select("id, aircraft_id").eq("id", tripId).maybeSingle(),
    service.from("trip_request_operators").select("operator_id").eq("trip_id", tripId),
    service.from("quotes").select("operator_id").eq("trip_request_id", tripId),
  ]);
  await assertWrite("trip_requests", tripError, returnPath);
  if (!trip) throw new Error("Trip not found");

  const operatorIds = new Set<string>([
    ...(fanout ?? []).map((row) => row.operator_id),
    ...(quotes ?? []).map((row) => row.operator_id),
  ]);
  if (trip.aircraft_id) {
    const { data: current } = await service.from("aircraft").select("operator_id").eq("id", trip.aircraft_id).maybeSingle();
    if (current) operatorIds.add(current.operator_id);
  }

  const { data: aircraft, error: aircraftError } = await service
    .from("aircraft")
    .select("id, operator_id, tail_number")
    .eq("id", aircraftId)
    .maybeSingle();
  await assertWrite("aircraft", aircraftError, returnPath);
  if (!aircraft || !operatorIds.has(aircraft.operator_id)) {
    await assertWrite(
      "aircraft",
      { message: "Aircraft must belong to an operator already on this trip" },
      returnPath,
    );
    return;
  }
  if (trip.aircraft_id === aircraft.id) {
    revalidatePath(returnPath);
    return;
  }

  const { error } = await service.from("trip_requests").update({ aircraft_id: aircraft.id }).eq("id", tripId);
  await assertWrite("trip_requests", error, returnPath);
  await recordAudit(service, {
    action: "trip.reassign_aircraft",
    entityType: "trip_request",
    entityId: tripId,
    summary: `Reassigned aircraft to ${aircraft.tail_number}. Amounts unchanged.`,
    diff: scalarDiff({ aircraft_id: trip.aircraft_id }, { aircraft_id: aircraft.id }),
  });
  revalidatePath(returnPath);
}

export async function adminCreateTripInvoice(tripId: string) {
  const returnPath = `/admin/trips/${tripId}`;
  await requirePlatformAdmin(returnPath);
  const service = createServiceClient();
  const { data: trip, error: tripError } = await service
    .from("trip_requests")
    .select("id, status")
    .eq("id", tripId)
    .maybeSingle();
  await assertWrite("trip_requests", tripError, returnPath);
  if (!trip) throw new Error("Trip not found");
  if (trip.status !== "awaiting_payment") {
    await assertWrite("invoices", { message: "Create an invoice only while the trip is awaiting payment" }, returnPath);
    return;
  }

  const { data: booking, error: bookingError } = await service
    .from("bookings")
    .select("id")
    .eq("trip_request_id", tripId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  await assertWrite("bookings", bookingError, returnPath);
  if (!booking) {
    await assertWrite("invoices", { message: "This trip has no booking" }, returnPath);
    return;
  }

  const created = await createInvoiceForBooking(service, booking.id);
  if (!created.ok) {
    await assertWrite("invoices", { message: created.message }, returnPath);
    return;
  }
  await recordAudit(service, {
    action: "invoice.create",
    entityType: "trip_request",
    entityId: tripId,
    summary: `Created invoice ${created.number}`,
    diff: scalarDiff(null, { invoice_id: created.invoiceId, number: created.number, status: "issued" }),
  });
  revalidatePath(returnPath);
  revalidatePath(`/admin/bookings/${booking.id}`);
}

export async function adminMarkTripCompleted(tripId: string) {
  const returnPath = `/admin/trips/${tripId}`;
  await requirePlatformAdmin(returnPath);
  const service = createServiceClient();
  const { data: trip, error: tripError } = await service
    .from("trip_requests")
    .select("id, status, return_at")
    .eq("id", tripId)
    .maybeSingle();
  await assertWrite("trip_requests", tripError, returnPath);
  if (!trip) throw new Error("Trip not found");
  if (trip.status !== "confirmed" && trip.status !== "upcoming") {
    await assertWrite("trip_requests", { message: "Only a confirmed or upcoming trip can be marked completed" }, returnPath);
    return;
  }
  if (trip.return_at) {
    await assertWrite("trip_requests", { message: "This trip has a return time. Rollover can complete it." }, returnPath);
    return;
  }

  const { data: booking, error: bookingError } = await service
    .from("bookings")
    .select("estimated_block_minutes")
    .eq("trip_request_id", tripId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  await assertWrite("bookings", bookingError, returnPath);
  if (booking?.estimated_block_minutes != null) {
    await assertWrite(
      "trip_requests",
      { message: "This trip has an estimated block time. Rollover can complete it." },
      returnPath,
    );
    return;
  }

  await finishTrip(service, tripId, returnPath);
  await recordAudit(service, {
    action: "trip.mark_completed",
    entityType: "trip_request",
    entityId: tripId,
    summary: "Marked completed. Rollover cannot compute arrival without return_at or estimated_block_minutes.",
    diff: scalarDiff({ status: trip.status }, { status: "completed" }),
  });
  revalidatePath(returnPath);
  revalidatePath("/admin/trips");
  revalidatePath("/admin/bookings");
}
