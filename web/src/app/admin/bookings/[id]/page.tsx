import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminMarkPaid } from "@/lib/portal/actions";

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

  const mark = adminMarkPaid.bind(null, booking.id);

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
          <dt className="text-warm">Carrier</dt>
          <dd>{booking.operating_carrier_legal_name}</dd>
        </div>
        <div className="flex justify-between border-b border-silver/30 py-2">
          <dt className="text-warm">Certificate</dt>
          <dd>{booking.certificate_number}</dd>
        </div>
      </dl>
      {booking.status === "pending" && (
        <form action={mark} className="mt-8">
          <button type="submit" className="bg-ink text-paper px-4 py-2 text-sm">
            Mark paid (stub)
          </button>
        </form>
      )}
    </div>
  );
}
