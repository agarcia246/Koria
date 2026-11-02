import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";
import { assertProductionEnv } from "@/lib/env-guard";
import { logError } from "@/lib/log";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      assertProductionEnv();
    } catch (error) {
      // Next.js turns a throw from register() into an unhandledRejection and
      // leaves the process running, so a missing variable would not fail startup.
      console.error(error);
      process.exit(1);
    }
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
