"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

type RevealTextProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: "h1" | "h2" | "h3" | "p" | "div";
};

export function RevealText({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: RevealTextProps) {
  const ref = useRef<HTMLElement>(null);
  const reduce = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (!ref.current || reduce) return;
      gsap.from(ref.current.querySelectorAll("[data-line]"), {
        yPercent: 110,
        duration: 1.15,
        ease: "power3.out",
        stagger: 0.08,
        delay,
        scrollTrigger: {
          trigger: ref.current,
          start: "top 85%",
        },
      });
    },
    { scope: ref, dependencies: [reduce, delay] },
  );

  return (
    <Tag ref={ref as never} className={cn(className)}>
      {typeof children === "string" ? (
        children.split("\n").map((line) => (
          <span key={line} className="block overflow-hidden">
            <span data-line className="block">
              {line}
            </span>
          </span>
        ))
      ) : (
        <span className="block overflow-hidden">
          <span data-line className="block">
            {children}
          </span>
        </span>
      )}
    </Tag>
  );
}
