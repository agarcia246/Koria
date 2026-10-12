import { error, isAuthContext, json, requireBearerAuth } from "@/lib/api/auth";
import { logError } from "@/lib/log";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

export async function POST(request: Request) {
  const auth = await requireBearerAuth(request);
  if (!isAuthContext(auth)) return auth;

  const { error: writeError } = await auth.supabase
    .from("profiles")
    .update({
      terms_version: CURRENT_TERMS_VERSION,
      terms_accepted_at: new Date().toISOString(),
    })
    .eq("id", auth.userId);

  if (writeError) {
    logError("supabase_write_failed", { table: "profiles", message: writeError.message });
    return error(writeError.message, 500);
  }

  return json({
    terms_version_required: CURRENT_TERMS_VERSION,
    terms_accepted: true,
  });
}
