/**
 * Transactional templates. Call sites land in later issues; this module only renders and sends.
 * `booking_confirmed` is one template. `audience` picks the customer or operator copy.
 */
export const EMAIL_TEMPLATES = [
  "request_received",
  "quote_sent",
  "quote_accepted",
  "booking_confirmed",
  "trip_cancelled",
  "documents_uploaded",
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
};

export type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
};
