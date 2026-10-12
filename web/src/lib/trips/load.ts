import type { createServiceClient } from "@/lib/supabase/admin";
import { serializeTrip, type TripDocumentPayload, type TripInvoicePayload } from "@/lib/api/serialize";
import { sumPaidPayments } from "@/lib/payments/record";

type Client = ReturnType<typeof createServiceClient>;

const DOCUMENT_URL_SECONDS = 10 * 60;

export async function loadTripPayload(supabase: Client, tripId: string) {
  const { data: trip } = await supabase
    .from("trip_requests")
    .select("*")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) return null;

  const [{ data: origin }, { data: destination }, { data: booking }, { data: documents }] =
    await Promise.all([
      supabase.from("airports").select("*").eq("id", trip.origin_id).single(),
      supabase.from("airports").select("*").eq("id", trip.destination_id).single(),
      supabase
        .from("bookings")
        .select("*")
        .eq("trip_request_id", trip.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("trip_documents")
        .select("id, title, storage_path")
        .eq("trip_request_id", trip.id)
        .order("created_at", { ascending: false }),
    ]);

  if (!origin || !destination) return null;

  const signed: TripDocumentPayload[] = [];
  for (const document of documents ?? []) {
    if (!document.title) continue;
    let url: string | null = null;
    if (document.storage_path) {
      const { data } = await supabase.storage
        .from("trip-documents")
        .createSignedUrl(document.storage_path, DOCUMENT_URL_SECONDS);
      url = data?.signedUrl ?? null;
    }
    signed.push({ id: document.id, title: document.title, url });
  }

  let invoice: TripInvoicePayload | null = null;
  let paid = 0;
  if (booking) {
    const { data: paymentRows } = await supabase
      .from("payments")
      .select("amount, status")
      .eq("booking_id", booking.id);
    paid = sumPaidPayments(paymentRows ?? []);
  }
  if (trip.status === "awaiting_payment" && booking) {
    const { data: row } = await supabase
      .from("invoices")
      .select("number, amount_due, due_date, bank_details")
      .eq("booking_id", booking.id)
      .maybeSingle();
    if (row) {
      invoice = {
        number: row.number,
        amount_due: Number(row.amount_due),
        due_date: row.due_date,
        bank_details: row.bank_details,
      };
    }
  }

  return serializeTrip(trip, origin, destination, booking, signed, invoice, paid);
}

