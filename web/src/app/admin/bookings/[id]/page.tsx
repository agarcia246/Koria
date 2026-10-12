import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminRecordPayment } from "@/lib/portal/actions";

export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!booking) notFound();

  const [{ data: payments }, { data: invoice }] = await Promise.all([
    supabase
      .from("payments")
      .select("id, amount, status, provider_ref, paid_at")
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("number, amount_due, status")
      .eq("booking_id", booking.id)
      .maybeSingle(),
  ]);

  const record = adminRecordPayment.bind(null, booking.id);
  const paid = (payments ?? [])
    .filter((payment) => payment.status === "paid")
    .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);

  return (
    <div className="max-w-lg">
      <h1 className="font-display text-3xl">Booking</h1>
      <dl className="mt-8 space-y-3 text-sm">
        <div className="flex justify-between border-b border-silver/30 py-2">
          <dt className="text-warm">Status</dt>
          <dd>{booking.status}</dd>
        </div>
        <div className="flex justify-between border-b border-silver/30 py-2">
          <dt className="text-warm">Customer total</dt>
          <dd className="tabular-nums">${Number(booking.customer_total).toLocaleString()}</dd>
        </div>
        <div className="flex justify-between border-b border-silver/30 py-2">
          <dt className="text-warm">Paid</dt>
          <dd className="tabular-nums">${paid.toLocaleString()}</dd>
        </div>
        {invoice ? (
          <div className="flex justify-between border-b border-silver/30 py-2">
            <dt className="text-warm">Invoice {invoice.number}</dt>
            <dd className="tabular-nums">
              ${Number(invoice.amount_due).toLocaleString()} due · {invoice.status}
            </dd>
          </div>
        ) : null}
        <div className="flex justify-between border-b border-silver/30 py-2">
          <dt className="text-warm">Carrier</dt>
          <dd>{booking.operating_carrier_legal_name}</dd>
        </div>
        <div className="flex justify-between border-b border-silver/30 py-2">
          <dt className="text-warm">Certificate</dt>
          <dd>{booking.certificate_number}</dd>
        </div>
      </dl>

      {(payments ?? []).length > 0 ? (
        <ul className="mt-6 space-y-2 text-sm">
          {(payments ?? []).map((payment) => (
            <li key={payment.id} className="flex justify-between border-b border-silver/20 py-2">
              <span>
                {payment.status} · {payment.provider_ref}
              </span>
              <span className="tabular-nums">${Number(payment.amount ?? 0).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {booking.status === "pending" && (
        <form action={record} className="mt-8 space-y-3">
          <h2 className="text-xs uppercase tracking-wide text-warm">Record payment</h2>
          <label className="block text-xs uppercase tracking-wide text-warm">
            Amount
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2"
            />
          </label>
          <label className="block text-xs uppercase tracking-wide text-warm">
            Date
            <input
              name="paid_at"
              type="date"
              required
              className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2"
            />
          </label>
          <label className="block text-xs uppercase tracking-wide text-warm">
            Wire reference
            <input
              name="provider_ref"
              required
              className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2"
            />
          </label>
          <button type="submit" className="bg-ink text-paper px-4 py-2 text-sm">
            Record payment
          </button>
        </form>
      )}
    </div>
  );
}
