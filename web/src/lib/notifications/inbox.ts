import type { Tables } from "@/lib/database.types";

export const NOTIFICATION_COLUMNS = "id, title, body, event, trip_request_id, read_at, created_at";

type NotificationRow = Pick<
  Tables<"notifications">,
  "id" | "title" | "body" | "event" | "trip_request_id" | "read_at" | "created_at"
>;

export function notificationJson(row: NotificationRow) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    event: row.event,
    trip_request_id: row.trip_request_id,
    read_at: row.read_at,
    created_at: row.created_at,
  };
}

export function notificationPage(request: Request) {
  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "20");
  const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.trunc(limitRaw))) : 20;
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.trunc(offsetRaw)) : 0;
  return { limit, offset };
}
