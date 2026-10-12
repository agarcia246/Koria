import { updateAircraft, uploadAircraftPhoto } from "@/lib/portal/actions";
import { AirportFind, airportsByIds, searchPortalAirports } from "@/lib/portal/airports";
import { requireOperatorContext } from "@/lib/portal/operator";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function EditAircraftPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const { q = "" } = await searchParams;
  const ctx = await requireOperatorContext();
  const { data: aircraft } = await ctx.supabase
    .from("aircraft")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!aircraft) notFound();

  const [{ data: models }, matches, currentBase, { data: photos }] = await Promise.all([
    ctx.supabase.from("aircraft_models").select("*").order("name"),
    searchPortalAirports(ctx.supabase, q),
    airportsByIds(ctx.supabase, aircraft.home_base_id ? [aircraft.home_base_id] : []),
    ctx.supabase
      .from("aircraft_photos")
      .select("*")
      .eq("aircraft_id", id)
      .order("sort_order"),
  ]);
  const airports = [...currentBase, ...matches.filter((airport) => airport.id !== aircraft.home_base_id)];

  const update = updateAircraft.bind(null, id);
  const upload = uploadAircraftPhoto.bind(null, id);

  return (
    <div className="max-w-xl">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-3xl">{aircraft.tail_number}</h1>
        <Link href={`/operator/fleet/${id}/pricing`} className="text-sm text-warm hover:text-ink">
          Pricing →
        </Link>
      </div>
      <AirportFind q={q} />
      <form action={update} className="mt-8 space-y-4">
        <label className="block text-xs uppercase tracking-wide text-warm">
          Tail
          <input
            name="tail_number"
            defaultValue={aircraft.tail_number}
            required
            className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2"
          />
        </label>
        <label className="block text-xs uppercase tracking-wide text-warm">
          Model
          <select
            name="model_id"
            defaultValue={aircraft.model_id}
            className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2"
          >
            {(models ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.manufacturer} {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs uppercase tracking-wide text-warm">
          Year
          <input
            name="year"
            type="number"
            defaultValue={aircraft.year ?? ""}
            className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2"
          />
        </label>
        <label className="block text-xs uppercase tracking-wide text-warm">
          Seating
          <input
            name="seating"
            type="number"
            defaultValue={aircraft.seating}
            required
            className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2"
          />
        </label>
        <label className="block text-xs uppercase tracking-wide text-warm">
          Interior configuration
          <input
            name="interior_configuration"
            defaultValue={aircraft.interior_configuration ?? ""}
            className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2"
          />
        </label>
        <label className="block text-xs uppercase tracking-wide text-warm">
          Baggage cu ft
          <input
            name="baggage_cu_ft"
            type="number"
            defaultValue={aircraft.baggage_cu_ft ?? ""}
            className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2"
          />
        </label>
        <label className="block text-xs uppercase tracking-wide text-warm">
          Cabin notes
          <textarea
            name="cabin_notes"
            defaultValue={aircraft.cabin_notes ?? ""}
            className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2"
          />
        </label>
        <label className="block text-xs uppercase tracking-wide text-warm">
          Home base
          <select
            name="home_base_id"
            defaultValue={aircraft.home_base_id ?? ""}
            className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2"
          >
            <option value="">—</option>
            {(airports ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.city} ({a.iata ?? a.icao})
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-4 text-sm">
          {(
            [
              ["wifi", aircraft.wifi],
              ["lavatory", aircraft.lavatory],
              ["pets", aircraft.pets],
              ["golf", aircraft.golf],
              ["skis", aircraft.skis],
              ["is_active", aircraft.is_active],
            ] as const
          ).map(([name, checked]) => (
            <label key={name} className="flex items-center gap-2">
              <input type="checkbox" name={name} defaultChecked={checked} />
              {name}
            </label>
          ))}
        </div>
        <input type="hidden" name="pricing_mode_default" value={aircraft.pricing_mode_default} />
        <button type="submit" className="bg-ink text-paper px-4 py-2 text-sm">
          Save
        </button>
      </form>

      <section className="mt-12">
        <h2 className="text-sm uppercase tracking-wide text-warm">Photos</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {(photos ?? []).map((p) => (
            <li key={p.id} className="text-warm">
              {p.storage_path}
            </li>
          ))}
        </ul>
        <form action={upload} className="mt-4 flex items-end gap-3">
          <input type="file" name="photo" accept="image/*" required />
          <button type="submit" className="border border-ink px-3 py-1.5 text-sm">
            Upload
          </button>
        </form>
      </section>
    </div>
  );
}
