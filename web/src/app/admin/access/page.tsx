import { adminInviteAccess, adminReviewAccess } from "@/lib/portal/actions";
import { createClient } from "@/lib/supabase/server";

export default async function AccessAdminPage() {
  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("access_requests")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="font-display text-3xl">Access</h1>

      <form action={adminInviteAccess} className="mt-8 flex gap-3 max-w-lg">
        <input
          name="email"
          type="email"
          required
          placeholder="Invite email"
          className="flex-1 border border-silver/50 bg-paper px-3 py-2 text-sm"
        />
        <button type="submit" className="bg-ink text-paper px-4 py-2 text-sm">
          Invite
        </button>
      </form>

      <table className="mt-10 w-full text-sm">
        <thead>
          <tr className="border-b border-silver/40 text-left text-xs uppercase text-warm">
            <th className="py-2">Email</th>
            <th>Status</th>
            <th>Note</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(requests ?? []).map((r) => {
            const approve = adminReviewAccess.bind(null, r.id, "approved");
            const decline = adminReviewAccess.bind(null, r.id, "declined");
            return (
              <tr key={r.id} className="border-b border-silver/30">
                <td className="py-3">{r.email}</td>
                <td>{r.status}</td>
                <td className="text-warm">{r.note}</td>
                <td className="text-right space-x-2">
                  {r.status === "requested" && (
                    <>
                      <form action={approve} className="inline">
                        <button type="submit" className="text-xs text-warm hover:text-ink">
                          Approve
                        </button>
                      </form>
                      <form action={decline} className="inline">
                        <button type="submit" className="text-xs text-warm hover:text-ink">
                          Decline
                        </button>
                      </form>
                    </>
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
