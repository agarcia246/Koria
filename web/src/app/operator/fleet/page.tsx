import Link from "next/link";
import { AGREEMENT_REQUIRED_MESSAGE, agreementIsCurrent } from "@/lib/agreements";
import { requireOperatorContext } from "@/lib/portal/operator";

export default async function FleetPage() {
  const ctx = await requireOperatorContext();
  if (!ctx.operatorId) return <p>No operator</p>;

  const [{ data: aircraft }, { data: operator }] = await Promise.all([
    ctx.supabase.from("aircraft").select("*").eq("operator_id", ctx.operatorId).order("tail_number"),
    ctx.supabase.from("operators").select("agreement_version").eq("id", ctx.operatorId).maybeSingle(),
  ]);
  const agreementCurrent = agreementIsCurrent(operator?.agreement_version);

  const modelIds = Array.from(new Set((aircraft ?? []).map((a) => a.model_id)));
  const { data: models } = modelIds.length
    ? await ctx.supabase.from("aircraft_models").select("id, name, manufacturer").in("id", modelIds)
    : { data: [] as { id: string; name: string; manufacturer: string }[] };
  const modelMap = new Map((models ?? []).map((m) => [m.id, m]));

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-3xl">Fleet</h1>
        <Link href="/operator/fleet/new" className="bg-ink text-paper px-4 py-2 text-sm">
          Add aircraft
        </Link>
      </div>
      {agreementCurrent ? null : (
        <p className="mt-6 max-w-xl text-sm">
          {AGREEMENT_REQUIRED_MESSAGE}{" "}
          <Link href="/operator/agreement" className="underline">
            Read the agreement
          </Link>
          . Aircraft already active stay active.
        </p>
      )}
      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b border-silver/40 text-left text-xs uppercase tracking-wide text-warm">
            <th className="py-2">Tail</th>
            <th>Model</th>
            <th>Seats</th>
            <th>Active</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(aircraft ?? []).map((ac) => {
            const model = modelMap.get(ac.model_id);
            return (
              <tr key={ac.id} className="border-b border-silver/30">
                <td className="py-3 font-medium">{ac.tail_number}</td>
                <td>
                  {model?.manufacturer} {model?.name}
                </td>
                <td>{ac.seating}</td>
                <td>{ac.is_active ? "Yes" : "No"}</td>
                <td className="text-right space-x-3">
                  <Link href={`/operator/fleet/${ac.id}`} className="text-warm hover:text-ink">
                    Edit
                  </Link>
                  <Link
                    href={`/operator/fleet/${ac.id}/pricing`}
                    className="text-warm hover:text-ink"
                  >
                    Pricing
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
