import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logError } from "@/lib/log";
import { depositIsCovered } from "@/lib/payments/deposit";
import { confirmTripAfterPayment } from "@/lib/trips/confirm";

type Client = SupabaseClient<Database>;

export function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function sumPaidPayments(
  rows: { amount: number | null; status: string | null }[],
): number {
  const total = rows
    .filter((row) => row.status === "paid")
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  return money(total);
}

/**
 * Stores a wire payment. Confirms the trip only when paid rows cover
 * customer_total. A short payment stays on the booking and leaves the trip
 * in awaiting_payment.
 */
export async function recordWirePayment(
  client: Client,
  args: { bookingId: string; amount: number; paidAt: string; providerRef: string },
): Promise<
  { ok: true; confirmed: boolean; paymentId: string } | { ok: false; table: string; message: string }
> {
  const amount = money(args.amount);
  if (!(amount > 0)) return { ok: false, table: "payments", message: "Amount must be greater than zero" };
  const providerRef = args.providerRef.trim();
  if (!providerRef) return { ok: false, table: "payments", message: "A wire reference is required" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.paidAt)) {
    return { ok: false, table: "payments", message: "Payment date is required" };
  }

  const { data: booking, error: bookingError } = await client
    .from("bookings")
    .select("id, customer_total, currency, status, deposit_percent, deposit_received_at")
    .eq("id", args.bookingId)
    .maybeSingle();
  if (bookingError || !booking) {
    const message = bookingError?.message ?? "Booking not found";
    logError("supabase_write_failed", { table: "bookings", message });
    return { ok: false, table: "bookings", message };
  }
  if (booking.status === "cancelled") {
    return { ok: false, table: "bookings", message: "This booking is cancelled" };
  }

  const { data: payment, error: insertError } = await client
    .from("payments")
    .insert({
      booking_id: booking.id,
      amount,
      currency: booking.currency,
      provider: "wire",
      provider_ref: providerRef,
      status: "paid",
      paid_at: `${args.paidAt}T00:00:00.000Z`,
    })
    .select("id")
    .single();
  if (insertError || !payment) {
    const message = insertError?.message ?? "Payment insert failed";
    logError("supabase_write_failed", { table: "payments", message });
    return { ok: false, table: "payments", message };
  }

  const { data: payments, error: paymentsError } = await client
    .from("payments")
    .select("amount, status")
    .eq("booking_id", booking.id);
  if (paymentsError) {
    logError("supabase_write_failed", { table: "payments", message: paymentsError.message });
    return { ok: false, table: "payments", message: paymentsError.message };
  }

  const paid = sumPaidPayments(payments ?? []);
  const customerTotal = money(Number(booking.customer_total));
  const amountDue = money(Math.max(0, customerTotal - paid));

  const { data: invoice, error: invoiceReadError } = await client
    .from("invoices")
    .select("id")
    .eq("booking_id", booking.id)
    .maybeSingle();
  if (invoiceReadError) {
    logError("supabase_write_failed", { table: "invoices", message: invoiceReadError.message });
    return { ok: false, table: "invoices", message: invoiceReadError.message };
  }
  if (invoice) {
    const status = amountDue <= 0 ? "paid" : paid > 0 ? "partially_paid" : "issued";
    const { error: invoiceError } = await client
      .from("invoices")
      .update({ amount_due: amountDue, status })
      .eq("id", invoice.id);
    if (invoiceError) {
      logError("supabase_write_failed", { table: "invoices", message: invoiceError.message });
      return { ok: false, table: "invoices", message: invoiceError.message };
    }
  }

  const covered = depositIsCovered(customerTotal, Number(booking.deposit_percent), paid);
  if (covered && !booking.deposit_received_at) {
    const { error: depositError } = await client
      .from("bookings")
      .update({ deposit_received_at: new Date().toISOString() })
      .eq("id", booking.id);
    if (depositError) {
      logError("supabase_write_failed", { table: "bookings", message: depositError.message });
      return { ok: false, table: "bookings", message: depositError.message };
    }
  } else if (!covered && booking.deposit_received_at) {
    const { error: depositError } = await client
      .from("bookings")
      .update({ deposit_received_at: null })
      .eq("id", booking.id);
    if (depositError) {
      logError("supabase_write_failed", { table: "bookings", message: depositError.message });
      return { ok: false, table: "bookings", message: depositError.message };
    }
  }

  if (paid + 0.001 < customerTotal) {
    return { ok: true, confirmed: false, paymentId: payment.id };
  }

  const confirmed = await confirmTripAfterPayment(client, booking.id);
  if (!confirmed.ok) {
    logError("supabase_write_failed", { table: confirmed.table, message: confirmed.error.message });
    return { ok: false, table: confirmed.table, message: confirmed.error.message };
  }
  return { ok: true, confirmed: true, paymentId: payment.id };
}
