import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { renderTemplate, sendEmail, type EmailAttachment, type EmailTemplate, type EmailTemplateData } from "@/lib/email";
import { logError, logInfo } from "@/lib/log";
import { createServiceClient } from "@/lib/supabase/admin";
import type { NotifyEvent, NotifyInput, NotifyPayloadMap, Recipient } from "@/lib/notifications/types";

type Client = SupabaseClient<Database>;

type Airport = {
  city: string;
  iata: string | null;
  icao: string;
  time_zone: string | null;
};

type TripContext = {
  tripId: string;
  customer: Recipient | null;
  passengers: number;
  route: string;
  departAt: string;
};

export async function notify<E extends NotifyEvent>(
  event: E,
  payload: NotifyPayloadMap[E],
): Promise<void> {
  try {
    await dispatch({ event, ...payload } as NotifyInput);
  } catch (error) {
    logError("notification_failed", {
      message: error instanceof Error ? error.message : "notification failed",
    });
  }
}

async function dispatch(input: NotifyInput): Promise<void> {
  const client = createServiceClient();
  const trip = await loadTrip(client, input.tripId);
  if (!trip) {
    logError("notification_failed", {
      table: "trip_requests",
      message: "Trip not found",
    });
    return;
  }

  switch (input.event) {
    case "request_received":
      await notifyRequest(client, trip, input.operatorIds);
      return;
    case "quote_sent":
      await notifyQuoteSent(client, trip, input.quoteId);
      return;
    case "quote_accepted":
      await notifyQuoteAccepted(client, trip, input.operatorId, input.quoteId);
      return;
    case "booking_confirmed":
      await notifyBookingConfirmed(client, trip, input.operatorId);
      return;
    case "trip_cancelled":
      await notifyTripCancelled(client, trip, input);
      return;
    case "documents_uploaded":
      await notifyDocument(client, trip, input.documentTitle);
      return;
    case "invoice_issued":
      await notifyInvoice(client, trip, input.invoiceId);
      return;
    default: {
      const exhaustive: never = input;
      logError("notification_failed", { message: `Unknown event ${String(exhaustive)}` });
    }
  }
}

async function notifyRequest(client: Client, trip: TripContext, operatorIds: string[]) {
  const ids = unique(operatorIds);
  if (ids.length === 0) return;
  const [members, names] = await Promise.all([
    membersByOperator(client, ids),
    operatorNames(client, ids),
  ]);
  const portalUrl = portalTripUrl(trip.tripId);
  await Promise.all(
    ids.map((operatorId) =>
      deliver(client, "request_received", trip.tripId, members.get(operatorId) ?? [], "request_received", {
        operatorName: names.get(operatorId) ?? "Your operation",
        route: trip.route,
        departAt: trip.departAt,
        passengers: trip.passengers,
        portalUrl,
      }),
    ),
  );
}

async function notifyQuoteSent(client: Client, trip: TripContext, quoteId: string) {
  if (!trip.customer) return;
  const quote = await loadQuote(client, quoteId);
  if (!quote) return;
  const names = await operatorNames(client, [quote.operatorId]);
  await deliver(client, "quote_sent", trip.tripId, [trip.customer], "quote_sent", {
    route: trip.route,
    operatorName: names.get(quote.operatorId) ?? "An operator",
    total: money(quote.total, quote.currency),
    validUntil: formatWhen(quote.validUntil, "UTC"),
  });
}

async function notifyQuoteAccepted(
  client: Client,
  trip: TripContext,
  operatorId: string,
  quoteId: string,
) {
  const [members, names, quote] = await Promise.all([
    membersByOperator(client, [operatorId]),
    operatorNames(client, [operatorId]),
    loadQuote(client, quoteId),
  ]);
  if (!quote) return;
  await deliver(
    client,
    "quote_accepted",
    trip.tripId,
    members.get(operatorId) ?? [],
    "quote_accepted",
    {
      operatorName: names.get(operatorId) ?? "Your operation",
      route: trip.route,
      total: money(quote.total, quote.currency),
      portalUrl: portalTripUrl(trip.tripId),
    },
  );
}

async function notifyBookingConfirmed(client: Client, trip: TripContext, operatorId: string) {
  const members = await membersByOperator(client, [operatorId]);
  const operatorRecipients = members.get(operatorId) ?? [];
  const customer = trip.customer ? [trip.customer] : [];
  await Promise.all([
    deliver(client, "booking_confirmed", trip.tripId, customer, "booking_confirmed", {
      audience: "customer",
      route: trip.route,
      departAt: trip.departAt,
      portalUrl: null,
    }),
    deliver(client, "booking_confirmed", trip.tripId, operatorRecipients, "booking_confirmed", {
      audience: "operator",
      route: trip.route,
      departAt: trip.departAt,
      portalUrl: portalTripUrl(trip.tripId),
    }),
  ]);
}

async function notifyTripCancelled(
  client: Client,
  trip: TripContext,
  input: NotifyPayloadMap["trip_cancelled"] & { event: "trip_cancelled" },
) {
  const reason = input.reason;
  if (input.notify === "customer") {
    await deliver(client, "trip_cancelled", trip.tripId, trip.customer ? [trip.customer] : [], "trip_cancelled", {
      audience: "customer",
      route: trip.route,
      reason,
      outcome: input.outcome,
    });
    return;
  }

  const operatorIds = await operatorsToTell(client, trip.tripId);
  const members = await membersByOperator(client, operatorIds);
  const recipients = dedupe(operatorIds.flatMap((id) => members.get(id) ?? []));
  await deliver(client, "trip_cancelled", trip.tripId, recipients, "trip_cancelled", {
    audience: "operator",
    route: trip.route,
    reason,
    outcome: input.outcome,
  });
}

async function notifyDocument(client: Client, trip: TripContext, documentTitle: string) {
  await deliver(
    client,
    "documents_uploaded",
    trip.tripId,
    trip.customer ? [trip.customer] : [],
    "documents_uploaded",
    { route: trip.route, documentTitle },
  );
}

async function notifyInvoice(client: Client, trip: TripContext, invoiceId: string) {
  const { data: invoice, error } = await client
    .from("invoices")
    .select("number, amount_due, due_date, currency, pdf_path")
    .eq("id", invoiceId)
    .maybeSingle();
  if (error || !invoice) {
    logError("notification_failed", {
      table: "invoices",
      message: error?.message ?? "Invoice not found",
    });
    return;
  }

  let attachments: EmailAttachment[] | undefined;
  if (invoice.pdf_path) {
    const downloaded = await client.storage.from("invoices").download(invoice.pdf_path);
    if (downloaded.error || !downloaded.data) {
      logError("notification_failed", {
        table: "invoices",
        message: downloaded.error?.message ?? "Invoice PDF missing",
      });
    } else {
      attachments = [
        {
          filename: `${invoice.number}.pdf`,
          content: new Uint8Array(await downloaded.data.arrayBuffer()),
        },
      ];
    }
  }

  await deliver(
    client,
    "invoice_issued",
    trip.tripId,
    trip.customer ? [trip.customer] : [],
    "invoice_issued",
    {
      route: trip.route,
      invoiceNumber: invoice.number,
      amountDue: money(Number(invoice.amount_due), invoice.currency),
      dueDate: invoice.due_date,
    },
    attachments,
  );
}

async function deliver<T extends EmailTemplate>(
  client: Client,
  event: NotifyEvent,
  tripId: string,
  recipients: Recipient[],
  template: T,
  data: EmailTemplateData[T],
  attachments?: EmailAttachment[],
): Promise<void> {
  const people = dedupe(recipients);
  if (people.length === 0) return;

  const rendered = renderTemplate(template, data);
  const rows = people.map((person) => ({
    profile_id: person.profileId,
    title: rendered.subject,
    body: rendered.text,
    event,
    trip_request_id: tripId,
  }));

  const emails = people.map(async (person) => {
    if (!person.email) {
      logInfo("email_skipped", { template, message: "profile has no email" });
      return;
    }
    await sendEmail(template, person.email, data, attachments);
  });

  const [inserted] = await Promise.all([client.from("notifications").insert(rows), Promise.all(emails)]);
  if (inserted.error) {
    logError("notification_failed", {
      table: "notifications",
      event,
      message: inserted.error.message,
    });
  }
}

async function loadTrip(client: Client, tripId: string): Promise<TripContext | null> {
  const { data: trip, error } = await client
    .from("trip_requests")
    .select("id, customer_id, origin_id, destination_id, depart_at, passengers")
    .eq("id", tripId)
    .maybeSingle();
  if (error || !trip) return null;

  const [{ data: origin }, { data: destination }, { data: customer }] = await Promise.all([
    client.from("airports").select("city, iata, icao, time_zone").eq("id", trip.origin_id).maybeSingle(),
    client.from("airports").select("city, iata, icao, time_zone").eq("id", trip.destination_id).maybeSingle(),
    client.from("profiles").select("id, email").eq("id", trip.customer_id).maybeSingle(),
  ]);

  return {
    tripId: trip.id,
    customer: customer ? { profileId: customer.id, email: customer.email } : null,
    passengers: trip.passengers,
    route: `${airportLabel(origin)} to ${airportLabel(destination)}`,
    departAt: formatWhen(trip.depart_at, origin?.time_zone ?? null),
  };
}

async function loadQuote(client: Client, quoteId: string) {
  const { data, error } = await client
    .from("quotes")
    .select("id, operator_id, customer_total, currency, valid_until")
    .eq("id", quoteId)
    .maybeSingle();
  if (error || !data?.valid_until) return null;
  return {
    operatorId: data.operator_id,
    total: data.customer_total,
    currency: data.currency,
    validUntil: data.valid_until,
  };
}

async function operatorNames(client: Client, operatorIds: string[]) {
  const names = new Map<string, string>();
  if (operatorIds.length === 0) return names;
  const { data } = await client.from("operators").select("id, name").in("id", operatorIds);
  for (const row of data ?? []) names.set(row.id, row.name);
  return names;
}

async function membersByOperator(client: Client, operatorIds: string[]) {
  const grouped = new Map<string, Recipient[]>();
  if (operatorIds.length === 0) return grouped;
  const { data: members, error } = await client
    .from("operator_members")
    .select("operator_id, profile_id")
    .in("operator_id", operatorIds);
  if (error || !members?.length) return grouped;

  const profileIds = unique(members.map((row) => row.profile_id));
  const { data: profiles } = await client.from("profiles").select("id, email").in("id", profileIds);
  const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile.email]));

  for (const member of members) {
    const list = grouped.get(member.operator_id) ?? [];
    list.push({ profileId: member.profile_id, email: byId.get(member.profile_id) ?? null });
    grouped.set(member.operator_id, list);
  }
  return grouped;
}

async function operatorsToTell(client: Client, tripId: string) {
  const [{ data: fanout }, { data: accepted }] = await Promise.all([
    client.from("trip_request_operators").select("operator_id, status").eq("trip_id", tripId),
    client
      .from("quotes")
      .select("operator_id")
      .eq("trip_request_id", tripId)
      .eq("status", "accepted")
      .maybeSingle(),
  ]);
  const ids = (fanout ?? []).filter((row) => row.status !== "declined").map((row) => row.operator_id);
  if (accepted?.operator_id) ids.push(accepted.operator_id);
  return unique(ids);
}

function dedupe(recipients: Recipient[]): Recipient[] {
  const seen = new Set<string>();
  const rows: Recipient[] = [];
  for (const recipient of recipients) {
    if (seen.has(recipient.profileId)) continue;
    seen.add(recipient.profileId);
    rows.push(recipient);
  }
  return rows;
}

function unique(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

function airportLabel(airport: Airport | null): string {
  if (!airport) return "Unknown";
  return `${airport.city} (${airport.iata || airport.icao})`;
}

function formatWhen(iso: string, timeZone: string | null): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timeZone || "UTC",
    timeZoneName: "short",
  }).format(new Date(iso));
}

function money(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(amount);
}

function portalTripUrl(tripId: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/operator/requests/${tripId}`;
}
