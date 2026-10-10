"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import { useIsTouch } from "@/hooks/useIsTouch";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

export function CustomCursor() {
  const cursor = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const isTouch = useIsTouch();
  const reduce = usePrefersReducedMotion();

  useEffect(() => {
    if (isTouch || reduce) return;
    document.documentElement.classList.add("has-custom-cursor");

    const el = cursor.current;
    if (!el) return;

    const xTo = gsap.quickTo(el, "x", { duration: 0.35, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.35, ease: "power3.out" });

    const move = (event: MouseEvent) => {
      xTo(event.clientX);
      yTo(event.clientY);
    };

    const enter = (event: Event) => {
      const target = event.currentTarget as HTMLElement;
      const text = target.dataset.cursor ?? "";
      if (label.current) label.current.textContent = text;
      gsap.to(el, { scale: text ? 3.4 : 2.1, duration: 0.35, ease: "power3.out" });
      if (label.current) {
        gsap.to(label.current, { autoAlpha: text ? 1 : 0, duration: 0.25 });
      }
    };

    const leave = () => {
      gsap.to(el, { scale: 1, duration: 0.4, ease: "power3.out" });
      if (label.current) {
        gsap.to(label.current, { autoAlpha: 0, duration: 0.2 });
      }
    };

    window.addEventListener("mousemove", move);
    const nodes = document.querySelectorAll("a, button, [data-cursor]");
    nodes.forEach((node) => {
      node.addEventListener("mouseenter", enter);
      node.addEventListener("mouseleave", leave);
    });

    return () => {
      document.documentElement.classList.remove("has-custom-cursor");
      window.removeEventListener("mousemove", move);
      nodes.forEach((node) => {
        node.removeEventListener("mouseenter", enter);
        node.removeEventListener("mouseleave", leave);
      });
    };
  }, [isTouch, reduce]);

  if (isTouch || reduce) return null;

  return (
    <div
      ref={cursor}
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-[80] flex h-3 w-3 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-ivory/80 mix-blend-difference"
    >
      <span
        ref={label}
        className="label pointer-events-none text-[0.45rem] tracking-[0.22em] text-ivory opacity-0"
      />
    </div>
  );
}
