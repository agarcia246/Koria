import { inviteOperatorMember, setOperatorMemberRole } from "@/lib/portal/actions";
import { requireOperatorContext } from "@/lib/portal/operator";

export default async function OperatorTeamPage() {
  const ctx = await requireOperatorContext();
  if (!ctx.operatorId) return <p>No operator</p>;

  const { data: members } = await ctx.supabase
    .from("operator_members")
    .select("id, role, profile_id, created_at")
    .eq("operator_id", ctx.operatorId)
    .order("created_at");

  const ids = (members ?? []).map((member) => member.profile_id);
  const { data: profiles } = ids.length
    ? await ctx.supabase.from("profiles").select("id, display_name, email").in("id", ids)
    : { data: [] };

  const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const mine = (members ?? []).find((member) => member.profile_id === ctx.userId);
  const isOperatorAdmin = mine?.role === "admin";

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-3xl">Team</h1>
      <p className="mt-2 text-sm text-warm">
        People on this operator. A person belongs to one operator. An invite does not move someone who already
        belongs to another.
      </p>

      <ul className="mt-8 divide-y divide-silver/40 border border-silver/40">
        {(members ?? []).map((member) => {
          const profile = byId.get(member.profile_id);
          const label = profile?.display_name || profile?.email || member.profile_id;
          return (
            <li key={member.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <div>
                <p>{label}</p>
                {profile?.email && profile.display_name ? (
                  <p className="text-warm text-xs">{profile.email}</p>
                ) : null}
              </div>
              {isOperatorAdmin && member.profile_id !== ctx.userId ? (
                <form action={setOperatorMemberRole} className="flex items-center gap-2">
                  <input type="hidden" name="profile_id" value={member.profile_id} />
                  <select name="role" defaultValue={member.role} className="border border-silver/60 bg-paper px-2 py-1 text-sm">
                    <option value="admin">admin</option>
                    <option value="member">member</option>
                  </select>
                  <button type="submit" className="text-xs text-warm hover:text-ink">
                    Save role
                  </button>
                </form>
              ) : (
                <span className="text-xs uppercase tracking-wide text-warm">{member.role}</span>
              )}
            </li>
          );
        })}
      </ul>

      {isOperatorAdmin ? (
        <form action={inviteOperatorMember} className="mt-8 space-y-3">
          <h2 className="font-display text-xl">Invite</h2>
          <label className="block text-sm">
            Email
            <input
              name="email"
              type="email"
              required
              className="mt-1 block w-full border border-silver/60 bg-paper px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Role
            <select name="role" defaultValue="member" className="mt-1 block w-full border border-silver/60 bg-paper px-3 py-2">
              <option value="member">member</option>
              <option value="admin">admin</option>
            </select>
          </label>
          <button type="submit" className="bg-ink text-paper px-4 py-2 text-sm">
            Send invite
          </button>
        </form>
      ) : (
        <p className="mt-6 text-sm text-warm">Only an operator admin can invite or change roles.</p>
      )}
    </div>
  );
}
