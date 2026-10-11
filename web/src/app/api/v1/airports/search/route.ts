import { error, isAuthContext, json, requireBearerAuth } from "@/lib/api/auth";
import { serializeAirport } from "@/lib/api/serialize";

export async function GET(request: Request) {
  const auth = await requireBearerAuth(request);
  if (!isAuthContext(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (!q) return json([]);

  // search_airports (0012) ranks code matches ahead of name/city and hard-caps at 20.
  // Trigram indexes on icao, iata, name, and city back the contains match.
  const { data, error: dbError } = await auth.supabase.rpc("search_airports", {
    p_q: q,
    p_limit: 20,
  });

  if (dbError) return error(dbError.message, 500);
  return json((data ?? []).map(serializeAirport));
}
