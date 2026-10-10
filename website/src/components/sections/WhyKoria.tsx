"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

const TRADITIONAL = [
  "Aircraft research",
  "Multiple quotes",
  "Calls",
  "Texts",
  "PDFs",
  "Manual coordination",
  "One person pays",
  "No persistent history",
];

const KORIA = [
  "Tell us the trip",
  "Curated options",
  "Clear tradeoffs",
  "Group coordination",
  "Shared payments",
  "Concierge",
  "Travel identity",
];

export function WhyKoria() {
  const section = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from("[data-why-item]", {
        autoAlpha: 0,
        y: 16,
        stagger: 0.05,
        duration: 0.7,
        scrollTrigger: { trigger: section.current, start: "top 70%" },
      });
    },
    { scope: section },
  );

  return (
    <section
      id="about"
      ref={section}
      className="bg-ivory px-5 py-28 text-ink md:px-8 lg:px-12 lg:py-36"
    >
      <div className="mx-auto max-w-6xl">
        <p className="label mb-8 text-warm">Why Koria</p>
        <h2 className="display max-w-4xl text-[clamp(2.6rem,7vw,6.5rem)]">
          Private aviation
          <br />
          without the
          <br />
          private aviation
          <br />
          headache.
        </h2>

        <div className="mt-20 grid gap-16 md:grid-cols-2">
          <div>
            <p className="label text-silver">Traditional experience</p>
            <ul className="mt-8 space-y-4">
              {TRADITIONAL.map((item) => (
                <li
                  key={item}
                  data-why-item
                  className="border-b border-ink/10 pb-4 text-xl text-warm/70 line-through decoration-ink/20"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="label text-champagne">Koria</p>
            <ul className="mt-8 space-y-4">
              {KORIA.map((item) => (
                <li
                  key={item}
                  data-why-item
                  className="display border-b border-ink/10 pb-4 text-[clamp(1.6rem,3vw,2.4rem)]"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
