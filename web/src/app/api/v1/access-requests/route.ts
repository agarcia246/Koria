import { NextResponse } from "next/server";
import { error as apiError, isAuthContext, json, requireBearerAuth } from "@/lib/api/auth";
import { logError } from "@/lib/log";
import { createServiceClient } from "@/lib/supabase/admin";

/**
 * Browser forms on the marketing site. The Pages site is served from the
 * repository origin; koria.travel is the apex. Localhost is so the form can
 * be exercised against a local API. Any other origin is not reflected.
 */
const ALLOWED_ORIGINS = new Set([
  "https://agarcia246.github.io",
  "https://koria.travel",
  "https://www.koria.travel",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
]);

/** Soft caps. A shared limiter is a later issue. */
const WINDOW_MS = 60 * 60 * 1000;
const EMAIL_LIMIT = 5;
const IP_LIMIT = 20;

const ipHits = new Map<string, number[]>();

type AccessBody = {
  name?: string;
  email?: string;
  note?: string;
  company_website?: string;
};

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

function withCors(response: NextResponse, request: Request) {
  for (const [key, value] of Object.entries(corsHeaders(request))) {
    response.headers.set(key, value);
  }
  return response;
}

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function ipLimited(ip: string) {
  const now = Date.now();
  const recent = (ipHits.get(ip) ?? []).filter((ts) => now - ts < WINDOW_MS);
  if (recent.length >= IP_LIMIT) {
    ipHits.set(ip, recent);
    return true;
  }
  recent.push(now);
  ipHits.set(ip, recent);
  if (ipHits.size > 5000) {
    const oldest = ipHits.keys().next().value;
    if (oldest) ipHits.delete(oldest);
  }
  return false;
}

function validEmail(value: string) {
  return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function readBody(request: Request): Promise<AccessBody> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object") return {};
    const record = body as Record<string, unknown>;
    return {
      name: typeof record.name === "string" ? record.name.trim().slice(0, 200) : undefined,
      email: typeof record.email === "string" ? record.email.trim().toLowerCase() : undefined,
      note: typeof record.note === "string" ? record.note.trim().slice(0, 2000) : undefined,
      company_website: typeof record.company_website === "string" ? record.company_website : undefined,
    };
  } catch {
    return {};
  }
}

export function OPTIONS(request: Request) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

export async function POST(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Bearer ")) {
    return withCors(await authenticatedRequest(request), request);
  }
  return withCors(await anonymousRequest(request), request);
}

async function authenticatedRequest(request: Request) {
  const auth = await requireBearerAuth(request);
  if (!isAuthContext(auth)) return auth;

  const body = await readBody(request);
  const email = auth.email ?? auth.profile.email;
  if (!email) return apiError("Email required", 400);

  const { data: existing } = await auth.supabase
    .from("access_requests")
    .select("*")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const note = body.note ?? (body.name && !existing?.note ? body.name : undefined);

  if (existing && existing.status === "requested") {
    if (note !== undefined) {
      await auth.supabase.from("access_requests").update({ note }).eq("id", existing.id);
    }
  } else if (!existing || existing.status === "declined") {
    await auth.supabase.from("access_requests").insert({
      user_id: auth.userId,
      email,
      note: note ?? null,
      status: "requested",
    });
    await auth.supabase.from("profiles").update({ access_status: "requested" }).eq("id", auth.userId);
  }

  const { data: profile } = await auth.supabase
    .from("profiles")
    .select("access_status")
    .eq("id", auth.userId)
    .single();

  return json({ access_status: profile?.access_status ?? "requested" });
}

/**
 * The site has no service-role key. This route writes access_requests with
 * the service role and does not create an auth user. Signup later attaches
 * the row. A filled honeypot is discarded. The response does not say whether
 * the email already has access.
 */
async function anonymousRequest(request: Request) {
  const body = await readBody(request);
  if (body.company_website?.trim()) {
    ipLimited(clientIp(request));
    return json({ access_status: "requested" });
  }

  const email = body.email ?? "";
  const name = body.name ?? "";
  if (!name) return apiError("Name required", 400);
  if (!validEmail(email)) return apiError("Email required", 400);
  if (ipLimited(clientIp(request))) return apiError("Try again later", 429);

  const service = createServiceClient();
  const { data: profile, error: profileReadError } = await service
    .from("profiles")
    .select("id, role, access_status")
    .eq("email", email)
    .maybeSingle();
  if (profileReadError) {
    logError("supabase_write_failed", { table: "profiles", message: profileReadError.message });
    return apiError("Could not save the request", 500);
  }
  if (profile && (profile.role !== "customer" || profile.access_status === "approved" || profile.access_status === "invited")) {
    return json({ access_status: "requested" });
  }

  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count, error: countError } = await service
    .from("access_requests")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("created_at", since);
  if (countError) {
    logError("supabase_write_failed", { table: "access_requests", message: countError.message });
    return apiError("Could not save the request", 500);
  }

  const { data: open, error: openError } = await service
    .from("access_requests")
    .select("id, note, user_id")
    .eq("email", email)
    .eq("status", "requested")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (openError) {
    logError("supabase_write_failed", { table: "access_requests", message: openError.message });
    return apiError("Could not save the request", 500);
  }
  if (open) {
    const { error: updateError } = await service
      .from("access_requests")
      .update({
        note: name,
        ...(profile && !open.user_id ? { user_id: profile.id } : {}),
      })
      .eq("id", open.id);
    if (updateError) {
      logError("supabase_write_failed", { table: "access_requests", message: updateError.message });
      return apiError("Could not save the request", 500);
    }
    return json({ access_status: "requested" });
  }

  if ((count ?? 0) >= EMAIL_LIMIT) return apiError("Try again later", 429);

  const { error: insertError } = await service.from("access_requests").insert({
    user_id: profile?.id ?? null,
    email,
    note: body.note || name,
    status: "requested",
  });
  if (insertError) {
    logError("supabase_write_failed", { table: "access_requests", message: insertError.message });
    return apiError("Could not save the request", 500);
  }
  if (profile && profile.access_status !== "requested") {
    const { error: statusError } = await service
      .from("profiles")
      .update({ access_status: "requested" })
      .eq("id", profile.id);
    if (statusError) {
      logError("supabase_write_failed", { table: "profiles", message: statusError.message });
      return apiError("Could not save the request", 500);
    }
  }

  return json({ access_status: "requested" });
}
