import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, BookingStatus, TripStatus } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export const SEEDED_ORIGIN_ID = "11111111-1111-1111-1111-111111110001";
export const SEEDED_DESTINATION_ID = "11111111-1111-1111-1111-111111110004";
export const SEEDED_MODEL_ID = "22222222-2222-2222-2222-222222220001";

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
    password: "Koria-test-73-password",
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
