/**
 * Transactional templates.
 * `booking_confirmed` is one template. `audience` picks the customer or operator copy.
 * `operator_invite` carries a one-time magic link. Callers must not log that value.
 */
export const EMAIL_TEMPLATES = [
  "request_received",
  "quote_sent",
  "quote_accepted",
  "booking_confirmed",
  "trip_cancelled",
  "documents_uploaded",
  "operator_invite",
  "operator_added",
] as const;

export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

export type EmailAudience = "customer" | "operator";

export type EmailTemplateData = {
  request_received: {
    operatorName: string;
    route: string;
    departAt: string;
    passengers: number;
    portalUrl: string;
  };
  quote_sent: {
    route: string;
    operatorName: string;
    total: string;
    validUntil: string;
  };
  quote_accepted: {
    operatorName: string;
    route: string;
    total: string;
    portalUrl: string;
  };
  booking_confirmed: {
    audience: EmailAudience;
    route: string;
    departAt: string;
    portalUrl: string | null;
  };
  trip_cancelled: {
    audience: EmailAudience;
    route: string;
    reason: string | null;
    outcome: "cancelled" | "declined";
  };
  documents_uploaded: {
    route: string;
    documentTitle: string;
  };
  operator_invite: {
    operatorName: string;
    role: "admin" | "member";
    magicLink: string;
  };
  operator_added: {
    operatorName: string;
    role: "admin" | "member";
    portalUrl: string;
  };
};

export type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
};
