import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { error } from "@/lib/api/auth";
import { createServiceClient } from "@/lib/supabase/admin";

/**
 * Bearer auth for /api/v1/operator.
 * The token is an operator API key, not a user JWT. Lookup is SHA-256(token).
 * Rate limiting is out of scope.
 */
export async function requireOperatorApiKey(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return error("Unauthorized", 401);

  const keyHash = createHash("sha256").update(token).digest("hex");
  const supabase = createServiceClient();
  const { data, error: dbError } = await supabase
    .from("operator_api_keys")
    .select("operator_id")
    .eq("key_hash", keyHash)
    .is("revoked_at", null)
    .maybeSingle();
  if (dbError || !data) return error("Unauthorized", 401);

  return { operatorId: data.operator_id, supabase };
}

export function isOperatorKey(
  value: { operatorId: string; supabase: ReturnType<typeof createServiceClient> } | NextResponse,
): value is { operatorId: string; supabase: ReturnType<typeof createServiceClient> } {
  return !(value instanceof NextResponse);
}
