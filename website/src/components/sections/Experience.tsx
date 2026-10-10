"use client";

import { useRef } from "react";
import Image from "next/image";
import { EXPERIENCE_STEPS } from "@/data/experience";
import { gsap, useGSAP } from "@/lib/gsap";

export function Experience() {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
        () => {
          const scrolling = track.current;
          if (!scrolling) return;

          gsap.to(scrolling, {
            x: () => -(scrolling.scrollWidth - window.innerWidth),
            ease: "none",
            scrollTrigger: {
              trigger: section.current,
              start: "top top",
              end: () => `+=${scrolling.scrollWidth - window.innerWidth}`,
              pin: true,
              scrub: 0.8,
              anticipatePin: 1,
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
      id="experience"
      ref={section}
      className="relative overflow-hidden bg-ink text-ivory"
    >
      <div className="px-5 pt-24 md:absolute md:top-0 md:right-0 md:left-0 md:z-10 md:px-8 md:pt-16 lg:px-12">
        <p className="label text-champagne">The experience</p>
        <h2 className="display mt-4 text-[clamp(2.6rem,7vw,6.5rem)]">
          One trip.
          <br />
          One experience.
        </h2>
        <p className="mt-4 max-w-md text-ivory/60">
          The flight is only one part of the journey. KORIA is designed to
          coordinate everything around it.
        </p>
      </div>

      <div
        ref={track}
        className="flex flex-col md:h-screen md:flex-row md:w-max"
      >
        {EXPERIENCE_STEPS.map((step) => (
          <article
            key={step.title}
            className="relative h-[70vh] w-full shrink-0 md:h-screen md:w-screen"
          >
            <Image
              src={step.image}
              alt={step.title}
              fill
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-ink/30" />
            <div className="absolute bottom-10 left-5 md:bottom-16 md:left-12">
              <p className="label text-champagne">{step.title}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
