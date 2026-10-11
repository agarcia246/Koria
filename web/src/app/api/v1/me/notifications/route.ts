import { error, isAuthContext, json, requireBearerAuth } from "@/lib/api/auth";
import {
  NOTIFICATION_COLUMNS,
  notificationJson,
  notificationPage,
} from "@/lib/notifications/inbox";

/**
 * Own-row access is `notifications_own` in supabase/migrations/0001_init.sql
 * (FOR ALL, profile_id = auth.uid()). 0004 documents that policy and does not
 * replace it. This route uses the caller JWT, so that policy is the gate, and
 * also filters profile_id so /me never returns another profile's rows.
 */
export async function GET(request: Request) {
  const auth = await requireBearerAuth(request);
  if (!isAuthContext(auth)) return auth;

  const { limit, offset } = notificationPage(request);
  const { data, error: readError } = await auth.userClient
    .from("notifications")
    .select(NOTIFICATION_COLUMNS)
    .eq("profile_id", auth.userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit);

  if (readError) return error(readError.message, 500);

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  return json({
    notifications: rows.slice(0, limit).map(notificationJson),
    limit,
    offset,
    has_more: hasMore,
  });
}
