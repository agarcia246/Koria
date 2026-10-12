import { notFound } from "next/navigation";
import { acceptPrice, cancelOperatorTrip, declineRequest, sendQuote, uploadTripDocument } from "@/lib/portal/actions";
import { requireOperatorContext } from "@/lib/portal/operator";
import { resolvePlatformFee } from "@/lib/fees";

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireOperatorContext();
  if (!ctx.operatorId) return <p>No operator</p>;

  const { data: trip } = await ctx.supabase
    .from("trip_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!trip) notFound();

  const [{ data: quotes }, { data: fleet }, { data: origin }, { data: dest }, { data: fanout }] =
    await Promise.all([
    ctx.supabase
      .from("quotes")
      .select("*")
      .eq("trip_request_id", id)
      .order("created_at", { ascending: false }),
    ctx.supabase.from("aircraft").select("id, tail_number").eq("operator_id", ctx.operatorId),
    ctx.supabase.from("airports").select("city, iata").eq("id", trip.origin_id).single(),
    ctx.supabase.from("airports").select("city, iata").eq("id", trip.destination_id).single(),
    ctx.supabase
      .from("trip_request_operators")
      .select("status")
      .eq("trip_id", id)
      .eq("operator_id", ctx.operatorId)
      .maybeSingle(),
  ]);

  const previewFee = await resolvePlatformFee(ctx.supabase, {
    operatorAmount: 10000,
    operatorId: ctx.operatorId,
  });

  const doAccept = acceptPrice.bind(null, id);
  const doDecline = declineRequest.bind(null, id);
  const doSend = sendQuote.bind(null, id);
  const doCancel = cancelOperatorTrip.bind(null, id);
  const doUpload = uploadTripDocument.bind(null, id);
  const canCancel =
    trip.status === "requested" ||
    trip.status === "quote_received" ||
    trip.status === "awaiting_payment" ||
    trip.status === "confirmed" ||
    trip.status === "upcoming";

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl">
        {origin?.city} → {dest?.city}
      </h1>
      <p className="mt-2 text-sm text-warm">
        {new Date(trip.depart_at).toISOString()} · {trip.passengers} pax · {trip.status}
        {fanout ? ` · your response ${fanout.status}` : ""}
        {trip.aircraft_id ? "" : " · route request"}
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <form action={doAccept}>
          <button type="submit" className="bg-ink text-paper px-4 py-2 text-sm">
            Accept price
          </button>
        </form>
        <form action={doDecline}>
          <button type="submit" className="border border-ink px-4 py-2 text-sm">
            Decline
          </button>
        </form>
      </div>

      {canCancel ? (
        <form action={doCancel} className="mt-6 space-y-3 border border-silver/40 p-4">
          <h2 className="text-xs uppercase tracking-wide text-warm">Cancel</h2>
          <p className="text-xs text-warm">
            While the trip is still open this withdraws only your response. Once your quote is
            accepted it cancels the trip. Cancelling does not move money.
          </p>
          <label className="block text-xs uppercase tracking-wide text-warm">
            Reason
            <input
              name="reason"
              required
              className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2"
            />
          </label>
          <button type="submit" className="border border-ink px-4 py-2 text-sm">
            {trip.status === "requested" || trip.status === "quote_received"
              ? "Withdraw our response"
              : "Cancel trip"}
          </button>
        </form>
      ) : null}

      <section className="mt-10 border border-silver/40 bg-ivory p-5">
        <h2 className="text-xs uppercase tracking-wide text-warm">Send quote / counter</h2>
        <p className="mt-2 text-xs text-warm">
          Fee preview on $10,000 operator amount: ${previewFee.platformFeeAmount.toFixed(2)} (
          {previewFee.source}
          {previewFee.bps != null ? `, ${previewFee.bps} bps` : ""})
          . Taxes are computed from the IRS rules for this route and departure. The percentage base is the operator amount plus the platform fee.
        </p>
        <form action={doSend} className="mt-4 space-y-3">
          <label className="block text-xs uppercase tracking-wide text-warm">
            Aircraft
            <select
              name="aircraft_id"
              defaultValue={trip.aircraft_id ?? ""}
              required
              className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2"
            >
              {(fleet ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.tail_number}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs uppercase tracking-wide text-warm">
            Operator amount (USD)
            <input
              name="operator_amount"
              type="number"
              step="0.01"
              required
              className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2"
            />
          </label>
          <label className="block text-xs uppercase tracking-wide text-warm">
            Parent quote (counter)
            <select name="parent_quote_id" className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2">
              <option value="">— new quote —</option>
              {(quotes ?? []).map((q) => (
                <option key={q.id} value={q.id}>
                  {q.id.slice(0, 8)} · ${Number(q.customer_total)} · {q.status}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs uppercase tracking-wide text-warm">
            Notes
            <textarea name="notes" className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2" />
          </label>
          <button type="submit" className="bg-ink text-paper px-4 py-2 text-sm">
            Send quote
          </button>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-wide text-warm">Quotes</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(quotes ?? []).map((q) => (
            <li key={q.id} className="border border-silver/30 p-3">
              <div className="flex justify-between">
                <span>{q.status}</span>
                <span className="tabular-nums">${Number(q.customer_total).toLocaleString()}</span>
              </div>
              <p className="text-xs text-warm mt-1">
                op ${Number(q.operator_amount)} + fee ${Number(q.platform_fee_amount)} + tax $
                {Number(q.taxes_amount)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 border border-silver/40 p-5">
        <h2 className="text-xs uppercase tracking-wide text-warm">Trip documents</h2>
        <form action={doUpload} className="mt-4 space-y-3">
          <label className="block text-xs uppercase tracking-wide text-warm">
            Title
            <input name="title" className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2" />
          </label>
          <input name="file" type="file" required className="text-sm" />
          <button type="submit" className="bg-ink text-paper px-4 py-2 text-sm">
            Upload
          </button>
        </form>
      </section>
    </div>
  );
}
