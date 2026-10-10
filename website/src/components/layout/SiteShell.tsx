"use client";

import { CustomCursor } from "./CustomCursor";
import { Navbar } from "./Navbar";
import { Preloader } from "./Preloader";
import { SmoothScroll } from "./SmoothScroll";

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <SmoothScroll>
      <Preloader />
      <CustomCursor />
      <Navbar />
      {children}
    </SmoothScroll>
  );
}
