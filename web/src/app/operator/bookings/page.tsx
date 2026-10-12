import { requireOperatorContext } from "@/lib/portal/operator";
import { uploadTripDocument } from "@/lib/portal/actions";

export default async function BookingsPage() {
  const ctx = await requireOperatorContext();
  if (!ctx.operatorId) return <p>No operator</p>;

  const { data: quotes } = await ctx.supabase
    .from("quotes")
    .select("id")
    .eq("operator_id", ctx.operatorId);
  const quoteIds = (quotes ?? []).map((q) => q.id);

  const { data: bookings } = quoteIds.length
    ? await ctx.supabase
        .from("bookings")
        .select("*")
        .in("quote_id", quoteIds)
        .order("created_at", { ascending: false })
    : { data: [] as never[] };

  const tripIds = Array.from(new Set((bookings ?? []).map((b) => b.trip_request_id)));
  const bookingIds = (bookings ?? []).map((b) => b.id);
  const [{ data: trips }, { data: payouts }] = await Promise.all([
    tripIds.length
      ? ctx.supabase.from("trip_requests").select("id, status").in("id", tripIds)
      : Promise.resolve({ data: [] as { id: string; status: string }[] }),
    bookingIds.length
      ? ctx.supabase.from("payouts").select("booking_id, status").in("booking_id", bookingIds)
      : Promise.resolve({ data: [] as { booking_id: string | null; status: string | null }[] }),
  ]);
  const tripStatus = new Map((trips ?? []).map((trip) => [trip.id, trip.status]));
  const payoutStatus = new Map((payouts ?? []).map((payout) => [payout.booking_id, payout.status]));

  return (
    <div>
      <h1 className="font-display text-3xl">Bookings</h1>
      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b border-silver/40 text-left text-xs uppercase text-warm">
            <th className="py-2">ID</th>
            <th>Trip</th>
            <th>Booking</th>
            <th>Total</th>
            <th>Payout</th>
            <th>Carrier</th>
            <th>Document</th>
          </tr>
        </thead>
        <tbody>
          {(bookings ?? []).map((b) => (
            <tr key={b.id} className="border-b border-silver/30">
              <td className="py-3 font-mono text-xs">{b.id.slice(0, 8)}</td>
              <td>{tripStatus.get(b.trip_request_id) ?? "—"}</td>
              <td>{b.status}</td>
              <td className="tabular-nums">${Number(b.customer_total).toLocaleString()}</td>
              <td>{payoutStatus.get(b.id) ?? "—"}</td>
              <td>{b.operating_carrier_dba ?? b.operating_carrier_legal_name}</td>
              <td>
                <form action={uploadTripDocument.bind(null, b.trip_request_id)} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="return_path" value="/operator/bookings" />
                  <input name="title" placeholder="Title" className="w-28 border border-silver/50 bg-paper px-2 py-1" />
                  <input name="file" type="file" required className="max-w-40 text-xs" />
                  <button type="submit" className="border border-ink px-2 py-1 text-xs">
                    Upload
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
