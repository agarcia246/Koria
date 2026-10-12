import { createClient } from "@/lib/supabase/server";
import { adminMarkPayoutSent } from "@/lib/portal/actions";

export default async function AdminPayoutsPage() {
  const supabase = await createClient();
  const { data: payouts } = await supabase
    .from("payouts")
    .select("id, booking_id, amount, currency, status, sent_at, reference, operator_id")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="font-display text-3xl">Payouts</h1>
      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b border-silver/40 text-left text-xs uppercase text-warm">
            <th className="py-2">Booking</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Sent</th>
          </tr>
        </thead>
        <tbody>
          {(payouts ?? []).map((payout) => {
            const mark = adminMarkPayoutSent.bind(null, payout.id);
            return (
              <tr key={payout.id} className="border-b border-silver/30 align-top">
                <td className="py-3 font-mono text-xs">{payout.booking_id?.slice(0, 8)}</td>
                <td className="tabular-nums">
                  ${Number(payout.amount ?? 0).toLocaleString()} {payout.currency}
                </td>
                <td>{payout.status}</td>
                <td>
                  {payout.status === "unpaid" ? (
                    <form action={mark} className="flex flex-wrap items-center gap-2">
                      <input name="sent_at" type="date" required className="border border-silver/50 bg-paper px-2 py-1" />
                      <input
                        name="reference"
                        placeholder="Reference"
                        required
                        className="border border-silver/50 bg-paper px-2 py-1"
                      />
                      <button type="submit" className="bg-ink text-paper px-3 py-1 text-xs">
                        Mark sent
                      </button>
                    </form>
                  ) : (
                    <span className="text-warm">
                      {payout.sent_at?.slice(0, 10)} · {payout.reference}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
