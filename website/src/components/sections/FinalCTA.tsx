"use client";

import { useRef } from "react";
import Image from "next/image";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { RequestAccess } from "@/components/access/RequestAccess";
import { CONTACT_HREF } from "@/lib/constants";
import { gsap, useGSAP } from "@/lib/gsap";

export function FinalCTA() {
  const section = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from("[data-final-line]", {
        yPercent: 110,
        stagger: 0.1,
        duration: 1.2,
        ease: "power3.out",
        scrollTrigger: { trigger: section.current, start: "top 70%" },
      });

      gsap.to("[data-final-img]", {
        scale: 1.08,
        ease: "none",
        scrollTrigger: {
          trigger: section.current,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.8,
        },
      });
    },
    { scope: section },
  );

  return (
    <section
      ref={section}
      className="relative flex min-h-screen items-end overflow-hidden bg-ink px-5 py-24 text-ivory md:px-8 lg:px-12"
    >
      <div className="absolute inset-0">
        <Image
          data-final-img
          src="/images/wing-sunrise.png"
          alt="Aircraft wing over clouds at sunrise"
          fill
          sizes="100vw"
          className="object-cover will-transform"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/50 to-ink/20" />
      </div>

      <div className="relative z-10 w-full max-w-6xl pb-8">
        <h2 className="display text-[clamp(3.4rem,12vw,10rem)]">
          {["Where", "are we", "going?"].map((line) => (
            <span key={line} className="block overflow-hidden">
              <span data-final-line className="block">
                {line}
              </span>
            </span>
          ))}
        </h2>
        <p className="mt-8 max-w-md text-lg text-ivory/75">
          Tell us where you&apos;re going.
          <br />
          We&apos;ll take care of the rest.
        </p>
        <div className="mt-12 flex flex-wrap gap-4">
          <RequestAccess>Start a Koria →</RequestAccess>
          <MagneticButton href={CONTACT_HREF} variant="ghost" cursor="VIEW">
            Talk to us
          </MagneticButton>
        </div>
      </div>
    </section>
  );
}
