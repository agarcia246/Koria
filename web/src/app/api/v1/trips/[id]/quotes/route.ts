import { error, isAuthContext, json, requireBearerAuth } from "@/lib/api/auth";
import { serializeQuote } from "@/lib/api/serialize";

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

  const { data: quotes } = await auth.supabase
    .from("quotes")
    .select("*")
    .eq("trip_request_id", id)
    .order("created_at", { ascending: false });

  const operatorIds = Array.from(new Set((quotes ?? []).map((q) => q.operator_id)));
  const { data: operators } = await auth.supabase
    .from("operators")
    .select("id, name")
    .in("id", operatorIds.length ? operatorIds : ["00000000-0000-0000-0000-000000000000"]);
  const nameMap = new Map((operators ?? []).map((o) => [o.id, o.name]));

  return json(
    (quotes ?? []).map((q) => serializeQuote(q, nameMap.get(q.operator_id) ?? "Operator")),
  );
}
