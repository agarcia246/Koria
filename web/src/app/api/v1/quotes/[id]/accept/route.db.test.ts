import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, vi } from "vitest";
import { POST } from "@/app/api/v1/quotes/[id]/accept/route";
import type { Database, Json } from "@/lib/database.types";
import { haversineNm } from "@/lib/geo";
import { createInvoiceForBooking } from "@/lib/invoices/create";
import { pricedBlockMinutes } from "@/lib/pricing";
import { dbTest } from "@/test/db";
import {
  createQuoteReceivedTrip,
  SEEDED_DESTINATION_ID,
  SEEDED_MODEL_ID,
  SEEDED_ORIGIN_ID,
  type PendingQuote,
  type QuoteReceivedTrip,
} from "@/test/fixtures";

const invoiceControl = vi.hoisted(() => ({ fail: false }));

vi.mock("@/lib/invoices/create", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/invoices/create")>();
  return {
    ...actual,
    createInvoiceForBooking: (
      client: Parameters<typeof actual.createInvoiceForBooking>[0],
      bookingId: string,
    ) => {
      if (invoiceControl.fail) {
        return Promise.resolve({ ok: false as const, message: "forced invoice failure" });
      }
      return actual.createInvoiceForBooking(client, bookingId);
    },
  };
});

type Client = SupabaseClient<Database>;

type AcceptBody = {
  error?: string;
  status?: string;
  invoice?: {
    number?: string;
    amount_due?: number;
    currency?: string;
    due_date?: string;
    status?: string;
    pdf_url?: string | null;
  } | null;
  booking?: { id?: string; quote_id?: string } | null;
};

const BANK_DETAILS = JSON.stringify({
  account_name: "Koria Test",
  bank_name: "Test Bank",
  routing_number: "021000021",
  account_number: "000123456789",
});

function ensureRouteEnv() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.API_URL) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.API_URL;
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SERVICE_ROLE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.ANON_KEY) {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.ANON_KEY;
  }
}

function unwrap<T extends { data: unknown; error: { message: string } | null }>(
  label: string,
  result: T,
): NonNullable<T["data"]> {
  if (result.error || result.data == null) {
    throw new Error(`${label}: ${result.error?.message ?? "no row"}`);
  }
  return result.data;
}

async function accessToken(email: string, password: string): Promise<string> {
  ensureRouteEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is unset");
  const anonClient = createClient<Database>(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signed = await anonClient.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.session) {
    throw new Error(`signIn: ${signed.error?.message ?? "no session"}`);
  }
  return signed.data.session.access_token;
}

async function acceptQuote(quoteId: string, token: string) {
  const response = await POST(
    new Request(`http://localhost/api/v1/quotes/${quoteId}/accept`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }),
    { params: Promise.resolve({ id: quoteId }) },
  );
  const body = (await response.json()) as AcceptBody;
  return { status: response.status, body };
}

async function loadState(client: Client, tripId: string) {
  const quotes = await client
    .from("quotes")
    .select("id, status")
    .eq("trip_request_id", tripId)
    .order("created_at", { ascending: true });
  const trip = await client.from("trip_requests").select("status").eq("id", tripId).single();
  const bookings = await client
    .from("bookings")
    .select(
      "id, quote_id, status, operator_amount, platform_fee_amount, taxes_amount, customer_total, broker_role_disclosure, tax_rule_snapshot, estimated_block_minutes",
    )
    .eq("trip_request_id", tripId);
  if (quotes.error || trip.error || bookings.error) {
    throw new Error(quotes.error?.message ?? trip.error?.message ?? bookings.error?.message ?? "read failed");
  }
  return { quotes: quotes.data ?? [], trip: trip.data, bookings: bookings.data ?? [] };
}

async function expectedBlockMinutes(client: Client): Promise<number> {
  const origin = unwrap(
    "origin",
    await client.from("airports").select("latitude, longitude").eq("id", SEEDED_ORIGIN_ID).single(),
  );
  const destination = unwrap(
    "destination",
    await client.from("airports").select("latitude, longitude").eq("id", SEEDED_DESTINATION_ID).single(),
  );
  const model = unwrap(
    "model",
    await client.from("aircraft_models").select("cruise_speed_ktas").eq("id", SEEDED_MODEL_ID).single(),
  );
  return pricedBlockMinutes(
    {
      repositionNm: 0,
      liveNm: haversineNm(
        Number(origin.latitude),
        Number(origin.longitude),
        Number(destination.latitude),
        Number(destination.longitude),
      ),
      returnNm: 0,
    },
    Number(model.cruise_speed_ktas),
  );
}

function money(value: number | string | null): number {
  return Number(value);
}

describe("POST /api/v1/quotes/:id/accept", () => {
  beforeEach(() => {
    invoiceControl.fail = false;
    process.env.KORIA_BANK_DETAILS_JSON = BANK_DETAILS;
    ensureRouteEnv();
  });

  dbTest("copies quote money onto the booking and closes the other quotes", async (client) => {
    const fx = await createQuoteReceivedTrip(client);
    const token = await accessToken(fx.email, fx.password);
    const chosen = fx.quotes[0];
    const result = await acceptQuote(chosen.id, token);

    expect(result.status).toBe(200);
    expect(result.body.status).toBe("awaiting_payment");
    expect(result.body.booking?.quote_id).toBe(chosen.id);
    expect(result.body.invoice?.number).toEqual(expect.any(String));
    expect(result.body.invoice?.amount_due).toBeGreaterThan(0);
    expect(result.body.invoice?.currency).toBe("USD");
    expect(result.body.invoice?.due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.body.invoice?.status).toBe("issued");
    expect(result.body.invoice?.pdf_url).toContain("/object/sign/invoices/");

    const state = await loadState(client, fx.tripId);
    expect(state.trip.status).toBe("awaiting_payment");
    expect(state.quotes.map((row) => row.status).sort()).toEqual(["accepted", "declined"]);
    expect(state.quotes.find((row) => row.id === chosen.id)?.status).toBe("accepted");
    expect(state.quotes.find((row) => row.id === fx.quotes[1].id)?.status).toBe("declined");
    expect(state.bookings).toHaveLength(1);
    const booking = state.bookings[0];
    expect(booking.quote_id).toBe(chosen.id);
    expect(money(booking.operator_amount)).toBe(chosen.operatorAmount);
    expect(money(booking.platform_fee_amount)).toBe(chosen.platformFeeAmount);
    expect(money(booking.taxes_amount)).toBe(chosen.taxesAmount);
    expect(money(booking.customer_total)).toBe(chosen.customerTotal);
    expect(booking.broker_role_disclosure).toBe(chosen.brokerRoleDisclosure);
    expect(booking.tax_rule_snapshot).toEqual(chosen.taxRuleSnapshot);
    expect(booking.estimated_block_minutes).toBe(await expectedBlockMinutes(client));

    const audit = await client
      .from("audit_events")
      .select("action, actor_role")
      .eq("entity_id", fx.tripId);
    if (audit.error) throw new Error(audit.error.message);
    expect(audit.data).toEqual(
      expect.arrayContaining([
        { action: "quote.accept", actor_role: "customer" },
        { action: "invoice.create", actor_role: "system" },
      ]),
    );
  });

  dbTest("a parallel second accept loses with 409 and leaves one booking", async (client) => {
    const fx = await createQuoteReceivedTrip(client);
    const token = await accessToken(fx.email, fx.password);
    const [first, second] = await Promise.all([
      acceptQuote(fx.quotes[0].id, token),
      acceptQuote(fx.quotes[1].id, token),
    ]);

    const results = [first, second];
    const ok = results.filter((result) => result.status === 200);
    const conflict = results.filter((result) => result.status === 409);
    expect(results.map((result) => `${result.status} ${result.body.error ?? result.body.status}`).sort()).toEqual([
      "200 awaiting_payment",
      "409 already_booked",
    ]);
    expect(ok).toHaveLength(1);
    expect(conflict).toHaveLength(1);
    expect(conflict[0].body.error).toBe("already_booked");

    const state = await loadState(client, fx.tripId);
    expect(state.bookings).toHaveLength(1);
    expect(state.trip.status).toBe("awaiting_payment");
    const accepted = state.quotes.filter((row) => row.status === "accepted");
    const declined = state.quotes.filter((row) => row.status === "declined");
    expect(accepted).toHaveLength(1);
    expect(declined).toHaveLength(1);
    expect(state.bookings[0].quote_id).toBe(accepted[0].id);
    expect(ok[0].body.booking?.quote_id).toBe(accepted[0].id);
  });

  dbTest("an expired quote is rejected and writes nothing", async (client) => {
    const fx = await createQuoteReceivedTrip(client, {
      validUntil: new Date(Date.now() - 3_600_000).toISOString(),
    });
    const before = await loadState(client, fx.tripId);
    const token = await accessToken(fx.email, fx.password);
    const result = await acceptQuote(fx.quotes[0].id, token);

    expect(result.status).toBe(409);
    expect(result.body.error).toBe("quote_expired");
    const after = await loadState(client, fx.tripId);
    expect(after.trip.status).toBe("quote_received");
    expect(after.quotes.map((row) => [row.id, row.status])).toEqual(
      before.quotes.map((row) => [row.id, row.status]),
    );
    expect(after.quotes.every((row) => row.status === "pending")).toBe(true);
    expect(after.bookings).toEqual([]);
  });

  dbTest("a booking insert conflict leaves the pending quotes and trip untouched", async (client) => {
    const fx = await createQuoteReceivedTrip(client);
    const blocker = await insertLiveBooking(client, fx, fx.quotes[0]);
    const before = await loadState(client, fx.tripId);
    const token = await accessToken(fx.email, fx.password);
    const result = await acceptQuote(fx.quotes[1].id, token);

    expect(result.status).toBe(409);
    expect(result.body.error).toBe("already_booked");
    const after = await loadState(client, fx.tripId);
    expect(after.trip.status).toBe("quote_received");
    expect(after.bookings.map((row) => row.id)).toEqual([blocker.id]);
    expect(after.quotes.find((row) => row.id === fx.quotes[0].id)?.status).toBe("pending");
    expect(after.quotes.find((row) => row.id === fx.quotes[1].id)?.status).toBe("pending");
    expect(after.quotes.find((row) => row.id === blocker.quoteId)?.status).toBe("accepted");
    expect(after.quotes.map((row) => [row.id, row.status])).toEqual(
      before.quotes.map((row) => [row.id, row.status]),
    );
  });

  dbTest("invoice failure returns invoice null and createInvoiceForBooking recovers", async (client) => {
    const fx = await createQuoteReceivedTrip(client);
    const token = await accessToken(fx.email, fx.password);
    invoiceControl.fail = true;
    const errors: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map((arg) => String(arg)).join(" "));
    });
    try {
      const result = await acceptQuote(fx.quotes[0].id, token);
      expect(result.status).toBe(200);
      expect(result.body.invoice).toBeNull();
      expect(result.body.status).toBe("awaiting_payment");
    } finally {
      spy.mockRestore();
      invoiceControl.fail = false;
    }

    expect(errors.some((line) => line.includes("invoice_create_failed"))).toBe(true);
    const state = await loadState(client, fx.tripId);
    expect(state.trip.status).toBe("awaiting_payment");
    expect(state.bookings).toHaveLength(1);
    expect(state.quotes.find((row) => row.id === fx.quotes[0].id)?.status).toBe("accepted");
    expect(state.quotes.find((row) => row.id === fx.quotes[1].id)?.status).toBe("declined");

    const bookingId = state.bookings[0].id;
    const before = await client.from("invoices").select("id").eq("booking_id", bookingId);
    expect(before.data ?? []).toEqual([]);

    const recovered = await createInvoiceForBooking(client, bookingId);
    expect(recovered.ok).toBe(true);
    if (!recovered.ok) return;
    const after = unwrap(
      "invoices",
      await client.from("invoices").select("id, number, status").eq("booking_id", bookingId).single(),
    );
    expect(after.id).toBe(recovered.invoiceId);
    expect(after.number).toBe(recovered.number);
    expect(after.status).toBe("issued");
  });
});

async function insertLiveBooking(client: Client, fx: QuoteReceivedTrip, sibling: PendingQuote) {
  const quote = unwrap(
    "blocker quote",
    await client
      .from("quotes")
      .insert({
        trip_request_id: fx.tripId,
        operator_id: sibling.operatorId,
        aircraft_id: sibling.aircraftId,
        operator_amount: 1,
        platform_fee_amount: 0,
        taxes_amount: 0,
        customer_total: 1,
        currency: "USD",
        status: "accepted",
        pricing_mode: "estimated",
        tax_rule_snapshot: { version: "kor-72-blocker" } satisfies Json,
      })
      .select("id")
      .single(),
  );
  const booking = unwrap(
    "blocker booking",
    await client
      .from("bookings")
      .insert({
        trip_request_id: fx.tripId,
        quote_id: quote.id,
        status: "pending",
        operator_amount: 1,
        platform_fee_amount: 0,
        taxes_amount: 0,
        customer_total: 1,
        currency: "USD",
      })
      .select("id")
      .single(),
  );
  return { id: booking.id, quoteId: quote.id };
}
