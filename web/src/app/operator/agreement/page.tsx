import { acceptOperatorAgreement } from "@/lib/portal/actions";
import { CURRENT_OPERATOR_AGREEMENT, agreementIsCurrent } from "@/lib/agreements";
import { requireOperatorContext } from "@/lib/portal/operator";

export default async function OperatorAgreementPage() {
  const ctx = await requireOperatorContext();
  if (!ctx.operatorId) return <p>No operator</p>;

  const [{ data: operator }, { data: membership }] = await Promise.all([
    ctx.supabase
      .from("operators")
      .select("name, agreement_version, agreement_accepted_at, agreement_accepted_by")
      .eq("id", ctx.operatorId)
      .maybeSingle(),
    ctx.supabase
      .from("operator_members")
      .select("role")
      .eq("operator_id", ctx.operatorId)
      .eq("profile_id", ctx.userId)
      .maybeSingle(),
  ]);

  const accepter = operator?.agreement_accepted_by
    ? (
        await ctx.supabase
          .from("profiles")
          .select("display_name, email")
          .eq("id", operator.agreement_accepted_by)
          .maybeSingle()
      ).data
    : null;

  const current = agreementIsCurrent(operator?.agreement_version);
  const isOperatorAdmin = membership?.role === "admin";

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-3xl">Operator agreement</h1>
      <p className="mt-2 text-sm text-warm">
        Version {CURRENT_OPERATOR_AGREEMENT.version}
        {operator?.name ? ` · ${operator.name}` : ""}
      </p>
      <article className="mt-8 whitespace-pre-wrap border border-silver/40 bg-ivory p-4 text-sm leading-relaxed">
        {CURRENT_OPERATOR_AGREEMENT.text}
      </article>
      {current ? (
        <p className="mt-6 text-sm">
          Accepted {operator?.agreement_accepted_at?.slice(0, 10)}
          {accepter ? ` by ${accepter.display_name || accepter.email}` : ""}. Aircraft can be set active.
        </p>
      ) : (
        <p className="mt-6 text-sm">
          The current version is not accepted. Aircraft that are already active stay active. Setting an aircraft
          active fails until an operator admin accepts this version.
        </p>
      )}
      {isOperatorAdmin && !current ? (
        <form action={acceptOperatorAgreement} className="mt-6">
          <button type="submit" className="bg-ink text-paper px-4 py-2 text-sm">
            Accept agreement
          </button>
        </form>
      ) : null}
      {!isOperatorAdmin ? (
        <p className="mt-6 text-sm text-warm">Only an operator admin can accept. Members can read this page.</p>
      ) : null}
    </div>
  );
}
