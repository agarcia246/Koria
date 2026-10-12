import { createEmptyLeg, withdrawEmptyLeg } from "@/lib/portal/actions";
import { AirportFind, airportsByIds, searchPortalAirports } from "@/lib/portal/airports";
import { requireOperatorContext } from "@/lib/portal/operator";

export default async function EmptyLegsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requireOperatorContext();
  if (!ctx.operatorId) return <p>No operator</p>;
  const { q = "" } = await searchParams;

  const [{ data: fleet }, { data: legs }] = await Promise.all([
    ctx.supabase.from("aircraft").select("id, tail_number").eq("operator_id", ctx.operatorId),
    ctx.supabase
      .from("empty_legs")
      .select("*")
      .eq("operator_id", ctx.operatorId)
      .order("depart_at", { ascending: false }),
  ]);

  const listedIds = (legs ?? []).flatMap((leg) => [leg.origin_id, leg.destination_id]);
  const [airports, listed] = await Promise.all([
    searchPortalAirports(ctx.supabase, q),
    airportsByIds(ctx.supabase, listedIds),
  ]);
  const airportMap = new Map([...listed, ...airports].map((airport) => [airport.id, airport]));

  return (
    <div>
      <h1 className="font-display text-3xl">Empty legs</h1>
      <AirportFind q={q} />
      <form action={createEmptyLeg} className="mt-8 grid grid-cols-2 gap-4 max-w-2xl">
        <label className="block text-xs uppercase tracking-wide text-warm">
          Aircraft
          <select name="aircraft_id" required className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2">
            {(fleet ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.tail_number}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs uppercase tracking-wide text-warm">
          Depart
          <input type="datetime-local" name="depart_at" required className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2" />
        </label>
        <label className="block text-xs uppercase tracking-wide text-warm">
          Origin
          <select name="origin_id" required className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2">
            {(airports ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.city} ({a.iata ?? a.icao})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs uppercase tracking-wide text-warm">
          Destination
          <select name="destination_id" required className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2">
            {(airports ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.city} ({a.iata ?? a.icao})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs uppercase tracking-wide text-warm">
          Seats available
          <input type="number" name="seats_available" className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2" />
        </label>
        <label className="block text-xs uppercase tracking-wide text-warm">
          Price
          <input type="number" name="price" step="0.01" className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2" />
        </label>
        <label className="block text-xs uppercase tracking-wide text-warm">
          Pricing mode
          <select name="pricing_mode" className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2">
            <option value="estimated">estimated</option>
            <option value="live">live</option>
            <option value="quote_required">quote_required</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm mt-6">
          <input type="checkbox" name="whole_aircraft" defaultChecked />
          Whole aircraft
        </label>
        <button type="submit" className="col-span-2 bg-ink text-paper px-4 py-2 text-sm w-fit">
          Publish empty leg
        </button>
      </form>

      <table className="mt-10 w-full text-sm">
        <thead>
          <tr className="border-b border-silver/40 text-left text-xs uppercase text-warm">
            <th className="py-2">Route</th>
            <th>Depart</th>
            <th>Status</th>
            <th>Price</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(legs ?? []).map((leg) => {
            const origin = airportMap.get(leg.origin_id);
            const dest = airportMap.get(leg.destination_id);
            const withdraw = withdrawEmptyLeg.bind(null, leg.id);
            return (
              <tr key={leg.id} className="border-b border-silver/30">
                <td className="py-2">
                  {origin?.city} → {dest?.city}
                </td>
                <td>{new Date(leg.depart_at).toISOString().slice(0, 16)}</td>
                <td>{leg.status}</td>
                <td>{leg.price ?? "—"}</td>
                <td className="text-right">
                  {leg.status === "published" && (
                    <form action={withdraw}>
                      <button type="submit" className="text-warm hover:text-ink text-xs">
                        Withdraw
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
