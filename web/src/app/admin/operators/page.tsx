import Link from "next/link";
import { adminCreateOperator } from "@/lib/portal/actions";
import { createClient } from "@/lib/supabase/server";

export default async function OperatorsAdminPage() {
  const supabase = await createClient();
  const { data: operators } = await supabase
    .from("operators")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="font-display text-3xl">Operators</h1>
      <p className="mt-2 text-sm text-warm">
        Portal is the real onboarding path. Seed SQL may include a demo operator for local convenience.
      </p>

      <form action={adminCreateOperator} className="mt-8 grid grid-cols-2 gap-4 max-w-2xl">
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
              required={["name", "code", "legal_name", "certificate_number"].includes(name)}
              defaultValue={name === "certificate_type" ? "Part 135" : undefined}
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
