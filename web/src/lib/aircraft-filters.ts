/**
 * Coarse aircraft prefilter shared by search and trip fan-out.
 * SQL may only drop rows isAircraftEligible would also drop (active, seats, amenities).
 * Range and blocked windows stay in that predicate.
 */

export type CoarseAircraftRequest = {
  passengers: number;
  pets?: boolean;
  wifi_preferred?: boolean;
  golf?: boolean;
  skis?: boolean;
  baggage?: boolean;
};

/**
 * M6 KOR-45 adds operators.verified_at. Flip this on and both search and
 * fan-out start excluding operators who have not been verified. The column
 * does not exist yet, so the filter is a no-op.
 */
export const VERIFIED_OPERATORS_REQUIRED = false;

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

type VerifiedQuery = {
  not: (column: string, operator: "is", value: null) => VerifiedQuery;
};

/**
 * KOR-45 hook. Search (`runSearch`) and fan-out (`eligibleOperatorIds`) both
 * call this. When VERIFIED_OPERATORS_REQUIRED is true the query must embed
 * `operators` so `operators.verified_at` is in scope:
 * `.not("operators.verified_at", "is", null)`.
 */
export function applyVerifiedOperatorFilter<Q extends VerifiedQuery>(query: Q): Q {
  if (!VERIFIED_OPERATORS_REQUIRED) return query;
  return query.not("operators.verified_at", "is", null) as Q;
}
