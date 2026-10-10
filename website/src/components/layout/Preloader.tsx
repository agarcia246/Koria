"use client";

import { useRef, useState } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { KoriaMark } from "@/components/ui/KoriaMark";

export function Preloader() {
  const overlay = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);

  useGSAP(
    () => {
      if (done) return;
      const finished = { current: false };
      window.dispatchEvent(new Event("koria:lenis-stop"));

      const finish = () => {
        if (finished.current) return;
        finished.current = true;
        window.dispatchEvent(new Event("koria:lenis-start"));
        window.dispatchEvent(new Event("koria:ready"));
        document.body.dataset.koriaReady = "true";
        setDone(true);
      };

      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        finish();
        return;
      }

      const tl = gsap.timeline({
        defaults: { ease: "power3.inOut" },
        onComplete: finish,
      });

      tl.fromTo(
        "[data-preloader-mark]",
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: 0.6 },
      )
        .fromTo(
          "[data-preloader-word]",
          { yPercent: 110 },
          { yPercent: 0, duration: 0.75 },
          "-=0.25",
        )
        .to(overlay.current, { yPercent: -100, duration: 0.95, delay: 0.28 });

      const fallback = window.setTimeout(finish, 3200);
      return () => window.clearTimeout(fallback);
    },
    { scope: overlay },
  );

  if (done) return null;

  return (
    <div
      ref={overlay}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink text-ivory"
    >
      <div className="flex flex-col items-center gap-6">
        <KoriaMark data-preloader-mark="" className="h-10 w-10" />
        <div className="overflow-hidden">
          <p
            data-preloader-word
            className="label text-[0.8rem] tracking-[0.55em]"
          >
            KORIA
          </p>
        </div>
      </div>
    </div>
  );
}
