import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const pendingCookies: CookieToSet[] = [];

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
            const index = pendingCookies.findIndex((cookie) => cookie.name === name);
            const entry = { name, value, options };
            if (index >= 0) pendingCookies[index] = entry;
            else pendingCookies.push(entry);
          });
        },
      },
    },
  );

  function redirectWithSession(url: URL) {
    const redirectResponse = NextResponse.redirect(url);
    pendingCookies.forEach(({ name, value, options }) => {
      redirectResponse.cookies.set(name, value, options);
    });
    return redirectResponse;
  }

  // The magic link lands with ?code=. The browser holds the PKCE verifier, so
  // the page must finish sign-in. Exchanging here deletes that verifier.
  if (request.nextUrl.searchParams.has("code")) {
    return NextResponse.next({ request });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isApi = path.startsWith("/api/");
  const isAuthRoute = path.startsWith("/login") || path.startsWith("/auth/");
  const isPublicAsset =
    path.startsWith("/_next") || path.startsWith("/favicon") || path.includes(".");

  if (isApi || isPublicAsset) {
    return supabaseResponse;
  }

  if (!user && !isAuthRoute && path !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return redirectWithSession(url);
  }

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role ?? "customer";

    if (path === "/" || path === "/login") {
      const url = request.nextUrl.clone();
      url.search = "";
      if (role === "admin") url.pathname = "/admin";
      else if (role === "operator") url.pathname = "/operator";
      else url.pathname = "/login";
      if (role === "customer") {
        url.searchParams.set("error", "customer_no_portal");
      }
      return redirectWithSession(url);
    }

    if (path.startsWith("/operator") && role !== "operator" && role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      return redirectWithSession(url);
    }

    if (path.startsWith("/admin") && role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = role === "operator" ? "/operator" : "/login";
      url.search = "";
      return redirectWithSession(url);
    }
  }

  pendingCookies.forEach(({ name, value, options }) => {
    supabaseResponse.cookies.set(name, value, options);
  });
  return supabaseResponse;
}
