import { NextResponse } from "next/server";
import { error, isAuthContext, requireBearerAuth } from "@/lib/api/auth";
import { loadAccountExport } from "@/lib/account";
import { logError } from "@/lib/log";

export async function GET(request: Request) {
  const auth = await requireBearerAuth(request);
  if (!isAuthContext(auth)) return auth;

  const exported = await loadAccountExport(auth.supabase, auth.userId);
  if (!exported.ok) {
    logError("unhandled_error", { table: "profiles", message: exported.message });
    return error(exported.message, 500);
  }

  const requestId = crypto.randomUUID();
  return new NextResponse(JSON.stringify(exported.body, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="koria-export.json"',
      "x-request-id": requestId,
    },
  });
}
