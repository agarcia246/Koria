"use client";

import { useRef } from "react";
import Image from "next/image";
import { gsap, useGSAP } from "@/lib/gsap";

const OUTCOMES = [
  {
    title: "Best value",
    copy: "The best balance of cabin, baggage, timing, and total cost.",
  },
  {
    title: "Best experience",
    copy: "More comfort, cabin quality, and convenience.",
  },
  {
    title: "Best deal",
    copy: "Flexible timing and repositioning opportunities when available.",
  },
];

export function Intelligence() {
  const section = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from("[data-intel-head]", {
        yPercent: 80,
        autoAlpha: 0,
        stagger: 0.1,
        duration: 1.1,
        ease: "power3.out",
        scrollTrigger: { trigger: section.current, start: "top 70%" },
      });

      gsap.from("[data-outcome]", {
        y: 40,
        autoAlpha: 0,
        stagger: 0.15,
        duration: 0.9,
        scrollTrigger: { trigger: "[data-outcomes]", start: "top 78%" },
      });

      gsap.from("[data-thesis] span", {
        yPercent: 110,
        stagger: 0.08,
        duration: 1.15,
        ease: "power3.out",
        scrollTrigger: { trigger: "[data-thesis]", start: "top 80%" },
      });
    },
    { scope: section },
  );

  return (
    <section
      ref={section}
      className="relative overflow-hidden bg-charcoal px-5 py-28 text-ivory md:px-8 lg:px-12 lg:py-36"
    >
      <div className="pointer-events-none absolute top-0 right-0 hidden h-full w-1/2 opacity-40 lg:block">
        <Image
          src="/images/cabin-interior.png"
          alt=""
          fill
          sizes="50vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent to-charcoal" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <p className="label mb-10 text-champagne">Intelligence</p>
        <h2 className="display text-[clamp(2.8rem,7vw,7rem)]">
          <span className="block overflow-hidden">
            <span data-intel-head className="block">
              Less aviation
            </span>
          </span>
          <span className="block overflow-hidden">
            <span data-intel-head className="block">
              knowledge.
            </span>
          </span>
          <span className="block overflow-hidden">
            <span data-intel-head className="block text-champagne">
              More clarity.
            </span>
          </span>
        </h2>

        <p className="mt-10 max-w-lg text-lg leading-relaxed text-ivory/70">
          KORIA AI acts like a private aviation advisor. Tell KORIA what you&apos;re
          trying to do in normal language.
        </p>

        <blockquote className="mt-12 max-w-2xl border-l border-champagne/50 pl-6 text-2xl leading-snug text-ivory md:text-3xl">
          “Eight of us want to go from Austin to Cabo Friday. We have golf clubs,
          need Wi-Fi, and want to stay under $3,000 each.”
        </blockquote>

        <p className="mt-8 max-w-lg text-ivory/60">
          KORIA translates the mission into understandable choices.
        </p>

        <div
          data-outcomes
          className="mt-20 grid gap-12 border-t border-ivory/10 pt-16 md:grid-cols-3"
        >
          {OUTCOMES.map((item) => (
            <article key={item.title} data-outcome>
              <p className="label text-champagne">{item.title}</p>
              <p className="mt-4 text-lg leading-relaxed text-ivory/75">
                {item.copy}
              </p>
            </article>
          ))}
        </div>

        <div data-thesis className="mt-28">
          <h3 className="display text-[clamp(2.2rem,5.5vw,5.5rem)]">
            <span className="block overflow-hidden">
              <span className="block">AI isn&apos;t the product.</span>
            </span>
            <span className="block overflow-hidden">
              <span className="block">Removing complexity is.</span>
            </span>
          </h3>
        </div>
      </div>
    </section>
  );
}
