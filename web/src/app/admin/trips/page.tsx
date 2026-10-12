import Link from "next/link";
import { TRIP_STATUSES } from "@/lib/trips/state";
import { createClient } from "@/lib/supabase/server";
import type { TripStatus } from "@/lib/database.types";

function searchTerm(value: string | undefined) {
  return (value ?? "").replace(/[%_,.()]/g, " ").trim();
}

export default async function AdminTripsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const status = TRIP_STATUSES.includes(params.status as TripStatus) ? (params.status as TripStatus) : "";
  const q = searchTerm(params.q);
  const supabase = await createClient();

  let airportIds: string[] = [];
  let customerIds: string[] = [];
  if (q) {
    const pattern = `"%${q.replace(/"/g, "")}%"`;
    const [{ data: airports }, { data: customers }] = await Promise.all([
      supabase.from("airports").select("id").or(`icao.ilike.${pattern},city.ilike.${pattern},name.ilike.${pattern}`).limit(40),
      supabase.from("profiles").select("id").or(`email.ilike.${pattern},display_name.ilike.${pattern}`).limit(40),
    ]);
    airportIds = (airports ?? []).map((row) => row.id);
    customerIds = (customers ?? []).map((row) => row.id);
  }

  let trips: {
    id: string;
    status: TripStatus;
    depart_at: string;
    passengers: number;
    customer_id: string;
    origin_id: string;
    destination_id: string;
  }[] = [];

  const unmatched = q && airportIds.length === 0 && customerIds.length === 0;
  if (!unmatched) {
    let query = supabase
      .from("trip_requests")
      .select("id, status, depart_at, passengers, customer_id, origin_id, destination_id")
      .order("created_at", { ascending: false })
      .limit(100);
    if (status) query = query.eq("status", status);
    if (q) {
      const filters = [
        ...airportIds.flatMap((id) => [`origin_id.eq.${id}`, `destination_id.eq.${id}`]),
        ...customerIds.map((id) => `customer_id.eq.${id}`),
      ];
      query = query.or(filters.join(","));
    }
    const { data } = await query;
    trips = data ?? [];
  }

  const originIds = [...new Set(trips.map((trip) => trip.origin_id))];
  const destinationIds = [...new Set(trips.map((trip) => trip.destination_id))];
  const profileIds = [...new Set(trips.map((trip) => trip.customer_id))];
  const airportIdList = [...new Set([...originIds, ...destinationIds])];
  const [{ data: airports }, { data: customers }] = await Promise.all([
    airportIdList.length
      ? supabase.from("airports").select("id, icao, city").in("id", airportIdList)
      : Promise.resolve({ data: [] }),
    profileIds.length
      ? supabase.from("profiles").select("id, display_name, email").in("id", profileIds)
      : Promise.resolve({ data: [] }),
  ]);
  const airportName = new Map((airports ?? []).map((airport) => [airport.id, `${airport.icao} ${airport.city}`]));
  const customerName = new Map(
    (customers ?? []).map((customer) => [customer.id, customer.display_name || customer.email || "Customer"]),
  );

  return (
    <div>
      <h1 className="font-display text-3xl">Trips</h1>
      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <label className="block text-xs uppercase tracking-wide text-warm">
          Route or customer
          <input
            name="q"
            defaultValue={params.q ?? ""}
            className="mt-1 block border border-silver/50 bg-paper px-3 py-2 text-sm normal-case tracking-normal"
          />
        </label>
        <label className="block text-xs uppercase tracking-wide text-warm">
          Status
          <select
            name="status"
            defaultValue={status}
            className="mt-1 block border border-silver/50 bg-paper px-3 py-2 text-sm normal-case tracking-normal"
          >
            <option value="">All</option>
            {TRIP_STATUSES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="bg-ink text-paper px-4 py-2 text-sm">
          Filter
        </button>
      </form>

      {trips.length === 0 ? (
        <p className="mt-8 text-sm text-warm">No trips match.</p>
      ) : (
        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-silver/40 text-left text-xs uppercase text-warm">
              <th className="py-2">Route</th>
              <th>Customer</th>
              <th>Depart</th>
              <th>Pax</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((trip) => (
              <tr key={trip.id} className="border-b border-silver/30">
                <td className="py-3">
                  <Link href={`/admin/trips/${trip.id}`} className="underline">
                    {airportName.get(trip.origin_id) ?? "—"} → {airportName.get(trip.destination_id) ?? "—"}
                  </Link>
                </td>
                <td>{customerName.get(trip.customer_id) ?? "—"}</td>
                <td>{trip.depart_at.slice(0, 16).replace("T", " ")}</td>
                <td>{trip.passengers}</td>
                <td>{trip.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
