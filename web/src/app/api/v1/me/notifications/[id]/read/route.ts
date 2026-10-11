import { error, isAuthContext, json, requireBearerAuth } from "@/lib/api/auth";
import { logError } from "@/lib/log";
import { NOTIFICATION_COLUMNS, notificationJson } from "@/lib/notifications/inbox";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireBearerAuth(request);
  if (!isAuthContext(auth)) return auth;

  const { id } = await context.params;
  const { data: existing, error: lookupError } = await auth.userClient
    .from("notifications")
    .select(NOTIFICATION_COLUMNS)
    .eq("id", id)
    .eq("profile_id", auth.userId)
    .maybeSingle();

  if (lookupError) return error(lookupError.message, 500);
  if (!existing) return error("Notification not found", 404);
  if (existing.read_at) return json(notificationJson(existing));

  const { data: updated, error: updateError } = await auth.userClient
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("profile_id", auth.userId)
    .select(NOTIFICATION_COLUMNS)
    .maybeSingle();

  if (updateError) {
    logError("supabase_write_failed", { table: "notifications", message: updateError.message });
    return error(updateError.message, 500);
  }
  if (!updated) return error("Notification not found", 404);
  return json(notificationJson(updated));
}
