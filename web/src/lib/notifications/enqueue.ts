import { after } from "next/server";
import { logError } from "@/lib/log";
import { notify } from "@/lib/notifications/notify";
import type { NotifyEvent, NotifyPayloadMap } from "@/lib/notifications/types";

/**
 * Schedules notify() after the response. Do not await it in the handler.
 * Call `notify` itself from a cron job, where there is no request for `after`.
 * A failure to schedule is logged and does not roll back the write that already happened.
 */
export function enqueueNotification<E extends NotifyEvent>(event: E, payload: NotifyPayloadMap[E]) {
  try {
    after(() => {
      void notify(event, payload);
    });
  } catch (error) {
    logError("notification_failed", {
      message: error instanceof Error ? error.message : "notification could not be scheduled",
    });
  }
}
