import { error, isAuthContext, json, requireBearerAuth } from "@/lib/api/auth";
import { anonymizedProfile, deletionBlock } from "@/lib/account";
import { logError } from "@/lib/log";

export async function POST(request: Request) {
  const auth = await requireBearerAuth(request);
  if (!isAuthContext(auth)) return auth;

  const block = await deletionBlock(auth.supabase, auth.userId);
  if (!block.ok) {
    if ("error" in block) return error(block.error, 409);
    logError("unhandled_error", { table: "profiles", message: block.message });
    return error(block.message, 500);
  }

  const { error: passengerError } = await auth.supabase
    .from("passenger_profiles")
    .delete()
    .eq("customer_id", auth.userId);
  if (passengerError) {
    logError("supabase_write_failed", { table: "passenger_profiles", message: passengerError.message });
    return error(passengerError.message, 500);
  }

  const { error: notificationError } = await auth.supabase
    .from("notifications")
    .delete()
    .eq("profile_id", auth.userId);
  if (notificationError) {
    logError("supabase_write_failed", { table: "notifications", message: notificationError.message });
    return error(notificationError.message, 500);
  }

  const { error: profileError } = await auth.supabase
    .from("profiles")
    .update(anonymizedProfile(auth.userId))
    .eq("id", auth.userId);
  if (profileError) {
    logError("supabase_write_failed", { table: "profiles", message: profileError.message });
    return error(profileError.message, 500);
  }

  const { error: authError } = await auth.supabase.auth.admin.deleteUser(auth.userId);
  if (authError) {
    logError("supabase_write_failed", { table: "auth.users", message: authError.message });
    return error(authError.message, 500);
  }

  return json({ deleted: true });
}
