import Link from "next/link";
import { adminInviteAccess, adminReviewAccess } from "@/lib/portal/actions";
import { createClient } from "@/lib/supabase/server";

const kinds = [
  { value: "", label: "All" },
  { value: "customer", label: "Customer" },
  { value: "operator", label: "Operator" },
] as const;

export default async function AccessAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const params = await searchParams;
  const kind = params.kind === "customer" || params.kind === "operator" ? params.kind : "";
  const supabase = await createClient();
  let query = supabase.from("access_requests").select("*").order("created_at", { ascending: false });
  if (kind) query = query.eq("kind", kind);
  const { data: requests } = await query;

  return (
    <div>
      <h1 className="font-display text-3xl">Access</h1>
      <div className="mt-6 flex gap-4 text-sm">
        {kinds.map((item) => {
          const active = kind === item.value;
          const href = item.value ? `/admin/access?kind=${item.value}` : "/admin/access";
          return (
            <Link key={item.label} href={href} className={active ? "text-ink underline" : "text-warm hover:text-ink"}>
              {item.label}
            </Link>
          );
        })}
      </div>

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
            <th>Kind</th>
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
                <td>{r.kind}</td>
                <td>{r.status}</td>
                <td className="text-warm">
                  {r.kind === "operator" ? (
                    <span className="block text-ink">
                      {r.company_name}
                      {r.certificate_number ? ` · ${r.certificate_number}` : ""}
                    </span>
                  ) : null}
                  {r.note}
                  {r.decision_note ? <span className="block">{r.decision_note}</span> : null}
                </td>
                <td className="text-right">
                  {r.status === "requested" && (
                    <div className="flex items-center justify-end gap-3">
                      {r.kind === "operator" ? (
                        <Link href={`/admin/operators?application=${r.id}`} className="text-xs text-warm hover:text-ink">
                          Create operator
                        </Link>
                      ) : (
                        <form action={approve}>
                          <button type="submit" className="text-xs text-warm hover:text-ink">
                            Approve
                          </button>
                        </form>
                      )}
                      <form action={decline} className="flex items-center gap-2">
                        <input
                          name="decision_note"
                          placeholder="Note to email"
                          className="w-36 border border-silver/50 bg-paper px-2 py-1 text-xs"
                        />
                        <button type="submit" className="text-xs text-warm hover:text-ink">
                          Decline
                        </button>
                      </form>
                    </div>
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
