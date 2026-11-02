import { describe, expect, it } from "vitest";
import { scalarDiff } from "@/lib/audit";

describe("payment audit diff", () => {
  it("keeps amount, paid_at, and provider_ref for a recorded wire", () => {
    // adminRecordPayment is a server action (cookie session, revalidatePath).
    // This is the diff it passes to recordAudit. The insert is in audit.db.test.ts.
    const diff = scalarDiff(null, {
      payment_id: "pay-1",
      amount: 40_000,
      paid_at: "2026-06-01",
      provider_ref: "WIRE-40",
      status: "paid",
      confirmed: false,
    });
    expect(diff).toEqual({
      payment_id: { before: null, after: "pay-1" },
      amount: { before: null, after: 40_000 },
      paid_at: { before: null, after: "2026-06-01" },
      provider_ref: { before: null, after: "WIRE-40" },
      status: { before: null, after: "paid" },
      confirmed: { before: null, after: false },
    });
  });
});
