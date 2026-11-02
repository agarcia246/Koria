import { describe, expect } from "vitest";
import { recordCancellationRefund, refundPercent, sumRefundLiability } from "@/lib/payments/refund";
import { dbTest } from "@/test/db";
import { createMoneyBooking } from "@/test/fixtures";

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

async function pay(client: Parameters<typeof createMoneyBooking>[0], bookingId: string, amount: number) {
  const inserted = await client.from("payments").insert({
    booking_id: bookingId,
    amount,
    currency: "USD",
    provider: "wire",
    provider_ref: `WIRE-${crypto.randomUUID()}`,
    status: "paid",
    paid_at: "2026-06-01T00:00:00.000Z",
  });
  if (inserted.error) throw new Error(inserted.error.message);
}

async function refundRows(client: Parameters<typeof createMoneyBooking>[0], bookingId: string) {
  const rows = await client.from("payments").select("amount, status").eq("booking_id", bookingId);
  if (rows.error) throw new Error(rows.error.message);
  return (rows.data ?? []).filter((row) => row.status === "refund_due" || row.status === "refund_sent");
}

describe("recordCancellationRefund against seeded policies", () => {
  dbTest("seeded thresholds are 100% at 336h, 50% at 168h, and 0% below 168h", async (client) => {
    const policies = await client
      .from("refund_policies")
      .select("hours_before_departure, refund_percent, effective_from, effective_to");
    if (policies.error) throw new Error(policies.error.message);
    const rows = policies.data ?? [];
    expect(refundPercent(336, rows)).toBe(100);
    expect(refundPercent(168, rows)).toBe(50);
    expect(refundPercent(167.999, rows)).toBe(0);
  });

  dbTest("caps a full refund at the paid balance and does not write a second refund_due row", async (client) => {
    const fx = await createMoneyBooking(client, {
      customerTotal: 100_000,
      departAt: hoursFromNow(400),
      withInvoice: false,
    });
    await pay(client, fx.bookingId, 40_000);
    await recordCancellationRefund(client, fx.tripId);
    await recordCancellationRefund(client, fx.tripId);
    const due = await refundRows(client, fx.bookingId);
    expect(due).toHaveLength(1);
    expect(due[0].status).toBe("refund_due");
    expect(Number(due[0].amount)).toBe(-40_000);

    const sent = await client.from("payments").insert({
      booking_id: fx.bookingId,
      amount: -1_000,
      currency: "USD",
      provider: "wire",
      status: "refund_sent",
    });
    if (sent.error) throw new Error(sent.error.message);
    const all = await client.from("payments").select("amount, status").eq("booking_id", fx.bookingId);
    if (all.error) throw new Error(all.error.message);
    expect(sumRefundLiability(all.data ?? [])).toBe(41_000);
  });

  dbTest("a departure inside the 50% band refunds half of what was paid when that is the smaller number", async (client) => {
    const fx = await createMoneyBooking(client, {
      customerTotal: 100_000,
      departAt: hoursFromNow(200),
      withInvoice: false,
    });
    await pay(client, fx.bookingId, 100_000);
    await recordCancellationRefund(client, fx.tripId);
    const due = await refundRows(client, fx.bookingId);
    expect(due).toHaveLength(1);
    expect(Number(due[0].amount)).toBe(-50_000);
  });

  dbTest("a 0% window writes no payment row", async (client) => {
    const fx = await createMoneyBooking(client, {
      customerTotal: 100_000,
      departAt: hoursFromNow(24),
      withInvoice: false,
    });
    await pay(client, fx.bookingId, 40_000);
    await recordCancellationRefund(client, fx.tripId);
    expect(await refundRows(client, fx.bookingId)).toEqual([]);
    const all = await client.from("payments").select("id").eq("booking_id", fx.bookingId);
    if (all.error) throw new Error(all.error.message);
    expect(all.data).toHaveLength(1);
  });
});
