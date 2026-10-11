import { sendEmail } from "@/lib/email";
import { logError } from "@/lib/log";
import { createServiceClient } from "@/lib/supabase/admin";

export type OperatorInviteRole = "admin" | "member";

/**
 * Emails an operator invite. Does not create the user or the membership.
 * M7 (KOR-38) calls this after it inserts `operator_members`.
 *
 * `account: "new"` sends a one-time magic link. `account: "existing"` tells
 * the person they were added and does not mint a link.
 * The link is never written to the log. Provider errors are redacted first.
 */
export async function sendOperatorInvite(input: {
  email: string;
  operatorName: string;
  role: OperatorInviteRole;
  account: "new" | "existing";
}): Promise<void> {
  try {
    if (input.account === "existing") {
      await sendEmail("operator_added", input.email, {
        operatorName: input.operatorName,
        role: input.role,
        portalUrl: `${siteUrl()}/login`,
      });
      return;
    }

    const magicLink = await createMagicLink(input.email);
    if (!magicLink) return;
    await sendEmail("operator_invite", input.email, {
      operatorName: input.operatorName,
      role: input.role,
      magicLink,
    });
  } catch (error) {
    logError("email_send_failed", {
      template: input.account === "new" ? "operator_invite" : "operator_added",
      message: redact(error instanceof Error ? error.message : "operator invite failed"),
    });
  }
}

async function createMagicLink(email: string): Promise<string | null> {
  const service = createServiceClient();
  const { data, error } = await service.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${siteUrl()}/auth/callback` },
  });
  if (error) {
    logError("email_send_failed", {
      template: "operator_invite",
      message: redact(error.message),
    });
    return null;
  }
  const link = data.properties?.action_link ?? "";
  if (!link) {
    logError("email_send_failed", {
      template: "operator_invite",
      message: "magic link was not returned",
    });
    return null;
  }
  return link;
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function redact(message: string): string {
  return message.replace(/https?:\/\/\S+/g, "[link]");
}
