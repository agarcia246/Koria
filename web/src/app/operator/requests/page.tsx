import Link from "next/link";
import { requireOperatorContext } from "@/lib/portal/operator";

export default async function RequestsPage() {
  const ctx = await requireOperatorContext();
  if (!ctx.operatorId) return <p>No operator</p>;

  const { data: fanout } = await ctx.supabase
    .from("trip_request_operators")
    .select("trip_id, status, created_at")
    .eq("operator_id", ctx.operatorId)
    .order("created_at", { ascending: false });

  const tripIds = (fanout ?? []).map((row) => row.trip_id);
  const { data: trips } = tripIds.length
    ? await ctx.supabase.from("trip_requests").select("*").in("id", tripIds)
    : { data: [] as never[] };
  const tripMap = new Map((trips ?? []).map((trip) => [trip.id, trip]));

  const airportIds = Array.from(
    new Set((trips ?? []).flatMap((t) => [t.origin_id, t.destination_id])),
  );
  const { data: airports } = airportIds.length
    ? await ctx.supabase.from("airports").select("id, city, iata").in("id", airportIds)
    : { data: [] as { id: string; city: string; iata: string | null }[] };
  const airportMap = new Map((airports ?? []).map((a) => [a.id, a]));

  return (
    <div>
      <h1 className="font-display text-3xl">Requests</h1>
      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b border-silver/40 text-left text-xs uppercase text-warm">
            <th className="py-2">Route</th>
            <th>Depart</th>
            <th>Pax</th>
            <th>Trip</th>
            <th>Your response</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(fanout ?? []).map((row) => {
            const trip = tripMap.get(row.trip_id);
            if (!trip) return null;
            const origin = airportMap.get(trip.origin_id);
            const dest = airportMap.get(trip.destination_id);
            return (
              <tr key={row.trip_id} className="border-b border-silver/30">
                <td className="py-3">
                  {origin?.city} → {dest?.city}
                  {trip.aircraft_id ? "" : " · route"}
                </td>
                <td>{new Date(trip.depart_at).toISOString().slice(0, 16)}</td>
                <td>{trip.passengers}</td>
                <td>{trip.status}</td>
                <td>{row.status}</td>
                <td className="text-right">
                  <Link href={`/operator/requests/${trip.id}`} className="text-warm hover:text-ink">
                    Open
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
