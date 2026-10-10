"use client";

import { useRef } from "react";
import Image from "next/image";
import { gsap, useGSAP } from "@/lib/gsap";

export function KoriaSplit() {
  const section = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from("[data-split-line]", {
        yPercent: 110,
        stagger: 0.06,
        duration: 1.05,
        ease: "power3.out",
        scrollTrigger: { trigger: section.current, start: "top 70%" },
      });

      const to = { val: 2400 };

      gsap.fromTo(
        to,
        { val: 19200 },
        {
          val: 2400,
          duration: 1.6,
          ease: "power2.inOut",
          immediateRender: false,
          scrollTrigger: {
            trigger: "[data-to-num]",
            start: "top 82%",
          },
          onUpdate: () => {
            const el = section.current?.querySelector("[data-to-num]");
            if (el) {
              el.textContent = `$${Math.round(to.val).toLocaleString("en-US")}`;
            }
          },
        },
      );
    },
    { scope: section },
  );

  return (
    <section
      ref={section}
      className="relative overflow-hidden bg-ink px-5 py-28 text-ivory md:px-8 lg:px-12 lg:py-36"
    >
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <Image
          src="/images/ibiza.png"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-ink/70" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <p className="label mb-10 text-champagne">Koria Split</p>
        <h2 className="display text-[clamp(2.8rem,8vw,7.5rem)]">
          {[
            "Private",
            "travel",
            "shouldn't",
            "mean one",
            "person pays",
            "for everyone.",
          ].map((line) => (
            <span key={line} className="block overflow-hidden">
              <span data-split-line className="block">
                {line}
              </span>
            </span>
          ))}
        </h2>

        <p className="mt-12 max-w-lg text-lg text-ivory/70">
          Bring your group together around a trip. Everyone can see their share,
          confirm, and participate.
        </p>

        <div className="mt-20 grid gap-12 md:grid-cols-2">
          <div>
            <p className="label text-silver">From</p>
            <p className="display mt-4 text-3xl text-ivory/40 md:text-4xl">
              Who wants to front{" "}
              <span data-from-num className="text-ivory/50">
                $19,200
              </span>
              ?
            </p>
          </div>
          <div>
            <p className="label text-champagne">To</p>
            <p className="mt-4 display text-[clamp(2.4rem,5vw,4.5rem)]">
              Who&apos;s in for{" "}
              <span data-to-num className="text-champagne">
                $2,400
              </span>
              ?
            </p>
          </div>
        </div>

        <p className="label mt-20 text-ivory">Private travel becomes social.</p>
      </div>
    </section>
  );
}
