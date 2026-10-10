import { upsertPricing } from "@/lib/portal/actions";
import { requireOperatorContext } from "@/lib/portal/operator";
import { notFound } from "next/navigation";

export default async function PricingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireOperatorContext();
  const { data: aircraft } = await ctx.supabase
    .from("aircraft")
    .select("tail_number")
    .eq("id", id)
    .maybeSingle();
  if (!aircraft) notFound();

  const { data: rule } = await ctx.supabase
    .from("aircraft_pricing_rules")
    .select("*")
    .eq("aircraft_id", id)
    .maybeSingle();

  const save = upsertPricing.bind(null, id);

  return (
    <div className="max-w-md">
      <h1 className="font-display text-3xl">Pricing · {aircraft.tail_number}</h1>
      <form action={save} className="mt-8 space-y-4">
        <label className="block text-xs uppercase tracking-wide text-warm">
          Mode
          <select
            name="mode"
            defaultValue={rule?.mode ?? "quote_required"}
            className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2"
          >
            <option value="live">live</option>
            <option value="estimated">estimated</option>
            <option value="quote_required">quote_required</option>
          </select>
        </label>
        {(
          [
            ["hourly_rate", rule?.hourly_rate],
            ["minimum", rule?.minimum],
            ["per_nm", rule?.per_nm],
            ["positioning_fee", rule?.positioning_fee],
          ] as const
        ).map(([name, value]) => (
          <label key={name} className="block text-xs uppercase tracking-wide text-warm">
            {name}
            <input
              name={name}
              type="number"
              step="0.01"
              defaultValue={value ?? ""}
              className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2"
            />
          </label>
        ))}
        <button type="submit" className="bg-ink text-paper px-4 py-2 text-sm">
          Save pricing
        </button>
      </form>
    </div>
  );
}
