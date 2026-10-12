import Link from "next/link";
import { adminCreateOperator } from "@/lib/portal/actions";
import { createClient } from "@/lib/supabase/server";

export default async function OperatorsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ application?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const applicationId = params.application ?? "";
  const { data: application } = applicationId
    ? await supabase
        .from("access_requests")
        .select("id, kind, status, email, company_name, certificate_number, note")
        .eq("id", applicationId)
        .maybeSingle()
    : { data: null };
  const prefill =
    application?.kind === "operator" && application.status === "requested" ? application : null;

  const { data: operators } = await supabase.from("operators").select("*").order("created_at", { ascending: false });

  const defaults: Record<string, string> = {
    certificate_type: "Part 135",
    ...(prefill
      ? {
          name: prefill.company_name ?? "",
          legal_name: prefill.company_name ?? "",
          certificate_number: prefill.certificate_number ?? "",
          contact_email: prefill.email,
          invite_email: prefill.email,
        }
      : {}),
  };

  return (
    <div>
      <h1 className="font-display text-3xl">Operators</h1>
      <p className="mt-2 text-sm text-warm">
        Portal is the real onboarding path. Seed SQL may include a demo operator for local convenience.
      </p>
      {prefill ? (
        <p className="mt-4 text-sm">
          Operator application from {prefill.email}. Creating this operator sends the invite and does not grant
          customer access.
          {prefill.note ? <span className="mt-1 block text-warm">{prefill.note}</span> : null}
        </p>
      ) : null}

      <form action={adminCreateOperator} className="mt-8 grid grid-cols-2 gap-4 max-w-2xl">
        {prefill ? <input type="hidden" name="application_id" value={prefill.id} /> : null}
        {(
          [
            ["name", "Display name"],
            ["code", "Code"],
            ["city", "City"],
            ["legal_name", "Legal name"],
            ["dba", "DBA"],
            ["certificate_number", "Certificate number"],
            ["certificate_type", "Certificate type"],
            ["contact_email", "Contact email"],
            ["contact_phone", "Contact phone"],
            ["invite_email", "Invite operator email"],
            ["default_fee_bps", "Default fee bps (optional)"],
          ] as const
        ).map(([name, label]) => (
          <label key={name} className="block text-xs uppercase tracking-wide text-warm">
            {label}
            <input
              name={name}
              required={["name", "code", "legal_name", "certificate_number"].includes(name) || (name === "invite_email" && Boolean(prefill))}
              defaultValue={defaults[name] ?? ""}
              className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2 text-sm"
            />
          </label>
        ))}
        <label className="block text-xs uppercase tracking-wide text-warm col-span-2">
          Operational control disclosure
          <textarea
            name="operational_control_disclosure"
            className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2 text-sm"
          />
        </label>
        <button type="submit" className="bg-ink text-paper px-4 py-2 text-sm w-fit">
          Create operator
        </button>
      </form>

      <table className="mt-12 w-full text-sm">
        <thead>
          <tr className="border-b border-silver/40 text-left text-xs uppercase text-warm">
            <th className="py-2">Name</th>
            <th>Code</th>
            <th>Legal</th>
            <th>Certificate</th>
            <th>Verified</th>
          </tr>
        </thead>
        <tbody>
          {(operators ?? []).map((o) => (
            <tr key={o.id} className="border-b border-silver/30">
              <td className="py-3">
                <Link href={`/admin/operators/${o.id}`} className="underline">
                  {o.name}
                </Link>
              </td>
              <td>{o.code}</td>
              <td>{o.legal_name}</td>
              <td>{o.certificate_number}</td>
              <td>{o.verified_at ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
