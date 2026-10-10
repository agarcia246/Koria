"use client";

import Image from "next/image";
import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

type ParallaxImageProps = {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
};

export function ParallaxImage({
  src,
  alt,
  className,
  priority,
  sizes = "(max-width: 768px) 100vw, 80vw",
}: ParallaxImageProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const reduce = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (!wrap.current || reduce) return;
      const img = wrap.current.querySelector("img");
      if (!img) return;

      gsap.fromTo(
        img,
        { yPercent: -8, scale: 1.12 },
        {
          yPercent: 8,
          scale: 1.04,
          ease: "none",
          scrollTrigger: {
            trigger: wrap.current,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.8,
          },
        },
      );
    },
    { scope: wrap, dependencies: [reduce] },
  );

  return (
    <div ref={wrap} className={cn("overflow-hidden", className)}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className="object-cover will-transform"
      />
    </div>
  );
}
