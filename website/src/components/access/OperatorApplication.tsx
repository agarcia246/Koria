"use client";

import { useState } from "react";
import { KORIA_API_URL, OPERATOR_APPLY_HREF } from "@/lib/constants";

export function OperatorApplication({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [certificateNumber, setCertificateNumber] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error" | "limited">("idle");

  if (!KORIA_API_URL) {
    return (
      <a href={OPERATOR_APPLY_HREF} className={className}>
        Operate with KORIA
      </a>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("sending");
    try {
      const response = await fetch(`${KORIA_API_URL}/api/v1/access-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "operator",
          company_name: companyName,
          certificate_number: certificateNumber,
          email,
          note,
          company_website: honeypot,
        }),
      });
      if (response.status === 429) {
        setStatus("limited");
        return;
      }
      if (!response.ok) {
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  return (
    <>
      <button type="button" onClick={() => { setStatus("idle"); setOpen(true); }} className={`bg-transparent p-0 text-left ${className ?? ""}`}>
        Operate with KORIA
      </button>
      {open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/70 px-5">
          <div className="w-full max-w-md bg-ivory p-8 text-ink" role="dialog" aria-labelledby="operator-apply-title">
            <div className="flex items-start justify-between gap-6">
              <h2 id="operator-apply-title" className="display text-4xl">
                Operate with KORIA
              </h2>
              <button type="button" className="label text-[0.62rem] text-ink/60" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            {status === "sent" ? (
              <p className="mt-8 text-base leading-relaxed">Application received. We&apos;ll be in touch.</p>
            ) : (
              <form onSubmit={submit} className="mt-8 space-y-4">
                <label className="block text-sm">
                  Company
                  <input
                    name="company_name"
                    required
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    className="mt-1 block w-full border border-ink/15 bg-ivory px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  Certificate number
                  <input
                    name="certificate_number"
                    required
                    value={certificateNumber}
                    onChange={(event) => setCertificateNumber(event.target.value)}
                    className="mt-1 block w-full border border-ink/15 bg-ivory px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  Contact email
                  <input
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-1 block w-full border border-ink/15 bg-ivory px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  Note
                  <textarea
                    name="note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    className="mt-1 block w-full border border-ink/15 bg-ivory px-3 py-2"
                    rows={3}
                  />
                </label>
                <label className="absolute left-[-9999px] h-px w-px overflow-hidden" aria-hidden="true">
                  Company website
                  <input
                    name="company_website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(event) => setHoneypot(event.target.value)}
                  />
                </label>
                {status === "error" ? (
                  <p className="text-sm">
                    Something went wrong. Email{" "}
                    <a href={OPERATOR_APPLY_HREF} className="underline">
                      start@koria.travel
                    </a>
                    .
                  </p>
                ) : null}
                {status === "limited" ? <p className="text-sm">Please try again later.</p> : null}
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="bg-ink px-5 py-3 text-[0.7rem] font-medium tracking-[0.28em] text-ivory uppercase"
                >
                  {status === "sending" ? "Sending" : "Submit application"}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
