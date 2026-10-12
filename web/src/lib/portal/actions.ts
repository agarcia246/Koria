"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { requireOperatorContext } from "@/lib/portal/operator";
import { resolvePlatformFee } from "@/lib/fees";
import { computeOperatorAmount } from "@/lib/pricing";
import { haversineNm } from "@/lib/geo";
import { BROKER_DISCLOSURE } from "@/lib/disclosures";
import { sendEmail } from "@/lib/email";
import { enqueueNotification } from "@/lib/notifications/enqueue";
import { sendOperatorInvite } from "@/lib/operators/invite";
import { declineOperatorFanout, markFanoutQuoted } from "@/lib/trips/fanout";
import { confirmTripAfterPayment } from "@/lib/trips/confirm";
import { nextStatusOnQuoteSent } from "@/lib/trips/state";
import type { PricingMode, AvailabilityKind } from "@/lib/database.types";
import { assertWrite } from "@/lib/portal/write";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createAircraft(formData: FormData) {
  const ctx = await requireOperatorContext();
  if (!ctx.operatorId) throw new Error("No operator membership");

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

export async function createAvailability(formData: FormData) {
  const ctx = await requireOperatorContext();
  const { error } = await ctx.supabase.from("aircraft_availability").insert({
    aircraft_id: String(formData.get("aircraft_id")),
    starts_at: String(formData.get("starts_at")),
    ends_at: String(formData.get("ends_at")),
    kind: String(formData.get("kind") || "blocked") as AvailabilityKind,
    based_at_id: String(formData.get("based_at_id") || "") || null,
    notes: String(formData.get("notes") || "") || null,
  });
  await assertWrite("aircraft_availability", error, "/operator/availability");
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
    broker_role_disclosure: BROKER_DISCLOSURE,
  };
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
  const taxes = 0;
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
  const taxes = formData.get("taxes_amount") ? Number(formData.get("taxes_amount")) : 0;
  const parentQuoteId = String(formData.get("parent_quote_id") || "") || null;
  const isCounter = Boolean(parentQuoteId);

  const fee = await resolvePlatformFee(ctx.supabase, {
    operatorAmount,
    operatorId: ctx.operatorId,
  });
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

export async function adminMarkPaid(bookingId: string) {
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

  const confirmed = await confirmTripAfterPayment(service, bookingId);
  if (!confirmed.ok) {
    await assertWrite(confirmed.table, confirmed.error, `/admin/bookings/${bookingId}`);
  }

  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
}
