import { describe, expect, it } from "vitest";
import { financeWarnings } from "@/lib/finance";

describe("financeWarnings", () => {
  it("flags an invoice that does not match customer total minus paid payments", () => {
    expect(
      financeWarnings({
        invoices: [{ booking_id: "b1", amount_due: 80_000 }],
        bookings: [
          {
            id: "b1",
            customer_total: 100_000,
            operator_amount: 90_000,
            payout_adjustment: 0,
            platform_fee_amount: 10_000,
          },
        ],
        payments: [{ booking_id: "b1", amount: 40_000, status: "paid" }],
        payouts: [],
        receivableTotal: 80_000,
        payableTotal: 0,
        feeTotal: 10_000,
      }),
    ).toContain("An open invoice amount due does not match customer total minus paid payments.");
  });

  it("does not flag a missing tax rule kind", () => {
    // computeTaxes puts the kind on ruleSnapshot.missing_kinds.
    // financeWarnings only reconciles invoices, payments, payouts, and fees.
    // A missing domestic_fet or segment rule never reaches this function.
    expect(
      financeWarnings({
        invoices: [],
        bookings: [],
        payments: [],
        payouts: [],
        receivableTotal: 0,
        payableTotal: 0,
        feeTotal: 0,
      }),
    ).toEqual([]);
  });
});
