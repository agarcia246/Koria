import { createAvailability } from "@/lib/portal/actions";
import { requireOperatorContext } from "@/lib/portal/operator";

export default async function AvailabilityPage() {
  const ctx = await requireOperatorContext();
  if (!ctx.operatorId) return <p>No operator</p>;

  const { data: fleet } = await ctx.supabase
    .from("aircraft")
    .select("id, tail_number")
    .eq("operator_id", ctx.operatorId);

  const ids = (fleet ?? []).map((f) => f.id);
  const fleetMap = new Map((fleet ?? []).map((f) => [f.id, f.tail_number]));
  const [{ data: blocks }, { data: airports }] = await Promise.all([
    ids.length
      ? ctx.supabase
          .from("aircraft_availability")
          .select("*")
          .in("aircraft_id", ids)
          .order("starts_at", { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
    ctx.supabase.from("airports").select("id, city, iata, icao").order("city"),
  ]);

  return (
    <div>
      <h1 className="font-display text-3xl">Availability</h1>
      <form action={createAvailability} className="mt-8 grid grid-cols-2 gap-4 max-w-2xl">
        <label className="block text-xs uppercase tracking-wide text-warm col-span-2">
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
          Kind
          <select name="kind" className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2">
            <option value="blocked">blocked</option>
            <option value="available">available</option>
          </select>
        </label>
        <label className="block text-xs uppercase tracking-wide text-warm">
          Based at
          <select name="based_at_id" className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2">
            <option value="">—</option>
            {(airports ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.city} ({a.iata ?? a.icao})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs uppercase tracking-wide text-warm">
          Starts
          <input
            type="datetime-local"
            name="starts_at"
            required
            className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2"
          />
        </label>
        <label className="block text-xs uppercase tracking-wide text-warm">
          Ends
          <input
            type="datetime-local"
            name="ends_at"
            required
            className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2"
          />
        </label>
        <button type="submit" className="col-span-2 bg-ink text-paper px-4 py-2 text-sm w-fit">
          Add block
        </button>
      </form>

      <table className="mt-10 w-full text-sm">
        <thead>
          <tr className="border-b border-silver/40 text-left text-xs uppercase text-warm">
            <th className="py-2">Aircraft</th>
            <th>Kind</th>
            <th>Start</th>
            <th>End</th>
          </tr>
        </thead>
        <tbody>
          {(blocks ?? []).map((b) => (
            <tr key={b.id} className="border-b border-silver/30">
              <td className="py-2">{fleetMap.get(b.aircraft_id)}</td>
              <td>{b.kind}</td>
              <td>{new Date(b.starts_at).toISOString()}</td>
              <td>{new Date(b.ends_at).toISOString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
