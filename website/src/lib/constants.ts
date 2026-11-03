export const START_KORIA_HREF =
  "mailto:start@flykoria.com?subject=Start%20a%20KORIA";

/** Empty unless the Pages build was given a live API. The mailto CTA stays. */
export const KORIA_API_URL = (process.env.NEXT_PUBLIC_KORIA_API_URL || "").trim().replace(/\/$/, "");

/** Empty until the App Store listing exists. The badge renders only when this is set. */
export const APP_STORE_URL = (process.env.NEXT_PUBLIC_APP_STORE_URL || "").trim();
export const CONTACT_HREF = "mailto:hello@flykoria.com?subject=Talk%20to%20KORIA";
export const OPERATOR_APPLY_HREF = "mailto:start@flykoria.com?subject=Operator%20application";
export const INSTAGRAM_HREF = "https://instagram.com/koria";

export const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#experience", label: "The experience" },
  { href: "#concierge", label: "Concierge" },
  { href: "#about", label: "About" },
] as const;
