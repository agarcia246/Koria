import { logError, logInfo } from "@/lib/log";
import { renderTemplate } from "@/lib/email/templates";
import type { EmailTemplate, EmailTemplateData } from "@/lib/email/types";

/**
 * Resend sends from notify.koria.travel so the apex mailbox (hello@koria.travel)
 * keeps its own MX. Add the domain in Resend; do not add koria.travel itself.
 *
 * DNS for the human. Names are fully qualified. The DKIM value is generated
 * when the domain is added — copy that one string from the Resend domain page.
 * The SPF records below are the us-east-1 defaults.
 *
 *   TXT  resend._domainkey.notify.koria.travel
 *        <DKIM public key from the Resend domain page>
 *   MX   send.notify.koria.travel   10   feedback-smtp.us-east-1.amazonses.com
 *   TXT  send.notify.koria.travel        v=spf1 include:amazonses.com ~all
 *   TXT  _dmarc.notify.koria.travel      v=DMARC1; p=none;
 *
 * Domains created in Resend after August 2026 may show CNAME records instead of
 * the MX + SPF TXT pair. If the domain page shows CNAMEs, add those and skip
 * the MX and SPF TXT lines. Do not proxy the CNAMEs.
 *
 * Env: RESEND_API_KEY, EMAIL_FROM (KORIA <notifications@notify.koria.travel>).
 * Both unset locally. Sending no-ops until the key is in host secrets.
 */
export const SENDING_DOMAIN = "notify.koria.travel";
export const DEFAULT_EMAIL_FROM = "KORIA <notifications@notify.koria.travel>";

const RESEND_URL = "https://api.resend.com/emails";

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; skipped: true }
  | { ok: false; skipped: false };

export async function sendEmail<T extends EmailTemplate>(
  template: T,
  to: string,
  data: EmailTemplateData[T],
): Promise<SendEmailResult> {
  const recipient = to.trim();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    const message = !apiKey ? "RESEND_API_KEY is unset" : "EMAIL_FROM is unset";
    logInfo("email_skipped", { template, message });
    return { ok: false, skipped: true };
  }
  if (!recipient) {
    logInfo("email_skipped", { template, message: "recipient is empty" });
    return { ok: false, skipped: true };
  }

  const rendered = renderTemplate(template, data);
  let response: Response;
  try {
    response = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "email provider request failed";
    logError("email_send_failed", { template, message });
    return { ok: false, skipped: false };
  }

  if (!response.ok) {
    const message = await providerMessage(response);
    logError("email_send_failed", { template, message });
    return { ok: false, skipped: false };
  }

  const body = (await response.json().catch(() => null)) as { id?: string } | null;
  return { ok: true, id: body?.id ?? "" };
}

async function providerMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === "string" && body.message) return body.message;
  } catch {
    // The provider body is not needed beyond the status.
  }
  return `email provider returned ${response.status}`;
}
