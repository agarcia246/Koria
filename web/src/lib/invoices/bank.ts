import type { Json } from "@/lib/database.types";

export const BANK_DETAILS_ENV = "KORIA_BANK_DETAILS_JSON";

/**
 * Server-only wire instructions. Missing or invalid config fails closed:
 * invoice creation must not invent an account number.
 */
export function readBankDetails():
  | { ok: true; details: Json }
  | { ok: false; message: string } {
  const raw = process.env[BANK_DETAILS_ENV]?.trim();
  if (!raw) {
    return { ok: false, message: `${BANK_DETAILS_ENV} is unset` };
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, message: `${BANK_DETAILS_ENV} must be a JSON object` };
    }
    return { ok: true, details: parsed as Json };
  } catch {
    return { ok: false, message: `${BANK_DETAILS_ENV} is not valid JSON` };
  }
}
