import { createClient } from "@/lib/supabase/server";
import { financeWarnings } from "@/lib/finance";

function dollars(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function AdminFinancePage() {
  const supabase = await createClient();
  const [{ data: invoices }, { data: payouts }, { data: bookings }, { data: payments }] = await Promise.all([
    supabase.from("invoices").select("id, number, booking_id, amount_due, currency, status").order("created_at", { ascending: false }),
    supabase.from("payouts").select("id, booking_id, amount, currency, status").order("created_at", { ascending: false }),
    supabase
      .from("bookings")
      .select("id, customer_total, operator_amount, payout_adjustment, platform_fee_amount, currency")
      .order("created_at", { ascending: false }),
    supabase.from("payments").select("booking_id, amount, status"),
  ]);

  const openInvoices = (invoices ?? []).filter((invoice) => Number(invoice.amount_due) > 0);
  const unpaidPayouts = (payouts ?? []).filter((payout) => payout.status === "unpaid");
  const feeBookings = bookings ?? [];

  const receivableTotal = openInvoices.reduce((sum, invoice) => sum + Number(invoice.amount_due), 0);
  const payableTotal = unpaidPayouts.reduce((sum, payout) => sum + Number(payout.amount ?? 0), 0);
  const feeTotal = feeBookings.reduce((sum, booking) => sum + Number(booking.platform_fee_amount), 0);
  const collected = (payments ?? [])
    .filter((payment) => payment.status === "paid")
    .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);

  const warnings = financeWarnings({
    invoices: (invoices ?? []).map((invoice) => ({
      booking_id: invoice.booking_id,
      amount_due: Number(invoice.amount_due),
    })),
    bookings: feeBookings.map((booking) => ({
      id: booking.id,
      customer_total: Number(booking.customer_total),
      operator_amount: Number(booking.operator_amount),
      payout_adjustment: Number(booking.payout_adjustment),
      platform_fee_amount: Number(booking.platform_fee_amount),
    })),
    payments: payments ?? [],
    payouts: (payouts ?? []).map((payout) => ({
      booking_id: payout.booking_id,
      amount: payout.amount,
      status: payout.status,
    })),
    receivableTotal,
    payableTotal,
    feeTotal,
  });

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-3xl">Finance</h1>
      {warnings.length > 0 ? (
        <div className="mt-6 border border-red-800/40 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-medium">Reconciliation warning</p>
          <ul className="mt-2 list-disc pl-5">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-6 text-sm text-warm">
          Receivables match customer totals minus paid payments. Payables match unpaid payouts. Platform fees match
          platform_fee_amount.
        </p>
      )}

      <dl className="mt-8 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
        <div className="border border-silver/40 p-3">
          <dt className="text-xs uppercase text-warm">Receivables</dt>
          <dd className="mt-1 tabular-nums">{dollars(receivableTotal)}</dd>
        </div>
        <div className="border border-silver/40 p-3">
          <dt className="text-xs uppercase text-warm">Collected</dt>
          <dd className="mt-1 tabular-nums">{dollars(collected)}</dd>
        </div>
        <div className="border border-silver/40 p-3">
          <dt className="text-xs uppercase text-warm">Payables</dt>
          <dd className="mt-1 tabular-nums">{dollars(payableTotal)}</dd>
        </div>
        <div className="border border-silver/40 p-3">
          <dt className="text-xs uppercase text-warm">Platform fees</dt>
          <dd className="mt-1 tabular-nums">{dollars(feeTotal)}</dd>
        </div>
      </dl>

      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-wide text-warm">Receivables</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-silver/40 text-left text-xs uppercase text-warm">
              <th className="py-2">Invoice</th>
              <th>Booking</th>
              <th>Status</th>
              <th>Amount due</th>
            </tr>
          </thead>
          <tbody>
            {openInvoices.map((invoice) => (
              <tr key={invoice.id} className="border-b border-silver/30">
                <td className="py-2">{invoice.number}</td>
                <td className="font-mono text-xs">{invoice.booking_id.slice(0, 8)}</td>
                <td>{invoice.status}</td>
                <td className="tabular-nums">{dollars(Number(invoice.amount_due))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-wide text-warm">Payables</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-silver/40 text-left text-xs uppercase text-warm">
              <th className="py-2">Booking</th>
              <th>Status</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {unpaidPayouts.map((payout) => (
              <tr key={payout.id} className="border-b border-silver/30">
                <td className="py-2 font-mono text-xs">{payout.booking_id?.slice(0, 8)}</td>
                <td>{payout.status}</td>
                <td className="tabular-nums">{dollars(Number(payout.amount ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-wide text-warm">Platform fee earned</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-silver/40 text-left text-xs uppercase text-warm">
              <th className="py-2">Booking</th>
              <th>Fee</th>
            </tr>
          </thead>
          <tbody>
            {feeBookings.map((booking) => (
              <tr key={booking.id} className="border-b border-silver/30">
                <td className="py-2 font-mono text-xs">{booking.id.slice(0, 8)}</td>
                <td className="tabular-nums">{dollars(Number(booking.platform_fee_amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
