import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logError } from "@/lib/log";
import { money, sumPaidPayments } from "@/lib/payments/record";

type Client = SupabaseClient<Database>;

export type RefundPolicy = {
  hours_before_departure: number;
  refund_percent: number;
  effective_from: string;
  effective_to: string | null;
};

/** Greatest threshold that is still <= hours remaining. No match is 0%. */
export function refundPercent(hoursUntilDeparture: number, policies: RefundPolicy[], at = new Date()): number {
  const day = at.toISOString().slice(0, 10);
  const active = policies.filter((policy) => {
    const from = policy.effective_from.slice(0, 10);
    const to = policy.effective_to ? policy.effective_to.slice(0, 10) : null;
    return from <= day && (to == null || to >= day);
  });
  const eligible = active
    .filter((policy) => Number(policy.hours_before_departure) <= hoursUntilDeparture)
    .sort((a, b) => Number(b.hours_before_departure) - Number(a.hours_before_departure));
  return Number(eligible[0]?.refund_percent ?? 0);
}

export function sumRefundLiability(
  rows: { amount: number | null; status: string | null }[],
): number {
  const total = rows
    .filter((row) => row.status === "refund_due" || row.status === "refund_sent")
    .reduce((sum, row) => sum + Math.abs(Number(row.amount ?? 0)), 0);
  return money(total);
}

export function refundAmount(customerTotal: number, percent: number, paid: number): number {
  const owed = money((customerTotal * percent) / 100);
  return money(Math.min(owed, Math.max(0, paid)));
}

/**
 * Records a refund liability. Does not send money. Skips when nothing was
 * paid, when the computed refund is zero, or when a refund row already exists.
 */
export async function recordCancellationRefund(client: Client, tripId: string): Promise<void> {
  const { data: trip, error: tripError } = await client
    .from("trip_requests")
    .select("id, depart_at")
    .eq("id", tripId)
    .maybeSingle();
  if (tripError || !trip) {
    logError("supabase_write_failed", {
      table: "trip_requests",
      message: tripError?.message ?? "Trip not found",
    });
    return;
  }

  const { data: booking, error: bookingError } = await client
    .from("bookings")
    .select("id, customer_total, currency")
    .eq("trip_request_id", tripId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (bookingError || !booking) return;

  const { data: payments, error: paymentsError } = await client
    .from("payments")
    .select("amount, status")
    .eq("booking_id", booking.id);
  if (paymentsError) {
    logError("supabase_write_failed", { table: "payments", message: paymentsError.message });
    return;
  }
  const rows = payments ?? [];
  if (rows.some((row) => row.status === "refund_due" || row.status === "refund_sent")) return;
  const paid = sumPaidPayments(rows);
  if (paid <= 0) return;

  const { data: policies, error: policyError } = await client
    .from("refund_policies")
    .select("hours_before_departure, refund_percent, effective_from, effective_to");
  if (policyError) {
    logError("supabase_write_failed", { table: "refund_policies", message: policyError.message });
    return;
  }

  const hours = (new Date(trip.depart_at).getTime() - Date.now()) / 3_600_000;
  const percent = refundPercent(hours, policies ?? []);
  const amount = refundAmount(Number(booking.customer_total), percent, paid);
  if (amount <= 0) return;

  const { error: insertError } = await client.from("payments").insert({
    booking_id: booking.id,
    amount: money(-amount),
    currency: booking.currency,
    provider: "wire",
    status: "refund_due",
  });
  if (insertError) {
    logError("supabase_write_failed", { table: "payments", message: insertError.message });
  }
}
