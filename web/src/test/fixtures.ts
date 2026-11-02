import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, BookingStatus, Json, TripStatus } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export const SEEDED_ORIGIN_ID = "11111111-1111-1111-1111-111111110001";
export const SEEDED_DESTINATION_ID = "11111111-1111-1111-1111-111111110004";
export const SEEDED_MODEL_ID = "22222222-2222-2222-2222-222222220001";

/** Password passed to auth.admin.createUser by the fixture builders. */
export const FIXTURE_PASSWORD = "Koria-test-73-password";

function unwrap<T extends { data: unknown; error: { message: string } | null }>(
  label: string,
  result: T,
): NonNullable<T["data"]> {
  if (result.error || result.data == null) {
    throw new Error(`${label}: ${result.error?.message ?? "no row"}`);
  }
  return result.data;
}

export async function createCustomer(client: Client): Promise<{ id: string; email: string }> {
  const email = `kor73-${crypto.randomUUID()}@koria.test`;
  const created = await client.auth.admin.createUser({
    email,
    password: FIXTURE_PASSWORD,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error(`createUser: ${created.error?.message ?? "no user"}`);
  }
  return { id: created.data.user.id, email };
}

export async function createOperator(
  client: Client,
  opts: { defaultFeeBps?: number | null } = {},
): Promise<{ id: string }> {
  const code = `K73${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`.toUpperCase();
  const row = unwrap(
    "operators",
    await client
      .from("operators")
      .insert({
        name: "KOR-73 Test Air",
        code,
        legal_name: "KOR-73 Test Air LLC",
        certificate_number: `CERT-${code}`,
        default_fee_bps: opts.defaultFeeBps ?? null,
      })
      .select("id")
      .single(),
  );
  return { id: row.id };
}

export type MoneyBooking = {
  customerId: string;
  operatorId: string;
  tripId: string;
  quoteId: string;
  bookingId: string;
  invoiceId: string | null;
};

/**
 * Fresh customer, operator, aircraft, trip, quote, and booking.
 * Uses seeded airports and the Phenom 300 model. Does not reuse demo trips.
 */
export async function createMoneyBooking(
  client: Client,
  opts: {
    customerTotal?: number;
    depositPercent?: number;
    tripStatus?: TripStatus;
    bookingStatus?: BookingStatus;
    departAt?: string;
    withInvoice?: boolean;
    operatorAmount?: number;
    platformFeeAmount?: number;
  } = {},
): Promise<MoneyBooking> {
  const customerTotal = opts.customerTotal ?? 100_000;
  const operatorAmount = opts.operatorAmount ?? customerTotal;
  const platformFeeAmount = opts.platformFeeAmount ?? 0;
  const customer = await createCustomer(client);
  const operator = await createOperator(client);
  const tail = `N${crypto.randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase()}`;
  const aircraft = unwrap(
    "aircraft",
    await client
      .from("aircraft")
      .insert({
        operator_id: operator.id,
        model_id: SEEDED_MODEL_ID,
        tail_number: tail,
        seating: 6,
      })
      .select("id")
      .single(),
  );
  const trip = unwrap(
    "trip_requests",
    await client
      .from("trip_requests")
      .insert({
        customer_id: customer.id,
        origin_id: SEEDED_ORIGIN_ID,
        destination_id: SEEDED_DESTINATION_ID,
        depart_at: opts.departAt ?? new Date(Date.now() + 30 * 24 * 3_600_000).toISOString(),
        passengers: 4,
        status: opts.tripStatus ?? "awaiting_payment",
      })
      .select("id")
      .single(),
  );
  const quote = unwrap(
    "quotes",
    await client
      .from("quotes")
      .insert({
        trip_request_id: trip.id,
        operator_id: operator.id,
        aircraft_id: aircraft.id,
        operator_amount: operatorAmount,
        platform_fee_amount: platformFeeAmount,
        taxes_amount: 0,
        customer_total: customerTotal,
        status: "accepted",
        pricing_mode: "estimated",
      })
      .select("id")
      .single(),
  );
  const booking = unwrap(
    "bookings",
    await client
      .from("bookings")
      .insert({
        trip_request_id: trip.id,
        quote_id: quote.id,
        status: opts.bookingStatus ?? "pending",
        operator_amount: operatorAmount,
        platform_fee_amount: platformFeeAmount,
        taxes_amount: 0,
        customer_total: customerTotal,
        deposit_percent: opts.depositPercent ?? 50,
        currency: "USD",
      })
      .select("id")
      .single(),
  );

  let invoiceId: string | null = null;
  if (opts.withInvoice !== false) {
    const invoice = unwrap(
      "invoices",
      await client
        .from("invoices")
        .insert({
          booking_id: booking.id,
          due_date: "2026-12-01",
          currency: "USD",
          line_items: [],
          bank_details: {},
          amount_due: customerTotal,
          status: "issued",
        })
        .select("id")
        .single(),
    );
    invoiceId = invoice.id;
  }

  return {
    customerId: customer.id,
    operatorId: operator.id,
    tripId: trip.id,
    quoteId: quote.id,
    bookingId: booking.id,
    invoiceId,
  };
}

export type PendingQuote = {
  id: string;
  operatorId: string;
  aircraftId: string;
  operatorAmount: number;
  platformFeeAmount: number;
  taxesAmount: number;
  customerTotal: number;
  taxRuleSnapshot: Json;
  brokerRoleDisclosure: string;
};

export type QuoteReceivedTrip = {
  customerId: string;
  email: string;
  password: string;
  tripId: string;
  quotes: PendingQuote[];
};

/**
 * Approved customer, trip in quote_received, and two or more pending quotes.
 * No booking. Each quote has its own operator and aircraft and distinct money.
 */
export async function createQuoteReceivedTrip(
  client: Client,
  opts: { quoteCount?: number; validUntil?: string | null; fbo?: string | null } = {},
): Promise<QuoteReceivedTrip> {
  const quoteCount = opts.quoteCount ?? 2;
  const validUntil =
    opts.validUntil === undefined
      ? new Date(Date.now() + 48 * 3_600_000).toISOString()
      : opts.validUntil;
  const customer = await createCustomer(client);
  const approved = await client
    .from("profiles")
    .update({ access_status: "approved" })
    .eq("id", customer.id);
  if (approved.error) throw new Error(`approve profile: ${approved.error.message}`);

  const trip = unwrap(
    "trip_requests",
    await client
      .from("trip_requests")
      .insert({
        customer_id: customer.id,
        origin_id: SEEDED_ORIGIN_ID,
        destination_id: SEEDED_DESTINATION_ID,
        depart_at: new Date(Date.now() + 30 * 24 * 3_600_000).toISOString(),
        passengers: 4,
        status: "quote_received",
        fbo: opts.fbo === undefined ? "KOR-72 FBO" : opts.fbo,
      })
      .select("id")
      .single(),
  );

  const quotes: PendingQuote[] = [];
  for (let index = 0; index < quoteCount; index++) {
    const operator = await createOperator(client);
    const tail = `N${crypto.randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase()}`;
    const aircraft = unwrap(
      "aircraft",
      await client
        .from("aircraft")
        .insert({
          operator_id: operator.id,
          model_id: SEEDED_MODEL_ID,
          tail_number: tail,
          seating: 6,
        })
        .select("id")
        .single(),
    );
    const operatorAmount = 80_000 + index * 10_000;
    const platformFeeAmount = 4_000 + index * 500;
    const taxesAmount = 1_250 + index * 25;
    const customerTotal = operatorAmount + platformFeeAmount + taxesAmount;
    const taxRuleSnapshot: Json = {
      version: "kor-72",
      quote_index: index,
      rate: 0.07 + index / 100,
    };
    const brokerRoleDisclosure = `KOR-72 broker disclosure ${index}`;
    const quote = unwrap(
      "quotes",
      await client
        .from("quotes")
        .insert({
          trip_request_id: trip.id,
          operator_id: operator.id,
          aircraft_id: aircraft.id,
          operator_amount: operatorAmount,
          platform_fee_amount: platformFeeAmount,
          taxes_amount: taxesAmount,
          customer_total: customerTotal,
          currency: "USD",
          status: "pending",
          pricing_mode: "estimated",
          valid_until: validUntil,
          tax_rule_snapshot: taxRuleSnapshot,
          carrier_disclosure_snapshot: {
            legal_name: `KOR-72 Carrier ${index} LLC`,
            dba: `KOR-72 Carrier ${index}`,
            certificate_number: `CERT-KOR72-${index}`,
            broker_role_disclosure: brokerRoleDisclosure,
          },
        })
        .select("id")
        .single(),
    );
    quotes.push({
      id: quote.id,
      operatorId: operator.id,
      aircraftId: aircraft.id,
      operatorAmount,
      platformFeeAmount,
      taxesAmount,
      customerTotal,
      taxRuleSnapshot,
      brokerRoleDisclosure,
    });
  }

  return {
    customerId: customer.id,
    email: customer.email,
    password: FIXTURE_PASSWORD,
    tripId: trip.id,
    quotes,
  };
}
