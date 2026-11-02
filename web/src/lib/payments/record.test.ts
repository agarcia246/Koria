import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";
import { depositIsCovered, depositThreshold } from "@/lib/payments/deposit";
import { money, recordWirePayment, sumPaidPayments } from "@/lib/payments/record";

function clientThatMustNotBeTouched(): SupabaseClient<Database> {
  return {
    from() {
      throw new Error("recordWirePayment touched the client");
    },
  } as unknown as SupabaseClient<Database>;
}

describe("money and paid sums", () => {
  it("rounds to cents", () => {
    expect(money(0.1 + 0.2)).toBe(0.3);
    expect(money(100_000)).toBe(100_000);
  });

  it("sums only paid rows", () => {
    expect(
      sumPaidPayments([
        { amount: 40_000, status: "paid" },
        { amount: 10_000, status: "paid" },
        { amount: -40_000, status: "refund_due" },
        { amount: 5, status: "refund_sent" },
      ]),
    ).toBe(50_000);
  });
});

describe("deposit cover used by recordWirePayment", () => {
  it("treats 50% of 100,000 as 50,000", () => {
    expect(depositThreshold(100_000, 50)).toBe(50_000);
    expect(depositIsCovered(100_000, 50, 40_000)).toBe(false);
    expect(depositIsCovered(100_000, 50, 50_000)).toBe(true);
  });
});

describe("recordWirePayment rejects bad input before any write", () => {
  const client = clientThatMustNotBeTouched();

  it("rejects a non-positive amount", async () => {
    for (const amount of [0, -1, 0.004]) {
      const result = await recordWirePayment(client, {
        bookingId: "00000000-0000-0000-0000-000000000001",
        amount,
        paidAt: "2026-06-01",
        providerRef: "WIRE-1",
      });
      expect(result).toEqual({ ok: false, table: "payments", message: "Amount must be greater than zero" });
    }
  });

  it("rejects an empty wire reference", async () => {
    const result = await recordWirePayment(client, {
      bookingId: "00000000-0000-0000-0000-000000000001",
      amount: 40_000,
      paidAt: "2026-06-01",
      providerRef: "   ",
    });
    expect(result).toEqual({ ok: false, table: "payments", message: "A wire reference is required" });
  });

  it("rejects a date that is not YYYY-MM-DD", async () => {
    for (const paidAt of ["", "06-01-2026", "2026-6-01", "2026-06-01T00:00:00.000Z"]) {
      const result = await recordWirePayment(client, {
        bookingId: "00000000-0000-0000-0000-000000000001",
        amount: 40_000,
        paidAt,
        providerRef: "WIRE-1",
      });
      expect(result).toEqual({ ok: false, table: "payments", message: "Payment date is required" });
    }
  });
});
