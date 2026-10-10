"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

const CHAIN = [
  "Discovery",
  "Aircraft",
  "Payment",
  "People",
  "Ground",
  "Concierge",
  "Identity",
  "Repeat travel",
];

export function Future() {
  const section = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from("[data-chain]", {
        autoAlpha: 0,
        y: 30,
        stagger: 0.08,
        duration: 0.85,
        scrollTrigger: { trigger: "[data-chain-list]", start: "top 75%" },
      });
    },
    { scope: section },
  );

  return (
    <section
      ref={section}
      className="bg-charcoal px-5 py-28 text-ivory md:px-8 lg:px-12 lg:py-36"
    >
      <div className="mx-auto max-w-6xl">
        <p className="label mb-8 text-champagne">The future</p>
        <h2 className="display text-[clamp(2.6rem,7vw,6.5rem)]">
          Private aviation
          <br />
          isn&apos;t the endpoint.
        </h2>
        <h3 className="display mt-10 text-[clamp(2.4rem,6vw,5.5rem)] text-champagne">
          It&apos;s the
          <br />
          beginning.
        </h3>
        <p className="mt-10 max-w-lg text-lg text-ivory/65">
          KORIA is building the consumer layer around private travel — so every
          trip makes the next one smarter.
        </p>

        <ul data-chain-list className="mt-20">
          {CHAIN.map((item, i) => (
            <li key={item} data-chain className="border-t border-ivory/10 py-6">
              <div className="flex items-baseline justify-between gap-6">
                <span className="display text-[clamp(2rem,5vw,4.5rem)]">
                  {item}
                </span>
                {i < CHAIN.length - 1 && (
                  <span className="label text-champagne">↓</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
