import { createAircraft } from "@/lib/portal/actions";
import { requireOperatorContext } from "@/lib/portal/operator";

export default async function NewAircraftPage() {
  const ctx = await requireOperatorContext();
  const [{ data: models }, { data: airports }] = await Promise.all([
    ctx.supabase.from("aircraft_models").select("*").order("name"),
    ctx.supabase.from("airports").select("id, icao, iata, city").order("city"),
  ]);

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-3xl">New aircraft</h1>
      <form action={createAircraft} className="mt-8 space-y-4">
        <Field label="Tail number" name="tail_number" required />
        <label className="block text-xs uppercase tracking-wide text-warm">
          Model
          <select name="model_id" required className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2">
            {(models ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.manufacturer} {m.name}
              </option>
            ))}
          </select>
        </label>
        <Field label="Year" name="year" type="number" />
        <Field label="Seating" name="seating" type="number" required />
        <Field label="Interior configuration" name="interior_configuration" />
        <Field label="Baggage cu ft" name="baggage_cu_ft" type="number" />
        <Field label="Cabin notes" name="cabin_notes" />
        <label className="block text-xs uppercase tracking-wide text-warm">
          Home base
          <select name="home_base_id" className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2">
            <option value="">—</option>
            {(airports ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.city} ({a.iata ?? a.icao})
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-4 text-sm">
          {["wifi", "lavatory", "pets", "golf", "skis", "is_active"].map((name) => (
            <label key={name} className="flex items-center gap-2">
              <input type="checkbox" name={name} defaultChecked={name === "is_active"} />
              {name}
            </label>
          ))}
        </div>
        <button type="submit" className="bg-ink text-paper px-4 py-2 text-sm">
          Create
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-xs uppercase tracking-wide text-warm">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2 text-sm text-ink"
      />
    </label>
  );
}
