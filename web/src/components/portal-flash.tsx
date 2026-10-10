"use client";

import { useEffect, useState } from "react";

export function PortalFlash({ message }: { message?: string }) {
  const [text, setText] = useState(message ?? "");

  useEffect(() => {
    if (!message) return;
    document.cookie = "portal_error=; path=/; max-age=0";
  }, [message]);

  if (!text) return null;

  return (
    <p className="mb-6 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
      {text}
      <button type="button" className="ml-3 underline" onClick={() => setText("")}>
        Dismiss
      </button>
    </p>
  );
}
