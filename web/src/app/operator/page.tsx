import Link from "next/link";
import { requireOperatorContext } from "@/lib/portal/operator";

export default async function OperatorDashboard() {
  const ctx = await requireOperatorContext();
  if (!ctx.operatorId) {
    return <p className="text-warm">Admin view — join an operator or use /admin.</p>;
  }

  const { data: fleet } = await ctx.supabase
    .from("aircraft")
    .select("id")
    .eq("operator_id", ctx.operatorId);
  const aircraftIds = (fleet ?? []).map((f) => f.id);

  const [{ data: openRequests }, { data: pendingQuotes }, { data: quoteIds }] = await Promise.all([
    aircraftIds.length
      ? ctx.supabase
          .from("trip_requests")
          .select("id")
          .in("aircraft_id", aircraftIds)
          .eq("status", "requested")
      : Promise.resolve({ data: [] as { id: string }[] }),
    ctx.supabase
      .from("quotes")
      .select("id")
      .eq("operator_id", ctx.operatorId)
      .eq("status", "pending"),
    ctx.supabase.from("quotes").select("id").eq("operator_id", ctx.operatorId),
  ]);

  const qids = (quoteIds ?? []).map((q) => q.id);
  const { data: upcoming } = qids.length
    ? await ctx.supabase
        .from("bookings")
        .select("id")
        .in("quote_id", qids)
        .in("status", ["pending", "confirmed"])
    : { data: [] as { id: string }[] };

  return (
    <div>
      <h1 className="font-display text-3xl">Dashboard</h1>
      <div className="mt-8 grid grid-cols-3 gap-4">
        {[
          { label: "Open requests", count: openRequests?.length ?? 0, href: "/operator/requests" },
          {
            label: "Quotes awaiting customer",
            count: pendingQuotes?.length ?? 0,
            href: "/operator/requests",
          },
          { label: "Upcoming bookings", count: upcoming?.length ?? 0, href: "/operator/bookings" },
        ].map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="border border-silver/40 bg-ivory p-5 hover:border-champagne"
          >
            <p className="text-xs uppercase tracking-wide text-warm">{c.label}</p>
            <p className="mt-2 text-3xl tabular-nums">{c.count}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
