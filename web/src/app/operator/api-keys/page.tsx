import { cookies } from "next/headers";
import { createOperatorApiKey, dismissOperatorApiKey, revokeOperatorApiKey } from "@/lib/portal/actions";
import { requireOperatorContext } from "@/lib/portal/operator";

export default async function OperatorApiKeysPage() {
  const ctx = await requireOperatorContext();
  if (!ctx.operatorId) return <p>No operator</p>;

  const { data: membership } = await ctx.supabase
    .from("operator_members")
    .select("role")
    .eq("operator_id", ctx.operatorId)
    .eq("profile_id", ctx.userId)
    .maybeSingle();
  const isOperatorAdmin = ctx.isAdmin || membership?.role === "admin";

  const { data: keys } = await ctx.supabase
    .from("operator_api_keys")
    .select("id, key_prefix, created_at, revoked_at")
    .eq("operator_id", ctx.operatorId)
    .order("created_at", { ascending: false });

  const revealed = (await cookies()).get("operator_api_key")?.value;

  return (
    <div>
      <h1 className="font-display text-3xl">API keys</h1>
      <p className="mt-3 max-w-2xl text-sm text-warm">
        A key authorizes <span className="text-ink">/api/v1/operator</span>. The document is at{" "}
        <span className="text-ink">/api/v1/operator/openapi.json</span>. Send it as{" "}
        <span className="text-ink">Authorization: Bearer</span>. The plaintext is shown once. Only a hash is stored.
        Rate limiting is not applied.
      </p>

      {revealed ? (
        <form className="mt-6 max-w-2xl border border-silver/50 bg-ivory px-4 py-3 text-sm break-all">
          <p>Copy this key now. It stays on this page for a minute, then the cookie expires.</p>
          <p className="mt-2 font-mono text-ink">{revealed}</p>
          <button formAction={dismissOperatorApiKey} className="mt-3 text-xs text-warm hover:text-ink">
            I&apos;ve copied it
          </button>
        </form>
      ) : null}

      {isOperatorAdmin ? (
        <form action={createOperatorApiKey} className="mt-6">
          <button type="submit" className="bg-ink text-paper px-4 py-2 text-sm">
            Mint key
          </button>
        </form>
      ) : (
        <p className="mt-6 text-sm">Only an operator admin can mint or revoke keys.</p>
      )}

      <table className="mt-10 w-full text-sm">
        <thead>
          <tr className="border-b border-silver/40 text-left text-xs uppercase text-warm">
            <th className="py-2">Prefix</th>
            <th>Created</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(keys ?? []).map((key) => (
            <tr key={key.id} className="border-b border-silver/30">
              <td className="py-2 font-mono">{key.key_prefix}</td>
              <td>{new Date(key.created_at).toISOString()}</td>
              <td>{key.revoked_at ? "revoked" : "active"}</td>
              <td>
                {isOperatorAdmin && !key.revoked_at ? (
                  <form action={revokeOperatorApiKey}>
                    <input type="hidden" name="id" value={key.id} />
                    <button type="submit" className="text-xs text-warm hover:text-ink">
                      Revoke
                    </button>
                  </form>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
