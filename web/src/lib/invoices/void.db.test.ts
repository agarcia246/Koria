import { describe, expect } from "vitest";
import { voidOpenInvoices } from "@/lib/invoices/void";
import { dbTest } from "@/test/db";
import { createMoneyBooking } from "@/test/fixtures";

type Client = Parameters<typeof createMoneyBooking>[0];

async function invoiceRow(client: Client, invoiceId: string | null) {
  const row = await client.from("invoices").select("status, amount_due").eq("id", invoiceId ?? "").single();
  if (row.error) throw new Error(row.error.message);
  return row.data;
}

async function voidEvents(client: Client, tripId: string) {
  const rows = await client
    .from("audit_events")
    .select("actor_role, summary")
    .eq("entity_id", tripId)
    .eq("action", "invoice.void");
  if (rows.error) throw new Error(rows.error.message);
  return rows.data ?? [];
}

describe("voidOpenInvoices", () => {
  dbTest("voids an issued invoice, clears the amount due, and audits it", async (client) => {
    const fx = await createMoneyBooking(client, { customerTotal: 100_000, withInvoice: true });

    await voidOpenInvoices(client, fx.tripId, { actorRole: "customer", actorProfileId: null });

    const invoice = await invoiceRow(client, fx.invoiceId);
    expect(invoice.status).toBe("void");
    expect(Number(invoice.amount_due)).toBe(0);
    const events = await voidEvents(client, fx.tripId);
    expect(events).toHaveLength(1);
    expect(events[0]?.actor_role).toBe("customer");
  });

  dbTest("voids a partially paid invoice", async (client) => {
    const fx = await createMoneyBooking(client, { customerTotal: 100_000, withInvoice: true });
    const updated = await client
      .from("invoices")
      .update({ status: "partially_paid", amount_due: 50_000 })
      .eq("id", fx.invoiceId ?? "");
    if (updated.error) throw new Error(updated.error.message);

    await voidOpenInvoices(client, fx.tripId, { actorRole: "system" });

    expect((await invoiceRow(client, fx.invoiceId)).status).toBe("void");
  });

  dbTest("leaves a paid invoice alone", async (client) => {
    const fx = await createMoneyBooking(client, { customerTotal: 100_000, withInvoice: true });
    const updated = await client
      .from("invoices")
      .update({ status: "paid", amount_due: 0 })
      .eq("id", fx.invoiceId ?? "");
    if (updated.error) throw new Error(updated.error.message);

    await voidOpenInvoices(client, fx.tripId, { actorRole: "system" });

    expect((await invoiceRow(client, fx.invoiceId)).status).toBe("paid");
    expect(await voidEvents(client, fx.tripId)).toHaveLength(0);
  });
});
