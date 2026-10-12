import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Coarse aircraft prefilter shared by search and trip fan-out.
 * SQL may only drop rows isAircraftEligible would also drop (active, seats, amenities).
 * Range and blocked windows stay in that predicate.
 */

function aircraftTable(client: SupabaseClient<Database>) {
  return client.from("aircraft");
}

function aircraftRows(client: SupabaseClient<Database>) {
  return client.from("aircraft").select("*");
}

type AircraftBuilder = ReturnType<typeof aircraftTable>;
type AircraftFilter = ReturnType<typeof aircraftRows>;

// Keep the helpers in value position so their return types stay available.
void aircraftTable;
void aircraftRows;

export type CoarseAircraftRequest = {
  passengers: number;
  pets?: boolean;
  wifi_preferred?: boolean;
  golf?: boolean;
  skis?: boolean;
  baggage?: boolean;
};

/**
 * Search and fan-out exclude operators with a null verified_at.
 * Unverified operators still use the portal.
 */
export const VERIFIED_OPERATORS_REQUIRED = true;

const VERIFIED_OPERATOR_SELECT = "*, operators!inner(verified_at)";

type CoarseQuery = {
  eq: (column: string, value: boolean) => CoarseQuery;
  gte: (column: string, value: number) => CoarseQuery;
  gt: (column: string, value: number) => CoarseQuery;
};

export function applyCoarseAircraftFilters<Q extends CoarseQuery>(
  query: Q,
  request: CoarseAircraftRequest,
): Q {
  let next: CoarseQuery = query.eq("is_active", true).gte("seating", request.passengers);
  if (request.pets) next = next.eq("pets", true);
  if (request.wifi_preferred) next = next.eq("wifi", true);
  if (request.golf) next = next.eq("golf", true);
  if (request.skis) next = next.eq("skis", true);
  if (request.baggage) next = next.gt("baggage_cu_ft", 0);
  return next as Q;
}

/**
 * Search (`runSearch`) and fan-out (`eligibleOperatorIds`) both call this
 * on `from("aircraft")`, before other filters. The select embeds `operators`
 * and drops rows whose `verified_at` is null. The result is typed as an
 * aircraft row; the embedded operator is only there for the filter.
 */
export function applyVerifiedOperatorFilter(query: AircraftBuilder): AircraftFilter {
  if (!VERIFIED_OPERATORS_REQUIRED) return query.select("*");
  return query
    .select(VERIFIED_OPERATOR_SELECT)
    .not("operators.verified_at", "is", null) as unknown as AircraftFilter;
}
