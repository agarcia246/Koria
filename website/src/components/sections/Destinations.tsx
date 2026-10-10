"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { DESTINATIONS } from "@/data/destinations";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useIsTouch } from "@/hooks/useIsTouch";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type { GlobeState } from "@/components/three/GlobeScene";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";

const GlobeScene = dynamic(
  () => import("@/components/three/GlobeScene").then((m) => m.GlobeScene),
  { ssr: false },
);

export function Destinations() {
  const section = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const desktop = useIsDesktop();
  const touch = useIsTouch();
  const reduce = usePrefersReducedMotion();
  const [mounted, setMounted] = useState(false);
  const state = useRef<GlobeState>({ active: 0 });
  const showGlobe = desktop && !touch && !reduce && mounted;

  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setMounted(true);
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
        () => {
          const items = gsap.utils.toArray<HTMLElement>("[data-city]");
          items.forEach((city, i) => {
            ScrollTrigger.create({
              trigger: city,
              start: "center 70%",
              end: "center 30%",
              onEnter: () => {
                setActive(i);
                state.current.active = i;
              },
              onEnterBack: () => {
                setActive(i);
                state.current.active = i;
              },
            });
          });
        },
      );
      return () => mm.revert();
    },
    { scope: section },
  );

  return (
    <section
      ref={section}
      className="relative bg-ink px-5 py-28 text-ivory md:px-8 lg:px-12"
    >
      <div className="mx-auto max-w-6xl">
        <p className="label mb-8 text-champagne">The world</p>
        <h2 className="display text-[clamp(2.6rem,7vw,6.8rem)]">
          The world
          <br />
          is closer
          <br />
          than you think.
        </h2>
      </div>

      <div className="mx-auto mt-16 grid max-w-6xl items-start gap-10 lg:grid-cols-2">
        <div className="relative aspect-square w-full overflow-hidden bg-charcoal">
          {showGlobe ? (
            <GlobeScene state={state} />
          ) : (
            <Image
              src={DESTINATIONS[active]?.image ?? "/images/city-dusk.png"}
              alt=""
              fill
              sizes="50vw"
              className="object-cover"
            />
          )}
          <div className="pointer-events-none absolute inset-0">
            <Image
              src={DESTINATIONS[active]?.image ?? ""}
              alt=""
              fill
              sizes="50vw"
              className="object-cover opacity-20 mix-blend-screen"
            />
          </div>
        </div>

        <ul className="flex flex-col">
          {DESTINATIONS.map((city, i) => (
            <li key={city.name}>
              <button
                type="button"
                data-city
                data-cursor="VIEW"
                onMouseEnter={() => {
                  setActive(i);
                  state.current.active = i;
                }}
                onClick={() => {
                  setActive(i);
                  state.current.active = i;
                }}
                className={`display w-full border-b border-ivory/10 py-4 text-left text-[clamp(2rem,4vw,4rem)] transition-colors duration-500 ${
                  active === i ? "text-ivory" : "text-ivory/25"
                }`}
              >
                {city.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
