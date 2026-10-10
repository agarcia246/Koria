"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { CONCIERGE_SERVICES } from "@/data/concierge";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";

export function Concierge() {
  const section = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
        () => {
          const items = gsap.utils.toArray<HTMLElement>("[data-service]");
          items.forEach((item, i) => {
            ScrollTrigger.create({
              trigger: item,
              start: "top 60%",
              end: "bottom 40%",
              onEnter: () => setActive(i),
              onEnterBack: () => setActive(i),
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
      id="concierge"
      ref={section}
      className="relative min-h-screen overflow-hidden bg-ink text-ivory"
    >
      <div className="absolute inset-0">
        {CONCIERGE_SERVICES.map((service, i) => (
          <div
            key={service.title}
            className="absolute inset-0 transition-opacity duration-700"
            style={{ opacity: active === i ? 1 : 0 }}
          >
            <Image
              src={service.image}
              alt=""
              fill
              sizes="100vw"
              className="object-cover scale-105"
            />
            <div className="absolute inset-0 bg-ink/55" />
          </div>
        ))}
      </div>

      <div className="relative z-10 px-5 py-28 md:px-8 lg:px-12">
        <p className="label text-champagne">Concierge</p>
        <h2 className="display mt-6 max-w-4xl text-[clamp(2.6rem,7vw,6.5rem)]">
          The flight
          <br />
          is only
          <br />
          the beginning.
        </h2>
        <p className="mt-8 max-w-md text-ivory/70">
          Once KORIA knows the trip, everything else becomes easier.
        </p>

        <ul className="mt-20 max-w-xl">
          {CONCIERGE_SERVICES.map((service, i) => (
            <li key={service.title}>
              <button
                type="button"
                data-service
                data-cursor="EXPLORE"
                onMouseEnter={() => setActive(i)}
                className="flex w-full items-baseline justify-between border-t border-ivory/20 py-5 text-left"
              >
                <span
                  className={`display text-[clamp(1.6rem,3vw,2.8rem)] transition-colors duration-500 ${
                    active === i ? "text-ivory" : "text-ivory/35"
                  }`}
                >
                  {service.title}
                </span>
                <span className="label hidden text-champagne sm:block">
                  0{i + 1}
                </span>
              </button>
              <p
                className={`overflow-hidden text-sm text-ivory/60 transition-all duration-500 ${
                  active === i ? "mb-4 max-h-20 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                {service.copy}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
