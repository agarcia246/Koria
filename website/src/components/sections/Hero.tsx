"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useRef } from "react";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { gsap, useGSAP } from "@/lib/gsap";
import { START_KORIA_HREF } from "@/lib/constants";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useIsTouch } from "@/hooks/useIsTouch";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type { SceneState } from "@/components/three/AircraftScene";

const AircraftScene = dynamic(
  () =>
    import("@/components/three/AircraftScene").then((m) => m.AircraftScene),
  { ssr: false },
);

export function Hero() {
  const section = useRef<HTMLElement>(null);
  const type = useRef<HTMLDivElement>(null);
  const desktop = useIsDesktop();
  const touch = useIsTouch();
  const reduce = usePrefersReducedMotion();
  const state = useRef<SceneState>({ progress: 0, mouseX: 0, mouseY: 0 });
  const showScene = desktop && !touch && !reduce;

  useGSAP(
    () => {
      if (!section.current || !type.current) return;

      let played = false;
      const playIntro = () => {
        if (played || reduce) return;
        played = true;
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        tl.fromTo(
          "[data-hero-line]",
          { yPercent: 110 },
          { yPercent: 0, duration: 1.15, stagger: 0.1 },
        );
        tl.fromTo(
          "[data-hero-sub], [data-hero-cta]",
          { autoAlpha: 0, y: 16 },
          { autoAlpha: 1, y: 0, duration: 0.85, stagger: 0.08 },
          "-=0.55",
        );
      };

      if (document.body.dataset.koriaReady || reduce) {
        playIntro();
      } else {
        window.addEventListener("koria:ready", playIntro, { once: true });
      }
      const fallback = window.setTimeout(playIntro, 2400);

      gsap.fromTo(
        type.current,
        { y: 0, scale: 1, autoAlpha: 1 },
        {
          y: -90,
          scale: 0.94,
          autoAlpha: 0,
          ease: "none",
          immediateRender: false,
          scrollTrigger: {
            trigger: section.current,
            start: "top top",
            end: "bottom top",
            scrub: 0.7,
            onUpdate: (self) => {
              state.current.progress = self.progress;
            },
          },
        },
      );

      return () => {
        window.removeEventListener("koria:ready", playIntro);
        window.clearTimeout(fallback);
      };
    },
    { scope: section },
  );

  const onMouse = (event: React.MouseEvent) => {
    if (!showScene) return;
    const x = (event.clientX / window.innerWidth) * 2 - 1;
    const y = -(event.clientY / window.innerHeight) * 2 + 1;
    state.current.mouseX = x;
    state.current.mouseY = y;
  };

  return (
    <section
      id="top"
      ref={section}
      onMouseMove={onMouse}
      className="relative h-[145vh] bg-ink"
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        <Image
          src="/images/aircraft-clouds.png"
          alt="Private aircraft moving through layered clouds"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {showScene && (
          <div className="pointer-events-none absolute inset-0">
            <AircraftScene state={state} />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink via-ink/35 to-ink/25" />

        <div
          ref={type}
          className="pointer-events-none relative z-10 flex h-full flex-col justify-end px-5 pb-16 md:px-8 md:pb-20 lg:px-12"
        >
          <p className="label mb-6 text-champagne" data-hero-sub>
            Private travel, simplified.
          </p>
          <h1 className="display max-w-5xl text-[clamp(4.2rem,14vw,11rem)] text-ivory">
            <span className="block overflow-hidden">
              <span data-hero-line className="block">
                KORIA
              </span>
            </span>
          </h1>
          <p
            data-hero-sub
            className="mt-6 max-w-md text-base leading-relaxed text-ivory/75 md:text-lg"
          >
            The smarter way to discover, coordinate, and experience private
            aviation.
          </p>
          <div
            data-hero-cta
            className="pointer-events-auto mt-10 flex flex-wrap gap-4"
          >
            <MagneticButton href={START_KORIA_HREF}>Start a Koria →</MagneticButton>
            <MagneticButton href="#how-it-works" variant="ghost" cursor="EXPLORE">
              Discover Koria
            </MagneticButton>
          </div>
        </div>
      </div>
    </section>
  );
}
