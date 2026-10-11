import { requireOperatorContext } from "@/lib/portal/operator";

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
  const { data: trips } = tripIds.length
    ? await ctx.supabase.from("trip_requests").select("id, status").in("id", tripIds)
    : { data: [] as { id: string; status: string }[] };
  const tripStatus = new Map((trips ?? []).map((trip) => [trip.id, trip.status]));

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
            <th>Carrier</th>
          </tr>
        </thead>
        <tbody>
          {(bookings ?? []).map((b) => (
            <tr key={b.id} className="border-b border-silver/30">
              <td className="py-3 font-mono text-xs">{b.id.slice(0, 8)}</td>
              <td>{tripStatus.get(b.trip_request_id) ?? "—"}</td>
              <td>{b.status}</td>
              <td className="tabular-nums">${Number(b.customer_total).toLocaleString()}</td>
              <td>{b.operating_carrier_dba ?? b.operating_carrier_legal_name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
