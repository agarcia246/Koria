"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function CompleteSignIn() {
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    const supabase = createClient();
    let finished = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (finished || !session) return;
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        finished = true;
        window.location.replace("/");
      }
    });

    const timer = window.setTimeout(() => {
      if (!finished) {
        setMessage(
          "Sign-in did not finish. Send a new link from the login page, then open the newest message and click Sign in once.",
        );
      }
    }, 4000);

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <main className="min-h-screen bg-paper text-ink flex items-center justify-center px-6">
      <p className="max-w-md text-sm text-warm">{message}</p>
    </main>
  );
}
