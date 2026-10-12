import { error, json } from "@/lib/api/auth";
import { isOperatorKey, requireOperatorApiKey } from "@/lib/api/operator-key";
import { ownAircraftByTail } from "@/lib/operator-api/scope";
import { logError } from "@/lib/log";
import type { AvailabilityKind } from "@/lib/database.types";

export async function GET(request: Request) {
  const auth = await requireOperatorApiKey(request);
  if (!isOperatorKey(auth)) return auth;

  const tail = new URL(request.url).searchParams.get("tail_number");
  const { data: fleet } = await auth.supabase
    .from("aircraft")
    .select("id")
    .eq("operator_id", auth.operatorId);
  let ids = (fleet ?? []).map((row) => row.id);
  if (tail) {
    const owned = await ownAircraftByTail(auth.supabase, auth.operatorId, tail);
    if (owned.error) return error(owned.error, 500);
    ids = owned.aircraft ? [owned.aircraft.id] : [];
  }
  if (!ids.length) return json([]);

  const { data, error: dbError } = await auth.supabase
    .from("aircraft_availability")
    .select("id, aircraft_id, starts_at, ends_at, kind, notes, source")
    .in("aircraft_id", ids)
    .order("starts_at", { ascending: false });
  if (dbError) return error(dbError.message, 500);
  return json(data ?? []);
}

export async function PUT(request: Request) {
  const auth = await requireOperatorApiKey(request);
  if (!isOperatorKey(auth)) return auth;

  let body: { tail_number?: string; windows?: unknown };
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON");
  }
  if (!body.tail_number || !Array.isArray(body.windows)) {
    return error("tail_number and windows are required");
  }

  const owned = await ownAircraftByTail(auth.supabase, auth.operatorId, body.tail_number);
  if (owned.error) return error(owned.error, 500);
  if (!owned.aircraft) return error("Aircraft not on this operator", 404);

  const rows = [];
  for (const window of body.windows) {
    if (!window || typeof window !== "object") return error("Each window must be an object");
    const item = window as Record<string, unknown>;
    const starts = new Date(String(item.starts_at ?? ""));
    const ends = new Date(String(item.ends_at ?? ""));
    if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) {
      return error("Each window needs starts_at and ends_at, with end after start");
    }
    const kind: AvailabilityKind = item.kind === "available" ? "available" : "blocked";
    rows.push({
      aircraft_id: owned.aircraft.id,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      kind,
      notes: typeof item.notes === "string" ? item.notes : null,
      source: "api" as const,
    });
  }

  const { error: deleteError } = await auth.supabase
    .from("aircraft_availability")
    .delete()
    .eq("aircraft_id", owned.aircraft.id)
    .eq("source", "api");
  if (deleteError) {
    logError("supabase_write_failed", { table: "aircraft_availability", message: deleteError.message });
    return error(deleteError.message, 500);
  }

  if (rows.length) {
    const { error: insertError } = await auth.supabase.from("aircraft_availability").insert(rows);
    if (insertError) {
      logError("supabase_write_failed", { table: "aircraft_availability", message: insertError.message });
      return error(insertError.message, 500);
    }
  }

  return json({ aircraft_id: owned.aircraft.id, replaced: rows.length });
}
