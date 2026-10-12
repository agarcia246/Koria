/**
 * One server-side source for the Part 295 broker disclosure.
 * Counsel replaces `text` and bumps `version`. New quotes copy both into
 * `carrier_disclosure_snapshot`. New bookings copy `text` onto
 * `broker_role_disclosure`. Existing rows are not rewritten.
 */
export const CURRENT_BROKER_DISCLOSURE = {
  version: "2026-10-pending-counsel",
  text: "PENDING COUNSEL. KORIA acts as an air charter broker, not the operator of the aircraft. The direct air carrier named on this trip has operational control.",
} as const;

export const BROKER_DISCLOSURE = CURRENT_BROKER_DISCLOSURE.text;

export function brokerDisclosureFields() {
  return {
    broker_role_disclosure: CURRENT_BROKER_DISCLOSURE.text,
    broker_disclosure_version: CURRENT_BROKER_DISCLOSURE.version,
  };
}

/** Text frozen on the quote. Missing snapshots fall back to the current version. */
export function brokerDisclosureTextFromSnapshot(
  snapshot: Record<string, unknown> | null | undefined,
): string {
  const text = snapshot?.broker_role_disclosure;
  if (typeof text === "string" && text.length > 0) return text;
  return CURRENT_BROKER_DISCLOSURE.text;
}

export const CATEGORY_API: Record<string, string> = {
  very_light: "veryLight",
  light: "light",
  midsize: "midsize",
  super_midsize: "superMidsize",
  heavy: "heavy",
  ultra_long_range: "ultraLongRange",
};
