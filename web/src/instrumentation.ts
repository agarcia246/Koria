import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";
import { logError } from "@/lib/log";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const header = request.headers["x-request-id"];
  const requestId = Array.isArray(header) ? header[0] : header;
  logError("unhandled_error", {
    request_id: requestId ?? null,
    path: request.path,
    method: request.method,
    route: context.routePath,
    message: error instanceof Error ? error.message : String(error),
  });
  if (process.env.SENTRY_DSN) {
    Sentry.captureRequestError(error, request, context);
  }
};
