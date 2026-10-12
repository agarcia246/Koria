/**
 * Version the API requires before a customer can request a trip.
 * Counsel bumps this when the published terms or privacy text changes.
 * The same string is shown on the marketing site (`website/src/lib/legal.ts`).
 */
export const CURRENT_TERMS_VERSION = "2026-10-pending-counsel";

export function termsAreAccepted(version: string | null | undefined): boolean {
  return version === CURRENT_TERMS_VERSION;
}
