import { error, isAuthContext, json, requireBearerAuth } from "@/lib/api/auth";
import { loadTripPayload } from "@/lib/trips/load";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireBearerAuth(request, { requireApprovedCustomer: true });
  if (!isAuthContext(auth)) return auth;

  const { id } = await context.params;
  const { data: trip } = await auth.supabase
    .from("trip_requests")
    .select("*")
    .eq("id", id)
    .eq("customer_id", auth.userId)
    .maybeSingle();

  if (!trip) return error("Trip not found", 404);
  const serialized = await loadTripPayload(auth.supabase, trip.id);
  return json(serialized);
}
