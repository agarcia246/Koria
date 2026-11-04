type PendingQuote = {
  aircraft_id: string;
  operator_amount: number;
  status: string;
  valid_until: string | null;
};

/** True when the operator already has this aircraft and amount live on the trip. */
export function hasMatchingPendingQuote(
  quotes: PendingQuote[],
  candidate: { aircraftId: string; operatorAmount: number },
  now: Date = new Date(),
): boolean {
  return quotes.some(
    (quote) =>
      quote.status === "pending" &&
      quote.aircraft_id === candidate.aircraftId &&
      Number(quote.operator_amount) === candidate.operatorAmount &&
      (quote.valid_until === null || new Date(quote.valid_until) > now),
  );
}
