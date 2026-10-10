"use client";

import { useRef } from "react";
import { PHILOSOPHY_STEPS } from "@/data/philosophy";
import { gsap, useGSAP } from "@/lib/gsap";

export function Philosophy() {
  const section = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
        () => {
          const steps = gsap.utils.toArray<HTMLElement>("[data-step]");
          gsap.set(steps, { autoAlpha: 0 });
          gsap.set(steps[0], { autoAlpha: 1 });

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: section.current,
              start: "top top",
              end: () => `+=${steps.length * 90}%`,
              pin: true,
              scrub: 0.7,
            },
          });

          steps.forEach((step, i) => {
            if (i === 0) return;
            tl.to(steps[i - 1], { autoAlpha: 0, y: -36, duration: 0.5 }, i);
            tl.fromTo(
              step,
              { autoAlpha: 0, y: 40 },
              { autoAlpha: 1, y: 0, duration: 0.5 },
              i,
            );
          });

          gsap.to("[data-progress]", {
            scaleX: 1,
            ease: "none",
            scrollTrigger: {
              trigger: section.current,
              start: "top top",
              end: () => `+=${steps.length * 90}%`,
              scrub: true,
            },
          });
        },
      );
      return () => mm.revert();
    },
    { scope: section },
  );

  return (
    <section
      id="how-it-works"
      ref={section}
      className="relative bg-ink px-5 py-28 text-ivory md:h-screen md:px-8 md:py-0 lg:px-12"
    >
      <div className="mx-auto flex h-full max-w-6xl flex-col justify-center">
        <p className="label mb-12 text-champagne md:absolute md:top-16">
          The Koria philosophy
        </p>

        <div className="relative hidden min-h-[50vh] md:block md:min-h-[70vh]">
          {PHILOSOPHY_STEPS.map((step, i) => (
            <div
              key={step.word}
              data-step
              className="absolute inset-0 flex flex-col justify-center"
            >
              {i > 0 && (
                <p className="mb-6 hidden text-silver md:block">→</p>
              )}
              <h2 className="display text-[clamp(3.4rem,12vw,10rem)]">
                {step.word}
              </h2>
              <p className="mt-6 max-w-md text-lg text-ivory/70 md:mt-8">
                {step.copy}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-16 hidden h-px overflow-hidden bg-ivory/10 md:block">
          <div
            data-progress
            className="h-full origin-left scale-x-0 bg-champagne"
          />
        </div>

        <div className="mt-16 space-y-16 md:hidden">
          {PHILOSOPHY_STEPS.map((step) => (
            <div key={`m-${step.word}`}>
              <h2 className="display text-5xl">{step.word}</h2>
              <p className="mt-4 max-w-md text-ivory/70">{step.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
