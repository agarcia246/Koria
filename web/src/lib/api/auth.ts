import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Database, Tables, UserRole, AccessStatus } from "@/lib/database.types";
import { createServiceClient } from "@/lib/supabase/admin";

export type AuthContext = {
  userId: string;
  email: string | null;
  role: UserRole;
  accessStatus: AccessStatus;
  profile: Tables<"profiles">;
  supabase: ReturnType<typeof createServiceClient>;
  userClient: ReturnType<typeof createClient<Database>>;
};

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireBearerAuth(
  request: Request,
  opts?: { requireApprovedCustomer?: boolean },
): Promise<AuthContext | NextResponse> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return error("Unauthorized", 401);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const userClient = createClient<Database>(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser(token);
  if (authError || !user) return error("Unauthorized", 401);

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return error("Profile not found", 404);

  if (
    opts?.requireApprovedCustomer &&
    profile.role === "customer" &&
    profile.access_status !== "approved"
  ) {
    return error("Access not approved", 403);
  }

  return {
    userId: user.id,
    email: user.email ?? profile.email,
    role: profile.role,
    accessStatus: profile.access_status,
    profile,
    supabase,
    userClient,
  };
}

export function isAuthContext(v: AuthContext | NextResponse): v is AuthContext {
  return !(v instanceof NextResponse);
}
