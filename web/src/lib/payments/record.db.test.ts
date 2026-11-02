import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect } from "vitest";
import type { Database } from "@/lib/database.types";
import { recordWirePayment } from "@/lib/payments/record";
import { dbTest } from "@/test/db";
import { createMoneyBooking } from "@/test/fixtures";

type Client = SupabaseClient<Database>;

function num(value: number | string | null | undefined): number {
  return Number(value);
}

async function ledger(client: Client, bookingId: string, tripId: string) {
  const booking = await client
    .from("bookings")
    .select("status, deposit_received_at")
    .eq("id", bookingId)
    .single();
  const invoice = await client.from("invoices").select("amount_due, status").eq("booking_id", bookingId).single();
  const trip = await client.from("trip_requests").select("status").eq("id", tripId).single();
  const payments = await client
    .from("payments")
    .select("amount, status, provider_ref, paid_at")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });
  const notifications = await client.from("notifications").select("id, event").eq("trip_request_id", tripId);
  if (booking.error || invoice.error || trip.error || payments.error || notifications.error) {
    throw new Error(
      booking.error?.message ??
        invoice.error?.message ??
        trip.error?.message ??
        payments.error?.message ??
        notifications.error?.message ??
        "ledger read failed",
    );
  }
  return {
    booking: booking.data,
    invoice: invoice.data,
    trip: trip.data,
    payments: payments.data ?? [],
    notifications: notifications.data ?? [],
  };
}

describe("recordWirePayment against the local ledger", () => {
  dbTest("partial payment, deposit, then full confirmation", async (client) => {
    const fx = await createMoneyBooking(client, {
      customerTotal: 100_000,
      depositPercent: 50,
      tripStatus: "awaiting_payment",
    });

    const first = await recordWirePayment(client, {
      bookingId: fx.bookingId,
      amount: 40_000,
      paidAt: "2026-06-01",
      providerRef: "  WIRE-40  ",
    });
    expect(first).toMatchObject({ ok: true, confirmed: false });
    const afterForty = await ledger(client, fx.bookingId, fx.tripId);
    expect(afterForty.payments).toHaveLength(1);
    expect(afterForty.payments[0]).toMatchObject({ status: "paid", provider_ref: "WIRE-40" });
    expect(num(afterForty.payments[0].amount)).toBe(40_000);
    expect(new Date(afterForty.payments[0].paid_at ?? "").toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(num(afterForty.invoice.amount_due)).toBe(60_000);
    // Status is inlined in recordWirePayment. There is no invoiceStatusFor helper.
    expect(afterForty.invoice.status).toBe("partially_paid");
    expect(afterForty.booking.deposit_received_at).toBeNull();
    expect(afterForty.booking.status).toBe("pending");
    expect(afterForty.trip.status).toBe("awaiting_payment");

    const second = await recordWirePayment(client, {
      bookingId: fx.bookingId,
      amount: 10_000,
      paidAt: "2026-06-02",
      providerRef: "WIRE-10",
    });
    expect(second).toMatchObject({ ok: true, confirmed: false });
    const afterDeposit = await ledger(client, fx.bookingId, fx.tripId);
    expect(afterDeposit.payments).toHaveLength(2);
    expect(num(afterDeposit.invoice.amount_due)).toBe(50_000);
    expect(afterDeposit.invoice.status).toBe("partially_paid");
    expect(afterDeposit.booking.deposit_received_at).not.toBeNull();
    expect(afterDeposit.trip.status).toBe("awaiting_payment");
    expect(afterDeposit.booking.status).toBe("pending");

    const third = await recordWirePayment(client, {
      bookingId: fx.bookingId,
      amount: 50_000,
      paidAt: "2026-06-03",
      providerRef: "WIRE-50",
    });
    expect(third).toMatchObject({ ok: true, confirmed: true });
    const afterFull = await ledger(client, fx.bookingId, fx.tripId);
    expect(afterFull.payments).toHaveLength(3);
    expect(num(afterFull.invoice.amount_due)).toBe(0);
    expect(afterFull.invoice.status).toBe("paid");
    expect(afterFull.booking.status).toBe("confirmed");
    expect(afterFull.trip.status).toBe("confirmed");
    // enqueueNotification uses next/server `after()`, which throws outside a
    // request and is swallowed. No inbox row is written in this process.
    // The enqueue call itself is covered in trips/confirm.test.ts.
    expect(afterFull.notifications).toEqual([]);
  });

  dbTest("overpayment confirms and clamps amount_due at 0", async (client) => {
    const fx = await createMoneyBooking(client, { customerTotal: 100_000, depositPercent: 50 });
    const recorded = await recordWirePayment(client, {
      bookingId: fx.bookingId,
      amount: 120_000,
      paidAt: "2026-06-04",
      providerRef: "WIRE-OVER",
    });
    expect(recorded).toMatchObject({ ok: true, confirmed: true });
    const state = await ledger(client, fx.bookingId, fx.tripId);
    expect(num(state.invoice.amount_due)).toBe(0);
    expect(state.invoice.status).toBe("paid");
    expect(state.booking.status).toBe("confirmed");
    expect(state.trip.status).toBe("confirmed");
    expect(state.booking.deposit_received_at).not.toBeNull();
    expect(num(state.payments[0]?.amount)).toBe(120_000);
  });

  dbTest("rejects a cancelled booking and writes nothing", async (client) => {
    const fx = await createMoneyBooking(client, { bookingStatus: "cancelled", customerTotal: 100_000 });
    const recorded = await recordWirePayment(client, {
      bookingId: fx.bookingId,
      amount: 40_000,
      paidAt: "2026-06-01",
      providerRef: "WIRE-CANCELLED",
    });
    expect(recorded).toEqual({ ok: false, table: "bookings", message: "This booking is cancelled" });
    const state = await ledger(client, fx.bookingId, fx.tripId);
    expect(state.payments).toEqual([]);
    expect(num(state.invoice.amount_due)).toBe(100_000);
    expect(state.invoice.status).toBe("issued");
    expect(state.booking.status).toBe("cancelled");
    expect(state.trip.status).toBe("awaiting_payment");
  });

  // KOR-71 (0036) adds unique index payments_one_per_ref on
  // (booking_id, provider_ref) where status = 'paid' and provider_ref is not
  // null. recordWirePayment maps the 23505 to a clear message.
  dbTest("rejects the same provider_ref twice and leaves the ledger unchanged (KOR-71 payments_one_per_ref)", async (client) => {
    const fx = await createMoneyBooking(client, { customerTotal: 100_000, depositPercent: 50 });
    const first = await recordWirePayment(client, {
      bookingId: fx.bookingId,
      amount: 40_000,
      paidAt: "2026-06-01",
      providerRef: "WIRE-DUP",
    });
    expect(first).toMatchObject({ ok: true, confirmed: false });
    const second = await recordWirePayment(client, {
      bookingId: fx.bookingId,
      amount: 40_000,
      paidAt: "2026-06-02",
      providerRef: "WIRE-DUP",
    });
    expect(second.ok).toBe(false);
    const state = await ledger(client, fx.bookingId, fx.tripId);
    expect(state.payments).toHaveLength(1);
    expect(num(state.payments[0].amount)).toBe(40_000);
    expect(state.payments[0].provider_ref).toBe("WIRE-DUP");
    expect(num(state.invoice.amount_due)).toBe(60_000);
    expect(state.invoice.status).toBe("partially_paid");
    expect(state.booking.deposit_received_at).toBeNull();
    expect(state.trip.status).toBe("awaiting_payment");
  });
});
