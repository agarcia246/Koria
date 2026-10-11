import type { EmailTemplate, EmailTemplateData, RenderedEmail } from "@/lib/email/types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function layout(paragraphs: string[], link?: { href: string; label: string }): string {
  const body = paragraphs
    .map((paragraph) => `<p style="margin:0 0 16px;">${escapeHtml(paragraph)}</p>`)
    .join("");
  const action = link
    ? `<p style="margin:0;"><a href="${escapeHtml(link.href)}" style="color:#1a1a1a;">${escapeHtml(link.label)}</a></p>`
    : "";
  return `<div style="font-family:Georgia,serif;color:#1a1a1a;line-height:1.5;max-width:520px;">
<p style="margin:0 0 24px;letter-spacing:0.12em;font-size:14px;">KORIA</p>
${body}${action}
</div>`;
}

function textOf(paragraphs: string[], link?: { href: string; label: string }): string {
  const lines = [...paragraphs];
  if (link) lines.push(`${link.label}: ${link.href}`);
  return lines.join("\n\n");
}

export function renderTemplate<T extends EmailTemplate>(
  template: T,
  data: EmailTemplateData[T],
): RenderedEmail {
  switch (template) {
    case "request_received": {
      const row = data as EmailTemplateData["request_received"];
      const paragraphs = [
        `${row.operatorName} has a new trip request.`,
        `${row.route}. Departs ${row.departAt}. ${row.passengers} passengers.`,
      ];
      const link = { href: row.portalUrl, label: "Open the request" };
      return {
        subject: `New trip request · ${row.route}`,
        text: textOf(paragraphs, link),
        html: layout(paragraphs, link),
      };
    }
    case "quote_sent": {
      const row = data as EmailTemplateData["quote_sent"];
      const paragraphs = [
        `${row.operatorName} sent a quote for ${row.route}.`,
        `Total ${row.total}. Valid until ${row.validUntil}.`,
        "Open the KORIA app to review it.",
      ];
      return {
        subject: `Quote for ${row.route}`,
        text: textOf(paragraphs),
        html: layout(paragraphs),
      };
    }
    case "quote_accepted": {
      const row = data as EmailTemplateData["quote_accepted"];
      const paragraphs = [
        `The customer accepted ${row.operatorName}'s quote for ${row.route}.`,
        `Total ${row.total}. The trip is awaiting payment. This is not a confirmed booking.`,
      ];
      const link = { href: row.portalUrl, label: "Open the request" };
      return {
        subject: `Quote accepted · ${row.route}`,
        text: textOf(paragraphs, link),
        html: layout(paragraphs, link),
      };
    }
    case "booking_confirmed": {
      const row = data as EmailTemplateData["booking_confirmed"];
      const paragraphs =
        row.audience === "operator"
          ? [`${row.route} is confirmed.`, `Departs ${row.departAt}.`]
          : [`Your trip is confirmed.`, `${row.route}. Departs ${row.departAt}.`, "Open the KORIA app for the details."];
      const link = row.portalUrl ? { href: row.portalUrl, label: "Open the booking" } : undefined;
      return {
        subject: `Trip confirmed · ${row.route}`,
        text: textOf(paragraphs, link),
        html: layout(paragraphs, link),
      };
    }
    case "trip_cancelled": {
      const row = data as EmailTemplateData["trip_cancelled"];
      const verb = row.outcome === "declined" ? "declined" : "cancelled";
      const lead =
        row.audience === "operator"
          ? `The customer ${verb} ${row.route}.`
          : row.outcome === "declined"
            ? `Your request for ${row.route} was declined.`
            : `${row.route} was cancelled.`;
      const paragraphs = [lead];
      if (row.reason) paragraphs.push(row.reason);
      return {
        subject: `${row.outcome === "declined" ? "Request declined" : "Trip cancelled"} · ${row.route}`,
        text: textOf(paragraphs),
        html: layout(paragraphs),
      };
    }
    case "documents_uploaded": {
      const row = data as EmailTemplateData["documents_uploaded"];
      const paragraphs = [
        `${row.documentTitle} was added to ${row.route}.`,
        "Open the KORIA app to download it.",
      ];
      return {
        subject: `Document added · ${row.route}`,
        text: textOf(paragraphs),
        html: layout(paragraphs),
      };
    }
    default: {
      const exhaustive: never = template;
      throw new Error(`Unknown email template: ${String(exhaustive)}`);
    }
  }
}
