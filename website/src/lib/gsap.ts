"use client";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let registered = false;

export function registerGsap() {
  if (registered || typeof window === "undefined") return;
  gsap.registerPlugin(useGSAP, ScrollTrigger);
  gsap.defaults({ ease: "power2.out", duration: 0.9 });
  registered = true;
}

registerGsap();

export { gsap, ScrollTrigger, useGSAP };
