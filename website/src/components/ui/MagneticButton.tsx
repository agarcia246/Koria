"use client";

import { useRef } from "react";
import { gsap } from "@/lib/gsap";
import { cn } from "@/lib/cn";
import { useIsTouch } from "@/hooks/useIsTouch";

type MagneticButtonProps = {
  children: React.ReactNode;
  className?: string;
  cursor?: string;
  variant?: "solid" | "ghost" | "line";
} & ({ href: string; onClick?: undefined } | { href?: undefined; onClick: () => void });

export function MagneticButton({
  href,
  onClick,
  children,
  className,
  cursor = "KORIA",
  variant = "solid",
}: MagneticButtonProps) {
  const ref = useRef<HTMLElement>(null);
  const isTouch = useIsTouch();

  const onMove = (event: React.MouseEvent<HTMLElement>) => {
    if (isTouch || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    gsap.to(ref.current, {
      x: x * 0.28,
      y: y * 0.28,
      duration: 0.45,
      ease: "power3.out",
    });
  };

  const onLeave = () => {
    if (!ref.current) return;
    gsap.to(ref.current, { x: 0, y: 0, duration: 0.7, ease: "power3.out" });
  };

  const styles = {
    solid: "bg-ivory text-ink hover:bg-champagne",
    ghost: "border border-ivory/25 text-ivory hover:border-champagne hover:text-champagne",
    line: "text-ivory hover:text-champagne",
  }[variant];

  const classes = cn(
    "inline-flex items-center justify-center gap-3 px-7 py-4 text-[0.7rem] font-medium tracking-[0.28em] uppercase transition-colors duration-500",
    styles,
    className,
  );

  if (onClick) {
    return (
      <button
        ref={ref as React.RefObject<HTMLButtonElement>}
        type="button"
        data-cursor={cursor}
        onClick={onClick}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className={classes}
      >
        {children}
      </button>
    );
  }

  return (
    <a
      ref={ref as React.RefObject<HTMLAnchorElement>}
      href={href}
      data-cursor={cursor}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={classes}
    >
      {children}
    </a>
  );
}
