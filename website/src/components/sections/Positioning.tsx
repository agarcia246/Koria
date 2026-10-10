"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

export function Positioning() {
  const section = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          desktop: "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
          reduce: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const desktop = context.conditions?.desktop;
          if (!desktop) return;

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: section.current,
              start: "top top",
              end: "+=160%",
              pin: true,
              scrub: 0.85,
            },
          });

          tl.to("[data-line-a]", { yPercent: -30, autoAlpha: 0.18, duration: 1 }, 0);
          tl.fromTo(
            "[data-line-b]",
            { yPercent: 40, autoAlpha: 0 },
            { yPercent: 0, autoAlpha: 1, duration: 1 },
            0.15,
          );
          tl.from("[data-pos-copy]", { autoAlpha: 0, y: 24, duration: 0.8 }, 0.45);
        },
      );
      return () => mm.revert();
    },
    { scope: section },
  );

  return (
    <section
      ref={section}
      className="relative flex min-h-screen items-center bg-ivory px-5 py-28 text-ink md:px-8 lg:px-12"
    >
      <div className="mx-auto w-full max-w-6xl">
        <p className="label mb-10 text-warm">The problem</p>
        <h2 className="display text-[clamp(2.6rem,7vw,7rem)]">
          <span data-line-a className="block">
            Private aviation
            <br />
            has the product.
          </span>
        </h2>
        <h2 className="display mt-8 text-[clamp(2.6rem,7vw,7rem)] text-ink md:mt-10">
          <span data-line-b className="block opacity-100 md:opacity-0">
            Koria builds
            <br />
            the experience.
          </span>
        </h2>
        <div
          data-pos-copy
          className="mt-16 max-w-xl space-y-5 text-base leading-relaxed text-warm md:text-lg"
        >
          <p>
            Private aviation shouldn&apos;t require expertise just to understand
            your options.
          </p>
          <p>
            The aircraft may be premium. The discovery, comparison, payment, and
            coordination experience often isn&apos;t.
          </p>
          <p className="text-ink">
            KORIA makes private travel understandable, coordinated, and
            repeatable.
          </p>
        </div>
      </div>
    </section>
  );
}
