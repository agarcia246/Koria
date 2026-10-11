import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { logError } from "@/lib/log";

type WriteError = { message: string } | null;

/**
 * Log a failed Supabase write, report it, and send the operator back to the
 * form with the database message. No-ops when the write succeeded.
 */
export async function assertWrite(table: string, error: WriteError, returnPath: string) {
  if (!error) return;
  logError("supabase_write_failed", { table, message: error.message });
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(new Error(error.message), { tags: { table } });
  }
  const jar = await cookies();
  jar.set("portal_error", encodeURIComponent(`${table}: ${error.message}`), {
    path: "/",
    maxAge: 30,
    sameSite: "lax",
  });
  redirect(returnPath);
}
