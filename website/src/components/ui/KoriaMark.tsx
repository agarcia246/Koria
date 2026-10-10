import type { SVGProps } from "react";
import { cn } from "@/lib/cn";

type KoriaMarkProps = SVGProps<SVGSVGElement>;

export function KoriaMark({ className, ...props }: KoriaMarkProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className={cn("block", className)}
      {...props}
    >
      <path
        d="M9 6v28M31 6v28M9 20h26"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="square"
      />
    </svg>
  );
}
