"use client";

import { useState } from "react";
import { KoriaMark } from "@/components/ui/KoriaMark";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { NAV_LINKS, START_KORIA_HREF } from "@/lib/constants";
import { cn } from "@/lib/cn";

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 z-50 w-full">
      <nav className="relative z-[70] flex items-center justify-between px-5 py-5 md:px-8 lg:px-12">
        <a
          href="#top"
          className="flex items-center gap-3 text-ivory mix-blend-difference"
          data-cursor="KORIA"
        >
          <KoriaMark className="h-6 w-6" />
          <span className="label tracking-[0.42em]">Koria</span>
        </a>

        <ul className="hidden items-center gap-9 mix-blend-difference lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="label text-[0.62rem] tracking-[0.22em] text-ivory/80 transition-colors duration-300 hover:text-ivory"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden lg:block">
          <MagneticButton href={START_KORIA_HREF} className="px-5 py-3">
            Start a Koria →
          </MagneticButton>
        </div>

        <button
          type="button"
          className="label text-[0.62rem] text-ivory mix-blend-difference lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? "Close" : "Menu"}
        </button>
      </nav>

      <div
        className={cn(
          "fixed inset-0 z-[60] bg-ink px-8 pt-28 transition-[opacity,visibility] duration-500 lg:hidden",
          open ? "visible opacity-100" : "invisible opacity-0",
        )}
      >
        <ul className="flex flex-col gap-6">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                onClick={() => setOpen(false)}
                className="display text-5xl text-ivory"
              >
                {link.label}
              </a>
            </li>
          ))}
          <li className="pt-6">
            <a
              href={START_KORIA_HREF}
              className="label text-champagne"
              onClick={() => setOpen(false)}
            >
              Start a Koria →
            </a>
          </li>
        </ul>
      </div>
    </header>
  );
}
