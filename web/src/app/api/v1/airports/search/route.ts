import { error, isAuthContext, json, requireBearerAuth } from "@/lib/api/auth";
import { serializeAirport } from "@/lib/api/serialize";

export async function GET(request: Request) {
  const auth = await requireBearerAuth(request);
  if (!isAuthContext(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (!q) return json([]);

  const pattern = `%${q}%`;
  const { data, error: dbError } = await auth.supabase
    .from("airports")
    .select("*")
    .or(
      `icao.ilike.${pattern},iata.ilike.${pattern},name.ilike.${pattern},city.ilike.${pattern}`,
    )
    .limit(20);

  if (dbError) return error(dbError.message, 500);
  return json((data ?? []).map(serializeAirport));
}
