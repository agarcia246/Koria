import { describe, expect } from "vitest";
import { recordAudit, scalarDiff } from "@/lib/audit";
import { dbTest } from "@/test/db";

describe("recordAudit payment.record", () => {
  dbTest("writes amount, paid_at, and provider_ref", async (client) => {
    // Lowest layer under adminRecordPayment. That action also checks the
    // admin cookie and calls revalidatePath, which this process cannot do.
    const bookingId = crypto.randomUUID();
    const paymentId = crypto.randomUUID();
    await recordAudit(client, {
      action: "payment.record",
      entityType: "booking",
      entityId: bookingId,
      summary: "Recorded a wire payment of 40000",
      diff: scalarDiff(null, {
        payment_id: paymentId,
        amount: 40_000,
        paid_at: "2026-06-01",
        provider_ref: "WIRE-40",
        status: "paid",
        confirmed: false,
      }),
    });

    const rows = await client.from("audit_events").select("action, entity_type, summary, diff").eq("entity_id", bookingId);
    if (rows.error) throw new Error(rows.error.message);
    expect(rows.data).toHaveLength(1);
    expect(rows.data?.[0]).toMatchObject({
      action: "payment.record",
      entity_type: "booking",
      summary: "Recorded a wire payment of 40000",
    });
    expect(rows.data?.[0]?.diff).toMatchObject({
      amount: { before: null, after: 40_000 },
      paid_at: { before: null, after: "2026-06-01" },
      provider_ref: { before: null, after: "WIRE-40" },
    });
  });
});
