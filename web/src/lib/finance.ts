export type LedgerBooking = {
  id: string;
  customer_total: number;
  operator_amount: number;
  payout_adjustment: number;
  platform_fee_amount: number;
};

export type LedgerInvoice = {
  booking_id: string;
  amount_due: number;
};

export type LedgerPayment = {
  booking_id: string | null;
  amount: number | null;
  status: string | null;
};

export type LedgerPayout = {
  booking_id: string | null;
  amount: number | null;
  status: string | null;
};

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Cross-checks the lists against the payment, payout, and fee rows.
 * A warning means the page totals would not match those sums.
 */
export function financeWarnings(args: {
  invoices: LedgerInvoice[];
  bookings: LedgerBooking[];
  payments: LedgerPayment[];
  payouts: LedgerPayout[];
  receivableTotal: number;
  payableTotal: number;
  feeTotal: number;
}): string[] {
  const warnings: string[] = [];
  const bookings = new Map(args.bookings.map((booking) => [booking.id, booking]));
  const paid = new Map<string, number>();
  for (const payment of args.payments) {
    if (payment.status !== "paid" || !payment.booking_id) continue;
    paid.set(payment.booking_id, (paid.get(payment.booking_id) ?? 0) + Number(payment.amount ?? 0));
  }

  let expectedReceivable = 0;
  for (const invoice of args.invoices) {
    if (!(invoice.amount_due > 0)) continue;
    const booking = bookings.get(invoice.booking_id);
    const collected = booking ? (paid.get(booking.id) ?? 0) : 0;
    const expected = booking ? Math.max(0, Number(booking.customer_total) - collected) : Number(invoice.amount_due);
    expectedReceivable += expected;
    if (booking && Math.abs(Number(invoice.amount_due) - expected) > 0.01) {
      warnings.push("An open invoice amount due does not match customer total minus paid payments.");
    }
  }
  if (Math.abs(money(args.receivableTotal) - money(expectedReceivable)) > 0.01) {
    warnings.push("Receivables total does not match customer totals minus paid payments.");
  }

  let expectedPayable = 0;
  let payoutGap = 0;
  for (const payout of args.payouts) {
    if (!payout.booking_id) continue;
    const booking = bookings.get(payout.booking_id);
    if (!booking) continue;
    const expected = Number(booking.operator_amount) - Number(booking.payout_adjustment);
    payoutGap += Math.abs(Number(payout.amount ?? 0) - expected);
    if (payout.status === "unpaid") expectedPayable += Number(payout.amount ?? 0);
  }
  if (payoutGap > 0.05) {
    warnings.push("A payout amount does not match operator amount minus the stored adjustment.");
  }
  if (Math.abs(money(args.payableTotal) - money(expectedPayable)) > 0.01) {
    warnings.push("Payables total does not match unpaid payouts.");
  }

  const expectedFees = args.bookings.reduce((sum, booking) => sum + Number(booking.platform_fee_amount), 0);
  if (Math.abs(money(args.feeTotal) - money(expectedFees)) > 0.01) {
    warnings.push("Platform fee total does not match the sum of platform_fee_amount.");
  }

  return Array.from(new Set(warnings));
}
