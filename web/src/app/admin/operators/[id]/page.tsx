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
    </div>
  );
}
