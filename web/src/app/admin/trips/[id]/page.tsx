import Link from "next/link";
import { notFound } from "next/navigation";
import {
  adminCreateTripInvoice,
  adminMarkTripCompleted,
  adminOverrideTripStatus,
  adminReassignTripAircraft,
} from "@/lib/portal/actions";
import { canTransition, TRIP_STATUSES } from "@/lib/trips/state";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

function formatDiff(diff: Json | null): string {
  if (!diff || typeof diff !== "object" || Array.isArray(diff)) return "";
  return Object.entries(diff)
    .map(([key, value]) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return "";
      const row = value as { before?: Json; after?: Json };
      const before = row.before == null ? "—" : String(row.before);
      const after = row.after == null ? "—" : String(row.after);
      return `${key}: ${before} → ${after}`;
    })
    .filter(Boolean)
    .join("\n");
}

export default async function AdminTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: trip } = await supabase.from("trip_requests").select("*").eq("id", id).maybeSingle();
  if (!trip) notFound();

  const [
    { data: customer },
    { data: origin },
    { data: destination },
    { data: fanout },
    { data: quotes },
    { data: bookingRows },
  ] = await Promise.all([
    supabase.from("profiles").select("display_name, email").eq("id", trip.customer_id).maybeSingle(),
    supabase.from("airports").select("icao, city, name").eq("id", trip.origin_id).maybeSingle(),
    supabase.from("airports").select("icao, city, name").eq("id", trip.destination_id).maybeSingle(),
    supabase.from("trip_request_operators").select("operator_id, status, decline_reason").eq("trip_id", trip.id),
    supabase
      .from("quotes")
      .select("id, operator_id, aircraft_id, operator_amount, customer_total, status, pricing_mode, valid_until")
      .eq("trip_request_id", trip.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("bookings")
      .select("id, status, customer_total, operator_amount, estimated_block_minutes, quote_id")
      .eq("trip_request_id", trip.id)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  const booking = bookingRows?.[0] ?? null;

  const [{ data: invoice }, { data: payments }, { data: payouts }] = booking
    ? await Promise.all([
        supabase.from("invoices").select("id, number, amount_due, status").eq("booking_id", booking.id).maybeSingle(),
        supabase
          .from("payments")
          .select("id, amount, status, provider_ref, paid_at")
          .eq("booking_id", booking.id)
          .order("created_at", { ascending: false }),
        supabase.from("payouts").select("id, amount, status, sent_at, reference").eq("booking_id", booking.id),
      ])
    : [{ data: null }, { data: [] as never[] }, { data: [] as never[] }];

  const operatorIds = [
    ...new Set([...(fanout ?? []).map((row) => row.operator_id), ...(quotes ?? []).map((row) => row.operator_id)]),
  ];
  const aircraftIds = [
    ...new Set([trip.aircraft_id, ...(quotes ?? []).map((row) => row.aircraft_id)].filter((value): value is string => Boolean(value))),
  ];
  const [{ data: operators }, { data: knownAircraft }, { data: fleet }] = await Promise.all([
    operatorIds.length
      ? supabase.from("operators").select("id, name").in("id", operatorIds)
      : Promise.resolve({ data: [] }),
    aircraftIds.length
      ? supabase.from("aircraft").select("id, tail_number, operator_id").in("id", aircraftIds)
      : Promise.resolve({ data: [] }),
    operatorIds.length
      ? supabase.from("aircraft").select("id, tail_number, operator_id, is_active").in("operator_id", operatorIds).order("tail_number")
      : Promise.resolve({ data: [] }),
  ]);
  const operatorName = new Map((operators ?? []).map((row) => [row.id, row.name]));
  const tail = new Map((knownAircraft ?? []).map((row) => [row.id, row.tail_number]));
  const currentTail = trip.aircraft_id ? tail.get(trip.aircraft_id) : null;

  const entityIds = [
    trip.id,
    ...(booking ? [booking.id] : []),
    ...(quotes ?? []).map((row) => row.id),
    ...(payments ?? []).map((row) => row.id),
    ...(payouts ?? []).map((row) => row.id),
  ];
  const { data: events } = await supabase
    .from("audit_events")
    .select("id, created_at, actor_role, action, summary, diff")
    .in("entity_id", entityIds)
    .order("created_at", { ascending: false })
    .limit(80);

  const allowed = TRIP_STATUSES.filter((status) => canTransition(trip.status, status));
  const override = adminOverrideTripStatus.bind(null, trip.id);
  const reassign = adminReassignTripAircraft.bind(null, trip.id);
  const createInvoice = adminCreateTripInvoice.bind(null, trip.id);
  const markCompleted = adminMarkTripCompleted.bind(null, trip.id);
  const stuck =
    (trip.status === "confirmed" || trip.status === "upcoming") &&
    !trip.return_at &&
    (booking == null || booking.estimated_block_minutes == null);
  const canInvoice = trip.status === "awaiting_payment" && booking && !invoice;

  return (
    <div className="max-w-4xl">
      <p className="text-xs uppercase tracking-wide text-warm">
        <Link href="/admin/trips" className="hover:text-ink">
          Trips
        </Link>
      </p>
      <h1 className="font-display text-3xl mt-2">
        {origin ? `${origin.icao}` : "—"} → {destination ? `${destination.icao}` : "—"}
      </h1>
      <p className="mt-2 text-sm text-warm">
        {customer?.display_name || customer?.email || "Customer"} · {trip.status}
      </p>

      <h2 className="font-display text-2xl mt-10">Request</h2>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-4 border-b border-silver/30 py-2">
          <dt className="text-warm">Route</dt>
          <dd>
            {origin ? `${origin.city} (${origin.icao})` : "—"} → {destination ? `${destination.city} (${destination.icao})` : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-silver/30 py-2">
          <dt className="text-warm">Depart</dt>
          <dd>{trip.depart_at.slice(0, 16).replace("T", " ")}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-silver/30 py-2">
          <dt className="text-warm">Return</dt>
          <dd>{trip.return_at ? trip.return_at.slice(0, 16).replace("T", " ") : "One way"}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-silver/30 py-2">
          <dt className="text-warm">Passengers</dt>
          <dd>{trip.passengers}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-silver/30 py-2">
          <dt className="text-warm">Aircraft</dt>
          <dd>{currentTail ?? "Unassigned"}</dd>
        </div>
        {trip.notes ? (
          <div className="border-b border-silver/30 py-2">
            <dt className="text-warm">Notes</dt>
            <dd className="mt-1">{trip.notes}</dd>
          </div>
        ) : null}
      </dl>

      <h2 className="font-display text-2xl mt-10">Fan-out</h2>
      {(fanout ?? []).length === 0 ? (
        <p className="mt-3 text-sm text-warm">No operator rows.</p>
      ) : (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-silver/40 text-left text-xs uppercase text-warm">
              <th className="py-2">Operator</th>
              <th>Status</th>
              <th>Decline</th>
            </tr>
          </thead>
          <tbody>
            {(fanout ?? []).map((row) => (
              <tr key={row.operator_id} className="border-b border-silver/30">
                <td className="py-2">{operatorName.get(row.operator_id) ?? row.operator_id.slice(0, 8)}</td>
                <td>{row.status}</td>
                <td>{row.decline_reason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="font-display text-2xl mt-10">Quotes</h2>
      {(quotes ?? []).length === 0 ? (
        <p className="mt-3 text-sm text-warm">No quotes.</p>
      ) : (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-silver/40 text-left text-xs uppercase text-warm">
              <th className="py-2">Operator</th>
              <th>Aircraft</th>
              <th>Status</th>
              <th>Charter</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {(quotes ?? []).map((quote) => (
              <tr key={quote.id} className="border-b border-silver/30">
                <td className="py-2">{operatorName.get(quote.operator_id) ?? "—"}</td>
                <td>{tail.get(quote.aircraft_id) ?? "—"}</td>
                <td>{quote.status}</td>
                <td className="tabular-nums">${Number(quote.operator_amount).toLocaleString()}</td>
                <td className="tabular-nums">${Number(quote.customer_total).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="font-display text-2xl mt-10">Booking</h2>
      {booking ? (
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4 border-b border-silver/30 py-2">
            <dt className="text-warm">Status</dt>
            <dd>
              <Link href={`/admin/bookings/${booking.id}`} className="underline">
                {booking.status}
              </Link>
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-silver/30 py-2">
            <dt className="text-warm">Customer total</dt>
            <dd className="tabular-nums">${Number(booking.customer_total).toLocaleString()}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-silver/30 py-2">
            <dt className="text-warm">Estimated block</dt>
            <dd>{booking.estimated_block_minutes == null ? "None" : `${booking.estimated_block_minutes} min`}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-sm text-warm">No booking.</p>
      )}

      <h2 className="font-display text-2xl mt-10">Invoice</h2>
      {invoice ? (
        <p className="mt-3 text-sm">
          {invoice.number} · {invoice.status} · ${Number(invoice.amount_due).toLocaleString()} due
        </p>
      ) : (
        <p className="mt-3 text-sm text-warm">No invoice.</p>
      )}
      {canInvoice ? (
        <form action={createInvoice} className="mt-3">
          <button type="submit" className="bg-ink text-paper px-4 py-2 text-sm">
            Create invoice
          </button>
        </form>
      ) : null}

      <h2 className="font-display text-2xl mt-10">Payments</h2>
      {(payments ?? []).length === 0 ? (
        <p className="mt-3 text-sm text-warm">No payments.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {(payments ?? []).map((payment) => (
            <li key={payment.id} className="flex justify-between border-b border-silver/30 py-2">
              <span>
                {payment.status}
                {payment.provider_ref ? ` · ${payment.provider_ref}` : ""}
              </span>
              <span className="tabular-nums">${Number(payment.amount ?? 0).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="font-display text-2xl mt-10">Payouts</h2>
      {(payouts ?? []).length === 0 ? (
        <p className="mt-3 text-sm text-warm">No payouts.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {(payouts ?? []).map((payout) => (
            <li key={payout.id} className="flex justify-between border-b border-silver/30 py-2">
              <span>
                {payout.status}
                {payout.reference ? ` · ${payout.reference}` : ""}
              </span>
              <span className="tabular-nums">${Number(payout.amount ?? 0).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="font-display text-2xl mt-10">Override status</h2>
      {allowed.length === 0 ? (
        <p className="mt-3 text-sm text-warm">No transitions from {trip.status}.</p>
      ) : (
        <form action={override} className="mt-4 space-y-3 max-w-lg">
          <label className="block text-xs uppercase tracking-wide text-warm">
            Next status
            <select name="status" className="mt-1 block w-full border border-silver/50 bg-paper px-3 py-2 text-sm normal-case tracking-normal">
              {allowed.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs uppercase tracking-wide text-warm">
            Note
            <textarea name="note" required rows={3} className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2 text-sm normal-case tracking-normal" />
          </label>
          <button type="submit" className="bg-ink text-paper px-4 py-2 text-sm">
            Apply override
          </button>
          <p className="text-sm text-warm">
            Confirming a trip uses the payment check. If paid wires do not cover the invoice, the status still changes and the audit row is marked finance_override. That path does not send booking_confirmed.
          </p>
        </form>
      )}

      <h2 className="font-display text-2xl mt-10">Reassign aircraft</h2>
      {(fleet ?? []).length === 0 ? (
        <p className="mt-3 text-sm text-warm">No aircraft from an operator already on this trip.</p>
      ) : (
        <form action={reassign} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block text-xs uppercase tracking-wide text-warm">
            Aircraft
            <select
              name="aircraft_id"
              defaultValue={trip.aircraft_id ?? ""}
              className="mt-1 block border border-silver/50 bg-paper px-3 py-2 text-sm normal-case tracking-normal"
            >
              {(fleet ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.tail_number} · {operatorName.get(row.operator_id) ?? "Operator"}
                  {row.is_active ? "" : " · inactive"}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="bg-ink text-paper px-4 py-2 text-sm">
            Reassign
          </button>
        </form>
      )}
      <p className="mt-3 text-sm text-warm">Quote and booking amounts stay as they are.</p>

      {stuck ? (
        <form action={markCompleted} className="mt-10">
          <h2 className="font-display text-2xl">Mark completed</h2>
          <p className="mt-2 text-sm text-warm">
            This trip has no return time and no estimated block minutes, so rollover cannot finish it.
          </p>
          <button type="submit" className="mt-3 border border-ink px-4 py-2 text-sm">
            Mark completed
          </button>
        </form>
      ) : null}

      <h2 className="font-display text-2xl mt-10">Audit log</h2>
      {(events ?? []).length === 0 ? (
        <p className="mt-3 text-sm text-warm">No audit events yet.</p>
      ) : (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-silver/40 text-left text-xs uppercase text-warm">
              <th className="py-2 pr-3">When</th>
              <th className="pr-3">Action</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            {(events ?? []).map((event) => {
              const diff = formatDiff(event.diff);
              return (
                <tr key={event.id} className="border-b border-silver/30 align-top">
                  <td className="py-3 pr-3 whitespace-nowrap text-warm">{event.created_at.slice(0, 16).replace("T", " ")}</td>
                  <td className="pr-3 whitespace-nowrap">
                    {event.action}
                    {event.actor_role ? <span className="block text-xs text-warm">{event.actor_role}</span> : null}
                  </td>
                  <td>
                    <p>{event.summary}</p>
                    {diff ? <pre className="mt-1 whitespace-pre-wrap text-xs text-warm">{diff}</pre> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
