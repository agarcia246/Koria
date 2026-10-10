"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

export function Discretion() {
  const section = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from("[data-disc]", {
        yPercent: 40,
        autoAlpha: 0,
        stagger: 0.12,
        duration: 1.2,
        ease: "power3.out",
        scrollTrigger: { trigger: section.current, start: "top 70%" },
      });
    },
    { scope: section },
  );

  return (
    <section
      ref={section}
      className="flex min-h-[85vh] items-center bg-ink px-5 py-32 text-ivory md:px-8 lg:px-12"
    >
      <div className="mx-auto max-w-3xl text-center">
        <h2 data-disc className="display text-[clamp(2.8rem,8vw,7rem)]">
          Private by default.
        </h2>
        <div className="mx-auto mt-16 max-w-sm space-y-4 text-lg text-ivory/60">
          <p data-disc>Your trip is yours.</p>
          <p data-disc>Your preferences are yours.</p>
          <p data-disc>Your history is yours.</p>
          <p data-disc className="pt-6 text-ivory">
            Share only what you choose.
          </p>
        </div>
      </div>
    </section>
  );
}
