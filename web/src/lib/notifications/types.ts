import type { EmailTemplate, EmailTemplateData } from "@/lib/email";

/**
 * Recipient rules:
 * Every operator member is notified, whatever `operator_members.role` is.
 * The portal inbox is not limited to admins, and a member is who quotes a request.
 * Admins-only was rejected because a non-admin dispatcher would never see the request.
 *
 * - request_received: members of each operator in the fan-out.
 * - quote_sent: the customer. One notification per quote row.
 * - quote_accepted: members of the winning operator. The trip is awaiting payment.
 * - booking_confirmed: the customer and members of the winning operator.
 * - trip_cancelled: the customer, or the operators still on the trip (fan-out not
 *   declined, plus the operator on an accepted quote). A withdraw notifies the
 *   customer only when this call is what moved the trip to declined.
 * - documents_uploaded: the customer.
 * - invoice_issued: the customer. The PDF is attached. A signed link is not
 *   used because the document URL pattern expires in 10 minutes.
 *
 * `notify` does not need a request. Cron jobs can call it directly.
 * HTTP handlers should use `enqueueNotification`, which schedules this after the response.
 */
export type NotifyEvent =
  | "request_received"
  | "quote_sent"
  | "quote_accepted"
  | "booking_confirmed"
  | "trip_cancelled"
  | "documents_uploaded"
  | "invoice_issued";

export type NotifyPayloadMap = {
  request_received: { tripId: string; operatorIds: string[] };
  quote_sent: { tripId: string; quoteId: string };
  quote_accepted: { tripId: string; quoteId: string; operatorId: string };
  booking_confirmed: { tripId: string; operatorId: string };
  trip_cancelled: {
    tripId: string;
    reason: string | null;
    outcome: "cancelled" | "declined";
    notify: "customer" | "operators";
  };
  documents_uploaded: { tripId: string; documentTitle: string };
  invoice_issued: { tripId: string; invoiceId: string };
};

export type NotifyInput = {
  [E in NotifyEvent]: { event: E } & NotifyPayloadMap[E];
}[NotifyEvent];

export type Recipient = {
  profileId: string;
  email: string | null;
};

export type Delivery<T extends EmailTemplate = EmailTemplate> = {
  recipients: Recipient[];
  template: T;
  data: EmailTemplateData[T];
};
