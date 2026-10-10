"use client";

import { useRef } from "react";
import { ParallaxImage } from "@/components/ui/ParallaxImage";
import { gsap, useGSAP } from "@/lib/gsap";

const QUESTIONS = [
  "Where are you going?",
  "When?",
  "Who's coming?",
  "What's important?",
  "What's your budget?",
];

export function TripFirst() {
  const section = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
        () => {
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: section.current,
              start: "top top",
              end: "+=140%",
              pin: true,
              scrub: 0.8,
            },
          });
          tl.to("[data-trip-a]", { autoAlpha: 0.15, y: -24, duration: 1 }, 0);
          tl.fromTo(
            "[data-trip-b]",
            { autoAlpha: 0, y: 36 },
            { autoAlpha: 1, y: 0, duration: 1 },
            0.1,
          );
          tl.from("[data-q]", { autoAlpha: 0, x: -16, stagger: 0.08, duration: 0.6 }, 0.35);
        },
      );
      return () => mm.revert();
    },
    { scope: section },
  );

  return (
    <section
      ref={section}
      className="relative min-h-screen bg-ivory px-5 py-28 text-ink md:px-8 lg:px-12"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-2">
        <div>
          <p className="label mb-8 text-warm">Private travel, not private jets</p>
          <h2 className="display text-[clamp(2.6rem,6vw,5.8rem)]">
            <span data-trip-a className="block">
              You don&apos;t
              <br />
              start with
              <br />
              an aircraft.
            </span>
          </h2>
          <h2 className="display mt-8 text-[clamp(2.6rem,6vw,5.8rem)]">
            <span data-trip-b className="block md:opacity-0">
              You start
              <br />
              with a trip.
            </span>
          </h2>
          <ul className="mt-14 space-y-3">
            {QUESTIONS.map((q) => (
              <li
                key={q}
                data-q
                className="border-b border-ink/10 pb-3 text-lg text-warm"
              >
                {q}
              </li>
            ))}
          </ul>
          <p className="mt-10 max-w-sm text-warm">
            Then KORIA handles the complexity behind the scenes.
          </p>
        </div>
        <div className="relative aspect-[4/5] w-full">
          <ParallaxImage
            src="/images/travelers.png"
            alt="Travelers walking toward a private aircraft"
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>
    </section>
  );
}
