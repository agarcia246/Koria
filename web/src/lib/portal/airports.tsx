import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export type PortalAirport = {
  id: string;
  city: string;
  iata: string | null;
  icao: string;
};

/**
 * Portal airport pickers call search_airports (capped at 20). They do not
 * load the catalog. Two characters minimum so an empty page stays empty.
 */
export async function searchPortalAirports(client: Client, q: string | undefined): Promise<PortalAirport[]> {
  const query = (q ?? "").trim();
  if (query.length < 2) return [];
  const { data } = await client.rpc("search_airports", { p_q: query, p_limit: 20 });
  return (data ?? []).map((airport) => ({
    id: airport.id,
    city: airport.city,
    iata: airport.iata,
    icao: airport.icao,
  }));
}

export async function airportsByIds(client: Client, ids: string[]): Promise<PortalAirport[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return [];
  const { data } = await client.from("airports").select("id, city, iata, icao").in("id", unique);
  return data ?? [];
}

export function AirportFind({ q }: { q: string }) {
  return (
    <form method="get" className="mt-6 flex gap-2 max-w-2xl">
      <input
        name="q"
        defaultValue={q}
        placeholder="City, ICAO, or IATA"
        className="flex-1 border border-silver/50 bg-paper px-3 py-2 text-sm"
      />
      <button type="submit" className="border border-silver/50 px-3 py-2 text-sm">
        Find airport
      </button>
    </form>
  );
}
