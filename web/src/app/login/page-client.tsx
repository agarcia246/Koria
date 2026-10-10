"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage({ errorParam }: { errorParam: string | null }) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendMagicLink(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
      },
    });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setSent(true);
    setMessage("Check your email for a magic link or OTP code.");
  }

  async function verifyOtp(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    window.location.href = "/";
  }

  return (
    <main className="min-h-screen bg-paper text-ink flex items-center justify-center px-6">
      <div className="w-full max-w-md border border-silver/40 bg-ivory p-8">
        <p className="font-display text-3xl tracking-tight">KORIA</p>
        <p className="mt-2 text-sm text-warm">Operator & admin portal</p>

        {errorParam === "customer_no_portal" && (
          <p className="mt-4 text-sm text-warm border border-silver/50 p-3">
            Customer accounts use the iOS app. Sign in with an operator or admin account.
          </p>
        )}

        {errorParam === "link" && (
          <p className="mt-4 text-sm text-warm border border-silver/50 p-3">
            That sign-in link was already used or expired. Send a new one and click it once.
          </p>
        )}

        <form onSubmit={sendMagicLink} className="mt-8 space-y-4">
          <label className="block text-xs uppercase tracking-wide text-warm">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2 text-sm outline-none focus:border-champagne"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ink text-paper py-2.5 text-sm tracking-wide disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send magic link / OTP"}
          </button>
        </form>

        {sent && (
          <form onSubmit={verifyOtp} className="mt-6 space-y-4 border-t border-silver/40 pt-6">
            <label className="block text-xs uppercase tracking-wide text-warm">
              OTP code
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="mt-1 w-full border border-silver/50 bg-paper px-3 py-2 text-sm outline-none focus:border-champagne"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full border border-ink py-2.5 text-sm tracking-wide"
            >
              Verify OTP
            </button>
          </form>
        )}

        {message && <p className="mt-4 text-sm text-warm">{message}</p>}
      </div>
    </main>
  );
}
