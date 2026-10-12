import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminBookingsPage() {
  const supabase = await createClient();
  const { data: bookings } = await supabase
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="font-display text-3xl">Bookings</h1>
      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b border-silver/40 text-left text-xs uppercase text-warm">
            <th className="py-2">ID</th>
            <th>Status</th>
            <th>Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(bookings ?? []).map((b) => {
            return (
              <tr key={b.id} className="border-b border-silver/30">
                <td className="py-3">
                  <Link href={`/admin/bookings/${b.id}`} className="font-mono text-xs hover:underline">
                    {b.id.slice(0, 8)}
                  </Link>
                </td>
                <td>{b.status}</td>
                <td className="tabular-nums">${Number(b.customer_total).toLocaleString()}</td>
                <td className="text-right">
                  {b.status === "pending" && (
                    <Link href={`/admin/bookings/${b.id}`} className="text-xs text-warm hover:text-ink">
                      Record payment
                    </Link>
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
