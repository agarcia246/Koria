import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit, scalarDiff } from "@/lib/audit";
import type { Database } from "@/lib/database.types";
import { logError } from "@/lib/log";

type Client = SupabaseClient<Database>;

/**
 * Stops a cancelled trip's invoices asking for money. Paid invoices stay paid:
 * the refund row carries that money. Pass the service client. Never throws,
 * because the cancellation has already happened.
 */
export async function voidOpenInvoices(
  client: Client,
  tripId: string,
  actor: { actorRole?: string | null; actorProfileId?: string | null } = {},
): Promise<void> {
  const { data: bookings, error: bookingError } = await client
    .from("bookings")
    .select("id")
    .eq("trip_request_id", tripId);
  if (bookingError) {
    logError("supabase_write_failed", { table: "bookings", message: bookingError.message });
    return;
  }
  const bookingIds = (bookings ?? []).map((row) => row.id);
  if (bookingIds.length === 0) return;

  const { data: open, error: openError } = await client
    .from("invoices")
    .select("id, number, status, amount_due")
    .in("booking_id", bookingIds)
    .in("status", ["issued", "partially_paid"]);
  if (openError) {
    logError("supabase_write_failed", { table: "invoices", message: openError.message });
    return;
  }

  for (const invoice of open ?? []) {
    const voided = { status: "void", amount_due: 0 };
    const { error } = await client.from("invoices").update(voided).eq("id", invoice.id);
    if (error) {
      logError("supabase_write_failed", { table: "invoices", message: error.message });
      continue;
    }
    await recordAudit(client, {
      ...actor,
      action: "invoice.void",
      entityType: "trip_request",
      entityId: tripId,
      summary: `Voided invoice ${invoice.number} on cancellation`,
      diff: scalarDiff(
        { status: invoice.status, amount_due: Number(invoice.amount_due) },
        voided,
      ),
    });
  }
}
