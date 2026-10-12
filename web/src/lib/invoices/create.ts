import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import { readBankDetails } from "@/lib/invoices/bank";
import { renderInvoicePdf } from "@/lib/invoices/pdf";
import { logError } from "@/lib/log";
import { enqueueNotification } from "@/lib/notifications/enqueue";

type Client = SupabaseClient<Database>;

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Earlier of the departure date and two UTC calendar days after issue.
 * A departure that has already passed is due on the issue date.
 */
export function invoiceDueDate(departAt: string, issuedAt = new Date()): string {
  const issueDay = issuedAt.toISOString().slice(0, 10);
  const plusTwo = new Date(issuedAt);
  plusTwo.setUTCDate(plusTwo.getUTCDate() + 2);
  const twoDays = plusTwo.toISOString().slice(0, 10);
  const departDay = new Date(departAt).toISOString().slice(0, 10);
  const earlier = departDay < twoDays ? departDay : twoDays;
  return earlier < issueDay ? issueDay : earlier;
}

export async function createInvoiceForBooking(
  client: Client,
  bookingId: string,
): Promise<{ ok: true; invoiceId: string; number: string } | { ok: false; message: string }> {
  const existing = await client
    .from("invoices")
    .select("id, number")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (existing.error) {
    logError("supabase_write_failed", { table: "invoices", message: existing.error.message });
    return { ok: false, message: existing.error.message };
  }
  if (existing.data) {
    return { ok: true, invoiceId: existing.data.id, number: existing.data.number };
  }

  const bank = readBankDetails();
  if (!bank.ok) {
    logError("invoice_create_failed", { table: "invoices", message: bank.message });
    return { ok: false, message: bank.message };
  }

  const { data: booking, error: bookingError } = await client
    .from("bookings")
    .select("id, trip_request_id, operator_amount, platform_fee_amount, taxes_amount, customer_total, currency")
    .eq("id", bookingId)
    .maybeSingle();
  if (bookingError || !booking) {
    const message = bookingError?.message ?? "Booking not found";
    logError("invoice_create_failed", { table: "bookings", message });
    return { ok: false, message };
  }

  const { data: trip, error: tripError } = await client
    .from("trip_requests")
    .select("depart_at")
    .eq("id", booking.trip_request_id)
    .maybeSingle();
  if (tripError || !trip) {
    const message = tripError?.message ?? "Trip not found";
    logError("invoice_create_failed", { table: "trip_requests", message });
    return { ok: false, message };
  }

  const lineItems: Json = [
    { kind: "operator_amount", description: "Charter", amount: money(Number(booking.operator_amount)) },
    { kind: "platform_fee", description: "Platform fee", amount: money(Number(booking.platform_fee_amount)) },
    { kind: "taxes", description: "Taxes", amount: money(Number(booking.taxes_amount)) },
  ];
  const amountDue = money(Number(booking.customer_total));
  const dueDate = invoiceDueDate(trip.depart_at);

  const { data: invoice, error: insertError } = await client
    .from("invoices")
    .insert({
      booking_id: booking.id,
      due_date: dueDate,
      currency: booking.currency,
      line_items: lineItems,
      bank_details: bank.details,
      amount_due: amountDue,
      status: "issued",
    })
    .select("id, number")
    .single();
  if (insertError || !invoice) {
    const message = insertError?.message ?? "Invoice insert failed";
    logError("invoice_create_failed", { table: "invoices", message });
    return { ok: false, message };
  }

  const pdf = await renderInvoicePdf({
    number: invoice.number,
    dueDate,
    currency: booking.currency,
    lineItems: [
      { description: "Charter", amount: money(Number(booking.operator_amount)) },
      { description: "Platform fee", amount: money(Number(booking.platform_fee_amount)) },
      { description: "Taxes", amount: money(Number(booking.taxes_amount)) },
    ],
    amountDue,
    bankDetails: bank.details as Record<string, unknown>,
  });
  const pdfPath = `${invoice.id}.pdf`;
  const { error: uploadError } = await client.storage.from("invoices").upload(pdfPath, pdf, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (uploadError) {
    logError("invoice_create_failed", { table: "invoices", message: uploadError.message });
    return { ok: false, message: uploadError.message };
  }

  const { error: pathError } = await client
    .from("invoices")
    .update({ pdf_path: pdfPath })
    .eq("id", invoice.id);
  if (pathError) {
    logError("supabase_write_failed", { table: "invoices", message: pathError.message });
    return { ok: false, message: pathError.message };
  }

  enqueueNotification("invoice_issued", {
    tripId: booking.trip_request_id,
    invoiceId: invoice.id,
  });
  return { ok: true, invoiceId: invoice.id, number: invoice.number };
}
