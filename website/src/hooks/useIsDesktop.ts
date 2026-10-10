"use client";

import { useMediaQuery } from "./useMediaQuery";

export function useIsDesktop() {
  return useMediaQuery("(min-width: 1024px)");
}
