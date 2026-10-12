"use client";

import { useState } from "react";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { KORIA_API_URL, START_KORIA_HREF } from "@/lib/constants";

type RequestAccessProps = {
  children: React.ReactNode;
  className?: string;
  variant?: "solid" | "ghost" | "line";
  onOpen?: () => void;
  appearance?: "magnetic" | "link";
};

export function RequestAccess({
  children,
  className,
  variant = "solid",
  appearance = "magnetic",
  onOpen,
}: RequestAccessProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error" | "limited">("idle");

  if (!KORIA_API_URL) {
    if (appearance === "link") {
      return (
        <a href={START_KORIA_HREF} className={className}>
          {children}
        </a>
      );
    }
    return (
      <MagneticButton href={START_KORIA_HREF} className={className} variant={variant}>
        {children}
      </MagneticButton>
    );
  }

  const openForm = () => {
    onOpen?.();
    setStatus("idle");
    setOpen(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("sending");
    try {
      const response = await fetch(`${KORIA_API_URL}/api/v1/access-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, company_website: honeypot }),
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

  const trigger =
    appearance === "link" ? (
      <button type="button" onClick={openForm} className={className}>
        {children}
      </button>
    ) : (
      <MagneticButton onClick={openForm} className={className} variant={variant}>
        {children}
      </MagneticButton>
    );

  return (
    <>
      {trigger}
      {open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/70 px-5">
          <div className="w-full max-w-md bg-ivory p-8 text-ink" role="dialog" aria-labelledby="request-access-title">
            <div className="flex items-start justify-between gap-6">
              <h2 id="request-access-title" className="display text-4xl">
                Start a Koria
              </h2>
              <button type="button" className="label text-[0.62rem] text-ink/60" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            {status === "sent" ? (
              <p className="mt-8 text-base leading-relaxed">Request received. We&apos;ll be in touch.</p>
            ) : (
              <form onSubmit={submit} className="mt-8 space-y-4">
                <label className="block text-sm">
                  Name
                  <input
                    name="name"
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="mt-1 block w-full border border-ink/15 bg-ivory px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  Email
                  <input
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-1 block w-full border border-ink/15 bg-ivory px-3 py-2"
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
                    <a href={START_KORIA_HREF} className="underline">
                      start@koria.travel
                    </a>{" "}
                    and we&apos;ll take it from there.
                  </p>
                ) : null}
                {status === "limited" ? <p className="text-sm">Please try again later.</p> : null}
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="bg-ink px-5 py-3 text-[0.7rem] font-medium tracking-[0.28em] text-ivory uppercase"
                >
                  {status === "sending" ? "Sending" : "Request access"}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
