const LOCAL_SITE_URL = "http://localhost:3000";

/**
 * Public origin for operator emails, invite links, and auth redirects.
 * Throws in production when NEXT_PUBLIC_SITE_URL is unset. Other environments
 * fall back to localhost. A single trailing slash is removed.
 */
export function siteUrl(env: NodeJS.ProcessEnv = process.env): string {
  const configured = (env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/$/, "");
  if (configured) return configured;
  if (env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL is unset");
  }
  return LOCAL_SITE_URL;
}
