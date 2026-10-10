import { error, isAuthContext, json, requireBearerAuth } from "@/lib/api/auth";
import { serializeQuote } from "@/lib/api/serialize";
import { nextStatusOnAllQuotesDeclined } from "@/lib/trips/state";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireBearerAuth(request, { requireApprovedCustomer: true });
  if (!isAuthContext(auth)) return auth;

  const { id } = await context.params;
  const { data: quote } = await auth.supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!quote) return error("Quote not found", 404);

  const { data: trip } = await auth.supabase
    .from("trip_requests")
    .select("*")
    .eq("id", quote.trip_request_id)
    .eq("customer_id", auth.userId)
    .maybeSingle();
  if (!trip) return error("Trip not found", 404);

  await auth.supabase.from("quotes").update({ status: "declined" }).eq("id", quote.id);

  const { data: pending } = await auth.supabase
    .from("quotes")
    .select("id")
    .eq("trip_request_id", trip.id)
    .eq("status", "pending");

  if (!(pending ?? []).length) {
    const next = nextStatusOnAllQuotesDeclined(trip.status);
    if (next !== trip.status) {
      await auth.supabase.from("trip_requests").update({ status: next }).eq("id", trip.id);
    }
  }

  const { data: updated } = await auth.supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .single();
  const { data: operator } = await auth.supabase
    .from("operators")
    .select("name")
    .eq("id", quote.operator_id)
    .maybeSingle();

  return json(serializeQuote(updated!, operator?.name ?? "Operator"));
}
