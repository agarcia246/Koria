import Link from "next/link";
import { requireOperatorContext } from "@/lib/portal/operator";

export default async function RequestsPage() {
  const ctx = await requireOperatorContext();
  if (!ctx.operatorId) return <p>No operator</p>;

  const { data: fleet } = await ctx.supabase
    .from("aircraft")
    .select("id")
    .eq("operator_id", ctx.operatorId);
  const aircraftIds = (fleet ?? []).map((f) => f.id);

  const { data: trips } = aircraftIds.length
    ? await ctx.supabase
        .from("trip_requests")
        .select("*")
        .in("aircraft_id", aircraftIds)
        .order("created_at", { ascending: false })
    : { data: [] as never[] };

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
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(trips ?? []).map((t) => {
            const origin = airportMap.get(t.origin_id);
            const dest = airportMap.get(t.destination_id);
            return (
              <tr key={t.id} className="border-b border-silver/30">
                <td className="py-3">
                  {origin?.city} → {dest?.city}
                </td>
                <td>{new Date(t.depart_at).toISOString().slice(0, 16)}</td>
                <td>{t.passengers}</td>
                <td>{t.status}</td>
                <td className="text-right">
                  <Link href={`/operator/requests/${t.id}`} className="text-warm hover:text-ink">
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
