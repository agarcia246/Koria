import Link from "next/link";
import { notFound } from "next/navigation";
import {
  adminClearOperatorVerification,
  adminMarkOperatorVerified,
  adminSaveCertificateReview,
  adminUploadInsuranceCertificate,
} from "@/lib/portal/actions";
import { faaRegistryLookupUrl } from "@/lib/operators/faa";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

function formatDiff(diff: Json | null): string {
  if (!diff || typeof diff !== "object" || Array.isArray(diff)) return "";
  return Object.entries(diff)
    .map(([key, value]) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return "";
      const row = value as { before?: Json; after?: Json };
      const before = row.before == null ? "—" : String(row.before);
      const after = row.after == null ? "—" : String(row.after);
      return `${key}: ${before} → ${after}`;
    })
    .filter(Boolean)
    .join("\n");
}

export default async function AdminOperatorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: operator } = await supabase.from("operators").select("*").eq("id", id).maybeSingle();
  if (!operator) notFound();

  const { data: verifier } = operator.verified_by
    ? await supabase.from("profiles").select("display_name, email").eq("id", operator.verified_by).maybeSingle()
    : { data: null };

  let certificateUrl: string | null = null;
  if (operator.insurance_certificate_path) {
    const signed = await supabase.storage
      .from("operator-documents")
      .createSignedUrl(operator.insurance_certificate_path, 3600);
    certificateUrl = signed.data?.signedUrl ?? null;
  }

  const saveReview = adminSaveCertificateReview.bind(null, operator.id);
  const uploadCertificate = adminUploadInsuranceCertificate.bind(null, operator.id);
  const markVerified = adminMarkOperatorVerified.bind(null, operator.id);
  const clearVerification = adminClearOperatorVerification.bind(null, operator.id);
  const lookup = faaRegistryLookupUrl(operator.certificate_number);

  const [{ data: fleet }, { data: legs }] = await Promise.all([
    supabase.from("aircraft").select("id").eq("operator_id", operator.id),
    supabase.from("empty_legs").select("id").eq("operator_id", operator.id),
  ]);
  const entityIds = [
    operator.id,
    ...(fleet ?? []).map((row) => row.id),
    ...(legs ?? []).map((row) => row.id),
  ];
  const { data: events } = await supabase
    .from("audit_events")
    .select("id, created_at, actor_profile_id, actor_role, action, entity_type, summary, diff")
    .in("entity_id", entityIds)
    .order("created_at", { ascending: false })
    .limit(50);

  const actorIds = [...new Set((events ?? []).map((event) => event.actor_profile_id).filter((id): id is string => Boolean(id)))];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, display_name, email").in("id", actorIds)
    : { data: [] };
  const actorName = new Map((actors ?? []).map((actor) => [actor.id, actor.display_name || actor.email || "Admin"]));

  return (
    <div className="max-w-xl">
      <p className="text-xs uppercase tracking-wide text-warm">
        <Link href="/admin/operators" className="hover:text-ink">
          Operators
        </Link>
      </p>
      <h1 className="font-display text-3xl mt-2">{operator.name}</h1>
      <p className="mt-2 text-sm text-warm">
        {operator.legal_name} · {operator.certificate_type} {operator.certificate_number}
      </p>

      <dl className="mt-8 space-y-3 text-sm">
        <div className="flex justify-between gap-4 border-b border-silver/30 py-2">
          <dt className="text-warm">FAA registry</dt>
          <dd>
            <a href={lookup} target="_blank" rel="noreferrer" className="underline">
              Look up {operator.certificate_number}
            </a>
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-silver/30 py-2">
          <dt className="text-warm">Verified</dt>
          <dd>
            {operator.verified_at
              ? `${operator.verified_at.slice(0, 10)}${verifier ? ` · ${verifier.display_name || verifier.email}` : ""}`
              : "Not verified"}
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-silver/30 py-2">
          <dt className="text-warm">Certificate reviewed</dt>
          <dd>{operator.certificate_reviewed_at ? operator.certificate_reviewed_at.slice(0, 10) : "Not reviewed"}</dd>
        </div>
      </dl>

      <form action={saveReview} className="mt-8 space-y-3">
        <label className="block text-xs uppercase tracking-wide text-warm">
          Review notes
          <textarea
            name="certificate_review_notes"
            defaultValue={operator.certificate_review_notes ?? ""}
            rows={5}
            className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2 text-sm normal-case tracking-normal"
          />
        </label>
        <button type="submit" className="bg-ink text-paper px-4 py-2 text-sm">
          Save review notes
        </button>
      </form>

      <form action={uploadCertificate} className="mt-8 space-y-3">
        <p className="text-xs uppercase tracking-wide text-warm">Insurance certificate</p>
        {certificateUrl ? (
          <p className="text-sm">
            <a href={certificateUrl} target="_blank" rel="noreferrer" className="underline">
              Current certificate
            </a>
          </p>
        ) : (
          <p className="text-sm text-warm">No certificate uploaded.</p>
        )}
        <input name="file" type="file" required className="block text-sm" />
        <button type="submit" className="bg-ink text-paper px-4 py-2 text-sm">
          Upload certificate
        </button>
      </form>

      <div className="mt-8 flex gap-3">
        <form action={markVerified}>
          <button type="submit" className="bg-ink text-paper px-4 py-2 text-sm">
            Mark verified
          </button>
        </form>
        <form action={clearVerification}>
          <button type="submit" className="border border-ink px-4 py-2 text-sm">
            Clear verification
          </button>
        </form>
      </div>
      <p className="mt-4 text-sm text-warm">
        Clearing verification removes the operator from search and new trip fan-out. Their portal access stays.
      </p>

      <h2 className="font-display text-2xl mt-12">Audit log</h2>
      <p className="mt-2 text-sm text-warm">Changes to this operator, its aircraft, and its empty legs.</p>
      {(events ?? []).length === 0 ? (
        <p className="mt-4 text-sm text-warm">No audit events yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-silver/40 text-left text-xs uppercase text-warm">
                <th className="py-2 pr-3">When</th>
                <th className="pr-3">Actor</th>
                <th className="pr-3">Action</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {(events ?? []).map((event) => {
                const diff = formatDiff(event.diff);
                const actor = event.actor_profile_id
                  ? actorName.get(event.actor_profile_id) || event.actor_role || "Unknown"
                  : event.actor_role || "Unknown";
                return (
                  <tr key={event.id} className="border-b border-silver/30 align-top">
                    <td className="py-3 pr-3 whitespace-nowrap text-warm">
                      {event.created_at.slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="pr-3">{actor}</td>
                    <td className="pr-3 whitespace-nowrap">{event.action}</td>
                    <td>
                      <p>{event.summary}</p>
                      {diff ? <pre className="mt-1 whitespace-pre-wrap text-xs text-warm">{diff}</pre> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
