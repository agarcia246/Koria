import { error, isAuthContext, json, requireBearerAuth } from "@/lib/api/auth";
import { runSearch, type SearchBody } from "@/lib/search";

export async function POST(request: Request) {
  const auth = await requireBearerAuth(request, { requireApprovedCustomer: true });
  if (!isAuthContext(auth)) return auth;

  let body: SearchBody;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON");
  }

  if (!body.origin_id || !body.destination_id || !body.departure_date || !body.passengers) {
    return error("origin_id, destination_id, departure_date, and passengers are required");
  }

  try {
    const results = await runSearch(auth.supabase, auth.userId, body);
    return json(results);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Search failed";
    const status = message === "Invalid origin or destination" ? 400 : 500;
    return error(message, status);
  }
}
