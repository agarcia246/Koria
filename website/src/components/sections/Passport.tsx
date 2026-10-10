"use client";

import { useRef } from "react";
import Image from "next/image";
import { PASSPORT_STAMPS } from "@/data/passport";
import { gsap, useGSAP } from "@/lib/gsap";

export function Passport() {
  const section = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from("[data-stamp]", {
        y: 50,
        autoAlpha: 0,
        stagger: 0.1,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: { trigger: "[data-stamps]", start: "top 78%" },
      });
    },
    { scope: section },
  );

  return (
    <section
      ref={section}
      className="relative bg-ivory px-5 py-28 text-ink md:px-8 lg:px-12 lg:py-36"
    >
      <div className="mx-auto max-w-6xl">
        <p className="label mb-8 text-warm">Koria Passport</p>
        <h2 className="display text-[clamp(2.6rem,7vw,6.8rem)]">
          Your travel
          <br />
          should leave
          <br />
          a trace.
        </h2>
        <p className="mt-10 max-w-xl text-lg leading-relaxed text-warm">
          A private, opt-in travel identity built around the journeys you&apos;ve
          actually taken. Destination collections, milestones, stamps,
          achievements, travel history — closer to a collector&apos;s book than a
          game.
        </p>

        <div
          data-stamps
          className="mt-20 grid gap-px bg-ink/10 sm:grid-cols-2 lg:grid-cols-5"
        >
          {PASSPORT_STAMPS.map((stamp, i) => (
            <article
              key={stamp.title}
              data-stamp
              className="relative min-h-[280px] overflow-hidden bg-ivory p-8"
            >
              {i === 2 && (
                <div className="absolute inset-0 opacity-30">
                  <Image
                    src="/images/ocean.png"
                    alt=""
                    fill
                    sizes="20vw"
                    className="object-cover"
                  />
                </div>
              )}
              <p className="label relative text-champagne">0{i + 1}</p>
              <h3 className="display relative mt-10 text-3xl md:text-4xl">
                {stamp.title}
              </h3>
              <p className="relative mt-4 text-sm leading-relaxed text-warm">
                {stamp.detail}
              </p>
            </article>
          ))}
        </div>

        <p className="mt-16 max-w-sm text-sm leading-relaxed text-warm">
          Private by default.
          <br />
          Share only what you choose.
        </p>
      </div>
    </section>
  );
}
