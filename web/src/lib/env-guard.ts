import { readBankDetails } from "@/lib/invoices/bank";

/**
 * Production startup check.
 *
 * Mail, bank details, and the public site origin fail quietly when unset:
 * sendEmail logs email_skipped, invoice creation throws after the booking
 * exists, and links fall back to localhost. Refuse to boot instead.
 *
 * KORIA_ALLOW_NO_EMAIL=1 skips only RESEND_API_KEY and EMAIL_FROM.
 * The check does not run during `next build` or on the edge runtime.
 */

const REQUIRED_PRODUCTION_ENV = [
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "KORIA_BANK_DETAILS_JSON",
  "NEXT_PUBLIC_SITE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const EMAIL_ENV = new Set<string>(["RESEND_API_KEY", "EMAIL_FROM"]);

type RequiredEnvName = (typeof REQUIRED_PRODUCTION_ENV)[number];

export function shouldAssertProductionEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    env.NODE_ENV === "production" &&
    env.NEXT_PHASE !== "phase-production-build" &&
    env.NEXT_RUNTIME === "nodejs"
  );
}

export function missingProductionEnv(env: NodeJS.ProcessEnv = process.env): RequiredEnvName[] {
  const allowNoEmail = env.KORIA_ALLOW_NO_EMAIL === "1";
  return REQUIRED_PRODUCTION_ENV.filter((name) => {
    if (allowNoEmail && EMAIL_ENV.has(name)) return false;
    const value = env[name];
    return typeof value !== "string" || value.trim() === "";
  });
}

/** Human-readable problems. Empty means production startup may continue. */
export function productionEnvProblems(env: NodeJS.ProcessEnv = process.env): string[] {
  const missing = missingProductionEnv(env);
  const problems: string[] = [];
  if (missing.length > 0) problems.push(`missing ${missing.join(", ")}`);

  const raw = env.KORIA_BANK_DETAILS_JSON;
  if (typeof raw === "string" && raw.trim() !== "") {
    const bank = readBankDetails(raw);
    if (!bank.ok) problems.push(bank.message);
  }
  return problems;
}

export function assertProductionEnv(env: NodeJS.ProcessEnv = process.env): void {
  if (!shouldAssertProductionEnv(env)) return;
  const problems = productionEnvProblems(env);
  if (problems.length === 0) return;
  throw new Error(`Refusing to start in production: ${problems.join("; ")}.`);
}
