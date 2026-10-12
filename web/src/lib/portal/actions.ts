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
import { recordWirePayment, sumPaidPayments } from "@/lib/payments/record";
import { depositIsCovered } from "@/lib/payments/deposit";
import { nextStatusOnQuoteSent } from "@/lib/trips/state";
import type { PricingMode, AvailabilityKind } from "@/lib/database.types";
import { parseAvailabilityFile } from "@/lib/availability/parse";
import { assertWrite } from "@/lib/portal/write";

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
  const { error } = await ctx.supabase
    .from("operators")
    .update({
      agreement_version: CURRENT_OPERATOR_AGREEMENT.version,
      agreement_accepted_at: new Date().toISOString(),
      agreement_accepted_by: ctx.userId,
    })
    .eq("id", ctx.operatorId);
  await assertWrite("operators", error, "/operator/agreement");
  revalidatePath("/operator/agreement");
  revalidatePath("/operator/fleet");
}

export async function createAircraft(formData: FormData) {
  const ctx = await requireOperatorContext();
  if (!ctx.operatorId) throw new Error("No operator membership");

  const activating = formData.get("is_active") === "on";
  await rejectIfActivatingWithoutAgreement(ctx.supabase, ctx.operatorId, activating, "/operator/fleet/new");

  const { data, error } = await ctx.supabase
    .from("aircraft")
    .insert({
      operator_id: ctx.operatorId,
      model_id: String(formData.get("model_id")),
      tail_number: String(formData.get("tail_number")),
      year: formData.get("year") ? Number(formData.get("year")) : null,
      seating: Number(formData.get("seating")),
      interior_configuration: String(formData.get("interior_configuration") || "") || null,
      baggage_cu_ft: formData.get("baggage_cu_ft")
        ? Number(formData.get("baggage_cu_ft"))
        : null,
      wifi: formData.get("wifi") === "on",
      lavatory: formData.get("lavatory") === "on",
      pets: formData.get("pets") === "on",
      golf: formData.get("golf") === "on",
      skis: formData.get("skis") === "on",
      cabin_notes: String(formData.get("cabin_notes") || "") || null,
      home_base_id: String(formData.get("home_base_id") || "") || null,
      is_active: formData.get("is_active") === "on",
      pricing_mode_default: (String(formData.get("pricing_mode_default") || "quote_required") as PricingMode),
    })
    .select("id")
    .single();

  await assertWrite("aircraft", error, "/operator/fleet/new");
  if (!data) throw new Error("Failed to create aircraft");
  revalidatePath("/operator/fleet");
  redirect(`/operator/fleet/${data.id}`);
}

export async function updateAircraft(aircraftId: string, formData: FormData) {
  const ctx = await requireOperatorContext();
  const returnPath = `/operator/fleet/${aircraftId}`;
  const { data: existing, error: existingError } = await ctx.supabase
    .from("aircraft")
    .select("operator_id")
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

  const { error } = await ctx.supabase
    .from("aircraft")
    .update({
      model_id: String(formData.get("model_id")),
      tail_number: String(formData.get("tail_number")),
      year: formData.get("year") ? Number(formData.get("year")) : null,
      seating: Number(formData.get("seating")),
      interior_configuration: String(formData.get("interior_configuration") || "") || null,
      baggage_cu_ft: formData.get("baggage_cu_ft")
        ? Number(formData.get("baggage_cu_ft"))
        : null,
      wifi: formData.get("wifi") === "on",
      lavatory: formData.get("lavatory") === "on",
      pets: formData.get("pets") === "on",
      golf: formData.get("golf") === "on",
      skis: formData.get("skis") === "on",
      cabin_notes: String(formData.get("cabin_notes") || "") || null,
      home_base_id: String(formData.get("home_base_id") || "") || null,
      is_active: formData.get("is_active") === "on",
      pricing_mode_default: (String(formData.get("pricing_mode_default") || "quote_required") as PricingMode),
    })
    .eq("id", aircraftId);

  await assertWrite("aircraft", error, `/operator/fleet/${aircraftId}`);
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
  const { error: inviteRowError } = await service.from("access_requests").insert({
    email,
    status: "invited",
    reviewed_by: user.id,
    invite_code: crypto.randomUUID().slice(0, 8),
    note: "Invited by admin",
  });
  await assertWrite("access_requests", inviteRowError, "/admin/access");

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
  const { error } = await supabase
    .from("operators")
    .update({
      verified_at: new Date().toISOString(),
      verified_by: userId,
    })
    .eq("id", operatorId);
  await assertWrite("operators", error, returnPath);
  revalidatePath(returnPath);
  revalidatePath("/admin/operators");
}

export async function adminClearOperatorVerification(operatorId: string) {
  const returnPath = `/admin/operators/${operatorId}`;
  const { supabase } = await requirePlatformAdmin(returnPath);
  const { error } = await supabase
    .from("operators")
    .update({
      verified_at: null,
      verified_by: null,
    })
    .eq("id", operatorId);
  await assertWrite("operators", error, returnPath);
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

  const recorded = await recordWirePayment(service, {
    bookingId,
    amount: Number(formData.get("amount")),
    paidAt: String(formData.get("paid_at") || ""),
    providerRef: String(formData.get("provider_ref") || ""),
  });
  if (!recorded.ok) {
    await assertWrite(recorded.table, { message: recorded.message }, `/admin/bookings/${bookingId}`);
  }

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
    .select("id, customer_total, deposit_received_at")
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

  const { error } = await service
    .from("payouts")
    .update({
      status: "sent",
      sent_at: `${sentAt}T00:00:00.000Z`,
      reference,
    })
    .eq("id", payoutId)
    .eq("status", "unpaid");
  await assertWrite("payouts", error, "/admin/payouts");
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

  const { error } = await service
    .from("payments")
    .update({
      status: "refund_sent",
      paid_at: `${sentAt}T00:00:00.000Z`,
      provider_ref: reference,
    })
    .eq("id", paymentId)
    .eq("status", "refund_due");
  await assertWrite("payments", error, returnPath);
  revalidatePath(returnPath);
}
